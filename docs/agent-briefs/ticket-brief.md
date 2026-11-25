Build ticket __TITLE__: GitHub issue #__NUM__ on 6DEADSHOT9/Implicity. Read it with `gh issue view __NUM__ --repo 6DEADSHOT9/Implicity`; its acceptance criteria are your definition of done.

Read first: `CLAUDE.md` (rules and layout), `CONTEXT.md` (glossary; use its terms exactly in code and text), `docs/stage-1-spec.md` (Working standards and this ticket's row), and the docs and ADRs this ticket touches: __DOCS__. The repository scaffold (T1) is merged: use its `make install`, `make lint`, `make test`, pinned tools and workspace layout, and extend them rather than adding parallel tooling.

__FOCUS__

Two other tickets are being built in parallel on their own branches: __PARALLEL__. Stay inside this ticket's scope. Keep edits to shared root files (Makefile, root package.json, pyproject.toml, README) minimal and additive so the branches merge cleanly. Do not build anything another ticket owns.

Working rules:
- Never merge, close, approve or enable auto-merge on any pull request, and never push to main. Only the user merges.
- Test-first where there is behaviour: write a failing test, make it pass, one slice at a time. Tests go through public interfaces, not internals.
- Work on this worktree's branch only. Commit messages must not mention Claude. Do not touch main.
- Pin any new tool or image versions; commit lockfiles. Never bypass the release-age guard: pin a version old enough to pass it, or stop and ask.
- Before finishing, from a clean state run install, lint and test (and any command this ticket adds), and include the output.
- Push the branch and open a pull request against main titled "__TITLE__" whose body says `Closes #__NUM__` and uses this layout: Summary (smallest visual: file tree, diagram or diff sketch), Evidence (command output, before/after where it applies), Merge Danger (one-way or two-way door, blast radius), and lists any choices the docs did not fix. The PR body must not mention Claude.
- If you are blocked on something only a human can do, stop and say exactly what is needed.

If your context is compacted, re-read this brief: __BRIEF_PATH__
