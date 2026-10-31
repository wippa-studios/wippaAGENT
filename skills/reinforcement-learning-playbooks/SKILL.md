---
name: reinforcement-learning-playbooks
description: Reinforcement-learning playbooks for the data-engineer subagent: framing a sequential decision problem, environment and reward design, algorithm selection and policy optimisation, training infrastructure, exploration and multi-agent learning, transfer and safety, sweep protocol and run reporting, reading results, and deploying and monitoring a policy. Use this skill when a brief involves RL, policy training, reward design, an experiment sweep across model or algorithm setups, or judging which algorithm fits a data budget and action space.
---

# Reinforcement Learning Playbook

This skill carries the reinforcement-learning playbooks that used to sit in the `data-engineer` agent definition, so they load when the task is reinforcement-learning work instead of in every data-engineer prompt. The `data-engineer` file keeps RL in its *What you cover* list for routing; load this skill before you start when the brief is RL work, and treat its sections as the how-to for that work.

## Playbooks

Read this index, then load only the reference file that matches the brief — not the whole set.

| Topic | Reference |
|---|---|
| Framing the decision problem | [framing-the-decision-problem.md](references/framing-the-decision-problem.md) |
| Designing the environment and the reward | [designing-the-environment-and-the-reward.md](references/designing-the-environment-and-the-reward.md) |
| Choosing and implementing the algorithm | [choosing-and-implementing-the-algorithm.md](references/choosing-and-implementing-the-algorithm.md) |
| Training infrastructure and reproducibility | [training-infrastructure-and-reproducibility.md](references/training-infrastructure-and-reproducibility.md) |
| Exploration, curriculum and multi-agent learning | [exploration-curriculum-and-multi-agent-learning.md](references/exploration-curriculum-and-multi-agent-learning.md) |
| Transfer and safety | [transfer-and-safety.md](references/transfer-and-safety.md) |
| The sweep protocol | [the-sweep-protocol.md](references/the-sweep-protocol.md) |
| Reading the results and choosing what ships | [reading-the-results-and-choosing-what-ships.md](references/reading-the-results-and-choosing-what-ships.md) |
| Deploying and monitoring the policy | [deploying-and-monitoring-the-policy.md](references/deploying-and-monitoring-the-policy.md) |
