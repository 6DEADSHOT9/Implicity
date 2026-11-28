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

from httpx import ASGITransport, AsyncClient
from implicity_api import backup
from implicity_api.app import app
from starlette.routing import Mount

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
        async with AsyncClient(
            transport=ASGITransport(app), base_url="http://test"
        ) as client:
            response = await client.get("/health")
        assert response.status_code == 200, response.status_code
        assert response.json() == {"status": "ok"}, response.text
        assert any(
            route.path == "" and isinstance(route, Mount) for route in app.routes
        ), "root MCP mount is missing"
        snapshot = Path(os.environ["T14_SNAPSHOT_PATH"])
        await asyncio.wait_for(backup_finished.wait(), timeout=3)
        assert snapshot.exists(), "startup backup did not complete"

asyncio.run(check_health())
assert attempts == [], f"integration attempts: {attempts}"
assert "implicity_api.mcp" not in sys.modules, "health loaded the MCP server"
assert "implicity_contracts.generated" not in sys.modules, "health loaded contracts"
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
