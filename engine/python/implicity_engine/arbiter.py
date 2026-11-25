from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from threading import Lock
from typing import Protocol, Sequence
from uuid import UUID, uuid5

from implicity_contracts.generated import (
    ChangePolicy,
    Decision,
    DecisionId,
    Kind,
    Proposal,
    ProposalId,
    Source,
    Status,
    Type1,
)

from .evidence import DailyCount, Dimension, EventSource, evaluate_belief

_NAMESPACE = UUID("d4f353f1-7632-4d63-aebc-02ab6135516b")


@dataclass(frozen=True)
class SessionContext:
    session_id: str
    at_boundary: bool


@dataclass(frozen=True)
class Verdict:
    status: str
    reason: str = ""
    decision: Decision | None = None


@dataclass
class StateData:
    values: dict[tuple[str, str | None], str] = field(default_factory=dict)
    explicit: dict[tuple[str, str | None], str] = field(default_factory=dict)
    learned: dict[tuple[str, str | None], str] = field(default_factory=dict)
    undone: dict[tuple[str, str | None], set[str]] = field(default_factory=dict)
    freshness: dict[tuple[str, str | None], date] = field(default_factory=dict)
    decisions: dict[str, Decision] = field(default_factory=dict)
    active: dict[tuple[str, str | None], str] = field(default_factory=dict)
    acknowledged: set[str] = field(default_factory=set)
    pace: set[date] = field(default_factory=set)
    locks: dict[str, bool] = field(default_factory=dict)
    frozen: bool = False


class Store(Protocol):
    def read(self) -> tuple[int, StateData]: ...
    def commit(self, revision: int, state: StateData) -> bool: ...


class InMemoryStore:
    def __init__(self):
        self.revision = 0
        self.data = StateData()
        self.conflict_next_write = False
        self._lock = Lock()

    def read(self) -> tuple[int, StateData]:
        with self._lock:
            return self.revision, deepcopy(self.data)

    def commit(self, revision: int, state: StateData) -> bool:
        with self._lock:
            if self.conflict_next_write:
                self.conflict_next_write = False
                return False
            if revision != self.revision:
                return False
            self.data = deepcopy(state)
            self.revision += 1
            return True


class Clock(Protocol):
    def now(self) -> datetime: ...


@dataclass(frozen=True)
class State:
    values: dict[str, str]


class _GlobalEventSource:
    def __init__(self, source: EventSource):
        self.source = source

    def daily_counts(self, feature, start, end, exclude_sessions=()):
        rows = self.source.daily_counts(feature, start, end, exclude_sessions)
        grouped: dict[date, DailyCount] = {}
        for row in rows:
            previous = grouped.get(row.day)
            grouped[row.day] = DailyCount(
                row.day,
                "",
                row.happened + (previous.happened if previous else 0),
                row.could_have + (previous.could_have if previous else 0),
                row.conversation_ids
                | (previous.conversation_ids if previous else frozenset()),
            )
        return list(grouped.values())

    def session_summaries(self, start, end, exclude_sessions=()):
        return self.source.session_summaries(start, end, exclude_sessions)


class Engine:
    def __init__(
        self,
        dimensions: Sequence[Dimension],
        source: EventSource,
        store: Store,
        clock: Clock,
    ):
        self.dimensions = {dimension.id: dimension for dimension in dimensions}
        if len(self.dimensions) != len(dimensions):
            raise ValueError("dimension ids must be unique")
        self.source, self.store, self.clock = source, store, clock

    def _source(self, dimension: Dimension) -> EventSource:
        return (
            _GlobalEventSource(self.source)
            if dimension.scope == "global"
            else self.source
        )

    def _dim(self, dimension: str) -> Dimension:
        if dimension not in self.dimensions:
            raise ValueError(f"unknown dimension: {dimension}")
        return self.dimensions[dimension]

    def _now(self) -> datetime:
        now = self.clock.now()
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("clock must return a timezone-aware datetime")
        return now

    @staticmethod
    def _slot(dimension: str, kind: str | None) -> tuple[str, str | None]:
        return dimension, kind

    def _value(self, data: StateData, dimension: Dimension, kind: str | None) -> str:
        key = self._slot(dimension.id, kind)
        if key not in data.values:
            data.values[key] = self._effective(data, dimension, kind)
        return data.values[key]

    @staticmethod
    def _effective(data: StateData, dimension: Dimension, kind: str | None) -> str:
        key = (dimension.id, kind)
        if key in data.explicit:
            return data.explicit[key]
        if key in data.learned and data.learned[key] not in data.undone.get(key, set()):
            return data.learned[key]
        global_key = (dimension.id, None)
        global_value = data.explicit.get(global_key, data.learned.get(global_key))
        if global_value is not None and global_value not in data.undone.get(key, set()):
            return global_value
        blocked = data.undone.get(key, set())
        return next(
            (value for value in dimension.values if value not in blocked),
            dimension.default,
        )

    def state(self, kind: str | None = None) -> State:
        _, data = self.store.read()
        return State(
            {
                d: self._value(data, definition, kind)
                for d, definition in self.dimensions.items()
            }
        )

    def pending_notices(self) -> list[Decision]:
        _, data = self.store.read()
        active = set(data.active.values())
        return [
            deepcopy(d)
            for decision_id, d in data.decisions.items()
            if decision_id in active and d.status in {Status.pending, Status.shown}
        ]

    def evaluate(self, session: SessionContext) -> list[Proposal]:
        now = self._now()
        _, data = self.store.read()
        proposals = []
        for dimension in self.dimensions.values():
            if dimension.change_policy != "automatic":
                continue
            start = now.date() - timedelta(days=dimension.window_days - 1)
            feature_ids = {dimension.occasion}
            feature_ids.update(
                feature
                for pair in dimension.evidence.values()
                for feature in pair.values()
            )
            observed_kinds = {
                row.kind
                for feature in feature_ids
                for row in self.source.daily_counts(feature, start, now.date())
            }
            kinds = {
                kind
                for dim, kind in data.values
                if dim == dimension.id and kind is not None
            }
            kinds.update(observed_kinds)
            kinds.update(
                kind
                for dim, kind in data.explicit
                if dim == dimension.id and kind is not None
            )
            if dimension.scope == "global":
                kinds = set()
            for kind in sorted(kinds or {None}):
                key = self._slot(dimension.id, kind)
                if key in data.explicit:
                    continue
                current = self._value(data, dimension, kind)
                belief = evaluate_belief(
                    dimension,
                    self._source(dimension),
                    current,
                    kind or "",
                    now.date(),
                    freshness_cutoff=data.freshness.get(key),
                    undone_values=data.undone.get(key, set()),
                )
                if belief.applied_value is None or belief.applied_value == current:
                    continue
                proposal_seed = (
                    dimension.id,
                    kind,
                    now.date(),
                    belief.evidence.to_dict(),
                )
                proposal_id = ProposalId(
                    root=f"prop_{uuid5(_NAMESPACE, str(proposal_seed))}"
                )
                try:
                    contract_kind = Kind(kind)
                except ValueError:
                    contract_kind = kind
                proposals.append(
                    Proposal(
                        id=proposal_id,
                        source=Source.rule,
                        dimension=dimension.id,
                        kind=contract_kind,
                        to=belief.applied_value,
                        reason=f"Rule evidence for {dimension.id}",
                        evidence={
                            **belief.evidence.to_dict(),
                            **{
                                "occasions": belief.gates[
                                    belief.judged_value
                                ].occasions,
                                "conversations": belief.gates[
                                    belief.judged_value
                                ].conversations,
                                "days": belief.gates[belief.judged_value].days,
                            },
                        },
                        payload={},
                        change_policy=ChangePolicy.automatic,
                        type=Type1.dimension,
                    )
                )
        return proposals

    def submit(self, proposal: Proposal, session: SessionContext) -> Verdict:
        now = self._now()
        if proposal.source is Source.rule and not session.at_boundary:
            return Verdict("deferred", "session boundary required")
        dimension = self._dim(proposal.dimension)
        kind = getattr(proposal.kind, "value", proposal.kind)
        proposal_evidence = proposal.evidence.model_dump(mode="json")
        revision, data = self.store.read()
        key = self._slot(dimension.id, kind)
        current = self._value(data, dimension, kind)
        # Check 1: contract value, source/policy and scale adjacency.
        if proposal.to not in dimension.values:
            return Verdict("rejected", "invalid value")
        automatic = proposal.source is Source.rule
        if automatic:
            if (dimension.scope == "global") != (kind is None):
                return Verdict("rejected", "proposal scope mismatch")
            if (
                proposal.change_policy is not ChangePolicy.automatic
                or dimension.change_policy != "automatic"
            ):
                return Verdict("rejected", "change policy mismatch")
            if proposal.to in data.undone.get(key, set()):
                return Verdict("rejected", "value was undone")
            if (
                dimension.scale
                and abs(
                    dimension.values.index(proposal.to)
                    - dimension.values.index(current)
                )
                != 1
            ):
                return Verdict("rejected", "scale changes one adjacent value")
        elif proposal.source is not Source.person:
            return Verdict("rejected", "unsupported proposal source")
        else:
            return Verdict("rejected", "person changes use explicit settings")
        # Check 2: freeze and area lock.
        if data.frozen or data.locks.get(dimension.area, False):
            return Verdict("rejected", "frozen or locked")
        # Checks 3–5 apply only to automatic rule decisions.
        if automatic:
            if key in data.explicit:
                return Verdict("rejected", "dimension is explicit")
            judged = proposal_evidence.get("judged_value")
            if not isinstance(judged, str) or judged not in dimension.values:
                judged = proposal.to
            if judged in data.undone.get(key, set()):
                return Verdict("rejected", "value was undone")
            # Recompute from source so a hand-built proposal cannot bypass the gate.
            belief = evaluate_belief(
                dimension,
                self._source(dimension),
                current,
                kind or "",
                now.date(),
                freshness_cutoff=data.freshness.get(key),
                undone_values=data.undone.get(key, set()),
            )
            if (
                belief.judged_value != judged
                or belief.applied_value != proposal.to
                or judged not in belief.gates
                or not belief.gates[judged].met
            ):
                return Verdict("rejected", "gate not met")
            if now.date() in data.pace:
                return Verdict("deferred", "daily pace used")
        decision_id = f"dec_{uuid5(_NAMESPACE, str(proposal.id.root) + str(revision))}"
        decision = Decision(
            id=DecisionId(root=decision_id),
            proposal_id=proposal.id,
            dimension=dimension.id,
            kind=proposal.kind,
            **{"from": current},
            to=proposal.to,
            reason=proposal.reason,
            evidence=proposal_evidence,
            dimension_version=dimension.version,
            status=Status.pending,
            created_at=now,
            shown_at=None,
        )
        updated = deepcopy(data)
        updated.values[key] = proposal.to
        updated.learned[key] = proposal.to
        updated.decisions[decision_id] = decision
        updated.active[key] = decision_id
        if automatic:
            updated.pace.add(now.date())
        if dimension.scale and proposal.to != current:
            updated.freshness[key] = now.date()
        if not self.store.commit(revision, updated):
            return Verdict("deferred", "state changed")
        return Verdict("admitted", decision=decision)

    def acknowledge(self, decision_id: str) -> None:
        revision, data = self.store.read()
        decision = self._decision(data, decision_id)
        data.acknowledged.add(decision_id)
        data.decisions[decision_id] = decision.model_copy(
            update={"status": Status.shown, "shown_at": self._now()}
        )
        if not self.store.commit(revision, data):
            raise RuntimeError("state changed")

    def keep(self, decision_id: str) -> Verdict:
        revision, data = self.store.read()
        if decision_id not in data.acknowledged:
            return Verdict("rejected", "decision not acknowledged")
        decision = self._decision(data, decision_id)
        data.decisions[decision_id] = decision.model_copy(
            update={"status": Status.kept}
        )
        return (
            Verdict("admitted")
            if self.store.commit(revision, data)
            else Verdict("deferred", "state changed")
        )

    def undo(self, decision_id: str) -> Verdict:
        now = self._now()
        revision, data = self.store.read()
        decision = self._decision(data, decision_id)
        key = self._slot(
            decision.dimension, getattr(decision.kind, "value", decision.kind)
        )
        if data.active.get(key) != decision_id:
            return Verdict("rejected", "decision is not active")
        dimension = self._dim(decision.dimension)
        if data.frozen or data.locks.get(dimension.area, False):
            return Verdict("rejected", "frozen or locked")
        data.values[key] = decision.from_
        data.explicit[key] = decision.from_
        data.undone.setdefault(key, set()).add(decision.to)
        data.decisions[decision_id] = decision.model_copy(
            update={"status": Status.undone}
        )
        data.active.pop(key, None)
        if dimension.scale and decision.from_ != decision.to:
            data.freshness[key] = now.date()
        return (
            Verdict("admitted")
            if self.store.commit(revision, data)
            else Verdict("deferred", "state changed")
        )

    def set_explicit(self, dimension: str, value, kind: str | None = None) -> Verdict:
        return self._control(dimension, kind, value)

    def return_to_automatic(self, dimension: str, kind: str | None = None) -> Verdict:
        now = self._now()
        definition = self._dim(dimension)
        if definition.scope == "global" and kind is not None:
            return Verdict("rejected", "global dimension has no kind setting")
        revision, data = self.store.read()
        key = self._slot(dimension, kind)
        old = self._value(data, definition, kind)
        data.explicit.pop(key, None)
        effective = self._effective(data, definition, kind)
        data.values[key] = effective
        if definition.scale and old != effective:
            data.freshness[key] = now.date()
        if old != effective:
            data.active.pop(key, None)
        if data.frozen or data.locks.get(definition.area, False):
            return Verdict("rejected", "frozen or locked")
        return (
            Verdict("admitted")
            if self.store.commit(revision, data)
            else Verdict("deferred", "state changed")
        )

    def _control(self, dimension: str, kind: str | None, value: str) -> Verdict:
        now = self._now()
        definition = self._dim(dimension)
        if definition.scope == "global" and kind is not None:
            return Verdict("rejected", "global dimension has no kind setting")
        if value not in definition.values:
            return Verdict("rejected", "invalid value")
        revision, data = self.store.read()
        if data.frozen or data.locks.get(definition.area, False):
            return Verdict("rejected", "frozen or locked")
        key = self._slot(dimension, kind)
        old = self._value(data, definition, kind)
        data.values[key], data.explicit[key] = value, value
        data.active.pop(key, None)
        if definition.scale and old != value:
            data.freshness[key] = now.date()
        return (
            Verdict("admitted")
            if self.store.commit(revision, data)
            else Verdict("deferred", "state changed")
        )

    def set_lock(self, area: str, locked: bool) -> None:
        if area not in {"look", "layout", "answer_style", "home"}:
            raise ValueError(f"unknown lock area: {area}")
        if not isinstance(locked, bool):
            raise ValueError("locked must be a boolean")
        revision, data = self.store.read()
        data.locks[area] = locked
        if not self.store.commit(revision, data):
            raise RuntimeError("state changed")

    def freeze(self, frozen: bool) -> None:
        if not isinstance(frozen, bool):
            raise ValueError("frozen must be a boolean")
        revision, data = self.store.read()
        data.frozen = frozen
        if not self.store.commit(revision, data):
            raise RuntimeError("state changed")

    def freshness_cutoff(self, kind: str | None, dimension: str) -> date | None:
        _, data = self.store.read()
        return data.freshness.get(self._slot(dimension, kind))

    def undone_values(self, kind: str | None, dimension: str) -> set[str]:
        _, data = self.store.read()
        return set(data.undone.get(self._slot(dimension, kind), set()))

    @staticmethod
    def _decision(data: StateData, decision_id: str) -> Decision:
        try:
            return data.decisions[decision_id]
        except KeyError as exc:
            raise ValueError(f"unknown decision: {decision_id}") from exc
