# Migrations and data change

- Write the migration before the code that depends on it, so the two can be reviewed together and deployed in the order that works.
- Split a change into additive, backfill, and switch steps when the table is large or the traffic is live. A single-step migration on a big table is an outage.
- Add a new column as nullable or with a default that does not rewrite the table on your database version. Check what the engine actually does with the default.
- Backfill in batches with a pause, so the write load does not fight the live traffic.
- Add the uniqueness constraint after the backfill, not before, unless you are certain the data already satisfies it.
- Deploy code that reads both shapes before the column is populated, and code that writes both shapes before the old column is dropped. Three deploys, in that order.
- Make the down path either real or explicitly absent. A migration whose rollback is a comment is a migration with no rollback.
- Test the migration against a copy of production-shaped data, not an empty database. Constraint violations and lock behaviour only appear with data.
- Watch for the migration that succeeds on one database engine and fails on another. Test on the engine you deploy on.
