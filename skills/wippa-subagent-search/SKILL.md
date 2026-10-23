---
name: wippaAGENT Subagent Search
description: Discover, inspect, and refresh wippaAGENT subagents. Use this skill whenever the user asks which agents exist, wants to find an agent by name or capability, asks "is there an agent for X", wants to see an agent's full definition or prompt, wants to browse agent categories, or suspects the agent list is stale. Also use it proactively before delegating a task, to check whether a specialised wippaAGENT subagent already fits the work, even if the user does not mention wippaAGENT or subagents explicitly.
---

# wippaAGENT Subagent Search

This skill lets you find and inspect wippaAGENT subagents so you can pick the right one for a task, explain what an agent does, or confirm it exists before delegating to it. It wraps the four roster tools. Each answers a different question, so choosing the right one keeps lookups fast and avoids pulling large definitions into context unnecessarily. If the tools are not connected in your session, the last section gives the equivalent procedure using read, glob, and grep.

## Tools

| Tool | Question it answers | Typical use |
|------|---------------------|-------------|
| `wippa_subagent_search` | "Which agents match this?" | Find agents by name, category or description |
| `wippa_subagent_get` | "What exactly does this agent do?" | Fetch the full definition of one agent |
| `wippa_subagent_list` | "What is available?" | Browse all categories |
| `wippa_subagent_invalid` | "Is my view out of date?" | Clear the cache and refresh |

## Choosing a tool

Start from what the user (or the task) already gives you:

- **A keyword, capability, or partial name** ("a code reviewer", "something for SQL") → `wippa_subagent_search`.
- **An exact agent name and a need for details** (its prompt, tools, configuration) → `wippa_subagent_get`.
- **No clue what exists, or a request to explore** ("what agents do we have?") → `wippa_subagent_list`.
- **Results that look wrong or outdated** (a known agent is missing, a definition seems old, the user says they just changed something) → `wippa_subagent_invalid`, then retry the original lookup.

## Workflow

### Finding an agent for a task

1. Run `wippa_subagent_search` with the key terms of the task. Try two or three short, distinct queries (for example the capability, then a synonym) rather than one long sentence, because matching runs against names, categories and descriptions.
2. Compare the candidates by their descriptions. If one clearly fits, move on. If several are plausible, or the description is too thin to decide, call `wippa_subagent_get` on the top one or two candidates.
3. If nothing fits, run `wippa_subagent_list` to check whether the capability lives under a category you did not search for, before concluding no suitable agent exists.

### Inspecting a specific agent

1. Call `wippa_subagent_get` with the agent's name.
2. If the name is not found, run `wippa_subagent_search` with that name to catch typos or renamed agents, and offer the closest matches.
3. Summarise the definition for the user rather than pasting it wholesale, unless they ask for the full text. Highlight purpose, when to use it, and any limitations or required inputs.

### Browsing

1. Call `wippa_subagent_list`.
2. Present categories first, with a brief note on what each contains. Drill into a category only if the user asks or the task points to one.

### Refreshing stale data

Results come from a cache that refreshes itself when the agent files change, so a recent addition or edit is picked up on the next lookup.

1. Call `wippa_subagent_invalid` to force a refresh. It clears the cache, rebuilds it from disk and reports the drift against the roster.
2. Re-run the lookup that prompted the refresh, and tell the user whether anything changed.

Only invalidate when there is a reason to suspect staleness. Doing it on every lookup defeats the cache and slows things down.

## Reporting results

- Lead with the recommendation or answer, then the supporting detail.
- When recommending an agent, state its name, what it does in a sentence, and why it fits the task.
- When several agents fit, list at most three and say how they differ, so the user can choose quickly.
- If no agent fits, say so plainly and suggest handling the task directly or refining the search terms.
- Never invent agent names or capabilities. Only report what the tools
  returned, or what you read from disk.

## Handling problems

- **Empty search results:** broaden the query (drop qualifiers, try a synonym), then fall back to `wippa_subagent_list`.
- **Tool error or timeout:** retry once. If it fails again, tell the user and continue without the lookup rather than guessing.
- **Tool not available in this session:** use the read, glob, and grep procedure in *If the tools are not available* instead of giving up on the lookup.
- **Conflicting information** between a search description and the full definition: trust the full definition from `wippa_subagent_get`, and mention the discrepancy.

## Examples

**Finding by capability**
User: "Is there an agent that can review pull requests?"
Approach: `wippa_subagent_search` with "pull request review", then `wippa_subagent_get` on the best match to confirm it handles code review, then recommend it.

**Exploring**
User: "What kinds of agents do we have?"
Approach: `wippa_subagent_list`, then summarise the categories in a few lines.

**Stale result**
User: "I just added a new agent called data-cleaner but I can't see it."
Approach: `wippa_subagent_invalid`, then `wippa_subagent_search` for "data-cleaner" and confirm it now appears.

## If the tools are not available

The four roster tools above are the wired-up contract. If they are not available in your session — for example the plugin is not loaded — the same four operations map onto the read, glob, and grep permissions you already have:

- `wippa_subagent_search` — grep the agent directories for the query, matching filenames, category directories and the `description:` frontmatter.
- `wippa_subagent_get` — read the matching agent file and summarise it per *Reporting results*; return it verbatim only when asked.
- `wippa_subagent_list` — read the `## Your roster` section of the `agentWIPPA` agent file for the categories, and the agent files for the descriptions.
- `wippa_subagent_invalid` — re-scan the directories and report the drift against the roster.

Agent definitions live in one of these places:

| Scope | Path |
|---|---|
| Repository tree | `categories/<category>/<agent>.md` |
| Installed scope | `<scope>/agents/<agent>.md` |

The installer flattens the tree on install, so the agent id is the file name without `.md` in either shape. In an installed scope, `<scope>` is the project `.opencode/` directory or the global `~/.config/opencode/` directory.

The catalogue now holds twelve subagents, so the tools are needed mainly for full definitions and for refreshing a stale catalogue, not for discovering an unknown agent.
