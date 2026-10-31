# Migrations and backfills

- Treat a schema change in the analytical layer the way you treat a schema change in a database. Add the new column, backfill it, move the readers, then remove the old one.
- Backfill in bounded batches with a pause, so the write load does not fight the live traffic. A single backfill of a large table will compete with the queries people are running.
- Make the backfill resumable. A backfill that restarts from zero after a failure will never finish on a large table.
- Make the backfill idempotent, and make it safe to run concurrently with the live pipeline. The two will overlap at the boundary.
- Reconcile after the backfill. Compare the control totals between the old and the new path, and investigate a difference rather than accepting a tolerance you did not set deliberately.
- Migrate the model and the code together, and version the model so the consumers can pin the one they expect.
- Test the migration on a copy of production-shaped data. Constraint violations and lock behaviour only appear with data.
- Keep the old path available until the new one has been verified against production traffic, and know the date it will be removed.
- Watch the cost of the migration. A backfill that reads the whole table through the serving path can dominate the cluster for hours.
