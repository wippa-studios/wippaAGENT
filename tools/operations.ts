import { spawn } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

import {
  categorySlug,
  describeDrift,
  fingerprint,
  type AgentEntry,
  type Catalog,
  type RosterCategory,
} from "./catalog.ts"
import { guardVerifyCommand } from "./guards.ts"

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

/**
 * Finds agents by name, category or description and renders the matches as a
 * table. An absent, zero or negative limit means "no cap"; the tool-level
 * default is applied by the caller.
 */
export function search(catalog: Catalog, query: string, limit?: number): string {
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

  const max = limit !== undefined && limit > 0 ? limit : matches.length
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
    "- The cached catalog was dropped and rebuilt from disk.",
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

/**
 * The reason a command is refused, or undefined when the guard allows it.
 *
 * `wippa_verify` spawns a shell, so without this a subagent could run through
 * the tool exactly what its frontmatter denies to `shell`, and a host with no
 * permission rules configured would have no guard at all. The policy itself —
 * the allowlist and the character policy — is `guardVerifyCommand` in
 * `guards.ts`, the single source; the tool entry point in `index.ts` consults
 * the same guard before the permission assertion, so this check is the
 * backstop for direct calls to `verify`.
 */
export function deniedPattern(command: string): string | undefined {
  const verdict = guardVerifyCommand(command)
  return verdict.ok ? undefined : verdict.reason
}

/** The verdict of one acceptance-command run. */
export interface VerifyResult {
  command: string
  exitCode: number
  ok: boolean
  /**
   * Why the command produced no normal exit code: `invalid-command`,
   * `invalid-cwd`, `denied-pattern`, `aborted`, `timeout`, `output-limit`,
   * `spawn-error` or `cwd-not-found`. Absent when the command ran to a
   * verdict, including a non-zero exit code, which is reported through
   * `exitCode`.
   */
  reason?: string
  stdout: string
  stderr: string
  /** The absolute working directory the command ran in. */
  cwd: string
  /** Wall-clock time the command ran, in milliseconds; 0 when it never started. */
  durationMs: number
}

/** Everything one acceptance-command run accepts. */
export interface VerifyOptions {
  command: string
  cwd?: string
  timeoutMs?: number
  maxBuffer?: number
  outputLimit?: number
  /** The caller's cancellation signal; aborting it kills the running command. */
  signal?: AbortSignal
}

// An acceptance command can legitimately take minutes, so the default timeout
// is generous; the bounds keep a caller from passing 0 or a day by accident.
const VERIFY_TIMEOUT_DEFAULT_MS = 300_000
const VERIFY_TIMEOUT_MIN_MS = 1_000
const VERIFY_TIMEOUT_MAX_MS = 3_600_000
const VERIFY_MAX_BUFFER_DEFAULT = 32 * 1024 * 1024
const VERIFY_OUTPUT_LIMIT_DEFAULT = 32 * 1024

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Clamps a numeric option to its range; a missing or non-finite value takes the default. */
function clampOption(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

/**
 * Caps one stream at approximately `limit` characters, keeping the head and
 * the tail: a failing command prints its reason last, so a tail-only cut would
 * hide the output the verdict rests on. The keep is `2 * floor(limit / 2)`
 * characters and the truncation marker is added on top, so the returned stream
 * is about `limit` characters plus the marker.
 */
function truncateOutput(text: string, limit: number): string {
  if (text.length <= limit) return text
  const keep = Math.floor(limit / 2)
  const head = text.slice(0, keep)
  const tail = text.slice(text.length - keep)
  return `${head}\n…[truncated: kept first ${keep} and last ${keep} of ${text.length} characters]…\n${tail}`
}

/**
 * Runs an acceptance command through the shell and reports the real exit
 * code, so a pass/fail verdict never rests on subagent prose.
 *
 * The run is asynchronous on purpose. `spawnSync` held the whole process for
 * the length of the command, so nothing else in the session could run, and an
 * aborted call could not be stopped. This version spawns the command, watches
 * the timeout, the output cap and the caller's signal, and resolves when the
 * process exits or is killed.
 */
export async function verify(
  command: string | VerifyOptions,
  cwd?: string,
): Promise<VerifyResult> {
  const options: VerifyOptions = typeof command === "string" ? { command, cwd } : command
  const target = options.command
  const workingDir = options.cwd === undefined ? process.cwd() : resolve(options.cwd)

  const timeoutMs = clampOption(
    options.timeoutMs,
    VERIFY_TIMEOUT_DEFAULT_MS,
    VERIFY_TIMEOUT_MIN_MS,
    VERIFY_TIMEOUT_MAX_MS,
  )
  const maxBuffer = clampOption(
    options.maxBuffer,
    VERIFY_MAX_BUFFER_DEFAULT,
    1_024,
    Number.MAX_SAFE_INTEGER,
  )
  const outputLimit = clampOption(
    options.outputLimit,
    VERIFY_OUTPUT_LIMIT_DEFAULT,
    64,
    Number.MAX_SAFE_INTEGER,
  )

  const refused = deniedPattern(target)
  if (refused) {
    return {
      command: target,
      exitCode: -1,
      ok: false,
      reason: "denied-pattern",
      stdout: "",
      stderr: `The acceptance command matches a denied pattern (${refused}). This tool runs a shell and does not bypass the shell rules the agent definitions ship.`,
      cwd: workingDir,
      durationMs: 0,
    }
  }

  if (!isDirectory(workingDir)) {
    return {
      command: target,
      exitCode: -1,
      ok: false,
      reason: "cwd-not-found",
      stdout: "",
      stderr: `The working directory does not exist or is not a directory: ${workingDir}`,
      cwd: workingDir,
      durationMs: 0,
    }
  }

  if (options.signal?.aborted) {
    return {
      command: target,
      exitCode: -1,
      ok: false,
      reason: "aborted",
      stdout: "",
      stderr: "The call was cancelled before the command started.",
      cwd: workingDir,
      durationMs: 0,
    }
  }

  return runCommand(target, workingDir, timeoutMs, maxBuffer, outputLimit, options.signal)
}

/**
 * One spawned acceptance command. Output is kept as buffers and decoded once at
 * the end, so a chunk that splits a multi-byte character is not mangled. The
 * `maxBuffer` check is per stream, matching `child_process`'s documented
 * behaviour; `outputLimit` is applied to the decoded text afterwards.
 */
function runCommand(
  target: string,
  workingDir: string,
  timeoutMs: number,
  maxBuffer: number,
  outputLimit: number,
  signal: AbortSignal | undefined,
): Promise<VerifyResult> {
  const startedAt = Date.now()

  return new Promise((resolvePromise) => {
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let reason: string | undefined
    let spawnError: string | undefined
    let settled = false
    let timer: NodeJS.Timeout | undefined

    const child = spawn(target, {
      shell: true,
      cwd: workingDir,
      stdio: ["ignore", "pipe", "pipe"],
      // On POSIX the command leads its own process group, so a timeout or an
      // abort kills the shell and everything it started. Without this, killing
      // `sh` leaves a grandchild holding the output pipes open and the call
      // still waits for it.
      detached: process.platform !== "win32",
    })

    const finish = (exitCode: number): void => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      const failed = reason !== undefined
      resolvePromise({
        command: target,
        exitCode: failed ? -1 : exitCode,
        ok: !failed && exitCode === 0,
        ...(reason === undefined ? {} : { reason }),
        stdout: truncateOutput(Buffer.concat(stdout).toString("utf8"), outputLimit),
        stderr: truncateOutput(
          [spawnError, Buffer.concat(stderr).toString("utf8")].filter(Boolean).join("\n"),
          outputLimit,
        ),
        cwd: workingDir,
        durationMs: Date.now() - startedAt,
      })
    }

    const killGroup = (): void => {
      if (child.pid === undefined) return
      if (process.platform === "win32") {
        child.kill("SIGKILL")
        return
      }
      try {
        // The negated pid addresses the process group the detached child leads.
        process.kill(-child.pid, "SIGKILL")
      } catch {
        // The group is already gone, which is the outcome this wanted.
        child.kill("SIGKILL")
      }
    }

    // The first stop condition wins: a command that timed out is reported as a
    // timeout even if the kill makes it exit non-zero a moment later.
    const stop = (next: string): void => {
      if (reason === undefined) reason = next
      killGroup()
    }

    const onAbort = (): void => stop("aborted")

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk)
      stdoutBytes += chunk.length
      if (stdoutBytes > maxBuffer) stop("output-limit")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk)
      stderrBytes += chunk.length
      if (stderrBytes > maxBuffer) stop("output-limit")
    })

    child.on("error", (error) => {
      if (reason === undefined) reason = "spawn-error"
      if (spawnError === undefined) spawnError = String(error)
      finish(-1)
    })

    child.on("close", (code) => finish(code ?? -1))

    timer = setTimeout(() => stop("timeout"), timeoutMs)
    if (signal !== undefined) {
      signal.addEventListener("abort", onAbort, { once: true })
      // The signal may have aborted between the check in `verify` and here.
      if (signal.aborted) onAbort()
    }
  })
}
