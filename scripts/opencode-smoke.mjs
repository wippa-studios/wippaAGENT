#!/usr/bin/env node
// opencode-smoke.mjs — a credential-free smoke test against a real OpenCode
// binary.
//
// `npm test` covers the plugin through its own types and its own fake hosts.
// This script goes one step further where a binary is available: it installs
// the agent set into a throwaway project with install.sh, then runs
// `opencode --standalone debug agents` with a throwaway HOME, and asserts that
//
//   1. the command exits 0,
//   2. all thirteen agent ids load (the primary agent and the twelve subagents),
//   3. the tools plugin at <scope>/plugins/wippa-subagent/ is discovered and
//      loaded — the debug log must show its entrypoint and no load failure.
//
// It needs no credentials: `debug agents` resolves configuration and agents
// without dispatching a model. A full live smoke (a prompt dispatched to a
// model, the plugin's tools actually executing) additionally needs model
// credentials and network access; `.github/workflows/dispatch-eval.yml` is the
// guarded home for that, and this script stays runnable everywhere the binary
// is.
//
// Binary: $OPENCODE_BIN, else `opencode` on PATH. The CI job installs
// `@opencode/cli` at a pinned version; see .github/workflows/ci.yml.
//
// Usage: node scripts/opencode-smoke.mjs   (or: npm run check:smoke)

import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CATEGORIES_DIR = join(REPO_ROOT, "categories")
const COMMAND_TIMEOUT_MS = 180_000
const OUTPUT_LIMIT = 2_000_000

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

/** Runs a command, captures both streams, and returns the real exit code. */
function run(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPO_ROOT,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, COMMAND_TIMEOUT_MS)
    child.stdout.on("data", (chunk) => {
      if (stdout.length < OUTPUT_LIMIT) stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      if (stderr.length < OUTPUT_LIMIT) stderr += chunk
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolvePromise({ code: -1, stdout, stderr: `${stderr}\n${String(error)}` })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolvePromise({ code: timedOut ? -1 : (code ?? -1), stdout, stderr, timedOut })
    })
  })
}

/** Every agent id the repository ships: the primary agent plus every category file. */
function agentIds() {
  const ids = ["wippaAGENT"]
  for (const entry of readdirSync(CATEGORIES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    for (const file of readdirSync(join(CATEGORIES_DIR, entry.name))) {
      if (file.endsWith(".md")) ids.push(file.slice(0, -".md".length))
    }
  }
  return ids.sort()
}

const opencode = process.env.OPENCODE_BIN ?? "opencode"
const versionProbe = await run(opencode, ["--version"])
if (versionProbe.code !== 0) {
  fail(
    `the OpenCode binary could not be run (${opencode}): ` +
      (versionProbe.stderr.trim() || `exit ${versionProbe.code}`),
  )
}
console.log(`smoke: ${versionProbe.stdout.trim() || opencode}`)

const work = mkdtempSync(join(tmpdir(), "wippa-opencode-smoke-"))
const home = join(work, "home")
const project = join(work, "project")
mkdirSync(home, { recursive: true })
mkdirSync(project, { recursive: true })

// The agent set is installed exactly the way a user would install it.
const install = await run("bash", [join(REPO_ROOT, "install.sh"), "--project", project])
if (install.code !== 0) {
  fail(`install.sh --project failed with exit ${install.code}:\n${install.stdout}\n${install.stderr}`)
}
console.log(`smoke: installed into ${project}/.opencode`)

// A throwaway HOME and XDG tree keep the run away from the machine's real
// OpenCode state, and --standalone keeps it away from any running service.
const xdg = {
  HOME: home,
  XDG_CONFIG_HOME: join(home, ".config"),
  XDG_DATA_HOME: join(home, ".local", "share"),
  XDG_CACHE_HOME: join(home, ".cache"),
  XDG_STATE_HOME: join(home, ".local", "state"),
}
const debug = await run(
  opencode,
  ["--standalone", "--log-level", "info", "--print-logs", "debug", "agents"],
  { cwd: project, env: xdg },
)
if (debug.timedOut) {
  fail(`opencode debug agents did not finish within ${COMMAND_TIMEOUT_MS / 1_000}s`)
}
if (debug.code !== 0) {
  fail(`opencode debug agents exited ${debug.code}:\n${debug.stdout}\n${debug.stderr}`)
}

let agents
try {
  agents = JSON.parse(debug.stdout)
} catch (error) {
  fail(`debug agents did not print JSON (${error.message}):\n${debug.stdout.slice(0, 2_000)}`)
}
const loaded = new Set(agents.map((agent) => agent.id))
const missing = agentIds().filter((id) => !loaded.has(id))
if (missing.length > 0) {
  fail(`the installed scope is missing agent definitions: ${missing.join(", ")}`)
}
console.log(`smoke: ${loaded.size} agent definitions loaded, all ${agentIds().length} expected ids present`)

// The server logs go to stderr with --print-logs. The plugin must have been
// discovered and loaded; a failure is a WARN line, not a non-zero exit.
if (!/msg="loading plugin".*wippa-subagent/.test(debug.stderr)) {
  fail(`the tools plugin was never loaded; log did not name it:\n${debug.stderr.slice(-4_000)}`)
}
if (/failed to load plugin/.test(debug.stderr)) {
  fail(`a plugin failed to load:\n${debug.stderr.slice(-4_000)}`)
}
console.log("smoke: the wippa-subagent tools plugin loaded with no failure")
console.log("smoke: pass")
