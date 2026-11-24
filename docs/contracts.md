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
| `layout_version`, `registry_version` | The workspace the person was looking at: integers, on every event, since the browser has both before it sends anything |
| `device_class`, `input_type` | `desktop` or `tablet`, from the viewport, at a breakpoint T18 documents. `mouse`, `touch`, `pen` or `none`: `mouse` includes trackpads, which browsers cannot tell apart. It starts from the pointer media query (fine gives `mouse`, coarse `touch`, none `none`), then follows the last Pointer Events type, and an unknown type maps to `mouse`. Always present |

A field that does not apply to an event is left out, never sent as null. A suspected guest is not marked on events: the mark is kept in SQLite with the module that owns it. The sessions actually excluded are those currently set aside plus those the owner has excluded; the owning module supplies that set to the host, which passes it to the event source for both feature counts and session summaries (ADR 0016, ADR 0020).

**Actions, sent as they happen.**

| Event | Sent when | Extra fields |
| --- | --- | --- |
| `session_started`, `session_ended` | A session begins, or ends on close or idle | Mode, text scale, local hour bucket (both carry the bucket of the session's start) |
| `conversation_started`, `conversation_ended` | A conversation opens or is left | |
| `message_sent` | The person sends a message | Length bucket, attachment count, the Command if a shortcut sent it |
| `answer_shown` | An answer finishes rendering | Length bucket, has code, has table, has reasoning |
| `component_shown` | A component renders | Its default state, such as folded or open |
| `component_seen` | It stays on screen for a few seconds | Its default state, seconds visible. `slot` is required whenever the occasion is slot-scoped |
| `section_expanded`, `section_collapsed` | A foldable section is toggled | None. `component` and `slot` are required and identify the section |
| `representation_switched` | An answer or data result is switched between forms | Dimension (`data_form` or `answer_form`), from, to: values of that dimension |
| `panel_opened`, `panel_closed`, `panel_docked`, `panel_undocked` | A panel changes | None. `component` is required and identifies the panel |
| `answer_copied`, `code_copied` | Content is copied | Share copied: `some`, `most` or `all` |
| `answer_regenerated`, `generation_stopped`, `message_edited` | The person redoes, stops or edits | Seconds since the answer began |
| `shortcut_used` | A shortcut chip or key is used | The Command, never the key pressed |
| `search_used` | Search is opened and used | |
| `attachment_added` | A file or photo is attached | Type: `image`, `document`, `audio`, `video` or `other`. Never the file name |
| `draft_deleted` | A draft of meaningful length is cleared before sending | Length bucket only. The text goes to the backend, never to PostHog |
| `setting_changed` | The person sets something by hand | Dimension, value, and the Command for `shortcut_chips` |
| `change_shown`, `change_kept`, `change_undone` | An admitted change is displayed, kept or undone. Only once the arbiter has created a decision | Decision id |
| `proposal_shown`, `proposal_kept`, `proposal_dismissed` | A proposal is shown on a ProposalCard and answered, before any decision exists | Proposal id, proposal type copied from the stored proposal |
| `widget_seen`, `widget_used`, `widget_pinned`, `widget_dismissed` | Home widgets (Stage 4; schema added in Stage 4) | Widget id |
| `media_played`, `media_paused`, `media_seeked`, `media_replayed` | Media playback (Stage 4; schema added in Stage 4) | Position bucket |

**Vocabularies.** Every value an event carries is a closed enum, a typed measurement or an id minted by trusted code, so no field can hold content (ADR 0020).

| Field | Values |
| --- | --- |
| Mode | `light` or `dark`: the variant of the look actually displayed |
| Text scale | The look's `text_size` step displayed, 1 to 5 |
| Local hour bucket | `night` [0, 6), `morning` [6, 12), `afternoon` [12, 18), `evening` [18, 24), in local time, taken when the session began, for `session_started`, `session_ended` and `session_summary`. Weekday or weekend is taken at the same moment |
| Length bucket | `short`, `medium` or `long`, for messages, answers and drafts alike. The character cut-offs are a data file in `contracts`, starting at 80 and 400 for messages and drafts, 600 and 2,500 for answers |
| Share copied | `some` (under half), `most` (half or more, not all), `all` |
| Attachment type | `image`, `document`, `audio`, `video`, `other`, from the file's media type in the browser |
| Component, slot, default state, built-in Command | Fixed, reviewed ids declared by the registry. The schema checks the form of the identifier; the capture wrapper rejects any value the registry does not declare. A slot named in a message spec from Hermes is checked against the registry, never taken on trust |
| Workflow Command, custom kind, proposal id, decision id | Opaque ids minted by the app, never derived from a label, a title or content |
| Command key | Always `command`, on `message_sent`, `shortcut_used` and `setting_changed`. Never the key binding |
| Measurements | Units, thresholds and formulas belong to the capture tickets (T18 for actions, T19 for summaries). The wire rule is below |

**Measurements on the wire.** The contracts publish each statistic's key and type; the capture tickets own what it means.

- The typing, reading and pointer groups are always present on `turn_summary`, and the session's typing statistics always on `session_summary`.
- Counts are whole numbers, 0 or more, and never null.
- Durations, rates and means are numbers, and null when no sample exists: one keystroke gives no gap between keys, a turn with no next action has no wait before it. A count with nothing observed, such as no hesitations, is 0. A measured 0 is a real value. The contracts' table also covers statistics that are neither counts nor durations, such as gap spread, furthest point reached and pointer distance.
- `seconds_since_answer` is null when the message is edited before an answer began.
- The kinds of chat in a session summary are a list of distinct kind ids; an unknown kind is left out.

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
| `shortcut_chips` | One on/off per Command | The Command being performed by any route | The same Command performed often enough to pass the gate |
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
    # DailyCount: day, kind, happened, could_have, conversation_ids (distinct, with at least one occasion that day)

    def session_summaries(
        self, start: date, end: date,
        exclude_sessions: Sequence[str] = (),
    ) -> list[SessionSummary]: ...
    # used for baselines and guest detection
```

Three implementations exist: PostHog through saved endpoints, PostHog through the query API as a fallback, and a fake that returns canned numbers for tests.

**Engine.**

```python
class Engine:
    def __init__(
        self, dimensions, source: EventSource, store: Store, clock: Clock,
        parent_kind: Callable[[str], str | None],   # a custom kind's predefined parent, from the host
    ): ...

    def evaluate(self, session: SessionContext) -> list[Proposal]:
        """Recompute beliefs and return proposals from the rules."""

    def submit(self, proposal: Proposal, session: SessionContext) -> Verdict:
        """Arbiter: admit, defer or reject, with a reason."""
    # SessionContext: session_id, at_boundary. Only the host knows where a session is.

    def state(self, kind: str | None = None) -> State: ...
    def pending_notices(self, session_id: str) -> list[Decision | Proposal]: ...
    def acknowledge(self, item_id: str, session_id: str) -> None: ...
    def keep(self, item_id: str, session_id: str) -> None: ...
    def dismiss(self, proposal_id: str, session_id: str) -> None: ...
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

**Store.** The host supplies the store. Each transition (a value, its decision, the pace record and the freshness cutoff) is written by one atomic operation, all or nothing (ADR 0022). Tests use an in-memory store.

## Engine rules

These rules fix what the engine does in every case the prose above leaves open. Each has a worked example; the engine's tests mirror them (ADR 0022).

**Counting evidence.**

1. **Conversations.** Each `DailyCount` carries the `conversation_ids` that had at least one occasion that day. The gate counts distinct ids across the window. *Example: one conversation with occasions on three days counts as one conversation, and the gate's 3 is not met.*
2. **Occasions.** A dimension's occasions are the sum of `could_have` across the distinct features its evidence references. Their populations must not overlap, which the `default_state` split guarantees. *Example: `long_answers` with 20 long answers seen folded and 20 seen open on a day has 40 occasions that day.*
3. **Lead.** *For* is the weighted rate (happened ÷ could_have) of the feature toward the value, at least the dimension's `lead.for`. *Against* is the weighted rate of the feature away from it, at most `lead.against`. Each uses its own denominator. *Example: 18 expansions of 20 folded (0.90) and 1 collapse of 20 open (0.05) gives a clear lead toward open.*
4. **Weight and days.** A day's counts weigh `0.5 ^ (age_in_days / half_life_days)`, measured from the evaluation date, within `window_days`. A day counts toward the gate's days only if it had at least one occasion.

**Values per kind.**

5. **Lookup order.** A kind's value is its own explicit setting, then its own learned value, then its parent's value (explicit or learned, through the host's `parent_kind`), then the global value, then the dimension's default. *Example: after coding learns open, a new custom kind whose parent is coding shows open until it has evidence of its own.*

**Who decides.**

6. **Keep.** Proposals from Hermes or the person always need Keep, whatever the dimension's `change_policy`. Rule proposals follow `change_policy`: automatic ones are admitted directly and shown as a ChangeNotice; proposed ones are offered on a ProposalCard.
7. **Offers and decisions.** Before admission there is a proposal, shown on a ProposalCard and described by the proposal events. Only the arbiter creates a decision, and only a decision has change events. The arbiter's checks run before a proposal becomes visible and again at Keep.
8. **Keep needs a display.** Keep is accepted only for a proposal shown in the same session, after it was displayed.
9. **Dismiss.** Dismissing blocks that exact offer (dimension, kind, target value) until the gate passes again on evidence gathered after the dismissal. *Example: dismissed on Monday, the same offer cannot return on Monday's evidence; it needs a fresh 20 occasions, 3 conversations and 2 days from Tuesday on.*
10. **An offer nobody answers** expires at the end of its session, counting as neither Keep nor Dismiss. It may be offered again in a later session if the gate still passes, within that session's budget.
11. **An automatic change nobody answers** stays in effect, with its decision `shown`. Keep only records that the person agreed.

**Pace.**

12. **One automatic change a day**, counted in the person's local days from the host's time zone-aware clock. Each engine call reads the clock once, so the date and the timestamp always agree.
13. **One proposal per session**, counting proposals that became visible in that session.
14. **Session boundary.** Without `at_boundary`, the arbiter defers and never admits.

**Scales.**

15. **Freshness.** Any change to a scale's value for a kind (an automatic admission, Keep, an explicit setting, return to automatic, a revert or an Undo) sets a freshness cutoff. Only counts from later days count toward the next step. *Example: set compact to comfortable by hand, then return to automatic: the older evidence for spacious no longer counts.*

**Undo and exclusion.**

16. **Undo** works only on the decision currently in effect for that dimension and kind; an older, superseded decision is rejected. Undo restores its `from` value as an explicit setting and blocks its `to` value for good (ADR 0017). *Example: after open, folded, open, undoing the first decision is rejected.*
17. **Exclusion re-judges.** Excluding a session re-runs the gate only for automatic decisions, each against its own `from`, `to` and evaluation date, without that session. A decision is reverted only if its gate no longer passes. *Example: excluding a session that contributed nothing, or one outside a decision's window, changes nothing.*
18. **Exclusion never touches** explicit settings or proposals the person kept. While an area is locked or everything is frozen, a revert waits and is applied when it is unlocked.

**Not in Stage 1.** Judging a change by whether the person works against it, and reverting a fought change with a notice, arrive with Stage 2's real adaptations. The Stage 1 engine never reverts on its own except through exclusion (ADR 0022).

**Determinism.** `evaluate` and `submit` are pure functions of the dimensions, the counts, the stored decisions and the clock. The same inputs always give the same result.

**When it runs.** The host calls `evaluate` when a session ends or goes idle, and again at the next session start.

**File format.** Dimension and feature files are YAML, loaded with a safe YAML parser.

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
  "type": "look" | "widget" | "workflow" | "kind" | "schedule" | "dimension",   // required, set by the app when it stores the proposal
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

Every offer to the person, including a dimension change under `change_policy: proposed`, is a proposal shown on a ProposalCard, and the proposal events describe it. Keep sends it to the arbiter; only an admitted proposal becomes a decision, and only a decision has change events. Automatic changes are admitted directly and shown with a ChangeNotice.

**State API.** The browser fetches state at session start and when a conversation ends. There is no push channel for adaptation.

| Call | Purpose |
| --- | --- |
| `GET /state?kind=` | The layout spec, look, answer style and Home for this kind, plus registry and layout versions |
| `GET /notices` | Changes to show with Keep and Undo, and proposals to offer |
| `POST /notices/{id}/shown` | The change was actually displayed |
| `POST /decisions/{id}/keep`, `/undo` | The person's answer to a change |
| `POST /proposals/{id}/keep`, `/dismiss` | The person's answer to a proposal |
| `PUT /settings/{dimension}` | Set a value by hand, or return it to automatic. Whether returning to automatic sends `setting_changed`, and how, is decided with this endpoint's body by the Stage 2 Settings ticket |
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

The light and dark objects contain only shadcn/ui colour keys, including `sidebar` for the sidebar surface; those colour values belong to each look. The shared code and terminal palette is defined once per mode in `contracts/looks/tokens.json`, along with derived CSS values for the root radius, density and text-size choices, spacing and dimensions. Preset tests check the fixed key sets, CSS units and scale completeness, contrast, target and input sizes, palette budget and local fonts. The later backend proposal gate must apply those checks to proposed looks and also assess colour harmony before offering them.

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
