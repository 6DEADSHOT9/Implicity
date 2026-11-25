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

Run `make setup` to check the machine, generate missing local secrets, and start
the development stack. On first run, create your PostHog account at the printed
local URL, then create a personal API key with `project:read`, `project:write`,
`endpoint:read` and `endpoint:write` scopes. Put it in `.env` as
`POSTHOG_PERSONAL_API_KEY` and run `make setup` again. Setup finds or creates the
`Implicity` project and stores its project key in `VITE_POSTHOG_API_KEY` for the
app. If Hermes reports `openai-codex: logged out`, run
`hermes auth add openai-codex` inside its container, finish sign-in and rerun
setup.
The PostHog page opens only in an interactive terminal; set
`IMPLICITY_SETUP_NO_BROWSER=1` to keep it closed (also suppressed when `CI` is
`1`, `true` or `yes`, case-insensitive).

Install the pinned workspaces with `make install`; run `make lint` and `make test`.
The TypeScript workspace uses the Node.js version in `.node-version` and npm;
the Python workspace uses uv 0.11.25 with the version in `.python-version`.

To start the stack without running setup, copy `.env.example` to `.env` and
replace its secret placeholders with URI-safe values; retain the port settings
unless they conflict with another local service. Start the containerized stack
with `make up-development` or `make up-production`; each command waits up to
45 minutes for healthy services. Check health with `docker compose --profile development ps`
(or the `production` profile), then run `make down` to stop it. The Compose
project is named `implicity-6deadshot9-local`.

Run `make compose-smoke` to check image pins and required secrets, prove Compose
rejects an unhealthy service, send a synthetic Event through PostHog capture to
the query API, and verify ZooKeeper data survives `make down`/`make up-development`.
The smoke command uses and removes an isolated Compose project.

Hermes keeps its configuration in a named volume. After the first start, run
`docker compose exec hermes hermes setup` to configure it, then complete Codex
subscription sign-in yourself inside the container. Keep that volume to retain the
sign-in. Both API services run the T14 FastAPI app; development mounts `api/src`
with Uvicorn reload enabled. The web service still keeps its scaffold runtime
alive: web startup and hot reload depend on T16, which adds the runnable web app.

PostHog serves plain HTTP only on a loopback-bound port; its secure redirect and
secure cookies are disabled for this local-only endpoint. The capture proxy routes
SDK requests to the pinned capture service. PostHog data services use a private
network separate from Hermes and the app scaffolds. The single-node ClickHouse
configuration and PostgreSQL init script under `deploy/` follow the PostHog
revision used by the S2/S3 findings; ClickHouse UDFs include the export function
required by the matched app image. The app and ingestion images are a matched
build from revision `524bb3f2faa1b2869eefa432575fd144fabd20b4` (2026-11-24):
`posthog/posthog@sha256:e83432bf0072817cf30f90bc1d05c3974a9694bc3fa2e2a27b1505be9f1ed519`
and
`ghcr.io/posthog/posthog-node@sha256:fb496e55708308c9e4cd324e301d0f665c8a4b2403131481c55f2f31b897afc6`.
The closest matching image pair found on or after the S2/S3 spike revision
`be0a6f2a4cb4f9614a7954e01032ca3223bfdbaf` (2026-11-17) was this revision.

Run the Skeleton gallery locally with `pnpm --filter @implicity/web dev`.

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
backup before starting it again. Databases and backup snapshots created before
this pre-release must be rebuilt; they cannot be upgraded.
