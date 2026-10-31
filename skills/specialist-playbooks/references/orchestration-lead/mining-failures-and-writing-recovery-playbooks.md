# Mining failures and writing recovery playbooks

**What to do**

- Take the scope as given. If the set of error sources is not specified, ask for it rather than guessing which files to read.
- Resolve the scope with a file listing and report how many files matched. If nothing matched, stop and report that, because a report built on an empty set is fiction.
- Search for concrete signatures: exception class names, status codes, stack frames, retry markers, and error prefixes. Count occurrences per signature and keep the file and line for each.
- Require agreement across at least two independent sources before calling something a pattern. A single occurrence is an anecdote, and an anecdote that matters should be recorded as unconfirmed rather than promoted to a finding.
- Look for ordered evidence when claiming a cascade: one signature consistently preceding another within the same file or trace, with both ends cited.
- Classify each occurrence into a bucket so the reader can route it: infrastructure and resource exhaustion, application and logic errors, integration and upstream service failures, timeout and retry storms, permission and authentication failures, and data or state errors.
- Write the playbook entries into the target Markdown file, newest first, updating an existing entry rather than duplicating it.
- Frame every recovery as a recommendation to implement, never as an action already taken.

**Output shape for each finding**

```json
{
  "pattern": "Upstream service 503 followed by an unbounded retry loop",
  "evidence": ["logs/run-12.log:88", "logs/run-19.log:140", "logs/run-23.log:41"],
  "frequency": 3,
  "cascade": "503 from upstream, then retry loop, then worker pool exhaustion",
  "confidence": "high",
  "suggested_recovery": "Add exponential backoff with jitter and a per-call retry budget to the external request wrapper, and open the circuit after a set number of consecutive 503 responses"
}
```

`frequency` counts the independent sources where the pattern actually appeared. `confidence` is high at three or more unambiguous sources, medium at two, and low where the pattern is suggestive only. Leave `cascade` out when there is no ordered evidence, and leave `suggested_recovery` out when the evidence does not support a specific recommendation.

**What to watch for**

- Numbers that were never counted. Frequency, affected file count and cascade depth must come from an actual search.
- Recovery rates, time to repair, and the number of cascades prevented. You cannot measure those from log files, so do not report them.
- Correlation presented as causation. Ordering that holds in one file is not a root cause.
- Duplicate signatures that differ only in wording. Merge them.
- Vague evidence. A finding without a path and a line is an opinion.

**How to verify**

- The report states how many files were scanned, how many distinct patterns were confirmed, which cascade chains were found with their evidence, and the top patterns by frequency.
- Every count is reproducible by re-running the same search.
- Every pattern has at least two cited sources, or is explicitly labelled unconfirmed.
- The written recovery is specific enough to implement: the threshold, the backoff shape, and the failure behaviour it changes.

**Turning a confirmed pattern into tracked work**

- A confirmed pattern with no owner will recur. Give it a tracked entry with a severity, an owner and a remediation note, rather than leaving it in a Markdown file that only one person reads.
- Decide whether the remediation is a fix, a guard, or a detection. A guard prevents the condition, a detection reports it, and a fix repairs the damage. A retry loop wrapped around a broken dependency is a guard, and it is often the wrong one.
- Put a regression test next to the fix where the condition can be reproduced deterministically. A pattern that came from a nondeterministic failure still deserves a test that reproduces the precondition.
- Raise the threshold before raising the tolerance. Widening the retry budget on an unbounded loop hides the symptom and multiplies the load.
- Keep the playbook entry after the fix lands, and annotate it with the change that resolved it. The next occurrence of the same signature should find the entry rather than rediscover the pattern.
