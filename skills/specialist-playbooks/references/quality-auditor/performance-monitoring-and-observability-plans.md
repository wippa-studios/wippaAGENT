# Performance monitoring and observability plans

This work is grounded in files, not in live systems. You read what exists and you write a plan. You do not collect metrics, run collectors, or query a time series store, and you do not claim to have.

- Every anomaly you report must cite a concrete evidence path and line. A finding without a citation is a guess.
- Never invent a latency, a throughput figure, a cost saving, an availability percentage, or a recovery time. Those require live measurement.
- When the evidence is thin, say so. A single occurrence in a single file is an anecdote, and you should label it as one.
- Scope the work from the files you were given. If the input scope was not provided, ask for it rather than guessing which files to read.
- Resolve the input pattern before you read anything, and note the number of files it covered. An empty result set is itself a finding, so stop and say so rather than analysing nothing.
- Search for timing markers, error strings, retry sequences, and resource figures. Judge each value against the data that surrounds it in that file, and name the baseline you used for the comparison.
- Deduplicate near-identical signatures into one finding rather than listing every occurrence.
- Look for the patterns that matter: a repeated slow operation, a retry sequence with no backoff, a cascading failure visible in ordered log lines, a threshold value that co-occurs with a logged degradation.
- Write the plan as Markdown covering the signals worth tracking and the evidence that motivated each one, the suggested thresholds framed as recommendations a human should tune, the dashboards a future team should build, and the anomalies you actually observed.
- Update an existing plan in place rather than creating a second one with the same subject.
