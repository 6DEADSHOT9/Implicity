from datetime import datetime, timedelta, timezone
from uuid import uuid4

from implicity_api.models.app import Message, MessageSpec
from implicity_api.stores.app import store

UNATTACHED_MESSAGE_SPEC_RETENTION = timedelta(days=1)


class MessageNotFoundError(ValueError):
    pass


class MessageSpecNotFoundError(ValueError):
    pass


class MessageSpecAlreadyAttachedError(ValueError):
    pass


class MessageAlreadyHasSpecError(ValueError):
    pass


def save_message_spec(data: dict, app_store=store) -> str:
    spec = app_store.insert(MessageSpec(id=str(uuid4()), session_id=None, data=data))
    return spec.id


def attach_message_spec(message_id: str, spec_id: str, app_store=store) -> None:
    message = app_store.get(Message, message_id)
    if message is None:
        raise MessageNotFoundError("Message does not exist")
    spec = app_store.get(MessageSpec, spec_id)
    if spec is None:
        raise MessageSpecNotFoundError("Message spec does not exist")
    data = dict(message.data)
    existing = data.get("message_spec_id")
    if spec.session_id is not None:
        if existing == spec_id and spec.session_id == message.session_id:
            return
        raise MessageSpecAlreadyAttachedError("Message spec is already attached")
    if existing is not None:
        raise MessageAlreadyHasSpecError("Message already has a different message spec")
    data["message_spec_id"] = spec_id
    message.data = data
    spec.session_id = message.session_id
    # shortcut: synchronous app store; revisit if turn requests overlap.
    app_store.put_many([message, spec])


def discard_unattached_message_specs(app_store=store, now=None) -> int:
    cutoff = (now or datetime.now(timezone.utc)) - UNATTACHED_MESSAGE_SPEC_RETENTION
    return app_store.delete_unattached_message_specs_before(cutoff)
