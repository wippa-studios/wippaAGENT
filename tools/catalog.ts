import { createHash } from "node:crypto"
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs"
import type { Dirent } from "node:fs"
import { homedir } from "node:os"
import { basename, delimiter, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export type AgentScope = "project" | "global"

export interface AgentEntry {
  id: string
  description: string
  mode: string
  path: string
  scope: AgentScope
  mtimeMs: number
  size: number
  /**
   * The category the agent belongs to. For a file nested in a category
   * directory this is the directory name, for example `01-core-development`.
   * For an installed flat file it is the category the roster gives the agent.
   */
  category?: string
  /**
   * The readable form of the category: `01-core-development` becomes
   * `core development`. For an installed flat file it is the roster heading.
   */
  categorySlug?: string
}

export interface Catalog {
  agents: AgentEntry[]
  dirs: string[]
}

export interface RosterCategory {
  name: string
  count: number
  agents: string[]
}

// The repository keeps its agents in a tree of category directories.
const BUNDLE_CATEGORIES_DIR = fileURLToPath(new URL("../categories/", import.meta.url))
// The roster lives at the repository root as `agentWIPPA.md`; an installed
// scope keeps a copy of it beside the agent files.
const ROSTER_FILENAME = "agentWIPPA.md"
const AGENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
// Directories that never hold agent definitions.
const SKIPPED_WALK_DIRS = new Set(["node_modules", ".git", "docs", "skills"])
// Custom agents the user keeps in their own global configuration. They have no
// file in this bundle and are legitimately global, so they are not drift.
const GLOBAL_CUSTOM_AGENT_IDS = new Set(["claim-skeptic", "ml-experimenter", "github"])

// A directory is global when it is the user-level OpenCode agent directory.
// Everything else — the bundle, the project checkout, an explicit override — is project scope.
function globalAgentsDir(): string {
  return join(homedir(), ".config", "opencode", "agents")
}

function realPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function statSafe(path: string): { mtimeMs: number; size: number } | undefined {
  try {
    const stats = statSync(path)
    return { mtimeMs: stats.mtimeMs, size: stats.size }
  } catch {
    return undefined
  }
}

function readSafe(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return undefined
  }
}

function readdirSafe(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

function isDirectoryEntry(entry: Dirent, path: string): boolean {
  if (entry.isDirectory()) return true
  if (entry.isSymbolicLink()) return isDirectory(path)
  return false
}

/** A candidate file, with the category directory it was found in, if any. */
interface FoundAgentFile {
  path: string
  category?: string
}

/**
 * Every agent definition in a directory. A file may sit directly in the
 * directory, the way an installed agent does, or one level down in a category
 * directory, the way the repository tree does. The walk stops after two
 * levels and never enters `node_modules`, `.git`, `docs` or `skills`.
 */
function listAgentFiles(dir: string): FoundAgentFile[] {
  if (!isDirectory(dir)) return []

  const entries = readdirSafe(dir)
  const found: FoundAgentFile[] = []

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue
    if (isDirectoryEntry(entry, join(dir, entry.name))) continue
    found.push({ path: join(dir, entry.name) })
  }

  for (const entry of entries) {
    const nested = join(dir, entry.name)
    if (!isDirectoryEntry(entry, nested)) continue
    if (SKIPPED_WALK_DIRS.has(entry.name)) continue
    for (const child of readdirSafe(nested)) {
      if (!child.name.endsWith(".md")) continue
      if (isDirectoryEntry(child, join(nested, child.name))) continue
      found.push({ path: join(nested, child.name), category: entry.name })
    }
  }

  return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/**
 * The readable form of a category name: the numeric prefix is dropped and
 * hyphens become spaces, so `01-core-development` becomes `core development`.
 */
export function categorySlug(name: string): string {
  return name.replace(/^\d+[-_]?\s*/, "").replace(/[-_]/g, " ")
}

/**
 * Candidate agent directories in priority order. Every directory that exists
 * is kept, project directories before global ones, so an agent id from a
 * project directory wins over the same id from a global one.
 */
export function resolveAgentDirs(cwd: string = process.cwd()): string[] {
  const candidates: string[] = []

  const override = process.env.WIPPA_AGENT_DIR
  if (override && override.trim()) {
    for (const part of override.split(delimiter)) {
      const trimmed = part.trim()
      if (trimmed) candidates.push(resolve(trimmed))
    }
  }

  // The repository tree is `categories/<category>/<agent>.md`. An installed
  // scope keeps the agents flat in `<cwd>/agents/` or `<cwd>/.opencode/agents/`.
  candidates.push(resolve(BUNDLE_CATEGORIES_DIR))
  candidates.push(resolve(join(cwd, "agents")))
  candidates.push(resolve(join(cwd, ".opencode", "agents")))
  candidates.push(resolve(globalAgentsDir()))

  const seen = new Set<string>()
  const dirs: string[] = []
  for (const candidate of candidates) {
    if (!isDirectory(candidate)) continue
    const key = realPath(candidate)
    if (seen.has(key)) continue
    seen.add(key)
    dirs.push(candidate)
  }
  return dirs
}

function scopeFor(dir: string): AgentScope {
  return realPath(dir) === realPath(globalAgentsDir()) ? "global" : "project"
}

/**
 * Minimal frontmatter reader for the `---` block. The agent files only use flat
 * `key: value` pairs at the top level, so nested block content is skipped.
 */
export function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const data: Record<string, string> = {}
  const normalized = text.replace(/\r\n/g, "\n")
  const lines = normalized.split("\n")

  if (lines[0]?.trim() !== "---") return { data, body: normalized }

  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i
      break
    }
  }
  if (end === -1) return { data, body: normalized }

  for (const line of lines.slice(1, end)) {
    if (/^\s/.test(line)) continue
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line)
    if (!match) continue
    data[match[1]] = stripQuotes(match[2].trim())
  }

  return { data, body: lines.slice(end + 1).join("\n").replace(/^\n+/, "") }
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * Extracts the category groupings from the roster section of the agent file.
 * Accepts the markdown itself, or a path to the file that holds it.
 */
export function parseRoster(source: string): RosterCategory[] {
  const markdown = rosterSource(source)
  if (!markdown) return []

  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const section = rosterSection(lines)
  if (!section) return []

  const groups = new Map<string, RosterCategory>()
  const order: RosterCategory[] = []

  const group = (name: string, count?: number): RosterCategory => {
    const key = name.trim() || "Agents"
    const existing = groups.get(key)
    if (existing) {
      if (count !== undefined) existing.count = count
      return existing
    }
    const created: RosterCategory = { name: key, count: count ?? 0, agents: [] }
    groups.set(key, created)
    order.push(created)
    return created
  }

  let current: RosterCategory | undefined
  let columns: TableColumns | undefined

  for (const line of section) {
    const heading = /^###\s+(.+?)\s*\((\d+)\)\s*$/.exec(line)
    if (heading) {
      current = group(heading[1], Number(heading[2]))
      columns = undefined
      continue
    }
    if (/^###\s/.test(line)) {
      current = group(line.replace(/^###\s+/, "").trim())
      columns = undefined
      continue
    }
    if (/^#{1,2}\s/.test(line)) break
    // The roster closes with a blockquote note; it is not part of the roster.
    if (line.trimStart().startsWith(">")) continue

    if (line.trimStart().startsWith("|")) {
      const cells = splitTableRow(line)
      if (cells.length === 0) continue
      if (isTableSeparator(cells)) continue
      if (!columns) {
        const detected = detectTableColumns(cells)
        if (detected) {
          columns = detected
          continue
        }
      }
      const layout = columns ?? { idColumn: 0, categoryColumn: 1 }
      const id = cellAgentId(cells[layout.idColumn] ?? "")
      if (!id) continue
      const name = (cells[layout.categoryColumn] ?? "").trim() || current?.name || "Agents"
      group(name).agents.push(id)
      continue
    }

    if (!current) continue
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const id = match[1].trim()
      if (id && AGENT_ID_PATTERN.test(id)) current.agents.push(id)
    }
  }

  for (const category of order) {
    if (category.count === 0) category.count = category.agents.length
  }
  return order
}

interface TableColumns {
  idColumn: number
  categoryColumn: number
}

/** The lines of the roster section, from its heading to the next heading. */
function rosterSection(lines: string[]): string[] | undefined {
  const start = lines.findIndex((line) => /^##\s+.*roster/i.test(line))
  if (start === -1) return undefined

  const section: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break
    section.push(lines[i])
  }
  return section
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (!trimmed.startsWith("|")) return []
  trimmed = trimmed.slice(1)
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1)
  return trimmed.split("|").map((cell) => cell.trim())
}

function isTableSeparator(cells: string[]): boolean {
  if (cells.length === 0) return false
  return cells.every((cell) => cell === "" || /^:?-+:?$/.test(cell))
}

function detectTableColumns(cells: string[]): TableColumns | undefined {
  const headings = cells.map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ""))
  const idColumn = headings.findIndex(
    (cell) => cell === "agent" || cell === "agents" || cell === "name" || cell === "id",
  )
  const categoryColumn = headings.findIndex(
    (cell) => cell === "category" || cell === "categories",
  )
  if (idColumn === -1 && categoryColumn === -1) return undefined
  return { idColumn: idColumn === -1 ? 0 : idColumn, categoryColumn }
}

function cellAgentId(cell: string): string | undefined {
  const backticked = /`([^`]+)`/.exec(cell)
  const id = (backticked ? backticked[1] : cell).trim()
  return AGENT_ID_PATTERN.test(id) ? id : undefined
}

// A roster source that is not multi-line is treated as a file path, so an absent
// file yields an empty roster instead of an error.
function rosterSource(source: string): string {
  if (!source) return ""
  if (source.includes("\n")) return source
  const path = source.trim()
  if (!path) return ""
  if (!statSafe(path)) return ""
  return readSafe(path) ?? ""
}

/**
 * Finds the roster. In the repository it is the root `agentWIPPA.md`, next to
 * the `categories/` tree; in an installed scope it is the copy beside the
 * agent files.
 */
export function findRosterFile(dirs: string[]): string | undefined {
  for (const dir of dirs) {
    const inDir = join(dir, ROSTER_FILENAME)
    if (statSafe(inDir)) return inDir
    const beside = join(dirname(dir), ROSTER_FILENAME)
    if (statSafe(beside)) return beside
  }
  return undefined
}

export function readRoster(dirs: string[]): RosterCategory[] {
  const path = findRosterFile(dirs)
  if (!path) return []
  const text = readSafe(path)
  if (text === undefined) return []
  return parseRoster(text)
}

/**
 * Reads every agent definition found in the given directories. Project scope
 * overrides global scope for the same agent id.
 */
export function buildCatalog(dirs: string[], roster: RosterCategory[] = readRoster(dirs)): Catalog {
  const byId = new Map<string, AgentEntry>()
  const rosterCategory = new Map<string, string>()
  for (const category of roster) {
    for (const id of category.agents) {
      if (!rosterCategory.has(id)) rosterCategory.set(id, category.name)
    }
  }

  for (const dir of dirs) {
    const scope = scopeFor(dir)
    for (const found of listAgentFiles(dir)) {
      const id = basename(found.path, ".md")
      const stats = statSafe(found.path)
      if (!stats) continue

      const text = readSafe(found.path) ?? ""
      const { data } = parseFrontmatter(text)
      const entry: AgentEntry = {
        id,
        description: data.description ?? "",
        mode: data.mode ?? "",
        path: found.path,
        scope,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
      }

      // A nested file carries the name of its category directory; a flat
      // installed file takes the category the roster gives its agent id.
      const category = found.category ?? rosterCategory.get(id)
      if (category !== undefined) {
        entry.category = category
        entry.categorySlug = found.category ? categorySlug(found.category) : category
      }

      const existing = byId.get(id)
      if (!existing) {
        byId.set(id, entry)
        continue
      }
      if (existing.scope === "project" && scope === "global") continue
      if (existing.scope === "global" && scope === "project") byId.set(id, entry)
    }
  }

  const agents = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { agents, dirs: [...dirs] }
}

function triple(path: string, mtimeMs: number, size: number): string {
  return `${path}\u0000${mtimeMs}\u0000${size}`
}

function hashTriples(triples: string[]): string {
  const sorted = [...triples].sort()
  return createHash("sha256").update(sorted.join("\n")).digest("hex")
}

/** Stable hash over the sorted (path, mtimeMs, size) triples of a catalog. */
export function fingerprint(catalog: Catalog): string {
  return hashTriples(catalog.agents.map((agent) => triple(agent.path, agent.mtimeMs, agent.size)))
}

/**
 * Fingerprint of the current tree without parsing any frontmatter. It mirrors
 * the selection rules of `buildCatalog` — the same agent id resolves to the
 * same file — so it matches `fingerprint` for the same directories and can be
 * used as a cheap cache check.
 */
export function scanFingerprint(dirs: string[]): string {
  const byId = new Map<string, { scope: AgentScope; value: string }>()

  for (const dir of dirs) {
    const scope = scopeFor(dir)
    for (const file of listAgentFiles(dir)) {
      const stats = statSafe(file.path)
      if (!stats) continue

      const id = basename(file.path, ".md")
      const value = triple(file.path, stats.mtimeMs, stats.size)
      const existing = byId.get(id)
      if (!existing) {
        byId.set(id, { scope, value })
        continue
      }
      // Project scope wins over global scope, and within one scope the first
      // directory wins, exactly as `buildCatalog` resolves it.
      if (existing.scope === "global" && scope === "project") byId.set(id, { scope, value })
    }
  }

  return hashTriples([...byId.values()].map((entry) => entry.value))
}

/** True when a file for the agent id exists in a known location. */
function agentFileExists(catalog: Catalog, id: string): boolean {
  const locations: string[] = []
  const rosterPath = findRosterFile(catalog.dirs)
  if (rosterPath) locations.push(join(dirname(rosterPath), `${id}.md`))
  for (const dir of catalog.dirs) locations.push(join(dir, `${id}.md`))
  return locations.some((path) => statSafe(path) !== undefined)
}

/**
 * Differences between the agents on disk and the roster: files the roster does
 * not know about, roster entries without a file, and disabled subagents.
 */
export function describeDrift(catalog: Catalog, roster: RosterCategory[]): string[] {
  const lines: string[] = []
  const onDisk = new Set(catalog.agents.map((agent) => agent.id))

  const rosterIds = new Set<string>()
  for (const category of roster) {
    for (const id of category.agents) rosterIds.add(id)
  }

  for (const agent of catalog.agents) {
    if (!rosterIds.has(agent.id)) {
      lines.push(`On disk but absent from the roster: ${agent.id} (${agent.path})`)
    }
  }

  for (const category of roster) {
    for (const id of category.agents) {
      if (onDisk.has(id)) continue
      // Custom global agents live in the user's own configuration.
      if (GLOBAL_CUSTOM_AGENT_IDS.has(id)) continue
      if (agentFileExists(catalog, id)) continue
      lines.push(`In the roster (${category.name}) but no file on disk: ${id}`)
    }
    if (category.count !== category.agents.length) {
      lines.push(
        `Roster category "${category.name}" declares ${category.count} agents but lists ${category.agents.length}.`,
      )
    }
  }

  const disabled = disabledAgents(catalog)
  for (const agent of catalog.agents) {
    if (agent.mode === "subagent" && disabled.has(agent.id)) {
      lines.push(`Subagent is disabled in opencode.json: ${agent.id} (${agent.path})`)
    }
  }

  return lines
}

function configCandidates(catalog: Catalog): string[] {
  const candidates: string[] = []
  for (const dir of catalog.dirs) candidates.push(join(dirname(dir), "opencode.json"))
  candidates.push(join(process.cwd(), "opencode.json"))
  return candidates
}

function disabledAgents(catalog: Catalog): Set<string> {
  const disabled = new Set<string>()
  for (const path of configCandidates(catalog)) {
    const raw = readSafe(path)
    if (raw === undefined) continue
    let parsed: { agents?: Record<string, { disabled?: unknown } | undefined> }
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    for (const [id, config] of Object.entries(parsed.agents ?? {})) {
      if (config && typeof config === "object" && config.disabled === true) disabled.add(id)
    }
    break
  }
  return disabled
}
