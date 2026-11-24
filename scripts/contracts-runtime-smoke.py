import json

from implicity_contracts import decode_contract
from implicity_contracts.generated import Decision, Proposal, SessionSummary

decode_contract(
    json.dumps(
        {
            "event_id": "evt_1",
            "name": "search_used",
            "timestamp": "2026-11-24T00:00:00Z",
            "contracts_version": 1,
            "session_id": "ses_1",
            "device_class": "desktop",
            "input_type": "mouse",
            "session_flag": "normal",
        }
    )
)
assert Decision and Proposal and SessionSummary
print("runtime contracts import passed")
