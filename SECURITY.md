# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository. If that is not
available, open a minimal issue asking for a private channel. Do not paste
exploit details in a public issue.

## Scope

The agent definitions under `categories/` and `wippaAGENT.md`, the tools plugin
under `tools/`, and `install.sh`.

## Expected behaviour you should know

`wippa_verify` runs the command you give it through a shell, by design, with a
five-minute default timeout that callers may raise up to one hour, capped
output, and a working directory that must exist. It is not unrestricted: the
tool asserts a `verify` permission action with the command as its resource
before spawning anything, so a deny rule for `verify` stops it exactly as the
same rule stops `shell`, and it refuses `rm -rf`, `sudo` and `git push --force`
even where no rule is configured. It runs with the authority of the user running
OpenCode: filesystem, processes, and network. The call is asynchronous, so it
does not block the session, and cancelling the call kills the command. On POSIX
the timeout kills the command's process group; on Windows it kills the shell, so
a background process that holds the output open may still stall the call. Agent
shell and edit rules, such as `rm -rf` or `sudo` denies, are literal-pattern
guardrails, not a sandbox; the scope of `GITHUB_PERSONAL_ACCESS_TOKEN` limits
only the `github` MCP server, so prefer a fine-grained token.

## Response

Best effort, with no warranty. Released under the MIT licence; see `LICENSE`.
