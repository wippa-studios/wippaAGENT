# Java and the Spring ecosystem

- Target a long-term support release. Java 17 is the current baseline for most enterprise support windows.
- Use records for value carriers, `sealed` for closed hierarchies, and pattern matching for switches.
- Keep the domain layer free of framework types. A domain object that imports a persistence annotation is a domain object coupled to your ORM.
- Use constructor injection. Field injection hides dependencies and makes testing harder.
- Configure Spring Boot with typed configuration properties rather than scattered `@Value` lookups.
- Use profiles for environment differences and validate the active profile's configuration at startup.
- Use `spring.jpa.open-in-view` deliberately. Leaving it on is a common cause of a slow endpoint and lazy-loading errors in production.
- Write explicit queries when the generated one is wrong, and check the SQL that actually runs. Enable statement logging in a development environment.
- Use Testcontainers for integration tests against a real database rather than an in-memory substitute.
- Use Resilience4j for circuit breaking, retries, and bulkheads on outbound calls, with timeouts that are shorter than the caller's own.
- Use Spring WebFlux only when the whole path is non-blocking. A blocking call inside a reactive pipeline stalls the event loop.
- Use `Mono` and `Flux` with awareness of the difference between composing and subscribing. Nothing happens until subscription.
- Use Flyway or Liquibase for migrations and keep them in version control with the application.
- Use Spring Security with method-level authorisation for the business rules and URL rules for coarse access.
- Use a structured logging setup with a correlation identifier propagated through the request.
- Use Micrometer metrics and OpenTelemetry tracing with the sampling configured, not left at the default.
- GraalVM native images cut startup and memory, at the cost of reflection and dynamic loading support. Verify the build before you promise it.
- Read the plan output from a query before you add a cache. Most "the database is slow" reports are a missing index or a cartesian join.
