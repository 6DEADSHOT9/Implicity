import json
import re
from pathlib import Path

import anyio
import httpx2
import pytest
from fastapi.testclient import TestClient
from implicity_api.mcp import create_server
from implicity_api.models import METADATA
from implicity_api.models.app import Message, MessageSpec
from implicity_api.modules import app as app_module
from implicity_api.persistence import create_store
from mcp import Client
from mcp.client.streamable_http import streamable_http_client
from sqlalchemy import create_engine, event

REGISTRY = {
    "registry_version": 2,
    "components": ["Card", "AppShell"],
    "catalogue": [
        {
            "name": "Card",
            "role": "content",
            "props_schema": {
                "type": "object",
                "properties": {"title": {"type": "string", "maxLength": 5}},
                "required": ["title"],
                "additionalProperties": False,
            },
            "slots": ["body"],
            "slots_schema": {
                "type": "object",
                "properties": {"body": {"type": "array", "items": {"type": "string"}}},
                "additionalProperties": False,
            },
            "limits": {"minWidth": 160, "minHeight": 80, "minContrast": 4.5},
        },
        {
            "name": "AppShell",
            "role": "shell",
            "props_schema": {"type": "object", "properties": {}},
            "slots": [],
            "slots_schema": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
            "limits": {"minWidth": 320, "minHeight": 240, "minContrast": 4.5},
        },
    ],
}
NON_SPEC_CONTRACT = {
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-11-24T00:00:00.000Z",
    "contracts_version": 1,
    "session_id": "550e8400-e29b-41d4-a716-446655440001",
    "layout_version": 1,
    "registry_version": 2,
    "device_class": "desktop",
    "input_type": "mouse",
    "name": "session_started",
    "mode": "light",
    "text_scale": 1,
    "local_hour_bucket": "night",
}
ROOT = Path(__file__).parents[2]


@pytest.fixture
def registry_file(tmp_path):
    path = tmp_path / "registry-v2.json"
    path.write_text(json.dumps(REGISTRY))
    current = tmp_path / "registry.json"
    current.write_text(path.read_text())
    return current


def test_catalogue_uses_current_registry_and_filters_by_role(registry_file):
    async def check():
        async with Client(create_server(registry_file=registry_file)) as client:
            assert client.server_info.name == "Implicity"
            result = await client.call_tool("catalogue", {})
            catalogue = json.loads(result.content[0].text)
            assert [item["name"] for item in catalogue["components"]] == [
                "Card",
                "AppShell",
            ]
            assert catalogue["registry_version"] == 2
            assert catalogue["components"] == REGISTRY["catalogue"]

            filtered = await client.call_tool("catalogue", {"role": "content"})
            filtered_catalogue = json.loads(filtered.content[0].text)
            assert [item["name"] for item in filtered_catalogue["components"]] == [
                "Card"
            ]
            invalid_role = await client.call_tool("catalogue", {"role": "unknown"})
            assert invalid_role.is_error

            tools = await client.list_tools()
            assert {tool.name for tool in tools.tools} == {"catalogue", "render"}

    anyio.run(check)


def test_catalogue_default_registry_is_the_highest_committed_snapshot():
    versions = [
        int(re.fullmatch(r"registry-v(\d+)\.json", path.name)[1])
        for path in (ROOT / "contracts/generated/components").glob("registry-v*.json")
    ]

    async def check():
        async with Client(create_server()) as client:
            result = await client.call_tool("catalogue", {})
            catalogue = json.loads(result.content[0].text)
            assert catalogue["registry_version"] == max(versions)

    anyio.run(check)


def test_mcp_is_reachable_from_the_api_over_streamable_http(monkeypatch):
    import implicity_api.app as app_module
    from implicity_api.app import create_app

    app = create_app()

    async def idle():
        await anyio.sleep_forever()

    monkeypatch.setattr(app_module, "daily_backups", idle)
    monkeypatch.setattr(app_module, "discard_unattached_message_specs", lambda: None)

    async def check():
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app), base_url="http://localhost:8000"
        ) as http:
            async with Client(
                streamable_http_client("http://localhost:8000/mcp", http_client=http)
            ) as client:
                assert {tool.name for tool in (await client.list_tools()).tools} == {
                    "catalogue",
                    "render",
                }

    with TestClient(app):
        anyio.run(check)


def test_api_discards_expired_specs_at_startup(monkeypatch):
    import implicity_api.app as app_module
    from implicity_api.app import create_app

    calls = []

    async def idle():
        await anyio.sleep_forever()

    monkeypatch.setattr(app_module, "daily_backups", idle)
    monkeypatch.setattr(
        app_module,
        "discard_unattached_message_specs",
        lambda: calls.append("cleanup"),
    )

    with TestClient(create_app()):
        assert calls == ["cleanup"]


def test_render_validates_and_stores_unattached_spec_through_mcp(
    registry_file, tmp_path
):
    bind = create_engine(f"sqlite:///{tmp_path / 'mcp.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    spec = {
        "registry_version": 2,
        "root": "card",
        "elements": {"card": {"type": "Card", "props": {"title": "Hello"}}},
    }

    async def check():
        async with Client(create_server(registry_file, app_store)) as client:
            result = await client.call_tool("render", {"message_spec": spec})
            assert not result.is_error
            spec_id = json.loads(result.content[0].text)["id"]
            stored = app_store.get(MessageSpec, spec_id)
            assert stored.data == spec
            assert stored.session_id is None

    anyio.run(check)


def test_python_render_validates_the_zod_mapped_catalogue_fixture(tmp_path):
    registry_file = ROOT / "web/tests/fixtures/catalogue.json"
    bind = create_engine(f"sqlite:///{tmp_path / 'mapped-catalogue.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    spec = {
        "registry_version": 2,
        "root": "panel",
        "elements": {
            "panel": {
                "type": "ReviewPanel",
                "props": {"count": 4},
                "slots": {"main": []},
            }
        },
    }

    async def check():
        async with Client(create_server(registry_file, app_store)) as client:
            result = await client.call_tool("render", {"message_spec": spec})
            assert not result.is_error

    anyio.run(check)


def test_render_rejects_invalid_specs_without_storing(registry_file, tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'mcp-invalid.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    valid = {
        "registry_version": 2,
        "root": "card",
        "elements": {"card": {"type": "Card", "props": {"title": "Hello"}}},
    }
    invalid_specs = [
        (
            {**valid, "elements": {"card": {"type": "Ghost", "props": {}}}},
            "Unknown component",
        ),
        (
            {**valid, "elements": {"card": {"type": "Card", "props": {"title": 3}}}},
            "Invalid Card props",
        ),
        (
            {
                **valid,
                "elements": {
                    "card": {
                        "type": "Card",
                        "props": {"title": "Hello"},
                        "slots": {"missing": []},
                    }
                },
            },
            "Invalid Card props or slots",
        ),
        (
            {
                **valid,
                "elements": {"card": {"type": "Card", "props": {"title": "too long"}}},
            },
            "Invalid Card props or slots",
        ),
        (
            {
                **valid,
                "elements": {
                    "card": {
                        "type": "Card",
                        "props": {"title": "Hello"},
                        "slots": {"body": ["card"]},
                    }
                },
            },
            "cyclic slot reference",
        ),
        ({**valid, "registry_version": 1}, "registry_version is not current"),
        ({**valid, "root": "missing"}, "root does not exist"),
        (
            {
                **valid,
                "elements": {
                    "card": {
                        "type": "Card",
                        "props": {"title": "Hello"},
                        "slots": {"body": ["missing"]},
                    }
                },
            },
            "Slot refers to unknown element",
        ),
        (NON_SPEC_CONTRACT, "Input must be a message spec"),
        (
            {
                "registry_version": 2,
                "root": "node-0",
                "elements": {
                    f"node-{index}": {
                        "type": "Card",
                        "props": {"title": "Hi"},
                    }
                    for index in range(201)
                },
            },
            "exceeds 200 elements",
        ),
        (
            {
                "registry_version": 2,
                "root": "node-0",
                "elements": {
                    f"node-{index}": {
                        "type": "Card",
                        "props": {"title": "Hi"},
                        **(
                            {"slots": {"body": [f"node-{index + 1}"]}}
                            if index < 10
                            else {}
                        ),
                    }
                    for index in range(11)
                },
            },
            "nesting exceeds 10 levels",
        ),
    ]

    async def check():
        async with Client(create_server(registry_file, app_store)) as client:
            for message_spec, error in invalid_specs:
                result = await client.call_tool(
                    "render", {"message_spec": message_spec}
                )
                assert result.is_error
                assert error in result.content[0].text
        assert app_store.list(MessageSpec) == []

    anyio.run(check)


def test_app_attaches_rendered_spec_to_assistant_message_atomically(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'attach.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    app_store.insert(
        Message(id="message-1", session_id="session-1", data={"text": "Hello"})
    )
    spec_id = app_module.save_message_spec(
        {"registry_version": 2, "root": "card", "elements": {}}, app_store
    )

    app_module.attach_message_spec("message-1", spec_id, app_store)
    attached_message = app_store.get(Message, "message-1")
    app_module.attach_message_spec("message-1", spec_id, app_store)

    assert attached_message.data["message_spec_id"] == spec_id
    assert app_store.get(Message, "message-1").data == attached_message.data
    assert app_store.get(MessageSpec, spec_id).session_id == "session-1"


def test_app_attach_refuses_reuse_and_overwrite_with_distinct_errors(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'attach-errors.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    for message_id, session_id, data in (
        ("m1", "s1", {}),
        ("m2", "s1", {}),
        ("m3", "s2", {}),
    ):
        app_store.insert(Message(id=message_id, session_id=session_id, data=data))
    first = app_module.save_message_spec(
        {"registry_version": 2, "root": "card", "elements": {}}, app_store
    )
    second = app_module.save_message_spec(
        {"registry_version": 2, "root": "card", "elements": {}}, app_store
    )

    with pytest.raises(app_module.MessageNotFoundError):
        app_module.attach_message_spec("missing", first, app_store)
    with pytest.raises(app_module.MessageSpecNotFoundError):
        app_module.attach_message_spec("m1", "missing", app_store)
    app_module.attach_message_spec("m1", first, app_store)
    for message_id in ("m2", "m3"):
        with pytest.raises(app_module.MessageSpecAlreadyAttachedError):
            app_module.attach_message_spec(message_id, first, app_store)
    with pytest.raises(app_module.MessageAlreadyHasSpecError):
        app_module.attach_message_spec("m1", second, app_store)
    assert app_store.get(Message, "m2").data == {}
    assert app_store.get(Message, "m3").data == {}


def test_app_attach_rolls_back_both_rows_when_second_write_fails(tmp_path):
    bind = create_engine(f"sqlite:///{tmp_path / 'attach-rollback.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    message = Message(id="m1", session_id="s1", data={"text": "answer"})
    app_store.insert(message)
    spec_id = app_module.save_message_spec(
        {"registry_version": 2, "root": "card", "elements": {}}, app_store
    )
    updates = 0

    def fail_second_write(
        _connection, _cursor, statement, _parameters, _context, _many
    ):
        nonlocal updates
        if statement.lstrip().upper().startswith("UPDATE"):
            updates += 1
            if updates == 2:
                raise RuntimeError("second write failed")

    event.listen(bind, "before_cursor_execute", fail_second_write)
    try:
        with pytest.raises(RuntimeError, match="second write failed"):
            app_module.attach_message_spec("m1", spec_id, app_store)
    finally:
        event.remove(bind, "before_cursor_execute", fail_second_write)

    assert updates == 2
    assert app_store.get(Message, "m1").data == {"text": "answer"}
    assert app_store.get(MessageSpec, spec_id).session_id is None


def test_app_discards_only_expired_unattached_specs(tmp_path):
    from datetime import datetime, timedelta, timezone

    bind = create_engine(f"sqlite:///{tmp_path / 'retention.db'}")
    for metadata in METADATA.values():
        metadata.create_all(bind)
    app_store = create_store("app", bind)
    now = datetime.now(timezone.utc)
    old = now - app_module.UNATTACHED_MESSAGE_SPEC_RETENTION - timedelta(seconds=1)
    app_store.insert(
        MessageSpec(
            id="expired",
            session_id=None,
            data={"registry_version": 2, "root": "card", "elements": {}},
            created_at=old,
        )
    )
    app_store.insert(
        MessageSpec(
            id="attached",
            session_id="session-1",
            data={"registry_version": 2, "root": "card", "elements": {}},
            created_at=old,
        )
    )
    app_store.insert(
        MessageSpec(
            id="fresh",
            session_id=None,
            data={"registry_version": 2, "root": "card", "elements": {}},
            created_at=now,
        )
    )
    app_store.insert(Message(id="race-message", session_id="s-race", data={}))
    app_store.insert(
        MessageSpec(
            id="race",
            session_id=None,
            data={"registry_version": 2, "root": "card", "elements": {}},
            created_at=old,
        )
    )

    class AttachDuringDelete:
        delete_calls = 0

        def delete_unattached_message_specs_before(self, cutoff):
            self.delete_calls += 1
            app_module.attach_message_spec("race-message", "race", app_store)
            return app_store.delete_unattached_message_specs_before(cutoff)

    racing_store = AttachDuringDelete()
    app_module.discard_unattached_message_specs(racing_store, now)

    assert app_store.get(MessageSpec, "expired") is None
    assert app_store.get(MessageSpec, "attached") is not None
    assert app_store.get(MessageSpec, "fresh") is not None
    assert app_store.get(MessageSpec, "race").session_id == "s-race"
    assert app_store.get(Message, "race-message").data["message_spec_id"] == "race"
    assert racing_store.delete_calls == 1
