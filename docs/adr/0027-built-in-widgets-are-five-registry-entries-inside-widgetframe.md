---
status: accepted
---

# Built-in widgets are five registry entries inside WidgetFrame

Resume, Projects, Scheduled, Quick prompts and Now playing are five separate registry entries (`ResumeWidget`, `ProjectsWidget`, `ScheduledWidget`, `QuickPromptsWidget`, `NowPlayingWidget`), each with its own schema and events, so the registry has 39 component types rather than 35. Home always places a widget inside a WidgetFrame, which owns the Card, the heading, the last update, the source and dismiss; a built-in widget renders only its content. Each widget declares where its data comes from and how it refreshes in a `widget` block in its `meta.ts`.

## Considered options

- **One "Built-in widgets" entry** with a variant prop, as the first component list counted it. One id, but one schema would have to describe five different contents, and events could not tell the widgets apart without a new field.
- **Each built-in draws its own Card and heading.** Fewer pieces, but then the last update, source and dismiss are built five times, and wrapping one in a WidgetFrame would nest two cards and two headings.

## Consequences

- Component ids are permanent once they are in an append-only registry snapshot, so these five names are fixed.
- Any later widget, such as a DataTable or Metric on Home, gets the same frame for free.
- WidgetFrame depends on every widget declaring its `widget` block; the registry check enforces it for the built-ins.
