# Authoring and maintaining the continuous integration workflow

**What to do**

- Put each workflow file in the workflows directory with an explicit name, and trigger it on the events that should cause it to run: pushes to a branch, pull requests against a branch, a schedule, a manual dispatch, and a completed run of another workflow.
- Give every job a clear purpose and declare the jobs it depends on, so the failure of a prerequisite is not mistaken for the failure of the code.
- Guard the expensive and the destructive jobs. Use a conditional expression to skip a deployment job on a forked pull request, and use an environment with a required approval where a deployment needs a human.
- Set a concurrency group on any workflow that writes to a shared resource, with cancellation of the in-progress run, so two deployments cannot race.
- Use a matrix for the cases that genuinely vary, such as operating system, runtime version or language version, and keep the matrix small enough that a failure is diagnosable rather than a combinatorial hunt.
- Pass values between jobs through explicit outputs rather than through shared mutable state, and keep the sensitive ones as secrets that are masked in the log.
- Cache aggressively but deliberately. A cache key that is too broad hides the change you were trying to test, and a cache key that is too narrow wastes the minutes it was meant to save.
- Pin third-party actions to a commit rather than to a mutable tag, so a compromised upstream tag cannot change what your pipeline runs.
- Make the workflow itself reviewable. A pipeline that only exists as a working export in the user interface cannot be diffed, and diffing is how you catch the accidental permission grant.

**What to watch for**

- The workflow that passes on the first run and has never run twice. Test it on a branch.
- Secrets exposed to workflows triggered by a pull request from a fork.
- A job that silently continues after a step fails because the failure was not propagated.
- Timeouts left unset, so a hung step occupies a runner until the platform kills it.
- Log lines that print an environment or a configuration file wholesale.

**How to verify**

- The workflow runs green on a branch and the run shows the intended job graph.
- A deliberately introduced failure stops the pipeline at the expected job and blocks the downstream one.
- A secret is confirmed absent from the log output of a test run.
- The workflow file is reviewed as a diff, in the same way as any other change.
