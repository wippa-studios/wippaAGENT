# Choosing and implementing the algorithm

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
