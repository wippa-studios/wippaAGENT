# The broad pass

- Check correctness first: the logic, the error handling, the resource cleanup, the boundary conditions, and the naming that a reader has to decode.
- Check the security surface only far enough to flag it: the input validation, the authorisation on every path, the obvious injection risks, and the secret handling in the diff. A suspected hole is a finding routed to `security-reviewer`, not a hole for you to prove or fix.
- Check the performance surface: the algorithm complexity, the query count, the memory growth, the network round trips, the cache effectiveness, the asynchronous work, and the resource leaks.
- Check the structure: the complexity of each function, the coupling between modules, the cohesion of the unit, the depth of the abstraction, and whether the design pattern used fits the problem.
- Check the tests: the coverage of the new behaviour, the quality of the assertions, the edge cases, the isolation between tests, the mocks that hide real behaviour, and the missing integration seam. A suite that needs building or repairing is a finding routed to `debugger`.
- Check the documentation: the comments that explain why, the public interface documentation, the example usage, and the changelog entry.
- Check the accessibility of a user-facing change: the semantics, the labels, the focus order, and the keyboard path.
- Check the operational readiness: the logs, the metrics, the alerts, and the runbook entry for the new behaviour.
- Keep the finding count proportional to the change. A large diff with no findings is worth saying so plainly.
