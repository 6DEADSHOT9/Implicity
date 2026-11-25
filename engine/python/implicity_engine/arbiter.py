from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from threading import Lock
from typing import Protocol, Sequence

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

from .evidence import Dimension, EventSource, evaluate_belief


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


class IdSource(Protocol):
    def proposal_id(self) -> ProposalId: ...
    def decision_id(self) -> DecisionId: ...


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
    values: dict[str, str | None]


class _Stage1EventSource:
    def __init__(self, source: EventSource):
        self.source = source

    def daily_counts(self, feature, start, end, exclude_sessions=()):
        kinds = {kind.value for kind in Kind}
        return [
            row
            for row in self.source.daily_counts(feature, start, end, exclude_sessions)
            if row.kind in kinds
        ]

    def session_summaries(self, start, end, exclude_sessions=()):
        return self.source.session_summaries(start, end, exclude_sessions)


class Engine:
    def __init__(
        self,
        dimensions: Sequence[Dimension],
        source: EventSource,
        store: Store,
        clock: Clock,
        ids: IdSource,
    ):
        self.dimensions = {dimension.id: dimension for dimension in dimensions}
        if len(self.dimensions) != len(dimensions):
            raise ValueError("dimension ids must be unique")
        self.source, self.store, self.clock, self.ids = source, store, clock, ids
        self._stage1_source = _Stage1EventSource(source)

    def _read(self) -> tuple[int, StateData]:
        revision, data = self.store.read()
        return revision, deepcopy(data)

    @staticmethod
    def _kind(kind: str | None) -> str | None:
        return getattr(kind, "value", kind)

    @staticmethod
    def _stage1_kind(kind: str | None) -> bool:
        return kind is None or kind in {item.value for item in Kind}

    def _now(self) -> datetime:
        now = self.clock.now()
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("clock must return a timezone-aware datetime")
        return now

    def _known_kinds(
        self, data: StateData, dimension: Dimension, day: date
    ) -> set[str]:
        known = {
            kind
            for mapping in (data.explicit, data.learned)
            for dim, kind in mapping
            if dim == dimension.id and kind is not None
        }
        start = day - timedelta(days=dimension.window_days - 1)
        feature_ids = {dimension.occasion}
        feature_ids.update(
            feature for pair in dimension.evidence.values() for feature in pair.values()
        )
        known.update(
            row.kind
            for feature in feature_ids
            for row in self._stage1_source.daily_counts(feature, start, day)
        )
        return known & {item.value for item in Kind}

    def _refresh_inherited_cutoffs(
        self,
        data: StateData,
        dimension: Dimension,
        before: dict[str, str | None],
        cutoff: date,
    ) -> None:
        for kind, old_value in before.items():
            if old_value != self._effective(data, dimension, kind):
                data.freshness[(dimension.id, kind)] = cutoff
                data.active.pop((dimension.id, kind), None)

    @staticmethod
    def _slot(dimension: str, kind: str | None) -> tuple[str, str | None]:
        return dimension, kind

    @staticmethod
    def _effective(
        data: StateData, dimension: Dimension, kind: str | None
    ) -> str | None:
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
        if dimension.default not in blocked:
            return dimension.default
        return next((value for value in dimension.values if value not in blocked), None)

    def state(self, kind: str | None = None) -> State:
        kind = self._kind(kind)
        if not self._stage1_kind(kind):
            raise ValueError("custom kinds are unavailable in Stage 1")
        _, data = self._read()
        return State(
            {
                d: self._effective(data, definition, kind)
                for d, definition in self.dimensions.items()
            }
        )

    def pending_notices(self) -> list[Decision]:
        _, data = self._read()
        active = set(data.active.values())
        return [
            deepcopy(d)
            for decision_id, d in data.decisions.items()
            if decision_id in active and d.status in {Status.pending, Status.shown}
        ]

    def evaluate(self, session: SessionContext) -> list[Proposal]:
        now = self._now()
        _, data = self._read()
        proposals = []
        for dimension in self.dimensions.values():
            if dimension.change_policy != "automatic":
                continue
            if dimension.scope == "global":
                evaluation_kinds = [None]
            else:
                evaluation_kinds = sorted(
                    self._known_kinds(data, dimension, now.date())
                )
            for kind in evaluation_kinds:
                key = self._slot(dimension.id, kind)
                if key in data.explicit:
                    continue
                current = self._effective(data, dimension, kind)
                if current is None:
                    continue
                belief = evaluate_belief(
                    dimension,
                    self._stage1_source,
                    current,
                    kind,
                    now.date(),
                    freshness_cutoff=data.freshness.get(key),
                    undone_values=data.undone.get(key, set()),
                )
                if belief.applied_value is None or belief.applied_value == current:
                    continue
                proposal_id = self.ids.proposal_id()
                proposals.append(
                    Proposal(
                        id=proposal_id,
                        source=Source.rule,
                        dimension=dimension.id,
                        kind=Kind(kind) if kind is not None else None,
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
        dimension = self.dimensions.get(proposal.dimension)
        if dimension is None:
            return Verdict("rejected", "unknown dimension")
        kind = self._kind(proposal.kind)
        if not self._stage1_kind(kind):
            return Verdict("rejected", "custom kinds are unavailable in Stage 1")
        proposal_evidence = proposal.evidence.model_dump(mode="json")
        revision, data = self._read()
        key = self._slot(dimension.id, kind)
        current = self._effective(data, dimension, kind)
        if current is None:
            return Verdict("rejected", "no available value")
        # Check 1: contract value, source/policy and scale adjacency.
        if proposal.to not in dimension.values:
            return Verdict("rejected", "invalid value")
        automatic = proposal.source is Source.rule
        if automatic:
            if (dimension.scope == "global") != (kind is None):
                return Verdict("rejected", "proposal scope mismatch")
            if proposal.to == current:
                return Verdict("rejected", "value is already effective")
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
                self._stage1_source,
                current,
                kind,
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
        else:
            return Verdict("rejected", "person changes use explicit settings")
        inherited_before = (
            {
                kind: self._effective(data, dimension, kind)
                for kind in self._known_kinds(data, dimension, now.date())
            }
            if dimension.scale and kind is None
            else {}
        )
        decision_id = self.ids.decision_id()
        decision_key = str(decision_id.root)
        gate = belief.gates[judged]
        decision_evidence = belief.evidence.to_dict()
        decision_evidence.update(
            occasions=gate.occasions,
            conversations=gate.conversations,
            days=gate.days,
        )
        decision = Decision(
            id=decision_id,
            proposal_id=proposal.id,
            dimension=dimension.id,
            kind=proposal.kind,
            **{"from": current},
            to=proposal.to,
            reason=proposal.reason,
            evidence=decision_evidence,
            dimension_version=dimension.version,
            status=Status.pending,
            created_at=now,
            shown_at=None,
        )
        updated = deepcopy(data)
        updated.learned[key] = proposal.to
        updated.decisions[decision_key] = decision
        updated.active[key] = decision_key
        if automatic:
            updated.pace.add(now.date())
        if dimension.scale and proposal.to != current:
            updated.freshness[key] = now.date()
            if kind is None:
                self._refresh_inherited_cutoffs(
                    updated, dimension, inherited_before, now.date()
                )
        if not self.store.commit(revision, updated):
            return Verdict("deferred", "state changed")
        return Verdict("admitted", decision=decision)

    def acknowledge(self, decision_id: str) -> None:
        revision, data = self._read()
        decision = self._decision(data, decision_id)
        if (
            decision.status is not Status.pending
            or decision_id not in data.active.values()
        ):
            return
        data.acknowledged.add(decision_id)
        data.decisions[decision_id] = decision.model_copy(
            update={"status": Status.shown, "shown_at": self._now()}
        )
        if not self.store.commit(revision, data):
            raise RuntimeError("state changed")

    def keep(self, decision_id: str) -> Verdict:
        revision, data = self._read()
        decision = self._decision(data, decision_id)
        if decision.status is Status.kept:
            return Verdict("admitted")
        if decision.status is not Status.shown or decision_id not in data.acknowledged:
            return Verdict("rejected", "decision not acknowledged or no longer active")
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
        revision, data = self._read()
        decision = self._decision(data, decision_id)
        key = self._slot(
            decision.dimension, getattr(decision.kind, "value", decision.kind)
        )
        if data.active.get(key) != decision_id:
            return Verdict("rejected", "decision is not active")
        dimension = self.dimensions.get(decision.dimension)
        if dimension is None:
            return Verdict("rejected", "unknown dimension")
        if (
            decision.from_ not in dimension.values
            or decision.to not in dimension.values
        ):
            return Verdict("rejected", "decision value is no longer valid")
        kind = self._kind(decision.kind)
        if not self._stage1_kind(kind):
            return Verdict("rejected", "custom kinds are unavailable in Stage 1")
        if data.frozen or data.locks.get(dimension.area, False):
            return Verdict("rejected", "frozen or locked")
        inherited_before = (
            {
                inherited: self._effective(data, dimension, inherited)
                for inherited in self._known_kinds(data, dimension, now.date())
            }
            if dimension.scale and kind is None
            else {}
        )
        data.explicit[key] = decision.from_
        data.undone.setdefault(key, set()).add(decision.to)
        data.decisions[decision_id] = decision.model_copy(
            update={"status": Status.undone}
        )
        data.active.pop(key, None)
        if dimension.scale and decision.from_ != decision.to:
            data.freshness[key] = now.date()
            if kind is None:
                self._refresh_inherited_cutoffs(
                    data, dimension, inherited_before, now.date()
                )
        return (
            Verdict("admitted")
            if self.store.commit(revision, data)
            else Verdict("deferred", "state changed")
        )

    def set_explicit(self, dimension: str, value, kind: str | None = None) -> Verdict:
        return self._control(dimension, kind, value)

    def return_to_automatic(self, dimension: str, kind: str | None = None) -> Verdict:
        now = self._now()
        definition = self.dimensions.get(dimension)
        if definition is None:
            return Verdict("rejected", "unknown dimension")
        kind = self._kind(kind)
        if not self._stage1_kind(kind):
            return Verdict("rejected", "custom kinds are unavailable in Stage 1")
        if definition.scope == "global" and kind is not None:
            return Verdict("rejected", "global dimension has no kind setting")
        revision, data = self._read()
        if data.frozen or data.locks.get(definition.area, False):
            return Verdict("rejected", "frozen or locked")
        key = self._slot(dimension, kind)
        old = self._effective(data, definition, kind)
        inherited_before = (
            {
                inherited: self._effective(data, definition, inherited)
                for inherited in self._known_kinds(data, definition, now.date())
            }
            if definition.scale and kind is None
            else {}
        )
        data.explicit.pop(key, None)
        effective = self._effective(data, definition, kind)
        if effective is None:
            return Verdict("rejected", "no available value")
        if definition.scale and old != effective:
            data.freshness[key] = now.date()
        if old != effective:
            data.active.pop(key, None)
        if definition.scale and kind is None:
            self._refresh_inherited_cutoffs(
                data, definition, inherited_before, now.date()
            )
        return (
            Verdict("admitted")
            if self.store.commit(revision, data)
            else Verdict("deferred", "state changed")
        )

    def _control(self, dimension: str, kind: str | None, value: str) -> Verdict:
        now = self._now()
        definition = self.dimensions.get(dimension)
        if definition is None:
            return Verdict("rejected", "unknown dimension")
        kind = self._kind(kind)
        if not self._stage1_kind(kind):
            return Verdict("rejected", "custom kinds are unavailable in Stage 1")
        if definition.scope == "global" and kind is not None:
            return Verdict("rejected", "global dimension has no kind setting")
        if value not in definition.values:
            return Verdict("rejected", "invalid value")
        revision, data = self._read()
        if data.frozen or data.locks.get(definition.area, False):
            return Verdict("rejected", "frozen or locked")
        key = self._slot(dimension, kind)
        old = self._effective(data, definition, kind)
        inherited_before = (
            {
                inherited: self._effective(data, definition, inherited)
                for inherited in self._known_kinds(data, definition, now.date())
            }
            if definition.scale and kind is None
            else {}
        )
        data.explicit[key] = value
        data.active.pop(key, None)
        if definition.scale and old != value:
            data.freshness[key] = now.date()
        if definition.scale and kind is None:
            self._refresh_inherited_cutoffs(
                data, definition, inherited_before, now.date()
            )
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
        revision, data = self._read()
        data.locks[area] = locked
        if not self.store.commit(revision, data):
            raise RuntimeError("state changed")

    def freeze(self, frozen: bool) -> None:
        if not isinstance(frozen, bool):
            raise ValueError("frozen must be a boolean")
        revision, data = self._read()
        data.frozen = frozen
        if not self.store.commit(revision, data):
            raise RuntimeError("state changed")

    def freshness_cutoff(self, kind: str | None, dimension: str) -> date | None:
        _, data = self._read()
        return data.freshness.get(self._slot(dimension, kind))

    def undone_values(self, kind: str | None, dimension: str) -> set[str]:
        _, data = self._read()
        return set(data.undone.get(self._slot(dimension, kind), set()))

    @staticmethod
    def _decision(data: StateData, decision_id: str) -> Decision:
        try:
            return data.decisions[decision_id]
        except KeyError as exc:
            raise ValueError(f"unknown decision: {decision_id}") from exc
