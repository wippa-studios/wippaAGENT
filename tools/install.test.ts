import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const INSTALLER = join(REPO_ROOT, "install.sh")
const CATEGORIES_DIR = join(REPO_ROOT, "categories")

interface RunResult {
  status: number | null
  output: string
}

/** Runs the installer against a throwaway project, never the real config. */
function runInstaller(...args: string[]): RunResult {
  const result = spawnSync("bash", [INSTALLER, ...args], { encoding: "utf8" })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

function projectDir(): string {
  return mkdtempSync(join(tmpdir(), "wippa-install-"))
}

/** Every regular file under `dir`, recursively, as paths relative to it. */
function filesUnder(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? join(prefix, entry.name) : entry.name
    if (entry.isDirectory()) files.push(...filesUnder(join(dir, entry.name), relative))
    else files.push(relative)
  }
  return files.sort()
}

/** The bundle's agent files plus the primary agent, which the installer flattens. */
function sourceAgentCount(): number {
  let count = 1
  for (const entry of readdirSync(CATEGORIES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    count += readdirSync(join(CATEGORIES_DIR, entry.name)).filter((name) =>
      name.endsWith(".md"),
    ).length
  }
  return count
}

/** Every skill directory the installer must ship, i.e. each one holding a SKILL.md. */
function sourceSkillNames(): string[] {
  const skillsDir = join(REPO_ROOT, "skills")
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort()
}

/** The files the installer copies out of one source directory, test files excluded. */
function sourceFileCount(dir: string): number {
  return filesUnder(dir).filter((path) => !path.endsWith(".test.ts")).length
}

/** Every file the installer must copy into a scope: agents, skills and plugin. */
function installedFileTotal(): number {
  let count = sourceAgentCount() + sourceFileCount(join(REPO_ROOT, "tools"))
  for (const skill of sourceSkillNames()) {
    count += sourceFileCount(join(REPO_ROOT, "skills", skill))
  }
  return count
}

function writeConfig(dir: string, content: string): string {
  const target = join(dir, ".opencode")
  mkdirSync(target, { recursive: true })
  const path = join(target, "opencode.json")
  writeFileSync(path, content)
  return path
}

test("a fresh project install writes the agents, every skill and the plugin", () => {
  const dir = projectDir()
  const result = runInstaller("--project", dir)

  assert.equal(result.status, 0, result.output)
  const target = join(dir, ".opencode")
  const agents = readdirSync(join(target, "agents")).filter((name) => name.endsWith(".md"))
  assert.equal(agents.length, sourceAgentCount())
  assert.ok(agents.includes("wippaAGENT.md"))
  const skills = sourceSkillNames()
  assert.ok(skills.length > 0, "the source checkout must ship at least one skill")
  for (const skill of skills) {
    assert.ok(
      existsSync(join(target, "skills", skill, "SKILL.md")),
      `skill "${skill}" must be installed under <scope>/skills/`,
    )
  }
  assert.ok(existsSync(join(target, "plugins", "wippa-subagent", "index.ts")))
  assert.match(result.output, new RegExp(`agents written\\s+: ${sourceAgentCount()}`))
  assert.match(result.output, new RegExp(`skills written\\s+: ${skills.length}`))
  // The summary is checkable arithmetic: every copied file is written, nothing
  // is skipped, and the total is their sum.
  const total = installedFileTotal()
  assert.match(result.output, new RegExp(`files written\\s+: ${total}`))
  assert.match(result.output, new RegExp(`files skipped\\s+: 0`))
  assert.match(result.output, new RegExp(`files total\\s+: ${total}`))
})

test("test files never reach an installed scope", () => {
  const dir = projectDir()
  const result = runInstaller("--project", dir)

  assert.equal(result.status, 0, result.output)
  const installed = filesUnder(join(dir, ".opencode", "plugins", "wippa-subagent"))
  assert.ok(installed.includes("index.ts"))
  assert.ok(
    installed.every((path) => !path.endsWith(".test.ts")),
    `no test file is installed: ${installed.join(", ")}`,
  )
})

test("a second run over an installed scope writes nothing", () => {
  const dir = projectDir()
  const first = runInstaller("--project", dir)
  const second = runInstaller("--project", dir)

  assert.equal(first.status, 0, first.output)
  assert.equal(second.status, 0, second.output)
  assert.match(second.output, /files written\s+: 0/)
  assert.match(second.output, /files skipped\s+: [1-9]/)
  // Skipped files are still part of the total, so 0 + skipped = total.
  assert.match(second.output, new RegExp(`files total\\s+: ${installedFileTotal()}`))
})

test("a dry run summary counts the planned writes and adds up to the entries", () => {
  const dir = projectDir()
  const first = runInstaller("--project", dir)
  assert.equal(first.status, 0, first.output)

  const target = join(dir, ".opencode")
  const removed = [
    join(target, "agents", "domain-specialist.md"),
    join(target, "agents", "research-analyst.md"),
    join(target, "skills", "domain-playbooks", "SKILL.md"),
    join(target, "skills", "compliance-privacy-playbooks", "SKILL.md"),
    join(target, "skills", "wippa-subagent-search", "SKILL.md"),
    join(target, "plugins", "wippa-subagent", "index.ts"),
  ]
  for (const path of removed) unlinkSync(path)

  const result = runInstaller("--project", dir, "--dry-run")

  assert.equal(result.status, 0, result.output)
  const total = installedFileTotal()
  const skipped = total - removed.length
  assert.match(result.output, new RegExp(`files to install\\s+: ${removed.length}`))
  assert.match(result.output, new RegExp(`files skipped\\s+: ${skipped}`))
  assert.match(result.output, new RegExp(`files total\\s+: ${total}`))
  assert.match(result.output, new RegExp(`agents to install\\s+: 2`))
  assert.match(result.output, new RegExp(`skills to install\\s+: 3`))

  // Every listed entry is counted by exactly one summary line.
  const lines = result.output.split("\n")
  assert.equal(lines.filter((line) => line.includes("would install")).length, removed.length)
  assert.equal(lines.filter((line) => /^  skipped /.test(line)).length, skipped)
})

test("a modified installed file is kept unless --force is given", () => {
  const dir = projectDir()
  runInstaller("--project", dir)
  const installed = join(dir, ".opencode", "agents", "core-developer.md")
  writeFileSync(installed, "locally edited\n")

  const withoutForce = runInstaller("--project", dir)
  assert.equal(withoutForce.status, 0, withoutForce.output)
  assert.equal(readFileSync(installed, "utf8"), "locally edited\n")
  assert.match(withoutForce.output, /skipped .*core-developer\.md/)

  const forced = runInstaller("--project", dir, "--force")
  assert.equal(forced.status, 0, forced.output)
  assert.notEqual(readFileSync(installed, "utf8"), "locally edited\n")
  assert.equal(
    readFileSync(installed, "utf8"),
    readFileSync(join(CATEGORIES_DIR, "01-core-development", "core-developer.md"), "utf8"),
  )
})

test("uninstall removes the installed files and keeps a modified one", () => {
  const dir = projectDir()
  runInstaller("--project", dir)
  const target = join(dir, ".opencode")
  const modified = join(target, "agents", "debugger.md")
  writeFileSync(modified, "locally edited\n")

  const result = runInstaller("--project", dir, "--uninstall")

  assert.equal(result.status, 0, result.output)
  assert.equal(readFileSync(modified, "utf8"), "locally edited\n")
  assert.ok(!existsSync(join(target, "agents", "core-developer.md")))
  for (const skill of sourceSkillNames()) {
    assert.ok(
      !existsSync(join(target, "skills", skill, "SKILL.md")),
      `skill "${skill}" must be removed from <scope>/skills/ on uninstall`,
    )
  }
  assert.ok(!existsSync(join(target, "plugins", "wippa-subagent", "index.ts")))
  assert.match(result.output, /files kept\s+: 1/)
  assert.ok(existsSync(target), "a target directory holding a kept file is not removed")
})

test("uninstall removes the target directory when it is left empty", () => {
  const dir = projectDir()
  runInstaller("--project", dir)

  const result = runInstaller("--project", dir, "--uninstall")

  assert.equal(result.status, 0, result.output)
  assert.ok(!existsSync(join(dir, ".opencode")), "no empty target directory is left behind")
  const total = installedFileTotal()
  assert.match(result.output, new RegExp(`files removed\\s+: ${total}`))
  assert.match(result.output, new RegExp(`files total\\s+: ${total}`))
  assert.match(result.output, /No configuration file was found at:/)
})

test("uninstall keeps the target directory while the config file stays behind", () => {
  const dir = projectDir()
  const configPath = writeConfig(dir, '{ "theme": "dark" }\n')
  runInstaller("--project", dir)

  const result = runInstaller("--project", dir, "--uninstall")

  assert.equal(result.status, 0, result.output)
  assert.ok(existsSync(join(dir, ".opencode")), "the target holding the config is kept")
  assert.equal(readFileSync(configPath, "utf8"), '{ "theme": "dark" }\n')
  assert.match(result.output, /configuration file was left alone/)
})

test("a dry run writes nothing", () => {
  const dir = projectDir()
  const result = runInstaller("--project", dir, "--dry-run")

  assert.equal(result.status, 0, result.output)
  assert.ok(!existsSync(join(dir, ".opencode")), "the target directory is not created")
  assert.match(result.output, /would install/)
})

test("--apply-config merges the required keys and keeps existing values", () => {
  const dir = projectDir()
  const configPath = writeConfig(
    dir,
    `${JSON.stringify({ default_agent: "mine", theme: "dark" }, null, 2)}\n`,
  )

  const result = runInstaller("--project", dir, "--apply-config")

  assert.equal(result.status, 0, result.output)
  const config = JSON.parse(readFileSync(configPath, "utf8"))
  assert.equal(config.default_agent, "mine", "an existing value is kept")
  assert.equal(config.theme, "dark")
  assert.deepEqual(config.agents.general, { disabled: true })
  assert.deepEqual(config.agents.explore, { disabled: true })
  assert.equal(config.agents.build.mode, "subagent")
  assert.equal(config.mcp.servers.github.type, "remote")
  assert.equal(config.mcp.servers.context7.type, "remote")
  assert.equal(config.mcp.servers.playwright.type, "local")
  assert.match(result.output, /kept\s+default_agent/)
})

test("--apply-config accepts JSONC comments and trailing commas", () => {
  const dir = projectDir()
  const configPath = writeConfig(
    dir,
    `{
  // the project's own settings
  "theme": "dark",
  "mcp": {
    "servers": {
      "local": { "type": "local", "command": ["node", "server.js"] }, // keep me
    },
  },
}
`,
  )

  const result = runInstaller("--project", dir, "--apply-config")

  assert.equal(result.status, 0, result.output)
  const raw = readFileSync(configPath, "utf8")
  assert.ok(!raw.includes("// the project"), "comments are removed")
  const config = JSON.parse(raw)
  assert.equal(config.theme, "dark")
  assert.equal(config.mcp.servers.local.command[0], "node", "an unrelated server is kept")
  assert.equal(config.mcp.servers.github.url, "https://api.githubcopilot.com/mcp/")
  assert.equal(config.default_agent, "wippaAGENT")

  // A second merge has nothing to add, so it leaves the file byte-identical
  // rather than rewriting it and losing the comments it just accepted.
  const merged = readFileSync(configPath, "utf8")
  const second = runInstaller("--project", dir, "--apply-config")
  assert.equal(second.status, 0, second.output)
  assert.equal(readFileSync(configPath, "utf8"), merged)
  assert.match(second.output, /kept\s+default_agent/)
  assert.ok(!second.output.includes("added      "), "nothing is added twice")
})

test("an unreadable config stops the install before any agent is copied", () => {
  const dir = projectDir()
  const broken = '{\n  "default_agent": "wippaAGENT",\n  broken\n}\n'
  const configPath = writeConfig(dir, broken)

  const result = runInstaller("--project", dir, "--apply-config")

  assert.notEqual(result.status, 0)
  assert.match(result.output, /not valid JSON or JSONC/)
  assert.equal(readFileSync(configPath, "utf8"), broken, "the config is untouched")
  assert.ok(!existsSync(join(dir, ".opencode", "agents")), "no agent file is copied")
  assert.ok(!existsSync(join(dir, ".opencode", "plugins")), "no plugin file is copied")
})

test("a config with the wrong shape is rejected before any agent is copied", () => {
  const dir = projectDir()
  writeConfig(dir, '{\n  "agents": ["not", "an", "object"]\n}\n')

  const result = runInstaller("--project", dir, "--apply-config")

  assert.notEqual(result.status, 0)
  assert.match(result.output, /"agents" value that is not an object/)
  assert.ok(!existsSync(join(dir, ".opencode", "agents")))
})

test("a dry run with --apply-config still reports a broken config", () => {
  const dir = projectDir()
  writeConfig(dir, "{ broken")

  const result = runInstaller("--project", dir, "--dry-run", "--apply-config")

  assert.notEqual(result.status, 0)
  assert.match(result.output, /not valid JSON or JSONC/)
})

test("an install without --apply-config leaves an existing config byte-identical", () => {
  const dir = projectDir()
  const original = '{ "theme": "dark" }\n'
  const configPath = writeConfig(dir, original)

  const result = runInstaller("--project", dir)

  assert.equal(result.status, 0, result.output)
  assert.equal(readFileSync(configPath, "utf8"), original)
  assert.equal(statSync(configPath).size, original.length)
})
