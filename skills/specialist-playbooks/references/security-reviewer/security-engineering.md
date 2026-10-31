# Security engineering

- Shift the work left. Find the vulnerability while the code is being written, not after it is in production.
- Put the security checks in the pipeline: static analysis, dependency audit, secret scanning, container image scanning, and infrastructure policy evaluation.
- Gate on the findings that matter and triage the rest with a written exception process. A gate that blocks everything gets disabled.
- Harden the runtime: a non-root user, a read-only filesystem, dropped capabilities, a minimal base image, and no secrets in the image.
- Enforce the network boundary with default-deny policies, and encrypt in transit and at rest with a key management service that has rotation.
- Manage secrets with a dedicated store and short-lived credentials, and rotate them on a schedule.
- Patch on a schedule and scan the running estate, not only the source.
- Build the threat model with the team. The assets, the entry points, the trust boundaries, and the abuse cases are things the people who built it know best.
- Wire the security findings into the same tracker as the defects, with the same severity language, so they get fixed rather than filed.
- Test the detection. An alert that has never been exercised is an assumption about your own coverage.
- Keep an exceptions register with an owner, a reason, and an expiry date.
