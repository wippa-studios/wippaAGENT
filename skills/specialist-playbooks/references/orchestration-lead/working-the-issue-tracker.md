# Working the issue tracker

**What to do**

- Read the issue body and the linked discussion before touching anything. The reproduction steps, the expected result and the actual result are the specification.
- Reproduce the fault before proposing a fix when the environment allows it. An issue that has been reproduced is a different artifact from an issue that has been read.
- Search the tracker for duplicates and for prior reports of the same signature before creating anything new.
- Label with the taxonomy the repository already uses, not with a new one. Add the area, the kind, and the severity that the maintainers actually distinguish between.
- Keep an issue to one problem. Splitting a bug report into three issues is easier to fix than one issue describing three symptoms.
- Write reproduction steps that someone else can follow without asking a question. Include the version, the environment, the exact input and the observed output.
- Close an issue when the underlying condition is resolved, and say what resolved it. Closing an issue because the reporter went quiet loses the signal.

**What to watch for**

- Secrets in an issue body. A token, key or password pasted into a public tracker must be treated as compromised and rotated, not merely edited.
- Labels that accumulate without meaning. A tracker with forty labels has no labels.
- Issues used as a discussion forum. Discussion belongs in a discussion or a document; the tracker holds actionable work.
- Link spam and drive-by requests, which are best answered by closing with a short explanation rather than by arguing.

**How to verify**

- The issue carries a title that states the symptom, a reproducible body, the affected version and a label from the existing taxonomy.
- A duplicate search was run and the outcome recorded.
- The closing comment names the fix or the decision, so the resolution is legible without opening the pull request.
- Any exposed credential has been rotated and the rotation is recorded.

**Tracker hygiene**

- Use the issue templates the repository already defines. A template asks for the environment, the version and the expected result, and it makes an incomplete report obvious before it is filed.
- Map issues to milestones and to the release they are expected in, so the scope of a release can be read from the tracker rather than reconstructed from commit messages.
- Review labels periodically and delete the ones that no longer separate anything. A taxonomy nobody trusts gets ignored, and ignored taxonomies stop routing work.
- Distinguish an issue that reports a symptom from one that requests a change. Symptom reports are triaged by severity and go into the backlog in the order the evidence supports, and change requests are sized and scheduled.
- Close stale issues deliberately, with a reason, and move the ones that still matter to a fresh issue rather than reviving an old thread with no history anyone can read.
- Keep an eye on the unlabelled pile. Work that nobody has claimed is work that nobody is going to do, and it is invisible until it becomes urgent.
