import builtins
import importlib.abc
import socket

from fastapi.testclient import TestClient
from implicity_api.app import app


class ForbiddenIntegration(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".")[0] in {
            "engine",
            "hermes",
            "posthog",
            "implicity_engine",
        }:
            raise AssertionError(f"unexpected integration import: {fullname}")
        return None


def test_health_is_the_only_route_and_has_exact_response(monkeypatch):
    def block_connect(*args, **kwargs):
        raise AssertionError("unexpected outbound connection")

    monkeypatch.setattr(socket.socket, "connect", block_connect)
    original_import = builtins.__import__

    def block_import(name, *args, **kwargs):
        if name.split(".")[0] in {"engine", "hermes", "posthog", "implicity_engine"}:
            raise AssertionError(f"unexpected integration import: {name}")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", block_import)
    finder = ForbiddenIntegration()
    import sys

    sys.meta_path.insert(0, finder)
    try:
        with TestClient(app) as client:
            response = client.get("/health")
            assert (response.status_code, response.json()) == (200, {"status": "ok"})
            assert {route.path for route in app.routes} == {"/health"}
    finally:
        sys.meta_path.remove(finder)
