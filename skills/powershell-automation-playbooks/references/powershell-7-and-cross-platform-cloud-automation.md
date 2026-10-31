# PowerShell 7 and cross-platform cloud automation

**What to do**

- Use the newer language surface where it earns its place: the ternary operator for readable conditionals, the chain operators for early exit and default paths, the null-coalescing operator for defaults, and classes for structured data that has to move between functions.

- Interoperate with the current .NET runtime directly. When the platform cmdlet does not exist, the runtime is there, and a typed .NET call is usually clearer than a string of shell commands.
- Automate the cloud with the platform tooling: the Az module for Azure resources, the command line client where it is the better interface, and the Graph API with its PowerShell module for identity, mail, team and site administration.
- Validate context before the first call. Confirm the subscription, the tenant and the account, because the default context is whatever the last login selected and that is a common source of running the wrong job against the wrong target.
- Make the script idempotent. A script that can be run twice without consequence is safe to schedule, safe to re-run after a partial failure, and safe to hand to someone else.
- Handle paths, newlines and encodings portably, and keep the platform-specific parts isolated so the portable core stays portable.
- Emit structured output for a pipeline: a consistent object shape, a non-interactive mode, and a documented exit code, so the script composes with the runner rather than being a wall of text.
- Keep the parallelism deliberate. Parallel per-item processing helps on independent work and hurts when the items contend on the same resource or the output has to stay ordered.

**What to watch for**

- Module version drift. The platform modules move and their command surfaces change, so pin the versions and test against them.
- Authentication model drift between contexts. A managed identity, a service principal and an interactive sign-in are different identities with different rights, and the script must say which one it expects.
- Secrets in the script, in the history, or in the output. Read them from the secret store or the environment at run time.
- A non-interactive run that prompts and hangs a pipeline until the timeout.
- Standardised error output. Free-form text makes the failure unparseable in a pipeline, so errors need a stable shape and a meaningful exit code.

**How to verify**

- The script runs clean in a container image with the pinned module versions and no interactive session.
- Running it twice produces the same state and the same exit code.
- A subscription, tenant or resource that does not exist produces a specific, actionable error rather than a generic failure.

**Running in containers and pipelines**

- Use the official container images that carry the runtime and the pinned modules, so the pipeline environment matches the environment the script was tested in.
- Install the module versions explicitly rather than taking whatever the image ships.
- Provide the credentials through the pipeline's secret mechanism, mounted at run time, and never through an environment variable that will be echoed by a debug flag.
- Run as a non-privileged user inside the container. Most of these scripts do not need elevation, and running them as root inside a container adds risk without adding capability.
- Make the entry point exit non-zero on failure so the pipeline stops, and make sure the script does not swallow the error on its way out.
- Keep the container image pinned to a digest rather than to a moving tag, so that a rerun of the same commit behaves the same way.
- No secret appears in the transcript, the output or the pipeline log.

**Building a command line tool rather than a script**

- Give the tool a proper entry point with named parameters, a help block that says what it does, what it needs and what it will change, and an exit code that means something.
- Separate the concerns into a small number of layers: a layer that reads the input, a layer that computes what should happen, and a layer that applies it. The computing layer is where the dry run lives, and keeping it separate is what makes the dry run honest.
- Support the three output modes the operating environment needs: a table for a person, a structured object for a pipeline, and a quiet mode for scripting.
- Write the error output in a consistent shape, so that a caller can distinguish a handled failure from an unhandled one and act on it.
- Support cancellation, because a long-running tool that cannot be stopped is a tool that gets killed at the worst moment.
- Version the output. A tool whose output shape changes between versions breaks every caller that parses it, so add fields rather than renaming them, and announce the change.

**Working with the platform command line client**

- When the platform ships both a command line client and a PowerShell module, pick one per operation and stay consistent. Mixing the two in a single script produces two sets of error handling and two sets of authentication checks.
- Use the non-interactive output mode in automation, and parse the structured output rather than the human-readable output, because the human format is not covered by a compatibility promise.
- Handle the authentication model explicitly. A managed identity works in a pipeline with a federated credential, a service principal works everywhere with a secret in the store, and an interactive sign-in works only on a desk.
