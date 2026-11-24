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

API request and response payloads are pending because the docs do not define
their wire shapes yet. The draft endpoint describes storing its text locally
for 30 days, and Settings describes setting a value or returning to automatic,
but neither specifies its JSON envelope.
