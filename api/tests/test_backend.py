from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from implicity_api.backup import backup_database
from implicity_api.db import TABLE_OWNERS, session_for
from implicity_api.models import METADATA
from implicity_api.models.agent import AgentSession
from implicity_api.models.app import Conversation
from implicity_api.models.engine import Decision
from implicity_api.models.memory import MemoryItem
from sqlalchemy import create_engine, inspect, select

API_ROOT = Path(__file__).parents[1]


def test_migrations_create_every_owned_table_from_empty_database(tmp_path):
    database = tmp_path / "empty.db"
    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database}")
    command.upgrade(config, "head")

    expected = {table for metadata in METADATA for table in metadata.tables}
    assert set(inspect(create_engine(f"sqlite:///{database}")).get_table_names()) == (
        expected | {"alembic_version"}
    )
    assert set(TABLE_OWNERS) == expected


def test_module_session_rejects_reads_from_another_modules_tables():
    bind = create_engine("sqlite://")
    for metadata in METADATA:
        metadata.create_all(bind)
    session = session_for("engine", bind)
    with pytest.raises(PermissionError, match="engine cannot read app.conversations"):
        session.execute(select(Conversation))
    with pytest.raises(PermissionError, match="engine cannot read app.conversations"):
        session.execute(select(Decision, Conversation))
    with pytest.raises(PermissionError, match="engine cannot read app.conversations"):
        session.get(Conversation, "conversation-id")
    session.close()


def test_module_session_allows_its_own_tables():
    bind = create_engine("sqlite://")
    METADATA[0].create_all(bind)
    session = session_for("engine", bind)
    session.execute(select(Decision))
    session.close()


def test_all_module_tables_are_accounted_for_by_the_migration():
    expected = {
        "decisions",
        "explicit_settings",
        "locks",
        "excluded_sessions",
        "layout_revisions",
        "memory_items",
        "projects",
        "drafts",
        "inferences",
        "typing_profiles",
        "guest_patterns",
        "conversations",
        "messages",
        "message_specs",
        "kinds",
        "looks",
        "widgets",
        "schedules",
        "workflows",
        "files",
        "agent_sessions",
        "quota_log",
    }
    assert {table for metadata in METADATA for table in metadata.tables} == expected
    assert MemoryItem and AgentSession


def test_backup_copies_sqlite_database_and_keeps_seven(tmp_path):
    source = tmp_path / "live.db"
    with create_engine(f"sqlite:///{source}").begin() as connection:
        connection.exec_driver_sql("CREATE TABLE saved (value TEXT)")
        connection.exec_driver_sql("INSERT INTO saved VALUES ('present')")
    backups = tmp_path / "backups"
    backups.mkdir()
    for day in range(1, 10):
        (backups / f"2026-10-{day:02}.db").touch()

    result = backup_database(source, backups)

    assert result.exists()
    assert len(list(backups.glob("*.db"))) == 7
    with create_engine(f"sqlite:///{result}").connect() as connection:
        assert (
            connection.exec_driver_sql("SELECT value FROM saved").scalar_one()
            == "present"
        )
