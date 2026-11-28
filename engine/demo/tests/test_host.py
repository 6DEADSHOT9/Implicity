from fastapi.testclient import TestClient
from implicity_engine_demo.host import create_app


def test_canned_counts_pass_gate_and_keep_change() -> None:
    client = TestClient(create_app())

    assert client.get("/state?kind=coding").json()["values"]["long_answers"] == "folded"
    assert client.post("/demo/session").json()["status"] == "admitted"
    notice = client.get("/notices").json()[0]
    assert notice["to"] == "open"
    assert client.post(f"/notices/{notice['id']}/shown").status_code == 204
    assert client.post(f"/decisions/{notice['id']}/keep").json()["status"] == "admitted"
    assert client.get("/state?kind=coding").json()["values"]["long_answers"] == "open"
    assert client.post("/demo/session").json()["status"] == "no_change"


def test_undo_restores_previous_value_and_blocks_it() -> None:
    client = TestClient(create_app())

    assert client.post("/demo/session").json()["status"] == "admitted"
    notice = client.get("/notices").json()[0]
    assert client.post(f"/decisions/{notice['id']}/undo").json()["status"] == "admitted"
    assert client.get("/state?kind=coding").json()["values"]["long_answers"] == "folded"
    assert client.post("/demo/session").json()["status"] == "no_change"
