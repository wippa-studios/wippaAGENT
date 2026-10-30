# Changelog

All notable changes to wippaAGENT are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each entry
names the pull request that shipped it; the release step dates the entry
below.

## [1.0.0] - Unreleased

The initial distribution, shipped across pull requests #2–#5.

### Changed

- **Breaking: the primary agent id is `wippaAGENT`.** It was `agentWIPPA`
  before #2, so anything that pinned the old id — a `"default_agent"` value, a
  permission rule, a script, a saved prompt — has to move to `wippaAGENT`.
  The rename is complete across the agent file, the roster, the installer and
  the tools plugin, and `npm run check:claims` now fails the build whenever
  those surfaces disagree (#2).
- The prompt corpus shrank from ~137,800 to ~104,100 estimated tokens (one
  token taken as four characters) as task playbooks moved out of the agent
  definitions into six on-demand skills. `npm run check:tokens` enforces the
  110,000-token corpus ceiling and the 1,000-token always-on skill-listing
  ceiling in CI (#4).
- Routing is consolidated onto one roster and one tie-break list, so a
  request resolves to exactly one owning subagent and the choice is recorded
  in the plan (#3).
- Every skill directory under `skills/` is installed: the copy is a loop over
  the directory, and `check:claims` fails the build if a skill could be
  silently left out (#4).
- CI installs from the committed lockfile with `npm ci`, and the tools plugin
  is type-checked against the real OpenCode plugin types rather than a local
  copy of them — which is how the diff tool's VCS contract was caught (#5).

### Added

- A CI smoke job that installs the set on a pinned OpenCode binary and
  asserts that all thirteen agents resolve and the tools plugin loads. It
  needs no credentials and no model (#5).
- A manual, secret-guarded dispatch-eval workflow that dispatches every
  scenario in `evals/scenarios/` through a live model only when the
  repository secrets exist, and exits green with a notice when they do not
  (#5).

### Fixed

- The tools plugin reads the same hand-edited JSONC configurations the
  installer accepts and searches the config locations OpenCode itself loads
  them from — the global directory, ancestor directories and `.opencode`
  directories — in the documented precedence order (#5).
- The installer's dry-run and summary arithmetic add up, and `--uninstall`
  removes a target directory that it emptied (#5).

### Security

- `wippa_verify` now runs a tokenising allowlist guard — a character policy
  plus a command allowlist with per-command flag rules — before the
  permission check and before anything is spawned, and every `shell` guard in
  the agent frontmatter is mirrored as a `verify` guard so the tool cannot
  bypass an agent's shell denies (#3).
- Agent definitions and skills treat content obtained from the web, from
  issues, pull requests and comments read through tooling, and from pages
  read by a browser as data, never as instructions (#3).
- The `github` MCP server registers only the `repos`, `issues`,
  `pull_requests` and `actions` toolsets; the token scope remains the real
  boundary (#3).
