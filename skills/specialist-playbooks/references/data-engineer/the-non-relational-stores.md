# The non-relational stores

- Choose the store from the access pattern, not from the data shape. A key-value store is for point lookups by a known key, and every extra capability you ask of it costs you the guarantee it was designed to give.
- For a document store, design the embedding around the query. A document that is read as a whole and a document that is read field by field want different structures.
- For a document store, index the fields you filter and sort on, and understand that an unindexed field means a collection scan.
- For a wide-column store, partition on the key that spreads the data and the key that co-locates the rows you read together. Those are often different keys, and the model has to say so.
- For a graph store, model the edge with the direction and the cardinality the query needs, and index the edge by the source.
- For a time-series store, set the retention and the compaction, and choose the aggregation and the downsample rules. A time-series store without a retention policy is an expensive log file.
- For a search engine, decide what is the source of truth. The index is a copy, and the copy can be rebuilt only if the pipeline that builds it is deterministic.
- For a cache, remember the three questions: what is the key, when does it expire, and what happens on a miss. A cache with no miss behaviour is a hard dependency with extra latency.
- Do not use a cache as the only copy of anything. The moment it is the only copy, eviction becomes data loss.
