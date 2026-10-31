# Windows PowerShell 5.1 and the RSAT administration modules

**What to do**

- Use the remote server administration tooling that ships with the platform: the ActiveDirectory module for accounts, groups, computers and organisational units, the DnsServer module for zones and records, the DhcpServer module for scopes and reservations, and the GroupPolicy module for policy objects and links.

- Check that the module is present and loadable before relying on it, because the administration tooling is an optional feature on a server and its absence produces a confusing command-not-found error rather than a clear one.
- Validate the environment before mutating anything. Confirm the machine is joined to the expected domain, confirm the account running the script holds the rights it needs, and confirm the target of the operation is the one intended.
- Read before you write. A query that shows exactly which objects would change is the cheapest safety mechanism available, and it costs one call.
- Stage the change. Create the objects in a disabled or pending state, verify them, then activate them, so that a partially completed batch does not leave half-provisioned accounts.
- Back up before you restructure. Export the name service zone before a record change, back up the group policy objects before a link change, and keep the backup where the operator will find it.
- Support the operating modes that make the operation reviewable: a dry run that reports without applying, an interactive confirmation for destructive steps, and a transcript that records everything.

**What to watch for**

- Directory objects left with a password that never expires or an account that never expires because a bulk operation set it that way.
- Over-broad delegation. A script that runs as a domain administrator for a read-only query has far more reach than the task needs.
- Synchronisation commands issued because a read looked stale. The directory replicates on its own, and a forced sync to make a query look right can cause a replication storm.
- Password history and length policy not being consulted before a reset.
- A bulk operation that stops halfway, leaving the domain in a mixed state.

**How to verify**

- The dry run output lists the intended changes and nothing else happens.
- A single-object run is executed and inspected before the bulk run is attempted.

**Working with directory objects**

- Build the account with the right shape on the first pass: the name, the organisational unit, the description that will still make sense in two years, the password that meets policy, the account that expires, and the group memberships.
- Use the directory cmdlets and the .NET directory classes rather than shelling out to legacy command line tools. The modern calls return structured objects, which is the difference between a script that can be composed and one that parses text.
- Set the password and the account expiry together, and set the password to never expire only when the account is a service account with a documented owner and a rotation plan.
- Prefer the granular password policies over a single domain-wide policy, so that an account created for a service does not inherit an interactive login requirement it cannot satisfy.
- Manage group membership by group, in bulk, and with a recorded diff, rather than by writing each member individually.
- Confirm the effective rights of the account running the script before it runs, and prefer delegating only what the task needs over running as a domain administrator.

**Working with name service and address lease data**

- Treat the zone file as the source of truth. Before a record change, export the zone so the previous state can be restored.
- Add records through the module rather than by editing the zone file directly, and record the change with the timestamp and the reason in the record comment.
- Watch for name collisions and for a record that already exists with a different type, because the update silently replaces it.
- For address lease scopes, confirm the scope exists, confirm the exclusion range is correct, and confirm the reservation does not fall inside an excluded range before creating it.

**Working with group policy**

- Back up the policy object before editing it, and note which organisational units the links point at before changing the links.
- Change the link order deliberately and record the previous order, because link order is the thing that determines which policy wins and it is invisible in the results.
- Test the policy against a pilot group and confirm the resulting settings, rather than assuming the applied result matches the edit.
- The transcript is produced and contains the expected operations.
- Post-change queries confirm the objects are in the intended state and that no unintended object changed.
