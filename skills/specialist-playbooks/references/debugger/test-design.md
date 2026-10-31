# Test design

- Start from the risk, not from the coverage target. Find the paths where a failure costs money, loses data, or leaks information.
- Design the cases as a matrix. Take the dimensions that matter (role, state, input shape, error condition) and enumerate the combinations that are meaningful rather than exhaustive.
- Cover the negative path deliberately. Rejected input, expired credentials, absent resources, conflicting state, and downstream failure are where the real defects live.
- Cover the boundaries. Zero, one, the maximum, and one past the maximum.
- Test the concurrency that matters. Two simultaneous requests for the same resource is a more realistic scenario than a rare malformed payload.
- Make the test data realistic but minimal. A fixture that mirrors production data at production volume will slow the suite for no benefit.
- Decide what not to test. A test that restates the implementation is a maintenance cost with no defect-finding value.
- Add the regression test at the level the bug lived, and confirm it fails before the fix and passes after. A regression test that was never seen red protects nothing.
- Track the escaped defects. A defect that reached production and was not caught by a test points at a gap in the strategy, not at bad luck.
