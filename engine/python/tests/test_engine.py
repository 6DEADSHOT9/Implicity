import ast
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

import pytest
from implicity_contracts.generated import (
    DayType,
    DeviceClass,
    InputType,
    Kinds,
    LocalHourBucket,
    Typing,
)
from implicity_contracts.generated import (
    SessionSummary as ContractSessionSummary,
)
from implicity_engine import (
    DailyCount,
    Evidence,
    FakeEventSource,
    Feature,
    evaluate_belief,
    load_dimension,
    load_feature,
    lookup_value,
    rate,
    select_value,
)

TODAY = date(2026, 11, 25)


def count(day: date, happened: int, could_have: int, *conversations: str):
    return DailyCount(day, "coding", happened, could_have, frozenset(conversations))


def fake_count(row: DailyCount, session_id: str = "s1"):
    return row, session_id


def contract_summary(timestamp: datetime, session_id: str) -> ContractSessionSummary:
    return ContractSessionSummary(
        event_id=UUID("11111111-1111-4111-8111-111111111111"),
        timestamp=timestamp,
        contracts_version=1,
        session_id=UUID(session_id),
        layout_version=1,
        registry_version=1,
        device_class=DeviceClass.desktop,
        input_type=InputType.none,
        name="session_summary",
        duration=10.0,
        active_time=10.0,
        turns=1,
        kinds=[Kinds.coding],
        local_hour_bucket=LocalHourBucket.morning,
        day_type=DayType.weekday,
        typing=Typing(
            composing_time=None,
            mean_key_gap=None,
            key_gap_spread=None,
            burst_count=0,
            pause_count=0,
            backspace_rate=None,
        ),
    )


def dimension_file(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "dimension.yaml"
    path.write_text(text)
    return path


def test_recomputes_belief_from_fake_source_and_retains_judged_scale_value(
    tmp_path: Path,
) -> None:
    dimension = load_dimension(
        dimension_file(
            tmp_path,
            "id: density\nversion: 1\narea: layout\n"
            "values: [compact, comfortable, spacious]\ndefault: compact\n"
            "scope: kind\nchange_policy: automatic\nscale: true\noccasion: session\n"
            "evidence: {spacious: {for: scroll, against: misses}, "
            "comfortable: {for: comfort, against: misses}, "
            "compact: {for: misses, against: scroll}}\n"
            "gate: {occasions: 1, conversations: 1, days: 1, "
            "lead: {for: 0.7, against: 0.1}}\nwindow_days: 60\nhalf_life_days: 14\n",
        )
    )
    rows = {
        "session": [fake_count(count(TODAY, 0, 1, "c1"))],
        "scroll": [fake_count(count(TODAY, 9, 10, "c1"))],
        "comfort": [fake_count(count(TODAY, 8, 10, "c1"))],
        "misses": [fake_count(count(TODAY, 1, 10, "c1"))],
    }
    source = FakeEventSource(
        rows,
        [],
        local_timezone="UTC",
        features={
            "session": Feature(
                "session", None, {"event": "session_summary"}, ("day", "kind")
            )
        },
    )
    first = evaluate_belief(dimension, source, "compact", "coding", TODAY)
    second = evaluate_belief(dimension, source, "compact", "coding", TODAY)
    assert (first.judged_value, first.applied_value) == ("spacious", "comfortable")
    assert first == second
    assert source.daily_count_calls == 8
    saved = Evidence.from_dict(first.evidence.to_dict())
    replay = dimension.gate.check(
        saved.judged_value,
        "coding",
        saved.evaluation_day,
        60,
        14,
        "session",
        saved.features,
        dimension.evidence["spacious"],
    )
    assert saved.judged_value == "spacious"
    assert replay == first.gates["spacious"]
    fresh_only = evaluate_belief(
        dimension, source, "compact", "coding", TODAY, freshness_cutoff=TODAY
    )
    assert (fresh_only.judged_value, fresh_only.applied_value) == ("compact", "compact")


def test_yaml_loaders_keep_documented_fields_and_reject_invalid_definitions(
    tmp_path: Path,
) -> None:
    feature_path = tmp_path / "seen.yaml"
    feature_path.write_text(
        "id: seen\ncould_have: {event: component_seen}\ngroup_by: [day, kind]\n"
    )
    feature = load_feature(feature_path)
    assert feature == Feature(
        "seen", None, {"event": "component_seen"}, ("day", "kind")
    )
    feature_path.write_text("id: bad\ncould_have: {event: []}\ngroup_by: [day, kind]\n")
    with pytest.raises(ValueError, match="seen.yaml"):
        load_feature(feature_path)

    valid = (
        "id: answer\nversion: 1\narea: layout\nvalues: [folded, open]\n"
        "default: folded\nscope: kind\nchange_policy: automatic\noccasion: seen\n"
        "evidence: {open: {for: expanded, against: collapsed}}\n"
        "gate: {occasions: 20, conversations: 3, days: 2, "
        "lead: {for: 0.7, against: 0.1}}\nwindow_days: 60\nhalf_life_days: 14\n"
    )
    path = dimension_file(tmp_path, valid)
    assert load_dimension(path).occasion == "seen"
    for invalid in (
        valid.replace("occasion: seen\n", ""),
        valid.replace("occasion: seen", "occasion: ''"),
        valid.replace("half_life_days: 14", "half_life_days: 0"),
        valid.replace("occasions: 20", "occasions: []"),
        valid.replace("occasion: seen", "occasion: ''\noccasion: seen"),
    ):
        path.write_text(invalid)
        with pytest.raises(ValueError, match="dimension.yaml"):
            load_dimension(path)
    path.write_text("id: broken: [")
    with pytest.raises(ValueError, match="dimension.yaml"):
        load_dimension(path)


def test_fake_uses_shared_session_summary_and_honours_local_day_and_exclusions() -> (
    None
):
    row = count(TODAY, 0, 3, "c1")
    other_row = count(TODAY, 0, 2, "c2")
    session_id = "22222222-2222-4222-8222-222222222222"
    summary = contract_summary(
        datetime(2026, 11, 26, 1, tzinfo=timezone.utc), session_id
    )
    source = FakeEventSource(
        {"seen": [fake_count(row, session_id), fake_count(other_row, "s2")]},
        [summary],
        local_timezone="America/Los_Angeles",
    )
    assert source.daily_counts("seen", TODAY, TODAY, exclude_sessions=[session_id]) == [
        other_row
    ]
    assert (
        source.daily_counts("seen", TODAY, TODAY, exclude_sessions=[session_id, "s2"])
        == []
    )
    assert source.daily_counts("seen", TODAY, TODAY, exclude_sessions=["s2"]) == [row]
    assert source.daily_counts("seen", TODAY, TODAY)[0] == count(
        TODAY, 0, 5, "c1", "c2"
    )
    assert source.session_summaries(TODAY, TODAY) == [summary]
    assert source.session_summaries(TODAY, TODAY, [session_id]) == []


def test_gate_counts_distinct_conversations_and_only_occasion_rows(
    tmp_path: Path,
) -> None:
    path = dimension_file(
        tmp_path,
        "id: answer\nversion: 1\narea: layout\nvalues: [folded, open]\n"
        "default: folded\nscope: kind\nchange_policy: automatic\noccasion: seen\n"
        "evidence: {open: {for: expanded, against: collapsed}, "
        "folded: {for: collapsed, against: expanded}}\n"
        "gate: {occasions: 20, conversations: 3, days: 2, "
        "lead: {for: 0.7, against: 0.1}}\nwindow_days: 3\nhalf_life_days: 14\n",
    )
    dimension = load_dimension(path)
    source = FakeEventSource(
        {
            "seen": [
                fake_count(count(TODAY - timedelta(days=2), 0, 10, "same")),
                fake_count(count(TODAY - timedelta(days=1), 0, 10, "same")),
                fake_count(count(TODAY, 0, 10, "same")),
            ],
            "expanded": [fake_count(count(TODAY, 18, 20))],
            "collapsed": [fake_count(count(TODAY, 1, 20))],
        },
        [],
    )
    one_conversation = evaluate_belief(dimension, source, "folded", "coding", TODAY)
    assert one_conversation.gates["open"].conversations == 1
    assert not one_conversation.gates["open"].met
    source.counts["seen"][-1] = fake_count(count(TODAY, 0, 10, "third"))
    source.counts["seen"][-2] = fake_count(
        count(TODAY - timedelta(days=1), 0, 10, "second")
    )
    assert (
        evaluate_belief(dimension, source, "folded", "coding", TODAY).gates["open"].met
    )
    source.counts["collapsed"] = [fake_count(count(TODAY, 0, 0))]
    assert (
        not evaluate_belief(dimension, source, "folded", "coding", TODAY)
        .gates["open"]
        .met
    )


def test_occasions_use_only_designated_feature_and_weighted_leads_have_own_denominators(
    tmp_path: Path,
) -> None:
    path = dimension_file(
        tmp_path,
        "id: answer\nversion: 1\narea: layout\nvalues: [folded, open]\n"
        "default: folded\nscope: kind\nchange_policy: automatic\noccasion: seen\n"
        "evidence: {open: {for: expanded, against: collapsed}}\n"
        "gate: {occasions: 40, conversations: 2, days: 1, "
        "lead: {for: 0.7, against: 0.1}}\nwindow_days: 60\nhalf_life_days: 14\n",
    )
    dimension = load_dimension(path)
    source = FakeEventSource(
        {
            "seen": [
                fake_count(count(TODAY, 99, 20, "folded")),
                fake_count(count(TODAY, 0, 20, "open")),
            ],
            "expanded": [fake_count(count(TODAY, 18, 20))],
            "collapsed": [fake_count(count(TODAY, 1, 20))],
        },
        [],
        features={
            "seen": Feature("seen", None, {"event": "component_seen"}, ("day", "kind"))
        },
    )
    result = evaluate_belief(dimension, source, "folded", "coding", TODAY)
    assert all(row.happened == 0 for row in result.evidence.features["seen"])
    assert result.gates["open"].occasions == 40
    assert result.gates["open"].for_rate == pytest.approx(0.9)
    assert result.gates["open"].against_rate == pytest.approx(0.05)
    assert result.gates["open"].met
    with pytest.raises(ValueError, match="rate"):
        rate([count(TODAY, 2, 1)], TODAY, 14)


def test_day_weights_and_window_boundary(tmp_path: Path) -> None:
    dimension = load_dimension(
        dimension_file(
            tmp_path,
            "id: answer\nversion: 1\narea: layout\nvalues: [folded, open]\n"
            "default: folded\nscope: kind\nchange_policy: automatic\noccasion: seen\n"
            "evidence: {open: {for: expanded, against: collapsed}}\n"
            "gate: {occasions: 1, conversations: 1, days: 1, "
            "lead: {for: 0, against: 1}}\nwindow_days: 60\nhalf_life_days: 14\n",
        )
    )
    source = FakeEventSource(
        {
            "seen": [
                fake_count(count(TODAY, 0, 1, "today")),
                fake_count(count(TODAY - timedelta(days=60), 0, 100, "outside")),
            ],
            "expanded": [
                fake_count(count(TODAY, 0, 10)),
                fake_count(count(TODAY - timedelta(days=14), 10, 10)),
            ],
            "collapsed": [fake_count(count(TODAY, 0, 10))],
        },
        [],
    )
    result = evaluate_belief(dimension, source, "folded", "coding", TODAY)
    assert result.gates["open"].occasions == 1
    assert result.gates["open"].days == 1
    assert result.gates["open"].for_rate == pytest.approx(1 / 3)
    assert all(
        row.day > TODAY - timedelta(days=60)
        for rows in result.evidence.features.values()
        for row in rows
    )
    wide_rows = {
        feature: source.daily_counts(feature, TODAY - timedelta(days=60), TODAY)
        for feature in ("seen", "expanded", "collapsed")
    }
    wide_result = dimension.gate.check(
        "open",
        "coding",
        TODAY,
        60,
        14,
        "seen",
        wide_rows,
        dimension.evidence["open"],
    )
    assert wide_result.occasions == 1


def test_selects_highest_qualifying_rate_ties_keep_current_and_scales_step_once() -> (
    None
):
    values = ["short", "medium", "long"]
    assert (
        select_value("medium", values, {"short": 0.8, "medium": 0.9, "long": 0.7})
        == "medium"
    )
    assert select_value("medium", values, {"short": 0.8, "long": 0.8}) == "medium"
    assert select_value("medium", values, {"short": 0.9, "medium": 0.9}) == "medium"
    assert (
        select_value(
            "compact",
            ["compact", "comfortable", "spacious"],
            {"spacious": 0.9},
            scale=True,
        )
        == "comfortable"
    )


def test_lookup_order_and_undone_values_never_return_from_automatic_fallbacks() -> None:
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
            "writing",
            "folded",
            learned={"writing": "open"},
            global_value="open",
            undone={"writing": {"open"}},
        )
        == "folded"
    )
    assert (
        lookup_value(
            "writing", "folded", learned={"coding": "learned"}, global_value="global"
        )
        == "global"
    )


def test_undone_value_is_never_gated_or_selected(tmp_path: Path) -> None:
    dimension = load_dimension(
        dimension_file(
            tmp_path,
            "id: answer\nversion: 1\narea: layout\nvalues: [folded, open]\n"
            "default: folded\nscope: kind\nchange_policy: automatic\noccasion: seen\n"
            "evidence: {open: {for: expanded, against: collapsed}}\n"
            "gate: {occasions: 1, conversations: 1, days: 1, "
            "lead: {for: 0.7, against: 0.1}}\nwindow_days: 60\nhalf_life_days: 14\n",
        )
    )
    source = FakeEventSource(
        {
            "seen": [fake_count(count(TODAY, 0, 20, "c1"))],
            "expanded": [fake_count(count(TODAY, 18, 20))],
            "collapsed": [fake_count(count(TODAY, 1, 20))],
        },
        [],
    )
    result = evaluate_belief(
        dimension, source, "folded", "coding", TODAY, undone_values={"open"}
    )
    assert result.judged_value == "folded"
    assert result.applied_value == "folded"
    assert "open" not in result.gates
    assert (
        lookup_value(
            "writing", "folded", global_value="open", undone={"writing": {"open"}}
        )
        == "folded"
    )
    assert (
        lookup_value(
            "writing",
            "folded",
            explicit={"writing": "open"},
            global_value="open",
            undone={"writing": {"open"}},
        )
        == "open"
    )


def test_daily_count_has_only_contract_fields() -> None:
    assert tuple(DailyCount.__dataclass_fields__) == (
        "day",
        "kind",
        "happened",
        "could_have",
        "conversation_ids",
    )


def forbidden_imports(package: Path, repository: Path) -> list[str]:
    forbidden = {"app", "chat", "memory", "hermes", "api", "web", "implicity_api"}
    api_root = repository / "api/src/implicity_api"
    forbidden.update(
        "implicity_api." + path.relative_to(api_root).as_posix().replace("/", ".")
        for path in (
            repository / "api/src/implicity_api/modules/app",
            repository / "api/src/implicity_api/modules/memory",
            repository / "api/src/implicity_api/modules/agent",
            repository / "api/src/implicity_api/stores",
        )
        if path.exists()
    )
    found = []
    for path in package.rglob("*.py"):
        module = "implicity_engine." + ".".join(
            path.relative_to(package).with_suffix("").parts
        )
        for node in ast.walk(ast.parse(path.read_text())):
            imported = []
            if isinstance(node, ast.Import):
                imported.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                base = node.module or ""
                if node.level:
                    parent = module.rsplit(".", node.level)[0]
                    base = f"{parent}.{base}".strip(".")
                imported.append(base)
                imported.extend(f"{base}.{alias.name}" for alias in node.names)
            for name in imported:
                parts = name.lower().split(".")
                if any(part in forbidden for part in parts) or any(
                    name == root or name.startswith(root + ".") for root in forbidden
                ):
                    found.append(f"{path}: {name}")
    return found


def test_engine_import_boundary_covers_nested_and_real_repository_packages(
    tmp_path: Path,
) -> None:
    package = Path(__file__).parents[1] / "implicity_engine"
    repository = Path(__file__).parents[3]
    assert forbidden_imports(package, repository) == []
    for imported in (
        "api",
        "web",
        "Hermes",
        "implicity_api",
        "implicity_api.models.memory",
        "implicity_api.stores.app",
        "memory",
    ):
        nested = tmp_path / "implicity_engine" / "nested"
        nested.mkdir(parents=True, exist_ok=True)
        (nested / "guard.py").write_text(f"import {imported}\n")
        assert forbidden_imports(tmp_path / "implicity_engine", repository)
        (nested / "guard.py").unlink()
    (nested / "guard.py").write_text("from . import memory\n")
    assert forbidden_imports(tmp_path / "implicity_engine", repository)
