# Testing data pipelines

- Test the transformation as a function over a small fixture, with the expected output written by hand. A golden-file test catches a change in the output that a row-count assertion misses.
- Test the boundary conditions of the source: an empty batch, a record with every optional field null, a record with a value at the limit, and a record that arrives twice.
- Test the failure paths. When the source returns a partial page, when the schema changes mid-extract, and when a downstream table is missing, the pipeline should fail cleanly with a diagnostic rather than a partial load.
- Assert the invariants rather than the shape. The row count, the uniqueness of the key, the null rate in the required column, and the total of a control column are better assertions than a schema snapshot.
- Use a small, realistic fixture. A fixture with three rows and four unusual cases will find more bugs than a fixture with a million generated rows.
- Test the idempotency explicitly by running the load twice and asserting the result is the same.
- Test the increment logic against a source that updated a row instead of appending. This is the case that breaks most incremental loads.
- Test the quarantine path. A row that should be rejected must be rejected and counted, not silently dropped and not silently accepted.
- Keep the tests fast enough to run on every change. A pipeline test suite that takes an hour runs nightly, and nightly tests do not prevent anything.
