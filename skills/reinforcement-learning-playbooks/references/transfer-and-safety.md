# Transfer and safety

**What to do**

- Narrow the reality gap deliberately. Randomise the parameters that differ between the simulation and the target, such as mass, friction, sensor noise, latency and lighting, and randomise them over a range wider than you expect to see.
- Identify the real system before you transfer. If you do not know the true parameters, learn them, and treat the identified model as an object with its own uncertainty.
- Use progressive networks or a policy ensemble when the target distribution is unknown at the start, so that the policy can specialise as the target becomes clear.
- Validate the calibration, not only the performance. A policy that scores well on average but is miscalibrated in the tail is dangerous.
- Constrain the action space where the action can be harmful, with hard bounds that the policy cannot exceed, rather than with a penalty that it can trade off.
- Design the safe exploration. A policy that is allowed to fail cheaply during training and is not allowed to fail expensively in production is a policy you can actually deploy.
- Provide a fallback. A rule-based controller, a previous version of the policy, or a stop behaviour should be reachable when the learned policy is out of its confidence range.
- Transfer the learned behaviour into the safety envelope. Verify the constraint holds in the target, not only in the simulation.

**What to watch for**

- A domain randomisation range that is too narrow, so the policy overfits to a narrow band of the target.
- A constraint enforced in the simulator and not in the target.
- A safety mechanism that only triggers on an exact input pattern the deployed policy never produces.
- Reward hacking that looks like good performance on the aggregate metric.

**How to verify**

- The randomised parameter ranges are listed, and the evaluation is performed over the full range including the tails.
- The constraint is checked on the target system, with the violation count reported.

**Inspecting what the policy learned**

- Look at the policy, not only at its score. Plot the action distribution per state, watch how it responds to each observation dimension, and check that the behaviour is the behaviour you intended.
- Check whether the policy is relying on a feature it should not have. A policy that reads a timestamp and behaves differently at particular clock values has usually found a leak in the observation pipeline.
- Compare the behaviour on the training distribution with the behaviour out of it. A policy that looks sensible in-distribution and erratic out-of-distribution has learned an interpolation rather than a rule.
- Record the reasoning behind each behaviour change, so that a later reader can tell the difference between a deliberate constraint and an artefact that happened to help.
- The fallback is exercised deliberately by feeding the policy out-of-range observations, and the fallback is confirmed to take over.
- An out-of-distribution evaluation set is run and the behaviour on it is characterised.
