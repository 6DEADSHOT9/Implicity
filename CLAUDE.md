# Working in this repository

Read `CONTEXT.md` first and use its terms exactly. Then read the document for the
area you are touching: `docs/architecture.md`, `docs/contracts.md`,
`docs/components.md`, `docs/stage-1-spec.md`. Decisions and their reasons are in
`docs/adr/`.

## Rules that never bend

1. Nothing changes the interface or the assistant's behaviour except through the arbiter.
2. No event contains message text, file names, or which keys were pressed.
3. The engine imports nothing from the app, chat, memory or Hermes.
4. Every model call goes through Hermes. Our code never names a model provider.
5. Components are styled with tokens only. No generated UI code, ever.
6. PostHog is named only in the event source implementation and the capture wrapper.
7. Each module owns its tables. No module reads another module's tables.

## Layout

| Folder | Contents |
| --- | --- |
| `web` | The React app: shell, component registry, gallery, capture wrapper |
| `api` | The Python backend: FastAPI, SQLAlchemy with Alembic, agent, memory and app modules, MCP server |
| `engine` | The liftable adaptive engine: Python library, small React package, demo app |
| `contracts` | JSON Schemas, dimension files, feature definitions, look files |
| `docs` | Design documents, ADRs, spike briefs and findings |

## How work lands

One branch and one pull request per ticket, with tests. Record a new ADR in
`docs/adr/` when a decision is hard to reverse, surprising without context, and
the result of a real trade-off.

Agents never merge, close or approve pull requests, never enable auto-merge,
and never push to main. Only the owner merges. When work is pushed and the pull
request is updated, the agent stops and reports.
