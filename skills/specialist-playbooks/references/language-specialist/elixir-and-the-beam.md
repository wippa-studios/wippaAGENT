# Elixir and the BEAM

- Design the supervision tree before the GenServer. The tree is the architecture, and a service without one has no failure story.
- Let it crash. A process that catches every exception and continues is a process whose state is now unknown.
- Use `{:ok, value}` and `{:error, reason}` for expected failure, `with` for the happy path, and `rescue` only at the boundary.
- Use pattern matching in every clause. A function body that is mostly `case` expressions is a function that wanted to be several functions.
- Use the pipeline operator for data transformation. It reads top to bottom and it makes the stages visible.
- Use `Enum` and `Stream` for collection work, and `Stream` when the collection is large enough that materialising it would be a problem.
- Use `GenServer` for state, `Agent` for a single value, `Task` for one-off work, and `Registry` for lookup.
- Use `Supervisor` with a `:one_for_one` or `:one_for_all` strategy chosen deliberately, and a `:max_restarts` and `:max_seconds` window that reflects reality.
- Use `DynamicSupervisor` when children come and go at runtime.
- Use ETS for hot shared read data, and remember that ETS tables are not owned by the process that writes to them unless you say so.
- In Phoenix, use contexts as the application boundary. A function reaching into another context's tables defeats the purpose.
- Use LiveView for server-rendered real-time interfaces, with `streams` for large collections and `phx-change` for form validation.
- Use changesets for input validation in Ecto, with the error messages written for the person who will read them.
- Use `Repo.transaction` and `with` for multi-step writes, and `Ecto.Multi` for a set of operations with a defined rollback.
- Use `Task.Supervisor` and `Task.async_stream` for parallel work, with a `timeout` and a `on_timeout` that fails the task rather than hanging.
- Use Dialyzer with specs, Credo for style, and `mix format --check-formatted` before you finish.
- Ship a release rather than a bare mix run, with the configuration in `config/runtime.exs` and the clustering configured for the deployment.
- Use Telemetry for metrics and `:observer` for the profiler, and instrument the boundaries rather than the internals.
