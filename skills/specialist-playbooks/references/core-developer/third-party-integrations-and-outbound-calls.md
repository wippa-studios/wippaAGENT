# Third-party integrations and outbound calls

- Treat every external service as unreliable and slow. Set a timeout on every call, and a shorter one on the calls that are not on the critical path.
- Retry only what is safe to retry. A retry of a non-idempotent write needs an idempotency key sent to the provider.
- Use a circuit breaker so a failing dependency stops consuming your workers. A breaker with no half-open probe never recovers.
- Put a bulkhead around each dependency. Without one, a slow provider consumes the shared worker pool and takes down unrelated features.
- Cache responses you are allowed to cache, with the provider's own cache headers as the authority rather than a guessed TTL.
- Handle the provider's rate limits. Respect the documented limits, back off when told, and queue rather than race.
- Assume the provider's schema changes without warning. Validate the response against a schema before you trust it.
- Make the integration replaceable. Keep the provider's types at the edge of your code so a change of provider touches one adapter.
- Record every external call with its latency and outcome. A slow dependency is only visible if you measured it.
- Decide what happens when the provider is down before it is down. A checkout that fails cleanly beats one that half-succeeds.
