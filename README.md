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

Copy `.env.example` to `.env` and replace its values with generated secrets. Start
the containerized stack with `make up-development` or `make up-production`; check
health with `docker compose --profile development ps` (or `production`), then run
`make down` to stop it. The Compose project is named `implicity-local`.

Hermes keeps its configuration in a named volume. After the first start, run
`docker compose exec hermes hermes setup` to configure it, then complete Codex
subscription sign-in yourself inside the container. Keep that volume to retain the
sign-in. The web and API services currently only keep the scaffold runtimes alive;
T14 and T16 add the applications.

The single-node ClickHouse configuration and PostgreSQL init script under
`deploy/` are pinned to the PostHog revision used by the S2/S3 findings.
