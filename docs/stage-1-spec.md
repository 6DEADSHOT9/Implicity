# Implicity Stage 1 Spec

Nov 24, 2026

## Goal and scope

Stage 1 builds the foundation: everything that later stages adapt, capture or build on, with no adaptation of the product itself yet. It follows `architecture.md` and is written against `contracts.md`.

**Done means five things you can check yourself.**

- [ ] One command brings the whole system up from a fresh clone.
- [ ] A chat works end to end through Hermes on the Codex subscription.
- [ ] The gallery shows all 35 component skeletons in three looks, on desktop and tablet.
- [ ] Behaviour events appear in PostHog with no message content.
- [ ] The engine's demo app adapts one toy setting from canned counts, with a working Undo.

**In scope.**

- The new repository, tooling, and one Docker Compose file with every part containerized.
- The setup command.
- The contracts and their generated types.
- Design tokens and three hand-written looks: default, focused, notebook.
- The component registry, all 35 skeletons, and the gallery.
- The backend skeleton with its module boundaries and tables.
- The agent module, chat through Hermes, and the MCP server with `catalogue` and `render`.
- Capture of the eight signal families Stage 1 produces. Media playback is captured in Stage 4 (ADR 0021).
- The adaptive engine as a library, with its React package and demo app.
- Onboarding, temporary chat, and the passcode for other devices.

**Out of scope.**

- Any adaptation of the real product. The eight automatic adaptations, look proposals, Undo in the product, locks and Settings controls are Stage 2.
- Memory, answer style, kinds of chat, reading deleted drafts, and everything inferred about the person. Those are Stage 3. Stage 1 only captures the signals they will need.
- Home behaviour, widgets, schedules and media playback. Their skeletons are built now; their behaviour is Stage 4.

## Spikes

Three unknowns are settled before any other ticket starts. Each spike is limited to half a day and ends with a short written finding in `docs/spikes/findings/`.

| Spike | Question | If it fails | Brief |
| --- | --- | --- | --- |
| S1 | Can the Python backend relay Hermes's stream to the browser in the format the AI SDK chat hook expects, including tool calls? | Use assistant-ui for chat state, with the same shadcn/ui components | `spikes/S1-ai-sdk-stream.md` |
| S2 | How long after an event is sent does it appear in a query on self-hosted PostHog? | Add a delay before the engine evaluates at session end | `spikes/S2-posthog-query-delay.md` |
| S3 | Does the self-hosted PostHog build include Endpoints, and can they be created through the API? | The event source runs the same queries through the query API. Note it for scale | `spikes/S3-posthog-endpoints.md` |

A spike produces a finding, not production code. Anything it writes is thrown away or rewritten under a normal ticket. Run S2 before S3, since S3 reuses the same PostHog instance.

## Tickets

Stage 1 is 24 tickets after the spikes. Each becomes one GitHub issue with its blocking links, sized for one coding session. Where a ticket is too large in practice, split it and keep the links.

### Foundation

| # | Ticket | Delivers | Blocked by |
| --- | --- | --- | --- |
| T1 | Repository scaffold | The five folders, pnpm and uv, linting, test runners, `CONTEXT.md` and `CLAUDE.md` | S1, S2, S3 |
| T2 | Compose file | Web, backend, Hermes and the PostHog stack in one file, with development and production profiles | T1 |
| T3 | Contracts and generation | JSON Schemas for Stage 1 events, proposals, decisions and specs, with the vocabularies in ADR 0020. API bodies are added by the ticket that builds each endpoint. Generated TypeScript types and Pydantic models. Build fails when they are stale | T1 |
| T4 | Setup command | Memory check, containers up, PostHog project and key, feature registration, Codex sign-in, migrations. Safe to re-run | T2, T3 |

### Interface

| # | Ticket | Delivers | Blocked by |
| --- | --- | --- | --- |
| T5 | Tokens and looks | The token set on shadcn/ui's theming variables, the three looks with light and dark variants, four bundled typefaces | T1 |
| T6 | Registry and renderer | The registry entry format, Zod to JSON Schema export, json-render wiring, fallback to plain text and to the baseline layout | T3, T5 |
| T7 | Gallery | A page showing every skeleton in every declared state, switchable by look, mode, density, text size and screen size | T6 |
| T8 | Shell skeletons | AppShell, ConversationNavigation, Composer, ChatHeader, Search, Settings | T7 |
| T9 | Conversation skeletons | MessageBody, Details, RunActivity, MessageActions, AttachmentTray, Citation, ContextChip, ShortcutChips, ApprovalRequest | T7 |
| T10 | Content skeletons | DataTable, DataChart, CodeBlock, MediaPlayer, ArtifactWorkspace, Checklist, List, Metric, Tabs, Card | T7 |
| T11 | Panel skeletons | DockedPanel, SourcesPanel, ProjectPanel | T7 |
| T12 | Home skeletons | HomeGrid, WidgetFrame, WidgetPicker, the five built-in widgets | T7 |
| T13 | System message skeletons | ChangeNotice, ProposalCard, Nudge | T7 |

### Backend and chat

| # | Ticket | Delivers | Blocked by |
| --- | --- | --- | --- |
| T14 | Backend skeleton | FastAPI app, SQLAlchemy and Alembic, the module boundaries, every module's tables, daily backup | T3 |
| T15 | Agent module | The one file that talks to Hermes: conversations as sessions, streaming, cancel, quota | T14, S1 |
| T16 | Chat end to end | Stream relay to the browser, chat state, markdown with code as CodeBlock and tables as DataTable, conversations stored | T15, T8, T9, T10 |
| T17 | MCP server | `catalogue` and `render`, message specs validated and stored with their message | T15, T6 |

### Capture

| # | Ticket | Delivers | Blocked by |
| --- | --- | --- | --- |
| T18 | Capture wrapper and actions | The wrapper around the PostHog SDK, schema validation, shared fields, every Stage 1 action event, shown and seen tracking, fixed values checked against the owning registry entry and app-minted ids checked through the owning app interface | T3, T2, T8 |
| T19 | Turn and session summaries | Typing, reading and pointer statistics computed in the browser. A test proving no raw keystrokes, key identities or message text leave the page | T18 |

### Engine

| # | Ticket | Delivers | Blocked by |
| --- | --- | --- | --- |
| T20a | Engine evidence and beliefs | YAML dimension and feature loader with the occasion feature, event source interface with `conversation_ids` and a fake, weighting, belief computation, the gate, value lookup (Engine rules 1–6, 15) | T3 |
| T20b | Engine arbiter and state | Arbiter with its two Stage 1 paths, automatic decisions and ChangeNotices, Keep, Undo, explicit settings, return to automatic, locks, freeze, pace with session context, freshness cutoffs, the conditional atomic store (Engine rules 7–14) | T20a |
| T21 | PostHog event source | The saved-endpoint implementation or the query fallback, per S3. Feature registration from `contracts` | T20a, T4 |
| T22 | Engine React package and demo | Change notice with Keep and Undo, and a demo app with no chat that adapts one toy dimension from canned counts | T20b, T13 |

### Entry and acceptance

| # | Ticket | Delivers | Blocked by |
| --- | --- | --- | --- |
| T23 | Onboarding and access | Intro, the consent screen with three switches, temporary chat that sends no events, passcode from other devices | T16, T18 |
| T24 | Stage 1 acceptance | The five checks run from a fresh clone, and a README with requirements and setup | All |

**What can run in parallel.** After T1, three tracks are independent: interface (T5 to T13), backend and chat (T14 to T17), and engine (T20a, T20b, T22). T20 was split in two after its review rounds (ADR 0022); the engine follows the Stage 1 Engine rules in `contracts.md`. Session exclusion, offers on ProposalCards, custom kinds, layout validation, preferences said in chat, and judging changes are later-stage rules, finished by the tickets that build them. The six skeleton tickets can all run at once after T7.

## Working standards

Every ticket is built the same way, so work from different sessions fits together.

**Each ticket.**

- One branch and one pull request. Nothing is committed straight to the main branch.
- Ships with tests: pytest for the backend and engine, Vitest for the frontend.
- Is reviewed against its ticket and the contracts before merging.
- Uses the glossary's terms exactly, in code and in text.

**Each skeleton.**

- Styled with tokens only, with no colours, sizes or fonts of its own.
- Works on desktop and tablet, with touch-sized targets.
- Keyboard and screen-reader support carried over from its shadcn/ui base.
- Ships its Zod schema, its events, its limits, and the states the gallery must show.
- Looks right in all three looks, in light and dark.

**The engine.**

- Imports nothing from the app, chat, memory or Hermes.
- Is tested only through the fake event source, with a fixed clock.
- Gives the same result for the same inputs, every time.

**Machine.** 16 GB of RAM is the minimum and 32 GB is comfortable. The setup command checks this first and stops with a clear message.

**Carried over from the old repository.** Nothing by default. A piece may be copied when a ticket calls for it and it passes the same review as new code.
