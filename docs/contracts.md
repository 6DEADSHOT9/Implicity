# Implicity Contracts

Nov 24, 2026

## Glossary

These are the exact shapes the build is written against. They turn the decisions in `architecture.md` into something precise. Each term has one meaning, used the same way in every document, ticket and file. The glossary lives in `CONTEXT.md` at the repository root, which coding agents read first.

## Repository and generated contracts

A new repository holds five top-level folders, and the `contracts` folder is the single source for every shared shape.

| Folder | Contents |
| --- | --- |
| `web` | The React app: shell, component registry, gallery, capture wrapper |
| `api` | The Python backend: FastAPI, SQLAlchemy with Alembic, the agent, memory and app modules, the MCP server |
| `engine` | The liftable adaptive engine: a Python library, a small React package, and a demo app with no chat |
| `contracts` | JSON Schemas, dimension files, feature definitions, look files |
| `docs` | Design documents, ADRs, spike briefs and findings |

**Generation.**

- JSON Schema in `contracts/schemas` is the source for events, proposals, decisions, specs and API payloads.
- TypeScript types and Pydantic models are generated from it at build time. Neither side hand-writes a shared shape.
- Component schemas are the one exception. Each is written in Zod beside its component and exported to `contracts/generated/components` as JSON Schema, for the backend and for Hermes's catalogue.
- A build fails if generated files are out of date.

**Tooling.** pnpm for JavaScript, uv for Python, one Docker Compose file with a development profile (mounted source, hot reload) and a production profile (built images).

**Versions.** Three version numbers exist and each is carried where it matters: the contracts version on every event, the registry version on every spec, and the dimension version on every decision.

## Events

Every event has the same shared fields and one of three shapes: an action, a turn summary or a session summary.

**Rules.**

- Names follow `object_action`, lowercase with underscores.
- No event ever contains message text, file names, or which keys were pressed.
- Lengths and durations are sent as buckets or statistics, not raw values that could identify content.
- A temporary chat sends no events at all.
- Components never call PostHog. They call the capture wrapper, which validates against the schema and adds the shared fields.

**Shared fields.**

| Field | Meaning |
| --- | --- |
| `event_id` | Unique id, for deduplication: a UUID minted in the browser |
| `name` | The event name |
| `timestamp` | When it happened, from the browser: UTC, RFC 3339, to the millisecond |
| `contracts_version` | Version of the contracts it was built against: an integer |
| `session_id` | The session it belongs to: a UUID minted by the app |
| `conversation_id` | The conversation, when there is one: a UUID minted by the app |
| `kind` | The kind of chat, when known: a predefined kind name or the opaque id of an accepted custom kind, never its label |
| `component`, `slot` | The registry component and slot it concerns, when relevant |
| `layout_version`, `registry_version` | The workspace the person was looking at: integers |
| `device_class`, `input_type` | Desktop or tablet; mouse, trackpad or touch |

A field that does not apply to an event is left out, never sent as null. A suspected guest is not marked on events: the mark is kept in SQLite with the module that owns it, and the event source excludes those sessions by id (ADR 0016, ADR 0020).

**Actions, sent as they happen.**

| Event | Sent when | Extra fields |
| --- | --- | --- |
| `session_started`, `session_ended` | A session begins, or ends on close or idle | Mode, text scale, local hour bucket |
| `conversation_started`, `conversation_ended` | A conversation opens or is left | |
| `message_sent` | The person sends a message | Length bucket, attachment count, the Command if a shortcut sent it |
| `answer_shown` | An answer finishes rendering | Length bucket, has code, has table, has reasoning |
| `component_shown` | A component renders | Its default state, such as folded or open |
| `component_seen` | It stays on screen for a few seconds | Its default state, seconds visible |
| `section_expanded`, `section_collapsed` | A foldable section is toggled | None: `component` and `slot` identify the section |
| `representation_switched` | An answer or data result is switched between forms | Dimension (`data_form` or `answer_form`), from, to: values of that dimension |
| `panel_opened`, `panel_closed`, `panel_docked`, `panel_undocked` | A panel changes | None: `component` identifies the panel |
| `answer_copied`, `code_copied` | Content is copied | Share copied: `some`, `most` or `all` |
| `answer_regenerated`, `generation_stopped`, `message_edited` | The person redoes, stops or edits | Seconds since the answer began |
| `shortcut_used` | A shortcut chip or key is used | The Command, never the key pressed |
| `search_used` | Search is opened and used | |
| `attachment_added` | A file or photo is attached | Type: `image`, `document`, `audio`, `video` or `other`. Never the file name |
| `draft_deleted` | A draft of meaningful length is cleared before sending | Length bucket only. The text goes to the backend, never to PostHog |
| `setting_changed` | The person sets something by hand | Dimension, value, and the Command for `shortcut_chips` |
| `change_shown`, `change_kept`, `change_undone` | An admitted change is displayed, kept or undone | Decision id |
| `proposal_shown`, `proposal_kept`, `proposal_dismissed` | A proposal is displayed and answered | Proposal id, proposal type: `look`, `widget`, `workflow`, `kind` or `schedule` |
| `widget_seen`, `widget_used`, `widget_pinned`, `widget_dismissed` | Home widgets (Stage 4; schema added in Stage 4) | Widget id |
| `media_played`, `media_paused`, `media_seeked`, `media_replayed` | Media playback (Stage 4; schema added in Stage 4) | Position bucket |

**Vocabularies.** Every value an event carries comes from a closed set, so no field can hold content (ADR 0020).

| Field | Values |
| --- | --- |
| Mode | `light` or `dark`: the variant of the look actually displayed |
| Text scale | The look's `text_size` step displayed, 1 to 5 |
| Local hour bucket | `night` [0, 6), `morning` [6, 12), `afternoon` [12, 18), `evening` [18, 24), in local time, taken when the session began, for both `session_started` and `session_summary` |
| Length bucket | `short`, `medium` or `long`, for messages, answers and drafts alike. The character cut-offs are a data file in `contracts`, starting at 80 and 400 for messages and drafts, 600 and 2,500 for answers |
| Share copied | `some` (under half), `most` (half or more, not all), `all` |
| Attachment type | `image`, `document`, `audio`, `video`, `other`, from the file's media type in the browser |
| Component, slot, default state, built-in Command | Fixed, reviewed ids declared by the registry. The schema checks the form of the identifier; the capture wrapper rejects any value the registry does not declare. A slot named in a message spec from Hermes is checked against the registry, never taken on trust |
| Workflow Command, custom kind, proposal id, decision id | Opaque ids minted by the app, never derived from a label, a title or content |
| Command key | Always `command`, on `message_sent`, `shortcut_used` and `setting_changed`. Never the key binding |
| Measurements | Units, thresholds and rules belong to the capture tickets (T18 for actions, T19 for summaries). A value that could not be measured is null, never 0 |

**Turn summary.** `turn_summary` is sent once per turn and covers the message being written and the answer being read.

| Group | Statistics |
| --- | --- |
| Typing | Composing time, mean and spread of gaps between keys, burst count, pause count, backspace rate |
| Reading | Time on the answer, furthest point reached, scroll-backs, time before the next action |
| Pointer | Distance travelled, hesitations before a click, misses on small targets |

**Session summary.** `session_summary` is sent when the session ends or goes idle: duration, active time, turns, kinds of chat used, local hour bucket, weekday or weekend, and the session's typing statistics.

## Features and dimensions

Features and dimensions are data files in `contracts`, so adding one needs no engine code.

**A feature** is a pair of daily counts per kind of chat. The setup command registers each one in PostHog as a saved query.

```yaml
# contracts/features/long_answer_expanded.yaml
id: long_answer_expanded
happened:        # the person did it
  event: section_expanded
  where: { component: MessageBody, slot: long_answer }
could_have:      # the chance was there and seen
  event: component_seen
  where: { component: MessageBody, slot: long_answer, default_state: folded }
group_by: [day, kind]
```

**A dimension** names one thing the engine can adapt.

```yaml
# contracts/dimensions/long_answers.yaml
id: long_answers
version: 1
area: layout              # layout | look | answer_style | home | workflow
values: [folded, open]
default: folded
scope: kind               # kind, with a global fallback
change_policy: automatic  # automatic | proposed
occasion: A long answer shown and seen on screen
evidence:
  open:   { for: long_answer_expanded,  against: long_answer_collapsed }
  folded: { for: long_answer_collapsed, against: long_answer_expanded }
gate:
  occasions: 20           # unweighted
  conversations: 3
  days: 2
  lead: { for: 0.70, against: 0.10 }   # on weighted counts
window_days: 60
half_life_days: 14
```

A dimension on a scale adds `scale: true`, which makes the engine move one value at a time and require fresh evidence after each step.

**The first dimensions.**

| Dimension | Values | An occasion is | Evidence toward a value |
| --- | --- | --- | --- |
| `reasoning` | folded, expanded | An answer with reasoning, seen | Expanding or collapsing the reasoning |
| `long_answers` | folded, open | A long answer, seen | Expanding or collapsing it |
| `data_form` | table, chart | A data result, seen | Switching form, and time spent on each |
| `sources_panel` | closed, docked | An answer with sources, seen | Opening or closing the sources panel |
| `project_panel` | closed, docked | A conversation inside a project | Opening or closing the project panel |
| `shortcut_chips` | One on/off per Command | The action being performed by any route | The same action repeated often enough to pass the gate |
| `density` | compact, comfortable, spacious (scale) | A session | Long scrolling through lists and tables, against misses on small targets |
| `answer_length` | short, medium, long | An answer, seen | Stopping early or leaving before the end, against asking for more |
| `answer_order` | answer first, explanation first | An answer with both parts | Skipping the introduction to reach the result |
| `answer_form` | prose, list, table | An answer that could take more than one form | Switching form or asking for another |
| `answer_tone` | normal, warm, terse | An answer | Set from what the person says, since behaviour gives weak evidence for tone |

The exact events behind each feature are fixed when its ticket is written. `answer_tone` starts at normal and is explicit-only: it changes only when the person states a preference or sets it by hand, and is never inferred from behaviour.

## Engine and event source interfaces

The engine is a Python library with no web server. The host app calls it in-process and supplies an event source, a store and a clock.

**Event source.** The only thing the engine needs from outside.

```python
class EventSource(Protocol):
    def daily_counts(
        self, feature: str, start: date, end: date,
        exclude_sessions: Sequence[str] = (),
    ) -> list[DailyCount]: ...
    # DailyCount: day, kind, happened, could_have, conversations

    def session_summaries(
        self, start: date, end: date,
    ) -> list[SessionSummary]: ...
    # used for baselines and guest detection
```

Three implementations exist: PostHog through saved endpoints, PostHog through the query API as a fallback, and a fake that returns canned numbers for tests.

**Engine.**

```python
class Engine:
    def __init__(self, dimensions, source: EventSource, store: Store, clock: Clock): ...

    def evaluate(self) -> list[Proposal]:
        """Recompute beliefs and return proposals from the rules."""

    def submit(self, proposal: Proposal) -> Verdict:
        """Arbiter: admit, defer or reject, with a reason."""

    def state(self, kind: str | None = None) -> State: ...
    def pending_notices(self) -> list[Decision]: ...
    def acknowledge(self, decision_id: str) -> None: ...
    def keep(self, decision_id: str) -> None: ...
    def undo(self, decision_id: str) -> None: ...
    def set_explicit(self, dimension: str, value, kind: str | None = None) -> None: ...
    def return_to_automatic(self, dimension: str, kind: str | None = None) -> None: ...
    def set_lock(self, area: str, locked: bool) -> None: ...
    def freeze(self, frozen: bool) -> None: ...
    def exclude_session(self, session_id: str) -> list[Decision]:
        """Recompute without it and return any changes reverted."""
```

**The arbiter's checks, in order.**

1. The resulting state is valid for the dimension, and a layout spec validates against the registry.
2. Nothing is frozen, and the area is not locked.
3. The dimension is not explicit, and the change was not undone before.
4. The gate is met, for automatic changes. A proposal the person accepts needs no gate.
5. The pace budget has room, and it is a session boundary.

**Determinism.** `evaluate` and `submit` are pure functions of the dimensions, the counts, the stored decisions and the clock. The same inputs always give the same result.

**When it runs.** The host calls `evaluate` when a session ends or goes idle, and again at the next session start.

## Proposals, decisions and the state API

A proposal asks for a change, a decision records one that was admitted, and the browser learns about both by asking.

```jsonc
// Proposal
{
  "id": "prop_…",               // minted by the app when it stores the proposal
  "source": "rule" | "hermes" | "person",
  "dimension": "long_answers",
  "kind": "coding",            // or null for global
  "to": "open",
  "change_policy": "automatic" | "proposed",
  "reason": "You opened long answers in 18 of the last 21 coding chats.",
  "evidence": { "features": […], "occasions": 21, "conversations": 6, "days": 5 },
  "payload": { }               // a look, widget, workflow, kind or schedule, for proposed changes
}

// Decision
{
  "id": "dec_…",                // minted when the proposal is admitted
  "proposal_id": "prop_…",
  "dimension": "long_answers", "kind": "coding",
  "from": "folded", "to": "open",
  "reason": "…",
  "evidence": { },             // snapshot at the time
  "dimension_version": 1,
  "status": "pending" | "shown" | "kept" | "undone" | "reverted",
  "created_at": "…", "shown_at": "…"
}
```

The contracts define the envelope above. The shape of each `evidence.features` entry belongs to the engine ticket (T20), and each `payload` belongs to the ticket that builds that kind of proposal. `to` is checked against the dimension's values at runtime.

**State API.** The browser fetches state at session start and when a conversation ends. There is no push channel for adaptation.

| Call | Purpose |
| --- | --- |
| `GET /state?kind=` | The layout spec, look, answer style and Home for this kind, plus registry and layout versions |
| `GET /notices` | Changes to show with Keep and Undo, and proposals to offer |
| `POST /notices/{id}/shown` | The change was actually displayed |
| `POST /decisions/{id}/keep`, `/undo` | The person's answer to a change |
| `POST /proposals/{id}/keep`, `/dismiss` | The person's answer to a proposal |
| `PUT /settings/{dimension}` | Set a value by hand, or return it to automatic |
| `PUT /locks/{area}`, `PUT /freeze` | Lock an area, or freeze everything |
| `GET /history` | Past decisions and their reasons |
| `POST /sessions/{id}/exclude` | Exclude a marked session |
| `POST /drafts` | A deleted draft's text, stored locally for 30 days |

The request and response bodies of these calls are designed, and added to `contracts`, by the ticket that builds each endpoint.

A change counts as made only after `shown` is reported. Until then it is pending and can be withdrawn.

## Specs, registry entries and looks

A spec describes components as data, a registry entry defines one component, and a look is a set of token values.

**Spec format.** One format serves layout specs and message specs.

```jsonc
{
  "registry_version": 3,
  "root": "shell",
  "elements": {
    "shell":   { "type": "AppShell", "props": { }, "slots": { "main": ["thread"], "side": ["sources"] } },
    "thread":  { "type": "MessageThread", "props": { } },
    "sources": { "type": "SourcesPanel", "props": { "docked": true } }
  }
}
```

| | Layout spec | Message spec |
| --- | --- | --- |
| Describes | The workspace: shell, panels, Home | Components inside one answer |
| Comes from | The engine's state | Hermes's Render tool |
| Changed by | The arbiter only | Never; it belongs to its message |
| Stored | As versioned state, with every revision | With the message in the conversation |
| On failure | Last good layout, then the baseline | The component is replaced by plain text |

**A registry entry** is one folder.

```text
web/src/registry/DataTable/
  DataTable.tsx     the skeleton, styled with tokens only
  schema.ts         Zod schema for props and slots
  events.ts         the events it emits, including shown and seen
  meta.ts           role (shell | content | panel | home | system), limits, gallery states
  DataTable.test.tsx
```

`meta.ts` also lists the states the gallery must show, such as empty, loading, long content and error. The registry is the list of these folders, and adding one raises the registry version.

**A look** is one file.

```jsonc
// contracts/looks/focused.json
{
  "id": "focused", "name": "Focused",
  "typeface": { "body": "mono", "heading": "mono" },
  "radius": "square",
  "density": "compact",
  "text_size": 3,                       // step 1 to 5
  "texture": "none",
  "motion": "subtle",
  "light": { "background": "…", "foreground": "…", "primary": "…", "accent": "…" },
  "dark":  { "background": "…", "foreground": "…", "primary": "…", "accent": "…" }
}
```

The colour keys are shadcn/ui's theming variables. A look is valid only if both variants pass every automatic check: contrast, minimum sizes, spacing scale, palette size, line length, heading steps and colour harmony. The checks run in the backend before a look is ever offered.

## Hermes: the agent interface and tools

One file in the backend talks to Hermes, and Hermes reaches Implicity only through one MCP server.

**Agent interface.** The rest of the backend sees only this.

```python
class Agent(Protocol):
    def start_conversation(self, conversation_id: str, context: PromptContext) -> None: ...
    def send(self, conversation_id: str, message: UserMessage) -> AsyncIterator[StreamPart]: ...
    def cancel(self, conversation_id: str) -> None: ...
    def run_skill(self, skill: str, inputs: dict) -> SkillResult: ...   # its own short session
    def quota(self) -> Quota: ...
```

`PromptContext` is built by the app and holds only what may enter a prompt: memory, explicit preferences, the four answer-style settings as one sentence, a deleted draft for that turn, and plain instructions derived from the person's current state. `StreamPart` is relayed to the browser in the format the AI SDK chat hook expects.

**MCP tools.** Every tool validates its input against the contracts before doing anything.

| Tool | Input | Result |
| --- | --- | --- |
| `catalogue` | Optional role filter | Each component's name, props schema, slots and limits |
| `render` | A message spec | An id the frontend renders, or a validation error |
| `propose` | A proposal request with `source: hermes` and no id; the app mints the id | The arbiter's verdict |
| `memory_save` | Item type, text, scope, sensitive flag | Saved, or queued for the person's confirmation |
| `label_kind` | Conversation id, kind | Recorded |
| `set_preference` | Dimension, value, the person's own words | Set as explicit, with a chip offering Undo |
| `retrieve` | Query, scope | Matching conversations, memory, artifacts and files |

**Skills.** Each is a short instruction file that calls the tools above and returns a structured proposal: `propose-workflow`, `propose-widget`, `propose-look`, `propose-kind`, `extract-memory`.

**Trust rule.** `memory_save`, `set_preference` and `propose` are accepted only when the triggering text was typed by the person in the current turn, or when the run was started by a rule. Content from files, artifacts, web pages or retrieval can never trigger them.

## Storage: what each module owns

Each module owns its tables in SQLite, and no module reads another's.

| Module | Tables | Notes |
| --- | --- | --- |
| Engine | `decisions`, `explicit_settings`, `locks`, `excluded_sessions`, `layout_revisions` | Beliefs are not stored; they are recomputed |
| Memory | `memory_items`, `projects`, `drafts`, `inferences`, `typing_profiles`, `guest_patterns` | Drafts expire after 30 days, states after 1 day, patterns after 30 |
| App | `conversations`, `messages`, `message_specs`, `kinds`, `looks`, `widgets`, `schedules`, `workflows`, `files` | `files` holds metadata; bodies live on a local volume |
| Agent | `agent_sessions`, `quota_log` | Maps conversations to Hermes sessions |

**Rules.**

- Every table has a migration. SQLAlchemy and Alembic are used throughout, and no query relies on a SQLite-only feature, so the move to Postgres is a configuration change.
- Every row that came from a session carries its `session_id`, so excluding or deleting a session can find everything it produced.
- Deleting an item removes the matching events from PostHog as well.
- A daily copy of the database file is kept, with the last seven retained.
