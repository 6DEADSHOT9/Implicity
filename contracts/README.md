# Contracts

`schemas/index.json` is the source for events, proposals, decisions and layout
and message specs. Component schemas remain beside their components as
required by `docs/contracts.md`.

Run `make contracts-generate` to regenerate TypeScript and Pydantic types:

- `web/src/contracts/generated.ts`
- `contracts/python/implicity_contracts/generated.py`

`make lint` and `make test` run `make contracts-check`, which fails if either
generated file or the runtime schema copy differs from the source. Python
consumers use `implicity_contracts.decode_contract` and
`implicity_contracts.encode_contract` at the wire boundary. They validate
against the source schema; encoding uses wire aliases and omits unset fields.

Proposal ingress uses `implicity_contracts.decode_proposal_request`, which
validates the request-specific shape and rejects any caller-supplied id. The
request carries the required `type`; the app validates it and stores the same
type on the Proposal, and proposal events copy it from the stored Proposal.

## Measurement wire table

| Event/group | Key | Wire type |
| --- | --- | --- |
| `turn_summary.typing` | `composing_time`, `mean_key_gap`, `key_gap_spread`, `backspace_rate` | number or null when no sample exists |
| `turn_summary.typing` | `burst_count`, `pause_count` | integer, 0 or more |
| `turn_summary.reading` | `time_on_answer`, `time_before_next_action` | number or null when no sample exists |
| `turn_summary.reading` | `furthest_point` | number from 0 to 1 |
| `turn_summary.reading` | `scroll_backs` | integer, 0 or more |
| `turn_summary.pointer` | `distance_travelled` | number, 0 or more |
| `turn_summary.pointer` | `hesitations`, `misses_on_small_targets` | integer, 0 or more |
| `session_summary` | `duration`, `active_time` | number or null when no sample exists |
| `session_summary` | `turns` | integer, 0 or more |
| `session_summary.typing` | `composing_time`, `mean_key_gap`, `key_gap_spread`, `backspace_rate` | number or null when no sample exists |
| `session_summary.typing` | `burst_count`, `pause_count` | integer, 0 or more |
| `component_seen` | `seconds_visible` | number, 0 or more |
| `answer_regenerated`, `generation_stopped` | `seconds_since_answer` | number, 0 or more |
| `message_edited` | `seconds_since_answer` | number or null when edited before an answer began |

Every summary measurement group is required. Counts never use null; nullable
measurements use null only when no sample exists.

HTTP API request and response payloads are designed by their endpoint tickets;
the draft and Settings descriptions do not define their JSON envelopes.
