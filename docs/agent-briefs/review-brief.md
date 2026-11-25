Review pull request #__PR__ on 6DEADSHOT9/Implicity ("__TITLE__", closes issue #__NUM__) in full. You are a reviewer, not an author: do not edit tracked files, commit, push, or comment on GitHub.

First: `git fetch origin && git checkout --detach origin/__BRANCH__` so the PR is on disk.

Read: `CLAUDE.md` (rules, layout), `CONTEXT.md` (glossary), `docs/stage-1-spec.md` (Working standards and this ticket's row), __DOCS__, issue #__NUM__ (`gh issue view __NUM__ --repo 6DEADSHOT9/Implicity`), and the PR (`gh pr view __PR__` and `gh pr diff __PR__`, both with `--repo 6DEADSHOT9/Implicity`).

Check, with evidence for each finding:
1. Every acceptance criterion in issue #__NUM__ is met. Run, from a fresh clone of the branch in a temp dir with the pinned tools, `make install`, `make lint`, `make test` and any command the PR adds. Report exact output.
2. The work matches the docs and ADRs exactly (no invented fields, names or behaviour; glossary terms used exactly) and breaks none of the seven rules in CLAUDE.md.
3. Scope: nothing another ticket owns; edits to shared root files are minimal and additive.
4. The checks can actually go red: __PROBES__ Prove each with a deliberate failure in your temp clone, then discard it.
5. Tests go through public interfaces and would catch a real regression; no test that cannot fail.
6. The PR description's claims match the diff and command output; no secrets; commit and PR text do not mention Claude.

Write your review to `REVIEW.md` at the root of this worktree (do not commit it): a one-line verdict (merge / merge after fixes / do not merge), then findings ranked most severe first, each with file and line, what is wrong, the evidence, and a suggested fix. Nits separate at the end. If a check passes, say so in one line.

Never merge, close, approve or enable auto-merge on any pull request, and never push to main. Only the user merges.

If your context is compacted, re-read this brief: __BRIEF_PATH__
