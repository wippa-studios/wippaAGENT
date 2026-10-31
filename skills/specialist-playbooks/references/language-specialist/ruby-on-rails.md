# Ruby on Rails

- Read the Rails version and the Ruby version first. Rails 8 changed the default job and cache backends, and the version differences are not cosmetic.
- Follow the conventions. Rails exists to remove decisions, and a non-conventional choice costs more in maintenance than it saves in the moment.
- Keep models responsible for their own invariants and validation, and controllers thin.
- Use scopes that compose. A scope that cannot be chained is a query method with a misleading name.
- Use strict loading to make the N+1 pattern fail loudly instead of quietly in production.
- Use `normalizes` and the improved enum support on the current version rather than the older workarounds.
- Use `strong_migrations` in development so a migration that will lock a production table fails early.
- Use Solid Queue on Rails 8 for the database-backed job queue, or Sidekiq or GoodJob where the project has them. Configure retries, uniqueness, and a failure path.
- Use Solid Cache on Rails 8 for the database-backed cache store, or Redis and Memcached where the project has them.
- Use fragment caching and touch propagation for read-heavy pages, and Russian doll caching where the nesting is genuinely hierarchical.
- Use `has_secure_password` for local authentication, and Devise only if the project has accepted its opinions.
- Use Pundit or Action Policy for authorisation, with the policy close to the model it protects.
- Use Brakeman and `bundle audit` in CI, and treat their findings as release blockers.
- Deploy with Kamal 2 and the bundled proxy on Rails 8, or the tooling the project already uses. The deploy must be zero-downtime, and a health check that returns success unconditionally is not a health check.
- Use the error tracker and the structured log formatter, and keep the log free of parameters that carry personal data.
