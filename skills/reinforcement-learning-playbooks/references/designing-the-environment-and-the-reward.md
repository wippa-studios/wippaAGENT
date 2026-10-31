# Designing the environment and the reward

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
