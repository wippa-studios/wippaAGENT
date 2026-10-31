# Module architecture

**What to do**

- Draw the public surface first and keep it small. A module's public functions are its contract, and every function you publish is a thing you have to keep working.
- Put everything else in private functions, and export deliberately with an export list in the manifest rather than by dumping the whole session.
- Give the module a manifest with the metadata, the version, the required runtime, the exported commands and the tags. The manifest is what makes the module installable, discoverable and versionable.
- Extract shared logic into helper functions or a small internal library rather than copying it between scripts. Duplicated logic is where two modules start disagreeing about what a thing means.
- Structure the module around the pipeline, not around the file. Accept input from the pipeline, emit objects, and let the caller compose the stages.
- Use advanced functions with the cmdlet binding attribute, strict parameter typing with validation attributes, and a consistent error and verbose output contract.
- Support the operating modes on every state-changing function: a dry run that reports what would change, and an interactive confirmation where the operation is destructive.
- Test with Pester, and treat the tests as the specification. The public surface needs a test per behaviour, the private helpers need tests for the awkward branches, and the module needs a smoke test that imports it cleanly on each supported runtime.
- Use the module's own version to gate capability detection, so a script can ask what the module can do rather than guessing from the runtime version.

**What to watch for**

- Functions that do several jobs and are therefore unusable in a pipeline.
- Parameters typed loosely, so the wrong type fails deep inside the function instead of at the boundary.
- Global state. A module that depends on a variable set by its caller is not a module.
- Dot-sourcing everything into a session, which makes the load order matter and the failures unattributable.
- A manifest that lies about the exported surface.

**How to verify**

- Importing the module in a clean session exposes exactly the exported commands and nothing else.
- The Pester suite passes on every runtime in the support matrix.

**Testing the automation**

- Unit test the logic in isolation, with the environment mocked. The unit under test is the transformation, not the call to the directory or the cloud.
- Mock at the boundary, not the internals. A mock of the external call is a boundary; a mock of your own helper is a test that will pass whatever you change.
- Write the mock to fail. A mock that returns a plausible default will let a broken code path pass, so assert on the mock being called with the arguments you expect.
- Test the failure paths explicitly: the module throws, the network times out, the object is missing, the permission is refused. Those are the paths that run in production.
- Run the suite on every runtime in the support matrix, in the pipeline, on every change. A test that only runs on one runtime is a test of that runtime.
- Keep the test data free of anything that identifies a real system, and keep the credentials in the secret store even in the test job.
- The manifest exports match the actual exported commands, checked mechanically.
- A dry run on a representative input produces the expected change list and changes nothing.

**Module layout**

- A conventional layout separates the public entry points from the internals, keeps the manifest at the root, places the tests in their own folder, and gives the module its own directory rather than scattering files into a shared module folder.
- A public function file, a private helper file, a module manifest, a loader that exports the intended surface, and a test file are enough for most modules. Everything else is added when a real need appears rather than in anticipation of one.
- The module loader is the single place that decides what is exported. Enumerating the public files from one list is far easier to review than relying on whatever a wildcard picked up.
- Keep the module self-contained. A module that reads the caller's session state is not a module, and it is the reason a script that worked in one console fails in another.

**Publishing and versioning**

- Use semantic versioning and mean it. A major version for a breaking change to the public surface, a minor version for an added command, a patch version for a fix that does not change the contract.
- Publish to a repository that the target estate can reach, and pin the version in the consuming script so a new release cannot change the behaviour of an unchanged script.
- Keep the previous version available. The estate will not upgrade on the day you publish.

**Documentation that survives**

- Give every public command a help block that states what it does, what it requires, what it changes and what it returns. The help block is read in the console at the moment of need, and it is the documentation people actually use.
- Keep a short operational note with each script family: what the scripts are for, what order they run in, what they need, and what to do when one fails.
- Record the decisions, not the mechanics. The mechanics are in the code; the note should explain why the script takes the approach it takes, because that is the part that is lost.
- Date the notes. A note about a platform feature that has since changed is worse than no note.
- Write the change note for the consumer: what was added, what changed, and what the operator must do differently.
