from datetime import date, datetime, timezone
from uuid import UUID

from implicity_contracts.generated import ChangePolicy, Proposal, Source, Type1
from implicity_engine import DailyCount, Engine, FakeEventSource, load_dimensions

NOW = datetime(2026, 11, 24, tzinfo=timezone.utc)


def proposal(dimension="long_answers", to="open", policy=ChangePolicy.automatic):
    return Proposal(
        id=f"prop_{UUID('00000000-0000-4000-8000-000000000001')}",
        source=Source.rule,
        dimension=dimension,
        kind=None,
        to=to,
        reason="Evidence supports open",
        evidence={"features": []},
        payload={},
        change_policy=policy,
        type=Type1.dimension,
    )


def engine(counts=None):
    return Engine(
        load_dimensions("contracts/dimensions"),
        FakeEventSource(counts or {}),
        clock=lambda: NOW,
    )


def test_exclusion_applies_to_daily_counts_and_session_summaries():
    source = FakeEventSource(
        {
            "long_answer_expanded": [
                DailyCount(date(2026, 11, 24), "coding", 2, 3, 1, "s1")
            ]
        }
    )
    assert (
        source.daily_counts(
            "long_answer_expanded", date(2026, 11, 24), date(2026, 11, 24), ["s1"]
        )
        == []
    )
    assert source.session_summaries(date.min, date.max, ["s1"]) == []


def test_invalid_target_is_rejected():
    verdict = engine().submit(proposal(to="unknown"))
    assert verdict.status == "rejected"
    assert "dimension value" in verdict.reason


def test_automatic_policy_observes_gate_and_admits_with_inverse():
    counts = {
        "long_answer_expanded": [
            DailyCount(date(2026, 11, d), "coding", 18, 20, 1, f"s{d}")
            for d in (20, 22, 24)
        ]
    }
    subject = engine(counts)
    result = subject.submit(proposal())
    assert result.status == "admitted"
    assert result.decision.to == "open"
    assert result.decision.from_ == "folded"
    assert result.decision.evidence["features"][0]["feature"] == "long_answer_expanded"


def test_explicit_lock_freeze_pace_and_undo():
    counts = {
        "long_answer_expanded": [
            DailyCount(date(2026, 11, d), "coding", 18, 20, 1, f"s{d}")
            for d in (20, 22, 24)
        ]
    }
    subject = engine(counts)
    subject.set_explicit("long_answers", "folded")
    assert subject.submit(proposal()).status == "rejected"
    subject.return_to_automatic("long_answers")
    subject.set_lock("layout", True)
    assert subject.submit(proposal()).status == "rejected"
    subject.set_lock("layout", False)
    subject.freeze(True)
    assert subject.submit(proposal()).status == "rejected"
    subject.freeze(False)
    result = subject.submit(proposal())
    assert result.status == "admitted"
    subject.undo(result.decision.id.root)
    assert subject.state()["long_answers"] == "folded"
    assert subject.submit(proposal()).status == "rejected"


def test_proposed_changes_wait_for_keep():
    subject = engine()
    p = proposal(policy=ChangePolicy.proposed)
    assert subject.submit(p).status == "deferred"
    assert subject.state()["long_answers"] == "folded"
    assert subject.keep(p.id.root).status == "admitted"


def test_import_boundary_check_covers_engine_sources():
    import ast
    from pathlib import Path

    import implicity_engine

    root = Path(implicity_engine.__file__).parent
    forbidden = ("api.app", "api.chat", "api.memory", "hermes")
    for path in root.glob("*.py"):
        tree = ast.parse(path.read_text())
        imported = [
            node.module.lower()
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.module
        ] + [
            alias.name.lower()
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        ]
        assert not any(
            name == blocked or name.startswith(blocked + ".")
            for name in imported
            for blocked in forbidden
        ), path


def test_excluding_session_reverts_change_when_gate_is_lost():
    counts = {
        "long_answer_expanded": [
            DailyCount(date(2026, 11, d), "coding", 18, 20, 1, f"s{d}")
            for d in (20, 22, 24)
        ]
    }
    subject = engine(counts)
    decision = subject.submit(proposal()).decision
    subject.exclude_session("s20")
    reverted = subject.exclude_session("s22")
    assert reverted == [decision]
    assert subject.state()["long_answers"] == "folded"
