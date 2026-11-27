import json
from pathlib import Path

import pytest
from implicity_contracts import (
    decode_contract,
    decode_proposal_request,
    encode_contract,
    generated,
)
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
TURN_SUMMARY = {
    **SHARED,
    "name": "turn_summary",
    "typing": {
        "composing_time": 1,
        "mean_key_gap": 0.1,
        "key_gap_spread": 0.01,
        "burst_count": 1,
        "pause_count": 0,
        "backspace_rate": 0,
    },
    "reading": {
        "time_on_answer": 1,
        "furthest_point": 0.5,
        "scroll_backs": 0,
        "time_before_next_action": 1,
    },
    "pointer": {
        "distance_travelled": 1,
        "hesitations": 0,
        "misses_on_small_targets": 0,
    },
}
SESSION_SUMMARY = {
    **SHARED,
    "name": "session_summary",
    "duration": 10,
    "active_time": 5,
    "turns": 1,
    "kinds": ["coding"],
    "local_hour_bucket": "night",
    "day_type": "weekday",
    "typing": TURN_SUMMARY["typing"],
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


EXPECTED_REQUIRED = {
    "session_started": {"mode", "text_scale", "local_hour_bucket"},
    "session_ended": {"mode", "text_scale", "local_hour_bucket"},
    "conversation_started": {"conversation_id"},
    "conversation_ended": {"conversation_id"},
    "message_sent": {"length_bucket", "attachment_count"},
    "answer_shown": {"length_bucket", "has_code", "has_table", "has_reasoning"},
    "component_shown": {"component", "default_state"},
    "component_seen": {"component", "default_state", "seconds_visible"},
    "section_expanded": {"component", "slot"},
    "section_collapsed": {"component", "slot"},
    "representation_switched": {"dimension", "from", "to"},
    "panel_opened": {"component"},
    "panel_closed": {"component"},
    "panel_docked": {"component"},
    "panel_undocked": {"component"},
    "answer_copied": {"share_bucket"},
    "code_copied": {"share_bucket"},
    "answer_regenerated": {"seconds_since_answer"},
    "generation_stopped": {"seconds_since_answer"},
    "message_edited": {"seconds_since_answer"},
    "shortcut_used": {"command"},
    "search_used": set(),
    "attachment_added": {"type"},
    "draft_deleted": {"length_bucket"},
    "change_shown": {"decision_id"},
    "change_kept": {"decision_id"},
    "change_undone": {"decision_id"},
    "proposal_shown": {"proposal_id", "proposal_type"},
    "proposal_kept": {"proposal_id", "proposal_type"},
    "proposal_dismissed": {"proposal_id", "proposal_type"},
    "turn_summary": {"typing", "reading", "pointer"},
    "session_summary": {
        "duration",
        "active_time",
        "turns",
        "kinds",
        "local_hour_bucket",
        "day_type",
        "typing",
    },
}
EVENT_ENVELOPE_FIELDS = {
    "event_id",
    "name",
    "timestamp",
    "contracts_version",
    "session_id",
    "layout_version",
    "registry_version",
    "device_class",
    "input_type",
}


def test_independent_action_requirements_reject_each_missing_field():
    for ref in SCHEMA["$defs"]["Event"]["oneOf"]:
        definition = SCHEMA["$defs"][ref["$ref"].split("/")[-1]]
        name = definition["properties"]["name"]["const"]
        required = set(definition["required"])
        expected = set(EXPECTED_REQUIRED.get(name, {"dimension", "value"}))
        if (
            name == "setting_changed"
            and definition["properties"]["dimension"]["const"] == "shortcut_chips"
        ):
            expected.add("command")
        if (
            name == "setting_changed"
            and definition["properties"]["dimension"]["const"] == "home_widgets"
        ):
            expected.add("component")
        assert required == EVENT_ENVELOPE_FIELDS | expected, name
        event = valid_event(definition)
        VALIDATOR.validate(event)
        for field in expected:
            missing = dict(event)
            missing.pop(field)
            with pytest.raises(ValidationError):
                VALIDATOR.validate(missing)


def test_private_typing_payload_is_rejected_in_both_summary_variants():
    for fixture in (TURN_SUMMARY, SESSION_SUMMARY):
        VALIDATOR.validate(fixture)
        probe = json.loads(json.dumps(fixture))
        probe["typing"]["key_identity"] = "synthetic-key"
        with pytest.raises(ValidationError):
            VALIDATOR.validate(probe)
        with pytest.raises(ValidationError):
            decode_contract(json.dumps(probe))


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
    VALIDATOR.validate(action("shortcut_used", command="copy_answer"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("shortcut_used", command="cmd_workflow_title"))
    with pytest.raises(ValidationError):
        decode_contract(
            json.dumps(action("shortcut_used", command="cmd_workflow_title"))
        )
    assert generated.Command.model_validate("cmd_550e8400-e29b-41d4-a716-446655440004")
    with pytest.raises(PydanticValidationError):
        generated.Command.model_validate("cmd_workflow_title")
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
        )
    )
    with pytest.raises(ValidationError):
        VALIDATOR.validate(
            action(
                "session_started",
                mode="dark",
                text_scale=3,
                local_hour_bucket=3,
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
        elif dimension == "home_widgets":
            fields["component"] = "ResumeWidget"
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
    decoded_request = decode_proposal_request(json.dumps(request))
    assert decoded_request.model_dump(mode="json", by_alias=True)["type"] == "dimension"
    with pytest.raises(ValidationError):
        decode_proposal_request(json.dumps({**request, "id": proposal_id}))
    with pytest.raises(ValidationError):
        decode_proposal_request(
            json.dumps({key: value for key, value in request.items() if key != "type"})
        )
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
    summary = generated.SessionSummary.model_construct(duration=float("inf"))
    with pytest.raises(ValueError):
        encode_contract(summary)
    for timestamp in ("2026-11-24T00:00:00.000+00:00", "2026-11-24T00:00:00Z"):
        with pytest.raises(ValidationError):
            decode_contract(json.dumps(action("search_used", timestamp=timestamp)))


def test_wire_datetime_precision_and_opaque_timestamp_properties_round_trip():
    event = action("search_used", timestamp="2026-11-24T00:00:00.123Z")
    assert json.loads(encode_contract(decode_contract(json.dumps(event)))) == event
    spec = {
        "registry_version": 1,
        "root": "shell",
        "elements": {"shell": {"type": "AppShell", "props": {"timestamp": "DraftZ"}}},
    }
    assert json.loads(encode_contract(decode_contract(json.dumps(spec)))) == spec
    request = {
        "source": "hermes",
        "dimension": "long_answers",
        "kind": None,
        "to": "open",
        "change_policy": "proposed",
        "type": "dimension",
        "reason": "evidence",
        "evidence": {"timestamp": "DraftZ"},
        "payload": {"timestamp": "DraftZ"},
    }
    decoded_request = decode_proposal_request(json.dumps(request))
    assert json.loads(encode_contract(decoded_request)) == request

    decision = {
        "id": "dec_550e8400-e29b-41d4-a716-446655440003",
        "proposal_id": "prop_550e8400-e29b-41d4-a716-446655440002",
        "dimension": "long_answers",
        "kind": None,
        "from": "folded",
        "to": "open",
        "reason": "evidence",
        "evidence": {},
        "dimension_version": 1,
        "status": "pending",
        "created_at": "2026-11-24T00:00:00.123456Z",
        "shown_at": "2026-11-24T00:00:00.123789Z",
    }
    assert (
        json.loads(encode_contract(decode_contract(json.dumps(decision)))) == decision
    )


@pytest.mark.parametrize(
    "timestamp", ["2026-11-24T00:00:00.000Z", "2026-11-24T00:00:00.123Z"]
)
def test_encoder_unwraps_generated_root_models(timestamp):
    event = action("search_used", timestamp=timestamp)
    model = generated.Contracts.model_validate_json(json.dumps(event))
    assert json.loads(encode_contract(model)) == event


def test_representation_variants_reject_other_dimension_values_and_extra_fields():
    definition = SCHEMA["$defs"]["Action_RepresentationSwitched_DataForm"]
    data_form = valid_event(definition)
    VALIDATOR.validate(data_form)
    assert generated.ActionRepresentationSwitchedDataForm.model_validate_json(
        json.dumps(data_form)
    )
    for invalid in (
        {**data_form, "to": "prose"},
        {**data_form, "message_text": "private"},
    ):
        with pytest.raises(ValidationError):
            VALIDATOR.validate(invalid)
        with pytest.raises(PydanticValidationError):
            generated.ActionRepresentationSwitchedDataForm.model_validate_json(
                json.dumps(invalid)
            )


def test_codec_rejects_non_json_numbers_and_generated_variants_are_importable():
    spec = {
        "registry_version": 1,
        "root": "shell",
        "elements": {"shell": {"type": "AppShell", "props": {"v": None}}},
    }
    with pytest.raises(ValueError):
        decode_contract(json.dumps(spec).replace("null", "NaN"))
    overflow = json.dumps(SESSION_SUMMARY).replace(
        '"duration": 10', '"duration": 1e400'
    )
    with pytest.raises(ValueError):
        decode_contract(overflow)
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
