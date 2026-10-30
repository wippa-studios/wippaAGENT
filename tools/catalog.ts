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
   * sha256 of the file content at build time. mtime and size can both stay the
   * same across an edit — a same-length rewrite restores neither guarantee —
   * so the digest is what makes the fingerprint follow the bytes.
   */
  digest: string
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
// The roster lives at the repository root as `wippaAGENT.md`; an installed
// scope keeps a copy of it beside the agent files.
const ROSTER_FILENAME = "wippaAGENT.md"
const AGENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
// Directories that never hold agent definitions.
const SKIPPED_WALK_DIRS = new Set(["node_modules", ".git", "docs", "skills"])
// Custom agents the user keeps in their own global configuration. They have no
// file in this bundle and are legitimately global, so they are not drift. The
// ids come from the environment rather than the source, so a user is not stuck
// with the ones this repository happened to ship with, and it is read per call
// so a test or a session can change the set without reloading the module.
function customAgentIds(): Set<string> {
  return new Set(
    (process.env.WIPPA_CUSTOM_AGENT_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  )
}

// The user-level OpenCode configuration directory. OPENCODE_CONFIG_DIR is the
// override install.sh writes to, so the plugin reads the same scope the
// installer used. install.sh reads it as
// `${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}`, so an empty or
// whitespace-only value is unset here too.
function globalConfigDir(): string {
  return process.env.OPENCODE_CONFIG_DIR?.trim() || join(homedir(), ".config", "opencode")
}

// A direct config file path from OPENCODE_CONFIG, which the CLI loads between
// the global and the project configs, so its values outrank the global file
// and are outranked by project files. An empty or whitespace-only value is
// unset, like OPENCODE_CONFIG_DIR, and a relative path resolves against the
// process working directory, matching the CLI's own resolution of the
// variable.
function explicitConfigFile(): string | undefined {
  const value = process.env.OPENCODE_CONFIG?.trim()
  return value ? resolve(value) : undefined
}

// A directory is global when it is the user-level OpenCode agent directory.
// Everything else — the bundle, the project checkout, an explicit override — is project scope.
function globalAgentsDir(): string {
  return join(globalConfigDir(), "agents")
}

// The system-wide configuration directory of OpenCode V2 for this platform. It
// loads like the global directory and outranks both it and every project file,
// so a managed machine's agents are part of the picture too.
function systemConfigDir(): string | undefined {
  if (process.platform === "darwin") return "/Library/Application Support/opencode"
  if (process.platform === "win32") {
    return join(process.env.ProgramData ?? "C:\\ProgramData", "opencode")
  }
  return "/etc/opencode"
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
 * Candidate agent directories in priority order: an explicit override first,
 * then the project directories, then the shipped bundle, then the global
 * directory. Every directory that exists is kept, so an agent id from a
 * project directory wins over the bundle copy and over a global one.
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

  // The project directories come before the bundle, so an agent a project
  // overrides wins over the copy this repository ships. An installed scope
  // keeps the agents flat in `<cwd>/agents/` or `<cwd>/.opencode/agents/`; the
  // repository tree is `categories/<category>/<agent>.md`.
  candidates.push(resolve(join(cwd, "agents")))
  candidates.push(resolve(join(cwd, ".opencode", "agents")))
  candidates.push(resolve(BUNDLE_CATEGORIES_DIR))
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
 * Minimal frontmatter reader for the `---` block. Flat `key: value` pairs, plus
 * the `>` and `|` block scalars an agent description is written with, because a
 * folded description still has to become the one-line text the catalog stores.
 * Nested block content of any other shape is skipped.
 */
export function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const data: Record<string, string> = {}
  const normalized = text.replace(/\r\n/g, "\n")
  const lines = normalized.split("\n")

  // A blank line before the opening fence is tolerated: the fence is the first
  // non-blank line, not necessarily the first line.
  let start = 0
  while (start < lines.length && lines[start].trim() === "") start++
  if (lines[start]?.trim() !== "---") return { data, body: normalized }

  let end = -1
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i
      break
    }
  }
  if (end === -1) return { data, body: normalized }

  for (let i = start + 1; i < end; i++) {
    const line = lines[i]
    if (/^\s/.test(line)) continue
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line)
    if (!match) continue
    const value = match[2].trim()

    // A block scalar: `>` folds the indented lines into one space-separated
    // line, `|` keeps their line breaks. An optional chomping indicator is
    // tolerated and ignored.
    const block = /^([>|])[+-]?$/.exec(value)
    if (block) {
      const collected: string[] = []
      let j = i + 1
      for (; j < end; j++) {
        const next = lines[j]
        if (next.trim() !== "" && !/^\s/.test(next)) break
        collected.push(next.replace(/^\s+/, ""))
      }
      while (collected.length > 0 && collected[collected.length - 1].trim() === "") collected.pop()
      data[match[1]] =
        block[1] === "|"
          ? collected.join("\n").trim()
          : collected.join(" ").replace(/\s+/g, " ").trim()
      i = j - 1
      continue
    }

    data[match[1]] = stripQuotes(value)
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
  // A table row is only data once its table is known: either the header row was
  // recognised by `detectTableColumns`, or a separator row has already been
  // seen. Without this an unrecognised header such as `| probe-a | probe-b |`
  // parses as a data row and the roster grows a phantom agent id.
  let sawSeparator = false

  for (const line of section) {
    const heading = /^###\s+(.+?)\s*\((\d+)\)\s*$/.exec(line)
    if (heading) {
      current = group(heading[1], Number(heading[2]))
      columns = undefined
      sawSeparator = false
      continue
    }
    if (/^###\s/.test(line)) {
      current = group(line.replace(/^###\s+/, "").trim())
      columns = undefined
      sawSeparator = false
      continue
    }
    if (/^#{1,2}\s/.test(line)) break
    // The roster closes with a blockquote note; it is not part of the roster.
    if (line.trimStart().startsWith(">")) {
      sawSeparator = false
      continue
    }

    if (line.trimStart().startsWith("|")) {
      const cells = splitTableRow(line)
      if (cells.length === 0) continue
      if (isTableSeparator(cells)) {
        sawSeparator = true
        continue
      }
      if (!columns) {
        const detected = detectTableColumns(cells)
        if (detected) {
          columns = detected
          continue
        }
        // An unrecognised first row before any separator is a header we do not
        // understand, so it is skipped rather than read as an agent id.
        if (!sawSeparator) continue
      }
      const layout = columns ?? { idColumn: 0, categoryColumn: 1 }
      const id = cellAgentId(cells[layout.idColumn] ?? "")
      if (!id) continue
      const name = (cells[layout.categoryColumn] ?? "").trim() || current?.name || "Agents"
      group(name).agents.push(id)
      continue
    }

    sawSeparator = false
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
 * Finds the roster. In the repository it is the root `wippaAGENT.md`, next to
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

/** Every agent id the roster lists. */
function rosterIds(roster: RosterCategory[]): Set<string> {
  const ids = new Set<string>()
  for (const category of roster) {
    for (const id of category.agents) ids.add(id)
  }
  return ids
}

/**
 * Whether a file found in `dir` belongs to this catalog.
 *
 * A project directory is an explicit choice — the checkout, a project-local
 * install, or a `WIPPA_AGENT_DIR` override — so every file in it is indexed.
 * The global directory is shared with every other agent the user has installed
 * for every project, and indexing all of it buries the twelve agents this
 * bundle ships under unrelated ones. Only the roster's agents, plus the ids
 * listed in `WIPPA_CUSTOM_AGENT_IDS`, are part of this catalog.
 */
function belongsToBundle(
  id: string,
  scope: AgentScope,
  listed: Set<string>,
  custom: Set<string>,
): boolean {
  if (scope === "project") return true
  return listed.has(id) || custom.has(id)
}

/**
 * Reads every agent definition found in the given directories. Project scope
 * overrides global scope for the same agent id.
 */
export function buildCatalog(dirs: string[], roster: RosterCategory[] = readRoster(dirs)): Catalog {
  const byId = new Map<string, AgentEntry>()
  const rosterCategory = new Map<string, string>()
  const listed = rosterIds(roster)
  const custom = customAgentIds()
  for (const category of roster) {
    for (const id of category.agents) {
      if (!rosterCategory.has(id)) rosterCategory.set(id, category.name)
    }
  }

  for (const dir of dirs) {
    const scope = scopeFor(dir)
    for (const found of listAgentFiles(dir)) {
      const id = basename(found.path, ".md")
      if (!belongsToBundle(id, scope, listed, custom)) continue
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
        digest: digestOf(text),
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

function digestOf(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

function triple(path: string, mtimeMs: number, size: number, digest: string): string {
  return `${path}\u0000${mtimeMs}\u0000${size}\u0000${digest}`
}

function hashTriples(triples: string[]): string {
  const sorted = [...triples].sort()
  return createHash("sha256").update(sorted.join("\n")).digest("hex")
}

/**
 * Stable hash over the sorted (path, mtimeMs, size, digest) triples of a
 * catalog. mtime and size stay in the triple so a bare `touch` still
 * invalidates, and the content digest catches an edit that leaves both the
 * same.
 */
export function fingerprint(catalog: Catalog): string {
  return hashTriples(
    catalog.agents.map((agent) => triple(agent.path, agent.mtimeMs, agent.size, agent.digest)),
  )
}

/**
 * Fingerprint of the current tree without parsing any frontmatter. It mirrors
 * the selection rules of `buildCatalog` — the same agent id resolves to the
 * same file — and reads each file to hash its content, so it matches
 * `fingerprint` for the same directories and can be used as a cheaper cache
 * check than a full build. The roster is read when it is not supplied, because
 * the roster decides which files of a global directory are indexed.
 */
export function scanFingerprint(
  dirs: string[],
  roster: RosterCategory[] = readRoster(dirs),
): string {
  const byId = new Map<string, { scope: AgentScope; value: string }>()
  const listed = rosterIds(roster)
  const custom = customAgentIds()

  for (const dir of dirs) {
    const scope = scopeFor(dir)
    for (const file of listAgentFiles(dir)) {
      const id = basename(file.path, ".md")
      if (!belongsToBundle(id, scope, listed, custom)) continue
      const stats = statSafe(file.path)
      if (!stats) continue

      const content = readSafe(file.path) ?? ""
      const value = triple(file.path, stats.mtimeMs, stats.size, digestOf(content))
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

/**
 * Fingerprint of the roster file, so an edit to the roster invalidates a
 * cached catalog whose category fields were derived from it. An absent roster
 * hashes the empty string, which is a real value and not a sentinel.
 */
export function rosterFingerprint(dirs: string[]): string {
  const path = findRosterFile(dirs)
  return digestOf(path ? (readSafe(path) ?? "") : "")
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
 * not know about, roster entries without a file, disabled subagents, and any
 * config candidate that was skipped, so a verdict computed without a file is
 * stated rather than silent. `base` is the location directory whose config
 * files are read, matching the directory OpenCode searches from; it defaults
 * to the process working directory for a caller that has no location of its
 * own.
 */
export function describeDrift(
  catalog: Catalog,
  roster: RosterCategory[],
  base: string = process.cwd(),
): string[] {
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

  const custom = customAgentIds()
  for (const category of roster) {
    for (const id of category.agents) {
      if (onDisk.has(id)) continue
      // Custom global agents live in the user's own configuration.
      if (custom.has(id)) continue
      if (agentFileExists(catalog, id)) continue
      lines.push(`In the roster (${category.name}) but no file on disk: ${id}`)
    }
    if (category.count !== category.agents.length) {
      lines.push(
        `Roster category "${category.name}" declares ${category.count} agents but lists ${category.agents.length}.`,
      )
    }
  }

  const { disabled, skipped } = readDisabledAgents(catalog, base)
  for (const agent of catalog.agents) {
    if (agent.mode === "subagent" && disabled.has(agent.id)) {
      lines.push(`Subagent is disabled in opencode.json: ${agent.id} (${agent.path})`)
    }
  }

  // A skipped candidate is stated, not hidden: whatever it declares is absent
  // from this report, so a reader can tell a clean verdict from one computed
  // without a file.
  for (const entry of skipped) {
    lines.push(`Config candidate skipped: ${entry.path} (${entry.reason})`)
  }

  return lines
}

/** True for a JSON object: not null, not an array, not a primitive. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Strips the JSONC additions OpenCode accepts in `opencode.json(c)` — `//` and
 * block comments, and a trailing comma before a closing brace or bracket —
 * while leaving any such sequence inside a string untouched, so a URL in the
 * config is not corrupted. The contract matches the installer's `parseJsonc`,
 * so the plugin and `install.sh` read the same hand-edited file the same way.
 */
export function parseJsonc(raw: string): string {
  const text = raw.replace(/^\uFEFF/, "")
  let out = ""
  let inString = false
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (lineComment) {
      if (char === "\n") {
        lineComment = false
        out += char
      }
      continue
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false
        i += 1
      }
      continue
    }
    if (inString) {
      out += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      continue
    }
    if (char === "/" && next === "/") {
      lineComment = true
      i += 1
      continue
    }
    if (char === "/" && next === "*") {
      blockComment = true
      i += 1
      continue
    }
    out += char
  }

  return out.replace(/,(\s*[}\]])/g, "$1")
}

/** Both config file names OpenCode V2 loads for a directory. */
const CONFIG_FILENAMES = ["opencode.json", "opencode.jsonc"]

/**
 * A directory and every ancestor up to the filesystem root, farthest first.
 * OpenCode searches from the location directory to the root, so a nearer file
 * must come after a farther one to override it.
 */
function ancestorDirs(base: string): string[] {
  const dirs: string[] = []
  let current = resolve(base)
  for (;;) {
    dirs.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return dirs.reverse()
}

/**
 * The config files OpenCode V2 would load for a location, lowest precedence
 * first: the global config, then the file named by `OPENCODE_CONFIG`, which
 * the CLI loads between the global and the project configs, then every
 * ancestor's direct `opencode.json(c)` from the farthest directory to the
 * location, then every ancestor's `.opencode/opencode.json(c)` in the same
 * order — a `.opencode` config overrides every direct config — and finally
 * the system config, which outranks both. The directories the agents
 * themselves come from are added as extra candidates, so a checkout or an
 * explicit WIPPA_AGENT_DIR keeps its own config in view even when the
 * location is elsewhere. The result is deduplicated by path, because a
 * location and an agent directory share most of their ancestors.
 */
function configCandidates(catalog: Catalog, base: string): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()
  const add = (path: string): void => {
    if (seen.has(path)) return
    seen.add(path)
    candidates.push(path)
  }

  for (const name of CONFIG_FILENAMES) add(join(globalConfigDir(), name))
  const explicit = explicitConfigFile()
  if (explicit !== undefined) add(explicit)

  const ancestors = ancestorDirs(base)
  for (const dir of ancestors) {
    for (const name of CONFIG_FILENAMES) add(join(dir, name))
  }
  for (const dir of ancestors) {
    for (const name of CONFIG_FILENAMES) add(join(dir, ".opencode", name))
  }
  for (const dir of catalog.dirs) {
    for (const name of CONFIG_FILENAMES) add(join(dirname(dir), name))
  }
  const system = systemConfigDir()
  if (system) {
    for (const name of CONFIG_FILENAMES) add(join(system, name))
  }
  return candidates
}

/** A config candidate that exists but could not contribute its settings. */
interface SkippedConfigCandidate {
  path: string
  reason: string
}

/** The outcome of reading one config candidate. */
type ConfigCandidateRead =
  | { kind: "absent" }
  | { kind: "skipped"; reason: string }
  | { kind: "json"; raw: string }

/**
 * Reads one config candidate. A path that is absent, whose parent is not a
 * directory, or whose file is empty is `absent` — the normal state of every
 * directory that holds no config, and not a skip. A path that exists but
 * cannot be read as a file is `skipped` with the reason, because the drift
 * verdict is computed without whatever it declares.
 */
function readConfigCandidate(path: string): ConfigCandidateRead {
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT" || code === "ENOTDIR") return { kind: "absent" }
    if (code === "EISDIR") return { kind: "skipped", reason: "it is a directory, not a file" }
    return { kind: "skipped", reason: "unreadable" }
  }
  if (raw.trim() === "") return { kind: "absent" }
  return { kind: "json", raw }
}

/**
 * The agents disabled in the config files OpenCode would load for a location,
 * plus the candidates that were skipped on the way.
 *
 * The files are read in precedence order and the last value for an agent wins,
 * so a nearer config can re-enable what a global one disabled, exactly as
 * OpenCode resolves the merge. Every candidate is read, not just the first: a
 * project scope can disable agents in `.opencode/opencode.json` while another
 * candidate sits beside the agents directory.
 *
 * A candidate that is missing, empty, unreadable or unparseable does not fail
 * the read — one bad file must not take the whole drift report down, and a
 * config OpenCode itself would reject cannot disable anything. But an
 * unreadable or malformed candidate is not skipped silently either: whatever
 * it declares is absent from `disabled`, which can flip a drift verdict, so
 * it is returned in `skipped` and the drift report names it.
 */
function readDisabledAgents(
  catalog: Catalog,
  base: string,
): { disabled: Set<string>; skipped: SkippedConfigCandidate[] } {
  const state = new Map<string, boolean>()
  const skipped: SkippedConfigCandidate[] = []
  for (const path of configCandidates(catalog, base)) {
    const read = readConfigCandidate(path)
    if (read.kind === "absent") continue
    if (read.kind === "skipped") {
      skipped.push({ path, reason: read.reason })
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(parseJsonc(read.raw))
    } catch {
      skipped.push({ path, reason: "not valid JSON or JSONC" })
      continue
    }
    if (!isPlainObject(parsed)) {
      skipped.push({ path, reason: "its top level is not a JSON object" })
      continue
    }
    const agents = parsed.agents
    // A config without an agents key disables nothing; that is normal.
    if (agents === undefined) continue
    if (!isPlainObject(agents)) {
      skipped.push({ path, reason: "its agents value is not an object" })
      continue
    }

    for (const [id, config] of Object.entries(agents)) {
      if (isPlainObject(config) && typeof config.disabled === "boolean") {
        state.set(id, config.disabled)
      }
    }
  }

  const disabled = new Set<string>()
  for (const [id, value] of state) {
    if (value) disabled.add(id)
  }
  return { disabled, skipped }
}
