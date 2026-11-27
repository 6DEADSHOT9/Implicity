from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from math import isfinite
from pathlib import Path
from typing import Collection, Protocol, Sequence
from zoneinfo import ZoneInfo

import yaml
from implicity_contracts.generated import SessionSummary


@dataclass(frozen=True)
class Feature:
    id: str
    happened: dict | None
    could_have: dict
    group_by: tuple[str, ...]


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
    happened: int
    could_have: int
    conversation_ids: frozenset[str]


class EventSource(Protocol):
    def daily_counts(
        self, feature: str, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[DailyCount]: ...

    def session_summaries(
        self, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[SessionSummary]: ...


class EventSourceUnavailable(RuntimeError):
    """The event store cannot currently serve evidence."""


class FakeEventSource:
    def __init__(
        self,
        counts: dict[str, list[tuple[DailyCount, str]]],
        summaries: list[SessionSummary],
        local_timezone: str = "UTC",
        features: dict[str, Feature] | None = None,
    ):
        self.counts = counts
        self.summaries = summaries
        self.local_timezone = ZoneInfo(local_timezone)
        self.features = features or {}
        self.daily_count_calls = 0
        self.daily_count_windows: list[tuple[str, date, date, tuple[str, ...]]] = []

    def daily_counts(
        self, feature: str, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[DailyCount]:
        self.daily_count_calls += 1
        self.daily_count_windows.append((feature, start, end, tuple(exclude_sessions)))
        grouped: dict[tuple[date, str], DailyCount] = {}
        for row, session_id in self.counts.get(feature, []):
            if not start <= row.day <= end or session_id in exclude_sessions:
                continue
            definition = self.features.get(feature)
            happened = (
                0
                if definition is not None and definition.happened is None
                else row.happened
            )
            key = row.day, row.kind
            previous = grouped.get(key)
            grouped[key] = DailyCount(
                row.day,
                row.kind,
                happened + (previous.happened if previous else 0),
                row.could_have + (previous.could_have if previous else 0),
                row.conversation_ids
                | (previous.conversation_ids if previous else frozenset()),
            )
        return [grouped[key] for key in sorted(grouped)]

    def session_summaries(
        self, start: date, end: date, exclude_sessions: Sequence[str] = ()
    ) -> list[SessionSummary]:
        return [
            row
            for row in self.summaries
            if start <= row.timestamp.astimezone(self.local_timezone).date() <= end
            and str(row.session_id) not in exclude_sessions
        ]


def _load(path: str | Path) -> dict:
    try:
        data = yaml.load(Path(path).read_text(), Loader=_UniqueKeySafeLoader)
    except (OSError, yaml.YAMLError) as exc:
        raise ValueError(f"could not load YAML: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"expected a YAML mapping: {path}")
    return data


class _UniqueKeySafeLoader(yaml.SafeLoader):
    def construct_mapping(self, node, deep=False):
        self.flatten_mapping(node)
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if key in result:
                raise yaml.constructor.ConstructorError(
                    "while constructing a mapping",
                    node.start_mark,
                    f"duplicate key {key!r}",
                    key_node.start_mark,
                )
            result[key] = self.construct_object(value_node, deep=deep)
        return result


def load_feature(path: str | Path) -> Feature:
    data = _load(path)
    for key in ("happened", "could_have"):
        selector = data.get(key)
        if selector is None and key == "happened":
            continue
        if not isinstance(selector, dict) or not isinstance(selector.get("event"), str):
            raise ValueError(f"{path}: feature {key} requires a selector event")
        if not selector["event"] or not isinstance(selector.get("where", {}), dict):
            raise ValueError(f"{path}: invalid feature {key} selector")
    group_by = data.get("group_by")
    if (
        not isinstance(data.get("id"), str)
        or not data["id"]
        or group_by != ["day", "kind"]
    ):
        raise ValueError(f"{path}: feature requires id and group_by [day, kind]")
    return Feature(
        data["id"], data.get("happened"), data["could_have"], tuple(group_by)
    )


@dataclass(frozen=True)
class GateResult:
    value: str
    met: bool
    occasions: int
    conversations: int
    days: int
    for_rate: float | None
    against_rate: float | None


@dataclass(frozen=True)
class Gate:
    occasions: int
    conversations: int
    days: int
    lead_for: float
    lead_against: float

    def check(
        self,
        value: str,
        kind: str | None,
        evaluation_day: date,
        window_days: int,
        half_life_days: float,
        occasion: str,
        evidence: dict[str, list[DailyCount]],
        value_evidence: dict[str, str],
    ) -> GateResult:
        start = date.fromordinal(evaluation_day.toordinal() - window_days + 1)
        rows = [
            r
            for r in evidence.get(occasion, [])
            if (kind is None or r.kind == kind) and start <= r.day <= evaluation_day
        ]
        if any(
            not isinstance(row.happened, int)
            or isinstance(row.happened, bool)
            or row.happened != 0
            or not isinstance(row.could_have, int)
            or isinstance(row.could_have, bool)
            or row.could_have < 0
            for row in rows
        ):
            raise ValueError(
                "occasion feature counts require happened=0 and nonnegative could_have"
            )
        occasions = sum(r.could_have for r in rows)
        conversations = len(set().union(*(r.conversation_ids for r in rows)))
        days = len({r.day for r in rows if r.could_have > 0})
        selected = value_evidence["for"]
        opposite = value_evidence["against"]
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
        return GateResult(
            value, met, occasions, conversations, days, lead_for, lead_against
        )


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
    try:
        missing = [key for key in required if key not in data]
        if missing:
            raise ValueError(f"missing fields: {', '.join(missing)}")
        if not all(
            isinstance(data[key], str) and data[key]
            for key in ("id", "area", "scope", "change_policy", "occasion")
        ):
            raise ValueError(
                "id, area, scope, change_policy and occasion must be strings"
            )
        if data["area"] not in {"layout", "look", "answer_style", "home", "workflow"}:
            raise ValueError("invalid dimension area")
        if data["scope"] not in {"kind", "global"}:
            raise ValueError("invalid dimension scope")
        if data["change_policy"] not in {"automatic", "proposed"}:
            raise ValueError("invalid change_policy")
        if (
            not isinstance(data["version"], int)
            or isinstance(data["version"], bool)
            or data["version"] < 1
        ):
            raise ValueError("version must be a positive integer")
        values = data["values"]
        if (
            not isinstance(values, list)
            or not values
            or not all(isinstance(value, str) and value for value in values)
            or len(set(values)) != len(values)
            or data["default"] not in values
        ):
            raise ValueError("values must be unique strings including the default")
        raw_evidence = data["evidence"]
        if not isinstance(raw_evidence, dict):
            raise ValueError("evidence must map values to for and against features")
        for value, pair in raw_evidence.items():
            if (
                value not in values
                or not isinstance(pair, dict)
                or not all(
                    isinstance(pair.get(side), str) and pair[side]
                    for side in ("for", "against")
                )
            ):
                raise ValueError(
                    "each evidence value requires for and against features"
                )
        raw_gate = data["gate"]
        if not isinstance(raw_gate, dict) or not isinstance(raw_gate.get("lead"), dict):
            raise ValueError("gate requires occasions, conversations, days and lead")
        counts = [raw_gate.get(key) for key in ("occasions", "conversations", "days")]
        if any(
            not isinstance(number, int) or isinstance(number, bool) or number < 0
            for number in counts
        ):
            raise ValueError(
                "gate occasion, conversation and day counts must be nonnegative ints"
            )
        lead_for, lead_against = (
            raw_gate["lead"].get("for"),
            raw_gate["lead"].get("against"),
        )
        if any(
            not isinstance(number, (int, float))
            or isinstance(number, bool)
            or not 0 <= number <= 1
            for number in (lead_for, lead_against)
        ):
            raise ValueError("gate lead rates must be numbers from 0 to 1")
        window, half_life = data["window_days"], data["half_life_days"]
        if not isinstance(window, int) or isinstance(window, bool) or window < 1:
            raise ValueError("window_days must be a positive integer")
        if (
            not isinstance(half_life, (int, float))
            or isinstance(half_life, bool)
            or not isfinite(half_life)
            or half_life <= 0
        ):
            raise ValueError("half_life_days must be positive")
        if not isinstance(data.get("scale", False), bool):
            raise ValueError("scale must be a boolean")
        return Dimension(
            data["id"],
            data["version"],
            data["area"],
            tuple(values),
            data["default"],
            data["scope"],
            data["change_policy"],
            data["occasion"],
            raw_evidence,
            Gate(counts[0], counts[1], counts[2], lead_for, lead_against),
            window,
            half_life,
            data.get("scale", False),
        )
    except (KeyError, TypeError) as exc:
        raise ValueError(f"{path}: malformed dimension") from exc
    except ValueError as exc:
        raise ValueError(f"{path}: {exc}") from exc


def weight(day: date, evaluation_day: date, half_life_days: float) -> float:
    if half_life_days <= 0 or not isfinite(half_life_days):
        raise ValueError("half_life_days must be positive")
    age = (evaluation_day - day).days
    return 0.5 ** (age / half_life_days) if age >= 0 else 0


def rate(
    rows: list[DailyCount],
    evaluation_day: date,
    half_life_days: float,
    kind: str | None = None,
    start: date | None = None,
) -> float | None:
    if half_life_days <= 0 or not isfinite(half_life_days):
        raise ValueError("half_life_days must be positive")
    rows = [
        r
        for r in rows
        if r.day <= evaluation_day
        and (start is None or r.day >= start)
        and (kind is None or r.kind == kind)
    ]
    if any(
        not isinstance(value, int) or isinstance(value, bool)
        for row in rows
        for value in (row.happened, row.could_have)
    ) or any(
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
    undone_values: Collection[str] = (),
) -> str | None:
    candidates = [
        (for_rates[value], value)
        for value in values
        if value not in undone_values
        and value in for_rates
        and for_rates[value] is not None
    ]
    if not candidates:
        return None if current in undone_values else current
    best_rate = max(rate_value for rate_value, _ in candidates)
    if current not in undone_values and for_rates.get(current) == best_rate:
        return current
    winners = [value for rate_value, value in candidates if rate_value == best_rate]
    if len(winners) != 1:
        return None if current in undone_values else current
    winner = winners[0]
    if scale:
        step = 1 if values.index(winner) > values.index(current) else -1
        applied = values[values.index(current) + step]
        return None if applied in undone_values else applied
    return winner


def evaluate_belief(
    dimension: Dimension,
    source: EventSource,
    current: str,
    kind: str | None,
    evaluation_day: date,
    exclude_sessions: Sequence[str] = (),
    freshness_cutoff: date | None = None,
    undone_values: Collection[str] = (),
) -> Belief:
    start = date.fromordinal(evaluation_day.toordinal() - dimension.window_days + 1)
    if freshness_cutoff is None:
        query_start = start
    elif freshness_cutoff >= evaluation_day:
        query_start = evaluation_day
    else:
        query_start = max(start, freshness_cutoff + timedelta(days=1))
    blocked = frozenset(undone_values)
    feature_ids = {dimension.occasion}
    feature_ids.update(
        pair[side]
        for pair in dimension.evidence.values()
        for side in ("for", "against")
    )
    counts = {
        feature: [
            row
            for row in source.daily_counts(
                feature, query_start, evaluation_day, exclude_sessions
            )
            if query_start <= row.day <= evaluation_day
            and (freshness_cutoff is None or row.day > freshness_cutoff)
        ]
        for feature in sorted(feature_ids)
    }
    gates = {
        value: dimension.gate.check(
            value,
            kind,
            evaluation_day,
            dimension.window_days,
            dimension.half_life_days,
            dimension.occasion,
            counts,
            dimension.evidence[value],
        )
        for value in dimension.values
        if value in dimension.evidence and value not in blocked
    }
    qualifying = {
        value: result.for_rate for value, result in gates.items() if result.met
    }
    judged = select_value(current, dimension.values, qualifying, undone_values=blocked)
    applied = (
        select_value(
            current,
            dimension.values,
            {judged: qualifying.get(judged)},
            dimension.scale,
            blocked,
        )
        if judged is not None
        else None
    )
    evidence = Evidence(judged, counts, freshness_cutoff, evaluation_day)
    return Belief(judged, applied, gates, evidence)


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
    if global_value is not None and global_value not in undone.get(kind, set()):
        return global_value
    return default


@dataclass(frozen=True)
class Evidence:
    judged_value: str | None
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

    @classmethod
    def from_dict(cls, value: dict) -> Evidence:
        return cls(
            value["judged_value"],
            {
                feature["id"]: [
                    DailyCount(
                        date.fromisoformat(row["day"]),
                        row["kind"],
                        row["happened"],
                        row["could_have"],
                        frozenset(row["conversation_ids"]),
                    )
                    for row in feature["daily_counts"]
                ]
                for feature in value["features"]
            },
            date.fromisoformat(value["freshness_cutoff"])
            if value["freshness_cutoff"]
            else None,
            date.fromisoformat(value["evaluation_day"]),
        )


@dataclass(frozen=True)
class Belief:
    judged_value: str | None
    applied_value: str | None
    gates: dict[str, GateResult]
    evidence: Evidence
