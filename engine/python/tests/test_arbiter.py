from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from threading import Barrier, Lock

import pytest
from implicity_contracts.generated import (
    ChangePolicy,
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
    FakeEventSource,
    InMemoryStore,
    SessionContext,
    load_dimension,
)

TODAY = date(2026, 11, 25)
STAMP = datetime(2026, 11, 25, 12, tzinfo=timezone.utc)
LOCAL = timezone(timedelta(hours=5, minutes=30))


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
    )


def test_automatic_admission_notice_acknowledge_keep_and_undo(tmp_path: Path) -> None:
    engine = engine_for(tmp_path)
    session = SessionContext("session-1", True)
    assert engine.submit(make_proposal(), session).status == "admitted"
    notice = engine.pending_notices()[0]
    assert notice.status is Status.pending
    assert notice.evidence["features"] == []
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
    assert engine.set_explicit("long_answers", "open", "coding").status == "rejected"
    engine.set_lock("layout", False)
    engine.freeze(True)
    assert engine.set_explicit("long_answers", "open", "coding").status == "rejected"
    engine.freeze(False)
    assert engine.set_explicit("long_answers", "open", "coding").status == "admitted"
    assert (
        engine.submit(make_proposal(), SessionContext("s", True)).status == "rejected"
    )


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
    session = SessionContext("s", True)
    engine.submit(make_proposal("open"), session)
    first = str(engine.pending_notices()[0].id.root)
    clock.value += timedelta(days=1)
    engine.source.counts["expanded"] = [
        (DailyCount(TODAY + timedelta(days=1), "coding", 1, 10, frozenset({"c1"})), "s")
    ]
    engine.source.counts["collapsed"] = [
        (DailyCount(TODAY + timedelta(days=1), "coding", 9, 10, frozenset({"c1"})), "s")
    ]
    engine.submit(make_proposal("folded"), SessionContext("s2", True))
    third = str(engine.pending_notices()[-1].id.root)
    assert engine.undo(first).status == "rejected"
    assert engine.undo(third).status == "admitted"
    assert engine.undone_values("coding", "long_answers") == {"folded"}
    assert engine.return_to_automatic("long_answers", "coding").status == "admitted"
    assert engine.state("coding").values["long_answers"] == "open"
    assert (
        engine.submit(make_proposal("folded"), SessionContext("s3", True)).status
        == "rejected"
    )
    assert engine.set_explicit("long_answers", "folded", "coding").status == "admitted"


def test_clock_once_and_racing_admissions_share_one_daily_slot(tmp_path: Path) -> None:
    clock = FixedClock(STAMP)
    store = InMemoryStore()
    first = engine_for(tmp_path, store=store, clock=clock)
    second = engine_for(tmp_path, store=store, clock=clock)
    assert (
        first.submit(make_proposal(), SessionContext("s1", True)).status == "admitted"
    )
    assert (
        second.submit(make_proposal(), SessionContext("s2", True)).status == "deferred"
    )
    assert clock.calls == 2


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
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource(rows, []),
        InMemoryStore(),
        clock,
    )
    assert engine.set_explicit("density", "spacious", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.state("coding").values["density"] == "compact"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    assert engine.evaluate(SessionContext("s1", True)) == []


def test_scale_does_not_set_freshness_when_effective_value_is_unchanged(
    tmp_path: Path,
) -> None:
    engine = Engine(
        [load_dimension(dimension_file(tmp_path, scale=True))],
        FakeEventSource({}, []),
        InMemoryStore(),
        FixedClock(STAMP),
    )
    assert engine.set_explicit("density", "compact", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") is None
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") is None


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
    )
    proposal = engine.evaluate(SessionContext("s1", True))[0]
    assert engine.evaluate(SessionContext("s1", True))[0] == proposal
    assert proposal.to == "comfortable"
    assert proposal.evidence.model_extra["judged_value"] == "spacious"
    assert (
        engine.submit(
            proposal.model_copy(update={"to": "spacious"}), SessionContext("s1", True)
        ).status
        == "rejected"
    )
    verdict = engine.submit(proposal, SessionContext("s1", True))
    assert verdict.status == "admitted"
    assert verdict.decision.evidence["judged_value"] == "spacious"
    assert engine.freshness_cutoff("coding", "density") == TODAY
    assert clock.calls == 4
    assert engine.return_to_automatic("density", "coding").status == "admitted"
    assert engine.freshness_cutoff("coding", "density") == TODAY


def test_global_dimension_aggregates_kind_counts_and_updates_all_kinds(
    tmp_path: Path,
) -> None:
    path = dimension_file(tmp_path)
    path.write_text(path.read_text().replace("scope: kind", "scope: global"))
    engine = Engine(
        [load_dimension(path)],
        engine_for(tmp_path).source,
        InMemoryStore(),
        FixedClock(STAMP),
    )
    assert engine.set_explicit("long_answers", "open", "coding").status == "rejected"
    proposal = engine.evaluate(SessionContext("s", True))[0]
    assert proposal.kind is None
    assert engine.submit(proposal, SessionContext("s", True)).status == "admitted"
    assert engine.state("coding").values["long_answers"] == "open"
    assert engine.state("writing").values["long_answers"] == "open"


def test_failed_atomic_store_write_leaves_no_partial_transition(tmp_path: Path) -> None:
    class FailingStore(InMemoryStore):
        def commit(self, *args, **kwargs):
            raise OSError("disk unavailable")

    engine = engine_for(tmp_path, store=FailingStore())
    with pytest.raises(OSError, match="disk unavailable"):
        engine.submit(make_proposal(), SessionContext("s", True))
    assert engine.state("coding").values["long_answers"] == "folded"
    assert engine.pending_notices() == []


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


def test_explicit_setting_replaces_active_decision_and_person_can_restore_undone_value(
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
    assert engine.set_explicit("long_answers", "open").status == "admitted"
    assert engine.state("writing").values["long_answers"] == "open"
    assert engine.set_explicit("long_answers", "folded", "writing").status == "admitted"
    assert engine.state("writing").values["long_answers"] == "folded"
