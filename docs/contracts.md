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
- **How a skeleton emits.** The registry provides a capture context. A skeleton calls `useCapture().emit(name, fields)`, typed so it accepts only events from the closed vocabulary that the skeleton declares in `events.ts`. The default context does nothing; tests use a provider that records what was emitted; the capture wrapper (T18) supplies the real provider. User actions are separate: a control calls a prop callback such as `onAction`, and the app decides what happens.
- **When a component counts as seen.** One shared registry helper, `useSeen()`, measures it for every skeleton: a component is on screen while at least half of it is visible (an IntersectionObserver), and `component_seen` is emitted once per mount after it has stayed on screen for 3 seconds, carrying the seconds it was actually visible; if it leaves the screen first, the timer resets. A component that is never on screen, such as a hidden toast, is never seen. The half-visible ratio and the 3 seconds are named constants that the capture wrapper (T18) may tune. Skeletons never measure seen time themselves. On screen means the IntersectionObserver reports at least half visible and the browser's `element.checkVisibility({ opacityProperty: true, visibilityProperty: true })` is true, checked when visibility reports arrive and again when the timer fires; `useSeen()` does not watch DOM changes or compute clipping itself. Two limits are accepted: a component hidden and shown again within the same 3 seconds may still count, and `clip-path` is ignored.
- **A choice is recorded when it shows, not when it is asked for.** A control calls its prop callback (such as `onFormChange` or `onOpenChange`) and the app decides. A controlled skeleton emits the event for a choice (`representation_switched`, a panel opening or closing, a tab changing) when its displayed value actually changes, for example when its `form` prop moves from `table` to `chart`, never on the click itself. A refused or unchanged choice records nothing.

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
| `panel_opened`, `panel_closed`, `panel_docked`, `panel_undocked` | A panel changes | None. `component` is required and identifies the panel. WidgetPicker counts as a panel for opening and closing |
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
| Workflow Command, custom kind, proposal id, decision id, attachment id, memory item id | Opaque ids minted by the app, never derived from a label, a title or content |
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

**The setup command** takes a fresh clone to a running system and is safe to re-run: each step reports what it did or skipped. It stops below 16 GB of memory, creates `.env` from `.env.example` without overwriting values, brings up the Compose stack, runs the migrations, and then needs two things only the person can do, each a one-time stop with exact instructions that resumes on the next run:
- **PostHog.** The person creates their own account in the local PostHog and a personal API key with the scopes setup names, and gives setup the key, which goes in `.env` and is never printed. With it, setup finds or creates the project and its project key, then calls the PostHog event source implementation's `register_features()`, which creates or updates each feature's saved query and leaves matching ones unchanged. Setup never creates PostHog users or writes to PostHog's database.
- **Feature registration lives in the event source implementation** (rule 6: PostHog is named only there and in the capture wrapper). `register_features()` loads feature definitions with the engine's feature loader, so there is one reading of them, and builds each saved query from one HogQL query shape that the event source's runtime reads reuse, with room for the date window and excluded sessions. Setup only calls it and reports the result; a failed write stops setup with an error.
- **Codex.** The person signs in inside the Hermes container (`hermes auth add openai-codex`). Setup only checks the sign-in and never handles the credential.

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

A dimension's occasions come from one feature that only counts chances, with no `happened`:

```yaml
# contracts/features/long_answer_seen.yaml
id: long_answer_seen
could_have:
  event: component_seen
  where: { component: MessageBody, slot: long_answer }
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
occasion: long_answer_seen # the feature whose could_have counts occasions: a long answer seen, folded or open
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
    # An occasion-only feature (no happened selector) reports happened = 0.

    def session_summaries(
        self, start: date, end: date,
        exclude_sessions: Sequence[str] = (),
    ) -> list[SessionSummary]: ...
    # used for baselines and guest detection
```

Three implementations exist: PostHog through saved endpoints, PostHog through the query API as a fallback, and a fake that returns canned numbers for tests.

**Engine.** The Stage 1 interface:

```python
class Engine:
    def __init__(self, dimensions, source: EventSource, store: Store, clock: Clock): ...

    def evaluate(self, session: SessionContext) -> list[Proposal]:
        """Recompute beliefs and return proposals from the rules."""
    def submit(self, proposal: Proposal, session: SessionContext) -> Verdict:
        """Arbiter: admit, defer or reject, with a reason."""
    # SessionContext: session_id, at_boundary. Only the host knows where a session is.

    def state(self, kind: str | None = None) -> State: ...
    def pending_notices(self) -> list[Decision]: ...
    def acknowledge(self, decision_id: str) -> None: ...
    def keep(self, decision_id: str) -> Verdict: ...
    def undo(self, decision_id: str) -> Verdict: ...
    def set_explicit(self, dimension: str, value, kind: str | None = None) -> Verdict: ...
    def return_to_automatic(self, dimension: str, kind: str | None = None) -> Verdict: ...
    def set_lock(self, area: str, locked: bool) -> None: ...
    def freeze(self, frozen: bool) -> None: ...
```

Later stages add session exclusion, offers on ProposalCards with Dismiss, custom kinds and host validation of layouts; see "Later stages" below.

**The arbiter's checks.**

1. The value is one of the dimension's values. For an automatic change, it is also not a value the person undid, it is adjacent to the current value on a scale, and the proposal's `change_policy` matches the dimension's. The person may always set an undone value back by hand (ADR 0017).
2. Nothing is frozen, and the area is not locked.
3. The dimension is not explicit, and the change was not undone before.
4. The gate is met for the judged value: the value with the winning lead (rule 5). On a scale the value applied is the adjacent step toward it, and that step needs no gate of its own.
5. The pace budget has room, and it is a session boundary.

Every change goes through the arbiter. In Stage 1 there are two paths:

| Path | Comes from | Checks |
| --- | --- | --- |
| Automatic rule decision | `evaluate`, then `submit` | 1, 2, 3, 4, 5 |
| The person's control | `set_explicit`, `return_to_automatic`, `undo` | 1, 2 |

On the automatic path a missing session boundary defers before any other check runs. Otherwise the first failing check gives the verdict.

**Store.** The host supplies the store. Each transition is written by one atomic operation, all or nothing: the value, its decision, the pace reservation and the freshness cutoff. The write is conditional: it fails, and the arbiter defers, if anything the arbiter checked changed since it read it (the value, the pace slot, a lock, freeze, or an explicit setting), so a check can never be bypassed by a change in between and two admissions can never take the same slot (ADR 0022). Tests use an in-memory store.

## Engine rules

These rules fix what the Stage 1 engine does in every case the prose above leaves open. Each has a worked example; the engine's tests mirror them (ADR 0022). "Day" always means the person's local day, from the host's time zone-aware clock.

**Counting evidence.**

1. **Conversations.** Each `DailyCount` carries the `conversation_ids` that had at least one occasion that day. The gate's occasions, conversations and days all come from the occasion feature's rows; the evidence features supply only the lead rates. The gate counts distinct ids across the window. *Example: one conversation with occasions on three days counts once, and the gate's 3 is not met; three conversations, one a day, meet it.*
2. **Occasions.** A dimension names one `occasion` feature, and its occasions are that feature's `could_have`. The loader rejects a dimension without one. *Example: `long_answers` uses `long_answer_seen`; 20 long answers seen folded and 20 seen open on a day are 40 occasions, counted once.*
3. **Lead.** *For* is the weighted rate (happened ÷ could_have) of the evidence feature toward the value, at least `gate.lead.for`. *Against* is the weighted rate of the evidence feature away from it, at most `gate.lead.against`. Each uses its own denominator. A feature with no sample (could_have of 0) does not meet the lead, and a rate above 1 is invalid input and rejected. Counting each happened at most once per occasion belongs to the feature's capture ticket. *Example: 18 expansions of 20 folded (0.90) and 1 collapse of 20 open (0.05) is a clear lead toward open. 18 of 20 folded with no open long answers at all is not. 2 of 1 is rejected.*
4. **Weight and window.** A day's counts weigh `0.5 ^ (age_in_days / half_life_days)`, where age is measured from the evaluation day. The window is the evaluation day and the `window_days − 1` days before it. A day counts toward the gate's days only if the occasion feature had at least one occasion that day. *Example: with a 60-day window and 14-day half-life, today weighs 1, 14 days ago weighs 0.5, and 60 days ago is outside the window.*
5. **Choosing a value.** Among the values whose gate is met, the one with the highest *for* rate wins; a tie keeps the current value. On a scale, an automatic change only moves to the adjacent value. *Example: `answer_length` currently medium, with short at 0.80 and long at 0.80, stays medium. `density` at compact with evidence for spacious moves to comfortable.*

**Values per kind.**

6. **Lookup order.** A kind's value is its own explicit setting, then its own learned value, then the global value, then the dimension's default. A value the person undid is never learned or proposed again, so return to automatic can never bring it back; only the person can set it again by hand (ADR 0017). *Example: with coding learned as open and no global value, writing shows the default folded. After the person undoes folded to open, evidence for open is ignored, and returning to automatic keeps folded.*

**Who decides.**

7. **Paths.** Each change uses its path's checks in the table above. The person's control is not bound by the one-step rule for scales. *Example: the person changes an explicit density from compact to spacious: accepted. The same change while everything is frozen: rejected.*
8. **Automatic changes.** A dimension with `change_policy: automatic` admits a rule decision directly and shows it as a ChangeNotice. Stage 1 has no proposed dimensions. *Example: `evaluate` returns a proposal for open from qualifying `long_answers` counts; `submit` admits folded to open; `pending_notices` returns its ChangeNotice.*
9. **Keep.** Keep on a decision is accepted only after it was acknowledged as shown. Keep records that the person agreed and changes nothing else. *Example: Keep on a decision still pending is rejected; after `acknowledge`, it is accepted.*
10. **A change nobody answers** stays in effect, with its decision `shown`, and Undo stays available while it is the active decision. *Example: a ChangeNotice ignored for a week leaves the change in place.*

**Pace.**

11. **One automatic change a day.** Admission reserves the day's slot in the same conditional write as the value. Each engine call reads the clock once, so the date and the timestamp agree. *Example: an admission at 23:59:59 is charged to that day, and a second admission at 00:00:01 is charged to the next. Two admissions racing for the same day's slot: one is admitted, the other deferred.*
12. **Session boundary.** On the automatic path, a missing boundary defers before any other check. *Example: `submit` of an automatic proposal mid-task while layout is locked returns deferred, not rejected.*

**Scales.**

13. **Freshness.** When the effective value of a scale for a kind changes (an automatic admission, an explicit setting, return to automatic, or an Undo), a freshness cutoff is set; only counts from later days count toward the next automatic step. If the effective value does not change, the cutoff stays. *Example: set compact to comfortable by hand, then return to automatic: the older evidence for spacious no longer counts. Return to automatic while the learned value equals the explicit one leaves the cutoff where it was.*

**Undo.**

14. **Undo** works only on the decision currently in effect for that dimension and kind; an older, superseded decision is rejected. Undo restores its `from` value as an explicit setting and blocks its `to` value for good (ADR 0017). *Example: after open, folded, open, undoing the first decision is rejected and undoing the third sets folded as explicit; `evaluate` never proposes open again for that kind.*

**Records.**

15. **Evidence.** A decision stores the gate's inputs: the value the gate judged (which, on a scale, can be beyond the adjacent step applied), each feature's per-day rows with their `conversation_ids`, the freshness cutoff and the evaluation day. T20a defines the evidence entry shape and T20b stores it. *Example: a density decision from compact to comfortable records spacious as the judged value; re-running the gate for spacious on its stored rows gives the same result.*

**Determinism.** Given all of its inputs (the dimensions, the counts, the store's contents, the proposal, the session context and the clock), `evaluate` and `submit` always give the same result.

**When it runs.** The host calls `evaluate` when a session ends or goes idle, and again at the next session start.

**File format.** Dimension and feature files are YAML, loaded with a safe YAML parser.

### Later stages

These rules are the current design for features no Stage 1 ticket builds. Each is finished, with its own worked examples, by the ticket that builds the feature, where its edge cases are concrete. Open questions from the PR #38 review are listed with them.

- **Session exclusion** (Stage 3, guest detection). Excluding a session re-judges automatic decisions without it; only the active decision can revert, to its `from` value; explicit settings and kept changes are never touched; a revert under a lock waits and is re-checked on unlock; reverts are ChangeNotices. *Open:* stored daily totals cannot subtract one session, so the event source or the stored evidence must keep per-session counts; which target a replayed scale step is judged against; the State a revert falls back to.
- **Offers on ProposalCards** (Stage 2 looks and proposed dimensions; Stage 3 Hermes). Hermes and person proposals always need Keep; the dimension's `change_policy` wins and a mismatch is rejected; checks run before an offer is shown and again at Keep; showing an offer reserves its session's single proposal slot and Keep confirms it; Keep and Dismiss take the session context, Keep defers off the boundary, and the host's `end_session` expires unanswered offers; a dismissed gated offer needs a fresh gate, and a gate-free one a changed payload or 7 days. *Open:* who owns a reservation at publication and how an offer is withdrawn.
- **Custom kinds** (Stage 3). A custom kind inherits its parent's learned value only, through a host `parent_kind`, between its own learned value and the global value; an inherited change does not reset the child's freshness. *Open:* whether return to automatic on a child that only changes the stored choice resets freshness.
- **Host validation of layouts** (Stage 2). The host validates a whole proposed State, not one value, through a callback. *Open:* the callback receives the full proposed State.
- **Preferences said in chat** (Stage 3, answer style). Set as explicit through the arbiter, with an Undo chip. *Open:* the record that chip's Undo acts on.
- **Judging and self-reverting a fought change** (Stage 2).

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

In Stage 1, admission applies the value and reserves the day's slot; `shown` records that its ChangeNotice was displayed. Withdrawing a pending change before it is shown belongs to a later stage.

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

A widget's `meta.ts` also has a `widget` block declaring where its data comes from and how it refreshes:

```ts
widget: { source: string /* a source id, in slot-id form */, refresh: "on_open" | "interval" | "live", intervalMinutes?: number /* required when refresh is "interval" */ }
```

Every built-in widget declares one; WidgetFrame shows the last update and source from it. Stage 1 declares the block only; fetching and refreshing the data come with the widgets feature.

`meta.ts` also lists the states the gallery must show, such as empty, loading, long content and error. Each gallery state carries the example props, and slot content where the skeleton has slots, that put the skeleton in that state. Registry validation parses each state's example with the entry's `schema.ts` and fails, naming the folder and the state, when one is missing or invalid. The ticket that adds a skeleton supplies its examples, and the gallery renders each state from its example as given. The registry is the list of these folders, and adding one raises the registry version.

An entry is exactly these files: the component is the named export matching its folder, and `schema.ts`, `events.ts` and `meta.ts` provide the rest. Nothing else is exported for the registry. Generation and loading both fail, naming the folder, when a file or its expected export is missing.

**Schema shape and rules.** An entry's Zod schema in `schema.ts` is the source of truth. Rules that relate fields to each other, such as an active tab being one of the tabs or ids being unique, are written as a Zod refinement on that schema, never by narrowing a field to a fixed list to make them checkable. The exported JSON Schema describes shape only. The registry validator and the browser renderer run the full Zod schema, so a spec that breaks a rule is rejected and falls back to plain text like any invalid spec; the server's `render` checks shape only.

**Tabs and other named parts.** A skeleton that holds a list of named parts, such as tabs, takes `{ id, label }` entries: `id` is an identifier in the same form as a slot, `label` is display text. Each part's content arrives through the slot named by its id. Events name a part by its id, never its label, so display text never enters capture (rule 2). A skeleton may fix its ids when its parts are known views; otherwise any ids are allowed.

**Built-in Commands of the shell.** The shell skeletons declare these Command ids, each one the Command it exposes: `search`, `go_home`, `new_chat`, `open_chat`, `open_project`, `open_recent`, `toggle_panel`, `open_settings`. A shortcut chip carries a declared built-in Command or an app-minted workflow Command.

**Registry versions** are recorded in append-only snapshot files, `registry-v1.json`, `registry-v2.json` and so on, each listing that version's components. The check needs no git history: the current components must match the file for the current version, and the current version must be the highest file. Adding or removing a component adds a new snapshot file and raises the version. An existing snapshot file is never edited, which review enforces.

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
    def send(self, conversation_id: str, message: UserMessage, turn_type: TurnType = "chat") -> AsyncIterator[StreamPart]: ...
    def cancel(self, conversation_id: str) -> None: ...
    async def run_skill(self, skill: str, inputs: dict) -> SkillResult: ...   # its own short session, logged as background
    def quota(self) -> Quota: ...
    def quota_settings(self) -> QuotaSettings: ...
    def set_quota_settings(self, settings: QuotaSettings) -> QuotaSettings: ...
    def may_start_background_work(self) -> bool: ...
```

`PromptContext` is built by the app and holds only what may enter a prompt: memory, explicit preferences, the four answer-style settings as one sentence, a deleted draft for that turn, and plain instructions derived from the person's current state. `StreamPart` is relayed to the browser in the format the AI SDK chat hook expects. `PromptContext`, `UserMessage`, `SkillResult`, `Quota` and `QuotaSettings` are typed values, not plain strings or dicts; `TurnType` is `chat` or `background`. A conversation's instructions from `start_conversation` are stored in `agent_sessions` with its Hermes session, so they survive a restart. A second `send` on a conversation while one is streaming is refused, so `cancel` always reaches the turn in progress.

**Quota.** `quota()` reads the subscription's usage windows from Hermes and never names a provider (ADR 0023).

```text
Quota {
  state: ok | near_limit | limited | unknown
  windows: [{ label, used_percent, resets_at }]   // as Hermes reports them, account-scoped windows only
  resets_at: RFC 3339 | null                      // when limited: the latest reset among the full windows, or Hermes's limit reset
  checked_at: RFC 3339
}
```

- **Source.** Hermes's `GET /api/model/options`, on the same port and API key as `/v1/responses`, from the provider row marked `is_current`: its `usage.windows` (each `label`, `used_percent` as percent used, `resets_at`, `scope`) and its `limit` (`scope`, `resets_at`) when present. Windows and limits whose `scope` is not `account` are ignored: a limit on one model does not stop the account.
- **State.** `limited` when Hermes reports an account-scoped `limit` or any window is at 100%. `near_limit` when any window is at or above the person's near-limit threshold (default 90%). `unknown` when there are no windows, the read failed, or the last good read is more than 15 minutes old. Otherwise `ok`. A failed read is `unknown`, never an error.
- **When it is read.** On demand (the sidebar footer and Settings) and after each turn ends, at most once a minute; the result is cached. The first read after Hermes starts is usually `unknown`, because Hermes fills its usage cache in the background.
- **Background work** starts only when `state` is `ok` and today's background tokens in `quota_log` are under the person's daily cap (default 200,000 tokens). The person's chat is never blocked by our code.
- **A failed turn.** Hermes ends a failed turn with a generic `response.failed`, so the agent module rereads `Quota` at once; when it is `limited`, the person sees that the limit is reached and when it resets, and otherwise the normal error.
- **Limits the person sets.** The daily background cap and the near-limit threshold are settings in Settings, so a person with a larger plan can raise them. They are stored in the agent module's `quota_settings`, are not dimensions, and send no event.
- **`quota_log`** holds one row per Hermes turn: time, `chat` or `background`, conversation id, and the input, output and total tokens from the turn's final event that carries usage (`response.completed`, `response.incomplete` or `response.failed`). A cancelled turn that Hermes finishes after the relay disconnects (ADR 0019) is not seen and not logged; only background turns count toward the daily cap, and those are rarely cancelled. It stores no `Quota` snapshots.
- **Shape test.** A contract test against a fake Hermes pins the fields read above; the Hermes recheck on every upgrade covers the real route, which is a dashboard route rather than Hermes's documented API.

**MCP tools.** Every tool validates its input against the contracts before doing anything.

**A rendered spec and its message.** `render` stores a valid message spec unattached, through the app module, and returns its id; it never takes a message or conversation id from the model, because only trusted code assigns identifiers (ADR 0020). When the app saves an assistant turn, it attaches the spec ids from the `render` calls and results it saw in that conversation's relayed stream. Specs left unattached are discarded after a fixed retention period.

**Message spec rules.** `render` rejects a spec, storing nothing, when it contains a shell-role component (AppShell, ConversationNavigation, ChatHeader, Composer, Search, Settings: only the app opens or places them; the browser renderer rejects them in a message spec too, so the answer falls back to plain text), when its `registry_version` is not the current one, its root is missing, an element names an unknown component or child, a prop or slot fails its schema, it has a cycle, it has more than 200 elements, or its nesting is deeper than 10. The registry's `limits` are minimum sizes and contrast for adaptations, not content bounds, so these two caps bound a spec. `catalogue` and `render` read the current-version file `registry.json`; the append-only version snapshots keep only `registry_version` and `components`. A spec attaches to exactly one message and is never re-attached or moved; discarding unattached specs is one conditional delete, so it can never remove a spec attached in the meantime. Expiry runs at startup and then daily. Checking that the target is an assistant message waits until messages have a role (T16).

| Tool | Input | Result |
| --- | --- | --- |
| `catalogue` | Optional role filter | The current `registry_version` and, for each component, its `name`, `role`, `props_schema`, `slots`, `slots_schema` and `limits` |
| `render` | A message spec only; no message or conversation id | An id the frontend renders, or a validation error |
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
| App | `conversations`, `messages`, `message_specs`, `kinds`, `looks`, `widgets`, `schedules`, `workflows`, `files` | `files` holds metadata; bodies live on a local volume. Unattached message specs are discarded after 1 day |
| Agent | `agent_sessions`, `quota_log`, `quota_settings` | Maps conversations to Hermes sessions with their instructions; logs tokens per turn; holds the person's quota limits |

**Rules.**

- Every table has a migration. SQLAlchemy and Alembic are used throughout, and no query relies on a SQLite-only feature, so the move to Postgres is a configuration change.
- Every row that came from a session carries its `session_id`, so excluding or deleting a session can find everything it produced. One exception: a message spec stored by `render` has no `session_id` until the app attaches it to its message, because the model passes no ids (ADR 0020); it gets one when attached, and is discarded if never attached.
- Deleting an item removes the matching events from PostHog as well.
- A daily copy of the database file is kept, with the last seven retained.
