import json
from pathlib import Path

SCHEMA = Path(__file__).parents[2] / "contracts/schemas/index.json"


def test_event_contracts_cannot_carry_content_or_key_identities():
    definitions = json.loads(SCHEMA.read_text())["$defs"]
    event_schemas = {
        name: schema
        for name, schema in definitions.items()
        if name in {"ActionEvent", "TurnSummary", "SessionSummary"}
    }
    assert set(event_schemas) == {"ActionEvent", "TurnSummary", "SessionSummary"}
    forbidden = {
        "text",
        "message",
        "file",
        "file_name",
        "filename",
        "key",
        "keys",
        "key_identity",
    }

    def property_names(schema):
        yield from schema.get("properties", {})
        for value in schema.values():
            if isinstance(value, dict):
                yield from property_names(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        yield from property_names(item)

    for name, schema in event_schemas.items():
        assert not forbidden.intersection(property_names(schema)), name
        assert (
            schema.get("unevaluatedProperties") is False
            or schema.get("additionalProperties") is False
        )
