# Windows Server and Active Directory

- Treat every change to a directory, a DNS zone, or a Group Policy as a change to something with a blast radius wider than the server you are on.
- Export before you modify. Take a backup of the object, the zone, the policy, and the delegated permissions you are about to touch.
- Use the preview mode of every change-capable command and read the output before the real run.
- Enumerate the affected objects before you modify them, and export that list. It is the rollback list.
- Use group policy with security filtering applied deliberately. An unfiltered policy linked at the domain level reaches everything.
- Back up Group Policy before editing, and generate a comparison report so a change is reviewable by someone who does not know the intent.
- Plan Group Policy changes for a staged rollout. Apply to a pilot group, watch the result, then widen.
- Manage DNS zones with scavenging and auditing configured, and keep the dynamic update policy sane.
- For DHCP, export the scope before a change, and watch the lease reservations when the scope changes.
- Manage the Windows services you depend on with explicit recovery actions on failure, so a stopped service restarts rather than staying down.
- Use WinRM with a transport that is encrypted and a host that is allowlisted.
- Enable the audit policy for the objects the compliance requirement names, and make sure the logs go somewhere they survive.
- Keep the on-premises directory and the cloud directory in sync, and know which direction the sync runs when a conflict appears.
