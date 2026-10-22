wippaAGENT

The only opencode set up you'll need.

1 x Primary agent

12 x Sub aagents

3 x MCPS

That's it.

![wippaAGENT logo](brand-assets/wippaAGENT-logo.png)

## What it is

wippaAGENT is a complete OpenCode setup. One primary orchestrator reads the request, plans the work and delegates it, twelve specialist subagents do the implementation and the review, three MCP servers give those agents access to GitHub, library documentation and browser automation, and a bundled plugin adds roster lookup plus an acceptance verifier. Install it once and every project you open has the same roster, the same routing table and the same review discipline.

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
| Primary agent and twelve subagents | `agentWIPPA.md` and `categories/*/*.md` | `<scope>/agents/` |
| Subagent search skill | `skills/wippa-subagent-search/` | `<scope>/skills/wippa-subagent-search/` |
| Tools plugin | `tools/` | `<scope>/plugins/wippa-subagent/` |

`<scope>` is `~/.config/opencode/` for a global install and `<project>/.opencode/` for a project-local install. That is 13 agent files in total: one primary agent plus twelve subagents.

Agent files are copied flat: the category directory is not preserved in the destination, so the agent id is the file name. `categories/01-core-development/core-developer.md` becomes `agents/core-developer.md`. Ids stay flat and predictable — names in the old single-specialist style, such as `python-pro`, become category-level names here, such as `core-developer`.

Nothing else is copied. The installer never touches files it did not create, and without `--force` it skips anything that already exists rather than overwriting it.

## The twelve subagents

| Agent id | Category | Remit |
|----------|----------|-------|
| `core-developer` | Core Development | Application code end to end: API contract, authentication, services, frontends, GraphQL, mobile, desktop and real-time transport. |
| `language-specialist` | Language Specialists | Language-specific implementation, idiom, tooling and ecosystem conventions across the framework landscape. |
| `infrastructure-engineer` | Infrastructure | Cloud architecture, Terraform, containers, Kubernetes, networking, CI/CD, observability, Windows infrastructure and PowerShell. |
| `quality-auditor` | Quality & Security | The lean general reviewer: correctness, architecture, test strategy, accessibility, interface testing and performance review. |
| `security-reviewer` | Quality & Security | Security audit, penetration testing, Active Directory posture, compliance and privacy, dependency and supply-chain audit. |
| `debugger` | Quality & Security | Bug reproduction and root-cause isolation, error and log analysis, test automation, flake control, resilience and chaos experiments. |
| `data-engineer` | Data & AI | Data platforms, pipelines, databases and query tuning, machine learning and model serving, NLP and reinforcement learning. |
| `developer-experience` | Developer Experience | Build tooling, CLIs, dependency management, documentation and developer ergonomics. |
| `domain-specialist` | Specialized Domains | Regulated and platform-shaped verticals: finance, payments, health, legal, embedded, IoT, blockchain, Microsoft 365, SEO and WordPress. |
| `product-strategist` | Business & Product | Requirements, roadmap, backlog, experiments, content and landing pages, licensing and product decisions. |
| `orchestration-lead` | Meta & Orchestration | Planning support, multi-domain coordination, agent installation, error recovery and the GitHub issue, pull request, CI and release workflow. |
| `research-analyst` | Research & Analysis | Investigation, comparison, evidence gathering and written analysis, plus cheap recon passes that return a structured summary of files seen, relevant paths and key findings. |

## The primary agent

`agentWIPPA` is the orchestrator. It never edits a file and never runs a command — both permissions are denied to it by design, so it cannot bypass the roster.

What it does instead: read the request and the repository, write the plan, dispatch each piece to the subagent that owns it, read what comes back, check the result against the acceptance criterion, and report the outcome. It holds the line that nothing is reported as done until a reviewer has seen the diff and the acceptance command has returned a zero exit code — the criterion is run through `wippa_verify`, so the verdict comes from the tool's exit code rather than from any agent's prose.

## How the orchestrator works

Four behaviours separate this setup from a plain roster of agents.

**Triage tiers.** Every request is classified before a plan is written, and the tier decides the chain. **Trivial** work — single-file, low-risk, no behavioural, auth, input, secret, dependency, CI or config impact — goes straight to the owning implementer with no audit pass. **Normal** work runs brief, delegate, audit, review. **High-risk** work — auth, input handling, secrets, dependencies, or anything touching CI or config in a breaking way — runs a cheap recon pass before anything is written, then a review that cannot be waived. Tiers escalate, never de-escalate, and the tier chosen is stated in the plan so the routing is auditable.

**Two-iteration reviewer cap.** The review loop — delegate, audit, revise — runs at most two iterations per piece of work. After the second iteration, if the reviewer still reports open findings, the orchestrator stops looping and escalates to you: what is still broken, what a fix would cost, and whether to accept, defer or fund another round. An open finding at report time is disclosed as an open finding, never hidden behind one more attempt.

**Plan ledger.** The plan lives on disk at `.opencode/PLAN.md` in the working directory, holding the agreed plan, the decisions made (including tier calls and tie-break routings), the work items in flight, the work items completed and the open risks — every item naming its owner subagent and its acceptance criterion. The orchestrator denies edit, so it delegates the file write with the exact content verbatim. The next session reads the ledger first, and where the ledger and the repository disagree, the repository is the truth. High-risk or structural changes are presented for approval before any code is written.

**Subagent return contract.** Every subagent returns the same fixed schema in its final message: files changed, commands run with their real exit codes, open risks, confidence with a statement of what would falsify it, and an optional acceptance status. The orchestrator reviews those fields rather than the prose around them, and a missing field is an incomplete report that goes back to the subagent instead of being filled in by the orchestrator.

## The three MCP servers

| Server | What it gives the agents |
|--------|---------------------------|
| `github` | Repositories, pull requests, issues, actions and code security through the GitHub API. |
| `context7` | Version-matched documentation for libraries and frameworks, so guidance matches the version in the lockfile. |
| `playwright` | Browser automation: navigate, interact and read the rendered page. |

The GitHub server expects `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment. The Playwright server runs locally through `npx`.

## The tools

The bundled plugin adds five tools: four for finding and reading the roster, and one for checking work.

| Tool | Question it answers |
|------|---------------------|
| `wippa_subagent_search` | Which agents match this task, by name, by category or by a word from their description. |
| `wippa_subagent_get` | What exactly does one agent do: full definition, prompt and permissions. |
| `wippa_subagent_list` | What is available at all, organised by category. |
| `wippa_subagent_invalid` | Is the cached catalog stale? Clears the cache so the next read is fresh. |
| `wippa_verify` | Did the acceptance command pass? Runs it and returns the real exit code with the stdout and stderr, so a pass/fail verdict never rests on prose. |

The `wippa-subagent-search` skill documents the four roster tools, explains which one to reach for, and gives the equivalent procedure using `read`, `glob` and `grep` when the plugin is not connected.

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

The skill and the tools plugin need no configuration entry. They are installed into `<scope>/skills/` and `<scope>/plugins/`, and both of those directories are auto-discovery locations in OpenCode V2, so the two are picked up automatically.

Restart OpenCode after changing the config so the new roster is picked up.

## License

MIT. See `LICENSE`.
