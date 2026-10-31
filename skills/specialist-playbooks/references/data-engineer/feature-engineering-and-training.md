# Feature engineering and training

- Define the target precisely, including the prediction horizon and what happens at the moment of prediction. A label that leaks the future produces a model that cannot be deployed.
- Check for leakage explicitly. A feature computed after the target time, a value available only after the outcome, and a target-derived aggregate are the usual sources.
- Use a time-based split for any forecasting or sequential problem. A random split lets the model train on the future.
- Fit the preprocessing on the training fold only, and apply it to the validation and test folds through a pipeline. Fitting on everything leaks.
- Keep the feature computation in code, versioned and reusable, so the training and the serving path compute the same value. A mismatch here is a silent accuracy collapse in production.
- Record the feature definitions with the model, so a value can be explained later.
- Track the feature store as a first-class component when the same features serve both training and serving.
- Search the hyperparameters with a method that scales: random search as a baseline, and a Bayesian or bandit method when the budget allows.
- Use early stopping and checkpointing so a long run can be stopped without losing it.
- Compare against a trivial baseline. A model that does not beat a constant or a simple rule has not earned its complexity.
- Use cross-validation where the data is independent, and grouped or time-based folds where it is not.
- Report the metric the business uses, and the secondary metrics that reveal how the model fails. An aggregate score hides the failure mode that matters.
- Inspect the errors, not just the score. A confusion matrix and the worst-predicted examples tell you what to fix.
- Check the performance across segments, not only in aggregate. A model that is excellent overall and broken for one group is not deployable.
- Keep the training reproducible: pinned data version, pinned code, pinned random seed, and a recorded environment.

**Reinforcement learning** — framing a decision problem, environment and reward design, algorithm selection, training infrastructure, exploration and multi-agent learning, transfer and safety, the sweep protocol, reading results, and deploying and monitoring a policy all live in the skill `reinforcement-learning-playbooks`. Load it before you start when the brief is reinforcement-learning work.
