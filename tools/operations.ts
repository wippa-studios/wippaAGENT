import { readFileSync } from "node:fs"

import {
  categorySlug,
  describeDrift,
  fingerprint,
  type AgentEntry,
  type Catalog,
  type RosterCategory,
} from "./catalog.ts"

const DEFAULT_LIMIT = 20
const NEAR_MISS_COUNT = 5

function readSafe(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return undefined
  }
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function escapeCell(value: string): string {
  return oneLine(value).replace(/\|/g, "\\|")
}

/**
 * Ranks agents against a query. An exact id beats an id prefix, which beats any
 * other id hit, which beats a category hit, which beats a description hit,
 * which beats a hit in the agent body.
 */
function rankAgent(agent: AgentEntry, query: string): number {
  const id = agent.id.toLowerCase()
  if (id === query) return 0
  if (id.startsWith(query)) return 1
  if (id.includes(query)) return 2

  const category = (agent.category ?? "").toLowerCase()
  const slug = (agent.categorySlug ?? categorySlug(agent.category ?? "")).toLowerCase()
  if (category === query || slug === query) return 3
  if (category.includes(query) || slug.includes(query)) return 4

  if (agent.description.toLowerCase().includes(query)) return 5

  const body = readSafe(agent.path)
  if (body && body.toLowerCase().includes(query)) return 6
  return -1
}

function editDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

function nearestIds(catalog: Catalog, wanted: string, count: number): string[] {
  const scored = catalog.agents.map((agent) => ({
    id: agent.id,
    distance: editDistance(agent.id.toLowerCase(), wanted.toLowerCase()),
  }))
  scored.sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return scored.slice(0, count).map((entry) => entry.id)
}

/** Finds agents by name, category or description and renders the matches as a table. */
export function search(catalog: Catalog, query: string, limit: number = DEFAULT_LIMIT): string {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) {
    return [
      "A query is required.",
      "",
      "Pass a name fragment or a capability word, for example `python`, `reviewer` or `kubernetes`.",
      "Use wippa_subagent_list to browse every category instead.",
    ].join("\n")
  }

  const matches: { agent: AgentEntry; rank: number }[] = []
  for (const agent of catalog.agents) {
    const rank = rankAgent(agent, trimmed)
    if (rank >= 0) matches.push({ agent, rank })
  }
  matches.sort(
    (a, b) => a.rank - b.rank || (a.agent.id < b.agent.id ? -1 : a.agent.id > b.agent.id ? 1 : 0),
  )

  if (matches.length === 0) {
    const nearest = nearestIds(catalog, trimmed, NEAR_MISS_COUNT)
    return [
      `No agent matches "${query.trim()}".`,
      "",
      "Closest agent ids:",
      ...nearest.map((id) => `- ${id}`),
      "",
      "Search matches names, categories and descriptions. Try a capability word instead of a full name,",
      "or use wippa_subagent_list to browse every category.",
    ].join("\n")
  }

  const max = limit > 0 ? limit : matches.length
  const shown = matches.slice(0, max)
  const lines = [
    `${matches.length} agent${matches.length === 1 ? "" : "s"} match "${query.trim()}".`,
    "",
    "| agent id | description | scope | path |",
    "| --- | --- | --- | --- |",
  ]
  for (const match of shown) {
    const agent = match.agent
    lines.push(
      `| \`${agent.id}\` | ${escapeCell(agent.description)} | ${agent.scope} | ${escapeCell(agent.path)} |`,
    )
  }
  if (matches.length > shown.length) {
    lines.push("")
    lines.push(`Showing ${shown.length} of ${matches.length}. Raise the limit to see the rest.`)
  }
  return lines.join("\n")
}

/** Returns the full definition of one agent, frontmatter included. */
export function get(catalog: Catalog, id: string): string {
  const wanted = id.trim()
  const found =
    catalog.agents.find((agent) => agent.id === wanted) ??
    catalog.agents.find((agent) => agent.id.toLowerCase() === wanted.toLowerCase())

  if (!found) {
    const nearest = nearestIds(catalog, wanted, NEAR_MISS_COUNT)
    return [
      `No agent with the id "${wanted}" is installed.`,
      "",
      "Closest agent ids:",
      ...nearest.map((candidate) => `- ${candidate}`),
      "",
      "Search by capability rather than by name: call wippa_subagent_search with a description",
      "of what the agent should do, then call wippa_subagent_get on the id it returns.",
    ].join("\n")
  }

  const text = readSafe(found.path)
  if (text === undefined) {
    return [
      `Agent "${found.id}" is indexed at ${found.path} but the file could not be read.`,
      "",
      "It may be missing or unreadable. Use wippa_subagent_invalid to re-read the catalog.",
    ].join("\n")
  }

  return [
    `# ${found.id}`,
    "",
    `- scope: ${found.scope}`,
    `- path: ${found.path}`,
    `- mode: ${found.mode}`,
    "",
    `--- begin file: ${found.id}.md ---`,
    "",
    text.replace(/\s+$/, ""),
    "",
    `--- end file: ${found.id}.md ---`,
  ].join("\n")
}

/**
 * Groups the catalog agents by the category their file path gives them. The
 * roster is only consulted for agents the path does not categorise.
 */
function groupAgents(catalog: Catalog, roster: RosterCategory[]): Map<string, AgentEntry[]> {
  const rosterNames = new Map<string, string>()
  for (const category of roster) {
    for (const id of category.agents) {
      if (!rosterNames.has(id)) rosterNames.set(id, category.name)
    }
  }

  const groups = new Map<string, AgentEntry[]>()
  for (const agent of catalog.agents) {
    const name = agent.category ?? rosterNames.get(agent.id) ?? "Agents"
    const bucket = groups.get(name)
    if (bucket) bucket.push(agent)
    else groups.set(name, [agent])
  }
  return groups
}

function categoryMatches(name: string, wanted: string): boolean {
  const target = wanted.trim().toLowerCase()
  if (!target) return true
  const lower = name.toLowerCase()
  if (lower === target || lower.includes(target)) return true
  const slug = categorySlug(name).toLowerCase()
  return slug === target || slug.includes(target)
}

/** Browses the catalog by the category of every agent file. */
export function list(
  catalog: Catalog,
  roster: RosterCategory[],
  category?: string,
  limit?: number,
): string {
  const perCategory = limit && limit > 0 ? limit : undefined
  const groups = groupAgents(catalog, roster)

  // Without a roster and without categories in the paths there is nothing to
  // group by, so every agent is listed under a single heading.
  const named = [...groups.keys()].filter((name) => name !== "Agents")
  if (named.length === 0) return flatList(catalog, perCategory)

  let names = [...groups.keys()].sort()
  if (category && category.trim()) {
    const matched = names.filter((name) => categoryMatches(name, category))
    if (matched.length === 0) {
      return [
        `No category matches "${category.trim()}".`,
        "",
        "Available categories:",
        ...names.map((name) => `- ${name} (${groups.get(name)?.length ?? 0})`),
      ].join("\n")
    }
    names = matched
  }

  const lines: string[] = []
  for (const name of names) {
    const agents = groups.get(name) ?? []
    lines.push(`## ${name} (${agents.length})`)
    lines.push("")
    const shown = perCategory ? agents.slice(0, perCategory) : agents
    for (const agent of shown) {
      lines.push(`- \`${agent.id}\` — ${oneLine(agent.description)}`)
    }
    if (agents.length > shown.length) {
      lines.push(`- … ${agents.length - shown.length} more in this category, raise the limit to see them`)
    }
    lines.push("")
  }

  return lines.join("\n").replace(/\n+$/, "")
}

function flatList(catalog: Catalog, limit?: number): string {
  const agents = limit ? catalog.agents.slice(0, limit) : catalog.agents
  const lines = ["## Agents", ""]
  for (const agent of agents) {
    lines.push(`- \`${agent.id}\` — ${oneLine(agent.description)}`)
  }
  if (limit && catalog.agents.length > agents.length) {
    lines.push("")
    lines.push(`Showing ${agents.length} of ${catalog.agents.length}. Raise the limit to see the rest.`)
  }
  return lines.join("\n")
}

/** Reports what a refresh changed, including the drift against the roster. */
export function invalid(catalog: Catalog, roster: RosterCategory[]): string {
  const drift = describeDrift(catalog, roster)
  const lines = [
    "## Subagent cache refreshed",
    "",
    "- Cache cleared: yes, the cached catalog was dropped and rebuilt from disk.",
    `- Agents indexed: ${catalog.agents.length}`,
    `- Directories scanned: ${catalog.dirs.length}`,
    `- Fingerprint: ${fingerprint(catalog)}`,
    "",
    "### Drift against the roster",
    "",
  ]
  if (drift.length === 0) {
    lines.push("- No drift. Every indexed agent is in the roster and every roster entry has a file.")
  } else {
    for (const line of drift) lines.push(`- ${line}`)
  }
  return lines.join("\n")
}
