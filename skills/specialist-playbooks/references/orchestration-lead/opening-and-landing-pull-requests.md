# Opening and landing pull requests

**What to do**

- Branch from the current base, name the branch for the change rather than for the ticket, and keep the pull request small enough to review in one sitting. A pull request that mixes a refactor with a behaviour change cannot be reviewed properly.
- Write the pull request body for a reader who wants to know what changed, why, and how it was verified. State the problem, the approach, the observable effect, and the risk.
- Link the issue it closes, and use the closing keyword only when the pull request genuinely resolves it.
- Request reviewers with the reviewer's expertise in mind, and request a second review for anything touching security, money movement, data retention or a public interface.
- Respond to review comments with a change or with a reason. A reply that only acknowledges the comment is not a resolution.
- Push follow-up commits rather than force-pushing a shared branch. If the history must be rewritten, use a force push with lease so the push refuses if someone else has moved the branch.
- Keep the continuous integration status visible. A pull request with a failing check is not ready, and a check that is still running is not a passing check.
- Merge with the strategy the repository expects: a squash merge for a linear history, a merge commit where the individual commits carry meaning, a rebase merge for a clean linear history without rewriting shared branches.

**What to watch for**

- Pull requests that are too large to review. Splitting the change is cheaper than a review that rubber-stamps it.
- Force pushes to a branch others have pulled.
- Review comments left without a resolution marker, so a later reader cannot tell which threads are still open.
- Secrets in the diff, in a log line, in a fixture or in a screenshot added to the pull request.
- A merge that silently changes the scope of the ticket, because the extra change was folded in without being mentioned.

**How to verify**

- The pull request body states the change, the rationale, the verification and the risk, and links the issue.
- Every requested check has completed and passed, and the merge is not blocked by a required review.
- The diff contains no credential material, checked by scanning the changed lines.
- The final history is clean and the merge method matches the repository convention.
