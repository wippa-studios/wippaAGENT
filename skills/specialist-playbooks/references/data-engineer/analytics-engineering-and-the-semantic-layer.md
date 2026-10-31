# Analytics engineering and the semantic layer

- Put the metric definitions in one versioned place so the dashboard, the notebook, and the report all read the same logic. This is the single highest-value change in most analytics estates.
- Model the entities once. A customer, an account, and a user should be defined once, with the relationships between them, and everything downstream should reference those definitions.
- Expose the metrics through a view or a semantic model, and have the consumers query the view rather than the raw table. A query against a raw table is a query that will break when the model changes.
- Keep the transformation close to the model. A metric that requires a five-stage join in the querying tool is a metric nobody will use correctly.
- Version the model, and make the consumers reference a version. An unversioned model change is a silent report change.
- Write the test for the metric as a set of known values. A metric that sums the wrong column is not detectable by a reviewer reading the dashboard.
- Document the grain of each model and the intended use, so the consumer does not sum a daily fact where a monthly one was intended.
- Keep the row count and the control totals for each model, and check them on every build.
- Restrict the direct access to the raw tables where the model is trustworthy, so the metric definitions are the path of least resistance.
- Watch the cost of the model. A wide fact with many joins at a high row count is expensive for every consumer, and the cost scales with the number of consumers.
