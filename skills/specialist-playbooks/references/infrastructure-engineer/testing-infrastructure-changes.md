# Testing infrastructure changes

- Validate the configuration in a pipeline before it can reach production. Linting, policy checks, and a plan against a representative state all belong there.
- Run the plan in a non-production workspace on a schedule to catch drift and provider-side changes before they surprise you.
- Test the platform the way the application tests it, with a real deployment into a test environment, not a template render.
- Include a destroy test for the components that should be disposable. A stack that cannot be torn down will accumulate.
- Test the recovery path, not only the create path. Restoring a database or a cluster is the operation nobody rehearses.
- Use a policy check that fails the pipeline, not one that reports. A warning in a log is not a gate.
- Exercise the failure paths you designed for: an unavailable dependency, an expired certificate, a revoked credential, a full disk. A platform that has never seen these will meet them at the worst time.
- Keep the test environment close enough to production that the difference does not matter. A configuration difference is a whole class of untested behaviour.
