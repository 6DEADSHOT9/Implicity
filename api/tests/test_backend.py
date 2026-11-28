import ast
import os
import runpy
import shutil
import sqlite3
import subprocess
import sys
import threading
import tomllib
from datetime import date, datetime, timedelta, timezone
from importlib.util import resolve_name
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from implicity_api import backup
from implicity_api.backup import backup_database, database_path
from implicity_api.db import PROJECT_ROOT, database_url
from implicity_api.models import METADATA
from implicity_api.models.agent import AgentSession
from implicity_api.models.app import Conversation, Message, MessageSpec
from implicity_api.models.engine import Decision
from implicity_api.persistence import create_store
from sqlalchemy import (
    column,
    create_engine,
    inspect,
    literal_column,
    select,
    table,
    text,
)
from sqlalchemy.engine import make_url

API_ROOT = Path(__file__).parents[1]
SOURCE_ROOT = API_ROOT / "src/implicity_api"
TABLES_BY_OWNER = {
    "engine": {
        "decisions",
        "explicit_settings",
        "locks",
        "excluded_sessions",
        "layout_revisions",
    },
    "memory": {
        "memory_items",
        "projects",
        "drafts",
        "inferences",
        "typing_profiles",
        "guest_patterns",
    },
    "app": {
        "conversations",
        "messages",
        "message_specs",
        "kinds",
        "looks",
        "widgets",
        "schedules",
        "workflows",
        "files",
    },
    "agent": {"agent_sessions", "quota_log", "quota_settings"},
}
DECISION = {
    "id": "dec_550e8400-e29b-41d4-a716-446655440003",
    "proposal_id": "prop_550e8400-e29b-41d4-a716-446655440002",
    "dimension": "long_answers",
    "kind": None,
    "from": "folded",
    "to": "open",
    "reason": "evidence",
    "evidence": {},
    "dimension_version": 1,
    "status": "pending",
    "created_at": "2026-11-24T00:00:00.000Z",
    "shown_at": None,
}
SPEC = {
    "registry_version": 1,
    "root": "shell",
    "elements": {"shell": {"type": "AppShell", "props": {}}},
}


def check_module_boundaries(root: Path = SOURCE_ROOT / "modules") -> None:
    for path in root.rglob("*.py"):
        relative = path.relative_to(root)
        owner = relative.parts[0]
        package_parts = ["implicity_api", "modules", *relative.parts[:-1]]
        package = ".".join(package_parts)
        for node in ast.walk(ast.parse(path.read_text(), filename=str(path))):
            if isinstance(node, ast.Attribute):
                assert node.attr not in {
                    "_session",
                    "_ModuleStore__engine",
                    "connection",
                    "connect",
                    "execute",
                    "scalars",
                    "scalar",
                }, f"{owner} bypasses its owner-bound store"
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                module = (
                    resolve_name("." * node.level + (node.module or ""), package)
                    if node.level
                    else (node.module or "")
                )
                names = [module]
                if module.startswith("implicity_api.models."):
                    model_owner = module.rsplit(".", 1)[-1]
                    assert model_owner == owner, f"{owner} imports {model_owner} models"
                if module == "implicity_api.models":
                    for alias in node.names:
                        assert alias.name == owner, (
                            f"{owner} imports {alias.name} models"
                        )
                if module in {"implicity_api.stores", "implicity_api.modules"}:
                    for alias in node.names:
                        assert alias.name == owner, (
                            f"{owner} imports {alias.name} boundary"
                        )
                if module.startswith("implicity_api.stores."):
                    store_owner = module.rsplit(".", 1)[-1]
                    assert store_owner == owner, f"{owner} imports {store_owner} store"
                if module.startswith("implicity_api.modules."):
                    module_owner = module.rsplit(".", 1)[-1]
                    assert module_owner == owner, (
                        f"{owner} imports {module_owner} module"
                    )
            else:
                continue
            for name in names:
                assert not name.startswith(("sqlalchemy", "sqlite3")), (
                    f"{owner} accesses the database directly"
                )
                if name.startswith("implicity_api.models."):
                    model_owner = name.rsplit(".", 1)[-1]
                    assert model_owner == owner, f"{owner} imports {model_owner} models"
                if name.startswith("implicity_api.stores."):
                    store_owner = name.rsplit(".", 1)[-1]
                    assert store_owner == owner, f"{owner} imports {store_owner} store"
                if name.startswith("implicity_api.modules."):
                    module_owner = name.rsplit(".", 1)[-1]
                    assert module_owner == owner, (
                        f"{owner} imports {module_owner} module"
                    )
                assert not name.startswith(
                    ("implicity_api.db", "implicity_api.persistence")
                ), f"{owner} bypasses its owner-bound store"


def test_migrations_are_isolated_and_round_trip_every_owned_table(
    tmp_path, monkeypatch
):
    database = tmp_path / "isolated.db"
    decoy = tmp_path / "decoy.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{decoy}")
    config = Config(str(API_ROOT / "alembic.ini"))
    connection = create_engine(f"sqlite:///{database}").connect()
    config.attributes["connection"] = connection
    try:
        command.upgrade(config, "head")
        expected = set().union(*TABLES_BY_OWNER.values())
        assert set(inspect(connection).get_table_names()) == expected | {
            "alembic_version"
        }
        assert connection.exec_driver_sql(
            "SELECT version_num FROM alembic_version"
        ).scalar_one()
        assert not decoy.exists()

        command.downgrade(config, "base")
        assert inspect(connection).get_table_names() == ["alembic_version"]
        assert (
            connection.exec_driver_sql(
                "SELECT version_num FROM alembic_version"
            ).first()
            is None
        )

        command.upgrade(config, "head")
        command.check(config)
        assert set(inspect(connection).get_table_names()) == expected | {
            "alembic_version"
        }
    finally:
        connection.close()


def test_unattached_message_spec_migration_keeps_rows_and_guards_downgrade(tmp_path):
    database = tmp_path / "unattached-specs.db"
    bind = create_engine(f"sqlite:///{database}")
    connection = bind.connect()
    config = Config(str(API_ROOT / "alembic.ini"))
    config.attributes["connection"] = connection
    try:
        command.upgrade(config, "head")
        app_store = create_store("app", bind)
        app_store.insert(MessageSpec(id="linked", session_id="s1", data=SPEC))
        app_store.insert(MessageSpec(id="pending", session_id=None, data=SPEC))

        with pytest.raises(RuntimeError, match="unattached message specs exist"):
            command.downgrade(config, "0003_agent_session_instructions")
        assert app_store.get(MessageSpec, "pending") is not None

        app_store.delete_unattached_message_specs_before(
            datetime.now(timezone.utc) + timedelta(seconds=1)
        )
        command.downgrade(config, "0003_agent_session_instructions")
        columns = {
            column["name"]: column
            for column in inspect(connection).get_columns("message_specs")
        }
        assert not columns["session_id"]["nullable"]
        assert "created_at" not in columns
    finally:
        connection.close()


def test_table_ownership_is_keyed_by_owner_and_matches_storage_contract():
    assert {
        owner: set(metadata.tables) for owner, metadata in METADATA.items()
    } == TABLES_BY_OWNER
    migration = runpy.run_path(
        str(API_ROOT / "migrations/versions/0001_module_tables.py")
    )
    migration_tables = {
        owner: set(tables) for owner, tables in migration["TABLES_BY_OWNER"].items()
    }
    assert migration_tables["agent"] == TABLES_BY_OWNER["agent"] - {"quota_settings"}
    assert {
        owner: tables for owner, tables in migration_tables.items() if owner != "agent"
    } == {
        owner: tables for owner, tables in TABLES_BY_OWNER.items() if owner != "agent"
    }
    quota_settings_migration = runpy.run_path(
        str(API_ROOT / "migrations/versions/0002_agent_quota_settings.py")
    )
    assert quota_settings_migration["down_revision"] == migration["revision"]
    instructions_migration = runpy.run_path(
        str(API_ROOT / "migrations/versions/0003_agent_session_instructions.py")
    )
    assert (
        instructions_migration["down_revision"] == quota_settings_migration["revision"]
    )
    message_spec_migration = runpy.run_path(
        str(API_ROOT / "migrations/versions/0004_unattached_message_specs.py")
    )
    assert message_spec_migration["down_revision"] == instructions_migration["revision"]
    assert "instructions" in AgentSession.__table__.c
    assert migration["SESSION_REQUIRED"] == {
        "messages",
        "message_specs",
        "agent_sessions",
    }
    assert not Message.__table__.c.session_id.nullable
    assert MessageSpec.__table__.c.session_id.nullable
    assert not AgentSession.__table__.c.session_id.nullable


def test_contracts_are_a_direct_api_dependency():
    project = tomllib.loads((API_ROOT / "pyproject.toml").read_text())
    assert "implicity-contracts" in project["project"]["dependencies"]


def test_session_derived_rows_require_session_id(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'session-rows.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    agent_store = create_store("agent", bind)
    for row, store in (
        (
            Message(
                id="message", session_id=None, conversation_id="conversation", data={}
            ),
            app_store,
        ),
        (AgentSession(id="agent-session", session_id=None, data={}), agent_store),
    ):
        with pytest.raises(ValueError, match="requires session_id"):
            store.insert(row)
    assert (
        app_store.insert(
            MessageSpec(id="unattached", session_id=None, data=SPEC)
        ).session_id
        is None
    )


def test_default_database_and_backup_path_are_anchored_to_the_repository(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    expected = PROJECT_ROOT / "data" / "implicity.db"
    assert Path(make_url(database_url()).database) == expected
    assert database_path() == expected


def test_alembic_config_works_from_a_different_directory_and_uses_shared_database(
    tmp_path,
):
    database = tmp_path / "from-root.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{database}"}
    result = subprocess.run(
        [
            "uv",
            "run",
            "--project",
            str(API_ROOT.parent),
            "--locked",
            "alembic",
            "-c",
            str(API_ROOT / "alembic.ini"),
            "upgrade",
            "head",
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert set(inspect(create_engine(f"sqlite:///{database}")).get_table_names()) == (
        set().union(*TABLES_BY_OWNER.values()) | {"alembic_version"}
    )


def test_owner_bound_stores_block_cross_owner_reads_writes_and_raw_sql(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'store.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    engine_store = create_store("engine", bind)
    fixture = app_store.insert(Conversation(id="fixture", session_id=None, data={}))
    assert fixture.id == "fixture"

    with pytest.raises(PermissionError, match="app.conversations"):
        engine_store.get(Conversation, "fixture")
    with pytest.raises(PermissionError, match="app.conversations"):
        engine_store.select(select(Conversation))
    with pytest.raises(PermissionError, match="app.conversations"):
        engine_store.select(select(Decision, Conversation))
    with pytest.raises(PermissionError, match="app.conversations"):
        engine_store.select(
            select(Decision).join(Conversation, Decision.id == Conversation.id)
        )
    with pytest.raises(PermissionError, match="app.conversations"):
        engine_store.select(select(table("conversations", column("id"))))
    with pytest.raises(PermissionError):
        engine_store.select(text("SELECT * FROM conversations"))
    with pytest.raises(PermissionError):
        engine_store.select(
            select(
                Decision.id,
                text("(SELECT data FROM conversations WHERE id='fixture')"),
            )
        )
    with pytest.raises(PermissionError):
        engine_store.select(
            select(
                Decision.id,
                literal_column("(SELECT data FROM conversations WHERE id='fixture')"),
            )
        )
    with pytest.raises(PermissionError, match="app.conversations"):
        engine_store.insert(Conversation(id="cross-write", session_id=None, data={}))
    assert not hasattr(engine_store, "connection")

    own = engine_store.insert(
        Decision(id=DECISION["id"], session_id=None, data=DECISION)
    )
    assert engine_store.get(Decision, own.id).data == {
        **DECISION,
        "created_at": "2026-11-24T00:00:00Z",
    }


def test_modules_use_only_owner_bound_stores_and_no_direct_database_imports():
    check_module_boundaries()


def test_contract_payloads_round_trip_and_reject_invalid_decisions_and_specs(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'contracts.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    engine_store = create_store("engine", bind)
    app_store = create_store("app", bind)
    engine_store.insert(Decision(id=DECISION["id"], session_id=None, data=DECISION))
    app_store.insert(MessageSpec(id="spec-1", session_id="session-1", data=SPEC))

    assert engine_store.get(Decision, DECISION["id"]).data == {
        **DECISION,
        "created_at": "2026-11-24T00:00:00Z",
    }
    assert app_store.get(MessageSpec, "spec-1").data == SPEC
    with pytest.raises(ValueError):
        engine_store.insert(
            Decision(
                id=DECISION["id"],
                session_id=None,
                data={**DECISION, "unexpected": True},
            )
        )
    with pytest.raises(ValueError, match="row id"):
        engine_store.insert(Decision(id="different", session_id=None, data=DECISION))
    with pytest.raises(ValueError):
        engine_store.insert(Decision(id=DECISION["id"], session_id=None, data=[]))
    assert (
        app_store.insert(
            MessageSpec(id="unattached", session_id=None, data=SPEC)
        ).session_id
        is None
    )
    with pytest.raises(ValueError):
        app_store.insert(
            MessageSpec(
                id="bad-spec", session_id="session-1", data={"unexpected": True}
            )
        )


def test_module_source_violations_are_rejected(tmp_path):
    root = tmp_path / "modules"
    engine = root / "engine"
    engine.mkdir(parents=True)
    (engine / "direct_sql.py").write_text(
        "from sqlalchemy import text\nfrom implicity_api.db import engine\n"
    )
    with pytest.raises(AssertionError, match="directly|bypasses"):
        check_module_boundaries(root)
    (engine / "direct_sql.py").unlink()
    (engine / "foreign_model.py").write_text(
        "from implicity_api.models.app import Conversation\n"
    )
    with pytest.raises(AssertionError, match="imports app models"):
        check_module_boundaries(root)
    (engine / "foreign_model.py").unlink()
    (engine / "private_session.py").write_text(
        "from implicity_api.stores.engine import store\n"
        "store._session().connection().exec_driver_sql('SELECT 1')\n"
    )
    with pytest.raises(AssertionError, match="bypasses its owner-bound store"):
        check_module_boundaries(root)
    (engine / "private_session.py").unlink()
    (engine / "relative_import.py").write_text(
        "from ...models.app import Conversation\nfrom ..app import store\n"
    )
    with pytest.raises(AssertionError, match="imports app"):
        check_module_boundaries(root)
    (engine / "relative_import.py").write_text("from ..app import store\n")
    with pytest.raises(AssertionError, match="imports app module"):
        check_module_boundaries(root)


def test_backup_requires_existing_file_and_accepts_sqlite_driver_urls(tmp_path):
    missing = tmp_path / "missing.db"
    backups = tmp_path / "backups" / missing.name
    backups.mkdir(parents=True)
    previous = backups / "2026-11-20.db"
    previous.touch()
    with pytest.raises(FileNotFoundError):
        backup_database(missing, tmp_path / "backups")
    assert list(backups.iterdir()) == [previous]
    assert (
        database_path(f"sqlite+pysqlite:///{tmp_path / 'example.db'}")
        == tmp_path / "example.db"
    )


def test_backup_cli_fails_without_touching_missing_source_or_recovery_points(tmp_path):
    missing = tmp_path / "missing.db"
    backups = tmp_path / "backups" / missing.name
    backups.mkdir(parents=True)
    recovery = backups / "2026-11-20.db"
    recovery.touch()
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{missing}"}
    result = subprocess.run(
        [sys.executable, "-m", "implicity_api.backup"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert not missing.exists()
    assert list(backups.iterdir()) == [recovery]


def test_backup_keeps_only_seven_valid_dated_snapshots_and_restore_replaces_database(
    tmp_path,
):
    source = tmp_path / "live.db"
    with create_engine(f"sqlite:///{source}").begin() as connection:
        connection.exec_driver_sql("CREATE TABLE saved (value TEXT)")
        connection.exec_driver_sql("INSERT INTO saved VALUES ('before')")
    backup_root = tmp_path / "backups"
    backups = backup_root / source.name
    backups.mkdir(parents=True)
    for day in range(1, 10):
        (backups / f"2026-10-{day:02}.db").touch()
    unrelated = backups / "2000-unrelated.db"
    unrelated.touch()
    malformed = backups / "2026-13-44.db"
    malformed.touch()

    result = backup_database(source, backup_root, date(2026, 11, 24))
    names = {path.name for path in backups.iterdir()}
    assert names == {
        "2026-10-04.db",
        "2026-10-05.db",
        "2026-10-06.db",
        "2026-10-07.db",
        "2026-10-08.db",
        "2026-10-09.db",
        "2026-11-24.db",
        unrelated.name,
        malformed.name,
    }
    with create_engine(f"sqlite:///{source}").begin() as connection:
        connection.exec_driver_sql("INSERT INTO saved VALUES ('after')")
    shutil.copy2(result, source)
    with sqlite3.connect(source) as restored:
        assert restored.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert restored.execute("SELECT value FROM saved").fetchall() == [("before",)]


def test_two_co_located_databases_get_distinct_explicit_and_startup_snapshots(
    tmp_path,
):
    first, second = tmp_path / "records.db", tmp_path / "records.sqlite"
    for database, value in ((first, "first"), (second, "second")):
        with create_engine(f"sqlite:///{database}").begin() as connection:
            connection.exec_driver_sql("CREATE TABLE saved (value TEXT)")
            connection.exec_driver_sql("INSERT INTO saved VALUES (?)", (value,))
    day = date(2026, 11, 25)

    first_explicit = backup_database(first, day=day)
    second_explicit = backup_database(second, day=day)
    assert first_explicit != second_explicit
    assert first_explicit.parent != second_explicit.parent

    first_startup = backup.ensure_daily_backup(first, day)
    second_startup = backup.ensure_daily_backup(second, day)
    assert first_startup == first_explicit
    assert second_startup == second_explicit
    for snapshot, value in ((first_startup, "first"), (second_startup, "second")):
        with sqlite3.connect(snapshot) as connection:
            assert connection.execute("SELECT value FROM saved").fetchone() == (value,)


def test_startup_catchup_for_second_database_is_not_suppressed_by_first(tmp_path):
    first, second = tmp_path / "records.db", tmp_path / "records.sqlite"
    for database, value in ((first, "one"), (second, "two")):
        with create_engine(f"sqlite:///{database}").begin() as connection:
            connection.exec_driver_sql("CREATE TABLE saved (value TEXT)")
            connection.exec_driver_sql("INSERT INTO saved VALUES (?)", (value,))
    day = date(2026, 11, 25)
    first_snapshot = backup_database(first, day=day)

    assert backup.ensure_daily_backup(first, day) == first_snapshot
    second_snapshot = backup.ensure_daily_backup(second, day)

    assert second_snapshot != first_snapshot
    with sqlite3.connect(second_snapshot) as connection:
        assert connection.execute("SELECT value FROM saved").fetchone() == ("two",)


def test_lifespan_catches_up_after_midnight_was_missed(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from implicity_api import app as app_module
    from implicity_api import backup

    live_db = tmp_path / "live.db"
    with create_engine(f"sqlite:///{live_db}").begin() as connection:
        connection.exec_driver_sql("CREATE TABLE saved (value TEXT)")
        connection.exec_driver_sql("INSERT INTO saved VALUES ('today')")
    backup_dir = tmp_path / "backups" / live_db.name
    current = [datetime(2026, 11, 24, 12)]
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{live_db}")
    copied = threading.Event()
    copy_count = [0]
    count_lock = threading.Lock()
    original = backup.backup_database

    def track_copy(*args, **kwargs):
        path = original(*args, **kwargs)
        with count_lock:
            copy_count[0] += 1
            if copy_count[0] == 2:
                copied.set()
        return path

    sleep_calls = 0

    async def advance_to_next_backup(_seconds):
        nonlocal sleep_calls
        sleep_calls += 1
        if sleep_calls == 1:
            current[0] += timedelta(seconds=_seconds)
            assert current[0] == datetime(2026, 11, 25)
            await asyncio.sleep(0)
        else:
            await asyncio.sleep(3600)

    async def scheduled_task():
        await backup.daily_backups(now=lambda: current[0], sleep=advance_to_next_backup)

    import asyncio

    monkeypatch.setattr(backup, "backup_database", track_copy)
    monkeypatch.setattr(app_module, "daily_backups", scheduled_task)
    with TestClient(app_module.app) as client:
        assert client.get("/health").status_code == 200
        assert copied.wait(timeout=3)
    assert (backup_dir / "2026-11-24.db").exists()
    assert (backup_dir / "2026-11-25.db").exists()
