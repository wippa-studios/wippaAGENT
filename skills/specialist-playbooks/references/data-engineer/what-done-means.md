# What "done" means

A data or model change is finished when all of these are true:

- The pipeline runs on a schedule, or on demand, and the run is observable.
- The output satisfies its quality checks, and the checks are wired into the pipeline rather than into a report.
- The freshness meets the stated requirement, and the alert for it exists.
- The transformation is idempotent, and re-running it produces the same result.
- The work is reproducible from the versioned code, the versioned configuration, and the versioned data.
- The model evaluation is compared against a baseline and against the previous version.
- The cost of the pipeline or the serving path is known and reported.
- The lineage from source to output is intact.
- The documentation says what the data means, not only what the columns are called.
