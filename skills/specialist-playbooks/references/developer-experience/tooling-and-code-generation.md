# Tooling and code generation

- Build a tool for a task that recurs, not for a task that happened once. The frequency is the justification.
- Give the tool a narrow surface. A tool that can do everything is a tool nobody trusts with anything.
- Make the tool composable: it reads standard input and writes standard output, takes flags for its inputs, and returns a meaningful exit code.
- Provide an extension point when the use cases will diverge. A plugin mechanism added early is cheaper than a rewrite later.
- For a code generator, drive it from a schema rather than from a template, and make the generated code pass the same lint and format rules as the hand-written code.
- Mark the generated files so nobody edits them by hand. A header comment that says the file is generated, and a build check that enforces it.
- Make the generator idempotent. Running it twice must produce the same output, or the diff will be noise.
- Support a dry-run mode that shows what would change, and a check mode that fails when the output is stale.
- Add the check mode to the pipeline. A generator whose output drifts from the input is a generator that lies.
- Keep the scaffolding minimal and correct rather than comprehensive. A template that includes every optional feature is a template nobody reads.
- Prefer generating types and schemas over generating logic. A generated type is easy to keep in sync; a generated implementation is easy to fight with.
- Measure the tool's own startup and run time, because a tool that is slow gets invoked less and the manual path returns.
- Write the tool so it can be run in CI without a human present, and give it a clear failure message when it cannot.
