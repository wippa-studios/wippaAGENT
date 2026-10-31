# GraphQL schemas and federation

- Start schema-first. A schema is an interface between teams, and interfaces should be designed rather than accumulated.
- Use interfaces and unions to model genuine polymorphism, not to avoid duplicating fields.
- Put a DataLoader in every resolver that reaches another service. The N+1 pattern is the default failure mode of GraphQL and it is invisible until you look at the query count.
- Cap query depth and calculate complexity before execution. Unbounded queries are a denial-of-service vector with a query-shaped payload.
- Persist queries in production and allowlist them. It removes the parsing cost and removes the injection surface at the same time.
- Make a field nullable deliberately. A non-null field that can fail turns a partial error into a null bubble that kills the whole response.
- For federation, choose entity keys that are stable and owned by exactly one subgraph. Reference resolvers need to be cheap, or the gateway plan degrades.
- Version by deprecating fields and tracking usage. A schema change that breaks a consumer should be visible in usage data first.
- Give the gateway a per-operation cost model and a per-client allowance, not a global one.
- Subscriptions need a pub/sub transport that survives horizontal scale, and they need the same authorisation as the equivalent query.
- Publish a GraphQL artefact that client code generation consumes, so a schema change breaks the build rather than the app.
