Re-review PR #__PR__ (__TITLE__) at __COMMIT__. Your previous review is at __PREVIOUS_REVIEW__; the fix request sent to the builder is __FIX_REQUEST__.

If your context is compacted, re-read this brief: __BRIEF_PATH__

`git fetch origin && git checkout --detach origin/__BRANCH__`. For every previous finding (P1, P2, nits), confirm it is fixed with evidence, re-running the deliberate failures from your previous review in a fresh temp clone (each must now go red). Check the fixes did not break anything else or add scope, and that the PR body matches. Run make install, make lint, make test from a fresh clone and report exact output. Overwrite REVIEW.md at the root of this worktree (do not commit it): one-line verdict (merge / merge after fixes / do not merge), then per previous finding fixed / not fixed, then any new findings ranked, nits last.

Do not edit tracked files, commit, push, or comment on GitHub. Never merge, close, approve or enable auto-merge on any pull request, and never push to main. Only the user merges.
