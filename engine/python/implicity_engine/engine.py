from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Callable, Protocol, Sequence
from uuid import NAMESPACE_URL, uuid5

from implicity_contracts.generated import (
    ChangePolicy,
    Decision,
    Proposal,
    SessionSummary,
    Status,
)


@dataclass(frozen=True)
class DailyCount:
    day: date
    kind: str
    happened: int
    could_have: int
    conversations: int
    session_id: str
    conversation_ids: tuple[str, ...] = ()


class EventSource(Protocol):
    def daily_counts(
        self, feature: str, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[DailyCount]: ...
    def session_summaries(
        self, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[SessionSummary]: ...


@dataclass
class FakeEventSource:
    counts: dict[str, list[DailyCount]] = field(default_factory=dict)
    summaries: list[SessionSummary] = field(default_factory=list)

    def daily_counts(
        self, feature: str, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[DailyCount]:
        return [
            row
            for row in self.counts.get(feature, [])
            if start <= row.day <= end and row.session_id not in exclude_sessions
        ]

    def session_summaries(
        self, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[SessionSummary]:
        return [
            row
            for row in self.summaries
            if start <= row.timestamp.date() <= end
            and str(row.session_id) not in exclude_sessions
        ]


@dataclass(frozen=True)
class Verdict:
    status: str
    reason: str
    decision: Decision | None = None


def load_dimensions(directory: str | Path) -> dict[str, dict]:
    dimensions = {}
    for path in sorted(Path(directory).glob("*.json")):
        dimension = json.loads(path.read_text())
        if (
            dimension["id"] in dimensions
            or dimension["default"] not in dimension["values"]
            or dimension["change_policy"] not in {"automatic", "proposed"}
        ):
            raise ValueError(f"invalid dimension: {path}")
        dimensions[dimension["id"]] = dimension
    return dimensions


class Engine:
    def __init__(
        self,
        dimensions: dict[str, dict],
        source: EventSource,
        clock: Callable[[], datetime],
    ):
        self.dimensions, self.source, self.clock = dimensions, source, clock
        self._state = {key: item["default"] for key, item in dimensions.items()}
        self._explicit: set[str] = set()
        self._undone: set[str] = set()
        self._excluded: set[str] = set()
        self._locks: set[str] = set()
        self._frozen = False
        self._decisions: dict[str, Decision] = {}
        self._pending: dict[str, Proposal] = {}
        self._automatic_day: date | None = None
        self._proposal_session: date | None = None

    def state(self, kind: str | None = None) -> dict[str, str]:
        return dict(self._state)

    def evaluate(self) -> list[Proposal]:
        proposals = []
        today = self.clock().date()
        for identifier, dimension in sorted(self.dimensions.items()):
            if (
                dimension["change_policy"] != "automatic"
                or identifier in self._explicit
                or identifier in self._undone
            ):
                continue
            evidence = self._belief(dimension, today)
            if evidence is None:
                continue
            target, snapshot = evidence
            proposals.append(
                Proposal(
                    id=f"prop_{uuid5(NAMESPACE_URL, f'{identifier}:{today}:{target}')}",
                    source="rule",
                    dimension=identifier,
                    kind=None,
                    to=target,
                    reason=f"Evidence supports {target}.",
                    evidence=snapshot,
                    payload={},
                    change_policy=ChangePolicy.automatic,
                    type="dimension",
                )
            )
        return proposals

    def _belief(self, dimension: dict, today: date):
        window = dimension["window_days"]
        values = {}
        for value, features in dimension["evidence"].items():
            totals = [0.0, 0.0]
            for side, feature in enumerate((features["for"], features["against"])):
                rows = self.source.daily_counts(
                    feature, today - timedelta(days=window - 1), today, self._excluded
                )
                for row in rows:
                    weight = 0.5 ** (
                        (today - row.day).days / dimension["half_life_days"]
                    )
                    totals[side] += (
                        row.happened if side == 0 else row.could_have - row.happened
                    ) * weight
            values[value] = totals
        candidate = max(values, key=lambda v: values[v][0] - values[v][1])
        for_total, against_total = values[candidate]
        rows = [
            self.source.daily_counts(
                feature, today - timedelta(days=window - 1), today, self._excluded
            )
            for pair in dimension["evidence"].values()
            for feature in pair.values()
        ]
        flat = [row for group in rows for row in group]
        occasions = sum(row.could_have for row in flat)
        conversations = sum(row.conversations for row in flat)
        days = len({row.day for row in flat})
        gate = dimension["gate"]
        if (
            occasions < gate["occasions"]
            or conversations < gate["conversations"]
            or days < gate["days"]
            or for_total + against_total == 0
        ):
            return None
        if (
            for_total / (for_total + against_total) < gate["lead"]["for"]
            or against_total / (for_total + against_total) > gate["lead"]["against"]
        ):
            return None
        features = [
            {
                "feature": feature,
                "happened": row.happened,
                "could_have": row.could_have,
                "day": row.day.isoformat(),
                "kind": row.kind,
                "weight": round(
                    0.5 ** ((today - row.day).days / dimension["half_life_days"]), 6
                ),
            }
            for feature in dimension["evidence"][candidate].values()
            for row in self.source.daily_counts(
                feature, today - timedelta(days=window - 1), today, self._excluded
            )
        ]
        return candidate, {
            "features": features,
            "occasions": occasions,
            "conversations": conversations,
            "days": days,
        }

    def submit(self, proposal: Proposal) -> Verdict:
        dimension = self.dimensions.get(proposal.dimension)
        if dimension is None or proposal.to not in dimension["values"]:
            return Verdict("rejected", "target is not a dimension value")
        if self._frozen or dimension["area"] in self._locks:
            return Verdict("rejected", "adaptation is locked")
        if proposal.dimension in self._explicit or proposal.dimension in self._undone:
            return Verdict("rejected", "dimension is explicit or permanently undone")
        if (
            proposal.change_policy == ChangePolicy.proposed
            or dimension["change_policy"] == "proposed"
        ):
            self._pending[proposal.id.root] = proposal
            return Verdict("deferred", "person must keep this proposal")
        today = self.clock().date()
        if self._automatic_day == today:
            return Verdict("deferred", "daily automatic pace limit reached")
        belief = self._belief(dimension, today)
        if belief is None or belief[0] != proposal.to:
            return Verdict("deferred", "evidence gate is not met")
        if self._state[proposal.dimension] == proposal.to:
            return Verdict("rejected", "dimension already has this value")
        return self._admit(proposal, dimension)

    def _admit(self, proposal: Proposal, dimension: dict) -> Verdict:
        now = self.clock()
        identifier = (
            f"dec_{uuid5(NAMESPACE_URL, str(proposal.id.root) + now.isoformat())}"
        )
        snapshot = self._belief(dimension, now.date())
        evidence = (
            snapshot[1] if snapshot else proposal.evidence.model_dump(exclude_none=True)
        )
        decision = Decision(
            id=identifier,
            proposal_id=proposal.id,
            dimension=proposal.dimension,
            kind=proposal.kind,
            **{"from": self._state[proposal.dimension]},
            to=proposal.to,
            reason=proposal.reason,
            evidence=evidence,
            dimension_version=dimension["version"],
            status=Status.pending,
            created_at=now,
            shown_at=None,
        )
        self._state[proposal.dimension] = proposal.to
        self._decisions[identifier] = decision
        if proposal.change_policy == ChangePolicy.automatic:
            self._automatic_day = now.date()
        return Verdict("admitted", "proposal admitted", decision)

    def keep(self, proposal_id: str) -> Verdict:
        proposal = self._pending.pop(proposal_id, None)
        if proposal is None:
            return Verdict("rejected", "proposal is no longer available")
        dimension = self.dimensions.get(proposal.dimension)
        if dimension is None or proposal.to not in dimension["values"]:
            return Verdict("rejected", "target is not a dimension value")
        if self._frozen or dimension["area"] in self._locks:
            return Verdict("rejected", "adaptation is locked")
        if proposal.dimension in self._explicit or proposal.dimension in self._undone:
            return Verdict("rejected", "dimension is explicit or permanently undone")
        if self._proposal_session == self.clock().date():
            return Verdict("deferred", "per-session proposal pace limit reached")
        self._proposal_session = self.clock().date()
        return self._admit(proposal, dimension)

    def undo(self, decision_id: str) -> None:
        decision = self._decisions[decision_id]
        self._state[decision.dimension] = decision.from_
        self._explicit.add(decision.dimension)
        self._undone.add(decision.dimension)
        decision.status = Status.undone

    def set_explicit(self, dimension: str, value: str, kind: str | None = None) -> None:
        if value not in self.dimensions[dimension]["values"]:
            raise ValueError("value is not a dimension value")
        self._state[dimension] = value
        self._explicit.add(dimension)

    def return_to_automatic(self, dimension: str, kind: str | None = None) -> None:
        self._explicit.discard(dimension)
        self._undone.discard(dimension)

    def set_lock(self, area: str, locked: bool) -> None:
        (self._locks.add if locked else self._locks.discard)(area)

    def freeze(self, frozen: bool) -> None:
        self._frozen = frozen

    def exclude_session(self, session_id: str) -> list[Decision]:
        self._excluded.add(session_id)
        reverted = []
        for decision in self._decisions.values():
            if decision.status not in {Status.pending, Status.shown, Status.kept}:
                continue
            dimension = self.dimensions[decision.dimension]
            if self._belief(dimension, self.clock().date()) is None:
                self._state[decision.dimension] = decision.from_
                decision.status = Status.reverted
                reverted.append(decision)
        return reverted
