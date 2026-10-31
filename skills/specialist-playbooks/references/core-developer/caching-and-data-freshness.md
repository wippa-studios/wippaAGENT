# Caching and data freshness

- Decide what is expensive before you decide what to cache. Cache the read that hurts, not the one that happens to be near a cache client.
- Pick an invalidation rule before you pick a cache. Write it down next to the cache call: on write, on a timer, on a version bump, or never.
- Prefer versioned keys over deletion when a delete can race with a read that is already in flight. A stale read is a bug; a resurrected key is a different bug, and versioning avoids both.
- Bound the entry size. An unbounded cache with a large value is a memory leak with a friendly name.
- Set a time-to-live even when you have an invalidation rule, as a backstop against a missed invalidation.
- Warm the cache deliberately for the paths that matter, and measure the effect rather than assuming it.
- Never cache a response that varies by identity unless the key includes the identity. Serving one user another user's data is the worst cache bug there is.
- Cache negative results carefully. They are worth caching when the miss is expensive, and dangerous when the absence is temporary.
- Keep the cache layer behind an interface so you can disable it in tests and in a degraded mode.
