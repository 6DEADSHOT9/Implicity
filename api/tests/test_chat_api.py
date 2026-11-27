import json

from fastapi.testclient import TestClient
from implicity_api.app import create_app
from implicity_api.models import METADATA
from implicity_api.persistence import create_store
from sqlalchemy import create_engine


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

    def cancel(self, _conversation_id):
        pass


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


def test_chat_rejects_non_user_last_message(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat-invalid.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    with TestClient(
        create_app(chat_agent=FakeAgent(), app_store_override=create_store("app", bind))
    ) as client:
        conversation_id = client.post("/api/conversations").json()["id"]
        response = client.post(
            "/api/chat", json={"id": conversation_id, "messages": []}
        )
        assert response.status_code == 422
