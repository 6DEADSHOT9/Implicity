import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def test_message_identity_migration_backfills_and_refuses_lossy_downgrade(
    tmp_path, monkeypatch
):
    database = tmp_path / "migration.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database}")
    config = Config("api/alembic.ini")
    command.upgrade(config, "0004_unattached_message_specs")
    engine = create_engine(f"sqlite:///{database}")
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO messages (id, session_id, data) "
                "VALUES ('legacy', 'conversation-a', '{}')"
            )
        )

    command.upgrade(config, "head")
    command.check(config)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO messages (id, session_id, conversation_id, data) "
                "VALUES ('new', 'session-b', 'conversation-a', '{}')"
            )
        )
    with pytest.raises(RuntimeError, match="Cannot downgrade"):
        command.downgrade(config, "0004_unattached_message_specs")
    with engine.connect() as connection:
        assert [
            tuple(row)
            for row in connection.execute(
                text("SELECT id, session_id, conversation_id FROM messages ORDER BY id")
            )
        ] == [
            ("legacy", "conversation-a", "conversation-a"),
            ("new", "session-b", "conversation-a"),
        ]

    with engine.begin() as connection:
        connection.execute(
            text("UPDATE messages SET session_id = conversation_id WHERE id = 'new'")
        )
    command.downgrade(config, "0004_unattached_message_specs")
    assert "conversation_id" not in {
        column["name"] for column in inspect(engine).get_columns("messages")
    }
    engine.dispose()
