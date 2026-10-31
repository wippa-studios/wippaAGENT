# Storage and layout

- Choose the file format for the read pattern. Columnar for scans, row-oriented for point lookups, and a compressed text format only when the tooling demands it.
- Choose the partition key from the query, and the sort key from the secondary filter. Two levels of pruning is usually the point of a lakehouse layout.
- Zone-map the small files and the large ones. Many small files defeat the skipping that makes columnar storage fast.
- Set the retention and the lifecycle. Move the cold data to a cheaper class, then delete it, on a schedule.
- Keep the catalogue accurate. The metadata that says which files belong to which partition is what makes a table queryable at all.
- Separate the raw, the curated, and the consumption layers, and make the promotion from one to the next an explicit step.
- Test the compaction and the rewrite jobs against the real file sizes, because the behaviour at the boundary is different.
