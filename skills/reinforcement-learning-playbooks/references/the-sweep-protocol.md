# The sweep protocol

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
