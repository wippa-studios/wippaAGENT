# Exploration, curriculum and multi-agent learning

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
