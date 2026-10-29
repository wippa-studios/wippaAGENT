---
name: PowerShell Automation Playbook
description: PowerShell automation playbooks for the infrastructure-engineer subagent: choosing the runtime and surviving the 5.1 and 7 compatibility gap, Windows PowerShell 5.1 with the RSAT administration modules, PowerShell 7 cross-platform cloud automation, module architecture, profile design and startup performance, hardening the scripting estate, and building interfaces over the automation. Use this skill when a brief is PowerShell work, Windows scripting, or work on the scripting estate of a Windows or hybrid infrastructure.
---

# PowerShell Automation Playbook

This skill carries the PowerShell playbooks that used to sit in the `infrastructure-engineer` agent definition, so they load when the brief is PowerShell work instead of in every infrastructure prompt. The `infrastructure-engineer` file keeps all PowerShell work in its *What you cover* list for routing; load this skill before you start when the brief is PowerShell or Windows scripting work.

## Playbooks

### Choosing the runtime and surviving the compatibility gap

**What to do**

- Decide the target before writing a line. Ask where the script will run, which hosts are in the estate, what the runtime versions are, and whether the job needs to work on both the legacy Windows shell and the modern cross-platform one.
- Treat Windows PowerShell 5.1 and PowerShell 7 as two runtimes, not as two versions of one runtime. The former is bound to the .NET Framework and the Windows PowerShell host; the latter runs on the current .NET runtime and is portable.
- Write the compatibility layer explicitly rather than hoping. A capability check at the top of the script, with a clear message when a feature is unavailable, is better than a parse error on a production host.
- Keep the branch narrow. A script that needs a feature from only one runtime should be two scripts, or a script with a small, well-labelled conditional block, not a script sprinkled with version tests.
- Pin the runtime in the pipeline and on the build agent, so the thing you test is the thing that ships.
- Record the minimum supported runtime in the module manifest, and let the manifest be the single source of truth.

**What to watch for**

- Language features that do not exist in 5.1: the ternary operator, the pipeline chain operators, the null-coalescing and null-conditional operators, and class syntax with modern features.
- Modules that require the newer runtime, because importing them on a 5.1 host fails at import time rather than at the point of use.
- Path handling. Use the provider-independent path syntax and the join operator, never string concatenation with a backslash.
- Encoding differences. Read and write files with an explicit encoding rather than relying on the system default, which differs between the runtimes and between machines.
- Output encoding on redirected output, which is where the classic mojibake comes from.

**How to verify**

- The script runs on every runtime in the declared support matrix, and the matrix is written down.

**Where the two runtimes actually differ**

| Area | Windows PowerShell 5.1 | PowerShell 7 and later |
|---|---|---|
| Underlying runtime | .NET Framework, Windows only | Current .NET runtime, cross-platform |
| Conditional expression | No ternary; use an if statement or a switch | Ternary operator available |
| Chained pipeline | No chain operators | Chain operators available |
| Null handling | Manual checks | Null-coalescing and null-conditional operators available |
| Class support | Basic classes only | Full class syntax, properties, constructors, inheritance |
| Module manifest schema | Older schema | Current schema with compatible versions |
| Platform | Windows only | Windows, Linux, macOS, containers |
| Interop | .NET Framework assemblies | Current .NET assemblies |
| Parallel per-item processing | Not available | Parallel per-item processing available |

**Choosing between them**

- Stay on the legacy runtime when the script has to run on a host that cannot be upgraded, where the required administration modules only exist for it, or where the task is specific to a Windows service role.
- Move to the modern runtime when the script has to run in a pipeline, in a container, or on a non-Windows agent, or when it needs the newer language surface, or when the estate is heading towards the modern runtime anyway.
- Write for the modern runtime by default and keep a genuinely small legacy variant only where a host forces it. Two full implementations of the same logic will drift.
- Where a single file must serve both, put the difference in one clearly marked block near the top and keep the rest of the script shared. A script with version checks scattered through it is hard to read and hard to test.
- A deliberate use of a modern-only feature on the legacy runtime produces a clear error rather than a syntax failure at the wrong moment.
- File writes are byte-identical across the runtimes for the same input.

### Windows PowerShell 5.1 and the RSAT administration modules

**What to do**

- Use the remote server administration tooling that ships with the platform: the ActiveDirectory module for accounts, groups, computers and organisational units, the DnsServer module for zones and records, the DhcpServer module for scopes and reservations, and the GroupPolicy module for policy objects and links.

- Check that the module is present and loadable before relying on it, because the administration tooling is an optional feature on a server and its absence produces a confusing command-not-found error rather than a clear one.
- Validate the environment before mutating anything. Confirm the machine is joined to the expected domain, confirm the account running the script holds the rights it needs, and confirm the target of the operation is the one intended.
- Read before you write. A query that shows exactly which objects would change is the cheapest safety mechanism available, and it costs one call.
- Stage the change. Create the objects in a disabled or pending state, verify them, then activate them, so that a partially completed batch does not leave half-provisioned accounts.
- Back up before you restructure. Export the name service zone before a record change, back up the group policy objects before a link change, and keep the backup where the operator will find it.
- Support the operating modes that make the operation reviewable: a dry run that reports without applying, an interactive confirmation for destructive steps, and a transcript that records everything.

**What to watch for**

- Directory objects left with a password that never expires or an account that never expires because a bulk operation set it that way.
- Over-broad delegation. A script that runs as a domain administrator for a read-only query has far more reach than the task needs.
- Synchronisation commands issued because a read looked stale. The directory replicates on its own, and a forced sync to make a query look right can cause a replication storm.
- Password history and length policy not being consulted before a reset.
- A bulk operation that stops halfway, leaving the domain in a mixed state.

**How to verify**

- The dry run output lists the intended changes and nothing else happens.
- A single-object run is executed and inspected before the bulk run is attempted.

**Working with directory objects**

- Build the account with the right shape on the first pass: the name, the organisational unit, the description that will still make sense in two years, the password that meets policy, the account that expires, and the group memberships.
- Use the directory cmdlets and the .NET directory classes rather than shelling out to legacy command line tools. The modern calls return structured objects, which is the difference between a script that can be composed and one that parses text.
- Set the password and the account expiry together, and set the password to never expire only when the account is a service account with a documented owner and a rotation plan.
- Prefer the granular password policies over a single domain-wide policy, so that an account created for a service does not inherit an interactive login requirement it cannot satisfy.
- Manage group membership by group, in bulk, and with a recorded diff, rather than by writing each member individually.
- Confirm the effective rights of the account running the script before it runs, and prefer delegating only what the task needs over running as a domain administrator.

**Working with name service and address lease data**

- Treat the zone file as the source of truth. Before a record change, export the zone so the previous state can be restored.
- Add records through the module rather than by editing the zone file directly, and record the change with the timestamp and the reason in the record comment.
- Watch for name collisions and for a record that already exists with a different type, because the update silently replaces it.
- For address lease scopes, confirm the scope exists, confirm the exclusion range is correct, and confirm the reservation does not fall inside an excluded range before creating it.

**Working with group policy**

- Back up the policy object before editing it, and note which organisational units the links point at before changing the links.
- Change the link order deliberately and record the previous order, because link order is the thing that determines which policy wins and it is invisible in the results.
- Test the policy against a pilot group and confirm the resulting settings, rather than assuming the applied result matches the edit.
- The transcript is produced and contains the expected operations.
- Post-change queries confirm the objects are in the intended state and that no unintended object changed.

### PowerShell 7 and cross-platform cloud automation

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

### Module architecture

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

### Profile design and startup performance

**What to do**

- Keep the profile thin. Measure the load time of the session before and after any change, because a profile that adds seconds is paid on every single shell.
- Import lazily. Load the module when the command is first used rather than at startup, and keep the prompt and the alias definitions in the profile only if they are cheap.
- Split the profile into fragments by purpose, such as a core fragment, a development fragment and an infrastructure fragment, and let the user select which are loaded.
- Move reusable logic into modules. A profile fragment that contains real logic belongs in a module that can be tested.
- Keep prompt customisation cheap, and avoid running network calls, lookups or git queries on every prompt without caching the result.
- Prefer native commands over aliases where the alias hides a behaviour that matters, and document any alias that stays.

**What to watch for**

- Heavy work in the profile, such as enumerating remote systems or querying a directory at startup.
- Imports of large modules for a single command.
- Overlapping fragments that define the same function, so the winner depends on load order.
- A profile that reaches a network dependency, which then makes every shell start slowly or fail.

**How to verify**

- The session start time is measured before and after, and the number is recorded.
- The profile loads in a clean session with no errors and no output.
- Each fragment can be loaded independently.

**Prompt design**

- Keep the prompt short and cheap. A prompt that calls out to a remote system on every shell start will be the reason the profile is removed.
- Show the information that changes what you would do next, such as the current directory, the active context, and the number of items in a queue.
- Make the prompt reflect reality rather than intent. A prompt that claims to be in a production context while pointing at a development subscription trains the operator to ignore it.
- Provide a short, memorable way to toggle the pieces the operator does not want, so the profile can be tailored without being rewritten.

### Hardening the scripting estate

**What to do**

- Configure remoting with least privilege. Use Just Enough Administration role definitions or constrained endpoints so that a connecting session can only run the commands it needs, rather than inheriting the full surface of the machine.

**The concrete settings**

- Credential storage: the SecretManagement module, the Azure key vault, DPAPI for machine-scoped secrets, and the credential locker for the interactive desktop. All four, and none of them a file on disk.
- Endpoint control: Just Enough Administration role definitions, constrained endpoints, and a listener configuration that limits the address range the host will accept connections from.
- Host baselines: the CIS and DISA STIG control sets for Windows, local administrator membership audited and reduced, the legacy SMB protocol disabled, LDAP signing required rather than negotiable, and NTLM disabled where the estate tolerates it.
- Scheduled tasks and service accounts: the stored-credential pattern removed, the account's least privilege defined, and the task's trigger and failure notification reviewed.
- Turn on the logging that makes an investigation possible: script block logging to record what was executed, module logging to record what each module did, and transcripts for the interactive sessions that matter.
- Set the execution policy deliberately and document it. The policy is a control, not an obstacle, and a policy that is set to unrestricted because it was inconvenient is a policy that has been defeated.
- Sign the scripts that run at scale, and publish them through a path that verifies the signature before execution.
- Store credentials properly, in the credential manager, the secret store, the key vault, or the platform data protection store, and never in the script, the command line, the history file, or the log.
- Harden the hosts themselves: review scheduled tasks that store credentials in their arguments, review service accounts and what they are allowed to do, and constrain the WinRM endpoints and the listeners.
- Apply the recognised Windows baselines through the same scripting you are securing, covering local administrator membership, firewall and protocol settings, the negotiation protocol, the legacy SMB protocol, and directory service signing requirements.
- Review the scripts themselves as code. Look for embedded credentials, plaintext secrets, credentials written into logs, unvalidated parameters, error handling that leaks the inner exception, and unsafe dynamic invocation or reflection.
- Put the checks into the pipeline as gates rather than as a document, so a new script that introduces a credential fails the build.

**What to watch for**

- Over-broad remote sessions that grant administrative rights to a network segment that does not need them.
- Logging that records the arguments of a command, which is how a secret ends up in a log file.
- Error handling that dumps the raw exception, the command line and the environment into a user-visible message.
- Dynamic invocation built from a string that came from user input, which is a command injection point.
- The legacy protocol settings that were never disabled and are still listening.

**How to verify**

- The configured roles and endpoints are enumerated and shown to grant only the intended commands.
- Logging is enabled and a test session is confirmed to appear in the logs.
- A credential-handling scan runs against the script set and returns nothing.
- The baseline settings are read back from the target and compared against the intended configuration.

**Change control and versioning of scripts**

- Keep the scripts in version control with the rest of the estate code, and treat a change to a scheduled task's script the same as a change to the task itself.
- Review the diff for a script change with the same care as a diff for an application, because the script runs with the privileges of whatever runs it.
- Give each script an owner, so that when the behaviour needs to change six months later, somebody knows who to ask.
- Record the schedule, the account, the privileges and the failure notification next to the script. A scheduled task with no owner and no alert is a task that fails silently until somebody notices a number is stale.
- Test the change against a copy of the target configuration before applying it to the live one, and keep the rollback script with the change.
- Keep the old version of a script alongside the new one until the new one has run successfully more than once. Replacing a scheduled script in place leaves nothing to roll back to.
- A deliberately weak script is submitted and the gate rejects it.

**Reviewing scripts as security-relevant code**

- Search for embedded secrets first: strings that look like a credential, a connection string with a password in it, a base64 blob that decodes to something, and a token pasted into a variable.
- Check the credential handling pattern. A credential read from a parameter typed as a plain string will end up in the transcript, and a credential passed on the command line ends up in the history file and in the process listing.
- Check the error handling. A catch block that writes the exception, the command and the environment into a log is a leak, and a catch block that swallows the error is worse, because it hides a failure that the operator needs to see.
- Check the dynamic invocation. Building a command name from a string that came from a parameter, a file, or a network response is a command injection point even when the string looks validated.
- Check the permission surface. Confirm the script requests only the rights it uses, and that the account it runs under has only those rights.
- Check the logging configuration. Script block logging and transcripts are what make an incident reconstructable, and a script that suppresses them removes the evidence.
- Check the pipeline surface. A script that publishes an artefact, opens a network listener, or writes to a shared path changes the exposure of the machine it runs on.

**Mapping to the recognised baselines**

- Where a compliance framework applies, map each control to the specific script and setting that satisfies it, so that an assessment can be answered with a reference rather than with a narrative.
- Keep the mapping in version control next to the scripts, and date it, because the baselines are revised and an undated mapping quietly becomes wrong.
- Automate the check where the check can be automated. A control that depends on someone remembering to look is not a control.

### Interfaces over the automation

**What to do**

- Keep the interface and the logic in separate layers. The interface collects input, shows progress, displays results and handles the human decisions; the logic module does the work and knows nothing about windows or prompts.

**The technology map**

- Windows Forms for the quick Windows-only utility, with forms, panels, menus, toolbars, dialogs, list views, tree views, data grids and progress bars, and the event handlers wired in one place.
- WPF for the richer layout, with XAML loaded from an external file or from a here-string, data binding to PowerShell objects, a view-model boundary so the script behaves like a view model over a module, and a resource dictionary holding the colours, templates and styles.
- The modern themed set, with MahApps.Metro or Elysium over WPF, for the tile-based dashboard, the flyouts, the accent colours and the theme switch, with the icons and status badges used as the at-a-glance cue.
- Terminal interfaces: a menu-driven script, key-based navigation, text dashboards and status pages, the platform's grid view as the selection fallback, and the console APIs where the control needs to go further than the host provides.
- Have the interface call the module, never the other way round. A module that draws a dialog is a module that cannot be scheduled, tested or reused on a server.
- Choose the interface technology by the environment. Use a desktop form for a quick Windows-only utility. Use the desktop toolkit with a markup-based layout and a modern themed set of controls for a polished dashboard with tiles, flyouts and theming. Use a terminal interface for servers, remote shells, containers and any environment where a human is present but a graphical session is not.
- Load markup from an external file rather than embedding it inline in a script. An embedded block cannot be diffed, themed or reviewed.
- Bind the controls to plain objects rather than to live infrastructure state. A view model keeps the interface testable and stops a background refresh from mutating a control the user is interacting with.
- Handle long-running work properly. Push it off the interface thread, report progress, and let the user cancel. An operation that freezes the window for ninety seconds reads as a crash.
- Design the terminal interface with the same care as a graphical one: clear prompts, visible keyboard shortcuts, no hidden input modes, resilient handling of bad input, and a layout that survives a narrow terminal.
- Provide a clean exit path. If the user cancels halfway, either nothing was applied or the partial state is reported; a tool that leaves half-applied changes behind cannot be used by anyone cautious.

**What to watch for**

- Logic inside the event handlers, which makes it untestable and impossible to reuse.
- A background thread that updates a control and crashes the session.
- A dialog that reports success without checking the result of the operation it describes.
- Text that overflows when the terminal is narrow, and prompts that assume a wide window.
- A form that leaks the underlying exception into a message box.

**How to verify**

- The logic module runs and is tested with no interface present.
- The interface is exercised against the real module, including the slow path, the error path and the cancel path.
- The interface is usable at the smallest supported window or terminal size.
- The layout file is reviewed as a diff alongside the code.

**Accessibility of the interface**

- Give every control a name that is not the caption, so a screen reader announces something useful rather than the element type.
- Make the whole flow reachable by keyboard, including the controls inside a flyout and the confirmations.
- Keep the colour contrast high enough to read, and never use colour alone to carry a status.
- Respect the platform text scaling, so that a layout built for the default font size does not clip when the operator has larger text enabled.
- Label errors in text next to the field, not only as a colour change, and associate the message with the field for assistive technology.

**Desktop forms**

- Build the form as a constructor function that returns the object, rather than as a script that draws it on import, so that the form can be created, shown and tested independently.
- Wire the events in one place, and let each handler do one thing: validate, call the module, and update the display.
- Use a data grid with a bound list rather than filling it row by row, because the bound version stays correct when the underlying data changes.
- Report progress for anything that takes more than a second, and move the work off the interface thread so the window keeps responding.
- Keep the sensitive fields out of the display and out of any error dialog, and clear them when the window closes.

**Markup-based layouts and modern themes**

- Define the layout in an external file and load it at runtime, so the layout can be reviewed, diffed and themed without touching the script.
- Use a resource dictionary for colours, spacing and styles, so that a theme change is a dictionary change rather than an edit across every screen.
- Bind to plain view objects rather than to live service state. A view model can be constructed in a test, and a background refresh cannot mutate a control the operator is using.
- Use a themed control set for a dashboard with tiles and flyouts, and keep the theme in the resource dictionary so that upgrading the control library is a low-risk change.
- Put status, badge and icon cues where the operator will see the state without reading a line of text.

**Terminal interfaces**

- Choose a menu-driven layout, a key-driven layout, or a status display, based on how the operator will actually use the tool. A helpdesk running the same task fifty times a day needs keys, not a guided menu.
- Show the available actions and their shortcuts on screen, and never require a hidden input mode.
- Validate the input as it arrives and re-prompt on bad input rather than failing, because a mistyped key in a script-driven session is common and not exceptional.
- Detect the terminal width and degrade the layout rather than wrapping into an unreadable mess.
- Fall back to the platform's grid view when a list selection is more useful than a menu, and make sure the fallback still works where the grid is unavailable.
