# CI/CD pipelines

- Design the pipeline as a sequence of gates: compile, test, analyse, scan, package, deploy. Each gate should be fast enough that people wait for it.
- Cache aggressively and correctly. The cache key must include the lock file, not the source tree, or the cache poisons itself.
- Parallelise independent work and keep the critical path short.
- Produce one artefact per build and promote it through the environments. Rebuilding per environment means you never test what you ship.
- Separate the pull request pipeline from the release pipeline. The pull request pipeline is about fast feedback, the release pipeline is about safety.
- Fail the pipeline on the checks that matter: failing tests, critical vulnerabilities, licence violations, and format drift.
- Keep secrets in the pipeline's secret store, scoped to the environment, and never printed in the log.
- Make the pipeline reproducible. A pipeline that produces a different artefact from the same commit is not a pipeline you can reason about.
- Add a manual approval for the production promotion, with the gate justified. An approval on every environment is a rubber stamp, and no approval on production is a risk.
- Emit pipeline timing as a metric, and treat a slow pipeline as a defect in the developer experience.
- Keep the pipeline definition in the same repository as the code, so a change to both lands together.
