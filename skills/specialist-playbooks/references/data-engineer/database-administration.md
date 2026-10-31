# Database administration

- Know the engine and the version. Configuration advice that is wrong for the version in front of you is worse than no advice.
- Set the memory and the storage correctly first, and change one parameter at a time with a measurement before and after.
- Run the maintenance jobs automatically. Autovacuum or its equivalent, statistics refresh, and log rotation.
- Watch the vacuum and the bloat. A table that grows because the maintenance stopped is a slow outage.
- Set up streaming replication for high availability, and asynchronous or synchronous based on the durability the data needs. Asynchronous replication loses the last transactions on a failover.
- Keep the read replicas useful by routing reads deliberately, and by making the staleness visible to the caller who needs current data.
- Set up automated backups with point-in-time recovery, and test the restore on a schedule. A backup that has never been restored is a hypothesis.
- Monitor the metrics that predict failure: replication lag, connection count against the limit, transaction age, lock waits, table and index size, and the rate of dead tuples.
- Configure the connection pool and size it against the engine's own limits. The application replica count multiplies the pool.
- Watch the lock graph. A long-running transaction holding a lock while the application queues behind it is a queue forming in the database.
- Plan the failover and rehearse it. The application needs to reconnect, and the reconnection behaviour is the part that was never tested.
- Keep the credentials out of the configuration file and in a secret store with rotation.
