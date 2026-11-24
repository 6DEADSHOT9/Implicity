import json
import math
from datetime import datetime, timezone
from importlib.resources import files

from jsonschema import Draft202012Validator, FormatChecker
from pydantic import BaseModel, RootModel

from .generated import Contracts, ProposalRequest

SCHEMA = json.loads(files("implicity_contracts").joinpath("schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
PROPOSAL_REQUEST_VALIDATOR = Draft202012Validator(
    {
        "$schema": SCHEMA["$schema"],
        "$defs": SCHEMA["$defs"],
        "$ref": "#/$defs/ProposalRequest",
    },
    format_checker=FormatChecker(),
)


def _reject_constant(token: str) -> None:
    raise ValueError(f"invalid JSON number: {token}")


def _reject_nonfinite(value: object) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("non-finite numbers are not valid JSON")
    if isinstance(value, dict):
        for item in value.values():
            _reject_nonfinite(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            _reject_nonfinite(item)


def _format_datetime(value: datetime) -> str:
    timestamp = value.isoformat(timespec="milliseconds")
    return (
        timestamp[:-6] + "Z"
        if value.utcoffset() == timezone.utc.utcoffset(value)
        else timestamp
    )


def _preserve_model_datetimes(model: BaseModel, payload: dict) -> None:
    for name, field in type(model).model_fields.items():
        key = field.alias or name
        if key not in payload or name in {"props", "payload", "evidence"}:
            continue
        value = getattr(model, name)
        if isinstance(value, datetime) and name == "timestamp":
            payload[key] = _format_datetime(value)
        elif isinstance(value, BaseModel):
            _preserve_model_datetimes(value, payload[key])
        elif (
            isinstance(value, dict)
            and value
            and all(isinstance(item, BaseModel) for item in value.values())
        ):
            for item_key, item in value.items():
                _preserve_model_datetimes(item, payload[key][item_key])
        elif (
            isinstance(value, list)
            and value
            and all(isinstance(item, BaseModel) for item in value)
        ):
            for index, item in enumerate(value):
                _preserve_model_datetimes(item, payload[key][index])


def _wire_value(value: BaseModel) -> dict:
    while isinstance(value, RootModel):
        value = value.root
    payload = value.model_dump(mode="json", by_alias=True, exclude_unset=True)
    _preserve_model_datetimes(value, payload)
    return payload


def decode_contract(payload: str) -> BaseModel:
    wire_value = json.loads(payload, parse_constant=_reject_constant)
    _reject_nonfinite(wire_value)
    VALIDATOR.validate(wire_value)
    model = Contracts.model_validate_json(payload, strict=False)
    while isinstance(model, RootModel):
        model = model.root
    return model


def decode_proposal_request(payload: str) -> ProposalRequest:
    wire_value = json.loads(payload, parse_constant=_reject_constant)
    _reject_nonfinite(wire_value)
    PROPOSAL_REQUEST_VALIDATOR.validate(wire_value)
    return ProposalRequest.model_validate_json(payload, strict=False)


def encode_contract(value: BaseModel) -> str:
    _reject_nonfinite(
        value.model_dump(mode="python", by_alias=True, exclude_unset=True)
    )
    payload = _wire_value(value)
    _reject_nonfinite(payload)
    wire = json.dumps(payload, separators=(",", ":"), allow_nan=False)
    VALIDATOR.validate(json.loads(wire, parse_constant=_reject_constant))
    return wire
