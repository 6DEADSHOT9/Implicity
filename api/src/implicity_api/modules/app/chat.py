from datetime import datetime, timezone
from uuid import UUID, uuid4

from implicity_api.models.app import Conversation, Message
from implicity_api.stores.app import store


def create_conversation(app_store=store, now=None) -> Conversation:
    conversation_id = str(uuid4())
    created_at = (now or datetime.now(timezone.utc)).isoformat()
    return app_store.insert(
        Conversation(
            id=conversation_id,
            session_id=conversation_id,
            data={"title": "New chat", "created_at": created_at},
        )
    )


def list_conversations(app_store=store) -> list[dict]:
    rows = app_store.list(Conversation)
    rows.sort(key=lambda row: row.data["created_at"], reverse=True)
    return [{"id": row.id, **row.data} for row in rows]


def get_conversation(app_store, conversation_id: str) -> dict | None:
    conversation_id = str(UUID(conversation_id))
    conversation = app_store.get(Conversation, conversation_id)
    if conversation is None:
        return None
    messages = app_store.filter_by(Message, conversation_id=conversation_id)
    messages.sort(key=lambda row: (row.data["created_at"], row.id))
    return {
        "id": conversation.id,
        **conversation.data,
        "messages": [{"id": row.id, **row.data} for row in messages],
    }


def conversation_exists(app_store, conversation_id: str) -> bool:
    return app_store.get(Conversation, str(UUID(conversation_id))) is not None


def save_message(
    app_store, conversation_id: str, session_id: str, role: str, content: str
) -> Message:
    conversation_id = str(UUID(conversation_id))
    session_id = str(UUID(session_id))
    if role not in {"user", "assistant"}:
        raise ValueError("Invalid message role")
    if app_store.get(Conversation, conversation_id) is None:
        raise ValueError("Conversation does not exist")
    return app_store.insert(
        Message(
            id=str(uuid4()),
            session_id=session_id,
            conversation_id=conversation_id,
            data={
                "role": role,
                "content": content,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    )
