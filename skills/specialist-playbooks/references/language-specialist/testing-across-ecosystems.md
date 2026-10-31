# Testing across ecosystems

- Match the framework's own test tool. A test that fights the framework's mocking model is a test that will be rewritten.
- Test behaviour through the public interface. A test coupled to internals breaks on every refactor and proves little.
- Use the ecosystem's isolation tools. A transactional test harness, a dependency override, a frozen clock, a temporary directory.
- Use the framework's parallel test runner where the suite is large enough to need it.
- Keep the test suite fast enough that people run it locally, because a suite that only runs in CI is a suite nobody trusts.
- Test the failure path. Most ecosystems give you a good story for the happy path and leave the error path to whoever is on call.
- Use fixtures that are built by the code under test where possible, so they cannot drift from the schema.
