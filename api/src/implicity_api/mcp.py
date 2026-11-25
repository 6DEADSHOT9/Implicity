import json
from pathlib import Path
from typing import Any, Literal

from implicity_contracts.codec import decode_contract, encode_contract
from implicity_contracts.generated import Spec
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as JSONSchemaValidationError
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from implicity_api.modules import app as app_module
from implicity_api.modules.app import store as app_store

PROJECT_ROOT = Path(__file__).resolve().parents[4]
REGISTRY_FILE = PROJECT_ROOT / "contracts/generated/components/registry.json"
Role = Literal["shell", "content", "panel", "home", "system"]


def create_server(registry_file: Path = REGISTRY_FILE, store=app_store) -> MCPServer:
    server = MCPServer("Implicity")

    def read_registry() -> dict[str, Any]:
        return json.loads(registry_file.read_text())

    def has_cycle(elements: dict[str, Any]) -> bool:
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(element_id: str) -> bool:
            if element_id in visiting:
                return True
            if element_id in visited:
                return False
            visiting.add(element_id)
            for children in elements[element_id].get("slots", {}).values():
                if any(visit(child) for child in children):
                    return True
            visiting.remove(element_id)
            visited.add(element_id)
            return False

        return any(visit(element_id) for element_id in elements)

    @server.tool()
    def catalogue(role: Role | None = None) -> dict:
        """List reviewed components, their props schema, slots, and limits."""
        registry = read_registry()
        components = registry["catalogue"]
        if role is not None:
            components = [
                component for component in components if component["role"] == role
            ]
        return {
            "registry_version": registry["registry_version"],
            "components": components,
        }

    @server.tool()
    def render(message_spec: dict[str, Any]) -> dict[str, str]:
        """Validate and save one message spec, returning its app minted id."""
        try:
            contract = decode_contract(json.dumps(message_spec, allow_nan=False))
            if not isinstance(contract, Spec):
                raise ValueError("Input must be a message spec")
        except (JSONSchemaValidationError, TypeError, ValueError) as error:
            raise ToolError(f"Invalid message spec: {error}") from None

        registry = read_registry()
        components = {item["name"]: item for item in registry["catalogue"]}
        if contract.registry_version != registry["registry_version"]:
            raise ToolError("Message spec registry_version is not current")
        elements = {
            key: value.model_dump(exclude_none=True)
            for key, value in contract.elements.items()
        }
        if contract.root not in elements:
            raise ToolError("Message spec root does not exist")
        for element_id, element in elements.items():
            component = components.get(element["type"])
            if component is None:
                raise ToolError(f"Unknown component: {element['type']}")
            try:
                Draft202012Validator(component["props_schema"]).validate(
                    element["props"]
                )
                slots = element.get("slots", {})
                Draft202012Validator(component["slots_schema"]).validate(slots)
            except JSONSchemaValidationError as error:
                raise ToolError(
                    f"Invalid {element['type']} props or slots: {error.message}"
                ) from None
            for children in slots.values():
                for child in children:
                    if child not in elements:
                        raise ToolError(f"Slot refers to unknown element: {child}")
        if has_cycle(elements):
            raise ToolError("Message spec contains a cyclic slot reference")

        stored = app_module.save_message_spec(
            json.loads(encode_contract(contract)), store
        )
        return {"id": stored}

    return server
