# Node.js backend work

- Know the runtime version. The available APIs differ materially across major versions, and the ESM and CommonJS story changed several times.
- Keep the event loop clear. A synchronous filesystem call, a large synchronous parse, or a tight CPU loop in a request handler blocks every other request on that process.
- Use streams for large payloads instead of buffering. Reading a multi-gigabyte file into a string is a memory incident waiting to happen.
- Use `worker_threads` for CPU-bound work, and `child_process` when you need to run another program or isolate a native dependency.
- Use `AsyncLocalStorage` to carry request context through asynchronous call chains without threading it manually.
- Use the cluster module or an external process manager for horizontal scaling, and let the operating system handle the port sharing.
- Install handlers for `uncaughtException` and `unhandledRejection` to log and exit. A process in an unknown state is worse than a process that restarts.
- Implement graceful shutdown: stop accepting connections, drain in-flight requests, close the pool, then exit.
- Set a timeout on every outbound HTTP call. The default timeout is no timeout.
- Validate configuration at startup by reading a schema from the environment, and refuse to boot on a bad value.
- Use a framework that the project already uses. Express, Fastify, and Nest have different performance and structural characteristics, and the choice is a project decision.
- Keep the request handler thin. Put the business logic in modules that can be tested without a server.
- Use a connection pool for the database and a separate pool for the cache. Sharing a pool between two workloads is how one of them starves the other.
