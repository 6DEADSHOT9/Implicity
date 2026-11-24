# Implicity

Software that learns how to become the right software for each person.

Implicity is a locally hosted conversational platform that adapts to one person in
three layers: **Shape** (how it looks and flows), **Know** (what it understands),
and **Act** (what it does for them).

## Status

Stage 1, foundation. Three spikes run before any other work: see `docs/spikes`.

## Start here

- `CONTEXT.md`: the shared vocabulary. Read it first.
- `CLAUDE.md`: the rules that never bend and how work lands, for coding agents.
- `docs/adr/`: the decisions that are hard to reverse, and why they were made.
- `docs/architecture.md`: the agreed design.
- `docs/contracts.md`: the exact shapes the build is written against.
- `docs/components.md`: the 35 components, their sources and the design tokens.
- `docs/stage-1-spec.md`: the Stage 1 goal, spikes and tickets.
- `docs/spikes/`: the three spike briefs.

## Requirements

16 GB of RAM minimum, 32 GB comfortable. Docker.

## Development

Install the pinned workspaces with `make install`; run `make lint` and `make test`.
The TypeScript workspace uses the Node.js version in `.node-version` and npm;
the Python workspace uses uv 0.11.25 with the version in `.python-version`.

Backend commands run from the repository root and use `data/implicity.db` by
default:

```sh
uv run --locked alembic -c api/alembic.ini upgrade head
uv run --locked uvicorn implicity_api.app:app --app-dir api/src
uv run --locked implicity-backup
```

The API saves today's dated backup at startup when it is missing, then once each
day. It retains the seven newest dated copies in `data/backups/implicity.db/`.
Set an absolute `DATABASE_URL` before migration, API startup and backup commands
to use another file; its dated copies live in `backups/<database-filename>/` beside it.
To restore, stop the API and replace `data/implicity.db` with the selected
backup before starting it again.
