# Implicity Components

Nov 24, 2026

## Approach

Implicity's interface is built from a fixed set of reviewed components, each defined once as a skeleton and styled entirely through design tokens.

- **Skeletons, not finished designs.** A component is its structure, behaviour, schema and events. Its look comes from the tokens for colour, type, spacing, radius and density, plus a few variants where shape really differs.
- **Style follows the person.** A look such as "indigo, mono, square" or "recipe notebook" is a set of token values, so it applies to every component at once.
- **No generated code.** Hermes and the rules can only arrange and configure components that are in the registry.
- **Start with what we need.** The registry begins with 39 component types taken from the product's screens. The wider index is consulted only when a concrete need appears.
- **One base library.** shadcn/ui is the single source for building blocks.

## The components

The registry starts with 39 component types in six groups. "Direct" means a shadcn/ui component is used as it is; "composed" means a small arrangement of shadcn/ui pieces.

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
| MessageBody | Rich text of a message. Code fences render as CodeBlock and markdown tables as DataTable. It renders markdown only: raw HTML in a message is shown as text, never rendered. Images load automatically over https only, as a plain image with no referrer and no CORS mode, so the browser sends that host no cookies beyond what its third-party cookie rules allow; one that cannot load shows a placeholder with its alt text and host. Images are not remembered per host and record no event | Message, Bubble, Typography, plus a markdown renderer | Composed |
| Details | A collapsible section, for reasoning and "why this works" | Reasoning, Collapsible | Direct |
| RunActivity | Tool steps with their status | Tool and Task, built on Collapsible until AI Elements ships Trace | Direct |
| MessageActions | Copy, regenerate, feedback, version switcher, answer-form switcher (prose, list, table), "Remember this" | Button Group, Tooltip, Pagination | Composed |
| AttachmentTray | Files and photos attached to a message; each attachment id is a UUID minted by the app | Attachment | Direct |
| Citation | A source chip, including links to the person's own memory. A web source is an https link; a memory source is a memory item id (a UUID minted by the app), and the chip calls its callback with that id so the app opens it | Inline Citation | Direct |
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
| DockedPanel | A side panel that can hold any tabs (one or more `{ id, label }` entries, the active one among them). Docked, it is a resizable pane beside the content; undocked, and on small screens, it opens as a Sheet over the content. On small screens it hides Dock and Undock and is shown as undocked, without changing the person's saved docked preference; crossing the breakpoint records no dock event | Resizable when docked, Sheet when undocked or on small screens, Tabs | Composed |
| SourcesPanel | Sources for the current answer | Sources | Direct |
| ProjectPanel | Decisions, constraints and files for a project, as tabs with fixed ids; it shows any non-empty subset of them that includes the active tab | Tabs, Item | Composed |

### Home

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| HomeGrid | The arrangement of widgets | Card in a CSS grid | Composed |
| WidgetFrame | The wrapper every widget gets: title, last update, source, dismiss. It owns the Card and the heading; a widget renders only its content inside it | Card, Dropdown Menu | Composed |
| WidgetPicker | "Customize": one Switch per widget on Home, which shows or hides that widget without removing it (removing is WidgetFrame's dismiss). Each widget is passed in with a widget id, unique on Home, as well as its component id, because two widgets can be built from the same component; the picker tells widgets apart by widget id, and `onWidgetChange` is called with it. "Add widget": the widgets not yet on Home, passed in as a prop; choosing one calls `onAdd` with its widget id. Its open and close record `panel_opened` and `panel_closed`, as a panel does | Sheet or Dialog, Card, Switch | Composed |
| ResumeWidget | Built-in widget: Resume | Item, Progress, Empty | Composed |
| ProjectsWidget | Built-in widget: Projects | Item, Progress, Empty | Composed |
| ScheduledWidget | Built-in widget: Scheduled | Item, Progress, Empty | Composed |
| QuickPromptsWidget | Built-in widget: Quick prompts | Item, Progress, Empty | Composed |
| NowPlayingWidget | Built-in widget: Now playing | Item, Progress, Empty | Composed |

The five built-in widgets are separate registry entries, each with its own schema and events. Home always places a widget inside a WidgetFrame; a built-in widget draws no Card or heading of its own.

Other widgets, such as a CI tracker or supplier watch, are a DataTable, DataChart, Metric or Checklist inside a WidgetFrame. They are not new components.

### System messages

| Component | What it is | shadcn/ui base | Build |
| --- | --- | --- | --- |
| ChangeNotice | "This changed because…" with Keep and Undo | Marker inside a conversation, Toast outside one | Composed |
| ProposalCard | A proposed look, widget, workflow, schedule, kind of chat or setting change, with Keep and Dismiss and a preview. The preview is required: an offer without one is rejected by the schema, and every gallery state shows one | Card, Button | Composed |
| Nudge | The once-a-day in-app prompt at session start. Stage 1 builds the skeleton only, with `onAction` and `onLater` callbacks and the `component_shown` and `component_seen` events; its action and dismissal events arrive with the nudges feature (Later) | Alert, Button | Composed |

### Features that are not separate components

- The table-or-chart switcher belongs to DataTable and DataChart.
- The version switcher and the answer-form switcher (prose, list, table) belong to MessageActions.
- Diffs and stack traces are variants of CodeBlock.
- Empty states use shadcn/ui's Empty inside the navigation and widgets.
- Locks and the change history live in Settings.
- Workbenches and dashboards are arrangements of the components above.

## What every component declares

Each registry entry carries four things beyond its code, and the rest of the system relies on them.

1. **A schema** for its props and slots, so an invalid layout is rejected before it renders.
2. **The events it emits**, including when it was actually shown. Capture comes from this, so a new component brings its own signals. A skeleton emits through the registry's capture context (`useCapture().emit`) and only events it declares from the closed vocabulary; its controls call prop callbacks, and the app decides what they do (docs/contracts.md).
3. **Token-only styling.** It uses the design tokens and has no styles of its own. A lint enforces this by allowing only known-good forms: a `style` value must be `var(--token)` or a safe keyword such as `inherit` or `auto`; colour, size, font, spacing, radius and shadow utilities in `className` must be names generated from the token set, while layout-only utilities such as `flex` and `items-center` are free; dynamic values in `style` or `className` are an error unless they go through the one helper that accepts only token names. The lint guarantees that no hard-coded colour, size, font, spacing, radius or shadow reaches a skeleton through `style` or `className`. Whether a skeleton looks right in every look, mode and screen size is checked in review and in the gallery, not by the lint.

   **The shadcn/ui primitives** (copied sources, ADR 0010) follow the same guarantee by a different route. Tailwind's default theme is cleared and its theme is defined only from the tokens, so every colour, spacing, radius, font, size or shadow utility that exists resolves to a token. In the primitives' folder the lint accepts a class only if Tailwind generates it from that theme, rejects arbitrary values such as `bg-[#f00]` or `p-[13px]`, allows inline `style` only as `var(--token)`, and leaves layout-only properties such as `grid-template-columns` free. Primitives whose styling is computed at runtime (charts, code highlighting) are adapted by the skeleton ticket that uses them, through the token helper, not copied into the base.

   **Weights and spacing are explicit.** With Preflight, headings and paragraphs have no default weight or margin, so a component sets its type weight and spacing with token classes rather than relying on browser defaults.

   **Where a look applies.** A look's token properties and its mode (`data-mode`) are set on the document root (`<html>`), so one look applies to the whole page and overlays rendered at the end of `<body>` (dialogs, popovers, menus, tooltips) inherit it. **Breakpoints** are tokens in `contracts/looks/tokens.json` with Tailwind's standard values, `sm` 40rem, `md` 48rem, `lg` 64rem and `xl` 80rem, and the Tailwind theme's breakpoints and container sizes are generated from them; they are separate from `device_class`, which comes from the device. **Animations** use `tw-animate-css`, as shadcn/ui expects, and are turned off under `prefers-reduced-motion`. **The base includes Tailwind's Preflight**, the reset the copied shadcn/ui components assume, so no control falls back to the browser's own button or form styles; a browser test checks every Button variant and Tabs trigger meets its declared contrast in every look and mode.
4. **Its limits**: minimum sizes and contrast that no adaptation may break.

Widgets declare two more: where their data comes from, and how they refresh. That is what lets each one show its last update and its source. They are declared in `meta.ts` as the `widget` block (docs/contracts.md); every built-in widget has one.

**How the three layers use components.** Shape changes which components are open, where they sit, their default props, and the token values. Know changes what goes inside them, such as an answer that leads with a CodeBlock and folds the explanation into Details. Act composes them into larger things: a workbench is a saved arrangement, and Home is a list of widgets.

**Where the registry lives.** It belongs to the app, not to the adaptive engine. The engine works with whatever registry it is given, so another project can reuse the engine with different components.

## Where components come from

| Source | Used for |
| --- | --- |
| shadcn/ui components | The single base for building blocks: layout, inputs, tables, charts, code, messages. |
| shadcn/ui AI Elements | Bases for the AI-specific components: Prompt Input, Reasoning, Tool, Task, Sources, Inline Citation, Confirmation, Suggestion, Stack Trace, Terminal. Most are built on Trace; the pinned AI Elements has no Trace yet, so Tool and Task are built on Collapsible until it ships. |
| Vercel AI SDK | Chat state on the frontend: streaming, message parts and tool calls. The shadcn/ui chat components are built around its message parts. |
| Our own code | The compositions specific to Implicity, and MediaPlayer. |
| Kokonut UI | Reference only, for interaction ideas. Not a dependency. |
| The shadcn directory index (about 143,000 components) | A development-time reference for future needs. Not part of the running system. |

Of the 39 components, 15 are direct, 23 are composed, and 1 is written from scratch. assistant-ui is no longer used.

## Design tokens and looks

A look is a named set of token values, and every component reads only tokens.

| Token group | Values |
| --- | --- |
| shadcn/ui theming variables | Background, foreground, primary, secondary, muted, accent, destructive, border, ring, chart colours, sidebar colours |
| Typeface | Sans, mono, serif, and one informal face. Bundled and served locally, with no remote loading |
| Text size | Five steps, from 87.5% to 125% |
| Density | Compact, comfortable, spacious |
| Radius | Square, small, medium, round |
| Texture | None, paper grain, ruled lines |
| Motion | None, subtle, full. Follows the system's reduced-motion setting and is not learned |

- Every look has a light and a dark variant. The mode follows the system, at onboarding and afterwards, unless the person has saved a choice.
- A few presets ship with the product. Hermes can generate a look from a request or a rule's suggestion, always as a proposal with a preview.
- The later backend proposal gate must validate text contrast, minimum text and target sizes, a consistent spacing scale, a limited palette, comfortable line length and clear heading steps; it must also assess colour harmony before a proposed look is offered.
- Judgment principles such as visual hierarchy, grouping and restraint are guidance inside Hermes's "propose a look" skill.
- Automatic changes on a scale move one step at a time; the person can set any value directly.

Each mode defines the per-look value for every shadcn/ui colour role, including charts and the canonical `sidebar` surface. The shared code and terminal palette is defined once per mode in `contracts/looks/tokens.json`, alongside derived CSS values for radius, density, text size, layout, media and headings. Preset tests check these roles and options, CSS units and scale completeness, spacing and heading order, local font assets, the 34-colour budget, WCAG AA text contrast and input boundary contrast. The future backend proposal gate must apply these checks to proposed looks and assess colour harmony; this ticket does not implement that gate.

The bundled typefaces are Inter (sans), IBM Plex Mono (mono), Source Serif 4 (serif), and Caveat (informal). Their licensed files are served from `web/public/fonts`; no font CDN is used. Default uses comfortable density and medium radius, focused uses compact density and square corners, and notebook uses spacious density, a softer radius and paper grain. Text size is a five-step setting on the look root; spacing, heading, control, sidebar, panel and media CSS values derive centrally from the shared token definition.

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

- [x] Trace fits RunActivity, reasoning and sources (Tool and Task use Collapsible until the pinned AI Elements ships Trace)
- [x] Marker is for notes between turns, so it is the base for ContextChip and in-conversation notices, not Citation. Neither shadcn/ui nor AI Elements ships a Marker, so it is our own primitive in `web/src/components/ui/marker.tsx`, composed from shadcn/ui's Separator with a label and an optional actions slot, styled with tokens like the copied primitives (issue #70)
- [x] Item works as a general row
- [ ] Spike: confirm the AI SDK's stream format works from the Python backend relaying Hermes. If not, return to assistant-ui
- [ ] Check whether shadcn/ui's Message ships its own markdown renderer; otherwise use react-markdown with GitHub-flavoured extensions
- [x] Choose the four bundled typefaces: Inter, IBM Plex Mono, Source Serif 4, and Caveat
