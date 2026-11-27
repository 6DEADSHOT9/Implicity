import asyncio
import json
import socket
import threading
import time
from contextlib import aclosing, contextmanager
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from implicity_api.models.agent import AgentSession, Base, QuotaLog
from implicity_api.modules import agent as agent_module
from implicity_api.modules.agent import (
    AI_SDK_STREAM_HEADERS,
    HermesAgent,
    PromptContext,
    Quota,
    QuotaSettings,
    SkillResult,
    UserMessage,
    stream_sse,
)
from implicity_api.persistence import create_store
from sqlalchemy import create_engine


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


@contextmanager
def _serve_hermes(app):
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
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)


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
                "type": "response.reasoning_summary_part.added",
                "item_id": "reason-1",
                "output_index": 0,
                "summary_index": 0,
            },
            {
                "type": "response.reasoning_summary_text.delta",
                "item_id": "reason-1",
                "output_index": 0,
                "summary_index": 0,
                "delta": "briefly",
            },
            {
                "type": "response.reasoning_summary_part.done",
                "item_id": "reason-1",
                "output_index": 0,
                "summary_index": 0,
            },
            {
                "type": "response.reasoning_summary_part.added",
                "item_id": "reason-1",
                "output_index": 0,
                "summary_index": 1,
            },
            {
                "type": "response.reasoning_summary_text.delta",
                "item_id": "reason-1",
                "output_index": 0,
                "summary_index": 1,
                "delta": "briefly again",
            },
            {
                "type": "response.reasoning_summary_part.done",
                "item_id": "reason-1",
                "output_index": 0,
                "summary_index": 1,
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
            if payload["input"] in {"truncated", "done-only"}:
                for event in events[:10]:
                    yield f"data: {json.dumps(event)}\n\n"
                if payload["input"] == "done-only":
                    yield "data: [DONE]\n\n"
                return
            if payload["input"] == "bad-event":
                for event in events[:2]:
                    yield f"data: {json.dumps(event)}\n\n"
                yield "data: {not-json}\n\n"
                return
            if payload["input"] == "midstream-error":
                for event in events[:3]:
                    yield f"data: {json.dumps(event)}\n\n"
                raise RuntimeError("simulated Hermes restart")
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(body(), media_type="text/event-stream")

    with _serve_hermes(app) as base_url:
        yield base_url, received, stream_started, stream_closed


def test_agent_streams_parts_and_reuses_its_hermes_conversation(fake_hermes, tmp_path):
    base_url, received, _, _ = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'agent.db'}")
    Base.metadata.create_all(bind)
    store = create_store("agent", bind)
    agent = HermesAgent(store, base_url, "test-key")
    conversation_id = "550e8400-e29b-41d4-a716-446655440000"
    context = PromptContext(current_state_instructions="Keep the answer brief.")
    agent.start_conversation(conversation_id, context)
    agent.start_conversation(conversation_id, context)
    restarted = HermesAgent(store, base_url, "test-key")

    async def collect():
        return [
            part async for part in restarted.send(conversation_id, UserMessage("Hi"))
        ]

    parts = asyncio.run(collect())
    types = [part["type"] for part in parts]
    assert types == [
        "start",
        "text-start",
        "text-delta",
        "text-end",
        "reasoning-start",
        "reasoning-delta",
        "reasoning-end",
        "reasoning-start",
        "reasoning-delta",
        "reasoning-end",
        "tool-input-start",
        "tool-input-available",
        "tool-output-available",
        "finish",
    ]
    reasoning_ids = [part["id"] for part in parts if part["type"] == "reasoning-start"]
    assert len(set(reasoning_ids)) == 2
    assert [
        part["id"] for part in parts if part["type"] == "reasoning-end"
    ] == reasoning_ids
    assert AI_SDK_STREAM_HEADERS == {"x-vercel-ai-ui-message-stream": "v1"}
    request = received[0][1]
    assert received[0][0]["authorization"] == "Bearer test-key"
    assert request["input"] == "Hi"
    assert request["instructions"] == json.dumps(asdict(context), separators=(",", ":"))
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
        async with aclosing(agent.send(conversation_id, UserMessage("slow"))) as stream:
            assert (await anext(stream))["type"] == "start"
            agent.cancel(conversation_id)
            return [part async for part in stream]

    parts = asyncio.run(cancel())
    assert [part["type"] for part in parts] == ["abort", "finish"]
    assert stream_closed.wait(timeout=3)


def test_second_send_is_refused_while_the_first_stream_is_active(fake_hermes, tmp_path):
    base_url, _, _, _ = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'concurrent.db'}")
    Base.metadata.create_all(bind)
    agent = HermesAgent(create_store("agent", bind), base_url, "test-key")
    conversation_id = "550e8400-e29b-41d4-a716-446655440003"
    agent.start_conversation(conversation_id)

    async def check():
        first = agent.send(conversation_id, UserMessage("slow"))
        assert (await anext(first))["type"] == "start"
        second = agent.send(conversation_id, UserMessage("Hi"))
        with pytest.raises(RuntimeError, match="already streaming"):
            await anext(second)
        agent.cancel(conversation_id)
        await anext(first)
        await first.aclose()

    asyncio.run(check())


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        (
            "truncated",
            [
                "start",
                "text-start",
                "text-delta",
                "text-end",
                "reasoning-start",
                "reasoning-delta",
                "reasoning-end",
                "reasoning-start",
                "reasoning-delta",
                "reasoning-end",
                "error",
                "finish",
            ],
        ),
        (
            "done-only",
            [
                "start",
                "text-start",
                "text-delta",
                "text-end",
                "reasoning-start",
                "reasoning-delta",
                "reasoning-end",
                "reasoning-start",
                "reasoning-delta",
                "reasoning-end",
                "error",
                "finish",
            ],
        ),
        ("bad-event", ["start", "text-start", "text-end", "error", "finish"]),
        (
            "midstream-error",
            ["start", "text-start", "text-delta", "text-end", "error", "finish"],
        ),
    ],
)
def test_broken_hermes_stream_closes_parts_and_finishes(
    fake_hermes, tmp_path, message, expected
):
    base_url, _, _, _ = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / f'{message}.db'}")
    Base.metadata.create_all(bind)
    agent = HermesAgent(create_store("agent", bind), base_url, "test-key")
    conversation_id = "550e8400-e29b-41d4-a716-446655440004"
    agent.start_conversation(conversation_id)

    async def collect():
        return [
            part async for part in agent.send(conversation_id, UserMessage(message))
        ]

    assert [part["type"] for part in asyncio.run(collect())] == expected


def test_agent_module_does_not_name_model_providers():
    text = Path(agent_module.__file__).read_text(encoding="utf-8").lower()

    assert not any(
        name in text for name in ("openai", "anthropic", "google", "openrouter", "nous")
    )


def test_public_interface_rejects_untyped_context_and_message(fake_hermes, tmp_path):
    base_url, _, _, _ = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'typed.db'}")
    Base.metadata.create_all(bind)
    agent = HermesAgent(create_store("agent", bind), base_url, "test-key")
    conversation_id = "550e8400-e29b-41d4-a716-446655440005"
    with pytest.raises(TypeError, match="PromptContext"):
        agent.start_conversation(conversation_id, "plain string")
    agent.start_conversation(conversation_id, PromptContext())

    async def send_string():
        stream = agent.send(conversation_id, "plain string")
        await anext(stream)

    with pytest.raises(TypeError, match="UserMessage"):
        asyncio.run(send_string())


@pytest.mark.parametrize("terminal", ["response.incomplete", "response.failed"])
def test_final_event_usage_is_logged(terminal, quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(20)])
    state["events"] = [
        {
            "type": terminal,
            "response": {
                "status": "incomplete" if terminal.endswith("incomplete") else "failed",
                "usage": {
                    "input_tokens": 7,
                    "output_tokens": 2,
                    "total_tokens": 9,
                },
            },
        }
    ]
    agent, store = _quota_agent(tmp_path, base_url)
    conversation_id = "550e8400-e29b-41d4-a716-446655440006"
    agent.start_conversation(conversation_id)

    async def collect():
        return [part async for part in agent.send(conversation_id, UserMessage("Hi"))]

    asyncio.run(collect())
    row = store.list(QuotaLog)[0].data
    assert (row["input_tokens"], row["output_tokens"], row["total_tokens"]) == (7, 2, 9)


def test_skill_run_uses_a_short_hermes_conversation(fake_hermes, tmp_path):
    base_url, received, _, _ = fake_hermes
    bind = create_engine(f"sqlite:///{tmp_path / 'skill.db'}")
    Base.metadata.create_all(bind)
    store = create_store("agent", bind)
    agent = HermesAgent(store, base_url, "test-key")

    result = asyncio.run(agent.run_skill("propose-look", {"kind": "coding"}))

    assert isinstance(result, SkillResult)
    assert result.response["id"] == "skill-response"
    assert result.response["status"] == "completed"
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
        stream = stream_sse(agent, conversation_id, UserMessage("slow"))
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
                if isinstance(event, str):
                    yield event
                else:
                    yield f"data: {json.dumps(event)}\n\n"
            if state.get("stream_error"):
                raise RuntimeError("simulated connection reset")
            if not state.get("truncate"):
                yield "data: [DONE]\n\n"

        return StreamingResponse(body(), media_type="text/event-stream")

    with _serve_hermes(app) as base_url:
        yield base_url, state


def _quota_agent(tmp_path, base_url, *, api_key="test-key"):
    bind = create_engine(f"sqlite:///{tmp_path / 'quota.db'}")
    Base.metadata.create_all(bind)
    store = create_store("agent", bind)
    return HermesAgent(store, base_url, api_key), store


def test_quota_contract_shape_auth_states_and_account_windows(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload(
        [
            _window(89),
            _window(100, resets_at="2026-12-03T12:00:00+00:00"),
            _window(100, resets_at="2026-12-04T12:00:00+00:00"),
        ]
    )
    agent, _ = _quota_agent(tmp_path, base_url)

    quota = agent.quota()

    assert isinstance(quota, Quota)
    assert quota.state == "limited"
    assert [(window.label, window.used_percent) for window in quota.windows] == [
        ("Weekly", 89),
        ("Weekly", 100),
        ("Weekly", 100),
    ]
    assert quota.resets_at == "2026-12-04T12:00:00+00:00"
    assert datetime.fromisoformat(quota.checked_at)
    assert state["requests"][0][1] == "/api/model/options"
    assert state["requests"][0][0]["authorization"] == "Bearer test-key"


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

    assert agent.quota().state == expected


def test_non_account_limit_is_ignored(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload(
        [_window(20)],
        limit={"scope": "model", "resets_at": "2026-12-01T12:00:00+00:00"},
    )
    agent, _ = _quota_agent(tmp_path, base_url)

    assert agent.quota().state == "ok"


def test_quota_without_account_windows_ignores_model_limit(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload(
        [], limit={"scope": "model", "resets_at": "2026-12-01T12:00:00+00:00"}
    )
    agent, _ = _quota_agent(tmp_path, base_url)

    assert agent.quota().state == "unknown"


def test_quota_malformed_or_failed_read_is_unknown(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    agent, _ = _quota_agent(tmp_path, base_url)
    state["payload"] = {"providers": [{"is_current": True, "usage": None}]}
    assert agent.quota().state == "unknown"

    # A new instance forces a fresh HTTP read instead of the one-minute cache.
    agent, _ = _quota_agent(tmp_path, base_url)
    state["fail_read"] = True
    assert agent.quota().state == "unknown"


@pytest.mark.parametrize(
    "window",
    [
        _window(101),
        _window(10, resets_at="not-rfc3339"),
    ],
)
def test_malformed_usage_window_is_unknown(quota_hermes, tmp_path, window):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([window])
    agent, _ = _quota_agent(tmp_path, base_url)

    assert agent.quota().state == "unknown"


@pytest.mark.parametrize(
    "payload",
    [
        _usage_payload([_window(90)]),
        _usage_payload([_window(100)]),
        _usage_payload([_window(20, scope="model")]),
    ],
)
def test_background_gate_requires_ok_quota(quota_hermes, tmp_path, payload):
    base_url, state = quota_hermes
    state["payload"] = payload
    agent, _ = _quota_agent(tmp_path, base_url)

    assert not agent.may_start_background_work()


def test_background_gate_uses_the_local_day_not_the_utc_day(
    quota_hermes, tmp_path, monkeypatch
):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(10)])
    agent, store = _quota_agent(tmp_path, base_url)
    monkeypatch.setenv("TZ", "America/Los_Angeles")
    time.tzset()

    class FrozenDateTime(agent_module.datetime):
        # 2026-06-15 12:00 UTC is 05:00 on the same date in Los Angeles.
        current = datetime(2026, 6, 15, 12, tzinfo=agent_module.timezone.utc)

        @classmethod
        def now(cls, tz=None):
            return cls.current.astimezone(tz)

    monkeypatch.setattr(agent_module, "datetime", FrozenDateTime)
    try:
        # 03:00 UTC on the 15th is the 14th, 20:00 in Los Angeles: today in UTC,
        # yesterday locally, so a UTC-date comparison would count it.
        store.insert(
            QuotaLog(
                id="yesterday-locally",
                data={
                    "time": "2026-06-15T03:00:00+00:00",
                    "type": "background",
                    "conversation_id": "old",
                    "input_tokens": 1_000_000_000,
                    "output_tokens": 0,
                    "total_tokens": 1_000_000_000,
                },
            )
        )
        assert agent.may_start_background_work()
    finally:
        monkeypatch.undo()  # restores TZ; the C library needs telling
        time.tzset()


def test_quota_is_read_again_only_after_the_cache_expires(
    quota_hermes, tmp_path, monkeypatch
):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(10)])
    agent, _ = _quota_agent(tmp_path, base_url)
    clock = [1_000.0]
    monkeypatch.setattr(
        agent_module, "time", SimpleNamespace(monotonic=lambda: clock[0])
    )

    agent.quota()
    assert state["reads"] == 1
    clock[0] += 59.9
    agent.quota()
    assert state["reads"] == 1
    clock[0] += 0.2
    agent.quota()
    assert state["reads"] == 2


def test_quota_settings_default_to_200000_tokens_and_90_percent(quota_hermes, tmp_path):
    base_url, _ = quota_hermes
    agent, _ = _quota_agent(tmp_path, base_url)

    for settings in (QuotaSettings(), agent.quota_settings()):
        assert settings.daily_background_token_cap == 200_000
        assert settings.near_limit_threshold_percent == 90


def test_quota_cache_staleness_and_settings_take_effect(
    quota_hermes, tmp_path, monkeypatch
):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(92)])
    agent, agent_store = _quota_agent(tmp_path, base_url)
    assert agent.quota().state == "near_limit"
    assert agent.quota().state == "near_limit"
    assert state["reads"] == 1

    settings = agent.set_quota_settings(QuotaSettings(200_000, 95))
    assert settings == QuotaSettings(200_000, 95)
    assert agent.quota().state == "ok"
    settings = agent.set_quota_settings(QuotaSettings(200_000, 96))
    reloaded_agent, _ = _quota_agent(tmp_path, base_url)
    assert reloaded_agent.quota_settings() == settings
    with pytest.raises(ValueError):
        agent.set_quota_settings(QuotaSettings(-1, 90))
    with pytest.raises(ValueError):
        agent.set_quota_settings(QuotaSettings(1, 101))

    class FrozenDateTime(agent_module.datetime):
        current = agent_module.datetime.now(agent_module.timezone.utc)

        @classmethod
        def now(cls, tz=None):
            return cls.current if tz else cls.current.replace(tzinfo=None)

    monkeypatch.setattr(agent_module, "datetime", FrozenDateTime)
    FrozenDateTime.current += agent_module.timedelta(minutes=16)
    assert agent.quota().state == "unknown"


def test_background_gate_and_quota_log_rows(quota_hermes, tmp_path):
    base_url, state = quota_hermes
    state["payload"] = _usage_payload([_window(10)])
    agent, agent_store = _quota_agent(tmp_path, base_url)
    assert agent.may_start_background_work()
    assert agent.set_quota_settings(QuotaSettings(14, 90)) == QuotaSettings(14, 90)
    assert agent.set_quota_settings(QuotaSettings(13, 90)) == QuotaSettings(13, 90)

    async def collect(kind):
        return [
            part
            async for part in agent.send(
                "550e8400-e29b-41d4-a716-446655440099",
                UserMessage("Hi"),
                turn_type=kind,
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
    assert agent.quota().state == "ok"
    state["payload"] = _usage_payload(
        [_window(100)],
        limit={"scope": "account", "resets_at": "2026-12-01T12:00:00+00:00"},
    )

    async def collect():
        return [
            part
            async for part in agent.send(
                "550e8400-e29b-41d4-a716-446655440098", UserMessage("Hi")
            )
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

    assert quota.state == "limited"
    assert quota.windows == ()
    assert quota.resets_at == "2026-12-01T12:00:00+00:00"
