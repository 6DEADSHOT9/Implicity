from datetime import datetime, timezone

import pytest
from implicity_api.models import METADATA
from implicity_api.models.app import Conversation
from implicity_api.modules.app.chat import (
    create_conversation,
    get_conversation,
    list_conversations,
    save_message,
)
from implicity_api.persistence import create_store
from sqlalchemy import create_engine


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
    save_message(app_store, conversation.id, "user", "Hello")
    save_message(app_store, conversation.id, "assistant", "Hi")

    assert app_store.get(Conversation, conversation.id) is not None
    messages = get_conversation(app_store, conversation.id)["messages"]
    assert [(message["role"], message["content"]) for message in messages] == [
        ("user", "Hello"),
        ("assistant", "Hi"),
    ]
    assert [row["id"] for row in list_conversations(app_store)] == [conversation.id]


def test_message_requires_an_existing_conversation(app_store):
    with pytest.raises(ValueError, match="Conversation does not exist"):
        save_message(app_store, "550e8400-e29b-41d4-a716-446655440000", "user", "Hello")
