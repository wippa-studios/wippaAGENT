# Performance review

This is the review-level pass, not a performance programme. You look for the regressions a change can introduce, and you route anything deeper to the team that owns the system.

- Establish a baseline before you judge a change. Without a before, an improvement is an opinion.
- State the target as a percentile, not an average. An average hides the tail, and users experience the tail.
- Profile rather than guess. Find the hot function, the allocation site, the blocking call, and the lock contention. The bottleneck is rarely where people assume.
- Look at the whole path. An endpoint that is fast on its own can be slow because of the six queries it makes.
- Check the database before you check the code. A missing index and a cartesian join explain most "the database is slow" reports.
- Look at the allocation profile. In a managed runtime, allocation pressure drives garbage collection and the pauses that users feel.
- Cache the expensive read, not the convenient one, and state the invalidation rule when you do.
- Batch the writes and the requests. A loop of single-row operations is a sequential network round trip per row.
- Move the work off the request path when it does not need to be there. A job is not slower, it is just not blocking a user.
- Set a performance budget in the build or the test so a regression fails automatically, and record the budget where people will see it.
