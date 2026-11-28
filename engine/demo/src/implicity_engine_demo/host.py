from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid5

from fastapi import FastAPI, HTTPException, Response
from implicity_contracts.generated import DecisionId, ProposalId
from implicity_engine import (
    DailyCount,
    Engine,
    FakeEventSource,
    InMemoryStore,
    SessionContext,
    load_dimension,
)

TODAY = date(2026, 11, 28)
NAMESPACE = UUID("f13bb1f5-2d88-4c1c-a36b-482c9db815c0")


class DemoClock:
    def now(self) -> datetime:
        return datetime.combine(TODAY, time(12), timezone.utc)


class DemoIds:
    def __init__(self) -> None:
        self.proposals = 0
        self.decisions = 0

    def proposal_id(self) -> ProposalId:
        self.proposals += 1
        return ProposalId(root=f"prop_{uuid5(NAMESPACE, f'p{self.proposals}')}")

    def decision_id(self) -> DecisionId:
        self.decisions += 1
        return DecisionId(root=f"dec_{uuid5(NAMESPACE, f'd{self.decisions}')}")


def create_app() -> FastAPI:
    dimensions = [
        load_dimension(Path(__file__).parents[2] / "long_answers.yaml")
    ]
    counts: dict[str, list[tuple[DailyCount, str]]] = {
        feature: [] for feature in ("long_answer_seen", "expanded", "collapsed")
    }
    for day_offset in range(4, -1, -1):
        day = TODAY - timedelta(days=day_offset)
        day_index = 4 - day_offset
        conversations = frozenset(
            {f"conversation-{day_index}", f"conversation-{day_index + 1}"}
        )
        counts["long_answer_seen"].append(
            (DailyCount(day, "coding", 0, 5, conversations), "demo-session")
        )
        counts["expanded"].append(
            (DailyCount(day, "coding", 4, 5, conversations), "demo-session")
        )
        counts["collapsed"].append(
            (DailyCount(day, "coding", 0, 5, conversations), "demo-session")
        )

    engine = Engine(
        dimensions,
        FakeEventSource(counts, [], "UTC"),
        InMemoryStore(),
        DemoClock(),
        DemoIds(),
    )
    app = FastAPI()
    app.state.engine = engine

    @app.get("/state")
    def state(kind: str = "coding") -> dict:
        return {"kind": kind, "values": engine.state(kind).values}

    @app.get("/notices")
    def notices() -> list[dict]:
        return [
            decision.model_dump(mode="json", by_alias=True)
            for decision in engine.pending_notices()
        ]

    @app.post("/notices/{decision_id}/shown", status_code=204)
    def shown(decision_id: str) -> Response:
        try:
            engine.acknowledge(decision_id)
        except ValueError as error:
            raise HTTPException(status_code=404) from error
        return Response(status_code=204)

    @app.post("/decisions/{decision_id}/keep")
    def keep(decision_id: str) -> dict:
        return verdict(engine.keep(decision_id))

    @app.post("/decisions/{decision_id}/undo")
    def undo(decision_id: str) -> dict:
        try:
            return verdict(engine.undo(decision_id))
        except ValueError as error:
            raise HTTPException(status_code=404) from error

    @app.post("/demo/session")
    def demo_session() -> dict:
        proposals = engine.evaluate(SessionContext("demo-session", True))
        results = [
            engine.submit(proposal, SessionContext("demo-session", True))
            for proposal in proposals
        ]
        admitted = next(
            (result for result in results if result.status == "admitted"), None
        )
        return verdict(admitted) if admitted else {"status": "no_change"}

    return app


def verdict(result) -> dict:
    return {"status": result.status, "reason": result.reason}


app = create_app()
