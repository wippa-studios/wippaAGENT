#!/usr/bin/env node
/**
 * Runs the scenarios in `evals/scenarios/`.
 *
 * A scenario is only useful if it stays executable. This runner parses each
 * file, checks the named primary agent and subagents against the catalog, and
 * runs the acceptance command in the repository root. A scenario whose outcome
 * is a report has no command; it is validated and then reported as skipped,
 * because this runner cannot produce a written report.
 */
import { spawn } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { buildCatalog, readRoster, type Catalog } from "../tools/catalog.ts"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const SCENARIOS_DIR = join(REPO_ROOT, "evals", "scenarios")
const CATEGORIES_DIR = join(REPO_ROOT, "categories")
const DEFAULT_TIMEOUT_MS = 600_000
const MAX_CAPTURED_OUTPUT = 1_000_000
const FAILURE_TAIL = 4_000

export interface Scenario {
  file: string
  name: string
  intent: string
  primary: string
  subagents: string[]
  criteria: string[]
  /** Absent when the acceptance command is `None`. */
  command?: string
  /** Format problems found while parsing. */
  problems: string[]
}

interface Section {
  heading: string
  lines: string[]
}

interface CommandResult {
  exitCode: number
  ok: boolean
  timedOut: boolean
  stdout: string
  stderr: string
  durationMs: number
}

const AGENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function sections(text: string): Section[] {
  const result: Section[] = []
  let current: Section | undefined
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (match) {
      current = { heading: match[1].trim(), lines: [] }
      result.push(current)
      continue
    }
    if (current) current.lines.push(line)
  }
  return result
}

/**
 * The bullet items of a section, or its non-empty lines when it is written
 * without bullets. The scenario files use bullets for the list fields and a
 * bare line for the single-valued ones.
 */
function items(lines: string[]): string[] {
  const bulleted = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
  if (bulleted.length > 0) return bulleted
  return lines.map((line) => line.trim()).filter(Boolean)
}

/**
 * The agent id at the start of one item. A backticked id wins, so a line can
 * carry the routing rationale after it; otherwise the first word is the id.
 */
function agentId(item: string): string | undefined {
  const backticked = /`([^`]+)`/.exec(item)
  const raw = backticked ? backticked[1] : item.split(/[\s—–,;:(]/)[0] ?? ""
  const id = raw.replace(/[.,;:]+$/, "")
  return AGENT_ID.test(id) ? id : undefined
}

export function parseScenario(text: string, file: string): Scenario {
  const problems: string[] = []
  const found = new Map<string, string[]>()
  for (const section of sections(text)) {
    const key = section.heading.toLowerCase()
    if (found.has(key)) problems.push(`duplicate section "## ${section.heading}"`)
    found.set(key, section.lines)
  }

  const require = (heading: string): string[] => {
    const lines = found.get(heading.toLowerCase())
    if (lines === undefined) {
      problems.push(`missing section "## ${heading}"`)
      return []
    }
    if (items(lines).length === 0) {
      problems.push(`empty section "## ${heading}"`)
      return []
    }
    return lines
  }

  const nameLines = require("Scenario")
  const intentLines = require("Intent")
  const primaryLines = require("Expected primary agent")
  const subagentLines = require("Expected subagent(s)")
  const criteriaLines = require("Acceptance criteria")
  const commandLines = require("Acceptance command")

  const name = items(nameLines)[0] ?? ""
  const expectedName = basename(file, ".md")
  if (name && name !== expectedName) {
    problems.push(`scenario name "${name}" does not match the file name "${expectedName}"`)
  }

  const primaryItem = items(primaryLines)[0] ?? ""
  const primary = agentId(primaryItem) ?? ""
  if (primaryItem && !primary) {
    problems.push(`"${primaryItem}" is not an agent id`)
  }

  const subagents: string[] = []
  for (const item of items(subagentLines)) {
    const id = agentId(item)
    if (!id) problems.push(`"${item}" is not an agent id`)
    else subagents.push(id)
  }

  const criteria = items(criteriaLines)

  const commandItems = items(commandLines)
  let command: string | undefined
  if (commandItems.length === 0) {
    problems.push("no acceptance command is named")
  } else if (/^none\b/i.test(commandItems[0]!)) {
    command = undefined
  } else if (commandItems.length > 1) {
    problems.push("more than one acceptance command is named")
  } else {
    const fenced = /^`(.+)`$/.exec(commandItems[0]!)
    command = fenced ? fenced[1] : commandItems[0]
  }

  if (command === undefined && criteria.length === 0) {
    problems.push("a scenario without a command must name the evidence in its acceptance criteria")
  }

  return {
    file,
    name,
    intent: items(intentLines).join(" "),
    primary,
    subagents,
    criteria,
    ...(command === undefined ? {} : { command }),
    problems,
  }
}

/** Checks the agents a scenario names against the catalog on disk. */
export function validateScenario(scenario: Scenario, catalog: Catalog): string[] {
  const problems: string[] = []
  const byId = new Map(catalog.agents.map((agent) => [agent.id, agent]))

  if (scenario.primary) {
    const rootDefinition = join(REPO_ROOT, `${scenario.primary}.md`)
    if (!byId.has(scenario.primary) && !existsSync(rootDefinition)) {
      problems.push(`expected primary agent "${scenario.primary}" has no definition`)
    }
  }

  if (scenario.subagents.length === 0) problems.push("no expected subagent")
  for (const id of scenario.subagents) {
    const agent = byId.get(id)
    if (!agent) {
      problems.push(`expected subagent "${id}" is not in the catalog`)
      continue
    }
    if (agent.mode !== "subagent") {
      problems.push(`"${id}" is not a subagent (mode: ${agent.mode || "unset"})`)
    }
  }

  return problems
}

interface Args {
  check: boolean
  timeoutMs: number
  help: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { check: false, timeoutMs: DEFAULT_TIMEOUT_MS, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--check") {
      args.check = true
    } else if (arg === "-h" || arg === "--help") {
      args.help = true
    } else if (arg === "--timeout") {
      const raw = argv[i + 1]
      const value = raw === undefined ? Number.NaN : Number(raw)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--timeout needs a positive number of milliseconds")
      }
      args.timeoutMs = Math.floor(value)
      i += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  return args
}

function killTree(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined) return
  if (process.platform === "win32") {
    child.kill("SIGKILL")
    return
  }
  try {
    // The detached command leads its own process group, so the whole tree dies.
    process.kill(-child.pid, "SIGKILL")
  } catch {
    child.kill("SIGKILL")
  }
}

function runCommand(command: string, timeoutMs: number): Promise<CommandResult> {
  const started = Date.now()
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      shell: true,
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let settled = false

    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, timeoutMs)

    const finish = (exitCode: number): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise({
        exitCode: timedOut ? -1 : exitCode,
        ok: !timedOut && exitCode === 0,
        timedOut,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      })
    }

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURED_OUTPUT) stdout += chunk.toString("utf8")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURED_OUTPUT) stderr += chunk.toString("utf8")
    })
    child.on("error", (error) => {
      stderr = `${stderr}\n${String(error)}`.trim()
      finish(-1)
    })
    child.on("close", (code) => finish(code ?? -1))
  })
}

function tail(text: string): string {
  const trimmed = text.trimEnd()
  if (trimmed.length <= FAILURE_TAIL) return trimmed
  return `...[${trimmed.length - FAILURE_TAIL} characters omitted]\n${trimmed.slice(-FAILURE_TAIL)}`
}

function printIndented(text: string): void {
  for (const line of text.split("\n")) console.log(`    ${line}`)
}

function usage(): void {
  console.log(`Usage: npm run eval -- [OPTIONS]

Runs every scenario in evals/scenarios/.

Options:
  --check             Validate the scenarios and agent ids without running commands
  --timeout <ms>      Per-command timeout, default ${DEFAULT_TIMEOUT_MS}
  -h, --help          Print this help
`)
}

async function main(argv: string[]): Promise<number> {
  let args: Args
  try {
    args = parseArgs(argv)
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    usage()
    return 2
  }

  if (args.help) {
    usage()
    return 0
  }

  if (!existsSync(SCENARIOS_DIR)) {
    console.error(`error: no scenario directory at ${SCENARIOS_DIR}`)
    return 1
  }
  const files = readdirSync(SCENARIOS_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort()
  if (files.length === 0) {
    console.error(`error: no scenario file in ${SCENARIOS_DIR}`)
    return 1
  }

  const roster = readRoster([CATEGORIES_DIR])
  const catalog = buildCatalog([CATEGORIES_DIR], roster)

  console.log("wippaAGENT eval runner")
  console.log(`scenarios: ${files.length}`)
  console.log(`mode: ${args.check ? "check only" : "run"}`)

  const results = new Map<string, Promise<CommandResult>>()
  const runOnce = (command: string): Promise<CommandResult> => {
    const existing = results.get(command)
    if (existing) return existing
    const started = runCommand(command, args.timeoutMs)
    results.set(command, started)
    return started
  }

  let passed = 0
  let failed = 0
  let skipped = 0

  for (const file of files) {
    const path = join(SCENARIOS_DIR, file)
    const scenario = parseScenario(readFileSync(path, "utf8"), file)
    const problems = [...scenario.problems, ...validateScenario(scenario, catalog)]

    console.log("")
    console.log(scenario.name || file)
    if (scenario.primary) console.log(`  primary   : ${scenario.primary}`)
    if (scenario.subagents.length > 0) {
      console.log(`  subagents : ${scenario.subagents.join(", ")}`)
    }
    if (scenario.command) console.log(`  command   : ${scenario.command}`)
    else console.log("  command   : none")

    if (problems.length > 0) {
      failed += 1
      console.log("  FAIL (scenario problem)")
      for (const problem of problems) console.log(`    - ${problem}`)
      continue
    }

    if (args.check) {
      passed += 1
      console.log("  PASS (valid)")
      continue
    }

    if (!scenario.command) {
      skipped += 1
      console.log("  SKIP (no command; the report itself is the evidence)")
      continue
    }

    console.log(`  running ${scenario.command}`)
    const result = await runOnce(scenario.command)
    if (result.ok) {
      passed += 1
      console.log(`  PASS (exit 0, ${result.durationMs}ms)`)
      continue
    }

    failed += 1
    const cause = result.timedOut ? `timed out after ${args.timeoutMs}ms` : `exit ${result.exitCode}`
    console.log(`  FAIL (${cause}, ${result.durationMs}ms)`)
    if (result.stdout.trim()) {
      console.log("  stdout tail:")
      printIndented(tail(result.stdout))
    }
    if (result.stderr.trim()) {
      console.log("  stderr tail:")
      printIndented(tail(result.stderr))
    }
  }

  console.log("")
  console.log(
    `summary: ${passed} passed, ${failed} failed, ${skipped} skipped, ${files.length} total`,
  )
  return failed === 0 ? 0 : 1
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
}
