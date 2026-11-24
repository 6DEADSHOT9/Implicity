import ast
from datetime import date, timedelta
from pathlib import Path

import pytest
from implicity_engine import (
    DailyCount,
    Evidence,
    FakeEventSource,
    Feature,
    Gate,
    SessionSummary,
    load_dimension,
    load_feature,
    lookup_value,
    rate,
    select_value,
    weight,
)

TODAY = date(2026, 11, 25)


def test_yaml_loaders_require_valid_files_and_occasion(tmp_path: Path) -> None:
    feature_path = tmp_path / "feature.yaml"
    feature_path.write_text(
        "id: seen\ncould_have: {event: component_seen}\ngroup_by: [day, kind]\n"
    )
    assert load_feature(feature_path) == Feature(
        "seen", None, {"event": "component_seen"}
    )

    dimension_path = tmp_path / "dimension.yaml"
    dimension_path.write_text(
        "id: answer\nversion: 1\narea: layout\nvalues: [folded, open]\n"
        "default: folded\nscope: kind\nchange_policy: automatic\noccasion: seen\n"
        "evidence: {open: {for: expanded, against: collapsed}}\n"
        "gate: {occasions: 20, conversations: 3, days: 2, "
        "lead: {for: 0.7, against: 0.1}}\n"
        "window_days: 60\nhalf_life_days: 14\n"
    )
    assert load_dimension(dimension_path).occasion == "seen"
    dimension_path.write_text("id: broken: [")
    with pytest.raises(ValueError):
        load_dimension(dimension_path)
    dimension_path.write_text("id: answer\n")
    with pytest.raises(ValueError, match="occasion"):
        load_dimension(dimension_path)


def test_event_source_exclusions_and_occasion_only_counts() -> None:
    rows = [DailyCount(TODAY, "coding", 0, 3, frozenset({"c1"}), "s1")]
    summary = SessionSummary(TODAY, "coding", "s1", {})
    source = FakeEventSource({"seen": rows}, [summary])
    assert source.daily_counts("seen", TODAY, TODAY, exclude_sessions=["s1"]) == []
    assert source.daily_counts("seen", TODAY, TODAY)[0].happened == 0
    assert source.session_summaries(TODAY, TODAY, exclude_sessions=["s1"]) == []
    assert source.session_summaries(TODAY, TODAY) == [summary]


def test_distinct_conversations_and_occasion_feature_gate() -> None:
    seen = [
        DailyCount(TODAY - timedelta(days=2), "coding", 0, 10, frozenset({"same"})),
        DailyCount(TODAY - timedelta(days=1), "coding", 0, 10, frozenset({"same"})),
        DailyCount(TODAY, "coding", 0, 10, frozenset({"same"})),
    ]
    assert (
        not Gate(20, 3, 2, 0.7, 0.1)
        .check(
            "open",
            "folded",
            "coding",
            TODAY,
            3,
            14,
            "seen",
            {"seen": seen, "expanded": [], "collapsed": []},
        )
        .met
    )
    seen[-1] = DailyCount(TODAY, "coding", 0, 10, frozenset({"third"}))
    seen[-2] = DailyCount(
        TODAY - timedelta(days=1), "coding", 0, 10, frozenset({"second"})
    )
    evidence = {
        "seen": seen,
        "expanded": [DailyCount(TODAY, "coding", 18, 20, frozenset())],
        "collapsed": [DailyCount(TODAY, "coding", 1, 20, frozenset())],
    }
    evidence["collapsed"] = [DailyCount(TODAY, "coding", 0, 0, frozenset())]
    assert not (
        Gate(20, 3, 2, 0.7, 0.1)
        .check(
            "open",
            "folded",
            "coding",
            TODAY,
            3,
            14,
            "seen",
            evidence,
            {"open": {"for": "expanded", "against": "collapsed"}},
        )
        .met
    )
    evidence["collapsed"] = [DailyCount(TODAY, "coding", 1, 20, frozenset())]
    assert (
        Gate(20, 3, 2, 0.7, 0.1)
        .check(
            "open",
            "folded",
            "coding",
            TODAY,
            3,
            14,
            "seen",
            evidence,
            {"open": {"for": "expanded", "against": "collapsed"}},
        )
        .met
    )


def test_occasion_feature_counts_both_states_once() -> None:
    rows = [
        DailyCount(TODAY, "coding", 0, 20, frozenset({"folded"})),
        DailyCount(TODAY, "coding", 0, 20, frozenset({"open"})),
    ]
    result = Gate(40, 2, 1, 0.7, 0.1).check(
        "open",
        "folded",
        "coding",
        TODAY,
        1,
        14,
        "seen",
        {"seen": rows, "expanded": [], "collapsed": []},
    )
    assert (result.occasions, result.conversations, result.days) == (40, 2, 1)


def test_leads_use_weighted_feature_denominators_and_reject_invalid_rates() -> None:
    assert rate(
        [DailyCount(TODAY, "coding", 18, 20, frozenset())], TODAY, 14
    ) == pytest.approx(0.9)
    assert rate(
        [DailyCount(TODAY, "coding", 1, 20, frozenset())], TODAY, 14
    ) == pytest.approx(0.05)
    assert rate([DailyCount(TODAY, "coding", 0, 0, frozenset())], TODAY, 14) is None
    with pytest.raises(ValueError, match="rate"):
        rate([DailyCount(TODAY, "coding", 2, 1, frozenset())], TODAY, 14)


def test_day_weight_and_inclusive_window() -> None:
    assert weight(TODAY, TODAY, 14) == 1
    assert weight(TODAY - timedelta(days=14), TODAY, 14) == pytest.approx(0.5)
    assert weight(TODAY - timedelta(days=60), TODAY, 14) == pytest.approx(
        0.5 ** (60 / 14)
    )
    assert (
        rate(
            [DailyCount(TODAY - timedelta(days=60), "coding", 1, 1, frozenset())],
            TODAY,
            14,
            start=TODAY - timedelta(days=59),
        )
        is None
    )


def test_highest_rate_wins_tie_keeps_current_and_scale_moves_one_step() -> None:
    gates = {"short": 0.8, "long": 0.8, "spacious": 0.9}
    assert select_value("medium", ["short", "medium", "long"], gates) == "medium"
    assert (
        select_value(
            "medium",
            ["short", "medium", "long"],
            {"short": 0.8, "medium": 0.8, "long": 0.1},
        )
        == "medium"
    )
    assert (
        select_value(
            "compact", ["compact", "comfortable", "spacious"], gates, scale=True
        )
        == "comfortable"
    )


def test_value_lookup_order_and_undone_values_are_not_learned() -> None:
    assert (
        lookup_value(
            "coding",
            "folded",
            explicit={"coding": "explicit"},
            learned={"coding": "learned"},
            global_value="global",
        )
        == "explicit"
    )
    assert (
        lookup_value(
            "coding", "folded", learned={"coding": "learned"}, global_value="global"
        )
        == "learned"
    )
    assert (
        lookup_value(
            "writing", "folded", learned={"coding": "learned"}, global_value="global"
        )
        == "global"
    )
    assert (
        lookup_value(
            "writing",
            "folded",
            learned={"writing": "open"},
            undone={"writing": {"open"}},
        )
        == "folded"
    )


def test_evidence_snapshot_preserves_judged_value_rows_cutoff_and_day() -> None:
    row = DailyCount(TODAY, "coding", 18, 20, frozenset({"c1", "c2"}))
    evidence = Evidence("spacious", {"seen": [row]}, TODAY - timedelta(days=3), TODAY)
    assert evidence.to_dict() == {
        "judged_value": "spacious",
        "features": [
            {
                "id": "seen",
                "daily_counts": [
                    {
                        "day": "2026-11-25",
                        "kind": "coding",
                        "happened": 18,
                        "could_have": 20,
                        "conversation_ids": ["c1", "c2"],
                    }
                ],
            }
        ],
        "freshness_cutoff": "2026-11-22",
        "evaluation_day": "2026-11-25",
    }


def test_engine_import_boundary() -> None:
    package = Path(__file__).parents[1] / "implicity_engine"
    forbidden = {"app", "chat", "memory", "hermes"}
    for path in package.glob("*.py"):
        tree = ast.parse(path.read_text())
        imports = [
            node.module.split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.module
        ]
        imports += [
            alias.name.split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        ]
        assert forbidden.isdisjoint(imports), (
            f"forbidden engine import in {path}: {imports}"
        )
