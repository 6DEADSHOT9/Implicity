import json
from pathlib import Path

import pytest
from implicity_contracts import decode_contract, encode_contract, generated
from implicity_contracts.freshness import schema_fingerprint
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError
from pydantic import ValidationError as PydanticValidationError

ROOT = Path(__file__).parents[2]
SCHEMA = json.loads((ROOT / "contracts/schemas/index.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
SHARED = {
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-11-24T00:00:00.000Z",
    "contracts_version": 1,
    "session_id": "550e8400-e29b-41d4-a716-446655440001",
    "layout_version": 1,
    "registry_version": 1,
    "device_class": "desktop",
    "input_type": "mouse",
}


def action(name, **fields):
    return {**SHARED, "name": name, **fields}


def valid_value(schema, field=""):
    if "const" in schema:
        return schema["const"]
    if "enum" in schema:
        return schema["enum"][0]
    if "oneOf" in schema or "anyOf" in schema:
        return valid_value((schema.get("anyOf") or schema["oneOf"])[0], field)
    if "$ref" in schema:
        name = schema["$ref"].split("/")[-1]
        return valid_value(SCHEMA["$defs"][name], field)
    if schema.get("format") == "uuid":
        return "550e8400-e29b-41d4-a716-446655440000"
    if schema.get("format") == "date-time":
        return "2026-11-24T00:00:00.000Z"
    types = schema.get("type")
    if isinstance(types, list):
        types = next((item for item in types if item != "null"), "null")
    if types == "object":
        return {
            key: valid_value(schema["properties"][key], key)
            for key in schema.get("required", [])
        }
    if types == "array":
        return []
    if types == "integer" or types == "number":
        return schema.get("minimum", 0)
    if types == "boolean":
        return False
    pattern = schema.get("pattern", "")
    if "550e8400" in pattern:
        return "550e8400-e29b-41d4-a716-446655440000"
    if "prop_" in pattern:
        return "prop_550e8400-e29b-41d4-a716-446655440002"
    if "dec_" in pattern:
        return "dec_550e8400-e29b-41d4-a716-446655440003"
    if "kind_" in pattern:
        return "kind_550e8400-e29b-41d4-a716-446655440004"
    if "cmd_" in pattern:
        return "cmd_550e8400-e29b-41d4-a716-446655440005"
    if field == "timestamp":
        return "2026-11-24T00:00:00.000Z"
    if field in {"from", "to"}:
        return "table"
    return "value"


def valid_event(definition):
    result = {}
    for field in definition["required"]:
        result[field] = valid_value(definition["properties"][field], field)
    if definition["properties"]["name"]["const"] == "representation_switched":
        result.update(dimension="data_form", **{"from": "table", "to": "chart"})
    return result


def schema_fields(schema):
    if isinstance(schema, dict):
        yield from schema.get("properties", {})
        for value in schema.values():
            yield from schema_fields(value)
    elif isinstance(schema, list):
        for value in schema:
            yield from schema_fields(value)


def test_event_envelopes_are_always_present_closed_and_private_data_free():
    names = {
        "session_started",
        "session_ended",
        "conversation_started",
        "conversation_ended",
        "message_sent",
        "answer_shown",
        "component_shown",
        "component_seen",
        "section_expanded",
        "section_collapsed",
        "representation_switched",
        "panel_opened",
        "panel_closed",
        "panel_docked",
        "panel_undocked",
        "answer_copied",
        "code_copied",
        "answer_regenerated",
        "generation_stopped",
        "message_edited",
        "shortcut_used",
        "search_used",
        "attachment_added",
        "draft_deleted",
        "setting_changed",
        "change_shown",
        "change_kept",
        "change_undone",
        "proposal_shown",
        "proposal_kept",
        "proposal_dismissed",
        "turn_summary",
        "session_summary",
    }
    variants = SCHEMA["$defs"]["Event"]["oneOf"]
    assert {
        SCHEMA["$defs"][x["$ref"].split("/")[-1]]["properties"]["name"]["const"]
        for x in variants
    } == names
    assert not any(
        k.startswith(("Action_Widget", "Action_Media")) for k in SCHEMA["$defs"]
    )
    assert "session_flag" not in json.dumps(SCHEMA)
    Draft202012Validator.check_schema(SCHEMA)

    for ref in variants:
        definition = SCHEMA["$defs"][ref["$ref"].split("/")[-1]]
        properties = definition["properties"]
        assert definition["additionalProperties"] is False
        assert {
            "layout_version",
            "registry_version",
            "device_class",
            "input_type",
        } <= set(definition["required"])
        assert properties["input_type"]["enum"] == ["mouse", "touch", "pen", "none"]
        for forbidden in (
            "text",
            "message_text",
            "messageText",
            "file_name",
            "filename",
            "fileName",
            "key",
            "key_identity",
            "keyidentity",
            "keyIdentity",
        ):
            assert forbidden not in schema_fields(definition)
        for field in (
            "event_id",
            "timestamp",
            "contracts_version",
            "session_id",
            "layout_version",
            "registry_version",
        ):
            assert "null" not in json.dumps(properties[field])
        for forbidden in ("message_text", "file_name", "key_identity"):
            assert forbidden not in properties


def test_every_event_variant_is_valid_and_round_trips_through_the_codec():
    for ref in SCHEMA["$defs"]["Event"]["oneOf"]:
        definition = SCHEMA["$defs"][ref["$ref"].split("/")[-1]]
        event = valid_event(definition)
        VALIDATOR.validate(event)
        assert json.loads(encode_contract(decode_contract(json.dumps(event)))) == event


def test_closed_event_vocabularies_and_component_identity_rules():
    VALIDATOR.validate(action("search_used"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("search_used", kind="a label with words"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("search_used", input_type="trackpad"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("search_used", session_flag="normal"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("section_expanded", component="MessageBody"))
    VALIDATOR.validate(
        action("section_expanded", component="MessageBody", slot="long_answer")
    )
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("panel_opened"))
    VALIDATOR.validate(action("panel_opened", component="SourcesPanel"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("widget_seen", widget_id="resume"))


def test_event_specific_vocabularies_and_command_key():
    VALIDATOR.validate(
        action(
            "message_sent",
            length_bucket="short",
            attachment_count=0,
            command="copy_answer",
        )
    )
    VALIDATOR.validate(
        action("shortcut_used", command="cmd_550e8400-e29b-41d4-a716-446655440004")
    )
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("shortcut_used", shortcut_name="copy_answer"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(
            action(
                "message_sent",
                length_bucket="short",
                attachment_count=0,
                command="copy answer",
            )
        )
    VALIDATOR.validate(action("answer_copied", share_bucket="some"))
    VALIDATOR.validate(action("attachment_added", type="video"))
    VALIDATOR.validate(
        action(
            "session_started",
            mode="dark",
            text_scale=3,
            local_hour_bucket="night",
            day_type="weekday",
        )
    )
    with pytest.raises(ValidationError):
        VALIDATOR.validate(
            action(
                "session_started",
                mode="dark",
                text_scale=3,
                local_hour_bucket=3,
                day_type="weekday",
            )
        )


def test_measurements_publish_nullability_and_counts_never_allow_null():
    typing = {
        "composing_time": None,
        "mean_key_gap": None,
        "key_gap_spread": None,
        "burst_count": 0,
        "pause_count": 0,
        "backspace_rate": None,
    }
    reading = {
        "time_on_answer": 0,
        "furthest_point": 0,
        "scroll_backs": 0,
        "time_before_next_action": None,
    }
    pointer = {"distance_travelled": 0, "hesitations": 0, "misses_on_small_targets": 0}
    turn = action("turn_summary", typing=typing, reading=reading, pointer=pointer)
    VALIDATOR.validate(turn)
    for payload, path in (
        (turn, ("typing", "burst_count")),
        (turn, ("reading", "scroll_backs")),
        (turn, ("pointer", "hesitations")),
    ):
        broken = json.loads(json.dumps(payload))
        broken[path[0]][path[1]] = None
        with pytest.raises(ValidationError):
            VALIDATOR.validate(broken)

    session = action(
        "session_summary",
        duration=None,
        active_time=1,
        turns=0,
        kinds=[],
        local_hour_bucket="evening",
        day_type="weekend",
        typing=typing,
    )
    VALIDATOR.validate(session)
    session["turns"] = None
    with pytest.raises(ValidationError):
        VALIDATOR.validate(session)
    session["turns"] = 0
    session["duration"] = 0
    VALIDATOR.validate(session)
    edited = action("message_edited", seconds_since_answer=None)
    VALIDATOR.validate(edited)
    VALIDATOR.validate(action("answer_regenerated", seconds_since_answer=0))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("answer_regenerated", seconds_since_answer=None))


@pytest.mark.parametrize("reference", SCHEMA["$defs"]["SettingChanged"]["oneOf"])
def test_every_setting_dimension_value_round_trips(reference):
    definition = SCHEMA["$defs"][reference["$ref"].split("/")[-1]]
    dimension = definition["properties"]["dimension"]["const"]
    for value in definition["properties"]["value"]["enum"]:
        fields = {"dimension": dimension, "value": value}
        if dimension == "shortcut_chips":
            fields["command"] = "copy_answer"
        event = action("setting_changed", **fields)
        assert json.loads(encode_contract(decode_contract(json.dumps(event)))) == event


def test_specs_and_records_round_trip_with_app_minted_ids():
    proposal_id = "prop_550e8400-e29b-41d4-a716-446655440002"
    decision_id = "dec_550e8400-e29b-41d4-a716-446655440003"
    request = {
        "source": "hermes",
        "dimension": "long_answers",
        "kind": None,
        "to": "open",
        "change_policy": "proposed",
        "type": "dimension",
        "reason": "evidence",
        "evidence": {"features": [{"open": True}]},
        "payload": {},
    }
    with pytest.raises(ValidationError):
        Draft202012Validator(
            {
                "$schema": SCHEMA["$schema"],
                "$defs": SCHEMA["$defs"],
                "$ref": "#/$defs/ProposalRequest",
            },
            format_checker=FormatChecker(),
        ).validate({**request, "id": proposal_id})
    stored = {**request, "id": proposal_id}
    VALIDATOR.validate(stored)
    with pytest.raises(ValidationError):
        VALIDATOR.validate({**stored, "mode": "proposed"})
    decision = {
        "id": decision_id,
        "proposal_id": proposal_id,
        "dimension": "long_answers",
        "kind": None,
        "from": "folded",
        "to": "open",
        "reason": "evidence",
        "evidence": {},
        "dimension_version": 1,
        "status": "pending",
        "created_at": "2026-11-24T00:00:00.000Z",
        "shown_at": None,
    }
    VALIDATOR.validate(decision)
    for record, event, key, ident in (
        (
            stored,
            action(
                "proposal_shown", proposal_id=proposal_id, proposal_type="dimension"
            ),
            "proposal_id",
            proposal_id,
        ),
        (
            decision,
            action("change_shown", decision_id=decision_id),
            "decision_id",
            decision_id,
        ),
    ):
        assert (
            json.loads(encode_contract(decode_contract(json.dumps(record))))["id"]
            == ident
        )
        assert (
            json.loads(encode_contract(decode_contract(json.dumps(event))))[key]
            == ident
        )
    with pytest.raises(ValidationError):
        VALIDATOR.validate(
            action("proposal_shown", proposal_id="a label", proposal_type="dimension")
        )
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("change_shown", decision_id=proposal_id))


def test_codec_enforces_wire_schema_but_models_are_strict_for_direct_callers():
    integer_float = action("search_used")
    integer_float["contracts_version"] = 1.0
    assert decode_contract(json.dumps(integer_float)).contracts_version == 1
    for timestamp in ("2026-11-24T00:00:00.000+00:00", "2026-11-24T00:00:00Z"):
        with pytest.raises(ValidationError):
            decode_contract(json.dumps(action("search_used", timestamp=timestamp)))
    with pytest.raises(PydanticValidationError):
        generated.ActionSearchUsed.model_validate(
            {**action("search_used"), "contracts_version": "1"}
        )
    for field, invalid in (("timestamp", 0), ("contracts_version", 1.0)):
        with pytest.raises(PydanticValidationError):
            generated.ActionSearchUsed.model_validate(
                {**action("search_used"), field: invalid}
            )


@pytest.mark.parametrize("constant", ["NaN", "Infinity", "-Infinity"])
def test_codec_rejects_non_json_numbers(constant):
    with pytest.raises(ValueError):
        decode_contract(
            json.dumps(action("search_used")).replace("1,", f"{constant},", 1)
        )


def test_encoder_rejects_nonfinite_values_and_timestamp_offsets():
    model = generated.Spec.model_construct(
        registry_version=1,
        root="shell",
        elements={
            "shell": generated.SpecElement.model_construct(
                type="AppShell", props={"value": float("nan")}
            )
        },
    )
    with pytest.raises(ValueError):
        encode_contract(model)
    for timestamp in ("2026-11-24T00:00:00.000+00:00", "2026-11-24T00:00:00Z"):
        with pytest.raises(ValidationError):
            decode_contract(json.dumps(action("search_used", timestamp=timestamp)))


def test_codec_rejects_non_json_numbers_and_generated_variants_are_importable():
    spec = {
        "registry_version": 1,
        "root": "shell",
        "elements": {"shell": {"type": "AppShell", "props": {"v": None}}},
    }
    with pytest.raises(ValueError):
        decode_contract(json.dumps(spec).replace("null", "NaN"))
    assert generated.Proposal and generated.Decision and generated.SessionSummary


def test_schema_fingerprint_tracks_source_constraint_changes(tmp_path):
    copied = tmp_path / "contracts/schemas"
    copied.mkdir(parents=True)
    source = json.loads((ROOT / "contracts/schemas/index.json").read_text())
    original = schema_fingerprint(ROOT / "contracts/schemas", ROOT)
    schema_copy = copied / "index.json"
    schema_copy.write_text(json.dumps(source, indent=2) + "\n")
    assert schema_fingerprint(copied, tmp_path) == original
    source["$defs"]["Spec"]["properties"]["elements"]["minProperties"] = 1
    schema_copy.write_text(json.dumps(source, indent=2) + "\n")
    assert schema_fingerprint(copied, tmp_path) != original
