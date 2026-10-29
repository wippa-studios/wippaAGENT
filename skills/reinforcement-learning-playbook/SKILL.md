---
name: Reinforcement Learning Playbook
description: Reinforcement-learning playbooks for the data-engineer subagent: framing a sequential decision problem, environment and reward design, algorithm selection and policy optimisation, training infrastructure, exploration and multi-agent learning, transfer and safety, sweep protocol and run reporting, reading results, and deploying and monitoring a policy. Use this skill when a brief involves RL, policy training, reward design, an experiment sweep across model or algorithm setups, or judging which algorithm fits a data budget and action space.
---

# Reinforcement Learning Playbook

This skill carries the reinforcement-learning playbooks that used to sit in the `data-engineer` agent definition, so they load when the task is reinforcement-learning work instead of in every data-engineer prompt. The `data-engineer` file keeps RL in its *What you cover* list for routing; load this skill before you start when the brief is RL work, and treat its sections as the how-to for that work.

## Playbooks

### Framing the decision problem

**What to do**

- Establish that the task is genuinely sequential. If the right action depends only on the current observation and not on what happened before, there is no sequential decision to make, and a supervised predictor will be simpler, cheaper and more accurate than a policy.
- Write the Markov decision process down. Define the state the agent observes, the actions it may take, the transition dynamics, the reward, the termination conditions and the discount.
- Decide what the agent is allowed to see. A partially observed problem needs memory, an observation history, or a recurrent policy, and choosing the observation set is often where the whole difficulty lives.
- Define the success criterion in the business terms the request came in, and then define the reward that is a proxy for it. Keep the two descriptions adjacent, because the gap between them is where the agent will find a shortcut.
- State the horizon and the budget. A twenty-step episode and a ten-thousand-step episode are different problems, and the sample cost differs by orders of magnitude.
- Decide what a good policy must never do, and write that as a constraint rather than as a reward penalty. A penalty is traded off against the objective; a constraint is not.
- Check whether the environment can be reset reliably and whether it can be stepped deterministically, because both properties are needed for a controlled experiment.

**What to watch for**

- A reward that measures the activity rather than the outcome. An agent asked to maximise clicks will find a way to click without the user benefiting.
- A state that leaks the future, which makes the task artificially easy and produces a policy that cannot be deployed.
- An action space that omits the option to do nothing, which forces the agent to act when waiting would be correct.
- Termination conditions that reset the agent before the consequence of an action has fully played out, so the agent never learns the tail.
- A success criterion measured on the training environment rather than on the distribution the policy will face.

**How to verify**

- The formulation is written out in full, and each element can be traced to a requirement.
- A random policy and a trivial heuristic are both evaluated in the environment, and their scores are recorded as the baseline band.

**Establishing the baseline first**

- Evaluate the environment with a random policy, a trivial heuristic, and a scripted expert where one can be written. The gap between the heuristic and the expert is the room the learner has to work in.
- Record the baseline under the same evaluation protocol as everything else, so that every later comparison uses the same measurement.
- Note how long the scripted expert takes and how much it gets wrong. An expert that is itself weak tells you the environment is the problem, not the algorithm.
- The observation set is checked for anything that would not be available at deployment time.
- The action set contains a no-op and the termination conditions do not cut off the consequence of an action.

**Deciding what to optimise**

- Write down the primary objective as a single sentence and everything else as a constraint or a secondary metric. Two primary objectives in one policy is a specification that will be resolved silently by the training run.
- Prefer a constraint for anything that must never happen, and a reward term for anything that should happen more often. Mixing the two makes the trade-off implicit and unmeasurable.
- Decide how conflicting objectives are resolved and record it. A weighted sum, a constrained formulation, and a lexicographic order each produce a different policy, and the choice belongs to the requester rather than to the training script.

### Designing the environment and the reward

**What to do**

- Make the environment implement the standard interface so that the algorithm libraries can use it directly, and keep the observation and action spaces declared rather than implied.

**The ecosystem**

- Environment interface: the Gymnasium project from the Farama foundation, which is the interface every algorithm library expects.
- Algorithm libraries: Stable-Baselines3 for the conventional set, RLlib on Ray for the distributed and multi-agent cases, CleanRL for the single-file reference implementations, TorchRL for the composable data and module design, and the JAX-based line where the training loop has to be inside a compiled graph.
- Simulation environments: Unity ML-Agents for the game-shaped cases and the Isaac simulator for the high-fidelity physics cases.
- Keep the environment deterministic given a seed, and set the seed inside the environment so that a run is reproducible regardless of the order the code runs in.
- Design the reward as a sum of terms you can name, each with a stated weight, and keep a breakdown of the reward components in the logs so that a change in behaviour can be attributed.
- Shape a sparse reward with intermediate signals that point in the direction of the goal rather than merely reporting progress, because progress-shaped rewards can be satisfied without reaching the goal.
- Use intrinsic motivation to drive exploration, but cap it, because an agent that is rewarded for novelty will find novelty rather than the task.
- Use hindsight relabelling when the goal is conditional, so that a failed attempt still produces a usable transition instead of a discarded one.
- Normalise the reward when its scale varies, and use a running estimate rather than a fixed divisor.
- Handle multiple objectives explicitly. If the reward is a weighted sum, the weights are a policy decision and must be written down; if it is not a weighted sum, say how the trade-off is made.
- Generate variation procedurally, and vary the parameters that a deployed environment will actually vary, so the policy is not trained on one fixed instance.
- Make the environment fast and parallel. A vectorised environment that runs many copies in one process is the single biggest practical lever on iteration speed.

**What to watch for**

- Reward hacking. If a cheaper path to the reward exists, the agent will find it, and the fix is in the reward and the constraints rather than in the training run.
- A shaped reward whose optimum differs from the task's optimum.
- An environment that leaks state between resets.
- A reward computed from a source that the agent can influence, such as a score derived from its own output.
- Procedural generation with a distribution that does not match deployment.

**How to verify**

- The reward breakdown is logged per step and per episode, and the components are individually inspected after training.
- The environment passes a reset and step determinism test under a fixed seed.
- The random-policy score is recorded, and any learned policy is compared against it.
- A pass is made over a set of environment variations, and the score distribution is reported rather than the best instance.

**Building a fast environment**

- Profile before optimising. The usual culprits are the physics step, the rendering path that runs when it does not need to, and an environment that does work in the observation pipeline that could be done once per episode.
- Separate rendering from simulation so that the headless training loop does no drawing.
- Do the work once per episode that can be done once per episode. Per-step recalculation of a static quantity is the most common avoidable cost.
- Keep the step function free of anything that is not the physics or the rule logic, because it runs millions of times.
- Measure the frames per second after each change, and keep the numbers, so that a sweep budget can be planned from measurement rather than from hope.

### Choosing and implementing the algorithm

**What to do**

- Choose by the shape of the problem, not by popularity. Value-based methods suit discrete actions and large replayable datasets. Actor-critic methods suit continuous actions. Policy gradient methods with a trust region suit long horizons and unstable objectives. Model-based methods suit environments that can be learned quickly. Offline methods suit the situation where the only data is a fixed dataset.

**The algorithm shelf**

- Value-based: DQN, with the double and duelling variants for the overestimation and the state representation problems.
- Actor-critic: advantage actor-critic (A2C) and its asynchronous variant, soft actor-critic (SAC) for continuous control with the entropy term built in, and twin delayed DDPG (TD3) for the same domain with a lower sample cost.
- Policy gradient: REINFORCE and its practical descendants, and proximal policy optimisation with the clipped objective and the trust region that keeps the update from moving too far in one step.
- Model-based: Dreamer for a learned latent dynamics model, and MuZero for the case where the model is learned without a simulator.
- Offline: conservative Q-learning (CQL) and implicit Q-learning (IQL) for the fixed-dataset case, where the conservatism term is doing the work.
- Prefer the simplest method that can plausibly solve the problem, and treat a modern algorithm as the baseline to beat rather than as the starting point.
- Implement the simplest version of the algorithm first, in a single file with no abstraction layers, so that the details are visible and the bug is findable. The single-file implementations are a good reference because they show every hyperparameter and every update rule.
- Use the well-supported library implementations for the algorithm itself, and put your effort into the environment, the reward and the evaluation, which is where the domain knowledge lives.
- Set the algorithm's own guardrails: gradient clipping, entropy regularisation, a learning rate schedule, and a target update rate for the offline variants.
- Tune the small set of hyperparameters that actually matter for the chosen method, and tune them under the sweep protocol below rather than one at a time.
- Use a recurrent policy or a stacked observation history when the environment is partially observed.

**Offline and constrained data**

- Use an offline method when the only available data is a fixed dataset, and understand what that dataset contains. An offline method learns from the actions that were taken, so it cannot discover an action nobody took.
- Apply an explicit conservatism constraint to keep the learned policy close to the data distribution, and choose the strength of that constraint deliberately rather than by default.
- Check the dataset for the actions the deployment policy would need. A dataset collected by one incumbent policy teaches you that policy's world, including its mistakes.
- Where the policy will eventually act online, plan the handover. An offline-trained policy that is never exposed to live data drifts away from the conditions it was trained on.
- Evaluate an offline method with the same care as an online one, including the seed spread, because the offline evaluation is itself subject to selection effects.

**What to watch for**

- A method mismatch that shows up as slow learning rather than as failure. Some algorithm and environment pairings simply need far more samples than the budget allows.
- Off-policy reuse of stale data without correction, which shows up as a policy that oscillates rather than improves.
- A replay buffer that dominates memory, and a buffer sized so that the retained data no longer covers the distribution the policy is currently visiting.
- An entropy coefficient that decays too fast, collapsing exploration before the task is solved.
- A target network that is updated every step in a way the algorithm does not intend.

**How to verify**

- The implementation is checked against a known reference behaviour on a small deterministic environment, so that a bug in the update rule shows up as a numerical mismatch rather than as slow learning.
- The learning curve is plotted and its shape is compared against the expected shape for the method.
- The algorithm choice is justified in writing against the problem formulation.

**Hyperparameters that actually matter**

- Start from the reference configuration for the algorithm in the library you are using, and change one group of hyperparameters at a time. Starting from a configuration you found in a forum post is starting from an unmeasured baseline.
- For the policy gradient family, the learning rate, the number of epochs per batch, the discount factor and the entropy coefficient are the ones that usually decide whether learning happens at all.
- For the value-based family, the target update frequency, the replay buffer size and the exploration schedule carry most of the effect.
- Log the gradient norm and the policy entropy during training. A gradient norm that spikes or an entropy that collapses early usually explains a training failure that the reward curve alone cannot.
- Use the sweep protocol for the tuning, and report the whole sweep rather than the winning cell.

### Training infrastructure and reproducibility

**What to do**

- Set every seed explicitly, in the environment, in the algorithm, in the data loader and in the framework's global seed function, and record them in the run metadata.

**The tracking layer**

- Run tracking: a hosted experiment tracker and a local tensor board, with the configuration attached to every run so the sweep table is generated from the recorded data rather than assembled by hand.
- Record the full run configuration with each run: the algorithm and its hyperparameters, the environment configuration, the code revision, the data version, the seed set, and the hardware.
- Use vectorised environments and parallel rollout collection to raise the frames per second, and measure the throughput so you know what a sweep will cost before you launch it.

**Choosing the framework**

- Use the established libraries for the algorithm and the environment interface, and write your own code for the domain logic. The algorithm is solved; the domain is not.
- The single-file reference implementations are the fastest way to understand an algorithm, because every update rule and every hyperparameter is visible in one place. Use them to check a library's behaviour, and use the library for production runs.
- Pick the framework for the environment, not for the algorithm. A simulator-heavy project and a text-game project want different tools, and the algorithm library is largely interchangeable.
- Check the version of the library and of the environment interface package against what the code assumes, because the observation and action space handling has changed across releases.
- Use distributed training only when the single-process version is the bottleneck, because distributed training adds failure modes that are hard to diagnose.
- Checkpoint on a schedule, keep the optimizer state with the weights, and make the checkpoint sufficient to resume the run exactly.
- Track every run in an experiment tracker with the configuration attached, so that the sweep table can be generated from the recorded data rather than reconstructed from memory.
- Keep a fixed evaluation protocol separate from the training loop, and run it at checkpoints so that learning curves and final comparisons use the same measurement.
- Make the training loop resumable and idempotent, so that a crashed sweep can be restarted without losing the completed runs.

**What to watch for**

- A run that cannot be reproduced because the seed was set in one place and overridden in another.
- A sweep that gets killed by a time limit and loses the runs that had not been logged.
- Silent non-determinism from a library that does not expose a seed, which makes a variance estimate meaningless.
- Logging that captures the loss but not the environment configuration, so the sweep table cannot explain the spread.
- Distributed workers writing to the same output directory.

**How to verify**

- Two runs with the same seed produce the same curve, and a run with a different seed produces a different one.
- The recorded configuration is sufficient for someone else to reproduce the run without asking a question.
- The recorded throughput matches the measured throughput on the machine that will run the sweep.

**Making the sweep survive**

- Write the sweep plan to a file, with the configuration list, the seed list, the budget and the protocol version, and treat it as an artifact that is read back before the run starts.
- Log each run as it completes rather than at the end of the sweep, so that a kill leaves a usable partial result.
- Store the raw per-run artifacts, not just the summary numbers, so that a later question can be answered without rerunning anything.
- Version the environment and the training code with the run, and record the revision so that the sweep table can be tied to a specific state of the repository.
- Tag the sweep with the question it is answering, so that a later reader knows what was being tested rather than only what was run.

### Exploration, curriculum and multi-agent learning

**What to do**

- Match the exploration method to the structure of the space. Epsilon-greedy and Boltzmann sampling cover simple stochastic policies. Noise injection covers continuous control. Count-based bonuses and random network distillation cover large discrete spaces where the reward is sparse. Upper confidence bounds and Thompson sampling cover bandit-like structures.

**The exploration and credit-assignment set**

- Randomised: epsilon-greedy, Boltzmann sampling, and Ornstein-Uhlenbeck or Gaussian noise on continuous actions.
- Directed: count-based bonuses, random network distillation as the simpler variant of the same idea, upper confidence bounds for the bandit-like parts of the state, and Thompson sampling where the posterior is tractable.
- Exploration at scale: Go-Explore with a goal archive, and intrinsic motivation with the bonus capped so it cannot outweigh the task.
- Credit assignment: hindsight experience replay for the conditional goals, and inverse reinforcement learning where the demonstration is the only signal available.
- Add an entropy term to the objective and decay it over training, so that exploration reduces as the policy sharpens without ever going to zero too early.
- Use a curriculum when the task has a natural order of difficulty. Start from a solvable distribution and shift the sampling toward the target distribution as the policy improves, and keep the shift gradual enough that the policy does not collapse when the distribution moves.
- For multiple agents, decide whether the relationship is cooperative, competitive, or mixed, and pick the training scheme to match. Cooperative work often wants centralised training with decentralised execution, so that the critic sees the joint state while each actor only sees its own observation.
- Use self-play where the skill of the opponent is the benchmark, with the usual safeguards against a policy that exploits a specific opponent rather than the task.
- Use population-based training when the right configuration is unknown, so that the configuration and the policy improve together.
- Define the communication channel explicitly if the agents exchange information, and make sure the message budget is limited, because unconstrained communication lets the agents encode the whole state.

**What to watch for**

- An exploration bonus large enough to dominate the task reward.
- A curriculum that shifts the distribution too quickly, which shows up as a performance collapse that recovers slowly.
- Non-stationarity from self-play, which makes the learning curve noisy in a way that is not a bug.
- An agent count that changes mid-training, which invalidates the replay buffer contents.
- Symmetric agents in an asymmetric task, where one role is never learned.

**How to verify**

- The entropy or exploration magnitude is plotted against the mean return, so the trade-off is visible rather than assumed.
- The curriculum schedule is plotted, and the policy is evaluated on the target distribution as well as the training distribution.
- Multi-agent runs report the per-agent return and the team metric separately.

**Evaluating multi-agent behaviour**

- Report the team metric and the per-agent metric separately. A team score that hides one agent doing nothing is a score that will not survive contact with a real deployment.
- Check for the degenerate solutions: one agent carrying the whole task while the others idle, or the agents learning to occupy the same useful state.
- Measure the communication cost when the agents exchange messages, and confirm that the task is still solvable with the message budget you intend to allow.
- Compare against a baseline where the agents cannot communicate, so that the value of the channel is actually demonstrated.

### Transfer and safety

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

### The sweep protocol

**What to do**

- Fix the evaluation protocol before the sweep starts, and change nothing about it during the sweep. The protocol is the metric definitions, the observation set, the episode configuration, the number of evaluation episodes, the aggregation, the seeds used for evaluation, and the hardware. A protocol that shifts mid-sweep makes every comparison invalid.
- State the hypothesis each configuration is testing, so that the sweep is a set of experiments rather than a grid.
- Choose the axes deliberately: the algorithm family, the key hyperparameters of each family, the reward variants, the environment configuration, the training budget, and the seed set.
- Run multiple seeds per configuration and treat the seed spread as the unit of evidence. A configuration that wins on one seed has not won.
- Record every run, including the runs that crashed, the runs that timed out, the runs that diverged, and the configurations that were never reached because the sweep was interrupted. A sweep table with only the surviving rows is a selection effect.
- Cap the compute budget up front, allocate it across the configurations so that the sweep cannot be monopolised by one branch, and log the budget consumed.
- Use a proper search when the space is large: random or quasi-random search for wide spaces, and a Bayesian or bandit-based method when the search is sequential and the budget is small. A grid search on a continuous space wastes most of its budget.
- Log the full configuration of every run with the metrics, so the comparison table is generated from the recorded data.

**What to watch for**

- Changing the evaluation metric between configurations because an early result looked disappointing.
- Comparing configurations evaluated with different episode counts or different observation sets.
- Reporting the best seed of a configuration as the configuration's result.
- Comparing a configuration that trained for ten times the steps against one that trained for a fraction, without normalising or stating the budget.
- A sweep that is abandoned when a leader emerges, which converts a systematic comparison into a search for a good result.

**How to verify**

- The protocol is written down and dated before the sweep starts, and the version used by each run is recorded in the run metadata.
- Every configuration in the plan has a row in the result table, with the runs that failed shown as failures and not omitted.
- Each configuration is reported as a distribution across seeds with the mean, the spread and the number of seeds.
- The number of runs completed, failed and skipped is reported alongside the results.
- The baseline from the protocol is present in the same table, measured the same way.

### Reading the results and choosing what ships

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

### Deploying and monitoring the policy

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
