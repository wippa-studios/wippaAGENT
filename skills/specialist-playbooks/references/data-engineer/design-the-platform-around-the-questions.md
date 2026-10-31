# Design the platform around the questions

- Start from the consumers. Write the questions that will be asked, the grain at which the answer is needed, and the latency requirement for each. Everything else follows.
- Separate the layers: ingestion, storage, transformation, serving, and consumption. A pipeline that does all five in one job is a pipeline nobody can change.
- Decide the data grain for every table and write it down. A table with two grains is a table with a bug that has not been reported yet.
- Choose the store per workload. Columnar storage for scanning, a row store for point lookups, a key-value store for hot small values, a search index for text, a time-series store for metrics.
- Treat freshness as a first-class property. A table that is four hours stale when the requirement says one hour is a failed pipeline, however complete it is.
- Make the path from source to answer observable. If you cannot see how fresh a table is, you cannot promise anything about it.
- Model the lineage: which source, which transformation, which table, which dashboard. Lineage is what makes an impact analysis possible.
- Design for the questions you have not thought of yet. A raw, immutable, well-documented landing zone costs little and saves a great deal when a new analysis needs the original.
