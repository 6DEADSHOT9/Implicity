from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Protocol, Sequence

import yaml


@dataclass(frozen=True)
class Feature:
    id: str
    happened: dict | None
    could_have: dict


@dataclass(frozen=True)
class Dimension:
    id: str
    version: int
    area: str
    values: tuple[str, ...]
    default: str
    scope: str
    change_policy: str
    occasion: str
    evidence: dict[str, dict[str, str]]
    gate: Gate
    window_days: int
    half_life_days: float
    scale: bool = False


@dataclass(frozen=True)
class DailyCount:
    day: date
    kind: str
    happened: float
    could_have: float
    conversation_ids: frozenset[str]
    session_id: str | None = None


@dataclass(frozen=True)
class SessionSummary:
    day: date
    kind: str
    session_id: str
    values: dict


class EventSource(Protocol):
    def daily_counts(
        self, feature: str, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[DailyCount]: ...

    def session_summaries(
        self, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[SessionSummary]: ...


class FakeEventSource:
    def __init__(
        self, counts: dict[str, list[DailyCount]], summaries: list[SessionSummary]
    ):
        self.counts = counts
        self.summaries = summaries

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
            if start <= row.day <= end and row.session_id not in exclude_sessions
        ]


def _load(path: str | Path) -> dict:
    try:
        data = yaml.safe_load(Path(path).read_text())
    except (OSError, yaml.YAMLError) as exc:
        raise ValueError(f"could not load YAML: {path}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"expected a YAML mapping: {path}")
    return data


def load_feature(path: str | Path) -> Feature:
    data = _load(path)
    if not isinstance(data.get("id"), str) or not isinstance(
        data.get("could_have"), dict
    ):
        raise ValueError("feature requires id and could_have")
    happened = data.get("happened")
    if happened is not None and not isinstance(happened, dict):
        raise ValueError("feature happened must be a mapping")
    return Feature(data["id"], happened, data["could_have"])


@dataclass(frozen=True)
class GateResult:
    met: bool
    occasions: float
    conversations: int
    days: int
    for_rate: float | None
    against_rate: float | None


@dataclass(frozen=True)
class Gate:
    occasions: float
    conversations: int
    days: int
    lead_for: float
    lead_against: float

    def check(
        self,
        value: str,
        current: str,
        kind: str,
        evaluation_day: date,
        window_days: int,
        half_life_days: float,
        occasion: str,
        evidence: dict[str, list[DailyCount]],
        value_evidence: dict[str, dict[str, str]] | None = None,
    ) -> GateResult:
        start = date.fromordinal(evaluation_day.toordinal() - window_days + 1)
        rows = [
            r
            for r in evidence.get(occasion, [])
            if r.kind == kind and start <= r.day <= evaluation_day
        ]
        occasions = sum(r.could_have for r in rows)
        conversations = len(set().union(*(r.conversation_ids for r in rows)))
        days = len({r.day for r in rows if r.could_have > 0})
        mapping = (value_evidence or {}).get(value, {})
        selected = mapping.get("for", value)
        opposite = mapping.get("against")
        lead_for = rate(
            evidence.get(selected, []), evaluation_day, half_life_days, kind, start
        )
        lead_against = (
            rate(
                evidence.get(opposite, []), evaluation_day, half_life_days, kind, start
            )
            if opposite
            else None
        )
        met = (
            occasions >= self.occasions
            and conversations >= self.conversations
            and days >= self.days
            and lead_for is not None
            and lead_for >= self.lead_for
            and lead_against is not None
            and lead_against <= self.lead_against
        )
        return GateResult(met, occasions, conversations, days, lead_for, lead_against)


def load_dimension(path: str | Path) -> Dimension:
    data = _load(path)
    required = (
        "id",
        "version",
        "area",
        "values",
        "default",
        "scope",
        "change_policy",
        "occasion",
        "evidence",
        "gate",
        "window_days",
        "half_life_days",
    )
    missing = [key for key in required if key not in data]
    if missing:
        raise ValueError(f"dimension missing required fields: {', '.join(missing)}")
    if not isinstance(data["occasion"], str) or not data["occasion"]:
        raise ValueError("dimension must designate an occasion feature")
    values = tuple(data["values"])
    if not values or data["default"] not in values:
        raise ValueError("dimension values must include its default")
    raw_gate = data["gate"]
    gate = Gate(
        raw_gate["occasions"],
        raw_gate["conversations"],
        raw_gate["days"],
        raw_gate["lead"]["for"],
        raw_gate["lead"]["against"],
    )
    return Dimension(
        data["id"],
        data["version"],
        data["area"],
        values,
        data["default"],
        data["scope"],
        data["change_policy"],
        data["occasion"],
        data["evidence"],
        gate,
        data["window_days"],
        data["half_life_days"],
        data.get("scale", False),
    )


def weight(day: date, evaluation_day: date, half_life_days: float) -> float:
    age = (evaluation_day - day).days
    return 0.5 ** (age / half_life_days) if age >= 0 else 0


def rate(
    rows: list[DailyCount],
    evaluation_day: date,
    half_life_days: float,
    kind: str | None = None,
    start: date | None = None,
) -> float | None:
    rows = [
        r
        for r in rows
        if r.day <= evaluation_day
        and (start is None or r.day >= start)
        and (kind is None or r.kind == kind)
    ]
    if any(
        r.happened < 0 or r.could_have < 0 or r.happened > r.could_have for r in rows
    ):
        raise ValueError(
            "invalid feature rate: happened must be between zero and could_have"
        )
    denominator = sum(
        r.could_have * weight(r.day, evaluation_day, half_life_days) for r in rows
    )
    if denominator == 0:
        return None
    return (
        sum(r.happened * weight(r.day, evaluation_day, half_life_days) for r in rows)
        / denominator
    )


def select_value(
    current: str,
    values: Sequence[str],
    for_rates: dict[str, float | None],
    scale: bool = False,
) -> str:
    candidates = [
        (for_rates.get(value), value)
        for value in values
        if value != current and for_rates.get(value) is not None
    ]
    if not candidates:
        return current
    best_rate = max(rate_value for rate_value, _ in candidates)
    if for_rates.get(current) == best_rate:
        return current
    winners = [value for rate_value, value in candidates if rate_value == best_rate]
    if len(winners) != 1:
        return current
    winner = winners[0]
    if scale:
        step = 1 if values.index(winner) > values.index(current) else -1
        return values[values.index(current) + step]
    return winner


def lookup_value(
    kind: str,
    default: str,
    explicit: dict[str, str] | None = None,
    learned: dict[str, str] | None = None,
    global_value: str | None = None,
    undone: dict[str, set[str]] | None = None,
) -> str:
    explicit, learned, undone = explicit or {}, learned or {}, undone or {}
    if kind in explicit:
        return explicit[kind]
    if kind in learned and learned[kind] not in undone.get(kind, set()):
        return learned[kind]
    return global_value if global_value is not None else default


@dataclass(frozen=True)
class Evidence:
    judged_value: str
    features: dict[str, list[DailyCount]]
    freshness_cutoff: date | None
    evaluation_day: date

    def to_dict(self) -> dict:
        return {
            "judged_value": self.judged_value,
            "features": [
                {
                    "id": feature,
                    "daily_counts": [
                        {
                            "day": row.day.isoformat(),
                            "kind": row.kind,
                            "happened": row.happened,
                            "could_have": row.could_have,
                            "conversation_ids": sorted(row.conversation_ids),
                        }
                        for row in sorted(rows, key=lambda item: (item.day, item.kind))
                    ],
                }
                for feature, rows in sorted(self.features.items())
            ],
            "freshness_cutoff": self.freshness_cutoff.isoformat()
            if self.freshness_cutoff
            else None,
            "evaluation_day": self.evaluation_day.isoformat(),
        }
