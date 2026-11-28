from datetime import datetime, timezone

import pytest
from implicity_api.models.app import Conversation
from implicity_api.models.metadata import METADATA
from implicity_api.modules.app.chat import (
    create_conversation,
    get_conversation,
    list_conversations,
    save_message,
)
from implicity_api.persistence import create_store
from sqlalchemy import create_engine

SESSION_A = "550e8400-e29b-41d4-a716-446655440001"
SESSION_B = "550e8400-e29b-41d4-a716-446655440002"


@pytest.fixture
def app_store(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'chat.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    return create_store("app", bind)


def test_conversations_and_messages_are_owned_and_reloadable(app_store):
    conversation = create_conversation(
        app_store, now=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    save_message(app_store, conversation.id, SESSION_A, "user", "Hello")
    save_message(app_store, conversation.id, SESSION_A, "assistant", "Hi")

    assert app_store.get(Conversation, conversation.id) is not None
    messages = get_conversation(app_store, conversation.id)["messages"]
    assert [(message["role"], message["content"]) for message in messages] == [
        ("user", "Hello"),
        ("assistant", "Hi"),
    ]
    assert [row["id"] for row in list_conversations(app_store)] == [conversation.id]


def test_conversation_loads_messages_from_multiple_sessions(app_store):
    conversation = create_conversation(app_store)
    first = save_message(app_store, conversation.id, SESSION_A, "user", "First")
    second = save_message(app_store, conversation.id, SESSION_B, "assistant", "Second")

    assert first.session_id == SESSION_A and first.conversation_id == conversation.id
    assert second.session_id == SESSION_B and second.conversation_id == conversation.id
    assert [
        message["content"]
        for message in get_conversation(app_store, conversation.id)["messages"]
    ] == ["First", "Second"]


def test_message_requires_an_existing_conversation(app_store):
    with pytest.raises(ValueError, match="Conversation does not exist"):
        save_message(
            app_store,
            "550e8400-e29b-41d4-a716-446655440000",
            SESSION_A,
            "user",
            "Hello",
        )
