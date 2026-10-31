# Test automation

- Design the framework as a structure, not a pile of scripts. A page object or a screen object, a fixture layer, a data layer, and a thin step layer.
- Select the runner for the project: the ecosystem's own runner, a browser automation tool, a mobile automation tool, or an API-level client. Match the language the tests will live in.
- Prefer API-level tests for the backend. They are faster, more stable, and closer to the contract than a browser driving a form.
- Use the browser only for what needs the browser: rendering, navigation, accessibility, and visual regression.
- Make the data explicit and independent per test. A test that depends on another test's leftover record is a test that fails on a re-run and nobody knows why.
- Use deterministic waiting rather than fixed sleeps. Wait for the condition, not for the clock.
- Keep the locators stable and semantic. A locator tied to a CSS class or a generated attribute breaks on every styling change.
- Run the suite in parallel where the tests are independent, and keep the sharding by a stable key so a failure is reproducible.
- Publish the report in a form a human can act on, with the failure, the screenshot, and the trace.
- Measure the flake rate and treat it as a defect. A flaky test erodes the trust that makes the suite useful, and people learn to re-run rather than to fix.
- Keep the total runtime inside a window people will wait for. A suite that takes forty minutes is a suite that runs only in the nightly job.
