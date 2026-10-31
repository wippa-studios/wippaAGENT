# Deploying and monitoring the policy

**What to do**

- Export the policy to the smallest inference representation that preserves its behaviour, and measure the accuracy loss from the export. A policy that is three percent worse after export is a different policy.
- Measure inference latency and memory on the deployment target, not on the training machine.
- Put the policy behind a fallback from the first deployment, with a switch that does not require a new release to flip.
- Shadow the new policy against the current one before it takes decisions, and compare their outputs on live traffic rather than on replayed data.
- Monitor the live distribution against the training distribution, and alert on the drift, not only on the outcome metric.
- Keep an action-level audit log for decisions that matter, so a specific decision can be reconstructed and explained later.
- Watch for the failure the simulator could not show: a state the policy has never seen, and the confidence or novelty signal that would reveal it.
- Run the policy in a degraded mode when its input is missing or malformed, and make that behaviour explicit rather than incidental.
- Roll out gradually, with the criteria for advancing written in advance.

**What to watch for**

- A deployment where the input pipeline differs from the training pipeline in a way that changes the observation scale.
- A policy that is never invalidated, so it runs for years against a world that has changed underneath it.
- Silent degradation. The outcome metric moves slowly, so a per-decision monitor matters more than the aggregate.
- A confidence score that is not calibrated, which makes the fallback trigger at the wrong time.

**How to verify**

- The export is compared against the training policy on a held-out set, and the difference is reported.
- The shadow comparison is run over a stated volume of live traffic, and the agreement rate is recorded.
- The drift monitor is demonstrated to fire on a deliberately shifted input.

**Monitoring in production**

- Track the inputs as well as the outputs. A distribution shift shows up in the observations before it shows up in the reward, and by the time the reward moves the damage is done.
- Keep the fallback and the current policy in the same deployment so that switching is a configuration change rather than a release.
- Log enough per decision to reconstruct it: the observation, the chosen action, the constraint status, and the fallback flag.
- Alert on the rate of fallback activation rather than only on the quality metric, because the fallback rate is an early warning that the policy is out of its depth.
- Plan the retraining cadence from the drift you observe rather than from a calendar, and keep the previous policy until the new one has run long enough to be judged.
- The fallback path is exercised and confirmed to produce the intended behaviour.

**Deciding when to stop iterating**

- Fix the stopping rule before the last experiment, not after it. A team that keeps iterating until the number improves will always find a configuration that looks better and is not.
- Write the decision into the protocol: the target score, the number of seeds that must reach it, the minimum gap over the baseline, and the conditions that would disqualify the result.
- Reserve a final evaluation that is run once, after the choice is made, on seeds that were not used during the sweep. That is the only number that is not contaminated by the search.
- Report the reserved evaluation separately from the sweep table, and do not fold it back into the comparison.

**The sweep report**

- Lead with the protocol. The reader needs to know what was measured, over how many episodes, with which seeds, before they can read any number.
- Present one row per configuration, with the mean, the spread, the seed count, and the wall-clock cost of that configuration. The cost column matters, because a configuration that is marginally better and five times more expensive is a different decision.
- Include the failed runs in the same table, with their reason, so that the table matches the plan.
- Show the baseline row and the protocol version, and put the reserved evaluation in a separate section with its own note that it was run once.
- State the limitations of the sweep in the report itself: the axes not explored, the budget that was not spent, and the conditions under which the winner might not hold.
