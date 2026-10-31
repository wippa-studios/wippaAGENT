# Identity and access at the platform level

- Give every human and every workload its own identity. A shared account cannot be attributed, cannot be revoked for one person, and defeats the audit.
- Prefer federation over stored credentials for human access, with the identity provider owning the password policy and the factor policy.
- Require multi-factor for administrative access and for any action that changes permissions.
- Grant the least privilege that lets the subject do the job, at the narrowest scope, and review the grants on a schedule.
- Separate the roles that provision from the roles that approve. One person able to do both is a single point of failure for control.
- Use short-lived elevation for the rare administrative action rather than a permanent grant.
- Automate the joiner, mover, and leaver process so access follows the identity lifecycle rather than a request queue.
- Audit the privileged accounts specifically. A breach of a normal account is bad; a breach of a domain or subscription administrator is a different order of problem.
- Log and alert on the actions that matter for privilege: role assignment, policy change, key creation, and the disabling of a safeguard.
- Review what the break-glass accounts can do, and keep them sealed with a documented check-out procedure.
