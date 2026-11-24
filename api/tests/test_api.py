from fastapi.testclient import TestClient
from implicity_api.app import app


def test_health_check():
    assert TestClient(app).get("/health").json() == {"status": "ok"}
