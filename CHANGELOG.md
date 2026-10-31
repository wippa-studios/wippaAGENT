# Changelog

All notable changes to wippaAGENT are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each entry
names the pull request that shipped it; the release step dates the entry
below.

## [Unreleased]

## [1.1.0] - 2026-11-01

### Changed

- Every specialist definition now keeps a routing table and loads its
  playbooks on demand from `specialist-playbooks`, one file per topic. The
  corpus fell from about 104,100 to 29,179 estimated tokens (one token taken
  as four characters).
- `powershell-automation-playbooks` and `reinforcement-learning-playbooks` are
  now indexes plus reference files, like `domain-playbooks`.
- The primary prompt drops the roster's coverage column and shortens the
  subagent-lookup section, and gains a context-economy section.
- The built-in `build` agent is disabled rather than demoted, so no second
  implementer appears in the roster.
- The wordmark is now a two-line monospace lockup, rendered into the README
  from the installer banner by `npm run wordmark`;
  `brand-assets/wippaAGENT-wordmark.svg` is removed and the installer banner
  is 13 rows tall and 44 columns wide instead of 117 columns.

### Added

- `scripts/token-count.mjs --max-agent` and `scripts/playbooks.test.ts`, and
  `npm run test:quiet`.
- `check:claims` now deep-compares the whole `agents` object and the whole
  `mcp.servers` object in `opencode.json` with the installer's JSON template,
  including every server URL and command, and requires each built-in entry to
  be exactly `{ "disabled": true }`.

### Fixed

- The corpus budget was measuring files that never share a context; a
  per-agent ceiling now gates the figure that a dispatch actually pays.
- `install.sh --apply-config` now migrates the previously demoted `build`
  entry it wrote: it removes only the `mode` and `permissions` keys that
  demoted the built-in, keeps every other key on the entry, and disables the
  built-in; any other user-defined `build` entry is preserved unchanged.
- The quick-routing table restores the capabilities the removed roster column
  carried, and states the fallback when no row matches.

Shipped in #9, with documentation corrections in #10 and #12.

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
- `domain-playbooks` is now a `SKILL.md` index plus 16 reference files under
  `references/`. A domain task loads the 844-token index and one reference of
  roughly 600–1,000 tokens instead of the previous 12,129-token body, about
  85% less. `scripts/token-count.mjs` now reports nested `.md` files, and
  `scripts/token-count.test.ts` covers the split.

### Added

- A CI smoke job that installs the set on a pinned OpenCode binary and
  asserts that all thirteen agents resolve and the tools plugin loads. It
  needs no credentials and no model (#5).
- A manual, secret-guarded dispatch-eval workflow that dispatches every
  scenario in `evals/scenarios/` through a live model only when the
  repository secrets exist, and exits green with a notice when they do not
  (#5).
- `check:claims` now fails when the README or `docs/tool-capability-map.md`
  skill count disagrees with the number of skill directories in `skills/`, so
  the "six" claim cannot drift silently.
- `install.sh` prints an optional wordmark banner above the header when stdout
  is a wide UTF-8 terminal. `WIPPA_BANNER=on` forces it into a CI log or a
  piped install, and `WIPPA_BANNER=off` suppresses it.
- `README.md` opens with a vector wordmark generated from the same art as the
  installer banner. `npm run wordmark` regenerates it from `install.sh`, and a
  test fails when the committed SVG and the source art disagree.

### Fixed

- The tools plugin reads the same hand-edited JSONC configurations the
  installer accepts and searches the config locations OpenCode itself loads
  them from — the global directory, ancestor directories and `.opencode`
  directories — in the documented precedence order (#5).
- The installer's dry-run and summary arithmetic add up, and `--uninstall`
  removes a target directory that it emptied (#5).
- `install.sh` reports the number of skill directories on `skills written`,
  not the number of skill files, now that a skill can hold reference files.
  The copy behaviour is unchanged.

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
