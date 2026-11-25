from datetime import datetime, timedelta, timezone
from uuid import uuid4

from implicity_api.models.app import Message, MessageSpec
from implicity_api.stores.app import store

UNATTACHED_MESSAGE_SPEC_RETENTION = timedelta(days=1)


def save_message_spec(data: dict, app_store=store) -> str:
    spec = app_store.insert(MessageSpec(id=str(uuid4()), session_id=None, data=data))
    return spec.id


def attach_message_spec(message_id: str, spec_id: str, app_store=store) -> None:
    message = app_store.get(Message, message_id)
    spec = app_store.get(MessageSpec, spec_id)
    if message is None or spec is None:
        raise ValueError("Message or message spec does not exist")
    if spec.session_id is not None and spec.session_id != message.session_id:
        raise ValueError("Message spec is already attached to another session")
    data = dict(message.data)
    existing = data.get("message_spec_id")
    if existing is not None and existing != spec_id:
        raise ValueError("Message already has a different message spec")
    data["message_spec_id"] = spec_id
    message.data = data
    spec.session_id = message.session_id
    app_store.put_many([message, spec])


def discard_unattached_message_specs(app_store=store, now=None) -> None:
    cutoff = (now or datetime.now(timezone.utc)) - UNATTACHED_MESSAGE_SPEC_RETENTION
    for spec in app_store.list(MessageSpec):
        created_at = spec.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if spec.session_id is None and created_at < cutoff:
            app_store.delete(spec)
