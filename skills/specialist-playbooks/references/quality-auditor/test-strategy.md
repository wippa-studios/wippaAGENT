# Test strategy

- Start from the risk, not from the coverage target. Find the paths where a failure costs money, loses data, or leaks information.
- Write the strategy as a small set of levels with a purpose each: unit tests for the rules, integration tests for the seams between components, contract tests for the interfaces other teams depend on, and end-to-end tests for the few flows that define the product.
- Set the exit criteria explicitly. A suite with no exit criteria cannot fail a build, which means it cannot protect anything.
- Use the pyramid shape sensibly. Many fast tests, fewer integration tests, a handful of end-to-end tests.
- Design the cases as a matrix. Take the dimensions that matter (role, state, input shape, error condition) and enumerate the combinations that are meaningful rather than exhaustive.
- Cover the negative path deliberately. Rejected input, expired credentials, absent resources, conflicting state, and downstream failure are where the real defects live.
- Cover the boundaries. Zero, one, the maximum, and one past the maximum.
- Make the test data realistic but minimal. A fixture that mirrors production data at production volume will slow the suite for no benefit.
- Test the concurrency that matters. Two simultaneous requests for the same resource is a more realistic scenario than a rare malformed payload.
- Decide what not to test. A test that restates the implementation is a maintenance cost with no defect-finding value.
- Track the escaped defects. A defect that reached production and was not caught by a test points at a gap in the strategy, not at bad luck.
- When the strategy calls for a framework to be built, repaired, or de-flaked, route the work to `debugger`. You decide what the suite must prove; they build the machine that proves it.
