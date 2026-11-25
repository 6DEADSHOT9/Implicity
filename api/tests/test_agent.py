import asyncio
import json
import socket
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from implicity_api.models.agent import AgentSession, Base, QuotaLog
from implicity_api.modules import agent as agent_module
from implicity_api.modules.agent import (
    AI_SDK_STREAM_HEADERS,
    HermesAgent,
    stream_sse,
)
from implicity_api.persistence import create_store
from sqlalchemy import create_engine


@pytest.fixture
def fake_hermes():
    app = FastAPI()
    received = []
    stream_started = threading.Event()
    stream_closed = threading.Event()

    @app.post("/v1/responses")
    async def responses(request: Request):
        payload = await request.json()
        received.append((dict(request.headers), payload))
        stream_started.set()
        if not payload.get("stream"):
            return JSONResponse(
                {
                    "id": "skill-response",
                    "status": "completed",
                    "output": [],
                    "usage": {
                        "input_tokens": 2,
                        "output_tokens": 1,
                        "total_tokens": 3,
                    },
                }
            )
        events = [
            {"type": "response.created", "response": {"id": "resp-1"}},
            {
                "type": "response.output_item.added",
                "item": {"type": "message", "id": "msg-1"},
            },
            {
                "type": "response.output_text.delta",
                "item_id": "msg-1",
                "delta": "hello",
            },
            {
                "type": "response.output_item.done",
                "item": {"type": "message", "id": "msg-1"},
            },
            {
                "type": "response.output_item.added",
                "item": {"type": "reasoning", "id": "reason-1"},
            },
            {
                "type": "response.reasoning_summary_text.delta",
                "item_id": "reason-1",
                "delta": "briefly",
            },
            {
                "type": "response.output_item.done",
                "item": {"type": "reasoning", "id": "reason-1"},
            },
            {
                "type": "response.output_item.added",
                "item": {
                    "type": "function_call",
                    "id": "item-call-1",
                    "call_id": "call-1",
                    "name": "lookup",
                },
            },
            {
                "type": "response.output_item.done",
                "item": {
                    "type": "function_call",
                    "id": "item-call-1",
                    "call_id": "call-1",
                    "name": "lookup",
                    "arguments": '{"q":"x"}',
                },
            },
            {
                "type": "response.output_item.done",
                "item": {
                    "type": "function_call_output",
                    "call_id": "call-1",
                    "output": [{"type": "input_text", "text": "found"}],
                },
            },
            {
                "type": "response.completed",
                "response": {"id": "resp-1", "usage": {"total_tokens": 8}},
            },
        ]

        async def body():
            if payload["input"] == "slow":
                created = {"type": "response.created", "response": {"id": "slow"}}
                yield f"data: {json.dumps(created)}\n\n"
                try:
                    await asyncio.sleep(30)
                except asyncio.CancelledError:
                    stream_closed.set()
                    raise
                return
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(body(), media_type="text/event-stream")

    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 5
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.01)
    assert server.started
    try:
        yield f"http://127.0.0.1:{port}", received, stream_started, stream_closed
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def test_agent_streams_parts_and_reuses_its_hermes_conversation(fake_hermes, tmp_path):
    base_url, received, _, _ = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'agent.db'}")
    Base.metadata.create_all(bind)
    store = create_store("agent", bind)
    agent = HermesAgent(store, base_url, "test-key")
    conversation_id = "550e8400-e29b-41d4-a716-446655440000"
    agent.start_conversation(conversation_id, "Keep the answer brief.")
    agent.start_conversation(conversation_id, "Keep the answer brief.")

    async def collect():
        return [part async for part in agent.send(conversation_id, "Hi")]

    parts = asyncio.run(collect())
    types = [part["type"] for part in parts]
    assert "text-start" in types and "text-delta" in types and "text-end" in types
    assert (
        "reasoning-start" in types
        and "reasoning-delta" in types
        and "reasoning-end" in types
    )
    assert "tool-input-start" in types and "tool-input-available" in types
    assert "tool-output-available" in types
    assert types[-1] == "finish"
    assert AI_SDK_STREAM_HEADERS == {"x-vercel-ai-ui-message-stream": "v1"}
    request = received[0][1]
    assert received[0][0]["authorization"] == "Bearer test-key"
    assert request["input"] == "Hi"
    assert request["instructions"] == "Keep the answer brief."
    session = store.get(AgentSession, conversation_id)
    assert request["conversation"] == session.data["hermes_session_id"]
    assert request["conversation"] != conversation_id


def test_cancel_ends_the_agent_stream(fake_hermes, tmp_path):
    base_url, _, _, stream_closed = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'cancel.db'}")
    Base.metadata.create_all(bind)
    store = create_store("agent", bind)
    agent = HermesAgent(store, base_url, "test-key")
    conversation_id = "550e8400-e29b-41d4-a716-446655440001"
    agent.start_conversation(conversation_id)

    async def cancel():
        stream = agent.send(conversation_id, "slow")
        task = asyncio.create_task(anext(stream))
        await asyncio.sleep(0.1)
        agent.cancel(conversation_id)
        assert (await task)["type"] == "start"
        parts = [part async for part in stream]
        await stream.aclose()
        return parts

    parts = asyncio.run(cancel())
    assert [part["type"] for part in parts] == ["abort", "finish"]
    assert stream_closed.wait(timeout=3)


def test_skill_run_uses_a_short_hermes_conversation(fake_hermes, tmp_path):
    base_url, received, _, _ = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'skill.db'}")
    Base.metadata.create_all(bind)
    store = create_store("agent", bind)
    agent = HermesAgent(store, base_url, "test-key")

    result = asyncio.run(agent.run_skill("propose-look", {"kind": "coding"}))

    assert result["id"] == "skill-response" and result["status"] == "completed"
    assert store.list(QuotaLog)[0].data["type"] == "background"
    assert store.list(QuotaLog)[0].data["total_tokens"] == 3
    headers, request = received[0]
    assert headers["authorization"] == "Bearer test-key"
    assert request["input"] == '{"kind":"coding"}'
    assert "propose-look" in request["instructions"]
    assert request["stream"] is False
    with pytest.raises(ValueError, match="Unknown skill"):
        asyncio.run(agent.run_skill("../../other", {}))


def test_closing_the_public_stream_closes_hermes_http_response(fake_hermes, tmp_path):
    base_url, _, _, stream_closed = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'disconnect.db'}")
    Base.metadata.create_all(bind)
    agent = HermesAgent(create_store("agent", bind), base_url, "test-key")
    conversation_id = "550e8400-e29b-41d4-a716-446655440002"
    agent.start_conversation(conversation_id)

    async def close():
        stream = stream_sse(agent, conversation_id, "slow")
        assert '"type":"start"' in await anext(stream)
        await stream.aclose()

    asyncio.run(close())
    assert stream_closed.wait(timeout=3)


@pytest.fixture
def quota_hermes():
    app = FastAPI()
    state = {
        "payload": {"providers": []},
        "reads": 0,
        "fail_read": False,
        "events": None,
        "requests": [],
    }

    @app.get("/api/model/options")
    async def model_options(request: Request):
        state["reads"] += 1
        state["requests"].append((dict(request.headers), request.url.path))
        if state["fail_read"]:
            return JSONResponse({"detail": "failed"}, status_code=503)
        return state["payload"]

    @app.post("/v1/responses")
    async def responses(request: Request):
        payload = await request.json()
        state["requests"].append((dict(request.headers), request.url.path))
        events = state["events"] or [
            {
                "type": "response.completed",
                "response": {
                    "id": "resp-quota",
                    "usage": {
                        "input_tokens": 12,
                        "output_tokens": 3,
                        "total_tokens": 15,
                    },
                },
            }
        ]
        if not payload.get("stream"):
            return JSONResponse(
                {"status": "completed", "usage": events[-1]["response"]["usage"]}
            )

        async def body():
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(body(), media_type="text/event-stream")

    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 5
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.01)
    assert server.started
    try:
        yield f"http://127.0.0.1:{port}", state
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def _quota_agent(tmp_path, base_url, *, api_key="test-key"):
    bind = create_engine(f"sqlite:///{tmp_path / 'quota.db'}")
    Base.metadata.create_all(bind)
    store = create_store("agent", bind)
    return HermesAgent(store, base_url, api_key), store


def _usage_payload(windows, *, limit=None):
    row = {"is_current": True, "usage": {"windows": windows}}
    if limit is not None:
        row["limit"] = limit
    return {"providers": [{"is_current": False}, row]}


def _window(percent, *, scope="account", resets_at="2026-12-01T12:00:00+00:00"):
    return {
        "label": "Weekly",
        "used_percent": percent,
        "resets_at": resets_at,
        "scope": scope,
    }


def test_quota_contract_shape_auth_states_and_account_windows(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload(
        [_window(89), _window(100, resets_at="2026-12-03T12:00:00+00:00")]
    )
    agent, _ = _quota_agent(tmp_path, base_url)

    quota = agent.quota()

    assert quota == {
        "state": "limited",
        "windows": [
            {
                "label": "Weekly",
                "used_percent": 89,
                "resets_at": "2026-12-01T12:00:00+00:00",
            },
            {
                "label": "Weekly",
                "used_percent": 100,
                "resets_at": "2026-12-03T12:00:00+00:00",
            },
        ],
        "resets_at": "2026-12-03T12:00:00+00:00",
        "checked_at": quota["checked_at"],
    }
    assert state["requests"][0][1] == "/api/model/options"
    assert state["requests"][0][0]["authorization"] == "Bearer test-key"
    assert "provider" not in str(quota).lower()


@pytest.mark.parametrize(
    ("windows", "expected"),
    [
        ([_window(90)], "near_limit"),
        ([_window(89.99)], "ok"),
        ([_window(92, scope="model")], "unknown"),
        ([], "unknown"),
    ],
)
def test_quota_state_threshold_and_ignored_windows(
    quota_hermes, tmp_path, windows, expected
):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload(windows)
    agent, _ = _quota_agent(tmp_path, base_url)

    assert agent.quota()["state"] == expected


def test_quota_malformed_or_failed_read_is_unknown(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    agent, _ = _quota_agent(tmp_path, base_url)
    state["payload"] = {"providers": [{"is_current": True, "usage": None}]}
    assert agent.quota()["state"] == "unknown"

    # A new instance forces a fresh HTTP read instead of the one-minute cache.
    agent, _ = _quota_agent(tmp_path, base_url)
    state["fail_read"] = True
    assert agent.quota()["state"] == "unknown"


def test_quota_cache_staleness_and_settings_take_effect(
    quota_hermes, tmp_path, monkeypatch
):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(92)])
    agent, agent_store = _quota_agent(tmp_path, base_url)
    assert agent.get_quota_settings() == {
        "daily_background_token_cap": 200_000,
        "near_limit_threshold_percent": 90,
    }
    assert agent.quota()["state"] == "near_limit"
    assert agent.quota()["state"] == "near_limit"
    assert state["reads"] == 1

    settings = agent.set_quota_settings(near_limit_threshold_percent=95)
    assert settings["near_limit_threshold_percent"] == 95
    assert agent.quota()["state"] == "ok"
    reloaded_agent, _ = _quota_agent(tmp_path, base_url)
    assert reloaded_agent.get_quota_settings() == settings

    class FrozenDateTime(agent_module.datetime):
        current = agent_module.datetime.now(agent_module.timezone.utc)

        @classmethod
        def now(cls, tz=None):
            return cls.current if tz else cls.current.replace(tzinfo=None)

    monkeypatch.setattr(agent_module, "datetime", FrozenDateTime)
    FrozenDateTime.current += agent_module.timedelta(minutes=16)
    assert agent.quota()["state"] == "unknown"


def test_background_gate_and_quota_log_rows(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(10)])
    agent, agent_store = _quota_agent(tmp_path, base_url)
    assert agent.may_start_background_work()
    assert (
        agent.set_quota_settings(daily_background_token_cap=14)[
            "daily_background_token_cap"
        ]
        == 14
    )

    async def collect(kind):
        return [
            part
            async for part in agent.send(
                "550e8400-e29b-41d4-a716-446655440099", "Hi", turn_type=kind
            )
        ]

    conversation_id = "550e8400-e29b-41d4-a716-446655440099"
    agent.start_conversation(conversation_id)
    asyncio.run(collect("chat"))
    assert agent.may_start_background_work()
    asyncio.run(collect("background"))
    assert not agent.may_start_background_work()
    rows = agent_store.list(QuotaLog)
    assert {row.data["type"] for row in rows} == {"chat", "background"}
    background_row = next(row.data for row in rows if row.data["type"] == "background")
    assert background_row == {
        "time": background_row["time"],
        "type": "background",
        "conversation_id": conversation_id,
        "input_tokens": 12,
        "output_tokens": 3,
        "total_tokens": 15,
    }


def test_failed_turn_forces_quota_reread_and_exposes_limit(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(10)])
    state["events"] = [{"type": "response.failed", "response": {"status": "failed"}}]
    agent, _ = _quota_agent(tmp_path, base_url)
    agent.start_conversation("550e8400-e29b-41d4-a716-446655440098")
    assert agent.quota()["state"] == "ok"
    state["payload"] = _usage_payload(
        [_window(100)],
        limit={"scope": "account", "resets_at": "2026-12-01T12:00:00+00:00"},
    )

    async def collect():
        return [
            part
            async for part in agent.send("550e8400-e29b-41d4-a716-446655440098", "Hi")
        ]

    parts = asyncio.run(collect())
    error = next(part for part in parts if part["type"] == "error")
    assert error["quota_state"] == "limited"
    assert error["resets_at"] == "2026-12-01T12:00:00+00:00"
    assert state["reads"] == 2


def test_hermes_limit_without_windows_is_limited(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload(
        [], limit={"scope": "account", "resets_at": "2026-12-01T12:00:00+00:00"}
    )
    agent, _ = _quota_agent(tmp_path, base_url)

    quota = agent.quota()

    assert quota["state"] == "limited"
    assert quota["windows"] == []
    assert quota["resets_at"] == "2026-12-01T12:00:00+00:00"
