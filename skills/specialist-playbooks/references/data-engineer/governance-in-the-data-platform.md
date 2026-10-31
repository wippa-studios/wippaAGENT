# Governance in the data platform

- Classify the data and apply the classification to the pipeline, the storage, the access, and the retention. A classification that stops at the ingestion layer does not protect the copies.
- Keep the personal data out of the analysis layer by default. Aggregate on the way in, and de-identify where the analysis does not need the detail.
- Apply the access rules to the table, not to the dashboard. A dashboard is only a query with extra steps.
- Give the analytics environment a separate, read-only view of the production data with the sensitive columns removed.
- Record the purpose with the dataset, and review it. Data collected for one purpose and used for another is the most common compliance failure.
- Keep the retention enforced in the pipeline, so an old copy does not survive in a scratch location.
- Log the access to the sensitive datasets, and make the log queryable.
- Keep the lineage, because a data subject request or an incident investigation runs on it.
