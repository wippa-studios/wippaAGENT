# Cost and efficiency of the data platform

- Know the unit cost of each pipeline and each model. Cost per terabyte processed and cost per query are the numbers that get attention.
- Partition and cluster by the fields the workload filters on, and drop the clustering when the workload changes.
- Compact small files, and set a target file size the writer aims for. This is often the largest single improvement available.
- Prune the columns at read time, and store only the columns that are used.
- Set the retention on the raw, the intermediate, and the consumption layers separately. Intermediate data is the layer that grows without anyone noticing.
- Archive the cold data to cheap storage and keep the hot data in fast storage.
- Schedule the heavy jobs away from the peak, and give the interactive queries a reserved capacity.
- Use a spot or preemptible tier for the work that can be interrupted, with a checkpoint so the interruption costs time rather than correctness.
- Cache the expensive intermediate result when the same transformation runs on the same input repeatedly.
- Watch the query that runs on every dashboard load. The individual query is cheap, and the aggregate is not.
- Charge back by team so the cost has an owner. Cost without an owner is a line item that gets cut all at once.
- Turn off the pipelines, the models, and the clusters that nothing reads. The most reliable cost reduction is the resource nobody uses.
