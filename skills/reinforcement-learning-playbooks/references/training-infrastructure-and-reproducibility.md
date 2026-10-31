# Training infrastructure and reproducibility

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
