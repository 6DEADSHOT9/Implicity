---
status: accepted
---

# Event vocabularies are closed, and element names come from the registry

Every value an event carries comes from a closed set, so no field can hold message text, a file name or a key (rule 2). Values that describe the interface, such as components, slots, default states and Commands, are declared by the registry entry that owns them: the schema checks only that the identifier is well formed, and the capture wrapper rejects any value the registry does not declare. Values that describe the person's context are fixed in `docs/contracts.md`: Mode, text scale, local hour bucket, length bucket, share copied and attachment type. We chose this because the contracts were written before the registry: a single global list of states or shortcuts in the schema rejected real cases (Details shown expanded, a new workflow chip), while a free string let any word through.

## Decisions

- **Registry-owned names.** Component, slot, default state and Command values come from registry entries. Each entry declares the Commands it offers, so a new shortcut chip adds a Command without a schema change.
- **Sections are a component and a slot.** `section_expanded` and `section_collapsed` carry no section type; the shared `component` and `slot` fields say which section it was, as the feature example already assumes.
- **`component_seen` carries its default state.** An occasion is a component seen in a given state, so the seen event needs the state the feature filters on.
- **`representation_switched` names its dimension.** It carries `data_form` or `answer_form`, and from and to are values of that dimension.
- **`shortcut_chips` settings name the Command** switched on or off.
- **Shared buckets.** One set of length labels, `short`, `medium`, `long`, for messages, answers and drafts, matching `answer_length`; the character cut-offs are a data file so capture can tune them without a schema change. Share copied is `some`, `most` or `all`. The local hour bucket is four blocks in local time. Attachment type is `image`, `document`, `audio`, `video` or `other`, decided from the media type in the browser.
- **Mode is light or dark as displayed, and text scale is the look's text-size step.** Both are device context, read live and never learned.
- **API request and response bodies are designed by the ticket that builds each endpoint**, not by the contracts ticket, because the docs give each call's purpose but not its body.

## Considered options

- **Fixed global lists in the contracts ticket.** Rejected: they pre-empt the registry and already contradicted the docs.
- **Free identifier strings everywhere.** Rejected: a well-formed identifier can still be a file name or a key, so it does not satisfy rule 2 on its own.
