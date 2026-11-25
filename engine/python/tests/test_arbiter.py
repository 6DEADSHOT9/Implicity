from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from threading import Barrier, Lock
from uuid import UUID, uuid5

import pytest
from implicity_contracts.generated import (
    ChangePolicy,
    DecisionId,
    Kind,
    Proposal,
    ProposalId,
    Source,
    Status,
    Type1,
)
from implicity_engine import (
    DailyCount,
    Engine,
    Evidence,
    FakeEventSource,
    InMemoryStore,
    SessionContext,
    StateData,
    load_dimension,
)

TODAY = date(2026, 11, 25)
STAMP = datetime(2026, 11, 25, 12, tzinfo=timezone.utc)
LOCAL = timezone(timedelta(hours=5, minutes=30))
TEST_NAMESPACE = UUID("c13961b4-8166-4d9b-93ba-01b958e0c3a8")


class FixedTestIds:
    def __init__(self):
        self.proposals = 0
        self.decisions = 0

    def proposal_id(self) -> ProposalId:
        self.proposals += 1
        return ProposalId(root=f"prop_{uuid5(TEST_NAMESPACE, f'p{self.proposals}')}")

    def decision_id(self) -> DecisionId:
        self.decisions += 1
        return DecisionId(root=f"dec_{uuid5(TEST_NAMESPACE, f'd{self.decisions}')}")


class DirectStore:
    def __init__(self):
        self.revision = 0
        self.data = StateData()
        self.reject = False
        self.reads = 0

    def read(self):
        self.reads += 1
        return self.revision, self.data

    def commit(self, revision, state):
        if self.reject or revision != self.revision:
            return False
        self.data = deepcopy(state)
        self.revision += 1
        return True


def dimension_file(tmp_path: Path, *, scale: bool = False) -> Path:
    path = tmp_path / "dimension.yaml"
    values = "[compact, comfortable, spacious]" if scale else "[folded, open]"
    evidence = (
        "{spacious: {for: scroll, against: misses}, "
        "comfortable: {for: comfort, against: misses}, "
        "compact: {for: misses, against: scroll}}"
        if scale
        else "{open: {for: expanded, against: collapsed}, "
        "folded: {for: collapsed, against: expanded}}"
    )
    path.write_text(
        f"id: {'density' if scale else 'long_answers'}\nversion: 1\narea: layout\n"
        f"values: {values}\ndefault: {'compact' if scale else 'folded'}\n"
        f"scope: kind\nchange_policy: automatic\n"
        f"scale: {'true' if scale else 'false'}\n"
        f"occasion: seen\nevidence: {evidence}\n"
        "gate: {occasions: 1, conversations: 1, days: 1, "
        "lead: {for: 0.7, against: 0.1}}\n"
        "window_days: 60\nhalf_life_days: 14\n"
    )
    return path


class FixedClock:
    def __init__(self, value: datetime):
        self.value = value
        self.calls = 0

    def now(self) -> datetime:
        self.calls += 1
        return self.value


def make_proposal(to: str = "open", *, policy: str = "automatic") -> Proposal:
    return Proposal(
        id=ProposalId(root="prop_11111111-1111-4111-8111-111111111111"),
        source=Source.rule if policy == "automatic" else Source.person,
        dimension="long_answers",
        kind=Kind.coding,
        to=to,
        reason="evidence",
        evidence={"features": [], "occasions": 1, "conversations": 1, "days": 1},
        payload={},
        change_policy=ChangePolicy(policy),
        type=Type1.dimension,
    )


def engine_for(tmp_path: Path, *, store=None, clock=None):
    source = FakeEventSource(
        {
            "seen": [(DailyCount(TODAY, "coding", 0, 1, frozenset({"c1"})), "s")],
            "expanded": [(DailyCount(TODAY, "coding", 9, 10, frozenset({"c1"})), "s")],
            "collapsed": [(DailyCount(TODAY, "coding", 1, 10, frozenset({"c1"})), "s")],
        },
        [],
    )
    return Engine(
        [load_dimension(dimension_file(tmp_path))],
        source,
        store or InMemoryStore(),
        clock or FixedClock(STAMP),
        FixedTestIds(),
    )


def test_automatic_admission_notice_acknowledge_keep_and_undo(tmp_path: Path) -> None:
    engine = engine_for(tmp_path)
    session = SessionContext("session-1", True)
    proposal = engine.evaluate(session)[0]
    assert engine.submit(proposal, session).status == "admitted"
    notice = engine.pending_notices()[0]
    assert notice.status is Status.pending
    assert {row["id"] for row in notice.evidence["features"]} == {
        "seen",
        "expanded",
        "collapsed",
    }
    assert engine.keep(str(notice.id.root)).status == "rejected"
    engine.acknowledge(str(notice.id.root))
    assert engine.pending_notices()[0].status is Status.shown
    assert engine.keep(str(notice.id.root)).status == "admitted"
    assert engine.undo(str(notice.id.root)).status == "admitted"
    assert engine.undo(str(notice.id.root)).status == "rejected"
    assert engine.state("coding").values["long_answers"] == "folded"
    assert engine.set_explicit("long_answers", "open", "coding").status == "admitted"
    assert engine.return_to_automatic("long_answers", "coding").status == "admitted"


def test_automatic_checks_boundary_first_and_controls_ignore_pace(
    tmp_path: Path,
) -> None:
    engine = engine_for(tmp_path)
    engine.set_lock("layout", True)
    assert (
        engine.submit(make_proposal(), SessionContext("s", False)).status == "deferred"
    )
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "rejected"
    )
    wrong_policy = make_proposal().model_copy(
        update={"change_policy": ChangePolicy.proposed}
    )
    assert engine.submit(wrong_policy, SessionContext("s", True)).status == "rejected"
    invalid_value = make_proposal().model_copy(update={"to": "unknown"})
    assert engine.submit(invalid_value, SessionContext("s", True)).status == "rejected"
    assert engine.set_explicit("long_answers", "open", "coding").status == "rejected"
    engine.set_lock("layout", False)
    engine.freeze(True)
    assert engine.set_explicit("long_answers", "open", "coding").status == "rejected"
    engine.freeze(False)
    assert engine.set_explicit("long_answers", "open", "coding").status == "admitted"
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "rejected"
    )


def test_boundary_precedes_unknown_dimension_and_other_validity_checks(
    tmp_path: Path,
) -> None:
    store = DirectStore()
    engine = engine_for(tmp_path, store=store)
    unknown = make_proposal().model_copy(update={"dimension": "not_loaded"})
    assert engine.submit(unknown, SessionContext("s", False)).status == "deferred"
    assert store.reads == 0
    assert engine.submit(unknown, SessionContext("s", True)).status == "rejected"
    assert store.reads == 0
    assert engine.set_explicit("not_loaded", "open", "coding").status == "rejected"


def test_undo_rejects_an_inverse_no_longer_allowed_by_dimension(tmp_path: Path) -> None:
    path = dimension_file(tmp_path)
    source = engine_for(tmp_path).source
    store = InMemoryStore()
    clock = FixedClock(STAMP)
    first_engine = Engine([load_dimension(path)], source, store, clock, FixedTestIds())
    assert (
        first_engine.submit(make_proposal(), SessionContext("s", True)).status
        == "admitted"
    )
    decision_id = str(first_engine.pending_notices()[0].id.root)
    dimension_text = path.read_text()
    dimension_text = dimension_text.replace("values: [folded, open]", "values: [open]")
    dimension_text = dimension_text.replace("default: folded", "default: open")
    dimension_text = dimension_text.replace(
        ", folded: {for: collapsed, against: expanded}", ""
    )
    path.write_text(dimension_text)
    second_engine = Engine([load_dimension(path)], source, store, clock, FixedTestIds())
    assert second_engine.undo(decision_id).status == "rejected"
    assert second_engine.state("coding").values["long_answers"] == "open"


def test_person_controls_can_change_after_the_automatic_pace_slot_is_used(
    tmp_path: Path,
) -> None:
    engine = engine_for(tmp_path)
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "admitted"
    )
    assert engine.set_explicit("long_answers", "folded", "coding").status == "admitted"
    assert engine.set_explicit("long_answers", "open", "coding").status == "admitted"


def test_undo_only_active_and_permanently_blocks_value(tmp_path: Path) -> None:
    clock = FixedClock(STAMP)
    engine = engine_for(tmp_path, clock=clock)

    def evidence(day: date, toward: str) -> None:
        expanded, collapsed = (9, 1) if toward == "open" else (1, 9)
        engine.source.counts["seen"] = [
            (DailyCount(day, "coding", 0, 1, frozenset({f"{day}-c"})), "s")
        ]
        engine.source.counts["expanded"] = [
            (DailyCount(day, "coding", expanded, 10, frozenset({f"{day}-c"})), "s")
        ]
        engine.source.counts["collapsed"] = [
            (DailyCount(day, "coding", collapsed, 10, frozenset({f"{day}-c"})), "s")
        ]

    engine.submit(make_proposal("open"), SessionContext("s", True))
    first = str(engine.pending_notices()[0].id.root)
    clock.value += timedelta(days=1)
    evidence(clock.value.date(), "folded")
    engine.submit(make_proposal("folded"), SessionContext("s2", True))
    second = str(engine.pending_notices()[-1].id.root)
    clock.value += timedelta(days=1)
    evidence(clock.value.date(), "open")
    engine.submit(make_proposal("open"), SessionContext("s3", True))
    third = str(engine.pending_notices()[-1].id.root)
    assert engine.undo(first).status == "rejected"
    assert engine.undo(second).status == "rejected"
    assert engine.undo(third).status == "admitted"
    assert engine.undone_values("coding", "long_answers") == {"open"}
    assert engine.return_to_automatic("long_answers", "coding").status == "admitted"
    assert engine.state("coding").values["long_answers"] == "folded"
    clock.value += timedelta(days=90)
    evidence(clock.value.date(), "open")
    assert engine.evaluate(SessionContext("s4", True)) == []
    assert engine.set_explicit("long_answers", "open", "coding").status == "admitted"


def test_second_same_day_admission_is_rejected_for_unchanged_value(
    tmp_path: Path,
) -> None:
    clock = FixedClock(STAMP)
    store = InMemoryStore()
    first = engine_for(tmp_path, store=store, clock=clock)
    second = engine_for(tmp_path, store=store, clock=clock)
    assert (
        first.submit(make_proposal(), SessionContext("s1", True)).status == "admitted"
    )
    assert (
        second.submit(make_proposal(), SessionContext("s2", True)).status == "rejected"
    )
    assert clock.calls == 2


def test_a_second_distinct_automatic_change_is_deferred_that_day(
    tmp_path: Path,
) -> None:
    first_path = dimension_file(tmp_path)
    second_path = tmp_path / "second.yaml"
    second_path.write_text(first_path.read_text().replace("long_answers", "reasoning"))
    source = engine_for(tmp_path).source
    engine = Engine(
        [load_dimension(first_path), load_dimension(second_path)],
        source,
        InMemoryStore(),
        FixedClock(STAMP),
        FixedTestIds(),
    )
    proposals = engine.evaluate(SessionContext("s", True))
    assert len(proposals) == 2
    assert engine.submit(proposals[0], SessionContext("s", True)).status == "admitted"
    assert engine.submit(proposals[1], SessionContext("s", True)).status == "deferred"


def test_replaying_an_applied_proposal_does_not_spend_next_days_pace(
    tmp_path: Path,
) -> None:
    clock = FixedClock(STAMP)
    engine = engine_for(tmp_path, clock=clock)
    proposal = make_proposal()
    assert engine.submit(proposal, SessionContext("s1", True)).status == "admitted"
    clock.value += timedelta(days=1)
    assert engine.submit(proposal, SessionContext("s2", True)).status == "rejected"
    tomorrow = TODAY + timedelta(days=1)
    engine.source.counts.update(
        {
            "seen": [(DailyCount(tomorrow, "coding", 0, 1, frozenset({"c2"})), "s2")],
            "expanded": [
                (DailyCount(tomorrow, "coding", 1, 10, frozenset({"c2"})), "s2")
            ],
            "collapsed": [
                (DailyCount(tomorrow, "coding", 9, 10, frozenset({"c2"})), "s2")
            ],
        }
    )
    assert (
        engine.submit(make_proposal("folded"), SessionContext("s3", True)).status
        == "admitted"
    )


def test_pace_uses_the_clock_local_day_at_midnight(tmp_path: Path) -> None:
    clock = FixedClock(datetime(2026, 11, 25, 23, 59, 59, tzinfo=LOCAL))
    engine = engine_for(tmp_path, clock=clock)
    assert (
        engine.submit(make_proposal(), SessionContext("s1", True)).status == "admitted"
    )
    clock.value = datetime(2026, 11, 26, 0, 0, 1, tzinfo=LOCAL)
    engine.source.counts["expanded"] = [
        (DailyCount(TODAY + timedelta(days=1), "coding", 1, 10, frozenset({"c1"})), "s")
    ]
    engine.source.counts["collapsed"] = [
        (DailyCount(TODAY + timedelta(days=1), "coding", 9, 10, frozenset({"c1"})), "s")
    ]
    assert (
        engine.submit(make_proposal("folded"), SessionContext("s2", True)).status
        == "admitted"
    )
    clock.value = datetime(2026, 11, 26, 22, 0, tzinfo=LOCAL)
    engine.source.counts["expanded"] = [
        (DailyCount(TODAY + timedelta(days=1), "coding", 9, 10, frozenset({"c1"})), "s")
    ]
    engine.source.counts["collapsed"] = [
        (DailyCount(TODAY + timedelta(days=1), "coding", 1, 10, frozenset({"c1"})), "s")
    ]
    assert (
        engine.submit(make_proposal(), SessionContext("s3", True)).status == "deferred"
    )


def test_scale_effective_changes_reset_freshness_only_when_value_changes(
    tmp_path: Path,
) -> None:
    rows = {
        feature: [
            (
                DailyCount(TODAY, "coding", happened, possible, frozenset({"c1"})),
                "s1",
            )
        ]
        for feature, happened, possible in (
            ("seen", 0, 1),
            ("scroll", 9, 10),
            ("misses", 1, 10),
            ("comfort", 8, 10),
        )
    }
    clock = FixedClock(STAMP)
    source = FakeEventSource(rows, [])
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        source,
        InMemoryStore(),
        clock,
        FixedTestIds(),
    )
    assert engine.set_explicit("density", "spacious", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    clock.value += timedelta(days=1)
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.state("coding").values["density"] == "compact"
    assert engine.freshness_cutoff("coding", "density") == TODAY + timedelta(days=1)
    source.counts = {
        feature: [
            (
                DailyCount(
                    clock.value.date(), "coding", happened, possible, frozenset({"c2"})
                ),
                "s2",
            )
        ]
        for feature, happened, possible in (
            ("seen", 0, 1),
            ("scroll", 9, 10),
            ("misses", 1, 10),
            ("comfort", 8, 10),
        )
    }
    assert engine.evaluate(SessionContext("s1", True)) == []
    clock.value += timedelta(days=1)
    source.counts = {
        feature: [
            (
                DailyCount(
                    clock.value.date(), "coding", happened, possible, frozenset({"c2"})
                ),
                "s2",
            )
        ]
        for feature, happened, possible in (
            ("seen", 0, 1),
            ("scroll", 9, 10),
            ("misses", 1, 10),
            ("comfort", 8, 10),
        )
    }
    assert len(engine.evaluate(SessionContext("s2", True))) == 1


def test_scale_does_not_set_freshness_when_effective_value_is_unchanged(
    tmp_path: Path,
) -> None:
    clock = FixedClock(STAMP)
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource({}, []),
        InMemoryStore(),
        clock,
        FixedTestIds(),
    )
    assert engine.set_explicit("density", "compact", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") is None
    clock.value += timedelta(days=1)
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") is None


def test_global_scale_change_refreshes_only_kinds_whose_value_changed(
    tmp_path: Path,
) -> None:
    day2 = TODAY + timedelta(days=1)
    rows = {
        "seen": [
            (DailyCount(day2, kind, 0, 1, frozenset({f"{kind}-c"})), "s")
            for kind in ("coding", "writing")
        ],
        "scroll": [
            (DailyCount(day2, kind, 9, 10, frozenset({f"{kind}-c"})), "s")
            for kind in ("coding", "writing")
        ],
        "misses": [
            (DailyCount(day2, kind, 1, 10, frozenset({f"{kind}-c"})), "s")
            for kind in ("coding", "writing")
        ],
        "comfort": [
            (DailyCount(day2, kind, 8, 10, frozenset({f"{kind}-c"})), "s")
            for kind in ("coding", "writing")
        ],
    }
    clock = FixedClock(STAMP)
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource(rows, []),
        InMemoryStore(),
        clock,
        FixedTestIds(),
    )
    assert engine.set_explicit("density", "spacious", "coding").status == "admitted"
    clock.value += timedelta(days=1)
    assert engine.set_explicit("density", "comfortable").status == "admitted"
    assert engine.state("coding").values["density"] == "spacious"
    assert engine.state("writing").values["density"] == "comfortable"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    assert engine.freshness_cutoff("writing", "density") == day2
    assert engine.evaluate(SessionContext("s", True)) == []
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.state("coding").values["density"] == "comfortable"
    assert engine.freshness_cutoff("coding", "density") == day2


def test_evaluate_submits_scale_step_with_full_judged_evidence(tmp_path: Path) -> None:
    clock = FixedClock(STAMP)
    rows = {
        feature: [
            (
                DailyCount(TODAY, "coding", happened, possible, frozenset({"c1"})),
                "s1",
            )
        ]
        for feature, happened, possible in (
            ("seen", 0, 1),
            ("scroll", 9, 10),
            ("misses", 1, 10),
            ("comfort", 8, 10),
        )
    }
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource(rows, []),
        InMemoryStore(),
        clock,
        FixedTestIds(),
    )
    proposal = engine.evaluate(SessionContext("s1", True))[0]
    assert proposal.id == FixedTestIds().proposal_id()
    twin = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource(rows, []),
        InMemoryStore(),
        FixedClock(STAMP),
        FixedTestIds(),
    )
    twin_proposal = twin.evaluate(SessionContext("s1", True))[0]
    assert twin_proposal == proposal
    assert proposal.to == "comfortable"
    assert proposal.evidence.model_extra["judged_value"] == "spacious"
    assert (
        engine.submit(
            proposal.model_copy(update={"to": "spacious"}), SessionContext("s1", True)
        ).status
        == "rejected"
    )
    verdict = engine.submit(proposal, SessionContext("s1", True))
    twin_verdict = twin.submit(twin_proposal, SessionContext("s1", True))
    assert verdict.status == "admitted"
    assert verdict.decision.id == FixedTestIds().decision_id()
    assert twin_verdict.decision == verdict.decision
    assert verdict.decision.evidence["judged_value"] == "spacious"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    assert engine.evaluate(SessionContext("s1", True)) == []


def test_scale_keeps_the_previous_cutoff_when_explicit_and_learned_values_match(
    tmp_path: Path,
) -> None:
    clock = FixedClock(STAMP)
    rows = {
        feature: [
            (DailyCount(TODAY, "coding", happened, possible, frozenset({"c1"})), "s1")
        ]
        for feature, happened, possible in (
            ("seen", 0, 1),
            ("scroll", 9, 10),
            ("misses", 1, 10),
            ("comfort", 8, 10),
        )
    }
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource(rows, []),
        InMemoryStore(),
        clock,
        FixedTestIds(),
    )
    proposal = engine.evaluate(SessionContext("s", True))[0]
    assert engine.submit(proposal, SessionContext("s", True)).status == "admitted"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    clock.value += timedelta(days=1)
    assert engine.set_explicit("density", "comfortable", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    clock.value += timedelta(days=1)
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.state("coding").values["density"] == "comfortable"
    assert engine.freshness_cutoff("coding", "density") == TODAY


def test_scale_undo_sets_cutoff_on_the_undo_day(tmp_path: Path) -> None:
    clock = FixedClock(STAMP)
    rows = {
        feature: [
            (DailyCount(TODAY, "coding", happened, possible, frozenset({"c1"})), "s1")
        ]
        for feature, happened, possible in (
            ("seen", 0, 1),
            ("scroll", 9, 10),
            ("misses", 1, 10),
            ("comfort", 8, 10),
        )
    }
    source = FakeEventSource(rows, [])
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        source,
        InMemoryStore(),
        clock,
        FixedTestIds(),
    )
    proposal = engine.evaluate(SessionContext("s", True))[0]
    verdict = engine.submit(proposal, SessionContext("s", True))
    decision_id = str(verdict.decision.id.root)
    clock.value += timedelta(days=1)
    assert engine.undo(decision_id).status == "admitted"
    assert engine.freshness_cutoff("coding", "density") == clock.value.date()
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.evaluate(SessionContext("s", True)) == []


def test_decision_evidence_is_the_admission_snapshot_and_replays_its_gate(
    tmp_path: Path,
) -> None:
    engine = engine_for(tmp_path)
    proposal = engine.evaluate(SessionContext("s", True))[0]
    engine.source.counts["expanded"] = [
        (DailyCount(TODAY, "coding", 8, 10, frozenset({"c1"})), "s")
    ]
    verdict = engine.submit(proposal, SessionContext("s", True))
    snapshot = Evidence.from_dict(verdict.decision.evidence)
    assert snapshot.features["expanded"][0].happened == 8
    result = load_dimension(dimension_file(tmp_path)).gate.check(
        snapshot.judged_value,
        "coding",
        snapshot.evaluation_day,
        60,
        14,
        "seen",
        snapshot.features,
        {"for": "expanded", "against": "collapsed"},
    )
    assert result.met
    assert result.for_rate == pytest.approx(0.8)


def test_recomputed_gate_can_reject_a_stale_proposal(tmp_path: Path) -> None:
    engine = engine_for(tmp_path)
    proposal = engine.evaluate(SessionContext("s", True))[0]
    engine.source.counts["expanded"] = [
        (DailyCount(TODAY, "coding", 6, 10, frozenset({"c1"})), "s")
    ]
    assert engine.submit(proposal, SessionContext("s", True)).status == "rejected"


def test_single_scale_admission_commit_contains_value_decision_pace_and_cutoff(
    tmp_path: Path,
) -> None:
    class RecordingStore(InMemoryStore):
        def __init__(self):
            super().__init__()
            self.writes = []

        def commit(self, revision, state):
            self.writes.append(deepcopy(state))
            return super().commit(revision, state)

    rows = {
        feature: [
            (DailyCount(TODAY, "coding", happened, possible, frozenset({"c1"})), "s")
        ]
        for feature, happened, possible in (
            ("seen", 0, 1),
            ("scroll", 9, 10),
            ("misses", 1, 10),
            ("comfort", 8, 10),
        )
    }
    store = RecordingStore()
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource(rows, []),
        store,
        FixedClock(STAMP),
        FixedTestIds(),
    )
    proposal = engine.evaluate(SessionContext("s", True))[0]
    assert engine.submit(proposal, SessionContext("s", True)).status == "admitted"
    assert len(store.writes) == 1
    written = store.writes[0]
    assert written.learned[("density", "coding")] == "comfortable"
    assert written.active[("density", "coding")] == str(
        engine.pending_notices()[0].id.root
    )
    assert written.pace == {TODAY}
    assert written.freshness[("density", "coding")] == TODAY


def test_global_dimension_aggregates_kind_counts_and_updates_all_kinds(
    tmp_path: Path,
) -> None:
    path = dimension_file(tmp_path)
    path.write_text(path.read_text().replace("scope: kind", "scope: global"))
    source = FakeEventSource(
        {
            feature: [
                (
                    DailyCount(
                        TODAY, kind, happened, possible, frozenset({conversation})
                    ),
                    session,
                )
                for kind, happened, possible, conversation, session in (
                    ("coding", happened, possible, "c1", "s1"),
                    ("writing", happened, possible, "w1", "s2"),
                )
            ]
            for feature, happened, possible in (
                ("seen", 0, 1),
                ("expanded", 9, 10),
                ("collapsed", 1, 10),
            )
        },
        [],
    )
    engine = Engine(
        [load_dimension(path)],
        source,
        InMemoryStore(),
        FixedClock(STAMP),
        FixedTestIds(),
    )
    assert engine.set_explicit("long_answers", "open", "coding").status == "rejected"
    proposal = engine.evaluate(SessionContext("s", True))[0]
    assert proposal.kind is None
    decision = engine.submit(proposal, SessionContext("s", True)).decision
    assert decision is not None
    assert engine.pending_notices()[0] == decision
    evidence = Evidence.from_dict(decision.evidence)
    assert {row.kind for row in evidence.features["seen"]} == {"coding", "writing"}
    replay = load_dimension(path).gate.check(
        evidence.judged_value,
        None,
        evidence.evaluation_day,
        60,
        14,
        "seen",
        evidence.features,
        {"for": "expanded", "against": "collapsed"},
    )
    assert replay.met
    assert engine.state("coding").values["long_answers"] == "open"
    assert engine.state("writing").values["long_answers"] == "open"


def test_global_evaluation_rejects_invalid_per_kind_rates_before_combining(
    tmp_path: Path,
) -> None:
    path = dimension_file(tmp_path)
    path.write_text(path.read_text().replace("scope: kind", "scope: global"))
    source = FakeEventSource(
        {
            "seen": [
                (DailyCount(TODAY, "coding", 0, 1, frozenset({"c1"})), "s1"),
                (DailyCount(TODAY, "writing", 0, 1, frozenset({"w1"})), "s2"),
            ],
            "expanded": [
                (DailyCount(TODAY, "coding", 2, 1, frozenset({"c1"})), "s1"),
                (DailyCount(TODAY, "writing", 7, 9, frozenset({"w1"})), "s2"),
            ],
            "collapsed": [
                (DailyCount(TODAY, "coding", 1, 10, frozenset({"c1"})), "s1"),
                (DailyCount(TODAY, "writing", 1, 10, frozenset({"w1"})), "s2"),
            ],
        },
        [],
    )
    engine = Engine(
        [load_dimension(path)],
        source,
        InMemoryStore(),
        FixedClock(STAMP),
        FixedTestIds(),
    )
    with pytest.raises(ValueError, match="invalid feature rate"):
        engine.evaluate(SessionContext("s", True))


def test_stage1_ignores_and_rejects_custom_kinds(tmp_path: Path) -> None:
    custom = "kind_11111111-1111-4111-8111-111111111111"
    source = FakeEventSource(
        {
            "seen": [(DailyCount(TODAY, custom, 0, 1, frozenset({"c1"})), "s")],
            "expanded": [(DailyCount(TODAY, custom, 9, 10, frozenset({"c1"})), "s")],
            "collapsed": [(DailyCount(TODAY, custom, 1, 10, frozenset({"c1"})), "s")],
        },
        [],
    )
    engine = Engine(
        [load_dimension(dimension_file(tmp_path))],
        source,
        InMemoryStore(),
        FixedClock(STAMP),
        FixedTestIds(),
    )
    assert engine.evaluate(SessionContext("s", True)) == []
    assert (
        engine.submit(
            make_proposal().model_copy(update={"kind": custom}),
            SessionContext("s", True),
        ).status
        == "rejected"
    )
    assert engine.set_explicit("long_answers", "open", custom).status == "rejected"
    assert engine.return_to_automatic("long_answers", custom).status == "rejected"


def test_failed_atomic_store_write_leaves_no_partial_transition(tmp_path: Path) -> None:
    class FailingStore(InMemoryStore):
        def commit(self, *args, **kwargs):
            raise OSError("disk unavailable")

    engine = engine_for(tmp_path, store=FailingStore())
    with pytest.raises(OSError, match="disk unavailable"):
        engine.submit(make_proposal(), SessionContext("s", True))
    assert engine.state("coding").values["long_answers"] == "folded"
    assert engine.pending_notices() == []


def test_every_transition_is_detached_from_a_host_stores_read_object(
    tmp_path: Path,
) -> None:
    store = DirectStore()
    engine = engine_for(tmp_path, store=store)

    before = deepcopy(store.data)
    assert engine.state("coding").values["long_answers"] == "folded"
    store.reject = True
    assert engine.set_explicit("long_answers", "open", "coding").status == "deferred"
    assert store.data == before

    store.reject = False
    assert engine.set_explicit("long_answers", "open", "coding").status == "admitted"
    before = deepcopy(store.data)
    store.reject = True
    assert engine.return_to_automatic("long_answers", "coding").status == "deferred"
    assert store.data == before
    with pytest.raises(RuntimeError, match="state changed"):
        engine.set_lock("layout", True)
    assert store.data == before
    with pytest.raises(RuntimeError, match="state changed"):
        engine.freeze(True)
    assert store.data == before

    store.reject = False
    assert engine.return_to_automatic("long_answers", "coding").status == "admitted"
    before = deepcopy(store.data)
    store.reject = True
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "deferred"
    )
    assert store.data == before

    store.reject = False
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "admitted"
    )
    decision_id = str(engine.pending_notices()[0].id.root)
    before = deepcopy(store.data)
    store.reject = True
    with pytest.raises(RuntimeError, match="state changed"):
        engine.acknowledge(decision_id)
    assert store.data == before

    store.reject = False
    engine.acknowledge(decision_id)
    before = deepcopy(store.data)
    store.reject = True
    assert engine.keep(decision_id).status == "deferred"
    assert store.data == before
    store.reject = False
    assert engine.keep(decision_id).status == "admitted"
    before = deepcopy(store.data)
    store.reject = True
    assert engine.undo(decision_id).status == "deferred"
    assert store.data == before


def test_racing_store_conflict_defers_without_mutation(tmp_path: Path) -> None:
    store = InMemoryStore()
    engine = engine_for(tmp_path, store=store)
    store.conflict_next_write = True
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "deferred"
    )
    assert engine.state("coding").values["long_answers"] == "folded"
    assert engine.pending_notices() == []


def test_concurrent_admissions_cannot_reserve_the_same_pace_slot(
    tmp_path: Path,
) -> None:
    class RacingStore(InMemoryStore):
        def __init__(self):
            super().__init__()
            self.barrier = Barrier(2)
            self.read_lock = Lock()
            self.reads = 0

        def read(self):
            snapshot = super().read()
            with self.read_lock:
                wait = self.reads < 2
                self.reads += 1
            if wait:
                self.barrier.wait()
            return snapshot

    store = RacingStore()
    first = engine_for(tmp_path, store=store)
    second = engine_for(tmp_path, store=store)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda engine: engine.submit(
                    make_proposal(), SessionContext("racing", True)
                ).status,
                (first, second),
            )
        )
    assert sorted(results) == ["admitted", "deferred"]


def test_unanswered_notice_stays_in_effect_and_undoable(tmp_path: Path) -> None:
    clock = FixedClock(STAMP)
    engine = engine_for(tmp_path, clock=clock)
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "admitted"
    )
    decision_id = str(engine.pending_notices()[0].id.root)
    engine.acknowledge(decision_id)
    clock.value += timedelta(days=7)
    assert engine.state("coding").values["long_answers"] == "open"
    assert engine.pending_notices()[0].status is Status.shown
    assert engine.undo(decision_id).status == "admitted"


def test_late_acknowledge_and_keep_do_not_rewrite_kept_or_undone_status(
    tmp_path: Path,
) -> None:
    clock = FixedClock(STAMP)
    store = InMemoryStore()
    engine = engine_for(tmp_path, store=store, clock=clock)
    assert (
        engine.submit(make_proposal(), SessionContext("s1", True)).status == "admitted"
    )
    decision_id = str(engine.pending_notices()[0].id.root)
    engine.acknowledge(decision_id)
    shown_at = store.read()[1].decisions[decision_id].shown_at
    assert engine.keep(decision_id).status == "admitted"
    clock.value += timedelta(days=1)
    engine.acknowledge(decision_id)
    assert store.read()[1].decisions[decision_id].status is Status.kept
    assert store.read()[1].decisions[decision_id].shown_at == shown_at
    assert engine.keep(decision_id).status == "admitted"

    next_clock = FixedClock(STAMP)
    next_engine = engine_for(tmp_path, clock=next_clock)
    assert (
        next_engine.submit(make_proposal(), SessionContext("s1", True)).status
        == "admitted"
    )
    next_clock.value += timedelta(days=1)
    next_engine.source.counts["expanded"] = [
        (DailyCount(next_clock.value.date(), "coding", 1, 10, frozenset({"c2"})), "s2")
    ]
    next_engine.source.counts["collapsed"] = [
        (DailyCount(next_clock.value.date(), "coding", 9, 10, frozenset({"c2"})), "s2")
    ]
    assert (
        next_engine.submit(make_proposal("folded"), SessionContext("s2", True)).status
        == "admitted"
    )
    undone_id = str(next_engine.pending_notices()[0].id.root)
    next_engine.acknowledge(undone_id)
    assert next_engine.undo(undone_id).status == "admitted"
    assert next_engine.keep(undone_id).status == "rejected"
    next_engine.acknowledge(undone_id)
    assert next_engine.store.read()[1].decisions[undone_id].status is Status.undone


def test_explicit_setting_supersedes_active_decision_and_can_select_any_value(
    tmp_path: Path,
) -> None:
    engine = engine_for(tmp_path)
    engine.submit(make_proposal(), SessionContext("s", True))
    active = str(engine.pending_notices()[0].id.root)
    assert engine.set_explicit("long_answers", "folded", "coding").status == "admitted"
    assert engine.undo(active).status == "rejected"
    assert engine.set_explicit("long_answers", "open", "coding").status == "admitted"


def test_value_lookup_uses_kind_then_global_then_default(tmp_path: Path) -> None:
    engine = engine_for(tmp_path)
    assert engine.state("writing").values["long_answers"] == "folded"


def test_lookup_tracks_later_global_values_and_declared_scale_default(
    tmp_path: Path,
) -> None:
    engine = engine_for(tmp_path)
    assert engine.set_explicit("long_answers", "folded", "writing").status == "admitted"
    assert engine.return_to_automatic("long_answers", "writing").status == "admitted"
    assert engine.set_explicit("long_answers", "open").status == "admitted"
    assert engine.state("writing").values["long_answers"] == "open"

    path = dimension_file(tmp_path, scale=True)
    path.write_text(
        path.read_text().replace("default: compact", "default: comfortable")
    )
    scale_engine = Engine(
        [load_dimension(path)],
        FakeEventSource({}, []),
        InMemoryStore(),
        FixedClock(STAMP),
        FixedTestIds(),
    )
    assert scale_engine.state("coding").values["density"] == "comfortable"
    assert engine.set_explicit("long_answers", "open").status == "admitted"
    assert engine.state("writing").values["long_answers"] == "open"
    assert engine.set_explicit("long_answers", "folded", "writing").status == "admitted"
    assert engine.state("writing").values["long_answers"] == "folded"
