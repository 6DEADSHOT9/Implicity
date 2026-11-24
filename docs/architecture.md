# Implicity Architecture

Nov 24, 2026

## Purpose and principles

Implicity is a locally hosted conversational platform that adapts to one person in three layers: Shape (how it looks and flows), Know (what it understands), and Act (what it does for them). This document is the agreed design for the rebuild.

1. **One path for every change.** Nothing changes the interface or the assistant's behaviour except through one pipeline and one gate.
2. **Proposing is separate from admitting.** Rules and Hermes suggest. A deterministic arbiter decides.
3. **Reversible and explained.** Every change has a plain reason and an exact Undo.
4. **Explicit beats inferred.** A choice the person makes is recorded as theirs and is never overridden.
5. **Gradual.** One change at a time, one step at a time, never in the middle of a task.
6. **Chat never waits on personalization.** If any adaptive part is down, the product still works.
7. **Modular.** Each module owns its data and exposes a small interface. The adaptive engine can be lifted into another project, and the LLM provider can be swapped.
8. **One model.** A single LLM through one provider. No embedding, classifier or other model types.
9. **No generated code.** Every screen is built from reviewed components in the registry.
10. **Nothing extra.** A part is added only when the product needs it.

## System overview

Every adaptation follows the same eight stages, and the arbiter is the only place a change can be admitted.

```text
Capture        Browser summaries of every signal family
   ↓
Event store    PostHog, running on this machine
   ↓
Features       Daily counts read through an event source
   ↓
Beliefs        What Implicity thinks, with its evidence      → context →  Hermes (agent on Codex, five skills)
   ↓                                                                         ↓ proposals
Proposers      Rules, and Hermes when a rule asks            ←───────────────┘
   ↓
Arbiter        The one gate: evidence, locks, pace           ← choices ←  Controls (Undo, locks, freeze, settings)
   ↓
State          Layout, look, answer style, Home, workflows
   ↓
Renderer       Spec to React through the registry
   ↓
(behaviour in the adapted interface becomes new events, back to Capture)
```

Hermes reads beliefs and memory as context for its answers, and drafts proposals only when a rule asks or the person requests one. The person's own choices (Undo, locks, freeze and manual settings) enter at the arbiter.

| Concern | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Components | shadcn/ui as the single base; 35 skeletons on design tokens; JSON spec validated with Zod and rendered by json-render |
| Chat state | Vercel AI SDK chat hook, pending a spike |
| Backend | Python with FastAPI, one process |
| Database | SQLite now, Postgres later |
| Event store | PostHog, self-hosted on the same machine |
| Agent | Hermes |
| Model | One LLM on the Codex subscription, reached only through Hermes |
| Hosting | Local, one install on one machine, everything in one Docker Compose file |

The component list, sources and design tokens are in `components.md`.

## Modules and boundaries

Implicity is five modules that meet only through small interfaces, so any one can be lifted out or replaced. All of them run in one backend process.

| Module | What it does | Depends on |
| --- | --- | --- |
| Adaptive engine | Manages named dimensions: evidence, gates, decisions, pace and Undo. It does not know what a dimension means. Ships as a Python library used in-process, plus a small React package for capture, the change notice and Undo. | An event source |
| Event source | One interface that answers "daily counts for this feature between two dates". PostHog is the first implementation. | Nothing |
| Agent | The one file that talks to Hermes. Every model call goes through Hermes, so the provider is a Hermes setting. | Nothing |
| Memory | Remembered items, projects, drafts and what is inferred about the person. | Nothing |
| App | The chat shell, the component registry, Home, and the definitions of every dimension. Wires the others together. | All of the above |

**Rules that keep it modular.**

- Each module owns its tables. No module reads another module's data.
- The engine is generic. The app defines the dimensions (layout, look, answer style, Home, workflows), and features such as Home and nudges ask the engine for admission.
- PostHog is named only in the event source implementation and the capture wrapper. Codex is named only in Hermes's configuration.
- The component registry belongs to the app. Another project can reuse the engine with its own components and rules.
- A small demo app in the repository uses the engine with no chat, which proves it can be lifted out.

## Signals and stores

The browser turns behaviour into summaries, PostHog stores them, and SQLite stores everything else.

**What is captured.** Nine signal families are captured, all but media playback from Stage 1 and media playback in Stage 4: typing rhythm, pointer effort, reading, deleted drafts, what was shown, what was used, media playback, rhythm of day, and device context.

- The browser computes summaries. Raw keystrokes and pointer paths never leave the page, and which keys were pressed is never recorded.
- Password and secret fields are never captured.
- Every event carries a session id, and, when they apply, the kind of chat, the component and slot it concerns, and the layout it happened in.
- What was shown is logged as well as what was done, so not using something can be told apart from never seeing it.
- A thin wrapper around the PostHog SDK is the only way to record behaviour. Components never call PostHog directly.

**Where it lives.**

| Store | Holds | Notes |
| --- | --- | --- |
| PostHog, on this machine | Behaviour summaries, including per-session typing statistics | No message content. Kept 12 months. Session replay is for development only, with text masked. |
| SQLite | Beliefs, decisions, state, memory, projects, conversations, deleted drafts, typing profiles, everything inferred about the person | The only place content and inferences are stored. Daily backups, seven kept. |
| Local volume | Files and artifact bodies | Metadata in SQLite |

**Features.** Each feature is a saved PostHog endpoint that returns two daily counts per kind of chat: how often something happened, and how often it could have happened. The engine reads them through the event source interface when a session ends or goes idle, and again at the next session start. Feature definitions live in the repository and are registered in PostHog by the setup command. Sessions the owner has excluded are filtered out of every count.

**Events.** Names follow `object_action`. Actions are sent as they happen, continuous signals are summarised once per turn, and a session summary is sent when the session ends or goes idle.

**Beliefs.** Recomputed at each evaluation from a rolling 60-day window, with a 14-day half-life so recent behaviour counts more. The gate's 20 occasions are counted unweighted, and the lead is judged on the weighted counts. Only decisions and the evidence snapshot behind each one are stored, so excluding a session or deleting data needs no special handling.

**If PostHog Endpoints is unavailable.** Endpoints is in beta and may be missing from the self-hosted build. The PostHog event source then runs the same queries through the regular query API, and nothing else changes. This must be revisited before scaling, because PostHog discourages recurring use of that route.

**If PostHog is down.** Chat and the interface keep working, and learning pauses until it returns.

## What changes and how

Everything Implicity adapts is a piece of state, and every change to it passes the arbiter with a reason and an Undo.

| State | Layer | Example |
| --- | --- | --- |
| Layout | Shape | Project panel docked, sources panel open |
| Look | Shape | Theme, typeface, text size, density |
| Answer style | Know | Fix first, shorter replies in casual chats |
| Home | Act | Which widgets appear, and in what order |
| Workflows and nudges | Act | A one-tap chip for repeated steps, one nudge a day |

**Never changes.** New chat, Search, Settings, Stop and the composer stay where they are. Other shell items never reorder on their own; the shell only gains additions.

**Automatic, with a Keep/Undo notice.** Rules apply small, reversible changes on their own. The first build has eight:

1. Reasoning opens expanded or folded.
2. Long answers open or folded.
3. Data shown as a table or a chart.
4. Sources panel docked.
5. Project panel docked.
6. Shortcut chips for repeated Commands.
7. Density.
8. Answer style.

**Proposed first.** Looks, widgets, workflows, schedules, new kinds of chat, and everything Hermes drafts are offered with Keep and Dismiss and are never applied silently.

**Evidence gates.** An automatic change needs about 20 occasions, across 3 separate conversations and 2 days, with a clear lead (roughly 70% one way against 10% the other). Fast learning exists only as a developer flag.

**Scope.** A learned preference attaches to a kind of chat, with a global fallback. Device context (dark mode, text size, touch) is read live from the browser and never learned. It sets the starting look; after that, mode and text size are part of the look, so saved choices and accepted looks go through the arbiter, and events report what is displayed. Projects scope memory, not interface preferences.

**Kinds of chat.**

- Five are predefined: casual, coding, writing, analysis, other.
- New kinds appear per person. A rule flags a recurring task that fits none, Hermes proposes a named kind, and the person accepts or renames it.
- Each custom kind has a predefined parent and inherits its learned defaults until it has evidence of its own.
- At most 20 per person. A kind unused for 60 days is retired.
- Hermes labels each chat. The behaviour pipeline receives only the kind's id: a predefined kind name, or an opaque id for a custom kind that survives renames. Never the label, never the text.

**Pace.**

| Budget | Limit | When |
| --- | --- | --- |
| Automatic changes | One a day | At session start or between conversations, never mid-task |
| Proposals | One per session | |
| Nudges | One a day | At session start |

Any setting on a scale moves one step per change, and the next step needs fresh evidence gathered after the last one.

**After a change.**

- **Undo** turns that change off for good. It becomes the person's explicit choice, and only they can turn it back on.
- **Judging it.** A change is judged by whether it was kept, whether the manual action it replaced stops, and whether the person works against it. A change that is fought reverts itself with a notice.
- **Locks.** Look, layout, answer style and Home can each be locked, and one master switch freezes everything.
- **Manual control.** Every learned setting has a control in Settings. Setting it by hand is recorded as explicit and stops inference for it, and "return to automatic" hands it back.
- **Said in chat.** "Keep answers short from now on" sets the setting directly, with a chip offering Undo.

## Know: memory, answer style and drafts

Implicity owns everything the assistant remembers and everything that shapes how it answers. Hermes's own memory is switched off.

**Memory.**

- On by default, agreed at onboarding.
- Facts are saved automatically and shown with a "Remembered" chip and Edit.
- Sensitive things the person states about themselves, such as health, money or relationships, are saved only after they confirm.
- Recall uses SQLite full-text search. There is no vector store.

**Projects.** The person creates a project, or accepts a proposal when Hermes sees several chats about the same work. A project scopes memory (its decisions and constraints), its files, and the project panel.

**Answer style.** Four settings, stored per kind of chat and written into the prompt as one plain sentence:

| Setting | Values |
| --- | --- |
| Length | Short, medium, long |
| Order | Answer first, or explanation first |
| Form | Prose, list, table |
| Tone | Normal, warm, terse. Starts at normal and changes only when the person says so; it is not inferred from behaviour |

**Deleted drafts.**

- In the first build, on by default, with its own switch separate from memory.
- The deleted text stays on the device for 30 days and never goes to PostHog.
- The text is sent to the model with that turn, because only the model can interpret it.
- Whenever a draft shaped an answer, a "Noticed" chip says so and offers a one-tap correction.

**What may enter a prompt.** Confirmed and auto-saved memory, explicit preferences, the four answer-style settings, a deleted draft for that turn, and plain instructions derived from the person's current state. Nothing else that is inferred from behaviour is sent to the model.

## What Implicity infers about the person

Implicity infers momentary states, lasting traits and whether a guest is using it. All of it stays in SQLite, and the model receives the resulting instruction, never the label.

| Inference | Default | How it is made |
| --- | --- | --- |
| Momentary states: stressed, rushed, tired, relaxed | On | Statistics: how far this session's typing, reading and pacing sit from the owner's own baseline |
| Guest detection | On | The same statistics, compared against the owner's typing profile |
| Lasting traits | On | Hermes, during memory extraction, mainly from what the person says |
| Health-related needs | Off, opt-in in Settings | Sustained patterns such as difficulty with small targets |

**Rules for every inference.**

- Stored in SQLite only, never in PostHog.
- Shown under "What Implicity notices", where each item can be corrected or deleted.
- Never stated to the person as fact. A "Noticed" chip with a correction is the limit.
- Momentary states expire after a day. Patterns built from them expire after 30 days.
- Nothing is inferred until the owner has about ten sessions across five days on that device.

**Traits.** A trait exists only if it changes something, and each one declares what it adapts. The starting set is experience level per domain, preference for detail, and pace. Age group and gender are added only when a specific adaptation needs them.

**Health-related needs.** Framed as needs, not conditions: the system stores "benefits from larger targets", never a diagnosis. Changes are subtle and grow one step at a time. None of it goes to the model or to PostHog.

**What inferences may be used for.** Adjusting the current answer and interface: shorter replies, fix first, fewer interruptions, holding back nudges. New uses arrive only through a code upgrade, are listed read-only in Settings, and are announced with a one-line notice. Two limits are permanent: never to increase usage, and never timed to when someone is most persuadable.

**The owner's typing profile.** Timing statistics per device, kept in SQLite and deleted by "reset learning". The per-session statistics it is built from are stored in PostHog like every other signal.

**When a guest seems to be using it.**

- Learning pauses for that session, and the owner's memory is neither used nor shown.
- A quiet banner says the session is not being learned from, with "It's me" to restore everything.
- The session is marked either way, in SQLite and never on events, so the owner can exclude it later even if the guest tapped "It's me".
- Set-aside data is kept seven days, then deleted unless the owner claims it.
- An optional setting, off by default, keeps a guest's typing pattern as an unnamed "Guest A" to recognise them next time. The owner can name them. The banner tells the guest that returning guests are recognised.

**Excluding a session later.** Its events are filtered out of every count and beliefs are recomputed. Any change that no longer has enough evidence is reverted with a notice, and memory saved during that session is listed for the owner to keep or delete.

## Act: Home, widgets and doing work

The Act layer lets Implicity do things for the person, always by proposal and always within their approvals.

**Home.**

- Day one shows four widgets: Resume, Projects, Scheduled, Quick prompts.
- New widgets arrive only as accepted proposals, and their order follows use.
- A widget counts as seen when it is on screen while Home is in the foreground for a few seconds. Hovering or pausing on it counts more. Clicks are not required, so a chart someone only looks at stays.
- A widget unseen for 14 days is retired with a notice and can be restored from the widget picker. A pinned widget never retires.

**Where widget data comes from.**

| Tier | Source | Allowed |
| --- | --- | --- |
| 1 | Implicity's own data: chats, projects, tasks | Always |
| 2 | The person's conversations and files | Always |
| 3 | Outside sources, through Hermes tools | Only after the person approves that specific connection |

**Scheduled refresh.** Uses Hermes's built-in scheduling. Each schedule is approved individually, runs hourly at most, and there are five at most. Runs happen only while the machine is on, and every widget shows when it last updated.

**Nudges.** In-app notifications shown at session start, one a day at most. Three things can trigger one: a watched value changed meaningfully, an unfinished task has waited, or something scheduled is due. Each offers one action and "Later". Two dismissals in a row of the same type turn that type off.

**Workflows.** The same three or more steps, seen three times across separate chats, become a proposed chip. A workflow is a saved sequence of prompts with blanks for inputs. Running it performs the steps in the current chat and pauses wherever approval is needed.

**Workbenches.** An arrangement of components for a recognised situation, such as a pasted stack trace. It is offered the first two times, then opens automatically, and can be undone like any change.

**Media.** YouTube and attached files, with the player open to more sources. Play, pause, seek, replay and progress are captured, with their event schemas added in Stage 4. Implicity can answer about the moment being watched, dock a related card beside the video, and step a list in time with it.

**Approvals.** Running commands, changing or deleting the person's files, sending anything outside the machine, and changing their saved data always ask first. "Always allow" exists only for read-only actions inside a specific workflow. Personalization never grants permissions.

**Background work.** Labelling chats, extracting memory, drafting proposals and refreshing widgets share the Codex subscription with the person's chats. The person's chat always comes first. Background work runs only when no chat is in progress, has a daily cap, and pauses near the subscription's limit. The quota is shown in the sidebar footer, with detail in Settings.

## Consent, controls and protection

The person agrees once at onboarding, can see and correct everything afterwards, and can step outside it for any conversation.

**Onboarding.** A short intro, then one screen with three switches, all on, each explained in one line: memory, deleted drafts, and state inference. The screen also says a typing profile is kept. It asks nothing else. Device context sets the first look, and everything else is learned.

**Temporary chat.** A chat that sends no behaviour events, saves no memory, reads no drafts and feeds no inference.

**Data controls, in Settings.**

| Control | What it does |
| --- | --- |
| See | Everything noticed, remembered and inferred, and every change with its reason |
| Delete | Any single item. The matching events are removed from PostHog too. |
| Reset | By area, each separately: learning, memory, drafts, typing profile |
| Export | Everything, as a file |
| Uses | A read-only list of what Implicity does with what it infers |

**Access.** Open from the machine itself. A passcode is required from any other device on the network.

**Protection at rest.** The database is not encrypted by Implicity; the machine's own disk encryption is relied on. Encryption is required before any hosted version.

**Backups.** An automatic daily copy of the SQLite file, with the last seven kept. Restoring is replacing the file.

**When something fails.** A layout that fails validation or a component that throws falls back to the last good layout, then to the built-in baseline. When the registry version changes, saved layouts are checked and invalid ones return to the baseline.

## Hermes integration

Hermes is the agent, and it can draft and request but never apply.

**The model.** Every model call goes through Hermes, with no exceptions. Codex is set in Hermes's configuration, so switching provider is a Hermes setting and Implicity's code never names one.

**Tools.** The Implicity backend runs one MCP server, and Hermes connects to it like any other tool server. The tools are independent of Hermes, so a different runtime could use them unchanged.

| Tool | What it does |
| --- | --- |
| Catalogue | Lists the registry's components, their slots and limits |
| Render | Shows registry components inside an answer |
| Propose | Submits a proposal to the arbiter |
| Memory | Saves an item, or submits a sensitive one for confirmation |
| Label | Records the kind of chat for a conversation |
| Retrieve | Searches conversations, memory, artifacts and files within the current scope |

**Skills.** Five, each doing one job and each returning a structured proposal:

1. Propose a workflow.
2. Propose a widget.
3. Propose a look.
4. Propose and label kinds of chat.
5. Extract memory items, traits and preferences stated in chat.

**When Hermes proposes.** A rule spots the opportunity and asks Hermes to draft the proposal. Hermes never scans behaviour on its own. The one exception is a direct request from the person.

**Trust boundary.** Text from files, artifacts, web pages and retrieved content is data. It cannot trigger a memory write or a proposal. Only what the person typed in the current turn can.

**The chat stream.** The Python backend relays Hermes's stream to the frontend in the format the AI SDK chat hook expects. Labelling and memory extraction happen inside the normal turn where possible, so they cost no extra calls.

**Sessions.** The backend reaches Hermes over its local HTTP API and is its only client. Each conversation is one Hermes session. Each background skill run is its own short session with only the context it needs.

**Two kinds of spec.** Both use one format. The layout spec is persistent, versioned, and changed only through the arbiter. A message spec comes from the Render tool, belongs to one answer, and is never learned or stored as state, so an answer cannot alter the workspace.

## Build order

Four stages, each usable on its own.

1. **Foundation.** Three spikes first. Then the shell, all 35 component skeletons with a gallery and three hand-written looks, chat through Hermes, onboarding, capture of every Stage 1 signal into PostHog, and the adaptive engine with its demo app.
2. **Shape.** The eight automatic adaptations, looks, Undo, locks, Settings.
3. **Know.** Memory, projects, answer style, kinds of chat, deleted drafts, states, traits, guest detection.
4. **Act, first part.** Home, widgets, schedules, media.

**Later.** Nudges, workflows, workbenches, health-related needs, multi-device sync, the hosted version.

**To verify during the build.**

- [ ] Spike: the AI SDK's stream format from the Python backend relaying Hermes. Fallback: assistant-ui
- [ ] Spike: how quickly new events become queryable in self-hosted PostHog. Fallback: a longer evaluation delay
- [ ] Spike: whether PostHog Endpoints exists in the self-hosted build. Fallback: the query API
- [ ] Whether shadcn/ui's Message ships a markdown renderer
- [ ] Choose the four bundled typefaces
- [ ] Review the Codex subscription's terms before any multi-user hosting
