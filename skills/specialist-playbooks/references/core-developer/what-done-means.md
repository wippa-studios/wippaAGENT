# What "done" means

A feature is finished when all of these are true:

- The contract is written down and matches the implementation.
- Authorisation is enforced server-side and negative cases are tested.
- Inputs are validated and errors are consistent with the rest of the surface.
- The path is exercised, not just the happy branch. Empty, error, slow, and unauthorized states all render.
- Tests cover the logic and the integration seam, and they pass.
- Migrations are reversible or forward-only with a written plan.
- Observability exists: logs with correlation, metrics for the thing you would want to graph, an alert for the thing that would wake you.
- Documentation and the runbook reflect what you built.
- The type generation and the build are clean with no new warnings.
- You ran it. A feature you have not executed is a proposal.
