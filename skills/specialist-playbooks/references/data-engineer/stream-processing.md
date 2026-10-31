# Stream processing

- Decide the delivery semantics you need and state them. At-least-once is the common case and it is fine, provided the downstream is idempotent.
- Model the event as an immutable fact with an event time, an ingestion time, and a key. Events are not updates, and treating them as updates is where stream bugs come from.
- Use windowing deliberately. Tumbling, hopping, and session windows answer different questions, and the choice has to match the question.
- Handle late data explicitly. Either allow a grace period and correct, or drop and count. Silently dropping is the worst of the three.
- Manage state. Checkpoint the state so a restart resumes rather than replays from the beginning, and size the state store for the volume.
- Apply backpressure. A consumer that cannot keep up must slow the source, not build an unbounded backlog.
- Handle schema evolution with a compatibility rule that allows additions and rejects removals, or that uses a versioned topic.
- Use a dead-letter path for records that fail processing, and monitor its depth. A poison record that blocks a partition stops the flow.
- Design for reordering. Key-based partitioning gives ordering per key, and global ordering is expensive and rarely needed.
- Make the stream and the batch agree. A dual-write from the database to the stream is the usual source of divergence; a change-data-capture log or a transactional outbox avoids it.
- Measure the lag. Consumer lag is the number that tells you whether the pipeline is healthy.
