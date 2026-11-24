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
        connection.execute("CREATE TABLE sentinel (value TEXT)")
    snapshot = (
        tmp_path / "backups" / database.name / f"{date.today().isoformat()}.db"
    )
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite:///{database}",
        "T14_SNAPSHOT_PATH": str(snapshot),
    }
    script = '''
import builtins
import importlib
import importlib.abc
from importlib.util import resolve_name
import os
import socket
import sys
import time
import types
from pathlib import Path

attempts = []
forbidden = {"hermes", "posthog", "engine", "implicity_engine"}
original_import = builtins.__import__
stubs = {}

class ForbiddenFinder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".")[0] in forbidden:
            attempts.append(("dynamic import", fullname))
            raise AssertionError(f"forbidden dynamic import: {fullname}")
        return None

sys.meta_path.insert(0, ForbiddenFinder())
try:
    importlib.import_module("hermes")
except AssertionError:
    pass
else:
    raise AssertionError("dynamic import guard did not reject Hermes")
assert attempts == [("dynamic import", "hermes")]
attempts.clear()

def tracked_module(name):
    module = types.ModuleType(name)
    def attribute_access(attribute):
        attempts.append(("attribute", name, attribute))
        def call(*args, **kwargs):
            attempts.append(("call", name, attribute))
            return None
        return call
    module.__getattr__ = attribute_access
    return module

def tracked_import(name, globals=None, locals=None, fromlist=(), level=0):
    target = (
        resolve_name("." * level + name, globals.get("__package__", ""))
        if level and globals
        else name
    )
    root = target.split(".")[0]
    if root in forbidden:
        attempts.append(("import", target))
        return stubs.setdefault(root, tracked_module(root))
    return original_import(name, globals, locals, fromlist, level)

def tracked_connect(_socket, address):
    attempts.append(("socket.connect", str(address)))
    return None

builtins.__import__ = tracked_import
socket.socket.connect = tracked_connect

from fastapi.testclient import TestClient
from implicity_api.app import app

with TestClient(app) as client:
    response = client.get("/health")
    assert (response.status_code, response.json()) == (200, {"status": "ok"})
    assert {route.path for route in app.routes} == {"/health"}
    snapshot = Path(os.environ["T14_SNAPSHOT_PATH"])
    deadline = time.monotonic() + 3
    while not snapshot.exists() and time.monotonic() < deadline:
        time.sleep(0.01)
    assert snapshot.exists(), "startup backup did not complete"

assert attempts == [], f"integration attempts: {attempts}"
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
