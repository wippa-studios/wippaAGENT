# Command line interfaces

- Make the command hierarchy match the mental model of the task. A flat list of forty flags is a tool nobody can use.
- Use the convention of the ecosystem: long flags with two dashes, a short form for the most common, a subcommand per noun, and a consistent noun-verb order.
- Support the help output as the documentation. The help text is read more often than any manual, so it needs examples.
- Print help on an unknown flag rather than a stack trace, and suggest the nearest valid flag.
- Exit with distinct codes for distinct failure classes, so a script can branch on the outcome.
- Write the errors for the person who will read them. Say what failed, what the tool expected, and what to try next.
- Never print a stack trace by default. Offer a verbose or debug flag for the internal detail.
- Respect the no-colour and no-TTY conventions. A tool that dumps escape codes into a log file is a tool nobody pipes.
- Send diagnostics to standard error and the primary output to standard output, so the tool composes with a shell pipeline.
- Support machine-readable output. A flag that emits JSON makes the tool usable from a script.
- Add shell completions for the shells the users have, generated from the same definition as the parser so they cannot drift.
- Keep startup fast. A tool that takes a second to print its version will be felt by every script that calls it in a loop.
- Make the interactive prompts optional. A prompt that blocks a pipeline is a prompt that breaks automation, so support a non-interactive mode with the values supplied as flags.
- Validate the input at the edge and fail before doing any work. A tool that half-applies a change and then errors is a tool people stop trusting.
- Make the destructive operations explicit and confirmable, with a way to skip the confirmation for the pipelines that need it.
- Make the output stable. A format that changes between versions breaks every script that reads it.
- Provide a version command that reports the version, and keep the version in step with the release.
