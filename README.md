<div align="center">

<!-- wordmark:start - generated from the install.sh banner by npm run wordmark -->
<pre role="img" aria-label="wippaAGENT">
██╗    ██╗██╗██████╗ ██████╗  █████╗        
██║    ██║██║██╔══██╗██╔══██╗██╔══██╗       
██║ █╗ ██║██║██████╔╝██████╔╝███████║       
██║███╗██║██║██╔═══╝ ██╔═══╝ ██╔══██║       
╚███╔███╔╝██║██║     ██║     ██║  ██║       
 ╚══╝╚══╝ ╚═╝╚═╝     ╚═╝     ╚═╝  ╚═╝       
                                            
 █████╗  ██████╗ ███████╗███╗   ██╗████████╗
██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
</pre>
<!-- wordmark:end -->

### The only OpenCode setup you'll need.

**One orchestrator that writes nothing but the plan. Twelve specialists that write the rest.<br/>
Exit codes, not opinions, decide when the work is done.**

Install once, point the config at the orchestrator, and every project gets the same roster,<br/>
the same routing and the same review discipline.

<br/>

[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge)](LICENSE)
[![Built for OpenCode](https://img.shields.io/badge/built%20for-OpenCode-111827?style=for-the-badge)](https://opencode.ai)
[![CI](https://img.shields.io/github/actions/workflow/status/wippa-studios/wippaAGENT/ci.yml?style=for-the-badge&label=CI)](https://github.com/wippa-studios/wippaAGENT/actions/workflows/ci.yml)
![Agents](https://img.shields.io/badge/agents-13-6366f1?style=for-the-badge)
![MCP Servers](https://img.shields.io/badge/MCP%20servers-3-0ea5e9?style=for-the-badge)
![Tools](https://img.shields.io/badge/tools-8-f59e0b?style=for-the-badge)

[![Best of Agent Harnesses](https://img.shields.io/badge/%F0%9F%8F%86_Best_of-Agent_Harnesses-5ac4bf)](https://github.com/RyanAlberts/best-of-Agent-Harnesses)
[![Listed on awesome-software-factories](https://img.shields.io/badge/listed%20on-awesome--software--factories-blue)](https://github.com/varun1505/awesome-software-factories)

[**Quick start**](#quick-start) &nbsp;·&nbsp;
[**Why**](#why-wippaagent) &nbsp;·&nbsp;
[**How it works**](#how-it-works) &nbsp;·&nbsp;
[**The roster**](#the-roster) &nbsp;·&nbsp;
[**Trust model**](#trust-model) &nbsp;·&nbsp;
[**Tools**](#tools-and-mcp-servers) &nbsp;·&nbsp;
[**Configuration**](#configuration) &nbsp;·&nbsp;
[**Troubleshooting**](#troubleshooting)

</div>

<br/>

## At a glance

<table>
  <tr>
    <td align="center" width="25%"><h2>1</h2><b>Primary agent</b><br/><sub>Plans, delegates, verifies</sub></td>
    <td align="center" width="25%"><h2>12</h2><b>Subagents</b><br/><sub>Implementation and review</sub></td>
    <td align="center" width="25%"><h2>3</h2><b>MCP servers</b><br/><sub>GitHub, docs, browser</sub></td>
    <td align="center" width="25%"><h2>8</h2><b>Plugin tools</b><br/><sub>Roster lookup, session continuation, verification, diff reading and wippa_plan_update</sub></td>
  </tr>
</table>

wippaAGENT is a complete OpenCode setup. One primary orchestrator reads the request, plans the work and delegates it. Twelve specialist subagents do the implementation and the review. Three MCP servers give those agents access to GitHub, library documentation and browser automation. A bundled plugin adds roster lookup, subagent session continuation, an acceptance verifier, diff reading and the `wippa_plan_update` plan-ledger write.

<br/>

## Quick start

Three steps and about a minute. You need `bash` and [OpenCode](https://opencode.ai). Node is needed only for step 2's automatic config merge.

**1. Install**

```bash
git clone --depth 1 https://github.com/wippa-studios/wippaAGENT.git \
  && cd wippaAGENT \
  && ./install.sh
```

That is a clone, not a download piped into a shell: you get the whole working tree, and `install.sh` is a plain shell script you can read before it runs.

> [!TIP]
> Want to see exactly what the installer will do? Run `./install.sh --dry-run` first. It prints every planned action and writes nothing.

**2. Point OpenCode at the orchestrator**

```bash
./install.sh --apply-config
```

Or add it by hand to your `opencode.json`:

```json
{
  "default_agent": "wippaAGENT"
}
```

**3. Export a GitHub token, then restart OpenCode**

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=<your fine-grained token>
```

Use a fine-grained token scoped to one repository with only the Issues, Pull requests, Contents and Actions permissions. The token's scope is the real limit on what the `github` server can reach (see [Trust model](#trust-model)).

**That's it.** Every project you open now has the full roster. To confirm the install, call the `wippa_subagent_list` tool in a session: it returns the twelve subagents, organised by category.

<br/>

## Why wippaAGENT

Most agent loops let one model plan the change, write it, grade it and declare victory. wippaAGENT splits those jobs apart and puts a hard check at the end.

| | A typical single-agent loop | wippaAGENT |
|---|---|---|
| **Who decides it's done?** | The agent that wrote the code | The exit code of your acceptance command, run through `wippa_verify` |
| **Who can edit files?** | Whoever is running | Never the orchestrator, apart from the plan ledger. Edit and shell are denied to it by design; it writes no other file |
| **Who reviews the diff?** | Often nobody | On Normal and High-risk work, a reviewer sees the diff before anything is reported done |
| **What if review keeps failing?** | Loops until it gives up or burns budget | Stops after two iterations and escalates, with the cost of a fix and a decision for you |
| **What survives the session?** | Whatever the context window held | A plan ledger on disk at `.opencode/PLAN.md` |
| **What does a worker hand back?** | Prose | A fixed schema: files changed, commands with real exit codes, open risks, confidence |

### Design principles

1. **Separation of duties.** The agent that plans does not write the implementation, and the agent that reviews does not fix. The reviewers (`quality-auditor`, `security-reviewer`) are denied edit.
2. **Verdicts come from exit codes.** A pass is a zero exit code from a real command, never a model's say-so.
3. **Enforce in permissions, document the rest.** What OpenCode rules can enforce, they enforce. What is only a prompt convention is labelled as one. See the [Trust model](#trust-model).
4. **Auditable routing.** Every request is triaged into a tier, and the tier is written into the plan.
5. **Lean by contract.** The prompt corpus has a token budget enforced in CI, so the setup does not quietly bloat. See [Prompt budget](#prompt-budget).
6. **Additive installs.** The installer never touches files it did not create, and never overwrites without `--force`.

### What the eval scenarios cover

The table lists the eight scenarios on files at commit `332a726`. Scenario files carry no tier field; the table shows what each scenario defines. One `--check` pass parsed and validated each file without dispatching a model; report terms are parsed in this mode, not matched against a report. The Evidence column names the check each scenario defines, not an observed result. No live model dispatch has been recorded, no single-agent baseline has been run, and this is a single validation pass rather than a series, so it is coverage and format evidence, not a measured effect.

| Scenario | Chain | What it checks | Evidence |
|---|---|---|---|
| **01 Plain Bug Fix** | `core-developer` | Regression safety in a small bug fix | `npm test` (exit-code check) |
| **02 Security Review** | `security-reviewer` | Input-handling review finds no blocking findings | `npm test` (exit-code check) |
| **03 Research Lookup** | `research-analyst` | Current library documentation is found and cited | acceptance criteria only; no report terms |
| **04 Domain Playbook Load** | `domain-specialist` | Payment webhook idempotency and the named domain reference | report terms: `references/payment-processing-and-checkout.md`, `network retry cannot double-charge` |
| **05 Polyglot Pytest Runner** | `language-specialist` → `quality-auditor` | Python suite execution and review of type hints and error handling | report terms: `pytest`, `passed` |
| **06 Polyglot Go Test Runner** | `language-specialist` → `quality-auditor` | Go race detection and review of channel synchronization and context cancellation | report terms: `go test`, `PASS` |
| **07 High-Risk Auth Recon** | `research-analyst` → `core-developer` → `security-reviewer` | Timing-attack review of token comparison after recon | report terms: `constant-time`, `timing attack` |
| **08 Two-Iteration Escalation** | `core-developer` ⇄ `quality-auditor` (2x) | Two-iteration reviewer cap and escalation with open findings | report terms: `escalation`, `open findings` |

Scenarios 03 to 08 have no acceptance command, so in a live run their verdict is a report-term match (or, for 03, the acceptance criteria) and they do not exercise the exit-code guarantee. Scenarios 01 and 02 run this repository's own `npm test`, so they prove the command surface works, not the routed agent's behaviour.

### When it fits

The setup pays for itself when three things are true: a command can decide when the work is done, the change crosses more than one specialty, and a wrong change costs more than the extra model calls.

**Good fits**

- Polyglot repositories with real test commands: `pytest` for a Python service, `npm test` for a TypeScript frontend, `go test -race` for a Go service, `cargo test` and `cargo clippy` for a Rust CLI. The six runner allowlists and the language playbooks are built for this.
- Test-backed refactors and legacy modernisation, where the existing suite is the safety net and a change to the tests has to be visible to the reviewer.
- Security-sensitive work — authentication, payments, personal data, permission models — where the High-risk chain, the security review and the ledger trail are worth the overhead.
- Small-team pull-request work through the GitHub server: issues, review comments and CI status without giving the orchestrator a shell.
- Frontend work verified in a browser through the Playwright server, with the caveat that the acceptance command is still one of the allowed runners.
- Documentation-heavy repositories with a claims or test check, and teams standardising how several people use agents on one repository.

**Weak fits**

- One-file fixes and typos: a single agent with edit and a test command is cheaper; the Trivial tier exists, but the orchestration is overhead at that size.
- Exploratory research or design with no acceptance command: the exit-code guarantee does not apply, and the eval scenarios that report rather than execute say so.
- Infrastructure-as-code whose check is `terraform plan`, `kubectl diff`, `helm`, `ansible` or `docker`: those commands are outside the verify allowlist until you add them to `tools/guards.ts`.
- Work whose acceptance path needs package installs or cloud CLIs (`npm install`, `pip install`, `gh`): subagents can run them, but the orchestrator's verdict cannot.
- Latency- or cost-sensitive bulk edits, and interactive REPL debugging: the review loop costs more than the work.

The practical test is the first paragraph: if you can name the command that must exit 0 and the diff crosses more than one domain, it fits. If you cannot name the command, treat it as research and use the roster for expertise, not for the exit-code guarantee.

<br/>

## Architecture

```mermaid
%% The ~~~ links at the end are layout-only and carry no meaning: they keep the roster
%% in two rows and the server row below it. Roster cards list the agent ids in a category.
flowchart TB
    U([You]) --> O["<b>wippaAGENT</b><br/>plans · delegates · verifies<br/><i>no edit · no shell</i>"]

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

*Solid: delegation. Dashed: where the roster routes each server. The dashed lines are routing, not permissions: no rule restricts MCP reach per agent.*

<br/>

## How it works

`wippaAGENT` reads the request and the repository, plans the work, dispatches each piece to the subagent that owns it, reviews what comes back, checks the result against the acceptance criterion and reports the outcome. It holds one line:

> Nothing is reported as done until the acceptance command has returned a zero exit code, and no Normal or High-risk work is reported done before a reviewer has seen the diff.

**Narrowing broad specialists.** The twelve subagents are category-level shells. When dispatching a specialist, the orchestrator names its exact role framing (e.g. `FastAPI Specialist`, `Postgres Query Optimizer`) and the matching topic file from its playbooks table, or the `domain-playbooks` reference for `domain-specialist`. The subagent loads that single reference file, giving it deep, opinionated domain expertise without paying for 100+ always-on agent definitions.

Four behaviours separate this setup from a plain roster of agents.

### 1. Triage tiers

Every request is classified before a plan is written, and the tier decides the chain.

| Tier | Applies to | Chain |
|------|-----------|-------|
| **Trivial** | Single-file, low-risk work with no behavioural, auth, input, secret, dependency, CI or config impact | Straight to the owning implementer. No audit pass. |
| **Normal** | Everything in between | Brief → delegate → audit → review |
| **High-risk** | Auth, input handling, secrets, dependencies, or anything touching CI or config in a breaking way; any diff that touches the files the acceptance command runs (test files, `conftest.py`, `Makefile`, `package.json` scripts, runner configuration) | Cheap recon pass before anything is written, then a review that cannot be waived |

Tiers escalate, never de-escalate, and the tier chosen is stated in the plan so the routing is auditable. High-risk or structural changes are presented for your approval before any code is written.

*Illustrative examples:*

| Request | Likely tier | Why |
|---------|-------------|-----|
| Fix a typo in a code comment | Trivial | Single file, no behavioural impact |
| Add pagination to a list endpoint | Normal | Behavioural change, no sensitive surface |
| Add a login rate limiter, or bump a dependency | High-risk | Touches auth or the dependency tree |

### 2. One request, end to end

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant O as wippaAGENT
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

### 3. Two-iteration reviewer cap

```mermaid
flowchart LR
    D["Delegate"] --> A{"Audit"}
    A -->|findings| R["Revise"]
    R -->|"iteration 2"| A
    A -->|clean| OK(["Report done"])
    A -->|"still open after<br/>iteration 2"| ESC(["Escalate to you"])
```

The review loop runs at most **two iterations** per piece of work. After the second iteration, if the reviewer still reports open findings, the orchestrator stops looping and escalates to you with three things: what is still broken, what a fix would cost, and whether to accept, defer or fund another round. An open finding at report time is disclosed as an open finding, never hidden behind one more attempt.

### 4. Plan ledger and return contract

**The plan ledger** lives on disk at `.opencode/PLAN.md` in the working directory. It holds the agreed plan, the decisions made (including tier calls and tie-break routings), the work items in flight and completed, and the open risks. Every item names its owner subagent and its acceptance criterion.

The orchestrator calls `wippa_plan_update` with the full markdown for the ledger. The tool takes no path argument and writes `<workspace>/.opencode/PLAN.md` and nothing else; it refuses a symlink at that path or at the `.opencode` directory, dangling or not, or a hard link at that path, and asserts its own `plan_update` permission before it writes. The next session reads the ledger first, and where the ledger and the repository disagree, **the repository is the truth**.

**The return contract.** Every subagent returns the same fixed schema in its final message:

| Field | Contents |
|-------|----------|
| **Files changed** | What was touched |
| **Commands run** | Each command with its real exit code |
| **Open risks** | Anything unresolved |
| **Confidence** | A level, plus a statement of what would falsify it |
| **Acceptance status** | Optional |

The orchestrator reviews those fields rather than the prose around them. A missing field is an incomplete report that goes back to the subagent, never one the orchestrator fills in itself.

<br/>

## The roster

Twelve subagents across ten categories. The **Access** column is what OpenCode permissions allow, so you can see at a glance who can change files and who can only look.

| Agent id | Category | Access | Remit |
|----------|----------|--------|-------|
| `core-developer` | Core Development | edit · shell | Application code end to end: API contract, authentication, services, frontends, GraphQL, mobile, desktop and real-time transport. |
| `language-specialist` | Language Specialists | edit · shell | Language-specific implementation, idiom, tooling and ecosystem conventions across the framework landscape. |
| `infrastructure-engineer` | Infrastructure | edit · shell | Cloud architecture, Terraform, containers, Kubernetes, networking, CI/CD, observability, Windows infrastructure and PowerShell. |
| `quality-auditor` | Quality & Security | shell, **no edit** | The lean general reviewer: correctness, architecture, test strategy, accessibility, interface testing and performance review. |
| `security-reviewer` | Quality & Security | shell, **no edit** | Security audit, penetration testing, Active Directory posture, compliance and privacy, dependency and supply-chain audit. |
| `debugger` | Quality & Security | edit · shell | Bug reproduction and root-cause isolation, error and log analysis, test automation, flake control, resilience and chaos experiments. |
| `data-engineer` | Data & AI | edit · shell | Data platforms, pipelines, databases and query tuning, machine learning and model serving, NLP and reinforcement learning. |
| `developer-experience` | Developer Experience | edit · shell | Build tooling, CLIs, dependency management, documentation and developer ergonomics. |
| `domain-specialist` | Specialized Domains | edit · shell | Regulated and platform-shaped verticals: finance, payments, health, legal, embedded, IoT, blockchain, Microsoft 365, SEO and WordPress. |
| `product-strategist` | Business & Product | edit, **no shell** | Requirements, roadmap, backlog, experiments, content and landing pages, licensing and product decisions. |
| `orchestration-lead` | Meta & Orchestration | edit · shell (asks first on risky commands) | Planning support, multi-domain coordination, agent installation, error recovery and the GitHub issue, pull request, CI and release workflow. |
| `research-analyst` | Research & Analysis | edit, **no shell** | Investigation, comparison, evidence gathering and written analysis, plus cheap recon passes that return a structured summary of files seen, relevant paths and key findings. |

The primary agent, `wippaAGENT`, sits above all of them with **no edit and no shell**. That makes **13 agent files** in total.

<br/>

## Trust model

Permissions are enforced by OpenCode rules, not by prompts. This section is explicit about which guarantees are enforced and which are conventions.

| Guarantee | Mechanism | Strength |
|-----------|-----------|----------|
| The orchestrator cannot edit repository files or run a shell | `edit` and `shell` denied in its frontmatter | **Enforced** by OpenCode permissions |
| The orchestrator writes exactly one file | `wippa_plan_update` takes no path argument, writes only `<workspace>/.opencode/PLAN.md`, refuses a symlink at that path or at the `.opencode` directory (dangling or not), or a hard link at that path, and asserts the `plan_update` permission before it writes | **Enforced** |
| The only command the orchestrator can trigger is the acceptance command | `wippa_verify`, behind its own `verify` permission and a pre-spawn guard | **Enforced**, with a documented residual (below) |
| A modified test harness is not run without acknowledgement | `wippa_verify` reads the working diff before spawning; a changed test file, `conftest.py`, `Makefile`, `package.json` or runner configuration, including `.cargo/config.toml`, `Cargo.lock` and `go.mod`, returns `harness-modified` with the `harnessChanges` file list and runs only with `acknowledgeHarnessChanges: true`; a diff that cannot be read reports `harnessCheck: "skipped"` | **Enforced** (heuristic file match); treating a harness change as High-risk is a **Convention** |
| Reviewers cannot fix their own findings | `edit` denied for `quality-auditor` and `security-reviewer` | **Enforced** |
| Subagents cannot start further subagents | `experimental.subagent_depth` is `1` | **Enforced** (checkout config; installed scopes use OpenCode's documented default, which matches) |
| GitHub reach is narrow | `github` server registered with the `repos`, `issues`, `pull_requests` and `actions` toolsets only, plus the scope of your token | **Enforced** at registration; the token scope is the real limit |
| Routing: which agent owns what | Prompt text | **Convention** |
| Which playbook a specialist loads | The `## Playbooks` table in its agent definition, or the `domain-playbooks` index for `domain-specialist` | **Convention** |
| The "report only to me" line in every brief | Prompt text | **Convention** |

### How `wippa_verify` is guarded

`wippa_verify` runs the command you give it, so it is behind its own permission action: the tool asserts `verify` with the command as the resource before it spawns anything, and the same rule list that governs `shell` governs it. The shipped frontmatter repeats the shell guards as `verify` rules, so a host with no rules configured is still not left without a guard.

On top of that assertion sits a guard that runs before the permission check and before any spawn. It is an allowlist of the acceptance surface with a character policy on top. **It is not a sandbox.** The command allowlist, the per-runner flag allowlists and the character policy are defined in `tools/guards.ts`; a command that fails the guard never runs, and the reason is returned in the result.

The call runs asynchronously, stops when the call is cancelled, and is bounded by a 5-minute default timeout and capped output. A caller's `cwd` must resolve to a directory inside the workspace and must not contain `..` segments, line breaks or null bytes, or it is refused with a stated reason.

Before it spawns anything, `wippa_verify` reads the working diff and matches changed and added files against the runner's harness surface. If the test file, `conftest.py`, `Makefile`, `package.json` or runner configuration has been modified, it returns `reason: "harness-modified"` with the `harnessChanges` file list and does not run unless the caller passes `acknowledgeHarnessChanges: true`. If the diff cannot be read it runs and reports `harnessCheck: "skipped"`. Detection is a heuristic file match, not a sandbox, and the diff service decides which files it can see.

<details>
<summary><b>Character policy</b></summary>

<br/>

- Command substitution, expansion, redirection, pipes, statement separators, newlines and carriage returns are refused anywhere in the command string.
- Only `&&` chains are accepted. Any `&` that is not exactly `&&` (so `&&&` too) is refused.
- A segment beginning `NAME=` is refused as an environment-variable assignment prefix.
- A command word may not be a path. Only the exact string `./install.sh` may be run by path, so a planted `./file` cannot be executed.
- An unquoted backslash, or an unquoted glob metacharacter (`*`, `?`, `[`, `]`) or brace expansion, is refused: the shell would rewrite it into an argument the guard did not inspect. The same characters inside quotes are data and stay allowed.

</details>

<details>
<summary><b>Allowlist</b></summary>

<br/>

Every segment's command word must be on this list, or be exactly `./install.sh`, or the segment never runs.

The six test runners below (`pytest`, `go`, `cargo`, `make`, `node` and `python3`/`python`) accept only the flags named in their allowlist; any other flag is refused with the flag named in the reason.

| Command | What is allowed |
|---------|-----------------|
| `npm` | Only `test`, `run` and `ls`. The subcommand must come immediately after `npm`, and any option in that position fails closed, so `npm pkg set`, `npm config set` and `npm --yes exec` are refused. Options that select another shell or config are refused: `--script-shell`, `--shell`, `--prefix`, `--userconfig` and `--globalconfig`. |
| `pytest` | Test execution with positional paths and `-k` values (e.g. `pytest`, `pytest tests/`, `pytest -k unit`). `--pdb`, `--trace`, `-p`, `-c` and `-o` are refused. |
| `go` | Only `test` and `vet` subcommands (e.g. `go test -v ./...`, `go vet ./...`). Positional packages pass. `-exec`, `-toolexec` and `-vettool` are refused. |
| `cargo` | Only `test`, `check` and `clippy` subcommands (e.g. `cargo test`, `cargo check`, `cargo clippy`). `--config`, `-Z` and `--manifest-path` are refused. |
| `make` | Targets pass (e.g. `make`, `make test`, `make check`). `-C`, `-f`, `-I` and `-E` are refused. |
| `node` | Test runner and scripts (e.g. `node --test`, `node tests/runner.js`). Script paths pass. `-e`, `-p`, `-r`, `--import` and `--loader` are refused. |
| `python3` / `python` | Test modules and scripts (e.g. `python3 -m unittest`, `python3 -m pytest`, `python3 tests/run.py`). `-m` accepts only `unittest` and `pytest`, including the attached `-munittest` form. `-c` is refused. |
| `git` | Only `status`, `log`, `diff`, `show`, `blame`, `ls-remote`, `rev-parse`, `describe`, `grep`, `shortlog`, `fetch`, plus `branch` and `remote` in pure-listing form. |
| Read-only utilities | `grep`, `rg`, `cat`, `head`, `tail`, `wc`, `ls`, `test`, `echo`, `true`, `false`, `basename`, `dirname`, `realpath`, `pwd`, `sort`, `uniq`, `tr`, `cut`, `stat`, `sha256sum`, `which`, `date`. `sort` and `uniq` only under their read-only flag allowlist; `rg` without `--pre` and `--pre-glob`. |
| Inert utilities | `sleep`, `seq`, `exit` |
| Static checks | `bash -n <file>` (`-n` must be the first argument, every later word a file name) and `shellcheck` |
| Installer | `./install.sh`, only with `--dry-run` |

Everything else is denied because it is not on the list, including `npx`, `sh`, `sed`, `curl`, `gh`, `docker`, `awk`, `xargs`, `find` and `env`.

Nothing is inferred as read-only. `git worktree list`, `git submodule status`, `git stash list` and `git bisect log` are denied: the subcommand allowlist is explicit, so only the subcommands named above pass.

</details>

<details>
<summary><b>Fast-fail denials</b></summary>

<br/>

Each is refused with a reason.

- The `sudo` and `rm` families, network and archive tools, file mutators, `awk` and `xargs` are refused as words, flat and inside quotes.
- Interpreter-plus-eval-flag pairs such as `bash -c`, `python -c`, `node -e` and `sed -i` are refused.
- In a segment whose command word is `git`: global options (`-c`, `-C`, `--git-dir`, `--work-tree`, `--exec-path`, `--paginate`, `--no-pager`) are refused in both `--flag` and `--flag=value` form; any option before the git subcommand fails closed; the exec-channel options `--upload-pack`, `--open-files-in-pager`, `--ext-diff` and `--textconv` are refused anywhere in the segment; and any argument containing `::` (transport syntax such as `ext::cmd`) is refused.
- `git fetch` refuses a `+` refspec.
- `git show`, `git diff`, `git log` and `git archive` refuse `--output`.
- `sort` and `uniq` refuse every option outside their read-only flag allowlist, so `sort -o` writes nothing and `sort --compress-program=…` runs nothing.
- `rg` refuses `--pre` and `--pre-glob`.
- `install.sh` runs only with `--dry-run`, and only as the command itself. `cat install.sh` reads it as data.

</details>

> [!IMPORTANT]
> **Documented residual.** The acceptance commands execute whatever the project's test files, `conftest.py`, `Makefile`, `package.json`, runner configuration (including `.cargo/config.toml`, `Cargo.lock` and `go.mod`) and scripts contain; the guard inspects the command line, not the code that command runs. Each runner is a fail-closed flag allowlist, so an option outside its list is refused rather than passed through, and the character policy and command allowlist still apply. A further residual is the harness itself: `wippa_verify` lists the harness files when the working diff touches them and refuses to run until the caller acknowledges the change. Treat a harness change as High-risk work. An allowed command still runs with the authority of the user running OpenCode.

> [!NOTE]
> **What the harness check does not see.** The check compares the file names in the working diff against what the command runs, so it cannot see a path named on the command line that lives outside the repository, a harness committed before the working diff, an included makefile without a `.mk` suffix, or a custom unittest `-p` pattern. It is a policy gate, not a sandbox.

### How `wippa_diff` is guarded

`wippa_diff` validates its `base` before it reaches git. Absolute paths, `..` traversal, option-like prefixes and shell-significant characters are refused with a stated error rather than passed through, so the diff tool cannot be used to aim git at an arbitrary path.

### Per-agent enforcement

| Agent | edit | shell | verify | everything else |
|-------|------|-------|--------|-----------------|
| `wippaAGENT` | denied | denied | `rm -rf *`, `sudo *`, `git push --force *` denied | `subagent *` and `subagent_continue *` allowed |
| `core-developer`, `language-specialist`, `infrastructure-engineer`, `data-engineer`, `developer-experience`, `domain-specialist` | allowed | allowed | `rm -rf *` and `sudo *` denied | `rm -rf *` and `sudo *` denied |
| `quality-auditor` | denied | allowed | `rm -rf *` and `sudo *` denied | `rm -rf *` and `sudo *` denied |
| `debugger` | allowed | allowed | `rm -rf *` and `sudo *` denied | `rm -rf *` and `sudo *` denied |
| `security-reviewer` | denied | allowed | `rm -rf *`, `sudo *` and `git push --force *` denied | `rm -rf *`, `sudo *` and `git push --force *` denied |
| `orchestration-lead` | allowed | allowed | `rm -rf *`, `git push --force *` and `npm install *` ask; `sudo *` denied | `rm -rf *`, `git push --force *` and `npm install *` ask; `sudo *` denied |
| `research-analyst`, `product-strategist` | allowed | deny all shell | deny all verify | no additional deny rules; read, web and MCP tools remain reachable |

`wippaAGENT` alone declares both `plan_update` and `subagent_continue`; the subagents declare neither.

### MCP reach

No rule restricts MCP reach per agent: every agent can reach the `github`, `context7` and `playwright` servers. Two boundaries stand in instead:

1. The `github` server is registered with the `repos`, `issues`, `pull_requests` and `actions` toolsets only. That covers the repositories, issues and pull requests, review comments, CI status and releases the roster routes through `orchestration-lead`, so toolsets this workflow never uses are not even registered.
2. The scope of `GITHUB_PERSONAL_ACCESS_TOKEN` is the real limit on what the `github` server can reach. Use a fine-grained token scoped to one repository, carrying only the Issues, Pull requests, Contents and Actions permissions.

<br/>

## Tools and MCP servers

### The eight plugin tools

The bundled plugin adds eight tools: four for finding and reading the roster, one for continuing the latest session of a named subagent, one for checking work, one for reading a diff, and one for updating the session plan ledger.

| Tool | Question it answers |
|------|---------------------|
| `wippa_subagent_search` | Which agents match this task, by name, by category or by a word from their description? |
| `wippa_subagent_get` | What exactly does one agent do? Full definition, prompt and permissions. |
| `wippa_subagent_list` | What is available at all, organised by category? |
| `wippa_subagent_invalid` | Is the cached catalog stale? Clears the cache so the next read is fresh. |
| `wippa_subagent_continue` | How do I resume the work of a subagent without naming a session? Continues the newest child session of the named subagent under the current session: it takes no session id, parent id or path, asserts the `subagent_continue` permission before listing anything, and returns the session id as output only. |
| `wippa_verify` | Did the acceptance command pass? Runs it asynchronously with a timeout, capped output and cancellation, and returns the real exit code with stdout, stderr and how long it ran, so a pass/fail verdict never rests on prose. Runs `npm test/run`, `pytest`, `go test/vet`, `cargo test/check/clippy`, `make`, `node --test` and scripts, and `python3 -m unittest` or `python3 -m pytest`. Each runner accepts only its allowlisted flags, and a modified harness is refused until the caller acknowledges it. Commands outside the [guard](#how-wippa_verify-is-guarded) never run. |
| `wippa_diff` | What changed? Returns the working, branch or committed diff as structured per-file entries (patch, additions, deletions, status), so the orchestrator can read the diff itself without a shell. |
| `wippa_plan_update` | How to record decisions and progress without child agent hops? Writes exactly `<workspace>/.opencode/PLAN.md`: it takes no path argument and writes no other file, refuses a symlink at that path or at the `.opencode` directory (dangling or not), or a hard link at that path, and asserts the `plan_update` permission before the write. |

**What the catalog contains.** The catalog is the roster: the twelve agents this bundle ships, plus any id listed in `WIPPA_CUSTOM_AGENT_IDS`. From the global agent directory, where every project's agents live together, only those ids are indexed, so an unrelated agent installed for another project does not appear in a search or inflate a list. A project directory, a `WIPPA_AGENT_DIR` override and the bundle's own tree are indexed in full.

The `wippa-subagent-search` skill documents the four roster tools, explains which one to reach for, and gives the equivalent procedure using `read`, `glob` and `grep` when the plugin is not connected.

### The three MCP servers

| Server | What it gives the agents |
|--------|---------------------------|
| **`github`** | Repositories, pull requests, issues, actions and code security through the GitHub API. Expects `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment. |
| **`context7`** | Version-matched documentation for libraries and frameworks, so guidance matches the version in the lockfile. |
| **`playwright`** | Browser automation: navigate, interact and read the rendered page. Runs locally through `npx`. |

<br/>

## Install reference

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

### Flags

Every flag is non-interactive, so the installer runs unattended in a script or a CI job.

| Flag | Effect |
|------|--------|
| `--global` | Install into `~/.config/opencode/`, or into `$OPENCODE_CONFIG_DIR` when that variable is set. This is the default. |
| `--project [DIR]` | Install into `<DIR>/.opencode/`. `DIR` defaults to the current directory. The `--project=DIR` form is also accepted. |
| `--dry-run` | Print every planned action and write nothing. |
| `--force` | Overwrite files that already exist. |
| `--uninstall` | Remove the agent files, the skills and the plugin when they still match the installed copy. Files you changed and the config file are left alone. |
| `--apply-config` | Add the required keys the target `opencode.json` is missing and leave the ones you already set alone, except an `agents.build` entry in the demoted shape this installer used to write, which is migrated to `disabled: true` with your other keys kept. JSONC comments and trailing commas are accepted, and the config is validated before anything is copied. |
| `-h`, `--help` | Print the usage text. |

### Requirements

- `bash` and the usual POSIX utilities (`cat`, `cmp`, `cp`, `id`, `ls`, `mkdir`, `printf`, `rm`, `rmdir`)
- `tput` is optional: the installer uses it only to read the terminal width, and falls back to 80 columns when it is unavailable
- Node, **only** when you pass `--apply-config`
- The installer runs from any working directory, and refuses to run if the agent definitions are missing from the checkout it was started from

### What gets installed

| What | From | To |
|------|------|-----|
| Primary agent and twelve subagents | `wippaAGENT.md` and `categories/*/*.md` | `<scope>/agents/` |
| Skills (all of `skills/`, currently seven) | `skills/*/` | `<scope>/skills/*/` |
| Tools plugin | `tools/` | `<scope>/plugins/wippa-subagent/` |

`<scope>` is `~/.config/opencode/` for a global install and `<project>/.opencode/` for a project-local install.

Agent files are copied flat. The category directory is not preserved in the destination, so the agent id is the file name: `categories/01-core-development/core-developer.md` becomes `agents/core-developer.md`. Ids stay flat and predictable. Names in the old single-specialist style, such as `python-pro`, become category-level names here, such as `core-developer`.

> [!IMPORTANT]
> Outside the paths it installs to, the installer never touches files it did not create, and without `--force` it skips anything that already exists rather than overwriting it.

### Updating

Pull the latest checkout and re-run the installer with `--force`. Without `--force` the installer skips files that already exist, so an update would not change them. `--force` overwrites, so move aside any agent file you have edited locally before you run it.

```bash
git pull && ./install.sh --force
```

### Uninstalling

```bash
./install.sh --uninstall
```

This removes the agent files, the skills and the plugin when they still match the installed copy. Files you changed and the config file are left alone, so remove the `default_agent` entry from your `opencode.json` yourself.

<details>
<summary><b>Running OpenCode against this repository</b></summary>

<br/>

The `opencode.json` in this repository configures the checkout itself; it is not the key set the installer writes. `wippaAGENT.md` sits at the repository root, where OpenCode's agent discovery does not look, so a bare `opencode` run in a fresh clone finds no `wippaAGENT` and falls back to the default agent.

To use the repository as a live OpenCode project, install it into the checkout:

```bash
./install.sh --project .
```

That creates `.opencode/` holding the agents, the skills and the tools plugin. With `--apply-config`, it also merges the required configuration keys into `.opencode/opencode.json`. `.opencode/` is gitignored, so a local install never pollutes the repository.

Load the plugin in one scope only: the global install and a project `plugins` entry both register the same tools, and OpenCode reports one of them as failed. This checkout no longer lists `plugins`; use the global install or a project install, not both.

One caveat: a project install flattens the agent files into `.opencode/agents/`, and the plugin's roster lookups prefer that installed copy over the live `categories/` tree. While the install is present, edits to `categories/*.md` do not show up in `wippa_subagent_*` results until you re-run the install with `--force` or remove the installed copy.

</details>

<br/>

## Configuration

The agent set is inert until `default_agent` points at the orchestrator. Add it to the config file for the scope you installed into.

| Scope | Config file |
|-------|-------------|
| Global | `~/.config/opencode/opencode.json`, or `$OPENCODE_CONFIG_DIR/opencode.json` when that variable is set |
| Project-local | `<project>/.opencode/opencode.json` |

```json
{
  "default_agent": "wippaAGENT"
}
```

The installer prints the full set of keys it expects before the summary, whether or not `--apply-config` is passed: `default_agent`, `agents.general`, `agents.explore`, `agents.build` and `mcp.servers`. Run it with `--apply-config` to merge those keys into the target config automatically.

**What `--apply-config` guarantees**

- Every key you already set is left alone and reported as kept.
- The one exception is an `agents.build` entry that still carries the demotion this installer used to write (`mode: "subagent"` plus a deny entry for `subagent` on `*`). It is migrated in place: `mode` and `permissions` are removed, `disabled: true` is set, and every other key you added is kept. An entry of any other shape, including a hand-edited one that also demotes the built-in, is preserved untouched.
- The target may be JSON or JSONC (comments and trailing commas are accepted), and it is validated before the first file is copied, so a config that cannot be parsed leaves nothing half-installed.
- When a key has to be added, the file is rewritten as plain JSON, so comments are not preserved in that case. When every key is already present, the file is left byte-identical.

<details>
<summary><b>What each key does</b></summary>

<br/>

| Key | Purpose |
|-----|---------|
| `default_agent` | Makes `wippaAGENT` the entry point for every session. |
| `agents.general` | Set to `disabled: true`. It is an OpenCode built-in, and this set supplies its own agents in its place. |
| `agents.explore` | Set to `disabled: true`, for the same reason. |
| `agents.build` | Set to `disabled: true`. It is an OpenCode built-in coding agent, and this set supplies its own implementers in its place, so no second implementer appears in the roster. |
| `mcp.servers` | Registers the `github`, `context7` and `playwright` servers. |
| `permissions`, `compaction`, `experimental.subagent_depth` | Checkout-only keys, set in the repository's own `opencode.json`: `permissions` allows `subagent` on `*`, `compaction` summarises long sessions, and `subagent_depth` is `1`, so a subagent cannot start another subagent. `--apply-config` does not merge them, so an installed scope uses OpenCode's documented defaults, which match. |

The skills and the tools plugin need no configuration entry. They are installed into `<scope>/skills/` and `<scope>/plugins/`, and both of those directories are auto-discovery locations in OpenCode V2, so the two are picked up automatically.

</details>

### Environment variables

`env.example` documents the variables the setup expects. Export them in the shell before starting OpenCode.

| Variable | Used by |
|----------|---------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | The `github` MCP server |
| `WIPPA_AGENT_REGISTRY` | See `env.example` |
| `WIPPA_AGENT_DIR` | The tools plugin. Overrides the agent directory it reads; indexed in full. See `env.example` |
| `WIPPA_CUSTOM_AGENT_IDS` | Comma-separated agent ids expected to live in the user's own global configuration. They are indexed alongside the roster and are exempt from roster drift reporting. Used by the tools plugin. |
| `WIPPA_BANNER` | The installer only. `on` forces the wordmark, `off` suppresses it; unset, it prints only on a UTF-8 terminal wide enough for the art. It has no effect on OpenCode. |

Restart OpenCode after changing the config so the new roster is picked up.

> [!WARNING]
> `opencode debug config` lists every configuration source the session loads. On the CLI versions checked here (v2.2.0 and v2.2.2) MCP server headers are redacted as `***`, but the rest of the resolved configuration prints in full. Treat the output as sensitive, and do not paste it into an issue or a chat.

<br/>

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| OpenCode starts with its default agent, not `wippaAGENT` | `default_agent` is not set, or OpenCode was not restarted | Run `./install.sh --apply-config` (or add the key by hand) and restart OpenCode |
| A fresh clone of this repo finds no `wippaAGENT` | `wippaAGENT.md` sits at the repo root, where agent discovery does not look | Run `./install.sh --project .` inside the checkout |
| The installer reports files as skipped | They already exist, and the installer never overwrites without `--force` | Re-run with `--force` (it overwrites, so back up local edits first) |
| Edits to `categories/*.md` don't appear in `wippa_subagent_*` results | A project install is preferred over the live `categories/` tree | Re-run the install with `--force`, or remove the installed copy |
| Roster lookups look out of date | The catalog is cached | Call `wippa_subagent_invalid`, then read again |
| `wippa_verify` refuses a command | The guard blocked it (pipe, redirection, separator, a command outside the allowlist, and so on) | Read the reason in the result. For anything compound, put the logic in a `package.json` script and run `npm run <script>` |
| The `github` server fails to start or authenticate | `GITHUB_PERSONAL_ACCESS_TOKEN` is missing, or was exported after OpenCode started | Export it in the shell, then restart OpenCode |
| `--apply-config` stops before copying anything | The target config could not be parsed as JSON or JSONC | Fix the syntax. Nothing was installed, by design |
| No wordmark appears during install | The terminal is not UTF-8 or is too narrow | Set `WIPPA_BANNER=on` to force it |

<br/>

## FAQ

**Why can't the orchestrator just make a small edit itself?**
By design, with one exception: it writes the plan ledger through `wippa_plan_update`, and nothing else. Keeping edit and shell away from the agent that plans and judges is what makes its verdict trustworthy. Small, safe changes still skip the ceremony: the Trivial tier goes straight to the owning implementer with no audit pass.

**What happens when the reviewer and the implementer can't agree?**
After two review iterations, the orchestrator stops and escalates to you with what is still broken, what a fix would cost, and whether to accept, defer or fund another round.

**Can I add my own agents?**
Yes. List their ids in `WIPPA_CUSTOM_AGENT_IDS` and the tools plugin indexes them alongside the roster and exempts them from roster drift reporting.

**Will the installer change my existing config?**
Only if you pass `--apply-config`, and then only by adding keys you are missing. Keys you already set are kept, and when everything is already present the file is left byte-identical.

**Is `wippa_verify` a sandbox?**
No. It is a fail-closed command allowlist with a character policy, a permission check and a harness-diff gate. Once a command is allowed, the project's test files, `conftest.py`, a `Makefile` or an npm script decide what it runs. When the working diff touches those harness files, the tool lists them and refuses until the caller acknowledges the change. An allowed command still runs with your authority. See [How `wippa_verify` is guarded](#how-wippa_verify-is-guarded).

**Does it work in CI or scripts?**
The installer is fully non-interactive, so it runs unattended. Use `--dry-run` to preview and `--project DIR` to target a specific directory.

<br/>

## Under the hood

### Prompt budget

The prompt corpus (the primary agent plus the twelve subagents) is budgeted at **35,000 estimated tokens** (one token taken as four characters) and enforced by `npm run check:tokens` in CI.

| Budget | Ceiling | Why |
|--------|---------|-----|
| Prompt corpus (primary plus twelve subagents) | **35,000** estimated tokens | Keeps the whole setup lean |
| Largest single subagent definition | **3,000** estimated tokens | That prompt is paid on every turn of every dispatch; the primary agent is covered by the corpus total |
| Always-on skill listing | **1,250** estimated tokens | Skill bodies load only when called, but OpenCode advertises each skill's id, name and description at every model step |

`node scripts/token-count.mjs` prints both totals, counting each skill as the listing template emits it, markup included. Around the list OpenCode emits a fixed prologue and an `<available_skills>` wrapper, about **110 estimated tokens**, reported separately by the script. The full always-on skill surface today is about **1,181 estimated tokens**.

### OpenCode memory

The session database grows with conversation history. On this machine `opencode.db` measured **888 MB** when this section was written, while `snapshot/` was empty, so deleting snapshots alone does not reclaim the space. The log measured 27 MB and the WAL 14 MB.

`npm run opencode` launches the CLI through `scripts/opencode.sh`. The wrapper does not assume a V8 runtime: `WIPPA_OPENCODE_RUNTIME` accepts `auto` (the default), `node` or `bun`. With `node` it appends `--max-old-space-size=2048` to `NODE_OPTIONS` before `exec` unless a heap flag is already present, and `WIPPA_OPENCODE_HEAP_MB` changes the cap between 256 and 8192. With `bun` it leaves `NODE_OPTIONS` alone and prints one line saying the shipped Bun binary ignores the V8 flag; `WIPPA_OPENCODE_ADDRESS_SPACE_MB` opts into a hard `ulimit -v` address-space limit in MiB, and a low value can abort the process. `auto` reads the first line of the launcher for `node` or `bun`, and for an ELF binary treats a `Bun v` string as bun, defaulting to bun with a warning when the heuristic does not match. A leading `--wrapper-help` is consumed by the wrapper; `--help` and `-h` are passed through to OpenCode.

`npm run clean:opencode` runs `scripts/opencode-memory.sh`. It is a read-only report by default: the data directory, the database, WAL, log and snapshot sizes, and what `--apply` and `--vacuum` would do. A dry run works while OpenCode is running. `--apply` prunes the contents of `snapshot/` and rotates `log/opencode.log` to `log/opencode.log.1`, but refuses while an opencode process is running because that process holds the log descriptor and snapshots are revert points. `--vacuum` does both, then takes a consistent SQLite backup of the database with `.backup` to `opencode.db.bak-<YYYYmmddHHMMSS>.XXXXXX`, created exclusively with `mktemp` at mode 600, and runs `wal_checkpoint(TRUNCATE)` followed by `VACUUM`; it requires `--yes`. The process check asks `fuser` whether any process holds `opencode.db`; where `fuser` is unavailable it falls back to `pgrep -x opencode`, which matches only that exact process name and can miss a differently named launcher. An unreadable data path, such as a snapshot directory that cannot be listed, fails the report with a stated reason instead of printing zero.

The data directory is resolved from `OPENCODE_DATA_DIR`, then `$XDG_DATA_HOME/opencode`, then `~/.local/share/opencode` (`~/Library/Application Support/opencode` on macOS). Never delete `opencode.db` directly. The vacuum path prints the backup location, and the script never removes the database or a backup.

### Specialist playbooks

The specialist playbooks live under `skills/specialist-playbooks/references/<agent-id>/`, with one folder for each agent id that routes to the skill: **175 markdown files across 11 folders**. Eleven of the twelve subagent definitions carry a `## Playbooks` table naming their own files; `domain-specialist` routes to the `domain-playbooks` skill instead.

Reference bodies load on demand. They are outside the 35,000-token corpus and the 1,250-token listing budgets; in the agent file, only the `## Playbooks` section is paid for, and it counts against the 3,000-token per-agent ceiling and the 35,000-token corpus ceiling.

To add a playbook:

1. Create `skills/specialist-playbooks/references/<agent-id>/<topic>.md`, and make its first `#` heading exactly the topic text.
2. Add one row to that agent's `## Playbooks` table, with the topic in the first column and the file name in backticks in the second.
3. Run `npm test`. `scripts/playbooks.test.ts` checks the folders and the tables one to one, so a file without a row, a row without a file, or a heading that differs from its topic fails the suite.

The `domain-playbooks`, `powershell-automation-playbooks` and `reinforcement-learning-playbooks` skills follow the same pattern: a `SKILL.md` index, reference files under `references/`, and bodies that load on demand.

### Continuous integration

CI runs `npm ci`, the type check, the test suite, `check:claims`, `check:tokens`, the installer dry run and the eval validation. A smoke job also loads the installed tree on a pinned OpenCode binary without credentials.

A live dispatch of the eval scenarios through a model is the manual, secret-guarded `dispatch-eval` workflow. The scenario format and live mode are documented in `evals/README.md`.

### Contributing

Pull requests are welcome. Before opening one, run the checks CI runs: the type check and test suite from `package.json`, `npm run check:claims`, `npm run check:tokens` and `./install.sh --dry-run`. If you change the banner in `install.sh`, regenerate the wordmark above with `npm run wordmark`.

<br/>

## License

Released under the **MIT License**. See [`LICENSE`](LICENSE) for details.

<br/>

<div align="center">

**wippaAGENT** &nbsp;·&nbsp; built by [wippa-studios](https://github.com/wippa-studios)

<sub>One setup. Every project. Same discipline.</sub>

</div>
