---
status: accepted
---

# Quota comes from Hermes's usage windows

The quota Implicity shows, and that gates background work, is read from Hermes's account usage windows (`GET /api/model/options`, the current provider's `usage.windows` and `limit`), not counted by us. Hermes v0.23.4 fetches these from the subscription's usage endpoint, the same source the Codex CLI uses, and caches them. Our code reads only the provider row marked current, so it never names a provider.

## Considered options

- **Count tokens ourselves** from each turn's `response.completed` usage. Always available, but it cannot know the plan's limit or reset times, so it can show neither a percentage nor "near the limit".
- **Ask Hermes through a skill** (`run_skill`). Gives real numbers, but every check spends a model call and quota, and depends on the skill's wording.
- **A Hermes plugin** serving the usage over HTTP. Real numbers at no cost, but it is our code inside Hermes, to maintain across its upgrades.
- **Run `hermes usage` through the Docker socket.** Gives the app control over Docker; rejected.

## Consequences

- `/api/model/options` is a dashboard route, not Hermes's documented API, so it can change between versions. A contract test pins the fields we read, the Hermes recheck on every upgrade covers the route, and a failed or unexpected read becomes `unknown` rather than an error. We ask upstream for a documented usage endpoint.
- A failed turn does not say whether the limit caused it (`response.failed` is generic), so the agent module rereads the quota after a failure.
- Per-turn tokens are still logged in `quota_log`, for the background daily cap only.
- The thresholds are the person's settings, so a larger plan needs no code change.
