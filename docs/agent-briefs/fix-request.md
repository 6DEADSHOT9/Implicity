The review of PR #__PR__ (__TITLE__) at __COMMIT__ returned "__VERDICT__". The full review is at __REVIEW_PATH__. Fix every finding (P1 and P2) and the nits that are cheap, following each finding's suggested fix unless the docs say otherwise. Where a finding conflicts with docs/contracts.md, docs/components.md or an ADR, the docs win: say so in the PR and do not change docs.

If your context is compacted, re-read this brief: __BRIEF_PATH__

__NOTES__

For each finding, add a public-interface test that goes red without the fix (the review's deliberate failures must now be caught). Then from a clean state run make install, make lint, make test; push new commits (no force-push); update the PR body and Evidence with a short table of finding -> fix -> test. Commit and PR text must not mention Claude.

Never merge, close, approve or enable auto-merge on any pull request, and never push to main. Only the user merges. When pushed, stop and report.
