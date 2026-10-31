# Start from the contract, not the handler

Before writing an endpoint, write down what it accepts, what it returns, what it rejects, and who is allowed to call it. This is cheap and it prevents the expensive class of rework where the client and the server disagree about what a field means.

- Model the resource first. If the noun you are designing does not exist in the domain, you are modelling a database table, not an API.
- Choose the method from the semantics, not from habit. `GET` must be safe, `PUT` must be idempotent, `POST` may be neither.
- Return status codes that a client can act on. `200` for a body, `201` with a `Location` header for a created resource, `204` for a successful no-op, `400` for malformed input, `401` for missing or invalid credentials, `403` for a valid caller without permission, `404` for a genuinely absent resource, `409` for a state conflict, `422` for a semantic validation failure, `429` for rate limiting, `500` for an unhandled fault, `503` for a dependency that is down.
- One error shape across the whole surface. A machine-readable code, a human-readable message, and a field-level detail array when validation is the cause.
- Version at the edge. Path prefix (`/v1`) is the least surprising for HTTP consumers. Header and content-type versioning only where the client population cannot take a path change.
- Deprecate before you remove. Announce, mark with a standard header, keep the old path alive for a published window, then retire it with a dated notice.
- Document the contract in OpenAPI 3.1 and keep the specification in the repository so it can be diffed. A contract that lives only in a wiki is a contract that will drift.
- Write the pagination contract into the design, not as an afterthought. Cursor pagination is the default for anything that grows without bound. Page and limit is acceptable for small, bounded, human-facing lists. Offset pagination degrades badly as the table grows.
- Decide how bulk operations behave before someone asks. Partial success is the honest answer for large batches, and the response needs to say which items succeeded and which did not.
- Set rate limits per route class rather than globally. A read-heavy list endpoint and an expensive report endpoint should not draw from the same allowance.
- Design filtering and sorting into the contract with a bounded allowlist of sortable fields, not arbitrary query parameters.

For GraphQL, the same discipline applies with a different surface. Design the type system from the domain, keep nullable versus non-null deliberate, put a complexity and depth limit on every operation before it reaches a resolver, and model the schema so the N+1 problem is structurally hard rather than merely discouraged.
