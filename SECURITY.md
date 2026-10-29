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
output, and a working directory that must exist. It is not unrestricted. A
tokenizing guard runs first, before the permission check and before anything is
spawned: it refuses command substitution, expansion, redirection, pipes,
statement separators, single-`&` backgrounding and line breaks anywhere in the
command string, allows only `&&` chains, scans every word of every segment —
flat, in argument position, and inside quotes — against a denylist of shell
interpreters with `-c`, the `sudo` and `rm` families, network and archive
tools, mutating `git` subcommands, package install/publish/exec subcommands,
file mutators, `awk` and `xargs`, denies interpreter-plus-eval-flag pairs such
as `python -c`, `node -e` and `sed -i`, and runs `install.sh` only with
`--dry-run`, so the tool cannot be used to write files past an edit deny.
Read-only commands and test runners pass. After the guard, the tool asserts a
`verify` permission action with the command as its resource before spawning
anything, so a deny rule for `verify` stops it exactly as the same rule stops
`shell`. The guard is a denylist with a character policy, not a sandbox: it
runs a command with the authority of the user running OpenCode — filesystem,
processes, and network. The call is asynchronous, so it does not block the
session, and cancelling the call kills the command. On POSIX the timeout kills
the command's process group; on Windows it kills the shell, so a background
process that holds the output open may still stall the call. Agent shell and
edit rules, such as `rm -rf` or `sudo` denies, are literal-pattern guardrails,
not a sandbox either.

`wippa_diff` validates its `base` ref before handing it to git: absolute
paths, `..` traversal, option-like `-…` input, and shell-significant
characters are refused with a stated error.

## Token scope for the github MCP server

The `github` MCP server is registered with the `repos`, `issues`,
`pull_requests` and `actions` toolsets only — the surface the roster routes
through `orchestration-lead`. The token is still the real boundary: use a
fine-grained `GITHUB_PERSONAL_ACCESS_TOKEN` scoped to a single repository,
granting only Issues (read and write), Pull requests (read and write),
Contents (read, for refs and releases metadata) and Actions (read, for CI
status). No agent-level rule restricts which MCP servers each agent may call,
so the registered toolsets and the token scope are what limit the `github`
server for every agent.

## Response

Best effort, with no warranty. Released under the MIT licence; see `LICENSE`.
