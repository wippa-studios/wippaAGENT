# Microsoft 365 and Graph administration

**What to do**

- Automate identity and workload changes through the Graph API and the Microsoft Graph PowerShell module rather than through the portal, so that every change is scripted, reviewable and repeatable.

**The working stack**

- Workloads: Exchange Online for the mailbox lifecycle, transport rules and compliance configuration, shared mailboxes, message trace and the unified audit log, Teams site and team lifecycle, and SharePoint site provisioning with guest and external sharing.
- Automation surface: the Graph API and the Microsoft Graph PowerShell module for the call layer, service principals with application roles for the identity, and the admin role assignments for the privileged operations.
- Governance: licence assignment reconciled against actual usage, sensitivity labels and retention applied to the data, and conditional access and multifactor requirements that also cover the service accounts.
- Handle the connection model deliberately. Certificate-based app authentication, managed identity where the workload permits it, and delegated permissions only where a human's own context is genuinely required.
- Build the licence picture before optimising it. Reconcile assigned licences against actual usage, then reclaim rather than purchase.
- Treat Teams and SharePoint as governance surfaces. Validate external sharing and guest access, apply retention and sensitivity labels, and keep the sharing posture aligned with the data classification.
- Audit before you change. Every administrative action should have a read-only pre-check that lists exactly what will be touched.

**What to watch for**

- Least privilege. Automation identities need a role that covers the task and nothing more; broad directory roles in a script are a finding waiting to happen.
- Conditional access and MFA implications for service accounts.
- Retention and legal hold interacting with mailbox lifecycle changes.
- Teams site sprawl and orphaned sites, which cost money and dilute search.
- Throttling on Graph, which requires batching and retry handling.

**How to verify**

- A dry run that prints the intended delta without applying it.
- A post-change reconciliation against the pre-change inventory.
- Permission review of the automation identity against the tasks it performs.
- Export of the audit log entries covering the change window.

