# Git workflow

- Choose one branching model and write it down. Trunk-based with short-lived branches suits continuous delivery, and a release-branch model suits a product with a scheduled release.
- Keep the branch life short. A branch that lives for a week accumulates the conflicts that a branch that lives for a day never meets.
- Protect the long-lived branches. Require the status checks, require the review, and require a fast-forward or a squash so the history stays linear.
- Use squash merges for the topic branches so the main history reads as a sequence of changes rather than a sequence of commits.
- Write the commit message for the reader in six months: a short imperative summary, then the body explaining why, and the trailers.
- Keep each commit to one logical change. A commit that fixes a bug and reformats a file is a commit nobody can revert.
- Use the hooks for the checks that are fast and local. The pre-commit hook runs the formatter and the linter, and the pipeline runs the slow checks.
- Do not make the pre-commit hook slow enough that people bypass it. A hook that adds thirty seconds gets disabled within a week.
- Keep the pull request small, and split a large one into a stack that is reviewed in order.
- Use the pull request template to state what changed, why, how it was tested, and what the reviewer should look at. A template that asks for a risk assessment is worth more than one that asks for a list of files.
- Set the branch protection to require the review from someone who is not the author, and to dismiss the stale approvals when new commits arrive.
- Automate the release: tag the version, generate the changelog from the commit history, build the artefacts, publish them, and create the release notes.
- Write the changelog for the user. What changed and why it matters, not the list of pull requests.
- Use the interactive rebase to clean up a branch before it merges, and use a fixup to fold a correction into the commit it belongs to.
- Use the bisect to find the commit that introduced a regression, and record the result in the issue.
- Revert rather than rewrite history that has already been shared. A force push to a branch someone else has pulled from is a broken promise.
- Keep the repository healthy. Prune the branches, archive the stale ones, and rewrite the large files in the history with the tooling designed for it.
