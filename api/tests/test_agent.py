import asyncio
import json
import socket
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from implicity_api.models.agent import AgentSession, Base
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
                {"id": "skill-response", "status": "completed", "output": []}
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
    agent = HermesAgent(create_store("agent", bind), base_url, "test-key")
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
    agent = HermesAgent(create_store("agent", bind), base_url, "test-key")

    result = asyncio.run(agent.run_skill("propose-look", {"kind": "coding"}))

    assert result == {"id": "skill-response", "status": "completed", "output": []}
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
