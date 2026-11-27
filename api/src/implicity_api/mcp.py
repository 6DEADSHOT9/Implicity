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

PROJECT_ROOT = Path(__file__).resolve().parents[3]
REGISTRY_FILE = PROJECT_ROOT / "contracts/generated/components/registry.json"
Role = Literal["shell", "content", "panel", "home", "system"]
MAX_MESSAGE_SPEC_ELEMENTS = 200
MAX_MESSAGE_SPEC_DEPTH = 10


def create_server(registry_file: Path = REGISTRY_FILE, store=app_store) -> MCPServer:
    server = MCPServer("Implicity")

    def read_registry() -> dict[str, Any]:
        return json.loads(registry_file.read_text())

    def graph_error(elements: dict[str, Any], root: str) -> str | None:
        state: dict[str, int] = {}
        for start in elements:
            if state.get(start) == 2:
                continue
            state[start] = 1
            stack = [(start, iter(_children(elements[start])))]
            while stack:
                element_id, children = stack[-1]
                child = next(children, None)
                if child is None:
                    state[element_id] = 2
                    stack.pop()
                elif state.get(child) == 1:
                    return "Message spec contains a cyclic slot reference"
                elif state.get(child) != 2:
                    state[child] = 1
                    stack.append((child, iter(_children(elements[child]))))

        deepest: dict[str, int] = {}
        stack = [(root, 1)]
        while stack:
            element_id, depth = stack.pop()
            if depth > MAX_MESSAGE_SPEC_DEPTH:
                return f"Message spec nesting exceeds {MAX_MESSAGE_SPEC_DEPTH} levels"
            if depth <= deepest.get(element_id, 0):
                continue
            deepest[element_id] = depth
            stack.extend(
                (child, depth + 1) for child in _children(elements[element_id])
            )
        return None

    def _children(element: dict[str, Any]) -> list[str]:
        return [
            child
            for children in element.get("slots", {}).values()
            for child in children
        ]

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

        if len(contract.elements) > MAX_MESSAGE_SPEC_ELEMENTS:
            raise ToolError(
                f"Message spec exceeds {MAX_MESSAGE_SPEC_ELEMENTS} elements"
            )
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
            if component["role"] == "shell":
                raise ToolError(
                    "Shell component cannot be used in a message spec: "
                    f"{element['type']}"
                )
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
        if error := graph_error(elements, contract.root):
            raise ToolError(error)

        stored = app_module.save_message_spec(
            json.loads(encode_contract(contract)), store
        )
        return {"id": stored}

    return server
