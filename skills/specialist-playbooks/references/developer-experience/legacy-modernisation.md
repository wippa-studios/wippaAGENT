# Legacy modernisation

- Assess before you plan. Measure the size, the test coverage, the dependency risk, the security findings, the performance baseline, and the deployment friction.
- Sort the debt into buckets by kind: the code, the dependencies, the platform, the process, the documentation, and the knowledge. Different buckets need different treatments.
- Rank the work by risk and value, and start with the item that is both cheap and on the critical path. A modernisation programme that starts with the hardest piece loses its momentum.
- Choose the migration pattern deliberately. The strangler pattern puts a new edge in front of the old system. Branch by abstraction introduces an interface over the old implementation. The parallel run runs both and compares. Event interception captures the traffic and replays it.
- Move the data last, or move it continuously. A single cutover of the data is where most modernisation programmes fail.
- Use feature flags to separate the deploy from the release, so the new path can be turned on for a segment.
- Keep the legacy platform patched and supported while the new one is built. An unpatched legacy system is the thing that actually gets exploited.
- Budget for the double-running period in cost and in complexity, and set the end date at the start.
- Capture the knowledge as you go. A migration whose understanding lives only in the person doing it does not finish.
- Plan the cutover with a rehearsed rollback, and rehearse the rollback, not just the cutover.
- Keep the change deployable at every step. A branch that does not build for two weeks does not get merged.
- Measure the outcome. Latency, throughput, deployment time, incident count, and the time to onboard a developer are the numbers that justify the programme.
