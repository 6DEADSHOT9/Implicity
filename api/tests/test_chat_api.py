import json

import anyio
import httpx
from fastapi.testclient import TestClient
from implicity_api.app import create_app
from implicity_api.models import METADATA
from implicity_api.models.app import Message, MessageSpec
from implicity_api.modules.agent import Quota, QuotaWindow
from implicity_api.modules.app import save_message_spec
from implicity_api.modules.app.chat import create_conversation, save_message
from implicity_api.persistence import create_store
from sqlalchemy import create_engine

SESSION_ID = "550e8400-e29b-41d4-a716-446655440099"


class FakeAgent:
    def __init__(self):
        self.started = []

    def start_conversation(self, conversation_id):
        self.started.append(conversation_id)

    def send(self, _conversation_id, message):
        async def parts():
            assert message.text == "Hello"
            yield {"type": "start", "messageId": "assistant"}
            yield {"type": "text-start", "id": "text"}
            yield {"type": "text-delta", "id": "text", "delta": "Hi"}
            yield {"type": "text-end", "id": "text"}
            yield {"type": "finish"}

        return parts()

    def admit(self, conversation_id, message):
        return self.send(conversation_id, message), lambda: None

    def cancel(self, _conversation_id):
        pass

    def quota(self):
        return Quota(
            "near_limit",
            (QuotaWindow("Weekly", 94, "2026-12-01T00:00:00Z"),),
            None,
            "2026-11-28T00:00:00Z",
        )


def test_quota_route_returns_agent_module_quota(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-quota.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)

    with TestClient(
        create_app(chat_agent=FakeAgent(), app_store_override=create_store("app", bind))
    ) as client:
        assert client.get("/api/quota").json() == {
            "state": "near_limit",
            "windows": [
                {
                    "label": "Weekly",
                    "used_percent": 94,
                    "resets_at": "2026-12-01T00:00:00Z",
                }
            ],
            "resets_at": None,
            "checked_at": "2026-11-28T00:00:00Z",
        }


def test_chat_streams_and_conversation_reloads(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-api.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    agent = FakeAgent()

    with TestClient(
        create_app(chat_agent=agent, app_store_override=create_store("app", bind))
    ) as client:
        created = client.post("/api/conversations").json()
        conversation_id = created["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {"role": "user", "parts": [{"type": "text", "text": "Hello"}]}
                ],
            },
        )
        assert response.status_code == 200
        assert response.headers["x-vercel-ai-ui-message-stream"] == "v1"
        parts = [
            json.loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: {")
        ]
        assert {part["type"] for part in parts} >= {"text-delta", "finish"}

        loaded = client.get(f"/api/conversations/{conversation_id}").json()
        assert [
            (message["role"], message["content"]) for message in loaded["messages"]
        ] == [
            ("user", "Hello"),
            ("assistant", "Hi"),
        ]
        assert client.get("/api/conversations").json()[0]["id"] == conversation_id
        assert agent.started == [conversation_id]


def test_conversation_loads_messages_across_session_ids(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-two-sessions.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    conversation = create_conversation(app_store)
    other_session_id = "550e8400-e29b-41d4-a716-446655440098"
    save_message(app_store, conversation.id, SESSION_ID, "user", "First session")
    save_message(
        app_store, conversation.id, other_session_id, "assistant", "Second session"
    )
    with TestClient(
        create_app(chat_agent=FakeAgent(), app_store_override=app_store)
    ) as client:
        loaded = client.get(f"/api/conversations/{conversation.id}").json()
    assert [message["content"] for message in loaded["messages"]] == [
        "First session",
        "Second session",
    ]
    assert {row.session_id for row in app_store.list(Message)} == {
        SESSION_ID,
        other_session_id,
    }


def test_post_chat_checks_conversation_without_listing_messages(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-exists-only.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    inner = create_store("app", bind)

    class StoreProxy:
        message_list_calls = 0

        def __getattr__(self, name):
            return getattr(inner, name)

        def list(self, model):
            if model is Message:
                self.message_list_calls += 1
            return inner.list(model)

    app_store = StoreProxy()
    with TestClient(
        create_app(chat_agent=FakeAgent(), app_store_override=app_store)
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {"role": "user", "parts": [{"type": "text", "text": "Hello"}]}
                ],
            },
        )
    assert response.status_code == 200
    assert app_store.message_list_calls == 0


def test_chat_rejects_non_user_last_message(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-invalid.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    with TestClient(
        create_app(chat_agent=FakeAgent(), app_store_override=create_store("app", bind))
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={"id": conversation_id, "session_id": SESSION_ID, "messages": []},
        )
        assert response.status_code == 422


def test_chat_accepts_more_than_four_valid_text_parts(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-parts.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    with TestClient(
        create_app(chat_agent=FakeAgent(), app_store_override=create_store("app", bind))
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {
                        "role": "user",
                        "parts": [
                            {"type": "text", "text": "He"},
                            {"type": "text", "text": "l"},
                            {"type": "text", "text": "l"},
                            {"type": "text", "text": "o"},
                            {"type": "text", "text": ""},
                        ],
                    }
                ],
            },
        )
        assert response.status_code == 200


def test_chat_rejects_malformed_message_parts(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-malformed-parts.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    with TestClient(
        create_app(chat_agent=FakeAgent(), app_store_override=create_store("app", bind))
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [{"role": "user", "parts": [{"type": "text", "text": 42}]}],
            },
        )
        assert response.status_code == 422
        assert response.json()["detail"] == "Message parts must be text"


def test_early_agent_failure_finishes_stream_without_saving_a_failed_turn(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-failed.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)

    class MissingKeyAgent(FakeAgent):
        def admit(self, _conversation_id, _message):
            raise RuntimeError("Hermes API key is not configured")

        def send(self, _conversation_id, _message):
            async def parts():
                raise RuntimeError("Hermes API key is not configured")
                yield  # Make this an async generator.

            return parts()

    app_store = create_store("app", bind)
    with TestClient(
        create_app(chat_agent=MissingKeyAgent(), app_store_override=app_store)
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {"role": "user", "parts": [{"type": "text", "text": "Hello"}]}
                ],
            },
        )
        parts = [
            json.loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: {")
        ]
        assert response.status_code == 200
        assert parts == [
            {"type": "error", "errorText": "Hermes API key is not configured."},
            {"type": "finish"},
        ]
        assert (
            client.get(f"/api/conversations/{conversation_id}").json()["messages"] == []
        )


def test_chat_stores_a_separator_between_text_items(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-text-items.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)

    class MultipartAgent(FakeAgent):
        def send(self, _conversation_id, _message):
            async def parts():
                yield {"type": "start", "messageId": "assistant"}
                yield {"type": "text-delta", "id": "first", "delta": "Let me check."}
                yield {
                    "type": "text-delta",
                    "id": "second",
                    "delta": "```python\nprint(2)\n```",
                }
                yield {"type": "finish"}

            return parts()

    with TestClient(
        create_app(
            chat_agent=MultipartAgent(), app_store_override=create_store("app", bind)
        )
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {"role": "user", "parts": [{"type": "text", "text": "Check this"}]}
                ],
            },
        )
        messages = client.get(f"/api/conversations/{conversation_id}").json()[
            "messages"
        ]
        assert messages[-1]["content"] == "Let me check.\n\n```python\nprint(2)\n```"


def test_render_result_is_attached_to_the_saved_assistant_message(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-spec.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    spec_id = save_message_spec(
        {"registry_version": 2, "root": "card", "elements": {}}, app_store
    )
    second_spec_id = save_message_spec(
        {"registry_version": 2, "root": "card", "elements": {}}, app_store
    )

    class RenderAgent(FakeAgent):
        def send(self, _conversation_id, message):
            async def parts():
                yield {"type": "start", "messageId": "assistant"}
                yield {
                    "type": "tool-input-start",
                    "toolCallId": "lookup",
                    "toolName": "lookup",
                }
                yield {
                    "type": "tool-output-available",
                    "toolCallId": "lookup",
                    "output": {"id": second_spec_id},
                }
                yield {
                    "type": "tool-input-start",
                    "toolCallId": "render-1",
                    "toolName": "render",
                }
                yield {
                    "type": "tool-output-available",
                    "toolCallId": "render-1",
                    "output": [
                        {
                            "type": "input_text",
                            "text": json.dumps({"result": json.dumps({"id": spec_id})}),
                        }
                    ],
                }
                yield {
                    "type": "tool-input-start",
                    "toolCallId": "render-2",
                    "toolName": "render",
                }
                yield {
                    "type": "tool-output-available",
                    "toolCallId": "render-2",
                    "output": [
                        {
                            "type": "input_text",
                            "text": json.dumps(
                                {"result": json.dumps({"id": second_spec_id})}
                            ),
                        }
                    ],
                }
                yield {"type": "text-delta", "id": "text", "delta": "Hi"}
                yield {"type": "finish"}

            return parts()

    with TestClient(
        create_app(chat_agent=RenderAgent(), app_store_override=app_store)
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {"role": "user", "parts": [{"type": "text", "text": "Hello"}]}
                ],
            },
        )
        assert response.status_code == 200
        messages = client.get(f"/api/conversations/{conversation_id}").json()[
            "messages"
        ]
        assert messages[-1]["role"] == "assistant"
        assert (
            app_store.get(Message, messages[-1]["id"]).data["message_spec_id"]
            == spec_id
        )
        assert app_store.get(MessageSpec, spec_id).session_id == SESSION_ID
        assert app_store.get(MessageSpec, second_spec_id).session_id is None


def test_render_only_turn_saves_an_empty_assistant_message(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-render-only.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    spec_id = save_message_spec(
        {"registry_version": 2, "root": "card", "elements": {}}, app_store
    )

    class RenderOnlyAgent(FakeAgent):
        def send(self, _conversation_id, _message):
            async def parts():
                yield {
                    "type": "tool-input-start",
                    "toolCallId": "render-1",
                    "toolName": "mcp__render",
                }
                yield {
                    "type": "tool-output-available",
                    "toolCallId": "render-1",
                    "output": [
                        {
                            "type": "input_text",
                            "text": json.dumps({"result": json.dumps({"id": spec_id})}),
                        }
                    ],
                }
                yield {"type": "finish"}

            return parts()

    with TestClient(
        create_app(chat_agent=RenderOnlyAgent(), app_store_override=app_store)
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {"role": "user", "parts": [{"type": "text", "text": "Hello"}]}
                ],
            },
        )
        assert response.status_code == 200
        messages = client.get(f"/api/conversations/{conversation_id}").json()[
            "messages"
        ]
        assert [(message["role"], message["content"]) for message in messages] == [
            ("user", "Hello"),
            ("assistant", ""),
        ]
        assert (
            app_store.get(Message, messages[-1]["id"]).data["message_spec_id"]
            == spec_id
        )


def test_unexpected_relay_error_is_logged_without_prompt_or_credentials(
    tmp_path, caplog
):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-relay-error.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)

    class BrokenAgent(FakeAgent):
        def send(self, _conversation_id, _message):
            async def parts():
                raise ZeroDivisionError("private prompt and secret-key")
                yield

            return parts()

    with TestClient(
        create_app(
            chat_agent=BrokenAgent(), app_store_override=create_store("app", bind)
        )
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {
                        "role": "user",
                        "parts": [{"type": "text", "text": "private prompt"}],
                    }
                ],
            },
        )
        assert '"type":"error"' in response.text
        assert "The answer could not be loaded. Try again." in response.text
        assert '"type":"finish"' in response.text
    assert "Chat relay failed" in caplog.text
    assert "private prompt" not in caplog.text
    assert "secret-key" not in caplog.text


def test_unexpected_admission_error_is_logged_without_prompt_or_credentials(
    tmp_path, caplog
):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-admission-error.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)

    class BrokenAdmissionAgent(FakeAgent):
        def admit(self, _conversation_id, _message):
            raise RuntimeError("private prompt and secret-key")

    with TestClient(
        create_app(
            chat_agent=BrokenAdmissionAgent(),
            app_store_override=create_store("app", bind),
        )
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat",
            json={
                "id": conversation_id,
                "session_id": SESSION_ID,
                "messages": [
                    {
                        "role": "user",
                        "parts": [{"type": "text", "text": "private prompt"}],
                    }
                ],
            },
        )
        assert "The agent could not start this turn." in response.text
        assert '"type":"finish"' in response.text
    assert "Chat admission failed" in caplog.text
    assert "private prompt" not in caplog.text
    assert "secret-key" not in caplog.text


def test_api_disconnect_saves_partial_answer_and_allows_another_turn(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-disconnect.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)

    class DisconnectAgent(FakeAgent):
        def __init__(self):
            super().__init__()
            self.cancelled = False
            self.calls = 0

        def send(self, _conversation_id, _message):
            self.calls += 1

            async def parts():
                yield {"type": "start", "messageId": f"assistant-{self.calls}"}
                yield {
                    "type": "text-delta",
                    "id": "text",
                    "delta": "Partial" if self.calls == 1 else "Complete",
                }
                if self.calls == 1:
                    await anyio.sleep_forever()
                yield {"type": "finish"}

            return parts()

        def cancel(self, _conversation_id):
            self.cancelled = True

    agent = DisconnectAgent()
    app = create_app(chat_agent=agent, app_store_override=app_store)
    conversation = create_conversation(app_store)
    agent.start_conversation(conversation.id)

    async def check():
        body = json.dumps(
            {
                "id": conversation.id,
                "session_id": SESSION_ID,
                "messages": [
                    {"role": "user", "parts": [{"type": "text", "text": "Hello"}]}
                ],
            }
        ).encode()
        disconnected = anyio.Event()
        received_request = False

        async def receive():
            nonlocal received_request
            if not received_request:
                received_request = True
                return {"type": "http.request", "body": body, "more_body": False}
            await disconnected.wait()
            return {"type": "http.disconnect"}

        async def send(message):
            if message[
                "type"
            ] == "http.response.body" and b'"delta":"Partial"' in message.get(
                "body", b""
            ):
                disconnected.set()

        await app(
            {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/api/chat",
                "raw_path": b"/api/chat",
                "query_string": b"",
                "headers": [(b"content-type", b"application/json")],
                "server": ("test", 80),
                "client": ("test", 1234),
            },
            receive,
            send,
        )
        assert agent.cancelled
        messages = app_store.get(Message, app_store.list(Message)[-1].id)
        assert messages.data["content"] == "Partial"
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/chat",
                json={
                    "id": conversation.id,
                    "session_id": SESSION_ID,
                    "messages": [
                        {"role": "user", "parts": [{"type": "text", "text": "Again"}]}
                    ],
                },
            )
        assert response.status_code == 200
        assert "Complete" in response.text

    anyio.run(check)


def test_api_disconnect_before_first_event_keeps_the_admitted_prompt(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-before-first-event.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    received_prompt = anyio.Event()

    class HeldAgent(FakeAgent):
        def admit(self, conversation_id, message):
            return self.send(conversation_id, message), lambda: None

        def send(self, _conversation_id, _message):
            async def parts():
                received_prompt.set()
                await anyio.sleep_forever()
                yield {"type": "text-delta", "id": "text", "delta": "unreachable"}

            return parts()

        def cancel(self, _conversation_id):
            pass

    app = create_app(chat_agent=HeldAgent(), app_store_override=app_store)
    conversation = create_conversation(app_store)

    async def check():
        body = json.dumps(
            {
                "id": conversation.id,
                "session_id": SESSION_ID,
                "messages": [
                    {
                        "role": "user",
                        "parts": [{"type": "text", "text": "Keep this prompt"}],
                    }
                ],
            }
        ).encode()
        sent = False

        async def receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            await received_prompt.wait()
            return {"type": "http.disconnect"}

        async def send(_message):
            pass

        await app(
            {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/api/chat",
                "raw_path": b"/api/chat",
                "query_string": b"",
                "headers": [(b"content-type", b"application/json")],
                "server": ("test", 80),
                "client": ("test", 1234),
            },
            receive,
            send,
        )

    anyio.run(check)
    messages = app_store.list(Message)
    assert [
        (message.data["role"], message.data["content"]) for message in messages
    ] == [("user", "Keep this prompt")]
