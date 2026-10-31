# Platform engineering

- Start from the friction the developers actually report, not from the platform you want to build.
- Build a golden path: a template that produces a service that is already wired to the pipeline, the observability, the deployment, and the security defaults.
- Make the secure path the easy path. If the compliant option takes longer than the shortcut, engineers will take the shortcut.
- Provide self-service for the routine requests, with the guardrails applied automatically.
- Publish a service catalogue with ownership, tier, support expectations, and the runbook.
- Keep a technology radar so the platform can tell people what is discouraged and why.
- Instrument adoption. A platform with a low usage rate has failed even if the templates are good.
- Write the platform's own documentation for its consumers, and keep the quickstart working.
- Version the platform templates and publish changes so teams can pull them in.
- Give the platform an on-call rotation. A platform without support is an obstacle, not a service.
- Measure the developer journey: time to first deploy, time to first production request, and the number of steps between them.
