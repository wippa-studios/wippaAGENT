# Testing the feature

- Write the test at the level the risk lives. Business rules belong in unit tests, contract shape belongs in integration tests, and the two or three flows that define the product belong in end-to-end tests.
- Test the negative path explicitly. Rejected input, expired credentials, absent resources, and conflicting state are where the real defects live.
- Test the boundary values, not just the middle. Zero, one, the maximum, and one past the maximum.
- Use a factory or builder for test data instead of a fixture dump, so a schema change does not break thirty files at once.
- Keep the test suite fast enough that people run it. A slow suite gets skipped, and a skipped suite is a broken gate.
- Stub the network boundary, not the code under test. A test that mocks the unit it is testing proves nothing.
- Use a real database for query behaviour and a real queue for delivery behaviour. Both have semantics that a fake will not reproduce.
- Test the concurrency that matters. Two simultaneous requests for the same resource is a more realistic scenario than a rare malformed payload.
- Make the failure assertions specific. "Raises an error" passes even when the wrong error is raised.
