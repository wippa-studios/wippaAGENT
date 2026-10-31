# Before you touch a live environment

- Know what you are changing and what depends on it. Read the plan or the change list before you execute it.
- Have a rollback ready and know how long it takes. A rollback you have never rehearsed is a theory.
- Make the smallest change that fixes the problem. Changing five things at once makes it impossible to tell which one worked.
- Schedule the change outside the busiest window, and coordinate with whoever is on call.
- Take the pre-change backup, export, or snapshot.
- Watch the dashboards while the change runs, and know which signal tells you to stop.
- Do not combine a security fix with a refactor. The one you will need to roll back will be the one you cannot identify.
- Record what you did, when, and why, in the change log. The next person to look at this resource will need it.
- Verify after the change. A command that completed without an error is not proof that the service is healthy.
