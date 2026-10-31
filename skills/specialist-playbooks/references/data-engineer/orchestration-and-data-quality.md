# Orchestration and data quality

- Use a scheduler that models dependencies, retries, and backfills as first-class operations. A cron chain cannot express "re-run everything downstream of yesterday's failure".
- Make every task idempotent, because the scheduler will run it again.
- Wire the data dependencies explicitly, and make the DAG visible. A hidden dependency is a pipeline that will one day run in the wrong order.
- Set a freshness expectation per output and a freshness alert per output.
- Put the quality checks in the pipeline, not in a report. A schema check that fails the load stops the bad data at the boundary.
- Choose the action for each check: fail the task, quarantine the rows, or warn. Quarantine with a count is usually right for a source that occasionally sends a bad record.
- Track the lineage from the task to the source so an impact analysis takes minutes rather than a week.
- Support a backfill for every task, and test it. Backfills are how you fix a bad load, and they are almost never exercised.
- Make the run observable: duration, records in, records out, rows quarantined, and the cost of the run.
