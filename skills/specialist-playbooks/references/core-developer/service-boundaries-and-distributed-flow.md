# Service boundaries and distributed flow

- Derive boundaries from the domain, and check them against team ownership. A boundary that splits a team splits the incident response.
- Give each service its own data. A shared database is a shared failure with extra steps.
- Prefer synchronous calls for reads the caller needs immediately and events for state changes other parties may react to.
- Make producers transactional with their own writes. An outbox table plus a relay is the standard way to avoid publishing something you did not commit.
- Use sagas for multi-service transactions, with compensation rather than distributed locks.
- Assume every call fails. Timeouts on everything, bounded retries with jitter, circuit breakers, and bulkheads so one slow dependency cannot consume the whole worker pool.
- Propagate a correlation identifier through every hop so a trace can be assembled after the fact.
- Version contracts at the consumer, not the producer, when you can. Additive producer changes and consumer-driven contract tests keep a fleet of services from breaking each other in a chain.
- Keep the API gateway thin. Authorisation, rate limiting, and routing belong there; business logic does not.
- Design for graceful degradation. A feature that degrades is better than a page that fails, and the degradation should be a decision you wrote down.
- Keep a service stateless where you can. State in the instance makes scaling, rolling updates, and failover harder than it needs to be.
