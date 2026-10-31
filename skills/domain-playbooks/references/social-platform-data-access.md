# Social platform data access

**What to do**

- Choose the provider before you write the client, and make the choice explicit in the design. The official API is the default. A documented alternative with REST, OpenAPI and webhook support is a legitimate choice when the official one does not meet the coverage or cost requirement, and it should be an opt-in configuration rather than a silent substitution.

**The working stack**

- Authentication: OAuth 2.0 with the authorisation code flow and proof key exchange for a user-authorised integration, and bearer tokens for application-only access. Keep the application context and the user context apart, because they carry different scopes and different rate budgets.
- Query surface: the post search and lookup endpoints, the user lookup, the timeline and mention reads, the trend endpoints, and the engagement snapshots. Pagination is cursor-based, so the continuation token has to be carried and stored rather than recomputed.
- Field selection: the expansion parameters that pull referenced objects into the response, and the explicit field lists for the post, user and media objects, so that the payload and the cost stay predictable.
- Delivery and tooling: the account activity webhook with its replay semantics, the higher tiers and the research access programme where the volume justifies it, the OpenAPI contract as the source of truth for the examples, and model context protocol tools where the workflow is agent-driven.
- Put a narrow interface in front of every provider. One method per operation, one normalised response shape, one error taxonomy, so the provider can change without rewriting the callers.
- Normalise at the boundary. Timestamps to a single format, identifiers to strings, pagination cursors to a single abstraction, and error codes to a stable set.
- Record the source version and the request parameters with every stored result. Social data is mutable and expiring, and an unlabelled snapshot is uninterpretable.
- Handle rate limits as ordinary control flow. A 429 is an expected response with a known retry budget, not an exception.
- Keep the credentials out of everything a user or a CI log can see, and treat any credential that appears in public output as compromised.

**What to watch for**

- Pagination that silently stops on an empty page rather than at the end of the cursor chain.
- Retries that duplicate a write. Reads are cheap to repeat, writes are not.
- Webhook replay, and the deduplication that goes with it.
- Empty result sets, suspended accounts, deleted posts and protected content. These are normal conditions and each needs a defined behaviour.
- Documentation that has drifted from the actual contract.

**How to verify**

- A contract test per supported operation, run against the provider's own schema.
- A test matrix covering the success path, an empty result, an invalid query, a rate limited response, a transient upstream failure, a pagination continuation, a webhook retry and missing credentials.
- Examples checked against the current published contract before the change is accepted.

