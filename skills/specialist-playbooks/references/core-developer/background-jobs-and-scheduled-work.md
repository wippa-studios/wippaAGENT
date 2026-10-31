# Background jobs and scheduled work

- Separate the request that enqueues from the work that runs. The handler acknowledges quickly and the worker absorbs the slow part.
- Make every job idempotent. Queues guarantee at-least-once delivery at best, and a retry that applies the effect twice is worse than a failure.
- Give each job a key for deduplication. A unique constraint on the job table is the last line of defence when the application check races.
- Bound the retry policy per job class. Transient failures retry with backoff and jitter; permanent failures go straight to the dead-letter path.
- Version the payload of a job alongside the code that consumes it. A queued job written by yesterday's build must still be readable today.
- Give long-running jobs a checkpoint so a restart does not restart the work from zero.
- Use a scheduler for recurring work, and make the schedule explicit in configuration rather than hidden in a cron on one machine.
- Keep the dead-letter queue visible. An unmonitored dead-letter queue is where work goes to disappear.
- Provide a replay command that is safe to run twice, because an operator will run it twice.
