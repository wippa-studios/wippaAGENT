# Framing the decision problem

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
