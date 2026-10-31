# Secrets management

- Keep secrets out of the source tree, out of the image layers, and out of the logs. A secret in the repository is a secret that has leaked.
- Use a dedicated secret store with an audit trail, and give each workload only the secrets it needs.
- Issue short-lived credentials where the platform supports it. A credential that expires in an hour cannot be the cause of a long-lived breach.
- Rotate on a schedule and after a personnel change, and prove the rotation works before you need it.
- Make rotation non-disruptive. Overlap the validity windows so the new credential is proven before the old one is revoked.
- Scan the repository history for secrets, and treat a hit as an incident rather than a cleanup task.
- Never put a secret in a command line, since it lands in the shell history and the process list.
- Log access to the secret store, including reads, so an unusual pattern is visible.
- Separate the configuration from the secret. The configuration can be in version control; the secret cannot.
