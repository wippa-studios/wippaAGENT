# Debugging and root cause

- Reproduce it first. A bug you cannot reproduce is a bug you can only theorise about, and theory is where wasted days live.
- Write down the symptom precisely: what was expected, what happened, how often, and under what conditions.
- Form one hypothesis at a time and state how it would be disproved. Then go and try to disprove it.
- Work backwards from the symptom rather than forwards from the code. Start at the failure and walk the call path until the behaviour diverges from expectation.
- Read the error message completely, including the chain and the stack. The cause is often in the part that gets skipped.
- Compare against a working case. A differential debug, where the same input succeeds on one path and fails on another, narrows the space faster than reading code.
- Bisect when the defect is recent. A binary search over the history finds the change that introduced it in a fraction of the reads.
- Correlate the logs across the whole request path, using the correlation identifier, before you form a theory. The bug is usually in a component you were not looking at.
- Use the profiler and the debugger rather than reasoning about the code. Read the memory, the CPU profile, the allocation profile, the goroutine or thread state, and the lock state.
- Check the boring causes first: the cache, the stale build, the wrong environment, the unset environment variable, the timezone, the clock skew, the race with a concurrent writer, and the boundary value.
- When you find the cause, fix it, then check whether the same shape of bug exists elsewhere. The same mistake tends to be made in three places.
- Add the regression test at the level the bug lived. A bug in a boundary condition wants a boundary test, not an end-to-end test.
- Capture the knowledge. A short note in the repository on why the bug happened prevents the same investigation next quarter.
