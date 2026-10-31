# PostgreSQL in practice

- Understand the process model and what each background worker does before you change a setting. The settings are a consequence of the architecture, not a list of knobs.
- Read the write-ahead log and the checkpoint behaviour, then size the checkpoint so it does not produce a latency spike every few minutes.
- Use the statistics target deliberately. A low target on a table with skewed data produces a bad plan that looks inexplicable until you check the statistics.
- Use the execution plan, and read it from the top. Look for a sequential scan on a large table, a nested loop over a large outer relation, a sort that spills to disk, and a hash join where a merge join was expected.
- Use partial indexes for the queries that touch a subset of a large table, and expression indexes for a predicate on a computed value.
- Use covering indexes with the include clause for the read-heavy path, and check the cost of the extra write.
- Keep the index on the foreign key column, or a join on the child side will use a sequential scan.
- Use the connection pooler in transaction mode for the general case, and in session mode only where the application needs session state.
- Autovacuum aggressively on the tables that churn. The default thresholds are tuned for a quiet database, and a busy one needs different ones.
- Use the statement timeout so a runaway query cannot hold a connection and a snapshot indefinitely.
- Use the read-only replica for the reporting workload, and be honest that the numbers on the replica are behind.
- For a time-series table, partition by range on time, and use the declarative partitioning so old partitions can be detached rather than deleted.
- Use the logical replication for cross-database or selective replication, and the streaming replication for a full replica.
- Keep the extensions minimal and pinned. An extension is code running with database privileges.
- Monitor the connection count, the lock waits, the replication lag, the transaction age, the cache hit ratio, the table growth, and the autovacuum activity.
