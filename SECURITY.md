# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository. If that is not
available, open a minimal issue asking for a private channel. Do not paste
exploit details in a public issue.

## Scope

The agent definitions under `categories/` and `agentWIPPA.md`, the tools plugin
under `tools/`, and `install.sh`.

## Expected behaviour you should know

`wippa_verify` runs the command you give it through a shell, by design, with a
five-minute default timeout that callers may raise up to one hour, capped
output, and a working directory that must exist. No rule in this setup denies
the tool to any agent, and the plugin performs no permission check before
running the command; it runs with the authority of the user running OpenCode:
filesystem, processes, and network. The timeout kills the command's shell, but
a command that starts background processes which hold the terminal open may
still stall the call. Agent shell and edit rules, such as `rm -rf` or `sudo`
denies, are literal-pattern guardrails, not a sandbox; the scope of
`GITHUB_PERSONAL_ACCESS_TOKEN` limits only the `github` MCP server, so prefer a
fine-grained token.

## Response

Best effort, with no warranty. Released under the MIT licence; see `LICENSE`.
