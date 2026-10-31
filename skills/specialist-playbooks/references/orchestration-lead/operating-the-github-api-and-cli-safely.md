# Operating the github API and CLI safely

**What to do**

- Authenticate with a fine-grained token scoped to the specific repository and the specific permissions the task needs. The broad personal access token is the fallback, not the default, and the token lives in an environment variable or a secret store rather than in a command line that lands in the shell history.

- Where a repository publishes a model context protocol server, expose the operations the task needs as tools over that server rather than as ad-hoc scripts, so that the orchestration is callable by the agents that need it.
- Use the github CLI where it exists, because it handles pagination, output formatting and authentication for you, and fall back to the API for what it does not cover.
- Paginate every list endpoint. The default page is thirty items, and a report built from the first page of a list is a truncated report that does not say it is truncated.
- Respect the rate limit headers and back off before the limit is hit rather than after.
- Use the GraphQL API when a task needs many related objects in one round trip, and the REST API for everything else, because the GraphQL query cost is not free.
- Verify write operations by reading back the created object. A create that returned a success status is not the same as an object that exists in the desired state.
- Redact tokens, cookies and authorisation headers from any output that will be shared, including failed test output and debug logs.

**What to watch for**

- Unauthenticated calls in a loop, which will exhaust the hourly limit part way through and produce a partial result that looks complete.
- The secondary rate limit for abusive request patterns, which is separate from the primary hourly limit and can return a success-looking response.
- A token with write scope used for a read task, because the credential now does more than it needs to.
- The difference between a search index that lags and the live data. A search result that misses a recent issue is a timing artefact, not evidence the issue does not exist.

**How to verify**

- The token used is scoped to the minimum permissions the operation requires.
- Every list response was paginated to completion, and the total item count is reported.
- Each write is confirmed by reading the object back and comparing the fields that matter.
- No credential material appears in any output, log or command echo.

**Bulk and repeated operations**

- When the same write has to be applied to many objects, dry-run it against a small subset and read the output before touching the rest. A bulk operation with a wrong filter is the fastest way to damage a lot of things at once.
- Write the selection into the command so it is visible in the log and in the review, rather than letting the tool pick implicitly.
- Handle partial failure. When a bulk run stops halfway the repository is in a mixed state, and the tool summary will not describe it, so reconcile the actual state before retrying.
- Rate-limit the bulk run yourself if the endpoint allows it, because a hundred sequential writes will trip the secondary limit before the primary one.
- Keep the identifier of every object you touched, so the operation can be reversed or audited without re-deriving the selection.
