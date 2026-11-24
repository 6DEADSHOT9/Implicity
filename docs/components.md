# Implicity Components

Nov 24, 2026

## Approach

Implicity's interface is built from a fixed set of reviewed components, each defined once as a skeleton and styled entirely through design tokens.

- **Skeletons, not finished designs.** A component is its structure, behaviour, schema and events. Its look comes from the tokens for colour, type, spacing, radius and density, plus a few variants where shape really differs.
- **Style follows the person.** A look such as "indigo, mono, square" or "recipe notebook" is a set of token values, so it applies to every component at once.
- **No generated code.** Hermes and the rules can only arrange and configure components that are in the registry.
- **Start with what we need.** The registry begins with 35 component types taken from the product's screens. The wider index is consulted only when a concrete need appears.
- **One base library.** shadcn/ui is the single source for building blocks.

## The components

The registry starts with 35 component types in six groups. "Direct" means a shadcn/ui component is used as it is; "composed" means a small arrangement of shadcn/ui pieces.

### Shell

These never move. Only additions, such as a new shortcut chip, are allowed.

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| AppShell | The frame: sidebar, main area, optional docked panel | Sidebar, Resizable | Composed |
| ConversationNavigation | Sidebar with Home, New chat, Search, chat list, recent work, projects, and the quota indicator in its footer | Sidebar, Item, Kbd, Avatar | Composed |
| Composer | Input with attachments and shortcut chips | Prompt Input | Direct |
| ChatHeader | Title, kind-of-chat badge, settings | Badge, Button, Dropdown Menu | Composed |
| Search | Search across chats, also the command palette | Command (the shadcn/ui component) | Direct |
| Settings | Preferences, locks, "What Implicity notices", change history, quota detail | Dialog or Sheet, Tabs, Field, Switch, Table | Composed |

### Conversation

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| MessageBody | Rich text of a message. Code fences render as CodeBlock and markdown tables as DataTable | Message, Bubble, Typography, plus a markdown renderer | Composed |
| Details | A collapsible section, for reasoning and "why this works" | Reasoning, Collapsible | Direct |
| RunActivity | Tool steps with their status | Tool and Task, built on Trace | Direct |
| MessageActions | Copy, regenerate, feedback, version switcher, "Remember this" | Button Group, Tooltip, Pagination | Composed |
| AttachmentTray | Files and photos attached to a message | Attachment | Direct |
| Citation | A source chip, including links to the person's own memory | Inline Citation | Direct |
| ContextChip | What shaped this answer, with a one-tap correction. Variants: "Remembered", "Noticed", "Set" | Marker, Button | Composed |
| ShortcutChips | Chips for Commands, including workflow chips | Suggestion | Direct |
| ApprovalRequest | Approve, edit or deny before anything is run or changed | Confirmation | Direct |

### Content

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| DataTable | Table, with a switch to other forms | Data Table | Direct |
| DataChart | Line, bar and similar charts | Chart | Direct |
| CodeBlock | Code, with variants for diffs, stack traces and terminal output | Code Block, Stack Trace, Terminal | Direct |
| MediaPlayer | Inline video and audio from YouTube and attached files, open to more sources | None; Aspect Ratio and Slider help | Written by us |
| ArtifactWorkspace | A document-style card, such as a recipe or a draft | Card, Scroll Area, Typography | Composed |
| Checklist | Items with done and open states | Checkbox, Item | Composed |
| List | Plain or ranked rows | Item | Direct |
| Metric | One number with its context | Card, Progress | Composed |
| Tabs | Switching between views in one area | Tabs | Direct |
| Card | The generic container the others sit in | Card | Direct |

### Panels

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| DockedPanel | A side panel that can hold tabs | Resizable, Sheet on small screens, Tabs | Composed |
| SourcesPanel | Sources for the current answer | Sources | Direct |
| ProjectPanel | Decisions, constraints and files for a project | Tabs, Item | Composed |

### Home

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| HomeGrid | The arrangement of widgets | Card in a CSS grid | Composed |
| WidgetFrame | The wrapper every widget gets: title, last update, source, dismiss | Card, Dropdown Menu | Composed |
| WidgetPicker | "Customize" and "Add widget" | Sheet or Dialog, Card, Switch | Composed |
| Built-in widgets | Resume, Projects, Scheduled, Quick prompts, Now playing | Card, Item, Progress, Empty | Composed |

Other widgets, such as a CI tracker or supplier watch, are a DataTable, DataChart, Metric or Checklist inside a WidgetFrame. They are not new components.

### System messages

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| ChangeNotice | "This changed because…" with Keep and Undo | Marker inside a conversation, Toast outside one | Composed |
| ProposalCard | A proposed look, widget, workflow, schedule, kind of chat or setting change, with Keep and Dismiss and a preview | Card, Button | Composed |
| Nudge | The once-a-day in-app prompt at session start | Alert, Button | Composed |

### Features that are not separate components

- The table-or-chart switcher belongs to DataTable and DataChart.
- The version switcher belongs to MessageActions.
- Diffs and stack traces are variants of CodeBlock.
- Empty states use shadcn/ui's Empty inside the navigation and widgets.
- Locks and the change history live in Settings.
- Workbenches and dashboards are arrangements of the components above.

## What every component declares

Each registry entry carries four things beyond its code, and the rest of the system relies on them.

1. **A schema** for its props and slots, so an invalid layout is rejected before it renders.
2. **The events it emits**, including when it was actually shown. Capture comes from this, so a new component brings its own signals.
3. **Token-only styling.** It uses the design tokens and has no styles of its own.
4. **Its limits**: minimum sizes and contrast that no adaptation may break.

Widgets declare two more: where their data comes from, and how they refresh. That is what lets each one show its last update and its source.

**How the three layers use components.** Shape changes which components are open, where they sit, their default props, and the token values. Know changes what goes inside them, such as an answer that leads with a CodeBlock and folds the explanation into Details. Act composes them into larger things: a workbench is a saved arrangement, and Home is a list of widgets.

**Where the registry lives.** It belongs to the app, not to the adaptive engine. The engine works with whatever registry it is given, so another project can reuse the engine with different components.

## Where components come from

| Source | Used for |
| --- | --- |
| shadcn/ui components | The single base for building blocks: layout, inputs, tables, charts, code, messages. |
| shadcn/ui AI Elements | Bases for the AI-specific components: Prompt Input, Reasoning, Tool, Task, Sources, Inline Citation, Confirmation, Suggestion, Stack Trace, Terminal. Most are built on Trace. |
| Vercel AI SDK | Chat state on the frontend: streaming, message parts and tool calls. The shadcn/ui chat components are built around its message parts. |
| Our own code | The compositions specific to Implicity, and MediaPlayer. |
| Kokonut UI | Reference only, for interaction ideas. Not a dependency. |
| The shadcn directory index (about 143,000 components) | A development-time reference for future needs. Not part of the running system. |

Of the 35 components, 15 are direct, 19 are composed, and 1 is written from scratch. assistant-ui is no longer used.

## Design tokens and looks

A look is a named set of token values, and every component reads only tokens.

| Token group | Values |
| --- | --- |
| shadcn/ui theming variables | Background, foreground, primary, secondary, muted, accent, destructive, border, ring, chart colours, sidebar colours, radius |
| Typeface | Sans, mono, serif, and one informal face. Bundled and served locally, with no remote loading |
| Text size | Five steps, from 87.5% to 125% |
| Density | Compact, comfortable, spacious |
| Radius | Square, small, medium, round |
| Texture | None, paper grain, ruled lines |
| Motion | None, subtle, full. Follows the system's reduced-motion setting and is not learned |

- Every look has a light and a dark variant. The mode follows the system, at onboarding and afterwards, unless the person has saved a choice.
- A few presets ship with the product. Hermes can generate a look from a request or a rule's suggestion, always as a proposal with a preview.
- A look is offered only if it passes every automatic check: text contrast, minimum text and target sizes, a consistent spacing scale, a limited palette, comfortable line length, clear heading steps, and colour harmony.
- Judgment principles such as visual hierarchy, grouping and restraint are guidance inside Hermes's "propose a look" skill.
- Settings on a scale move one step per change.

## Adding components later

The registry is built to grow: adding a component touches the registry and nothing else.

**Why that holds.**

- Every component follows the same contract, so every existing look applies to a new one automatically.
- Nothing else names components directly. Hermes asks the registry for its catalogue, the renderer looks components up by name, and the engine only sees component ids and events.
- Each component lives in its own folder with its skeleton, schema and event declarations.

**Steps to add one.**

1. Identify a concrete need that no existing component or arrangement covers.
2. Find a base in shadcn/ui, or in the index if shadcn/ui has nothing.
3. Review it and reduce it to a skeleton on the tokens.
4. Write its schema, events and limits.
5. Add it to the registry and raise the registry version.

Before adding, check whether the need is a new component or a new arrangement of existing ones. Most new screens are arrangements.

**Changing or removing a component.** Saved layouts may still refer to it. When the registry version changes, saved layouts are checked, and any that no longer validate fall back to the baseline layout.

## Still to verify

- [x] Trace fits RunActivity, reasoning and sources
- [x] Marker is for notes between turns, so it is the base for ContextChip and in-conversation notices, not Citation
- [x] Item works as a general row
- [ ] Spike: confirm the AI SDK's stream format works from the Python backend relaying Hermes. If not, return to assistant-ui
- [ ] Check whether shadcn/ui's Message ships its own markdown renderer; otherwise use react-markdown with GitHub-flavoured extensions
- [ ] Choose the four bundled typefaces
