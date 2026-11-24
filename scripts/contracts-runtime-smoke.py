import json

from implicity_contracts import decode_contract
from implicity_contracts.generated import Decision, Proposal, SessionSummary

decode_contract(
    json.dumps(
        {
            "event_id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "search_used",
            "timestamp": "2026-11-24T00:00:00.000Z",
            "contracts_version": 1,
            "session_id": "550e8400-e29b-41d4-a716-446655440001",
            "layout_version": 1,
            "registry_version": 1,
            "device_class": "desktop",
            "input_type": "mouse",
        }
    )
)
assert Decision and Proposal and SessionSummary
print("runtime contracts import passed")
