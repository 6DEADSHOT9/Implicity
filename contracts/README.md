# Contracts

`schemas/index.json` is the source for events, proposals, decisions, layout and
message specs, and the API payloads whose shapes are defined in
`docs/contracts.md` (`POST /drafts` and `PUT /settings/{dimension}`).
Component schemas remain beside their components as required by that document.

Run `make contracts-generate` to regenerate TypeScript and Pydantic types:

- `web/src/contracts/generated.ts`
- `api/app/contracts/generated.py`

`make lint` and `make test` run `make contracts-check`, which fails if either
generated file differs from the schema output.
