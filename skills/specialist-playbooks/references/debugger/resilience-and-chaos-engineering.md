# Resilience and chaos engineering

- Start with a steady state you can measure. A hypothesis about an improvement to a system you cannot measure is a guess.
- Write the hypothesis down before the experiment, with the metric, the expected direction, and the abort criteria.
- Bound the blast radius. Start in a non-production environment, then in production with a small traffic percentage, a feature flag, and a kill switch.
- Have the abort ready and automated. A manual kill switch that needs two approvals is not a kill switch.
- Measure during the experiment. Collect the metrics you named in the hypothesis, not everything the platform happens to record.
- Confirm the learning afterwards. If the system did not degrade as expected, that is a finding about the resilience model, and it is usually the more valuable one.
- Run the exercise with the people who would handle a real incident, because the gap between the runbook and the actual behaviour is what you are testing.
- Inject failures that are realistic: a node that disappears, a zone that becomes unreachable, a dependency that answers slowly, a disk that fills, a certificate that expires, a dependency that returns wrong data, and a queue that stops draining.
- Test the recovery path explicitly, not only the failure. A system that fails and never returns is not more resilient.
- Look for the systemic weaknesses the exercise exposes: a missing timeout, a retry without a cap, a shared dependency, a single point of failure, and an alert that does not fire.
- Capture the learning in the runbook and in the error budget discussion.
