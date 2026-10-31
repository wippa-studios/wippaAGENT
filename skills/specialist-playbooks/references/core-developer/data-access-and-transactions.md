# Data access and transactions

- Normalise until it hurts, then denormalise where a measured read pattern demands it.
- Every foreign key gets an index. Every index has a cost in write throughput; make that trade deliberately.
- Put a uniqueness constraint in the database rather than trusting application-level checks. Two concurrent requests will both pass the check.
- Use explicit isolation levels. Read committed is the default, and repeatable read or serialisable is a decision, not an accident.
- Keep migrations in version control, forward-only where possible, and reversible where a rollback is realistic.
- A migration that locks a large table in production needs a plan: expand and contract, background backfill, or a two-step deploy.
- Prefer a single round trip for a read that needs related data. Joining in the database beats fetching and stitching in the application.
- Use batch operations rather than a loop of single-row calls when you have more than a handful of rows to touch.
- Keep a soft delete only if the business needs one. It changes every query, every unique index, and every count.
- Separate the read model from the write model only when a measured need justifies the operational cost of eventual consistency.
