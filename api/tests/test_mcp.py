import json

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
from sqlalchemy import create_engine

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

    assert app_store.get(Message, "message-1").data["message_spec_id"] == spec_id
    assert app_store.get(MessageSpec, spec_id).session_id == "session-1"


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

    app_module.discard_unattached_message_specs(app_store, now)

    assert app_store.get(MessageSpec, "expired") is None
    assert app_store.get(MessageSpec, "attached") is not None
