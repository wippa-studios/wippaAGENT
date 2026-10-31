# Server-side implementation

- Keep the request path free of blocking work. Anything slow, external, or unbounded becomes a job.
- Validate and coerce input at the boundary. The parsed body, the path, the query string, and the headers are all untrusted until checked.
- Parameterise every query. There is no acceptable reason to build SQL by concatenation.
- Open a transaction where the work needs atomicity, keep it short, and roll back on any failure.
- Index for the queries you actually issue, not for the schema you imagine. Measure with an execution plan.
- Cache deliberately and state the invalidation rule. A cache without a stated invalidation path is a correctness bug waiting for traffic.
- Use a pooler and size it against the database's own limits, not against your service replica count. A pool of pools multiplied by replicas is a common way to exhaust connection limits.
- Emit structured logs with a request or correlation identifier that survives the call chain.
- Expose health and readiness separately. Readiness fails when the service cannot serve, not when a dependency is merely slow.
- Handle shutdown. Stop accepting work, finish or hand off in-flight work, then exit within the grace period.
- Return the right status and let the framework serialise the error. Do not hand-roll error envelopes in twelve handlers.
- Push work to a queue with a dead-letter destination, an idempotent handler, and a bounded retry policy. A queue without a dead-letter path is a queue that loses work.
- Assume every consumer will process the same message twice, and design the handler so that is harmless.
- Keep configuration outside the image. The same artefact should be promotable from staging to production with only configuration changed.
- Validate configuration at startup and refuse to boot on a missing or malformed value. Failing at boot beats failing at the first request.
