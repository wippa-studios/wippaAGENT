# Data stores and stateful infrastructure

- Treat a data store as the part of the system that cannot be replaced from a backup in the time you have. Everything else is stateless by comparison.
- Run the store with high availability across failure zones, and understand whether the replication is synchronous, asynchronous, or a quorum write. Asynchronous replication loses the last transactions on a failover.
- Separate the read and write paths when the read volume justifies it, and make the routing explicit so a stale replica is not read by an application that needs current data.
- Size the connection budget across the whole estate. Every replica multiplies the connections, and the database limit is usually much lower than the sum of the application limits.
- Put the store behind a pooler, and set the pool per instance so the total stays under the limit.
- Set the parameters that matter and change them deliberately: the memory shared with the operating system, the working memory, the checkpoint behaviour, and the statistics target. Record the change and the reason.
- Automate the vacuum or equivalent. A table that grows because the maintenance job stopped is an outage with a long fuse.
- Watch the lock behaviour, not just the lock count. A long-running transaction that holds a lock while an application waits is a queue forming in the database.
- Enable the audit of who changed what. On a data store that holds real records, that is usually a compliance requirement rather than a convenience.
- Test the failover of the store, not just the application. The application needs to reconnect, and the reconnection behaviour is usually the part that was never tested.
- Give the store a documented restore path, and rehearse it with the application's connection settings in place.
