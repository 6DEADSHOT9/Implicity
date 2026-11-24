import json
from importlib.resources import files

from jsonschema import Draft202012Validator, FormatChecker
from pydantic import BaseModel

from .generated import Contracts

SCHEMA = json.loads(files("implicity_contracts").joinpath("schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())


def decode_contract(payload: str) -> BaseModel:
    VALIDATOR.validate(json.loads(payload))
    return Contracts.model_validate_json(payload, strict=True).root


def encode_contract(value: BaseModel) -> str:
    payload = value.model_dump(mode="json", by_alias=True, exclude_unset=True)
    VALIDATOR.validate(payload)
    return json.dumps(payload, separators=(",", ":"))
