from uuid import uuid4

from implicity_api.models.app import Message as Message
from implicity_api.models.app import MessageSpec as MessageSpec
from implicity_api.stores.app import (
    UNATTACHED_MESSAGE_SPEC_RETENTION as UNATTACHED_MESSAGE_SPEC_RETENTION,
)
from implicity_api.stores.app import create_app_store, expiry_cutoff

store = create_app_store()


class MessageNotFoundError(ValueError):
    pass


class MessageSpecNotFoundError(ValueError):
    pass


class MessageSpecAlreadyAttachedError(ValueError):
    pass


class MessageAlreadyHasSpecError(ValueError):
    pass


class MessageNotAssistantError(ValueError):
    pass


def save_message_spec(data: dict, app_store=store) -> str:
    spec = app_store.insert(MessageSpec(id=str(uuid4()), session_id=None, data=data))
    return spec.id


def attach_message_spec(message_id: str, spec_id: str, app_store=store) -> None:
    result = app_store.attach_message_spec(message_id, spec_id)
    if result == "message_missing":
        raise MessageNotFoundError("Message does not exist")
    if result == "spec_missing":
        raise MessageSpecNotFoundError("Message spec does not exist")
    if result == "not_assistant":
        raise MessageNotAssistantError("Message must be from the assistant")
    if result == "already_attached":
        raise MessageSpecAlreadyAttachedError("Message spec is already attached")
    if result == "message_has_spec":
        raise MessageAlreadyHasSpecError("Message already has a different message spec")


def discard_unattached_message_specs(app_store=store, now=None) -> int:
    return app_store.delete_unattached_message_specs_before(expiry_cutoff(now))
