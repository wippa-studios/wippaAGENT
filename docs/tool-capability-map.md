# Tool capability map — wippaAGENT

This map records every capability the bundle owner asked for, and what the
wippaAGENT bundle satisfies today. A capability is `Covered` when it works with no
new code and no new configuration, `Partial` when it works only through a
general-purpose mechanism such as `shell`, or with a caveat, and `Gap` when
nothing in the bundle satisfies it. For every gap the map says whether the answer
is to build a tool inside this bundle or to adopt an MCP server. The map reflects
OpenCode V2 as documented on 2026-10-23.

## 1. Code intelligence

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| LSP diagnostics and symbol lookup (find references, go to definition, rename) | Gap | Nothing in the bundle speaks the Language Server Protocol. The built-in `grep` and `glob` match text and paths only, and no server in `opencode.json` → `mcp.servers` exposes language-server tools. | Adopt MCP | `opencode.json` → `mcp.servers.serena` — `{ "type": "local", "command": ["uvx", "--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd"] }`. Serena's language-server backend supplies symbol lookup, references, rename and diagnostics. |
| Semantic or embedding-based codebase search | Gap | The only code-facing search is the built-in `grep` tool, which is lexical. `wippa_subagent_search` searches agent definitions, not source code. | Adopt MCP | The same `mcp.servers.serena` entry: `find_symbol`, `get_symbols_overview` and `find_referencing_symbols` give symbol-level retrieval. Embedding similarity over the codebase is not covered by any server named in this map. |
| Dependency and import graph inspection | Partial | A subagent can run `npm ls --json`, `go list -deps` or `cargo tree` through `shell`. The primary agent cannot, because `agentWIPPA.md` denies `shell`. The output is text, and nothing in the bundle traverses the module graph. | — | No artefact today. The shell route is the only one; `tools/` holds nothing for it. |

## 2. Version control and review

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| Git operations (status, diff, branch, commit, log, blame) | Partial | Subagents run `git` through `shell`; `agentWIPPA.md` denies `shell` to the primary agent. Output is raw text, not a structure. | — | No artefact today. A plugin reads the same data structurally through `ctx.vcs.status`, `ctx.vcs.branches` and `ctx.vcs.diff`. |
| GitHub issues, pull requests, review comments, CI status | Covered | The `github` MCP server is configured at `opencode.json` → `mcp.servers.github` as a remote server carrying the header `X-MCP-Toolsets: context,repos,issues,pull_requests,actions,code_security,notifications`. | — | Already live. `opencode.json` → `mcp.servers.github`. |
| GitLab issues, merge requests, pipelines | Gap | No GitLab server is configured. `opencode.json` → `mcp.servers` holds only `github`, `context7` and `playwright`. | Adopt MCP | npm package `@modelcontextprotocol/server-gitlab` — `{ "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-gitlab"], "environment": { "GITLAB_PERSONAL_ACCESS_TOKEN": "{env:GITLAB_PERSONAL_ACCESS_TOKEN}", "GITLAB_API_URL": "{env:GITLAB_API_URL}" } }` |
| Worktree management for parallel agent work | Covered | The Code Mode `worktree` namespace provides `worktree_create`, `worktree_list` and `worktree_remove`, and `opencode.session_move` relocates the current session into a worktree. | — | Already live. The built-in `worktree` namespace of Code Mode and `opencode.session_move`; no bundle artefact is required. |

## 3. Testing and quality

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| Test runner execution | Partial | `package.json` → `scripts.test` is `node --test "**/*.test.ts"`, run by a subagent through `shell`. The primary agent cannot run it through `shell`: `agentWIPPA.md` hands the acceptance command to the `wippa_verify` tool, which runs it asynchronously and returns the real exit code and duration. The tool asserts the `verify` permission action with the command as its resource before spawning, so the agent frontmatter's `verify` rules apply. | — | No artefact today. The runner exists at `package.json` → `scripts.test`; only the result format is missing. |
| Structured test results (machine-readable summary) | Gap | `shell` returns the raw runner output as text. Nothing in the bundle parses it into counts, failed test names or a verdict. | Build | `tools/wippa-test-report.ts` — see the Build list. |
| Linter, formatter and type-check runners | Gap | The bundle ships no linter or formatter configuration, and `opencode.json` has no `formatter` key, so OpenCode does not format files after a write. It does ship `tsconfig.json` and a `typecheck` script for its own tools. | Build | `tools/wippa-quality-report.ts` — see the Build list. Add `"formatter": true` to `opencode.json` to enable the built-in post-write formatter as well. |
| Coverage reports | Partial | `shell` can run `node --test --experimental-test-coverage`, which the Node version required by `package.json` → `engines.node` supports. The bundle holds no coverage configuration and no report artefact. | — | No artefact today; `shell` with `node --test --experimental-test-coverage` is the only route, and `tools/wippa-quality-report.ts` returns the same run as structured data. |
| Browser automation (Playwright) for UI verification | Covered | The `playwright` MCP server is configured at `opencode.json` → `mcp.servers.playwright` as a local server running `npx --yes @playwright/mcp@0.0.83 --isolated`. | — | Already live. `opencode.json` → `mcp.servers.playwright`. |

## 4. Research and knowledge

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| Web search | Covered | The built-in `websearch` tool queries the configured provider. `opencode.json` pins no provider, so the default applies. | — | Already live. The built-in `websearch` tool; no bundle artefact required. |
| Fetch a known URL | Covered | The built-in `webfetch` tool retrieves one HTTP or HTTPS URL as markdown, text or HTML. | — | Already live. The built-in `webfetch` tool; no bundle artefact required. |
| Library documentation lookup | Covered | The `context7` MCP server is configured at `opencode.json` → `mcp.servers.context7` as a remote server at `https://mcp.context7.com/mcp`. | — | Already live. `opencode.json` → `mcp.servers.context7`. |
| Project memory or notes that persist across sessions | Gap | The bundle holds no notes, memory or journal store. `opencode.json` → `compaction.auto` summarises a long context inside a session; it does not persist anything into the next one. | Build | `tools/wippa-notes.ts` — see the Build list. |

## 5. Agent orchestration

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| Subagent search, get, list and cache refresh | Covered | The four roster tools are implemented in `tools/index.ts`, registered under the namespace `wippa` with `codemode: false`, and surface natively as `wippa_subagent_search`, `wippa_subagent_get`, `wippa_subagent_list` and `wippa_subagent_invalid`; the fifth tool is `wippa_verify`, described in section 3. The catalog is cached in `ctx.storage` and rebuilt when the on-disk fingerprint changes. It is roster-scoped: a global agent directory contributes only the ids the roster names and the ids in `WIPPA_CUSTOM_AGENT_IDS`, so unrelated agents installed for other projects are not indexed. | — | Already live. `tools/index.ts`, with the contract documented in `skills/wippa-subagent-search/SKILL.md`. |
| Task delegation with result collection | Covered | The built-in `subagent` tool starts a child session and returns its result, in the foreground or in the background. In this repository, `opencode.json` → `experimental.subagent_depth` is `1`, so a subagent cannot start another subagent; `install.sh --apply-config` does not write this key, and OpenCode's documented default is also 1, so an installed scope behaves the same. A plugin can drive the same path with `ctx.session.create`, `ctx.session.prompt` and `ctx.session.wait`. | — | Already live. `agentWIPPA.md` allows `subagent` on `*` and denies `edit` and `shell`. |
| Planning and task-tracking tools | Partial | Planning is a step of the orchestrator workflow described in `agentWIPPA.md`, not a tool. The built-in `todowrite` tool is not enabled, because `opencode.json` → `experimental` sets only `subagent_depth`. | — | Add `"todo": true` to `opencode.json` → `experimental`, which enables the `todowrite` tool. |

## 6. Data and infrastructure

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| Database query tool, read-only by default | Gap | No database client is configured. `shell` could run `psql`, but that is neither read-only nor structured. | Adopt MCP | npm package `mcp-postgres` (unverified) — `{ "type": "local", "command": ["npx", "-y", "mcp-postgres"], "environment": { "DATABASE_URL": "{env:DATABASE_URL}", "DB_READ_ONLY": "true" } }` |
| Docker and container management | Gap | No container server is configured. `shell` can call the `docker` CLI, but the bundle holds no container allowlist. | Adopt MCP | npm package `mcp-server-docker` (unverified) — `{ "type": "local", "command": ["npx", "-y", "mcp-server-docker"], "environment": { "ALLOWED_CONTAINERS": "{env:DOCKER_ALLOWED_CONTAINERS}", "DEFAULT_SERVICE": "{env:DOCKER_DEFAULT_SERVICE}" } }` |
| Cloud CLI wrappers — AWS | Gap | No AWS server is configured. `shell` could call `aws`, but no credential handling, region pinning or API-shape validation is in place. | Adopt MCP | PyPI package `mcp-proxy-for-aws` (unverified) — `{ "type": "local", "command": ["uvx", "mcp-proxy-for-aws", "https://aws-mcp.us-east-1.api.aws/mcp", "--metadata", "AWS_REGION=us-east-1"] }` |
| Cloud CLI wrappers — GCP | Gap | No GCP server is configured. `shell` could call `gcloud`, but no project or credential scoping is in place. | Adopt MCP | npm package `gcp-mcp-server` (unverified) — `{ "type": "local", "command": ["npx", "-y", "gcp-mcp-server"] }` |
| Cloud CLI wrappers — Azure | Gap | No Azure server is configured. `shell` could call `az`, but no subscription or resource scoping is in place. | Adopt MCP | npm package `@azure/mcp` — `{ "type": "local", "command": ["npx", "-y", "@azure/mcp", "server", "start"] }` |
| Log and error monitoring | Gap | No observability server is configured. `categories/03-infrastructure/infrastructure-engineer.md` and `categories/09-meta-orchestration/orchestration-lead.md` describe this work as prompt-level remits, not as a tool. | Adopt MCP | `opencode.json` → `mcp.servers.sentry` — `{ "type": "remote", "url": "https://mcp.sentry.dev/mcp" }` |

## 7. Project management and comms

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| Issue tracker — GitHub | Covered | The `github` MCP server is live with the `issues`, `pull_requests` and `actions` toolsets. `categories/09-meta-orchestration/orchestration-lead.md` owns the repository workflow end to end. | — | Already live. `opencode.json` → `mcp.servers.github`. |
| Issue tracker — Linear | Gap | No tracker is connected beyond GitHub. | Adopt MCP | `opencode.json` → `mcp.servers.linear` — `{ "type": "remote", "url": "https://mcp.linear.app/mcp" }` |
| Issue tracker — Jira | Gap | No Jira connector is configured. | Adopt MCP | npm package `mcp-atlassian` (unverified) — `{ "type": "local", "command": ["npx", "-y", "mcp-atlassian"], "environment": { "ATLASSIAN_BASE_URL": "{env:ATLASSIAN_BASE_URL}", "ATLASSIAN_EMAIL": "{env:ATLASSIAN_EMAIL}", "ATLASSIAN_API_TOKEN": "{env:ATLASSIAN_API_TOKEN}" } }` |
| Slack notifications | Gap | Nothing in the bundle can post to Slack. `categories/07-specialized-domains/domain-specialist.md` covers workplace chat as a domain remit; it cannot send a message. | Adopt MCP | `opencode.json` → `mcp.servers.slack` — `{ "type": "remote", "url": "https://mcp.slack.com/mcp" }` |
| Email notifications | Partial | A subagent can call a mail CLI or an HTTP mail API through `shell`. There is no dedicated tool, no retry policy and no recipient allowlist. | — | No artefact today. The shell route is the only one; `tools/` holds nothing for it. |
| Docs access — Notion | Gap | No docs connector is configured. | Adopt MCP | `opencode.json` → `mcp.servers.notion` — `{ "type": "remote", "url": "https://mcp.notion.com/mcp" }` |
| Docs access — Confluence | Gap | No docs connector is configured. | Adopt MCP | The same npm package `mcp-atlassian` as the Jira row; it exposes the Confluence read and search tools. |
| Docs access — Google Drive | Gap | No docs connector is configured. | Adopt MCP | `opencode.json` → `mcp.servers.gdrive` — `{ "type": "remote", "url": "https://drivemcp.googleapis.com/mcp/v1" }` |

## 8. Safety and operations

| Capability | Status | How it is satisfied today | If a gap: build or adopt | Concrete deliverable |
|---|---|---|---|---|
| Secrets lookup that never exposes values to the model | Gap | The bundle has no secret broker. `env.example` lists the variable names with empty values, and no secret store or service registration is shipped in the bundle. | Adopt MCP | `opencode.json` → `mcp.servers.onepassword` — `{ "type": "local", "command": ["1password-mcp"] }`. The 1Password desktop app's MCP server returns environment and variable names and never stored values. |
| Permission rules and command allowlists | Partial | The bundle already uses ordered rules. `opencode.json` → `permissions` allows `subagent` on `*`; the frontmatter of `agentWIPPA.md` denies `edit` and `shell`; every definition under `categories/` guards `shell` on `rm -rf *` (deny, or `ask` for `orchestration-lead`) and denies `sudo *`, with `research-analyst` and `product-strategist` denying all shell, and `security-reviewer` additionally denying `git push --force *` and all edits. Each of those `shell` guards is repeated for the `verify` action, because `wippa_verify` runs a command through a shell, and the tool asserts `verify` before it spawns anything. The top-level `policies` block, which hard-denies, is not set. | — | Add `"policies": [{ "action": "tool.use", "resource": "shell:rm -rf *", "effect": "deny" }]` to `opencode.json`. The plugin already asserts the matching rule through `ctx.permission.assert`. |
| Audit logging of tool calls | Gap | Nothing records what a tool did. OpenCode keeps session transcripts, but the bundle has no queryable trail and no `ctx.event.subscribe` consumer. | Build | `tools/wippa-audit.ts` — see the Build list. |
| Sandboxed execution for risky commands | Gap | `shell` runs with the host user's full filesystem, process and network authority. Permission denies narrow the blast radius but sandbox nothing. | Build | `tools/wippa-sandbox-run.ts` — see the Build list. |

## Already covered — do not rebuild

Covered, working today with no new code and no new configuration:

- GitHub issues, pull requests, review comments and CI status — the `github` MCP server, `opencode.json` → `mcp.servers.github`.
- Worktree management for parallel agent work — the `worktree` namespace of Code Mode and `opencode.session_move`, no configuration required.
- Browser automation for UI verification — the `playwright` MCP server, `opencode.json` → `mcp.servers.playwright`.
- Library documentation lookup — the `context7` MCP server, `opencode.json` → `mcp.servers.context7`.
- Web search and URL fetching — the built-in `websearch` and `webfetch` tools.
- Subagent search, get, list and cache refresh — `wippa_subagent_search`, `wippa_subagent_get`, `wippa_subagent_list` and `wippa_subagent_invalid` in `tools/index.ts`, cached in `ctx.storage`.
- Task delegation with result collection — the built-in `subagent` tool; `opencode.json` → `experimental.subagent_depth` is `1` in this repository, so a subagent cannot start another subagent, and an installed scope behaves the same because `install.sh --apply-config` writes no such key and OpenCode's documented default is also 1.
- Issue tracker, GitHub — the same `github` server as the first entry.

Partial, working through a general-purpose mechanism or with a caveat:

- Git operations — `shell` runs `git` for subagents; a plugin could read the same state structurally through `ctx.vcs`.
- Test runner execution — `package.json` → `scripts.test`, run by a subagent through `shell`.
- Coverage reports — `shell` with `node --test --experimental-test-coverage`.
- Dependency and import graph inspection — `shell` with `npm ls`, `go list -deps` or `cargo tree`.
- Planning and task-tracking — the workflow in `agentWIPPA.md`; adding `"todo": true` to `opencode.json` → `experimental` enables `todowrite`.
- Email notifications — `shell` against a mail CLI or API, with no allowlist and no retry policy.
- Permission rules and command allowlists — already in `opencode.json` → `permissions` and in the agent frontmatter; only the `policies` block is missing.

## Build list

This is a wishlist for future work; nothing in it is implemented in the bundle today.

Ordered by value. Each item is a TypeScript tool for this bundle, written against the OpenCode V2 plugin API and placed under `tools/`, following the convention of the plugin already there. A plugin registers tools through `ctx.tool.transform` with `options.namespace` and `options.codemode`, and the namespace and the tool name together form the effective name, so a file `tools/wippa-test-report.ts` holding a tool named `test_report` surfaces as `wippa_test_report`.

| Rank | Capability | Proposed file | Plugin API surface | Tool contract |
|---|---|---|---|---|
| 1 | Structured test results | `tools/wippa-test-report.ts` | `ctx.tool.transform`, `ctx.permission.assert`, `ctx.storage` | `wippa_test_report({ command?, format? })` runs the project's test command, parses the runner output, and returns `{ passed, failed, skipped, failures: [{ name, message, file, line }] }`; the last result is cached in `ctx.storage`. |
| 2 | Linter, formatter and type-check runners | `tools/wippa-quality-report.ts` | `ctx.tool.transform`, `ctx.permission.assert` | `wippa_quality_report({ check: "lint", "typecheck" or "coverage" })` runs the matching project script and returns normalised counts plus the first diagnostics, so a caller never parses free-form console output. |
| 3 | Audit logging of tool calls | `tools/wippa-audit.ts` | `ctx.event.subscribe`, `ctx.storage` | On load it subscribes to the event stream and appends one record per tool call (tool, agent, session, timestamp, outcome) to a durable plugin-scoped log, and exposes `wippa_audit({ action: "list" or "summary", since? })`. |
| 4 | Project memory across sessions | `tools/wippa-notes.ts` | `ctx.storage`, `ctx.tool.transform` | `wippa_notes({ op: "get", "set", "list" or "delete", key, value? })` reads and writes durable JSON notes scoped by project; the notes outlive the session. |
| 5 | Sandboxed execution for risky commands | `tools/wippa-sandbox-run.ts` | `ctx.tool.transform`, `ctx.permission.assert` | `wippa_sandbox_run({ command, image?, timeoutMs? })` asserts permission for the action, then runs the command in a disposable container with networking disabled and a read-only source mount, returning the exit code and captured output. |

## Adopt list

This is a wishlist for future work; nothing in it is implemented in the bundle today.

Every gap whose answer is `Adopt MCP`. The block below is ready to paste into the `mcp.servers` object of `opencode.json`, alongside the three servers already there. Local servers take `type`, `command` and an optional `environment`; remote servers take `type`, `url` and optional `headers` and `oauth`. It holds the servers whose identifier comes from the vendor that owns the service, from the official MCP reference-server collection, or from the project's own git repository. Every third-party identifier that could not be checked offline is in the Unverified section below and is kept out of this block.

```json
{
  "mcp": {
    "servers": {
      "serena": {
        "type": "local",
        "command": ["uvx", "--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd"]
      },
      "gitlab": {
        "type": "local",
        "command": ["npx", "-y", "@modelcontextprotocol/server-gitlab"],
        "environment": {
          "GITLAB_PERSONAL_ACCESS_TOKEN": "{env:GITLAB_PERSONAL_ACCESS_TOKEN}",
          "GITLAB_API_URL": "{env:GITLAB_API_URL}"
        }
      },
      "azure": {
        "type": "local",
        "command": ["npx", "-y", "@azure/mcp", "server", "start"]
      },
      "onepassword": {
        "type": "local",
        "command": ["1password-mcp"]
      },
      "linear": {
        "type": "remote",
        "url": "https://mcp.linear.app/mcp"
      },
      "notion": {
        "type": "remote",
        "url": "https://mcp.notion.com/mcp"
      },
      "slack": {
        "type": "remote",
        "url": "https://mcp.slack.com/mcp"
      },
      "gdrive": {
        "type": "remote",
        "url": "https://drivemcp.googleapis.com/mcp/v1"
      },
      "sentry": {
        "type": "remote",
        "url": "https://mcp.sentry.dev/mcp"
      }
    }
  }
}
```

Notes on the block above:

- No version is pinned anywhere in this map. A registry check could not be run where this map was written, so every identifier must be confirmed, and pinned, before it is added. Run `npm view <package> version` for a package, or read the vendor's own documentation for a remote endpoint.
- The five remote servers use OAuth by default in V2. Sign in from the TUI with `/mcps`. `linear`, `notion`, `slack`, `gdrive` and `sentry` need nothing beyond that, while `slack` additionally requires a registered application id.
- `serena` needs `uv` on the path and downloads the server from its git repository on first run. It is the answer for the language-server gap in section 1.
- `onepassword` is the binary installed by the 1Password desktop app. The server works only on a machine where that app is installed and unlocked.
- `azure` is published by Microsoft, and the current release line of that package is a beta.

### Unverified — confirm before adding

These identifiers could not be checked against a registry or a vendor document where this map was written. They are kept out of the paste-ready block on purpose. Confirm each one before adding it.

- `postgres` — npm package `mcp-postgres`, local server. The official `@modelcontextprotocol/server-postgres` is also read-only, but it is deprecated on npm and no longer maintained.
- `docker` — npm package `mcp-server-docker`, local server. It exposes a single `run_command` tool scoped by `ALLOWED_CONTAINERS`.
- `atlassian` — npm package `mcp-atlassian`, local server. It serves both Jira and Confluence.
- `aws` — PyPI package `mcp-proxy-for-aws`, local server. It proxies to an AWS-hosted endpoint and needs no local credentials. The local alternative is PyPI `awslabs.aws-api-mcp-server`.
- `gcp` — npm package `gcp-mcp-server`, local server. It authenticates through `gcloud auth application-default login`. Third-party package, not a Google-published one.

## How this bundle maps onto OpenCode

One primary agent, twelve subagents, three MCP servers, five tools and one skill.

- The primary agent is `agentWIPPA.md` at the repository root. It plans, delegates, reviews, integrates and reports. Its frontmatter denies `edit` and `shell` and allows `subagent`, so it never writes code; the only command it triggers is the acceptance command through the bounded `wippa_verify` tool.
- The twelve subagents are self-contained definitions, each with `mode: subagent` and shell guards on `rm -rf *` and `sudo *` (deny, or `ask` for `orchestration-lead`):

| Subagent | Definition | Covers |
|---|---|---|
| `core-developer` | `categories/01-core-development/core-developer.md` | API design, authentication, backend, frontend, full-stack, GraphQL, microservices, UI design, webhooks, WebSockets, Electron, mobile apps |
| `language-specialist` | `categories/02-language-specialists/language-specialist.md` | 27 language and framework specialists |
| `infrastructure-engineer` | `categories/03-infrastructure/infrastructure-engineer.md` | Cloud, Azure, Terraform, Kubernetes, Docker, networking, platform engineering, SRE, deployment, incidents, Windows infrastructure, all PowerShell work |
| `quality-auditor` | `categories/04-quality-security/quality-auditor.md` | Code review, architecture review, test strategy, accessibility, interface testing, performance review |
| `security-reviewer` | `categories/04-quality-security/security-reviewer.md` | Security audit, penetration testing, Active Directory posture, compliance and privacy, supply-chain audit, prose audit |
| `debugger` | `categories/04-quality-security/debugger.md` | Bug reproduction, root-cause isolation, error analysis, test automation, flake control, resilience and chaos |
| `data-engineer` | `categories/05-data-ai/data-engineer.md` | AI systems, data engineering and science, databases, Postgres, SQL, LLM architecture, prompts, NLP, ML engineering, MLOps, reinforcement learning |
| `developer-experience` | `categories/06-developer-experience/developer-experience.md` | Build systems, CLIs, dependencies, documentation, git workflow, refactoring, MCP servers, READMEs, tooling, visual assets |
| `domain-specialist` | `categories/07-specialized-domains/domain-specialist.md` | Blockchain, email deliverability, embedded, fintech, games, healthcare, IoT, Microsoft 365, payments, quant, risk, SEO, Slack, WordPress, X/Twitter |
| `product-strategist` | `categories/08-business-product/product-strategist.md` | Assumption mapping, backlog, business analysis, content, customer success, growth, landing pages, legal, licensing, product and project management, sales, scrum, technical writing |
| `orchestration-lead` | `categories/09-meta-orchestration/orchestration-lead.md` | Installing and managing agents, error coordination, IT operations, and all GitHub work: issues, pull requests, review comments, CI status, releases |
| `research-analyst` | `categories/10-research-analysis/research-analyst.md` | A/B tests, cohorts, competitors, market research, project validation, scientific literature, web search, trends, UX research |

- The three MCP servers live in `opencode.json` → `mcp.servers`: `github` for issues, pull requests, review comments and CI status; `context7` for current library and framework documentation; `playwright` for browser automation in UI verification.
- The five tools are an OpenCode plugin implemented in `tools/` and registered by `opencode.json` → `plugins`. It uses the namespace `wippa` with `codemode: false`, so the tools appear natively as `wippa_subagent_search`, `wippa_subagent_get`, `wippa_subagent_list`, `wippa_subagent_invalid` and `wippa_verify`, which asserts the `verify` permission action and then runs the acceptance command asynchronously through a shell, with a timeout, capped output and cancellation. It indexes `categories/<category>/<agent>.md` when running in the repository and `<scope>/agents/<agent>.md` when running from an installed copy, and `wippa_subagent_list` groups the result by the category directory.
- The skill at `skills/wippa-subagent-search/SKILL.md` documents the same four operations and gives the equivalent `read`, `glob` and `grep` procedure for when the plugin is not loaded.
- The installer `install.sh` flattens `categories/*/*.md` plus `agentWIPPA.md` into `<scope>/agents/`, copies the skill and the tools plugin, and with `--apply-config` merges the config keys into the target `opencode.json` without overwriting values that are already set.

## Deployment notes

- `opencode.json` is the project configuration OpenCode reads. Project configuration can live at `opencode.json` or `.opencode/opencode.json` in the project directory; the global file is `~/.config/opencode/opencode.json`.
- `cli.json` holds terminal and TUI preferences and is global-only in V2, at `~/.config/opencode/cli.json`; it is machine-local and is not shipped in this bundle.
- `service.json` is not an OpenCode file and nothing in the bundle references it; no copy is shipped, and the name is listed in `.gitignore` only as a machine-local file to ignore.
- No configuration key accepts a list of agent file paths, so the agent definitions have to sit in a discovered directory. The installer flattens them into `<scope>/agents/`, where `<scope>` is `~/.config/opencode/` for a global install and `<project>/.opencode/` for a project-local install.
- `env.example` documents the variables the bundle reads: `GITHUB_PERSONAL_ACCESS_TOKEN` for the `github` MCP server, `WIPPA_AGENT_REGISTRY` for the `orchestration-lead` agent, and `WIPPA_AGENT_DIR`, which overrides the directories the tools plugin indexes, and `WIPPA_CUSTOM_AGENT_IDS`, which lists the agent ids the user keeps in their own global configuration; those ids are indexed alongside the roster and exempted from roster drift reporting.
- `opencode.json` → `permissions` allows the `subagent` action on `*`, `opencode.json` → `agents` disables the `general` and `explore` built-ins and demotes the `build` built-in to a subagent, and `opencode.json` → `experimental.subagent_depth` is `1`. That key is checkout-only: `install.sh --apply-config` does not write it, and OpenCode's documented default is also 1, so an installed scope behaves the same.
