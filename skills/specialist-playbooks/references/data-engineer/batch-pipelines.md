# Batch pipelines

- Decide the extraction strategy per source. A full snapshot is simplest and does not scale. An incremental extract needs a watermark that cannot silently skip a record.
- Put the watermark logic where it can be tested, and test it against a source that changed the same row twice. Incremental extraction that assumes rows are append-only is wrong the first time a record is updated.
- Land the raw data first, unchanged, with the source metadata and the ingestion timestamp. The landing zone is what you replay from when a transformation is wrong.
- Make the load idempotent. A rerun of the same partition should produce the same table, not a duplicate.
- Transform in a way that can be re-run for a date range without a full backfill.
- Handle the schema drift that the source will eventually introduce. Parse it, quarantine the unparseable, and keep the pipeline running.
- Partition the data so a rerun of one day does not mean a rerun of everything.
- Use a columnar format with compression. Parquet or an equivalent is the default for analytical storage, and the choice of encoding matters more than most people expect.
- Keep the compute near the data. Reading across a region boundary is the most common cause of a slow pipeline.
- Partition by the field that filters the workload. A partition key nobody filters on is a partition key that only adds files.
- Compact small files. A directory of thousands of tiny files will slow every read that follows.
- Check the data types on write. A timestamp stored as a string will eventually be compared as a string.
- Validate at every stage. A schema check, a row-count check, a null-rate check, and a range check, each with a threshold and an action.
