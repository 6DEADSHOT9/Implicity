import json
import math
from importlib.resources import files

from jsonschema import Draft202012Validator, FormatChecker
from pydantic import BaseModel, RootModel

from .generated import Contracts

SCHEMA = json.loads(files("implicity_contracts").joinpath("schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())


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


def decode_contract(payload: str) -> BaseModel:
    VALIDATOR.validate(json.loads(payload, parse_constant=_reject_constant))
    model = Contracts.model_validate_json(payload, strict=False)
    while isinstance(model, RootModel):
        model = model.root
    return model


def encode_contract(value: BaseModel) -> str:
    _reject_nonfinite(
        value.model_dump(mode="python", by_alias=True, exclude_unset=True)
    )
    payload = value.model_dump(mode="json", by_alias=True, exclude_unset=True)
    wire = json.dumps(payload, separators=(",", ":"), allow_nan=False)
    VALIDATOR.validate(json.loads(wire, parse_constant=_reject_constant))
    return wire
