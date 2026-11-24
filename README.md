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

Copy `.env.example` to `.env` and replace the four secret placeholders with
URI-safe values from `openssl rand -hex 32`, and the encryption salt with
`openssl rand -hex 16`; retain the port settings unless they conflict with
another local service. Start the containerized
stack with `make up-development` or `make up-production`; each command waits up to
30 minutes for healthy services. Check health with `docker compose --profile development ps`
(or the `production` profile), then run `make down` to stop it. The Compose
project is named `implicity-6deadshot9-local`.

Run `make compose-smoke` to check image pins and required secrets, prove Compose
rejects an unhealthy service, send a synthetic Event through PostHog capture to
the query API, and verify ZooKeeper data survives `make down`/`make up-development`.
The smoke command uses and removes an isolated Compose project.

Hermes keeps its configuration in a named volume. After the first start, run
`docker compose exec hermes hermes setup` to configure it, then complete Codex
subscription sign-in yourself inside the container. Keep that volume to retain the
sign-in. The web and API services currently only keep the scaffold runtimes alive;
T14 and T16 add the applications.

PostHog serves plain HTTP only on a loopback-bound port; its secure redirect and
secure cookies are disabled for this local-only endpoint. The capture proxy routes
SDK requests to the pinned capture service. PostHog data services use a private
network separate from Hermes and the app scaffolds. The single-node ClickHouse
configuration and PostgreSQL init script under `deploy/` follow the PostHog
revision used by the S2/S3 findings.
