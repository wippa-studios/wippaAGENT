# Reading the results and choosing what ships

**What to do**

- Compare against the baseline defined in the protocol. An improvement against nothing is not an improvement.
- Read the seed spread before the mean. A large spread means the configuration is unstable, and the mean of an unstable configuration is not a performance claim.
- Use a statistical comparison across seeds rather than eyeballing the difference, and report the test used.
- Run an ablation to find what is actually carrying the result. If the new architecture is only useful with the new reward, the architecture is not the contribution.
- Test the sensitivity to the key hyperparameters. A configuration that only works at one setting is a configuration that will not survive a shift in the environment.
- Check generalisation explicitly: across seeds, across environment instances, across out-of-distribution conditions, and against a human or scripted baseline.
- Look for failure modes deliberately. Collect the trajectories where the policy did badly and read them, because the aggregate metric hides the mechanism.
- Check the adversarial case. A policy that has learned to exploit a scoring function will find a way that a random search would not.
- Compare against the human baseline and against the trivial heuristic, because beating a random policy is a low bar.

**What to watch for**

- Selecting the best configuration on the evaluation set, which is itself a form of overfitting.
- Comparing against a baseline that was tuned harder than the candidate.
- Treating a small improvement as meaningful without a practical significance threshold agreed in advance.
- A conclusion drawn from one environment seed.

**How to verify**

- The comparison table contains the baseline, the confidence interval and the seed count for each configuration.
- The ablation removes one component at a time and reports the effect of each.
- The out-of-distribution evaluation is reported with the conditions stated.
- The failure trajectories are collected and summarised, and at least one mechanism is described.

**Reading the training curve**

- The shape of the learning curve carries most of the diagnosis. A curve that never rises points at the environment, the reward or the exploration. A curve that rises and then falls points at instability or at an overfitting policy. A curve that oscillates points at the learning rate or the target network.
- Plot the reward components separately. A rising total with a flat task component and a rising novelty component is a policy that learned to be curious.
- Compare the curve against the baseline band, not against zero. Many curves that look flat are simply at the level of the random policy.
- Look at the seed spread as a band rather than as separate lines, and check that the band is narrow at the point where you intend to stop training.
