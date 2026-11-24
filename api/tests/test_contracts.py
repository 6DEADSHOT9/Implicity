import json
from pathlib import Path

import pytest
from implicity_contracts import decode_contract, encode_contract, generated
from implicity_contracts.freshness import schema_fingerprint
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError

ROOT = Path(__file__).parents[2]
SCHEMA = json.loads((ROOT / "contracts/schemas/index.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
SHARED = {
    "event_id": "evt_1",
    "timestamp": "2026-11-24T00:00:00Z",
    "contracts_version": 1,
    "session_id": "ses_1",
    "device_class": "desktop",
    "input_type": "mouse",
    "session_flag": "normal",
}


def action(name, **fields):
    return {**SHARED, "name": name, **fields}


ACTION_FIXTURES = [
    action("session_started", mode="normal", text_scale=3, local_hour_bucket=10),
    action("session_ended", mode="normal", text_scale=3, local_hour_bucket=10),
    action("conversation_started"),
    action("conversation_ended"),
    action("message_sent", length_bucket="medium", attachment_count=0),
    action(
        "answer_shown",
        length_bucket="medium",
        has_code=False,
        has_table=False,
        has_reasoning=False,
    ),
    action("component_shown", default_state="open"),
    action(
        "component_seen",
        component="MessageBody",
        slot="long_answer",
        seconds_visible=5,
    ),
    action("section_expanded", section_type="reasoning"),
    action("section_collapsed", section_type="reasoning"),
    action("representation_switched", **{"from": "table", "to": "chart"}),
    action("panel_opened", panel="sources"),
    action("panel_closed", panel="sources"),
    action("panel_docked", panel="sources"),
    action("panel_undocked", panel="sources"),
    action("answer_copied", share_bucket="half"),
    action("code_copied", share_bucket="half"),
    action("answer_regenerated", seconds_since_answer=5),
    action("generation_stopped", seconds_since_answer=5),
    action("message_edited", seconds_since_answer=5),
    action("shortcut_used", shortcut_name="copy_answer"),
    action("search_used"),
    action("attachment_added", type="file"),
    action("draft_deleted", length_bucket="medium"),
    action("setting_changed", dimension="density", value="compact"),
    action("change_shown", decision_id="dec_1"),
    action("change_kept", decision_id="dec_1"),
    action("change_undone", decision_id="dec_1"),
    action("proposal_shown", proposal_id="prop_1", proposal_type="look"),
    action("proposal_kept", proposal_id="prop_1", proposal_type="look"),
    action("proposal_dismissed", proposal_id="prop_1", proposal_type="look"),
    action("widget_seen", widget_id="resume"),
    action("widget_used", widget_id="resume"),
    action("widget_pinned", widget_id="resume"),
    action("widget_dismissed", widget_id="resume"),
    action("media_played", position_bucket="start"),
    action("media_paused", position_bucket="start"),
    action("media_seeked", position_bucket="start"),
    action("media_replayed", position_bucket="start"),
]
SETTING_FIXTURES = [
    action(
        "setting_changed",
        dimension=SCHEMA["$defs"][reference["$ref"].split("/")[-1]]["properties"][
            "dimension"
        ]["const"],
        value=SCHEMA["$defs"][reference["$ref"].split("/")[-1]]["properties"]["value"][
            "enum"
        ][0],
    )
    for reference in SCHEMA["$defs"]["SettingChanged"]["oneOf"]
]
TURN_SUMMARY_FIXTURE = {
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
SESSION_SUMMARY_FIXTURE = {
    **SHARED,
    "name": "session_summary",
    "duration": 10,
    "active_time": 5,
    "turns": 1,
    "kinds": ["coding"],
    "local_hour_bucket": 10,
    "day_type": "weekday",
    "typing": TURN_SUMMARY_FIXTURE["typing"],
}
EVENT_FIXTURES = (
    ACTION_FIXTURES
    + SETTING_FIXTURES
    + [
        TURN_SUMMARY_FIXTURE,
        SESSION_SUMMARY_FIXTURE,
    ]
)


def test_events_are_closed_and_reject_private_values_at_every_depth():
    variants = SCHEMA["$defs"]["Event"]["oneOf"]
    assert len(variants) == 51
    expected_names = {
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
        "widget_seen",
        "widget_used",
        "widget_pinned",
        "widget_dismissed",
        "media_played",
        "media_paused",
        "media_seeked",
        "media_replayed",
        "turn_summary",
        "session_summary",
    }
    actual_names = {
        SCHEMA["$defs"][reference["$ref"].split("/")[-1]]["properties"]["name"].get(
            "const"
        )
        for reference in variants
    }
    assert actual_names == expected_names
    Draft202012Validator.check_schema(SCHEMA)
    forbidden_fields = (
        "text",
        "message_text",
        "messageText",
        "file_name",
        "filename",
        "fileName",
        "key_identity",
        "keyidentity",
        "keyIdentity",
    )
    for valid in EVENT_FIXTURES:
        VALIDATOR.validate(valid)
        for field in forbidden_fields:
            with pytest.raises(ValidationError):
                VALIDATOR.validate({**valid, field: "synthetic private value"})

    for summary in (TURN_SUMMARY_FIXTURE, SESSION_SUMMARY_FIXTURE):
        for field in forbidden_fields:
            probe = json.loads(json.dumps(summary))
            probe["typing"][field] = "synthetic private value"
            with pytest.raises(ValidationError):
                VALIDATOR.validate(probe)

    for event in (
        action("shortcut_used", shortcut_name="KeyA"),
        action(
            "message_sent", length_bucket="short", attachment_count=0, shortcut="KeyA"
        ),
    ):
        with pytest.raises(ValidationError):
            VALIDATOR.validate(event)

    with pytest.raises(ValidationError):
        VALIDATOR.validate({**action("search_used"), "kind": "message text"})
    with pytest.raises(ValidationError):
        VALIDATOR.validate(
            {**action("component_seen", seconds_visible=1), "component": "name.txt"}
        )


def test_action_fields_and_requiredness_follow_the_action_table():
    VALIDATOR.validate(
        action("message_sent", length_bucket="medium", attachment_count=0)
    )
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("message_sent"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("search_used", length_bucket="short"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(action("component_seen", default_state="open"))


def test_dimension_values_are_closed_and_events_use_shared_codec():
    VALIDATOR.validate(action("setting_changed", dimension="density", value="compact"))
    with pytest.raises(ValidationError):
        VALIDATOR.validate(
            action("setting_changed", dimension="density", value="short")
        )
    for private_value in (
        {"text": "synthetic message"},
        {"file_name": "sample.txt"},
        {"key_identity": "KeyA"},
    ):
        with pytest.raises(ValidationError):
            VALIDATOR.validate(
                action("setting_changed", dimension="density", value=private_value)
            )


def test_codec_rejects_private_fields_and_unapproved_shortcuts():
    for event in (
        {**action("search_used"), "message_text": "private"},
        action("setting_changed", dimension="density", value={"key_identity": "KeyA"}),
        action(
            "shortcut_used",
            shortcut_name="KeyA",
        ),
    ):
        with pytest.raises(ValidationError):
            decode_contract(json.dumps(event))


@pytest.mark.parametrize("reference", SCHEMA["$defs"]["SettingChanged"]["oneOf"])
def test_each_setting_dimension_value_round_trips(reference):
    variant = SCHEMA["$defs"][reference["$ref"].split("/")[-1]]["properties"]
    dimension = variant["dimension"]["const"]
    for value in variant["value"]["enum"]:
        payload = action("setting_changed", dimension=dimension, value=value)
        assert (
            json.loads(encode_contract(decode_contract(json.dumps(payload)))) == payload
        )


def test_pydantic_codec_round_trips_decision_wire_names():
    decision = {
        "id": "dec_1",
        "proposal_id": "prop_1",
        "dimension": "long_answers",
        "kind": "coding",
        "from": "folded",
        "to": "open",
        "reason": "evidence",
        "evidence": {},
        "dimension_version": 1,
        "status": "pending",
        "created_at": "2026-11-24T00:00:00Z",
        "shown_at": None,
    }
    assert (
        json.loads(encode_contract(decode_contract(json.dumps(decision)))) == decision
    )


@pytest.mark.parametrize(
    "event",
    EVENT_FIXTURES,
)
def test_each_action_variant_round_trips_through_the_public_codec(event):
    serialized = encode_contract(decode_contract(json.dumps(event)))
    assert json.loads(serialized) == event


def test_pydantic_rejects_schema_coercions_and_unset_fields_are_omitted():
    payload = action(
        "answer_shown",
        length_bucket="medium",
        has_code=False,
        has_table=False,
        has_reasoning=False,
    )
    for field, invalid in (
        ("has_code", None),
        ("contracts_version", "1"),
        ("timestamp", 0),
    ):
        invalid_payload = {**payload, field: invalid}
        with pytest.raises(ValidationError):
            decode_contract(json.dumps(invalid_payload))

    model = decode_contract(json.dumps(payload))
    encoded = json.loads(encode_contract(model))
    assert encoded["has_code"] is False
    assert "conversation_id" not in encoded


def test_generated_names_are_importable_by_api_and_engine():
    assert generated.Proposal
    assert generated.Decision
    assert generated.SessionSummary


def test_freshness_digest_changes_for_schema_only_constraints(tmp_path):
    source_dir = ROOT / "contracts/schemas"
    copy_dir = tmp_path / "contracts/schemas"
    copy_dir.mkdir(parents=True)
    source = json.loads((source_dir / "index.json").read_text())
    original = schema_fingerprint(source_dir, ROOT)
    (copy_dir / "index.json").write_text(json.dumps(source, indent=2) + "\n")
    assert schema_fingerprint(copy_dir, tmp_path) == original

    source["$defs"]["Spec"]["properties"]["elements"]["minProperties"] = 1
    (copy_dir / "index.json").write_text(json.dumps(source, indent=2) + "\n")

    assert schema_fingerprint(copy_dir, tmp_path) != original
