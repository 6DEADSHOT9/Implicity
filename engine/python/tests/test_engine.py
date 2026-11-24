from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

import pytest
from implicity_contracts.generated import (
    ChangePolicy,
    Proposal,
    SessionSummary,
    Source,
    Status,
    Type1,
)
from implicity_engine import (
    DailyCount,
    Engine,
    FakeEventSource,
    MemoryStore,
    SessionDailyCount,
    forbidden_engine_imports,
    load_dimensions,
)

NOW = datetime(2026, 11, 24, tzinfo=timezone.utc)
DIMENSIONS = load_dimensions(Path(__file__).parents[3] / "contracts/dimensions")


def make_engine(counts=None, *, store=None, dimensions=None, now=NOW, validator=None):
    source = (
        counts if isinstance(counts, FakeEventSource) else FakeEventSource(counts or {})
    )
    return Engine(
        dimensions or DIMENSIONS,
        source,
        store or MemoryStore(),
        clock=lambda: now,
        state_validator=validator,
    )


def proposal(
    *,
    dimension="long_answers",
    target="open",
    policy=ChangePolicy.automatic,
    source=Source.rule,
    evidence=None,
    reason="Evidence supports open",
    kind=None,
    identifier="00000000-0000-4000-8000-000000000001",
):
    return Proposal(
        id=f"prop_{UUID(identifier)}",
        source=source,
        dimension=dimension,
        kind=kind,
        to=target,
        reason=reason,
        evidence=evidence or {"features": []},
        payload={},
        change_policy=policy,
        type=Type1.dimension,
    )


def rows_for(
    days=(20, 22, 24),
    *,
    expanded=18,
    folded=0,
    opportunities=20,
    sessions=None,
    conversations=None,
    kind="coding",
):
    counts = {"long_answer_expanded": [], "long_answer_collapsed": []}
    for index, day in enumerate(days):
        session = sessions[index] if sessions else f"s{day}"
        conversation = conversations[index] if conversations else f"c{day}"
        counts["long_answer_expanded"].append(
            SessionDailyCount(
                date(2026, 11, day),
                kind,
                expanded,
                opportunities,
                (conversation,),
                session,
            )
        )
        counts["long_answer_collapsed"].append(
            SessionDailyCount(
                date(2026, 11, day),
                kind,
                folded,
                opportunities,
                (conversation,),
                session,
            )
        )
    return counts


def test_fake_exclusion_filters_populated_count_and_summary_fixtures():
    aggregate = DailyCount(date(2026, 11, 24), "coding", 2, 3, 1)
    assert FakeEventSource({"feature": [aggregate]}).daily_counts(
        "feature", date.min, date.max
    ) == [aggregate]
    summary = SessionSummary.model_construct(
        session_id=UUID("00000000-0000-4000-8000-000000000001"),
        timestamp=NOW,
    )
    source = FakeEventSource(
        {
            "long_answer_expanded": [
                SessionDailyCount(date(2026, 11, 24), "coding", 2, 3, ("c1",), "s1"),
                SessionDailyCount(date(2026, 11, 24), "coding", 1, 3, ("c2",), "s2"),
            ]
        },
        [summary],
    )
    assert source.daily_counts(
        "long_answer_expanded", date(2026, 11, 24), date(2026, 11, 24), ["s1"]
    ) == [DailyCount(date(2026, 11, 24), "coding", 1, 3, 1, ("c2",))]
    assert source.session_summaries(date.min, date.max, [str(summary.session_id)]) == []
    assert source.session_summaries(date.min, date.max) == [summary]


def test_evaluate_submit_and_repeat_are_deterministic_at_fixed_clock():
    counts = rows_for()
    first = make_engine(counts)
    second = make_engine(counts)
    offered = first.evaluate()
    repeated = second.evaluate()
    assert len(offered) == 1
    assert offered[0].source == Source.rule
    assert offered[0].type == Type1.dimension
    assert offered[0].change_policy == ChangePolicy.automatic
    assert offered[0].evidence.features[0].weight == 0.820335
    assert offered[0].model_dump(mode="json", by_alias=True) == repeated[0].model_dump(
        mode="json", by_alias=True
    )
    admitted = first.submit(offered[0], session_boundary=True)
    second_admission = second.submit(repeated[0], session_boundary=True)
    assert admitted.status == "admitted"
    assert admitted.decision.from_ == "folded"
    assert admitted.decision.to == "open"
    assert admitted.decision.reason == offered[0].reason
    assert (
        admitted.decision.evidence["features"]
        == offered[0].evidence.model_dump(mode="json")["features"]
    )
    assert admitted.decision.model_dump(mode="json", by_alias=True) == (
        second_admission.decision.model_dump(mode="json", by_alias=True)
    )
    reversed_counts = {
        feature: list(reversed(feature_rows))
        for feature, feature_rows in counts.items()
    }
    offset_engine = make_engine(
        reversed_counts,
        now=NOW.astimezone(timezone(timedelta(hours=-5))),
    )
    assert offset_engine.evaluate()[0].model_dump(mode="json", by_alias=True) == (
        offered[0].model_dump(mode="json", by_alias=True)
    )
    changed_evidence = make_engine(rows_for(expanded=19)).evaluate()[0]
    assert changed_evidence.id != offered[0].id


def test_gate_requires_minimum_occasions_conversations_and_nonzero_days():
    nineteen = rows_for(
        days=(23, 24), opportunities=10, expanded=9, conversations=("c23", "c24")
    )
    nineteen["long_answer_expanded"][0] = SessionDailyCount(
        date(2026, 11, 23), "coding", 9, 10, ("c23", "c23-extra"), "s23"
    )
    nineteen["long_answer_expanded"][-1] = SessionDailyCount(
        date(2026, 11, 24), "coding", 8, 9, ("c24",), "s24"
    )
    nineteen["long_answer_collapsed"][-1] = SessionDailyCount(
        date(2026, 11, 24), "coding", 0, 9, ("c24",), "s24"
    )
    assert make_engine(nineteen).evaluate() == []

    repeated_conversation = rows_for(conversations=("same", "same", "same"))
    assert make_engine(repeated_conversation).evaluate() == []

    two_conversations = rows_for(conversations=("first", "second", "second"))
    assert make_engine(two_conversations).evaluate() == []

    one_day = rows_for(days=(24,), opportunities=30)
    one_day["long_answer_expanded"][0] = SessionDailyCount(
        date(2026, 11, 24), "coding", 27, 30, ("c1", "c2", "c3"), "s24"
    )
    assert make_engine(one_day).evaluate() == []

    zero_day = rows_for(days=(22, 23, 24), opportunities=10, expanded=9)
    zero_day["long_answer_expanded"][0] = SessionDailyCount(
        date(2026, 11, 22), "coding", 0, 0, (), "s22"
    )
    zero_day["long_answer_collapsed"][0] = SessionDailyCount(
        date(2026, 11, 22), "coding", 0, 0, (), "s22"
    )
    zero_day["long_answer_expanded"][1] = SessionDailyCount(
        date(2026, 11, 23), "coding", 0, 0, (), "s23"
    )
    zero_day["long_answer_collapsed"][1] = SessionDailyCount(
        date(2026, 11, 23), "coding", 0, 0, (), "s23"
    )
    zero_day["long_answer_expanded"][2] = SessionDailyCount(
        date(2026, 11, 24), "coding", 18, 20, ("c1", "c2", "c3"), "s24"
    )
    zero_day["long_answer_collapsed"][2] = SessionDailyCount(
        date(2026, 11, 24), "coding", 0, 20, ("c1", "c2", "c3"), "s24"
    )
    assert make_engine(zero_day).evaluate() == []


def test_lead_uses_all_opportunities_and_actual_opposing_actions():
    six_of_ten = rows_for(
        days=(22, 24), expanded=6, opportunities=10, conversations=("c22", "c24")
    )
    six_of_ten["long_answer_expanded"][0] = SessionDailyCount(
        date(2026, 11, 22), "coding", 6, 10, ("c22", "c-extra"), "s22"
    )
    assert make_engine(six_of_ten).evaluate() == []

    both_directions = rows_for(days=(22, 24), expanded=10, folded=10, opportunities=10)
    assert make_engine(both_directions).evaluate() == []


def test_opposing_actions_on_latest_day_are_not_ignored():
    counts = rows_for(days=(20, 22, 24), expanded=18, folded=0, opportunities=20)
    counts["long_answer_collapsed"][-1] = SessionDailyCount(
        date(2026, 11, 24), "coding", 20, 20, ("c24",), "s24"
    )
    assert make_engine(counts).evaluate() == []


def test_store_reconstruction_preserves_undo_controls_exclusions_and_pace():
    counts = rows_for()
    store = MemoryStore()
    engine = make_engine(counts, store=store)
    decision = engine.submit(engine.evaluate()[0]).decision
    engine.undo(decision.id.root)

    rebuilt = make_engine(counts, store=store)
    assert rebuilt.state("coding")["long_answers"] == "folded"
    assert rebuilt.evaluate() == []
    rebuilt.set_explicit("long_answers", "open", "coding")
    rebuilt.set_lock("layout", True)
    rebuilt.freeze(True)
    rebuilt.exclude_session("s20")
    restored = make_engine(counts, store=store)
    assert restored.state("coding")["long_answers"] == "open"
    assert restored.state("writing")["long_answers"] == "folded"
    assert "s20" in store.excluded_sessions
    assert "layout" in store.locks and store.frozen


def test_automatic_pace_budget_survives_engine_reconstruction():
    counts = rows_for()
    store = MemoryStore()
    subject = make_engine(counts, store=store)
    assert subject.submit(subject.evaluate()[0]).status == "admitted"
    dimensions = {
        **DIMENSIONS,
        "another": {**DIMENSIONS["long_answers"], "id": "another"},
    }
    rebuilt = make_engine(counts, store=store, dimensions=dimensions)
    offered = proposal(
        dimension="another", identifier="00000000-0000-4000-8000-000000000005"
    )
    assert rebuilt.submit(offered).reason == "daily automatic pace limit reached"


def test_explicit_settings_are_kind_scoped_and_fall_back_to_global():
    engine = make_engine()
    engine.set_explicit("long_answers", "open", "coding")
    assert engine.state("coding")["long_answers"] == "open"
    assert engine.state("writing")["long_answers"] == "folded"
    engine.return_to_automatic("long_answers", "writing")
    assert engine.state("coding")["long_answers"] == "open"
    engine.set_explicit("long_answers", "open")
    assert engine.state("writing")["long_answers"] == "open"


def test_returning_one_kind_to_automatic_does_not_clear_another_kind():
    subject = make_engine(rows_for())
    subject.set_explicit("long_answers", "folded", "coding")
    subject.set_explicit("long_answers", "folded", "writing")
    subject.return_to_automatic("long_answers", "writing")
    assert subject.evaluate() == []
    assert subject.state("coding")["long_answers"] == "folded"


def test_kind_scoped_evaluation_does_not_pool_evidence_or_state():
    counts = rows_for(kind="coding")
    writing = rows_for(kind="writing", expanded=0, folded=18)
    counts["long_answer_expanded"].extend(writing["long_answer_expanded"])
    counts["long_answer_collapsed"].extend(writing["long_answer_collapsed"])
    proposals = make_engine(counts).evaluate()
    assert [(p.kind.value, p.to) for p in proposals] == [("coding", "open")]


def test_proposed_dimension_emits_rule_offer_and_keep_preserves_exact_offer():
    dimensions = {key: dict(value) for key, value in DIMENSIONS.items()}
    dimensions["long_answers"] = {
        **dimensions["long_answers"],
        "change_policy": "proposed",
    }
    subject = make_engine(rows_for(), dimensions=dimensions)
    offer = subject.evaluate("session-a")[0]
    assert offer.change_policy == ChangePolicy.proposed
    assert subject.evaluate("session-a")[0].id == offer.id
    restored = make_engine(rows_for(), store=subject.store, dimensions=dimensions)
    assert restored.evaluate("session-a")[0].id == offer.id
    changed = offer.model_copy(update={"reason": "caller mutation"})
    subject.submit(offer, session_id="session-a")
    offer.reason = "mutated after submission"
    admitted = subject.keep_proposal(changed.id.root, "session-a")
    assert admitted.status == "admitted"
    assert admitted.decision.reason == "Evidence supports open."
    assert (
        admitted.decision.evidence["features"]
        == changed.evidence.model_dump(mode="json")["features"]
    )
    assert subject.pending_notices() == [admitted.decision]
    subject.acknowledge(admitted.decision.id.root)
    assert subject.pending_notices()[0].status == Status.shown
    subject.keep(admitted.decision.id.root)
    assert subject.store.decisions[admitted.decision.id.root].status == Status.kept


def test_dismissed_proposal_uses_session_budget():
    dimensions = {key: dict(value) for key, value in DIMENSIONS.items()}
    dimensions["long_answers"] = {
        **dimensions["long_answers"],
        "change_policy": "proposed",
    }
    subject = make_engine(rows_for(), dimensions=dimensions)
    first = subject.evaluate("session-a")[0]
    assert subject.pending_proposals() == [first]
    subject.dismiss_proposal(first.id.root)
    assert subject.pending_proposals() == []
    assert subject.evaluate("session-a") == []
    next_session = subject.evaluate("session-b")[0]
    assert next_session.id != first.id


def test_hermes_proposal_never_applies_without_keep_and_offer_budget_retries():
    subject = make_engine()
    first = proposal(source=Source.hermes, policy=ChangePolicy.automatic)
    assert subject.submit(first, session_id="s1").status == "deferred"
    assert subject.state()["long_answers"] == "folded"
    assert subject.keep_proposal(first.id.root, "s1").status == "admitted"

    second = proposal(
        source=Source.hermes,
        policy=ChangePolicy.proposed,
        target="folded",
        identifier="00000000-0000-4000-8000-000000000002",
    )
    assert subject.submit(second, session_id="s1").status == "deferred"
    assert second.id.root not in subject.store.proposals
    assert subject.submit(second, session_id="s2").status == "deferred"
    assert subject.keep_proposal(second.id.root, "s2").status == "admitted"


def test_bad_target_evidence_and_resulting_state_are_rejected():
    subject = make_engine(rows_for())
    assert subject.submit(proposal(target="outside")).status == "rejected"
    malformed_json = (
        proposal()
        .model_dump_json(by_alias=True)
        .replace('"features":[]', '"features":[{"kind":"coding"}]')
    )

    class InvalidProposal:
        def model_dump_json(self, **_kwargs):
            return malformed_json

    assert subject.submit(InvalidProposal()).status == "rejected"
    invalid = make_engine(rows_for(), validator=lambda *_: False)
    assert invalid.submit(invalid.evaluate()[0]).status == "rejected"


def test_undo_uses_private_inverse_is_idempotent_and_cannot_override_explicit():
    subject = make_engine(rows_for())
    decision = subject.submit(subject.evaluate()[0]).decision
    decision.from_ = "outside"
    subject.undo(decision.id.root)
    assert subject.state("coding")["long_answers"] == "folded"
    subject.set_explicit("long_answers", "open", "coding")
    subject.undo(decision.id.root)
    assert subject.state("coding")["long_answers"] == "open"


@pytest.mark.parametrize("control", ["explicit", "lock", "freeze"])
def test_exclusion_does_not_bypass_explicit_or_locks(control):
    counts = rows_for()
    subject = make_engine(counts)
    decision = subject.submit(subject.evaluate()[0]).decision
    if control == "explicit":
        subject.set_explicit("long_answers", "open", "coding")
    elif control == "lock":
        subject.set_lock("layout", True)
    else:
        subject.freeze(True)
    assert subject.exclude_session("s20") == []
    assert subject.state("coding")["long_answers"] == "open"
    assert decision.status == Status.pending


def test_exclusion_reverts_only_unsupported_automatic_change():
    counts = rows_for(days=(20, 22, 24), expanded=18, opportunities=20)
    subject = make_engine(counts)
    decision = subject.submit(subject.evaluate()[0]).decision
    reverted = subject.exclude_session("s20")
    assert [item.id.root for item in reverted] == [decision.id.root]
    assert subject.state("coding")["long_answers"] == "folded"
    assert subject.store.decisions[decision.id.root].status == Status.reverted


def test_excluding_unrelated_session_does_not_revert_active_decision():
    subject = make_engine(rows_for())
    decision = subject.submit(subject.evaluate()[0]).decision
    assert subject.exclude_session("unrelated") == []
    assert subject.state("coding")["long_answers"] == "open"
    assert subject.store.decisions[decision.id.root].status == Status.pending


def test_exclusion_keeps_supported_opposite_value_and_person_kept_offer():
    counts = {"long_answer_expanded": [], "long_answer_collapsed": []}
    for day in (20, 22, 24):
        date_value = date(2026, 11, day)
        counts["long_answer_expanded"].extend(
            [
                SessionDailyCount(
                    date_value, "coding", 900, 1000, (f"guest-{day}",), "guest"
                ),
                SessionDailyCount(
                    date_value, "coding", 0, 20, (f"owner-{day}",), f"owner-{day}"
                ),
            ]
        )
        counts["long_answer_collapsed"].extend(
            [
                SessionDailyCount(
                    date_value, "coding", 0, 1000, (f"guest-{day}",), "guest"
                ),
                SessionDailyCount(
                    date_value, "coding", 18, 20, (f"owner-{day}",), f"owner-{day}"
                ),
            ]
        )
    subject = make_engine(counts)
    decision = subject.submit(subject.evaluate()[0]).decision
    reverted = subject.exclude_session("guest")
    assert [item.id.root for item in reverted] == [decision.id.root]
    assert subject.state("coding")["long_answers"] == "folded"

    proposal_store = MemoryStore()
    proposed_dims = {key: dict(value) for key, value in DIMENSIONS.items()}
    proposed_dims["long_answers"] = {
        **proposed_dims["long_answers"],
        "change_policy": "proposed",
    }
    kept = make_engine(counts, dimensions=proposed_dims, store=proposal_store)
    offer = proposal(source=Source.hermes, policy=ChangePolicy.proposed)
    kept.submit(offer, session_id="person-session")
    decision2 = kept.keep_proposal(offer.id.root, "person-session").decision
    assert kept.exclude_session("s20") == []
    assert kept.store.decisions[decision2.id.root].status == Status.pending
    assert decision.status == Status.pending


def test_automatic_pace_and_boundary_checks_follow_gate():
    counts = rows_for()
    subject = make_engine(counts)
    offered = subject.evaluate()[0]
    assert subject.evaluate(session_boundary=False) == []
    assert subject.submit(offered, session_boundary=False).status == "deferred"
    assert subject.submit(offered).status == "admitted"
    no_evidence = {
        **DIMENSIONS["long_answers"],
        "id": "no_evidence",
        "evidence": {
            "folded": {"for": "missing_a", "against": "missing_b"},
            "open": {"for": "missing_b", "against": "missing_a"},
        },
    }
    dimensions = {
        **DIMENSIONS,
        "no_evidence": no_evidence,
        "another": {**DIMENSIONS["long_answers"], "id": "another"},
    }
    second = proposal(
        dimension="no_evidence",
        identifier="00000000-0000-4000-8000-000000000003",
    )
    subject.dimensions = dimensions
    assert subject.submit(second).reason == "evidence gate is not met"
    pace_limited = proposal(
        dimension="another",
        identifier="00000000-0000-4000-8000-000000000004",
    )
    assert subject.submit(pace_limited).reason == "daily automatic pace limit reached"


def test_scale_moves_one_step_and_requires_fresh_evidence_for_each_step():
    dimension = {
        "id": "density",
        "version": 1,
        "area": "layout",
        "values": ["compact", "comfortable", "spacious"],
        "default": "compact",
        "scope": "kind",
        "change_policy": "automatic",
        "scale": True,
        "evidence": {
            "compact": {"for": "compact", "against": "comfortable"},
            "comfortable": {"for": "comfortable", "against": "spacious"},
            "spacious": {"for": "spacious", "against": "comfortable"},
        },
        "gate": {
            "occasions": 20,
            "conversations": 3,
            "days": 2,
            "lead": {"for": 0.7, "against": 0.1},
        },
        "window_days": 60,
        "half_life_days": 14,
    }
    counts = {"compact": [], "comfortable": [], "spacious": []}
    for day in (20, 22, 24):
        for feature, happened in (("compact", 0), ("comfortable", 0), ("spacious", 18)):
            counts[feature].append(
                SessionDailyCount(
                    date(2026, 11, day),
                    "coding",
                    happened,
                    20,
                    (f"c{day}",),
                    f"s{day}",
                )
            )
    dimensions = {"density": dimension}
    store = MemoryStore()
    subject = make_engine(counts, store=store, dimensions=dimensions)
    first = subject.evaluate()[0]
    assert first.to == "comfortable"
    assert subject.submit(first).status == "admitted"
    assert make_engine(counts, store=store, dimensions=dimensions).evaluate() == []

    for day in (25, 26):
        for feature, happened in (("compact", 0), ("comfortable", 0), ("spacious", 18)):
            counts[feature].append(
                SessionDailyCount(
                    date(2026, 11, day),
                    "coding",
                    happened,
                    20,
                    (f"fresh-{day}", "fresh-extra") if day == 25 else (f"fresh-{day}",),
                    f"fresh-{day}",
                )
            )
    fresh = make_engine(
        counts,
        store=store,
        dimensions=dimensions,
        now=datetime(2026, 11, 26, tzinfo=timezone.utc),
    )
    assert fresh.evaluate()[0].to == "spacious"


@pytest.mark.parametrize(
    "statement",
    [
        "import api",
        "import api.app",
        "import api.chat",
        "import api.memory",
        "import web",
        "import web.app",
        "import memory",
        "import Hermes",
        "import api as renamed",
        "import safe.memory as renamed",
        "from local.hermes import client",
        "from api import app",
        "from api import chat",
        "from api import memory",
        "from package import memory as renamed",
        "import api.memory",
    ],
)
def test_import_guard_catches_forbidden_roots_recursively(tmp_path, statement):
    nested = tmp_path / "nested"
    nested.mkdir()
    (nested / "bad.py").write_text(f"if False:\n    {statement}\n")
    assert forbidden_engine_imports(tmp_path)


def test_import_guard_passes_engine_sources():
    import implicity_engine

    assert forbidden_engine_imports(Path(implicity_engine.__file__).parent) == []


def test_dimension_loader_supports_json_files_only_and_rejects_bad_values(tmp_path):
    (tmp_path / "dimension.json").write_text(
        (
            Path(__file__).parents[3] / "contracts/dimensions/long_answers.json"
        ).read_text()
    )
    (tmp_path / "ignored.yaml").write_text("id: ignored")
    assert set(load_dimensions(tmp_path)) == {"long_answers"}
    (tmp_path / "bad.json").write_text('{"id":"bad","values":[]}')
    with pytest.raises(ValueError):
        load_dimensions(tmp_path)
