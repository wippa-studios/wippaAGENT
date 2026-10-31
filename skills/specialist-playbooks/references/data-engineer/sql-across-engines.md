# SQL across engines

- Write to the standard where you can, and isolate the dialect-specific parts when you cannot.
- Use the recursive common table expression for graph traversal and hierarchies, and check the engine's iteration limit.
- Use the pivot and unpivot operations for cross-tabulation, and the window functions for the analytics that a grouped aggregate cannot express.
- Use the temporal tables for point-in-time queries, which are the correct answer to "what did this look like last Tuesday".
- For the geospatial queries, use the engine's spatial types and index, and do not approximate with a bounding box on plain columns.
- Handle the isolation levels deliberately, and set a lock timeout so a blocked statement fails fast rather than waiting forever.
- Use savepoints for a partial rollback within a larger transaction, and use the optimistic concurrency pattern with a version column for the update-if-unchanged semantics.
- Know when two-phase commit is genuinely needed, and how to recover from a prepared transaction that never commits.
- Use the bulk load path for ingestion rather than a sequence of inserts. The difference in load time is measured in orders of magnitude.
- Watch the execution plan after any schema change. Adding a column can change the plan of an unrelated query.
