# Rate limiting, quotas, and abuse

- Rate limit at the edge and again at the service, because the edge is not the only way in.
- Key the limit on something meaningful: authenticated principal, tenant, source address, or a combination. An address-only limit punishes shared egress.
- Separate the read allowance from the write allowance. A client that can poll forever will block a client that is doing real work.
- Return `429` with a `Retry-After` header and a limit descriptor, so a well-behaved client can back off intelligently.
- Use a sliding window or a token bucket rather than a fixed window. A fixed window lets a client send twice the limit across the boundary.
- Keep the counter store close to the limiter. A global round trip to a remote store turns the limiter into the bottleneck.
- Apply a separate, tighter limit to authentication endpoints. Credential stuffing is a volume problem, not a clever one.
- Cap the cost of a single request, not just its count. A cheap call and an expensive one should not draw from the same allowance.
- Log the limit decisions that reject, and alert when rejection rates climb, because a spike is often an attack rather than a busy client.
- Make the limits configurable, because a limit that cannot be changed without a deploy is a limit that will eventually be wrong.
