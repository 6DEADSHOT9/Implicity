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

## How we build

**Commits and pull requests.** Commit messages, pull request text and comments never mention Claude and carry no assistant attribution. A pull request body says `Closes #N` and has Summary (the smallest visual: a tree, diagram or diff sketch), Evidence (command output, before and after), Merge Danger (one-way or two-way door, blast radius), and the choices the docs did not fix.

**Who does what.** The orchestrating session delegates each ticket to agents in Orca child worktrees of this repository. Builders are Codex `gpt-6-luna` at medium effort; reviewers are Codex `gpt-6.2-sol` at high effort, a different agent from the builder. Briefs start from `docs/agent-briefs/`. Only the owner merges.

**Worktrees.** Name each worktree after its ticket. A build worktree is `<ticket>-<slug>` on its own branch, with display name "<Ticket> build (PR #N)" once the pull request exists. A review worktree is `<ticket>-review-pr-<N>`, display name "<Ticket> review (PR #N)", on a detached HEAD: delete the branch Orca creates right after creating it. Remove a ticket's build and review worktrees once its pull request is merged or closed.

**Briefs.** A build brief starts from the issue's acceptance criteria and names the docs and ADRs to read. It requires test-first work through public interfaces, pinned versions and committed lockfiles, minimal additive edits to shared root files, a clean-state `make install`, `make lint` and `make test` with output, and a stop when something only the owner can do is needed. Every brief forbids merging, closing, approving and pushing to main, and ends with the brief's own path so an agent whose context was compacted can re-read it.

**Reviews.** A review runs from a fresh clone, checks every acceptance criterion and the docs, and proves each check can fail with deliberate failures that are then discarded. It writes `REVIEW.md` in the review worktree, uncommitted, starting with one verdict line: merge, merge after fixes, or do not merge. The builder fixes every finding with a test that fails without the fix; the same reviewer re-reviews until the verdict is merge. The final review is posted on the pull request as a record, with local paths and personal details removed.

**Docker.** Agents that start containers use their own Compose project name and ports, tear down only what they started, and leave other stacks on the machine running.

**Decisions.** When the docs leave a question open, the owner decides it by interview. The answer is written into `CONTEXT.md`, the docs, or an ADR, and merged to main in a docs pull request before builders rely on it. A brief or fix request may state what the docs already settle, but never invents a rule.
