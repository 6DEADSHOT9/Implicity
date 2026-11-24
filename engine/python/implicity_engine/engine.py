from __future__ import annotations

import ast
import json
import math
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Protocol, Sequence
from uuid import NAMESPACE_URL, uuid5

from implicity_contracts.generated import (
    ChangePolicy,
    Decision,
    EvidenceFeature,
    Kind,
    Proposal,
    SessionSummary,
    Source,
    Status,
    Type1,
)


@dataclass(frozen=True)
class DailyCount:
    """Daily feature aggregate; IDs let gates deduplicate conversations across days."""

    day: date
    kind: str
    happened: int
    could_have: int
    conversations: int
    conversation_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class SessionDailyCount:
    day: date
    kind: str
    happened: int
    could_have: int
    conversation_ids: tuple[str, ...]
    session_id: str


class EventSource(Protocol):
    def daily_counts(
        self, feature: str, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[DailyCount]: ...

    def session_summaries(
        self, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[SessionSummary]: ...


class Store(Protocol):
    values: dict[tuple[str, str | None], str]
    explicit: set[tuple[str, str | None]]
    undone: set[tuple[str, str | None]]
    excluded_sessions: set[str]
    locks: set[str]
    frozen: bool
    decisions: dict[str, Decision]
    decision_meta: dict[str, dict]
    proposals: dict[str, dict]
    automatic_dates: set[date]
    proposal_sessions: dict[str, str]
    last_change_day: dict[tuple[str, str | None], date]

    def mint_id(self, prefix: str, identity: str) -> str: ...


@dataclass
class FakeEventSource:
    counts: dict[str, list[DailyCount | SessionDailyCount]] = field(
        default_factory=dict
    )
    summaries: list[SessionSummary] = field(default_factory=list)

    def daily_counts(
        self, feature: str, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[DailyCount]:
        grouped: dict[tuple[date, str], list[DailyCount | SessionDailyCount]] = {}
        for row in self.counts.get(feature, []):
            if not start <= row.day <= end:
                continue
            if (
                isinstance(row, SessionDailyCount)
                and row.session_id in exclude_sessions
            ):
                continue
            grouped.setdefault((row.day, row.kind), []).append(row)
        return [
            DailyCount(
                day,
                kind,
                sum(row.happened for row in rows),
                sum(row.could_have for row in rows),
                len(
                    {
                        conversation
                        for row in rows
                        for conversation in row.conversation_ids
                    }
                )
                or max(
                    row.conversations
                    if isinstance(row, DailyCount)
                    else len(row.conversation_ids)
                    for row in rows
                ),
                tuple(
                    sorted(
                        {
                            conversation
                            for row in rows
                            for conversation in row.conversation_ids
                        }
                    )
                ),
            )
            for (day, kind), rows in sorted(grouped.items())
        ]

    def session_summaries(
        self, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[SessionSummary]:
        return [
            row
            for row in self.summaries
            if start <= row.timestamp.astimezone(timezone.utc).date() <= end
            and str(row.session_id) not in exclude_sessions
        ]


@dataclass
class MemoryStore:
    """Replaceable store for tests; beliefs are deliberately absent."""

    values: dict[tuple[str, str | None], str] = field(default_factory=dict)
    explicit: set[tuple[str, str | None]] = field(default_factory=set)
    undone: set[tuple[str, str | None]] = field(default_factory=set)
    excluded_sessions: set[str] = field(default_factory=set)
    locks: set[str] = field(default_factory=set)
    frozen: bool = False
    decisions: dict[str, Decision] = field(default_factory=dict)
    decision_meta: dict[str, dict] = field(default_factory=dict)
    proposals: dict[str, dict] = field(default_factory=dict)
    automatic_dates: set[date] = field(default_factory=set)
    proposal_sessions: dict[str, str] = field(default_factory=dict)
    last_change_day: dict[tuple[str, str | None], date] = field(default_factory=dict)

    def mint_id(self, prefix: str, identity: str) -> str:
        return f"{prefix}_{uuid5(NAMESPACE_URL, f'{prefix}:{identity}')}"


@dataclass(frozen=True)
class Verdict:
    status: str
    reason: str
    decision: Decision | None = None


def load_dimensions(directory: str | Path) -> dict[str, dict]:
    """Load and validate JSON dimension files from a data directory."""
    dimensions = {}
    for path in sorted(Path(directory).glob("*.json")):
        dimension = json.loads(path.read_text())
        values = dimension.get("values", [])
        evidence = dimension.get("evidence", {})
        if (
            not dimension.get("id")
            or dimension["id"] in dimensions
            or not values
            or len(set(values)) != len(values)
            or dimension.get("default") not in values
            or dimension.get("change_policy") not in {"automatic", "proposed"}
            or dimension.get("scope") not in {"global", "kind"}
            or dimension.get("area")
            not in {"look", "layout", "answer_style", "home", "workflow"}
            or set(evidence) != set(values)
            or not dimension.get("window_days", 0) > 0
            or not dimension.get("half_life_days", 0) > 0
        ):
            raise ValueError(f"invalid dimension: {path}")
        for pair in evidence.values():
            if set(pair) != {"for", "against"}:
                raise ValueError(f"invalid dimension evidence: {path}")
        dimensions[dimension["id"]] = dimension
    return dimensions


FORBIDDEN_IMPORT_ROOTS = {"api", "web", "app", "chat", "memory", "hermes"}


def forbidden_engine_imports(directory: str | Path) -> list[tuple[Path, str]]:
    findings = []
    for path in Path(directory).rglob("*.py"):
        tree = ast.parse(path.read_text())
        names = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                names.append(node.module)
                names.extend(f"{node.module}.{alias.name}" for alias in node.names)
                names.extend(alias.name for alias in node.names)
        for name in names:
            components = {part.lower() for part in name.split(".")}
            if components & FORBIDDEN_IMPORT_ROOTS:
                findings.append((path, name))
    return findings


class Engine:
    def __init__(
        self,
        dimensions: dict[str, dict],
        source: EventSource,
        store: Store,
        clock: Callable[[], datetime],
        state_validator: Callable[[str, str, str | None], bool] | None = None,
    ):
        self.dimensions = dimensions
        self.source = source
        self.store = store
        self.clock = clock
        self.state_validator = state_validator or (
            lambda _dimension, _value, _kind: True
        )

    def _today(self) -> date:
        now = self.clock()
        if now.tzinfo is None:
            raise ValueError("clock must return an aware datetime")
        return now.astimezone(timezone.utc).date()

    def _key(self, dimension: str, kind: str | None) -> tuple[str, str | None]:
        spec = self.dimensions[dimension]
        return (
            dimension,
            getattr(kind, "value", kind) if spec["scope"] == "kind" else None,
        )

    def _value(self, dimension: str, kind: str | None) -> str:
        key = self._key(dimension, kind)
        return self.store.values.get(
            key,
            self.store.values.get(
                (dimension, None), self.dimensions[dimension]["default"]
            ),
        )

    def _is_explicit_or_undone(self, key: tuple[str, str | None]) -> bool:
        dimension, kind = key
        uses_global_fallback = kind is not None and key not in self.store.values
        keys = {key, (dimension, None)} if uses_global_fallback else {key}
        return bool(keys & (self.store.explicit | self.store.undone))

    def _apply_transition(
        self,
        dimension: str,
        value: str,
        kind: str | None,
        *,
        respect_controls: bool,
    ) -> bool:
        spec = self.dimensions[dimension]
        if value not in spec["values"]:
            return False
        if respect_controls and (self.store.frozen or spec["area"] in self.store.locks):
            return False
        if not self.state_validator(dimension, value, kind):
            return False
        self.store.values[self._key(dimension, kind)] = value
        return True

    def state(self, kind: str | None = None) -> dict[str, str]:
        return {name: self._value(name, kind) for name in self.dimensions}

    def evaluate(
        self, session_id: str | None = None, session_boundary: bool = True
    ) -> list[Proposal]:
        if not session_boundary:
            # Rule proposals are only evaluated at the host's declared boundary.
            return []
        today = self._today()
        proposals = []
        existing_offer_id = (
            self.store.proposal_sessions.get(session_id) if session_id else None
        )
        if existing_offer_id and existing_offer_id in self.store.proposals:
            proposals.append(
                Proposal.model_validate_json(
                    json.dumps(deepcopy(self.store.proposals[existing_offer_id]))
                )
            )
        for identifier, dimension in sorted(self.dimensions.items()):
            kinds = self._kinds(dimension, today)
            if dimension["scope"] == "global":
                kinds = [None]
            for kind in kinds:
                key = self._key(identifier, kind)
                if self._is_explicit_or_undone(key):
                    continue
                belief = self._belief(identifier, dimension, kind, today)
                if belief is None or belief[0] == self._value(identifier, kind):
                    continue
                target, evidence = belief
                policy = ChangePolicy(dimension["change_policy"])
                if policy == ChangePolicy.proposed and (
                    not session_id or existing_offer_id
                ):
                    continue
                identity = json.dumps(
                    [
                        identifier,
                        kind,
                        target,
                        evidence,
                        session_id if policy == ChangePolicy.proposed else None,
                    ],
                    sort_keys=True,
                    separators=(",", ":"),
                    default=str,
                )
                proposal_id = self.store.mint_id("prop", identity)
                proposal = Proposal(
                    id=proposal_id,
                    source=Source.rule,
                    dimension=identifier,
                    kind=Kind[kind] if kind in Kind.__members__ else kind,
                    to=target,
                    reason=f"Evidence supports {target}.",
                    evidence=evidence,
                    payload={},
                    change_policy=policy,
                    type=Type1.dimension,
                )
                proposals.append(proposal)
                if policy == ChangePolicy.proposed:
                    self._save_offer(proposal)
                    self.store.proposal_sessions[session_id] = proposal.id.root
                    existing_offer_id = proposal.id.root
        return proposals

    def _kinds(self, dimension: dict, today: date) -> list[str]:
        start = today - timedelta(days=dimension["window_days"] - 1)
        kinds = {
            row.kind
            for pair in dimension["evidence"].values()
            for feature in set(pair.values())
            for row in self.source.daily_counts(
                feature, start, today, self.store.excluded_sessions
            )
            if row.could_have > 0
        }
        return sorted(kinds)

    def _belief(
        self,
        identifier: str,
        dimension: dict,
        kind: str | None,
        today: date,
        fresh_only: bool = True,
    ):
        key = self._key(identifier, kind)
        window_start = today - timedelta(days=dimension["window_days"] - 1)
        if fresh_only and dimension.get("scale"):
            last_change = self.store.last_change_day.get(key)
            if last_change:
                window_start = max(window_start, last_change + timedelta(days=1))
        by_feature: dict[str, list[DailyCount]] = {}
        for pair in dimension["evidence"].values():
            for feature in set(pair.values()):
                feature_rows = self.source.daily_counts(
                    feature, window_start, today, self.store.excluded_sessions
                )
                by_feature[feature] = (
                    sorted(
                        (
                            row
                            for row in feature_rows
                            if row.kind == getattr(kind, "value", kind)
                        ),
                        key=lambda row: (row.day, row.kind),
                    )
                    if kind is not None
                    else sorted(feature_rows, key=lambda row: (row.day, row.kind))
                )
        rows = [row for feature_rows in by_feature.values() for row in feature_rows]
        occasions_by_period: dict[tuple[date, str], int] = {}
        conv_ids = set()
        for row in rows:
            period = (row.day, row.kind)
            occasions_by_period[period] = max(
                occasions_by_period.get(period, 0), row.could_have
            )
            conv_ids.update(row.conversation_ids)
        conversations_without_ids = sum(
            max(
                (
                    row.conversations
                    for row in rows
                    if (row.day, row.kind) == period and not row.conversation_ids
                ),
                default=0,
            )
            for period in occasions_by_period
        )
        occasions = sum(occasions_by_period.values())
        conversations = len(conv_ids) + conversations_without_ids
        days = len(
            {day for (day, _kind), count in occasions_by_period.items() if count > 0}
        )
        if occasions == 0:
            return None
        weighted_opportunities = sum(
            count * self._weight(today, day, dimension)
            for (day, _kind), count in occasions_by_period.items()
        )
        gate = dimension["gate"]
        if (
            occasions < gate["occasions"]
            or conversations < gate["conversations"]
            or days < gate["days"]
        ):
            return None
        totals = {}
        for value, pair in dimension["evidence"].items():
            support = sum(
                row.happened * self._weight(today, row.day, dimension)
                for row in by_feature[pair["for"]]
            )
            opposition = sum(
                row.happened * self._weight(today, row.day, dimension)
                for row in by_feature[pair["against"]]
            )
            totals[value] = (support, opposition)
        ranked = sorted(
            totals, key=lambda value: totals[value][0] - totals[value][1], reverse=True
        )
        evidence_target = ranked[0]
        target = evidence_target
        current = self._value(identifier, kind)
        if dimension.get("scale"):
            target = self._next_value(dimension["values"], current, target)
        support, opposition = totals[evidence_target]
        if (
            support / weighted_opportunities < gate["lead"]["for"]
            or opposition / weighted_opportunities > gate["lead"]["against"]
        ):
            return None
        features = []
        for feature in (
            dimension["evidence"][evidence_target]["for"],
            dimension["evidence"][evidence_target]["against"],
        ):
            for row in by_feature[feature]:
                features.append(
                    {
                        "feature": feature,
                        "day": row.day,
                        "kind": Kind[row.kind]
                        if row.kind in Kind.__members__
                        else row.kind,
                        "happened": row.happened,
                        "could_have": row.could_have,
                        "weight": round(self._weight(today, row.day, dimension), 6),
                    }
                )
        features.sort(key=lambda item: (item["feature"], item["day"], item["kind"]))
        return target, {
            "features": features,
            "occasions": occasions,
            "conversations": conversations,
            "days": days,
        }

    @staticmethod
    def _next_value(values: list[str], current: str, target: str) -> str:
        start, end = values.index(current), values.index(target)
        return values[start + (1 if end > start else -1)] if start != end else current

    @staticmethod
    def _weight(today: date, day: date, dimension: dict) -> float:
        return 0.5 ** ((today - day).days / dimension["half_life_days"])

    def _save_offer(self, proposal: Proposal) -> None:
        self.store.proposals.setdefault(
            proposal.id.root, proposal.model_dump(mode="json", by_alias=True)
        )

    def submit(
        self,
        proposal: Proposal,
        session_id: str | None = None,
        session_boundary: bool = True,
    ) -> Verdict:
        try:
            proposal = Proposal.model_validate_json(
                proposal.model_dump_json(by_alias=True)
            )
        except Exception as exc:
            return Verdict("rejected", f"invalid proposal: {exc}")
        dimension = self.dimensions.get(proposal.dimension)
        if dimension is None or proposal.to not in dimension["values"]:
            return Verdict("rejected", "target is not a dimension value")
        if not self._valid_evidence(
            proposal.evidence.model_dump(mode="json", exclude_none=True)
        ):
            return Verdict("rejected", "invalid evidence feature entry")
        kind = proposal.kind
        key = self._key(proposal.dimension, kind)
        if not self.state_validator(proposal.dimension, proposal.to, kind):
            return Verdict("rejected", "resulting state is invalid")
        if self.store.frozen or dimension["area"] in self.store.locks:
            return Verdict("rejected", "adaptation is locked")
        if self._is_explicit_or_undone(key):
            return Verdict("rejected", "dimension is explicit or permanently undone")
        if (
            proposal.source == Source.hermes
            or proposal.change_policy == ChangePolicy.proposed
            or dimension["change_policy"] == "proposed"
        ):
            if any(
                decision.proposal_id.root == proposal.id.root
                for decision in self.store.decisions.values()
            ):
                return Verdict("rejected", "proposal already has a decision")
            if not session_id:
                return Verdict(
                    "deferred", "session identity is required for a proposal"
                )
            existing_offer_id = self.store.proposal_sessions.get(session_id)
            if existing_offer_id and existing_offer_id != proposal.id.root:
                return Verdict("deferred", "per-session proposal pace limit reached")
            if (
                existing_offer_id == proposal.id.root
                and proposal.id.root not in self.store.proposals
            ):
                return Verdict("rejected", "proposal was already dismissed")
            self.store.proposal_sessions.setdefault(session_id, proposal.id.root)
            self._save_offer(proposal)
            return Verdict("deferred", "person must keep this proposal")
        return self._admit(
            proposal, dimension, key, session_id, session_boundary, requires_gate=True
        )

    @staticmethod
    def _valid_evidence(evidence: dict) -> bool:
        entries = evidence.get("features", []) or []
        try:
            for entry in entries:
                feature = EvidenceFeature.model_validate_json(
                    json.dumps(entry, default=str)
                )
                if feature.happened > feature.could_have or not math.isfinite(
                    feature.weight
                ):
                    return False
            return True
        except Exception:
            return False

    def _admit(
        self,
        proposal: Proposal,
        dimension: dict,
        key: tuple[str, str | None],
        session_id: str | None,
        session_boundary: bool,
        requires_gate: bool,
    ) -> Verdict:
        if not self.state_validator(proposal.dimension, proposal.to, proposal.kind):
            return Verdict("rejected", "resulting state is invalid")
        if self.store.frozen or dimension["area"] in self.store.locks:
            return Verdict("rejected", "adaptation is locked")
        if self._is_explicit_or_undone(key):
            return Verdict("rejected", "dimension is explicit or permanently undone")
        today = self._today()
        if requires_gate:
            belief = self._belief(proposal.dimension, dimension, proposal.kind, today)
            if belief is None or belief[0] != proposal.to:
                return Verdict("deferred", "evidence gate is not met")
            # The snapshot that passed the gate is the one recorded in the Decision.
            proposal.evidence = type(proposal.evidence).model_validate(belief[1])
        current = self._value(proposal.dimension, proposal.kind)
        if current == proposal.to:
            return Verdict("rejected", "dimension already has this value")
        if (
            dimension.get("scale")
            and self._next_value(dimension["values"], current, proposal.to)
            != proposal.to
        ):
            return Verdict("rejected", "scale changes move one value at a time")
        if requires_gate and today in self.store.automatic_dates:
            return Verdict("deferred", "daily automatic pace limit reached")
        if not session_boundary:
            return Verdict("deferred", "change is not at a session boundary")
        if requires_gate and not self._valid_evidence(
            proposal.evidence.model_dump(mode="json", exclude_none=True)
        ):
            return Verdict("rejected", "invalid evidence feature entry")
        identity = (
            f"{proposal.id.root}:{self.clock().astimezone(timezone.utc).isoformat()}"
        )
        decision_id = self.store.mint_id("dec", identity)
        decision = Decision(
            id=decision_id,
            proposal_id=proposal.id,
            dimension=proposal.dimension,
            kind=proposal.kind,
            **{"from": current},
            to=proposal.to,
            reason=proposal.reason,
            evidence=proposal.evidence.model_dump(mode="json", exclude_none=True),
            dimension_version=dimension["version"],
            status=Status.pending,
            created_at=self.clock().astimezone(timezone.utc),
            shown_at=None,
        )
        if not self._apply_transition(
            proposal.dimension, proposal.to, proposal.kind, respect_controls=True
        ):
            return Verdict("rejected", "resulting state is invalid or locked")
        self.store.decisions[decision_id] = deepcopy(decision)
        self.store.decision_meta[decision_id] = {
            "key": key,
            "requires_gate": requires_gate,
            "change_policy": proposal.change_policy.value,
            "from": current,
            "to": proposal.to,
            "sequence": len(self.store.decision_meta),
        }
        self.store.last_change_day[key] = today
        if requires_gate:
            self.store.automatic_dates.add(today)
        else:
            self.store.proposals.pop(proposal.id.root, None)
        return Verdict("admitted", "proposal admitted", deepcopy(decision))

    def keep_proposal(
        self, proposal_id: str, session_id: str, session_boundary: bool = True
    ) -> Verdict:
        raw = self.store.proposals.get(proposal_id)
        if raw is None:
            return Verdict("rejected", "proposal is no longer available")
        if proposal_id not in self.store.proposal_sessions.values():
            return Verdict("rejected", "proposal is no longer available")
        try:
            proposal = Proposal.model_validate_json(json.dumps(deepcopy(raw)))
        except Exception as exc:
            return Verdict("rejected", f"invalid stored proposal: {exc}")
        dimension = self.dimensions.get(proposal.dimension)
        if dimension is None or proposal.to not in dimension["values"]:
            return Verdict("rejected", "target is not a dimension value")
        if not self._valid_evidence(
            proposal.evidence.model_dump(mode="json", exclude_none=True)
        ):
            return Verdict("rejected", "invalid evidence feature entry")
        key = self._key(proposal.dimension, proposal.kind)
        # Keep accepts this exact stored offer; it does not recompute evidence.
        return self._admit(
            proposal, dimension, key, session_id, session_boundary, requires_gate=False
        )

    def pending_notices(self) -> list[Decision]:
        return [
            deepcopy(decision)
            for decision in self.store.decisions.values()
            if decision.status in {Status.pending, Status.shown}
        ]

    def pending_proposals(self) -> list[Proposal]:
        return [
            Proposal.model_validate_json(json.dumps(deepcopy(raw)))
            for raw in self.store.proposals.values()
        ]

    def dismiss_proposal(self, proposal_id: str) -> None:
        self.store.proposals.pop(proposal_id, None)

    def acknowledge(self, decision_id: str) -> None:
        decision = self.store.decisions[decision_id]
        if decision.status == Status.pending:
            decision.status = Status.shown
            decision.shown_at = self.clock().astimezone(timezone.utc)

    def keep(self, decision_id: str) -> None:
        decision = self.store.decisions[decision_id]
        if decision.status in {Status.pending, Status.shown}:
            decision.status = Status.kept

    def undo(self, decision_id: str) -> None:
        decision = self.store.decisions[decision_id]
        if decision.status == Status.undone:
            return
        meta = self.store.decision_meta[decision_id]
        key = tuple(meta["key"])
        if decision.status not in {Status.pending, Status.shown, Status.kept}:
            return
        inverse = meta["from"]
        if inverse not in self.dimensions[decision.dimension]["values"]:
            raise ValueError("decision inverse is not a dimension value")
        if self._value(decision.dimension, decision.kind) != decision.to:
            return
        if key in self.store.explicit:
            return
        if self.store.values.get(key, inverse) != meta["to"]:
            return
        if (
            self.store.frozen
            or self.dimensions[decision.dimension]["area"] in self.store.locks
        ):
            return
        if not self._apply_transition(
            decision.dimension,
            inverse,
            decision.kind,
            respect_controls=False,
        ):
            raise ValueError("decision inverse is not a valid resulting state")
        self.store.explicit.add(key)
        self.store.undone.add(key)
        decision.status = Status.undone

    def set_explicit(self, dimension: str, value: str, kind: str | None = None) -> None:
        if value not in self.dimensions[dimension]["values"]:
            raise ValueError("value is not a dimension value")
        key = self._key(dimension, kind)
        if not self._apply_transition(dimension, value, kind, respect_controls=False):
            raise ValueError("value is not a valid resulting state")
        self.store.explicit.add(key)
        self.store.undone.discard(key)

    def return_to_automatic(self, dimension: str, kind: str | None = None) -> None:
        key = self._key(dimension, kind)
        self.store.explicit.discard(key)
        self.store.undone.discard(key)

    def set_lock(self, area: str, locked: bool) -> None:
        (self.store.locks.add if locked else self.store.locks.discard)(area)

    def freeze(self, frozen: bool) -> None:
        self.store.frozen = frozen

    def exclude_session(self, session_id: str) -> list[Decision]:
        self.store.excluded_sessions.add(session_id)
        reverted = []
        for decision_id, decision in sorted(
            self.store.decisions.items(),
            key=lambda item: self.store.decision_meta[item[0]]["sequence"],
            reverse=True,
        ):
            meta = self.store.decision_meta[decision_id]
            if not meta["requires_gate"] or decision.status not in {
                Status.pending,
                Status.shown,
                Status.kept,
            }:
                continue
            key = tuple(meta["key"])
            if (
                self._is_explicit_or_undone(key)
                or self.store.frozen
                or self.dimensions[decision.dimension]["area"] in self.store.locks
            ):
                continue
            if self.store.values.get(key) != decision.to:
                continue
            latest = max(
                (
                    self.store.decision_meta[row_id]["sequence"]
                    for row_id, row in self.store.decisions.items()
                    if tuple(self.store.decision_meta[row_id]["key"]) == key
                    and row.status in {Status.pending, Status.shown, Status.kept}
                ),
                default=meta["sequence"],
            )
            if latest != meta["sequence"]:
                continue
            belief = self._belief(
                decision.dimension,
                self.dimensions[decision.dimension],
                decision.kind,
                self._today(),
                fresh_only=False,
            )
            if belief is not None and belief[0] == decision.to:
                continue
            inverse = meta["from"]
            if not self._apply_transition(
                decision.dimension,
                inverse,
                decision.kind,
                respect_controls=True,
            ):
                continue
            self.store.last_change_day[key] = self._today()
            decision.status = Status.reverted
            reverted.append(deepcopy(decision))
        return reverted
