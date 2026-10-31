# Reading continuous integration status

**What to do**

- Read the run, then the jobs inside it, then the failing step inside the failing job. The run-level state tells you what happened; the job-level state tells you where; the step-level log tells you why.
- Get the actual error text from the log rather than inferring it from the job name. A job named "tests" fails for many reasons, and the last hundred lines of the failing step usually contain the one that matters.
- Distinguish the three states of a red build: the code is broken, the environment is broken, and the test is flaky. The third is the expensive one to misdiagnose.
- Reproduce a suspected flake by re-running the job and, where possible, the specific test several times. A single green re-run is weak evidence; the observed flake rate is the number you want.
- Check whether the failure existed before the change by looking at the recent run history on the base branch. A base branch that is already red means the pull request is not the cause.
- Watch for the common environment failures before assuming a code fault: an expired credential, a moved dependency, a changed runner image, a saturated runner pool, a rate limit on a third-party service, and a missing secret on a fork build.
- Re-run only the failed jobs when the platform supports it, and treat a re-run as a diagnostic rather than as a fix.
- Watch the cost of a broken pipeline as well as its status. A job that waits forty minutes for a runner is a different problem from a job that fails on the first assertion.

**What to watch for**

- Reading only the summary badge. The badge tells you that something failed and nothing about what.
- Masking a genuine regression as a flake because it failed once.
- Re-running until green and calling the pull request ready. A pipeline that needs the third attempt is a pipeline with a defect.
- Caching and artefact expiry, which produce failures that look like product failures and are not.

**How to verify**

- The failing job and step are named, and the quoted log lines are the actual error.
- The base branch history was checked, and the conclusion about cause is stated with that evidence.
- The rerun rate for a flaky test is measured rather than guessed.
