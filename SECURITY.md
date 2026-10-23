# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository. If that is not
available, open a minimal issue asking for a private channel. Do not paste
exploit details in a public issue.

## Scope

The agent definitions under `categories/` and `agentWIPPA.md`, the tools plugin
under `tools/`, and `install.sh`.

## Expected behaviour you should know

`wippa_verify` runs shell commands by design, bounded by a timeout and capped
output. The shell and edit denies in the agent definitions are OpenCode
permission rules, so any agent that is allowed `shell` can work around them. The
real boundary is the scope of `GITHUB_PERSONAL_ACCESS_TOKEN`; use a fine-grained
token that reaches only the repositories the work needs.

## Response

Best effort, with no warranty. Released under the MIT licence; see `LICENSE`.
