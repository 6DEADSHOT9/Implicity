---
status: accepted
---

# Event vocabularies are closed, and only trusted code mints identifiers

Every value an event carries comes from a closed set, a typed measurement, or an identifier minted by code we control, so no field can hold message text, a file name or a key (rule 2). An identifier is never derived from a label, a title or content: a well-formed id built from a workflow title or a kind's name could still carry words from a message. We chose this because the contracts were written before the registry and the Proposal flow existed: a single global list in the schema rejected real cases (Details shown expanded, a new workflow chip), and a free string let any word through.

## Decisions

**Who mints identifiers.**

- Components, slots, default states and built-in Commands are fixed, reviewed ids declared by the registry entry that owns them. Each entry declares its slots, states and Commands. The schema checks the identifier's form; the capture wrapper rejects any value the registry does not declare. A slot named in a message spec from Hermes is checked against the registry, never taken on trust.
- Workflow Commands, custom kinds, proposals and decisions get opaque ids minted by the app. A custom kind's id survives renames; its label never reaches an event (amends ADR 0018). The `propose` tool takes a proposal request with no id, and the app mints one when it stores the proposal.
- Event, session and conversation ids are UUIDs minted by the browser or the app.

**Event shape.**

- Sections are identified by `component` and `slot`, with no separate section type.
- `component_seen` carries its default state, because an occasion is a component seen in a given state.
- `representation_switched` names its dimension (`data_form` or `answer_form`), and from and to are values of that dimension.
- Commands always travel under the key `command`, on `message_sent`, `shortcut_used` and `setting_changed` (which carries it for `shortcut_chips`). The key binding is never captured.
- A proposal stores a `type`: `look`, `widget`, `workflow`, `kind` or `schedule`, set by the app. The proposal events copy it and fire only for proposals shown on a ProposalCard; a dimension change offered to the person uses the change events.
- Events carry no guest mark. A suspected guest is an inference, so the mark stays in SQLite with its module (ADR 0016). The sessions excluded are those currently set aside plus those the owner excluded, supplied by the owning module to both `daily_counts` and `session_summaries`, which gains an `exclude_sessions` parameter.
- `layout_version`, `registry_version`, `device_class` and `input_type` are on every event; `component` and `slot` are required on the events whose identity they are.
- A field that does not apply is left out, never sent as null. Timestamps are UTC RFC 3339 to the millisecond; version fields are integers.

**Shared vocabularies.**

- Length bucket: `short`, `medium`, `long` for messages, answers and drafts, matching `answer_length`. The character cut-offs are a data file so capture can tune them.
- Share copied: `some`, `most`, `all`.
- Local hour bucket: `night` [0, 6), `morning` [6, 12), `afternoon` [12, 18), `evening` [18, 24) in local time, taken when the session began.
- Attachment type: `image`, `document`, `audio`, `video`, `other`, from the media type in the browser.
- Mode is `light` or `dark` and text scale is the look's `text_size` step, both as displayed. Device context sets the starting look; after that both are part of the look, so saved choices and accepted looks go through the arbiter (rule 1).

**What other tickets own.**

- Measurement units, thresholds and formulas: the capture tickets (T18 for actions, T19 for summaries). On the wire, statistic groups are always present, counts are whole numbers and never null, and durations, rates and means are null when no sample exists; a measured 0 is a real value.
- Whether returning a dimension to automatic sends `setting_changed`: the Stage 2 Settings ticket, with its endpoint body.
- The shape of each `evidence.features` entry: the engine ticket (T20). Each proposal `payload`: the ticket that builds that kind of proposal. `to` is checked against the dimension's values at runtime.
- API request and response bodies: the ticket that builds each endpoint.

**Naming.** A dimension's `mode` is renamed `change_policy`, so Mode means only light or dark.

## Considered options

- **Fixed global lists in the contracts ticket.** Rejected: they pre-empt the registry and already contradicted the docs.
- **Free identifier strings, or registry membership alone.** Rejected: a well-formed identifier can still be built from a title or a label, so neither satisfies rule 2 without a rule about who mints it.

## Consequences

- The capture wrapper must look values up in the registry at runtime, and registry ids must stay stable as entries change, or old events stop matching their features.
- Custom kinds and workflows need an id table owned by the app module that accepts them.
