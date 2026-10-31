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
const INSTALLER_SOURCE = readFileSync(INSTALLER, "utf8")

/**
 * The wordmark exactly as install.sh prints it: the body of the `<<'BANNER'`
 * heredoc, with trailing whitespace stripped from every line.
 */
function bannerArt(): string[] {
  const lines = INSTALLER_SOURCE.split("\n")
  const open = lines.findIndex((line) => line.includes("<<'BANNER'"))
  assert.notEqual(open, -1, "install.sh must print the wordmark from a BANNER heredoc")
  const close = lines.indexOf("BANNER", open + 1)
  assert.notEqual(close, -1, "the BANNER heredoc must be closed")
  return lines.slice(open + 1, close).map((line) => line.replace(/\s+$/, ""))
}

/** The widest banner line, declared once in install.sh as BANNER_WIDTH. */
function bannerWidth(): number {
  const match = INSTALLER_SOURCE.match(/^BANNER_WIDTH=(\d+)$/m)
  assert.ok(match, "install.sh must declare BANNER_WIDTH as a number")
  return Number(match[1])
}

const BANNER_ART = bannerArt()
const BANNER_WIDTH = bannerWidth()
/** The first and last art rows; only the banner prints them. */
const BANNER_FIRST = BANNER_ART[0]
const BANNER_LAST = BANNER_ART[BANNER_ART.length - 1]

interface RunResult {
  status: number | null
  output: string
}

/** Runs the installer against a throwaway project, never the real config. */
function runInstaller(...args: string[]): RunResult {
  const result = spawnSync("bash", [INSTALLER, ...args], { encoding: "utf8" })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

/**
 * Runs the installer with `WIPPA_BANNER` removed from the inherited
 * environment, then the given variables applied. The banner guard must never
 * depend on the shell that happens to run the tests.
 */
function runInstallerWithEnv(env: Record<string, string>, ...args: string[]): RunResult {
  const childEnv = { ...process.env }
  delete childEnv.WIPPA_BANNER
  const result = spawnSync("bash", [INSTALLER, ...args], {
    encoding: "utf8",
    env: { ...childEnv, ...env },
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

/** One shell word, safe for the command string `script` passes to a shell. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Runs the installer with stdout attached to a pseudo-terminal of the given
 * width, so the banner's terminal checks are exercised. `script` is util-linux:
 * -q silences its own messages, -e returns the child's status and -c runs the
 * command. A platform without that `script` skips the caller's test.
 */
function runInstallerInTerminal(columns: number, ...args: string[]): RunResult {
  const childEnv = { ...process.env }
  delete childEnv.WIPPA_BANNER
  const command = ["bash", INSTALLER, ...args].map(shellQuote).join(" ")
  const result = spawnSync("script", ["-q", "-e", "-c", command, "/dev/null"], {
    encoding: "utf8",
    env: { ...childEnv, COLUMNS: String(columns), LC_ALL: "en_US.UTF-8" },
  })
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`.replace(/\r\n/g, "\n"),
  }
}

/** Whether the output carries `line` as a whole line. */
function outputHasLine(output: string, line: string): boolean {
  return output.split("\n").includes(line)
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
  assert.equal(config.agents.build.disabled, true)
  assert.equal(config.mcp.servers.github.type, "remote")
  assert.equal(config.mcp.servers.context7.type, "remote")
  assert.equal(config.mcp.servers.playwright.type, "local")
  assert.match(result.output, /kept\s+default_agent/)
})

test("--apply-config upgrades the build entry a previous installer wrote", () => {
  const dir = projectDir()
  const configPath = writeConfig(
    dir,
    `${JSON.stringify(
      {
        default_agent: "mine",
        theme: "dark",
        agents: {
          build: {
            mode: "subagent",
            description: "Writes and changes code.",
            model: "user-model",
            temperature: 0.2,
            permissions: [{ action: "subagent", resource: "*", effect: "deny" }],
          },
        },
      },
      null,
      2,
    )}\n`,
  )

  const result = runInstaller("--project", dir, "--apply-config")

  assert.equal(result.status, 0, result.output)
  const config = JSON.parse(readFileSync(configPath, "utf8"))
  assert.equal(config.agents.build.disabled, true, "the built-in is disabled")
  assert.equal("mode" in config.agents.build, false, "the demoting mode key is removed")
  assert.equal(
    "permissions" in config.agents.build,
    false,
    "the demoting permissions key is removed",
  )
  assert.equal(config.agents.build.model, "user-model", "a user model survives the migration")
  assert.equal(config.agents.build.temperature, 0.2, "a user temperature survives the migration")
  assert.equal(
    config.agents.build.description,
    "Writes and changes code.",
    "the installer's own description is kept",
  )
  assert.equal(config.default_agent, "mine", "the personal part of the config is untouched")
  assert.equal(config.theme, "dark")
  assert.match(result.output, /replaced\s+agents\.build \(previously demoted shape\)/)
  assert.ok(
    !/kept\s+agents\.build\b/.test(result.output),
    "a replaced entry is not also reported as kept",
  )
})

test("--apply-config preserves a build entry it did not write", () => {
  const dir = projectDir()
  const original = `${JSON.stringify(
    {
      default_agent: "wippaAGENT",
      agents: {
        general: { disabled: true },
        explore: { disabled: true },
        build: { mode: "primary", description: "mine" },
      },
      mcp: {
        servers: {
          github: {
            type: "remote",
            url: "https://api.githubcopilot.com/mcp/",
            oauth: false,
            headers: {
              Authorization: "Bearer {env:GITHUB_PERSONAL_ACCESS_TOKEN}",
              "X-MCP-Toolsets": "repos,issues,pull_requests,actions",
            },
          },
          context7: {
            type: "remote",
            url: "https://mcp.context7.com/mcp",
            oauth: false,
          },
          playwright: {
            type: "local",
            command: ["npx", "--yes", "@playwright/mcp@0.0.83", "--isolated"],
          },
        },
      },
    },
    null,
    2,
  )}\n`
  const configPath = writeConfig(dir, original)

  const result = runInstaller("--project", dir, "--apply-config")

  assert.equal(result.status, 0, result.output)
  assert.equal(
    readFileSync(configPath, "utf8"),
    original,
    "no key was added, so the file is preserved byte-for-byte",
  )
  assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")).agents.build, {
    mode: "primary",
    description: "mine",
  })
  assert.match(result.output, /kept\s+agents\.build\b/)
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

test("piped output without WIPPA_BANNER contains no banner", () => {
  const dir = projectDir()
  const result = runInstallerWithEnv({}, "--project", dir, "--dry-run")

  assert.equal(result.status, 0, result.output)
  assert.ok(!outputHasLine(result.output, BANNER_FIRST), "the banner is terminal-only by default")
  assert.ok(!outputHasLine(result.output, BANNER_LAST), "the banner is terminal-only by default")
})

test("a wide UTF-8 pipe without WIPPA_BANNER still contains no banner", () => {
  const dir = projectDir()
  const result = runInstallerWithEnv(
    { COLUMNS: String(BANNER_WIDTH), LC_ALL: "en_US.UTF-8" },
    "--project",
    dir,
    "--dry-run",
  )

  assert.equal(result.status, 0, result.output)
  assert.ok(
    !outputHasLine(result.output, BANNER_FIRST),
    "a pipe is not a terminal, however wide and UTF-8 it claims to be",
  )
})

test("the banner guard turns on at exactly BANNER_WIDTH terminal columns", (t) => {
  if (spawnSync("script", ["--version"], { encoding: "utf8" }).status !== 0) {
    t.skip("a util-linux script is needed to provide a pseudo-terminal")
    return
  }
  const dir = projectDir()

  // One column below the art: the guard must suppress it.
  const narrow = runInstallerInTerminal(BANNER_WIDTH - 1, "--project", dir, "--dry-run")
  assert.equal(narrow.status, 0, narrow.output)
  assert.ok(
    !outputHasLine(narrow.output, BANNER_FIRST),
    "a terminal one column narrower than the art suppresses the banner",
  )

  // Exactly as wide as the art: the guard must print it.
  const wide = runInstallerInTerminal(BANNER_WIDTH, "--project", dir, "--dry-run")
  assert.equal(wide.status, 0, wide.output)
  assert.ok(outputHasLine(wide.output, BANNER_FIRST), "the first art row is printed")
  assert.ok(outputHasLine(wide.output, BANNER_LAST), "the last art row is printed")
})

test("WIPPA_BANNER=on prints the banner on a piped run", () => {
  const dir = projectDir()
  const result = runInstallerWithEnv({ WIPPA_BANNER: "on" }, "--project", dir, "--dry-run")

  assert.equal(result.status, 0, result.output)
  const lines = result.output.split("\n")
  const start = lines.indexOf(BANNER_FIRST)
  assert.notEqual(start, -1, "the banner is printed")
  assert.equal(start, 0, "the banner is printed above the header")
  assert.equal(
    BANNER_WIDTH,
    Math.max(...BANNER_ART.map((line) => [...line].length)),
    "BANNER_WIDTH must equal the widest line of the printed wordmark",
  )
  assert.deepEqual(
    lines.slice(start, start + BANNER_ART.length),
    BANNER_ART,
    "every printed banner line must match the art in install.sh",
  )
  assert.equal(lines[start + BANNER_ART.length], "", "the banner is followed by one blank line")
  assert.equal(
    lines[start + BANNER_ART.length + 1],
    "wippaAGENT installer",
    "the header follows the banner",
  )
  assert.ok(outputHasLine(result.output, BANNER_LAST), "the last art row is printed")
})

test("WIPPA_BANNER=off suppresses the banner on a piped run", () => {
  const dir = projectDir()
  for (const value of ["off", "OFF"]) {
    const result = runInstallerWithEnv({ WIPPA_BANNER: value }, "--project", dir, "--dry-run")

    assert.equal(result.status, 0, result.output)
    assert.ok(!outputHasLine(result.output, BANNER_FIRST), `${value} wins over any terminal check`)
    assert.ok(!outputHasLine(result.output, BANNER_LAST), `${value} wins over any terminal check`)
  }
})

test("--help never prints the banner", () => {
  const result = runInstallerWithEnv({ WIPPA_BANNER: "on" }, "--help")

  assert.equal(result.status, 0, result.output)
  assert.ok(!outputHasLine(result.output, BANNER_FIRST), "usage never prints the banner")
  assert.ok(!outputHasLine(result.output, BANNER_LAST), "usage never prints the banner")
  assert.match(result.output, /Usage: install\.sh/)
})
