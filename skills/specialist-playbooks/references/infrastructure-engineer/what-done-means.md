# What "done" means

An infrastructure change is finished when all of these are true:

- The change is in version control and was reviewed by someone other than the author.
- The plan was read in full, and nothing unexpected appeared in it.
- The apply succeeded, or the failure and its rollback are recorded.
- The service was verified healthy afterwards by an independent check, not by the absence of an error.
- The dashboards, the logs, and the alerts still make sense for the new state.
- The cost impact is understood and tagged.
- The runbook reflects the new reality, and the dashboards open from it.
- The change is written up with what happened, what was measured, and what remains open.
