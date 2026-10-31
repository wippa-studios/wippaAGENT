# Backup, restore, and disaster recovery

- Decide the recovery point objective and the recovery time objective for every stateful service, and write them down. Without them, "how fast do you need to be back" becomes an argument during the incident.
- Back up everything that holds state, including the configuration that reconstructs the state and the secrets that unlock it.
- Test the restore. A backup that has never been restored is a hypothesis, and the restore is the part that usually fails.
- Run the restore drill on a schedule, into an isolated environment, and record how long it took against the objective.
- Keep the backups in a separate account or a separate region from the primary, so a compromise or a region loss does not take both.
- Encrypt the backups at rest and limit who can read them. A backup is a copy of the most sensitive data you hold.
- Watch the retention against the compliance requirement. Both directions are wrong when they conflict: deleting too early breaks the requirement, keeping too long breaches it.
- For point-in-time recovery, confirm that the write-ahead log is archived continuously and that the archive is tested, not just configured.
- Document the order of restoration for a multi-service system, and make the dependency explicit. Restoring a service before its dependency exists is a common failure.
- Rehearse the full failover, including the DNS or routing change, because the cutover is where the plan usually breaks.
- Write the decision criteria for declaring a disaster, so the call does not become a debate in the middle of the night.
