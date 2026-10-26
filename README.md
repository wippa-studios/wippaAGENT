<div align="center">

<img src="brand-assets/wippaAGENT-logo.png" alt="wippaAGENT logo" width="160" />

# wippaAGENT

### The only OpenCode setup you'll need.

One orchestrator. Twelve specialists. Three MCP servers.<br/>
Install once, point the config at the orchestrator, and every project gets the same roster, the same routing and the same review discipline.

<br/>

[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge)](LICENSE)
[![Built for OpenCode](https://img.shields.io/badge/built%20for-OpenCode-111827?style=for-the-badge)](https://opencode.ai)
[![Best of Agent Harnesses](https://img.shields.io/badge/%F0%9F%8F%86_Best_of-Agent_Harnesses-5ac4bf)](https://github.com/RyanAlberts/best-of-Agent-Harnesses)
![Agents](https://img.shields.io/badge/agents-13-6366f1?style=for-the-badge)
![MCP Servers](https://img.shields.io/badge/MCP%20servers-3-0ea5e9?style=for-the-badge)
![Tools](https://img.shields.io/badge/tools-5-f59e0b?style=for-the-badge)
[![CI](https://img.shields.io/github/actions/workflow/status/wippa-studios/wippaAGENT/ci.yml?style=for-the-badge&label=CI)](https://github.com/wippa-studios/wippaAGENT/actions/workflows/ci.yml)

[**Quick Start**](#quick-start) &nbsp;·&nbsp;
[**Architecture**](#architecture) &nbsp;·&nbsp;
[**The Roster**](#the-twelve-subagents) &nbsp;·&nbsp;
[**Orchestrator**](#how-the-orchestrator-works) &nbsp;·&nbsp;
[**Tools**](#the-tools) &nbsp;·&nbsp;
[**Configuration**](#configuration)

</div>

<br/>

## At a glance

<table>
  <tr>
    <td align="center" width="25%"><h2>1</h2><b>Primary agent</b><br/><sub>Plans, delegates, verifies</sub></td>
    <td align="center" width="25%"><h2>12</h2><b>Subagents</b><br/><sub>Implementation and review</sub></td>
    <td align="center" width="25%"><h2>3</h2><b>MCP servers</b><br/><sub>GitHub, docs, browser</sub></td>
    <td align="center" width="25%"><h2>5</h2><b>Plugin tools</b><br/><sub>Roster lookup and verification</sub></td>
  </tr>
</table>

wippaAGENT is a complete OpenCode setup. One primary orchestrator reads the request, plans the work and delegates it. Twelve specialist subagents do the implementation and the review. Three MCP servers give those agents access to GitHub, library documentation and browser automation. A bundled plugin adds roster lookup and an acceptance verifier.

### Why teams use it

| | |
|---|---|
| **Predictable routing** | Every request is triaged into a tier, and the tier decides the chain. The choice is written into the plan, so routing is auditable. |
| **Orchestrator can't cut corners** | `agentWIPPA` has edit and shell denied by design. It plans, delegates and verifies; the one command it can trigger is the acceptance command, through the bounded `wippa_verify` tool. |
| **Verdicts from exit codes** | Nothing is reported as done until the acceptance command has returned a zero exit code, and on Normal or High-risk work a reviewer has also seen the diff. |
| **Plan survives the session** | The plan ledger lives on disk at `.opencode/PLAN.md`, and the next session reads it first. |
| **Structured reports** | Every subagent returns the same fixed schema, so the orchestrator reviews fields rather than prose. |

<br/>

## Quick Start

**1. Install**

```bash
git clone https://github.com/wippa-studios/wippaAGENT.git && cd wippaAGENT && ./install.sh
```

**2. Point OpenCode at the orchestrator**

```bash
./install.sh --apply-config
```

Or add it by hand to your `opencode.json`:

```json
{
  "default_agent": "agentWIPPA"
}
```

**3. Restart OpenCode**

That's it. Every project you open now has the full roster.

> [!TIP]
> Not sure what the installer will do? Run `./install.sh --dry-run` first. It prints every planned action and writes nothing.

<br/>

## Architecture

```mermaid
%% The ~~~ links at the end are layout-only and carry no meaning: they keep the roster
%% in two rows and the server row below it. Roster cards list the agent ids in a category.
flowchart TB
    U([You]) --> O["<b>agentWIPPA</b><br/>plans · delegates · verifies<br/><i>no edit · no shell</i>"]

    L[".opencode/PLAN.md<br/>plan ledger"]
    V{{"wippa_verify<br/>exit code = verdict"}}
    O --> L
    O --> V

    subgraph ROSTER["Twelve subagents · ten categories"]
        N1["Infrastructure<br/><sub>infrastructure-engineer</sub>"]
        N2["Developer Experience<br/><sub>developer-experience</sub>"]
        N3["Specialized Domains<br/><sub>domain-specialist</sub>"]
        N4["Business &amp; Product<br/><sub>product-strategist</sub>"]
        N5["Research &amp; Analysis<br/><sub>research-analyst</sub>"]
        T1["Core Development<br/><sub>core-developer</sub>"]
        T2["Language Specialists<br/><sub>language-specialist</sub>"]
        T3["Quality &amp; Security<br/><sub>quality-auditor<br/>security-reviewer<br/>debugger</sub>"]
        T4["Data &amp; AI<br/><sub>data-engineer</sub>"]
        T5["Meta &amp; Orchestration<br/><sub>orchestration-lead</sub>"]
    end

    subgraph MCP["MCP servers"]
        M1[["github"]]
        M2[["context7"]]
        M3[["playwright"]]
    end

    O ==>|delegates| ROSTER

    T5 -.-> M1
    T1 & T2 & T4 -.-> M2
    T1 -.-> M3
    T3 -.->|quality-auditor| M3

    %% layout only
    L ~~~ N1
    L ~~~ N2
    L ~~~ N3
    L ~~~ N4
    L ~~~ N5
    N1 ~~~ T1
    N2 ~~~ T2
    N3 ~~~ T3
    N4 ~~~ T4
    N5 ~~~ T5

    classDef primary stroke:#6366f1,stroke-width:3px
    classDef artefact stroke:#f59e0b,stroke-width:2px
    classDef server stroke:#0ea5e9,stroke-width:2px
    class O primary
    class L,V artefact
    class M1,M2,M3 server
```

*Solid: delegation. Dashed: tool access — labelled where a category holds more than one agent.*

<br/>

## Install

The installer writes into one of two scopes.

<table>
<tr>
<td width="50%" valign="top">

**Global**<br/>
Every project on this machine.<br/>
Files land in `~/.config/opencode/`, or in `$OPENCODE_CONFIG_DIR` when that variable is set.

```bash
./install.sh --global
```

</td>
<td width="50%" valign="top">

**Project-local**<br/>
A single project.<br/>
Files land in `<project>/.opencode/`.

```bash
./install.sh --project /path/to/your/project
```

</td>
</tr>
</table>

With no directory argument, `--project` uses the current directory:

```bash
./install.sh --project
```

> [!NOTE]
> The project directory must already exist. The installer creates `.opencode/` inside it, but it does not create the project itself.

### Installer flags

Every flag is non-interactive, so the installer runs unattended in a script or a CI job.

| Flag | Effect |
|------|--------|
| `--global` | Install into `~/.config/opencode/`, or into `$OPENCODE_CONFIG_DIR` when that variable is set. This is the default. |
| `--project [DIR]` | Install into `<DIR>/.opencode/`. `DIR` defaults to the current directory. |
| `--dry-run` | Print every planned action and write nothing. |
| `--force` | Overwrite files that already exist. |
| `--uninstall` | Remove the agent files, the skill and the plugin when they still match the installed copy. Files you changed and the config file are left alone. |
| `--apply-config` | Merge the required keys into the target `opencode.json` without disturbing values you already set. |
| `--help` | Print the usage text. |

### Requirements

- `bash` and the usual POSIX utilities (`cat`, `cp`, `ls`, `mkdir`, `printf`, `rm`, `rmdir`)
- Node, **only** when you pass `--apply-config`
- The installer runs from any working directory, and refuses to run if the agent definitions are missing from the checkout it was started from

### What gets installed

| What | From | To |
|------|------|-----|
| Primary agent and twelve subagents | `agentWIPPA.md` and `categories/*/*.md` | `<scope>/agents/` |
| Subagent search skill | `skills/wippa-subagent-search/` | `<scope>/skills/wippa-subagent-search/` |
| Tools plugin | `tools/` | `<scope>/plugins/wippa-subagent/` |

`<scope>` is `~/.config/opencode/` for a global install and `<project>/.opencode/` for a project-local install. That is **13 agent files** in total: one primary agent plus twelve subagents.

Agent files are copied flat. The category directory is not preserved in the destination, so the agent id is the file name: `categories/01-core-development/core-developer.md` becomes `agents/core-developer.md`. Ids stay flat and predictable. Names in the old single-specialist style, such as `python-pro`, become category-level names here, such as `core-developer`.

> [!IMPORTANT]
> Outside the paths it installs to, the installer never touches files it did not create, and without `--force` it skips anything that already exists rather than overwriting it.

<details>
<summary><b>Running OpenCode against this repository</b></summary>

<br/>

The `opencode.json` in this repository configures the checkout itself; it is not the key set the installer writes. `agentWIPPA.md` sits at the repository root, where OpenCode's agent discovery does not look, so a bare `opencode` run in a fresh clone finds no `agentWIPPA` and falls back to the default agent.

To use the repository as a live OpenCode project, install it into the checkout:

```bash
./install.sh --project .
```

That creates `.opencode/` holding the agents, the skill and the tools plugin. With `--apply-config`, it also merges the required configuration keys into `.opencode/opencode.json`. `.opencode/` is gitignored, so a local install never pollutes the repository. One caveat: a project install flattens the agent files into `.opencode/agents/`, and the plugin's roster lookups prefer that installed copy over the live `categories/` tree, so while the install is present, edits to `categories/*.md` do not show up in `wippa_subagent_*` results until you re-run the install with `--force` or remove the installed copy.

</details>

<br/>

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

<br/>

## The primary agent

**`agentWIPPA`** is the orchestrator. It never edits a file and holds no shell of its own; the one command it can trigger is the acceptance command, through the bounded `wippa_verify` tool. Both permissions are denied to it by design, so it cannot bypass the roster.

What it does instead:

1. **Reads** the request and the repository
2. **Plans** the work and writes the plan
3. **Dispatches** each piece to the subagent that owns it
4. **Reviews** what comes back
5. **Checks** the result against the acceptance criterion
6. **Reports** the outcome

It holds one line: nothing is reported as done until the acceptance command has returned a zero exit code, and no Normal or High-risk work is reported done before a reviewer has seen the diff. The criterion is run through `wippa_verify`, so the verdict comes from the tool's exit code rather than from any agent's prose.

<br/>

## How the orchestrator works

Four behaviours separate this setup from a plain roster of agents.

### 1. Triage tiers

Every request is classified before a plan is written, and the tier decides the chain.

| Tier | Applies to | Chain |
|------|-----------|-------|
| **Trivial** | Single-file, low-risk work with no behavioural, auth, input, secret, dependency, CI or config impact | Straight to the owning implementer. No audit pass. |
| **Normal** | Everything in between | Brief → delegate → audit → review |
| **High-risk** | Auth, input handling, secrets, dependencies, or anything touching CI or config in a breaking way | Cheap recon pass before anything is written, then a review that cannot be waived |

Tiers escalate, never de-escalate, and the tier chosen is stated in the plan so the routing is auditable.

**One request, end to end**

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant O as agentWIPPA
    participant S as Owning subagent
    participant QA as quality-auditor
    participant V as wippa_verify

    U->>O: request
    Note over O: triage the tier and write the plan
    Note over O,QA: Normal chain: brief → delegate → audit → review
    O->>S: brief + acceptance criterion
    S-->>O: diff + structured report
    O->>QA: review the diff
    QA-->>O: verdict and findings
    O->>V: run the acceptance command
    V-->>O: exit code, stdout, stderr
    alt zero exit code, reviewer clean
        O-->>U: report the outcome
    else non-zero exit or open findings
        O-->>U: escalate
    end
```

### 2. Two-iteration reviewer cap

```mermaid
flowchart LR
    D["Delegate"] --> A{"Audit"}
    A -->|findings| R["Revise"]
    R -->|"iteration 2"| A
    A -->|clean| OK(["Report done"])
    A -->|"still open after<br/>iteration 2"| ESC(["Escalate to you"])
```

The review loop runs at most **two iterations** per piece of work. After the second iteration, if the reviewer still reports open findings, the orchestrator stops looping and escalates to you with three things: what is still broken, what a fix would cost, and whether to accept, defer or fund another round. An open finding at report time is disclosed as an open finding, never hidden behind one more attempt.

### 3. Plan ledger

The plan lives on disk at `.opencode/PLAN.md` in the working directory. It holds:

- The agreed plan
- The decisions made, including tier calls and tie-break routings
- The work items in flight
- The work items completed
- The open risks

Every item names its owner subagent and its acceptance criterion. The orchestrator denies edit, so it delegates the file write with the exact content verbatim. The next session reads the ledger first, and where the ledger and the repository disagree, **the repository is the truth**. High-risk or structural changes are presented for approval before any code is written.

### 4. Subagent return contract

Every subagent returns the same fixed schema in its final message:

| Field | Contents |
|-------|----------|
| **Files changed** | What was touched |
| **Commands run** | Each command with its real exit code |
| **Open risks** | Anything unresolved |
| **Confidence** | A level, plus a statement of what would falsify it |
| **Acceptance status** | Optional |

The orchestrator reviews those fields rather than the prose around them. A missing field is an incomplete report that goes back to the subagent, never one the orchestrator fills in itself.

<br/>

## Trust model

Permissions are enforced by OpenCode rules, not by prompts. The orchestrator's edit and shell deny is enforced. The one deliberate exception is `wippa_verify`, which runs the command you give it, and it is behind its own permission action: the tool asserts `verify` with the command as the resource before it spawns anything, so the same rule list that governs `shell` governs it. The shipped frontmatter repeats the shell guards as `verify` rules, and the tool also refuses `rm -rf`, `sudo` and `git push --force` outright, so a host with no rules configured is not left without a guard. The call is bounded by a 5-minute default timeout and capped output. Treat an acceptance command as you would any shell command.

**Per-agent enforcement**

| Agent | edit | shell | verify | everything else |
|-------|------|-------|--------|-----------------|
| `agentWIPPA` | denied | denied | `rm -rf *`, `sudo *`, `git push --force *` denied | `subagent *` allowed |
| `core-developer`, `language-specialist`, `infrastructure-engineer`, `data-engineer`, `developer-experience`, `domain-specialist` | allowed | allowed | `rm -rf *` and `sudo *` denied | `rm -rf *` and `sudo *` denied |
| `quality-auditor` | allowed | allowed | `rm -rf *` and `sudo *` denied | `rm -rf *` and `sudo *` denied |
| `debugger` | allowed | allowed | `rm -rf *` and `sudo *` denied | `rm -rf *` and `sudo *` denied |
| `security-reviewer` | denied | allowed | `rm -rf *`, `sudo *` and `git push --force *` denied | `rm -rf *`, `sudo *` and `git push --force *` denied |
| `orchestration-lead` | allowed | allowed | `rm -rf *`, `git push --force *` and `npm install *` ask; `sudo *` denied | `rm -rf *`, `git push --force *` and `npm install *` ask; `sudo *` denied |
| `research-analyst`, `product-strategist` | allowed | deny all shell | deny all verify | no additional deny rules — read, web and MCP tools remain reachable |

No rule restricts MCP reach per agent: every agent can reach the `github`, `context7` and `playwright` servers, and the scope of the GitHub token is the boundary for the `github` server.

Subagents cannot start further subagents (`experimental.subagent_depth` is 1).

Routing — which agent owns what — and the "report only to me" line in every brief are prompt-level conventions, not permissions. The enforcement story is the table above plus the scope of `GITHUB_PERSONAL_ACCESS_TOKEN`: a fine-grained token is the real limit on what the `github` server can reach.

<br/>

## The three MCP servers

| Server | What it gives the agents |
|--------|---------------------------|
| **`github`** | Repositories, pull requests, issues, actions and code security through the GitHub API. |
| **`context7`** | Version-matched documentation for libraries and frameworks, so guidance matches the version in the lockfile. |
| **`playwright`** | Browser automation: navigate, interact and read the rendered page. |

The GitHub server expects `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment. The Playwright server runs locally through `npx`.

<br/>

## The tools

The bundled plugin adds five tools: four for finding and reading the roster, and one for checking work.

| Tool | Question it answers |
|------|---------------------|
| `wippa_subagent_search` | Which agents match this task, by name, by category or by a word from their description? |
| `wippa_subagent_get` | What exactly does one agent do? Full definition, prompt and permissions. |
| `wippa_subagent_list` | What is available at all, organised by category? |
| `wippa_subagent_invalid` | Is the cached catalog stale? Clears the cache so the next read is fresh. |
| `wippa_verify` | Did the acceptance command pass? Runs it in a shell with a timeout and capped output and returns the real exit code with stdout and stderr, so a pass/fail verdict never rests on prose. |

The `wippa-subagent-search` skill documents the four roster tools, explains which one to reach for, and gives the equivalent procedure using `read`, `glob` and `grep` when the plugin is not connected.

<br/>

## Configuration

The agent set is inert until `default_agent` points at the orchestrator. Add it to the config file for the scope you installed into.

| Scope | Config file |
|-------|-------------|
| Global | `~/.config/opencode/opencode.json`, or `$OPENCODE_CONFIG_DIR/opencode.json` when that variable is set |
| Project-local | `<project>/.opencode/opencode.json` |

```json
{
  "default_agent": "agentWIPPA"
}
```

The installer prints the full set of keys it expects before the summary, whether or not `--apply-config` is passed: `default_agent`, `agents.general`, `agents.explore`, `agents.build` and `mcp.servers`. Run it with `--apply-config` to merge those keys into the target config automatically. The merge is non-destructive: keys you already set are left alone and reported as kept.

<details>
<summary><b>What each key does</b></summary>

<br/>

| Key | Purpose |
|-----|---------|
| `default_agent` | Makes `agentWIPPA` the entry point for every session. |
| `agents.general` | Set to `disabled: true`. It is an OpenCode built-in, and this set supplies its own agents in its place. |
| `agents.explore` | Set to `disabled: true`, for the same reason. |
| `agents.build` | Demotes the built-in coding agent to a subagent and denies it the `subagent` action, so the orchestrator keeps control of the work and the build agent writes the code. |
| `mcp.servers` | Registers the `github`, `context7` and `playwright` servers. |
| `permissions`, `compaction`, `experimental.subagent_depth` | Checkout-only keys. They are set in the repository's own `opencode.json`: `permissions` allows `subagent` on `*`, `compaction` summarises long sessions, and `subagent_depth` is `1`, so a subagent cannot start another subagent. `--apply-config` does not merge them, so an installed scope uses OpenCode's documented defaults, which match. |

The skill and the tools plugin need no configuration entry. They are installed into `<scope>/skills/` and `<scope>/plugins/`, and both of those directories are auto-discovery locations in OpenCode V2, so the two are picked up automatically.

</details>

### Environment variables

`env.example` documents the variables the setup expects. Export them in the shell before starting OpenCode.

| Variable | Used by |
|----------|---------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | The `github` MCP server |
| `WIPPA_AGENT_REGISTRY` | See `env.example` |
| `WIPPA_AGENT_DIR` | See `env.example` |
| `WIPPA_CUSTOM_AGENT_IDS` | Comma-separated agent ids expected to live in the user's own global configuration; exempt from roster drift reporting. Used by the tools plugin. |

> [!WARNING]
> `opencode debug config` resolves and prints the value of `GITHUB_PERSONAL_ACCESS_TOKEN` in clear text. Treat that output as a secret, and do not paste it into an issue or a chat.

Restart OpenCode after changing the config so the new roster is picked up.

<br/>

## License

Released under the **MIT License**. See [`LICENSE`](LICENSE) for details.

<br/>

<div align="center">

**wippaAGENT** &nbsp;·&nbsp; built by [wippa-studios](https://github.com/wippa-studios)

<sub>One setup. Every project. Same discipline.</sub>

</div>
