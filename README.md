wippaAGENT

The only opencode set up you'll need.

1 x Primary agent

10 x Sub aagents

3 x MCPS

That's it.

![wippaAGENT logo](brand-assets/wippaAGENT-logo.png)

## What it is

wippaAGENT is a complete OpenCode setup. One primary orchestrator reads the request, plans the work and delegates it, ten specialist subagents do the implementation, and three MCP servers give those agents access to GitHub, library documentation and browser automation. Install it once and every project you open has the same roster, the same routing table and the same review discipline.

## Install

```bash
git clone https://github.com/wippa-studios/wippaAGENT.git && cd wippaAGENT && ./install.sh
```

The installer writes into one of two scopes.

**Global** — every project on this machine. Files land in `~/.config/opencode/`.

```bash
./install.sh --global
```

**Project-local** — a single project. Files land in `<project>/.opencode/`.

```bash
./install.sh --project /path/to/your/project
```

With no directory argument, `--project` uses the current directory:

```bash
./install.sh --project
```

The project directory must already exist: the installer creates the `.opencode/` directory inside it, but it does not create the project itself.

Every flag is non-interactive, so the installer runs unattended in a script or a CI job.

| Flag | Effect |
|------|--------|
| `--global` | Install into `~/.config/opencode/`. This is the default. |
| `--project [DIR]` | Install into `<DIR>/.opencode/`. `DIR` defaults to the current directory. |
| `--dry-run` | Print every planned action and write nothing. |
| `--force` | Overwrite files that already exist. |
| `--uninstall` | Remove the agent files, the skill and the plugin the installer put in place. |
| `--apply-config` | Merge the required keys into the target `opencode.json` without disturbing values you already set. |
| `--help` | Print the usage text. |

Run `./install.sh --help` for the full usage text.

The installer needs `bash` and the usual POSIX utilities (`cat`, `cp`, `ls`, `mkdir`, `printf`, `rm`, `rmdir`). Node is needed only when you pass `--apply-config`. It runs from any working directory, and it refuses to run if the agent definitions are missing from the checkout it was started from.

## Running OpenCode against this repository

The `opencode.json` in this repository describes the installed setup, not a working checkout. `agentWIPPA.md` sits at the repository root, where OpenCode's agent discovery does not look, so a bare `opencode` run in a fresh clone finds no `agentWIPPA` and falls back to the default agent.

To use the repository as a live OpenCode project, install it into the checkout:

```bash
./install.sh --project .
```

That creates `.opencode/` holding the agents, the skill and the tools plugin, and with `--apply-config` it merges the required configuration keys into `.opencode/opencode.json`. `.opencode/` is gitignored, so a local install never pollutes the repository.

## What gets installed

| What | From | To |
|------|------|-----|
| Primary agent and ten subagents | `agentWIPPA.md` and `categories/*/*.md` | `<scope>/agents/` |
| Subagent search skill | `skills/wippa-subagent-search/` | `<scope>/skills/wippa-subagent-search/` |
| Tools plugin | `tools/` | `<scope>/plugins/wippa-subagent/` |

`<scope>` is `~/.config/opencode/` for a global install and `<project>/.opencode/` for a project-local install.

Agent files are copied flat: the category directory is not preserved in the destination, so the agent id is the file name. `categories/01-core-development/core-developer.md` becomes `agents/core-developer.md`. Ids stay flat and predictable — names in the old single-specialist style, such as `python-pro`, become category-level names here, such as `core-developer`.

Nothing else is copied. The installer never touches files it did not create, and without `--force` it skips anything that already exists rather than overwriting it.

## The ten subagents

| Agent id | Category | Remit |
|----------|----------|-------|
| `core-developer` | Core Development | Application code end to end: API contract, services, frontends, GraphQL, mobile and desktop. |
| `language-specialist` | Language Specialists | Language-specific implementation, idiom, tooling and ecosystem conventions. |
| `infrastructure-engineer` | Infrastructure, PowerShell | Clouds, containers, pipelines, networking and Windows administration. |
| `quality-auditor` | Quality & Security | Review, test strategy, security audit and release readiness. |
| `data-engineer` | Data & AI, reinforcement learning | Data platforms, pipelines, models and reinforcement learning work. |
| `developer-experience` | Developer Experience | Build tooling, dependency management, documentation and developer ergonomics. |
| `domain-specialist` | Specialized Domains | Domain-heavy systems such as finance, health, legal and blockchain work. |
| `product-strategist` | Business & Product | Requirements, roadmap, backlog, user research and product decisions. |
| `orchestration-lead` | Meta & Orchestration, GitHub | Planning, delegation, repository operations and release management. |
| `research-analyst` | Research & Analysis | Investigation, comparison, evidence gathering and written analysis. |

## The primary agent

`agentWIPPA` is the orchestrator. It never edits a file and never runs a command — both permissions are denied to it by design, so it cannot bypass the roster.

What it does instead: read the request and the repository, write the plan, dispatch each piece to the subagent that owns it, read what comes back, check the result against the acceptance criterion, and report the outcome. It holds the line that nothing is reported as done until a reviewer has seen the diff and the acceptance command has returned a zero exit code.

## The three MCP servers

| Server | What it gives the agents |
|--------|---------------------------|
| `github` | Repositories, pull requests, issues, actions and code security through the GitHub API. |
| `context7` | Version-matched documentation for libraries and frameworks, so guidance matches the version in the lockfile. |
| `playwright` | Browser automation: navigate, interact and read the rendered page. |

The GitHub server expects `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment. The Playwright server runs locally through `npx`.

## The tools

The bundled plugin adds four tools for finding and reading the roster.

| Tool | Question it answers |
|------|---------------------|
| `wippa_subagent_search` | Which agents match this task, by name or by capability. |
| `wippa_subagent_get` | What exactly does one agent do: full definition, prompt and permissions. |
| `wippa_subagent_list` | What is available at all, organised by category. |
| `wippa_subagent_invalid` | Is the cached catalog stale? Clears the cache so the next read is fresh. |

The `wippa-subagent-search` skill documents all four, explains which one to reach for, and gives the equivalent procedure using `read`, `glob` and `grep` when the plugin is not connected.

## Configuration

The agent set is inert until `default_agent` points at the orchestrator. Add it to the config file for the scope you installed into.

Global config lives at `~/.config/opencode/opencode.json`:

```json
{
  "default_agent": "agentWIPPA"
}
```

Project-local config lives at `<project>/.opencode/opencode.json`:

```json
{
  "default_agent": "agentWIPPA"
}
```

The installer prints the full set of keys it expects — `default_agent`, `agents.general`, `agents.explore`, `agents.build` and `mcp.servers` — after it finishes. Run it with `--apply-config` to merge those keys into the target config automatically. The merge is non-destructive: keys you already set are left alone and reported as kept.

`env.example` documents the environment variables the setup expects: `GITHUB_PERSONAL_ACCESS_TOKEN` for the `github` MCP server, plus `WIPPA_AGENT_REGISTRY` and `WIPPA_AGENT_DIR`. Export them in the shell before starting OpenCode. `opencode debug config` resolves and prints the value of `GITHUB_PERSONAL_ACCESS_TOKEN` in clear text — treat that output as a secret and do not paste it into an issue or a chat.

`agents.general` and `agents.explore` are set to `disabled: true` because they are OpenCode built-ins and this set supplies its own agents in their place. `agents.build` demotes the built-in coding agent to a subagent, so the orchestrator keeps control of the work and the build agent writes the code.

The skill and the tools plugin need no configuration entry. They are installed into `<scope>/skills/` and `<scope>/plugins/`, and both of those directories are auto-discovery locations in OpenCode V2, so the two are picked up automatically. Relative paths in the `skills` and `plugins` arrays are resolved against your working directory rather than against your config file, so the installer does not write them.

Restart OpenCode after changing the config so the new roster is picked up.

## License

MIT. See `LICENSE`.
