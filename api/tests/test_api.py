import os
import sqlite3
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_health_isolated_from_integrations_in_a_cold_process(tmp_path):
    database = tmp_path / "private.db"
    with sqlite3.connect(database) as connection:
        connection.execute(
            "CREATE TABLE message_specs (id TEXT PRIMARY KEY, session_id TEXT, "
            "data JSON NOT NULL, created_at DATETIME NOT NULL)"
        )
        connection.execute(
            "INSERT INTO message_specs VALUES ('expired', NULL, '{}', '2000-01-01')"
        )
    snapshot = (
        tmp_path / "backups" / database.name / f"{date.today().isoformat()}.db"
    )
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite:///{database}",
        "T14_SNAPSHOT_PATH": str(snapshot),
    }
    script = '''
import asyncio
import importlib
import json
import os
import socket
import sys
from pathlib import Path

attempts = []
forbidden = {"hermes", "posthog", "engine", "implicity_engine"}
assert not forbidden.intersection(name.split(".")[0] for name in sys.modules)

class ForbiddenFinder:
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".")[0] in forbidden:
            attempts.append(("import", fullname))
            raise AssertionError(f"forbidden import: {fullname}")
        return None

sys.meta_path.insert(0, ForbiddenFinder())
try:
    importlib.import_module("hermes")
except AssertionError:
    pass
else:
    raise AssertionError("dynamic import guard did not reject Hermes")
assert attempts == [("import", "hermes")]
attempts.clear()

def tracked_connect(_socket, address):
    attempts.append(("socket.connect", str(address)))
    return None

socket.socket.connect = tracked_connect

from implicity_api import backup
from implicity_api.app import app
from starlette.routing import Mount

async def get(path):
    messages = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    await app(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": path,
            "query_string": b"",
            "headers": [(b"host", b"test")],
        },
        receive,
        send,
    )
    start, *body = messages
    assert start["type"] == "http.response.start"
    assert body and all(message["type"] == "http.response.body" for message in body)
    return start["status"], b"".join(message.get("body", b"") for message in body)

async def check_health():
    loop = asyncio.get_running_loop()
    backup_finished = asyncio.Event()
    ensure_daily_backup = backup.ensure_daily_backup

    def track_backup(*args, **kwargs):
        try:
            return ensure_daily_backup(*args, **kwargs)
        finally:
            loop.call_soon_threadsafe(backup_finished.set)

    backup.ensure_daily_backup = track_backup

    async with app.router.lifespan_context(app):
        status, body = await get("/health")
        assert status == 200, status
        assert json.loads(body) == {"status": "ok"}, body
        assert any(
            route.path == "" and isinstance(route, Mount) for route in app.routes
        ), "root MCP mount is missing"
        assert await get("/unrelated-review-probe") == (404, b"Not Found")
        snapshot = Path(os.environ["T14_SNAPSHOT_PATH"])
        await asyncio.wait_for(backup_finished.wait(), timeout=3)
        assert snapshot.exists(), "startup backup did not complete"

asyncio.run(check_health())
assert attempts == [], f"integration attempts: {attempts}"
assert "implicity_api.mcp" not in sys.modules, "health loaded the MCP server"
assert "implicity_contracts.generated" not in sys.modules, "health loaded contracts"
assert "sqlalchemy.orm" not in sys.modules, "startup cleanup loaded the ORM"
'''
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT id FROM message_specs").fetchall() == []
