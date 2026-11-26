---
status: accepted
---

# The server checks shape, and the browser checks rules

A registry entry's Zod schema is the source of truth. Rules that relate fields to each other, such as an active tab being one of the tabs, ids being unique, or a Citation's source matching its source type, are Zod refinements on that schema. The exported JSON Schema describes shape only. The registry validator and the browser renderer run the full Zod schema; the server's `render` tool and `catalogue` use the JSON Schema, so they check shape only. A spec that `render` stored can therefore still be rejected in the browser, where it falls back to plain text like any invalid spec. This is deliberate, not a gap.

## Considered options

- **Narrow fields to fixed lists** so JSON Schema can express the rules. Rejected: it turned open parts, such as any set of tabs, into closed lists, and still could not state uniqueness or bounds that depend on another field.
- **Express every rule in JSON Schema** (`if`/`then`, `allOf`) through Zod metadata. Possible for a few rules, but it duplicates each rule in a second language that can drift from the Zod one, and some rules, such as uniqueness by id, cannot be stated simply.
- **Run the Zod schemas on the server** by calling into the web code. Rejected: it couples the Python backend to the TypeScript registry at runtime.

## Consequences

- One reading of each rule, in one place, tested once.
- `render` can accept a spec the browser later rejects. The person sees plain text instead, which is the existing failure path for message specs (ADR 0012), so nothing unsafe renders.
- Hermes's `catalogue` shows field shapes, not cross-field rules. If the model often writes specs that break a rule, that rule can be stated in JSON Schema as well, case by case, with a test that both agree.
