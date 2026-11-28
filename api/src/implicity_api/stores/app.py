from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.engine import Engine

from implicity_api.db import engine
from implicity_api.models.message_spec import message_specs

UNATTACHED_MESSAGE_SPEC_RETENTION = timedelta(days=1)


def expiry_cutoff(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) - UNATTACHED_MESSAGE_SPEC_RETENTION


def delete_unattached_message_specs_before(
    cutoff: datetime, bind: Engine = engine
) -> int:
    statement = delete(message_specs).where(
        message_specs.c.session_id.is_(None),
        message_specs.c.created_at < cutoff,
    )
    with bind.begin() as connection:
        return connection.execute(statement).rowcount


def discard_unattached_message_specs() -> int:
    return delete_unattached_message_specs_before(expiry_cutoff())


def create_app_store():
    from implicity_api.persistence import create_store

    return create_store("app")
