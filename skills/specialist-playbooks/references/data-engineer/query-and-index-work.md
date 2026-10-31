# Query and index work

- Read the plan before changing anything. A query with a good plan and a missing index is a different problem from a query with a bad plan.
- Check the estimated and the actual row counts. A large divergence is the single most useful signal in a plan, and it usually means stale statistics.
- Remove the accidental cross join. A missing join condition produces a row explosion that looks like a slow query.
- Filter early. A predicate that removes most rows before a join changes the plan completely.
- Use the window functions instead of a self-join for running totals, ranks, and period comparisons. The window version is one pass and it is clearer.
- Use a recursive common table expression for a hierarchy, and set a depth guard so a cycle cannot run forever.
- Write the outer join correctly. An outer join with a predicate in the where clause on the outer table silently turns it into an inner join.
- Keep the transaction short. A long transaction blocks vacuum, holds locks, and inflates the version chain.
- Use the appropriate isolation level. Read committed is the default, and anything stronger is a decision with a cost.
- For a large delete, delete in batches with a pause. A single statement that removes millions of rows will hold locks and generate a huge amount of dead tuples.
- Parameterise the query. There is no acceptable reason to build SQL by concatenation, and the plan cache benefits too.
- Use the query plan cache correctly. A literal in the query creates a new plan for every distinct value, which is the classic cause of a plan that suddenly changes.
- Keep the index set small. Every index slows the writes, and the unused ones are pure cost.
