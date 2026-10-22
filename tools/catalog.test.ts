import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  buildCatalog,
  describeDrift,
  fingerprint,
  parseFrontmatter,
  parseRoster,
  readRoster,
  resolveAgentDirs,
  scanFingerprint,
  type Catalog,
  type RosterCategory,
} from "./catalog.ts"
import { get, invalid, list, search, verify } from "./operations.ts"

const BUNDLE_ROOT = fileURLToPath(new URL("../", import.meta.url))
const CATEGORIES_DIR = join(BUNDLE_ROOT, "categories")
const ROSTER_FILE = join(BUNDLE_ROOT, "agentWIPPA.md")
const GLOBAL_CUSTOM_AGENTS = ["claim-skeptic", "ml-experimenter", "github"]

function bundleCatalog(): Catalog {
  return buildCatalog([CATEGORIES_DIR], readRoster([CATEGORIES_DIR]))
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "wippa-catalog-"))
}

/** Every agent file of the repository tree, in the order the walk finds them. */
function bundleFiles(): string[] {
  const files: string[] = []
  for (const entry of readdirSync(CATEGORIES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const nested = join(CATEGORIES_DIR, entry.name)
    for (const child of readdirSync(nested, { withFileTypes: true })) {
      if (child.isDirectory()) continue
      if (!child.name.endsWith(".md")) continue
      files.push(join(nested, child.name))
    }
  }
  return files.sort()
}

/** One category directory of the repository tree and one agent file in it. */
function firstCategoryFile(): { dir: string; file: string } {
  for (const entry of readdirSync(CATEGORIES_DIR, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    if (!entry.isDirectory()) continue
    const nested = join(CATEGORIES_DIR, entry.name)
    const files = readdirSync(nested)
      .filter((name) => name.endsWith(".md"))
      .sort()
    if (files.length === 0) continue
    return { dir: entry.name, file: files[0] }
  }
  throw new Error("the categories tree holds no agent file")
}

test("parseFrontmatter reads description, mode and colour from a real agent file", () => {
  const { dir, file } = firstCategoryFile()
  const text = readFileSync(join(CATEGORIES_DIR, dir, file), "utf8")
  const { data, body } = parseFrontmatter(text)

  assert.ok(data.description.length > 0)
  assert.equal(data.mode, "subagent")
  assert.match(data.color, /^#[0-9a-f]{6}$/i)
  assert.ok(body.length > 0)
  assert.ok(!body.startsWith("---"))
})

test("parseFrontmatter handles a file with no frontmatter", () => {
  const dir = tempDir()
  const path = join(dir, "plain.md")
  writeFileSync(path, "Just a body, no frontmatter at all.\n")

  const { data, body } = parseFrontmatter(readFileSync(path, "utf8"))
  assert.deepEqual(data, {})
  assert.equal(body, "Just a body, no frontmatter at all.\n")
})

test("parseRoster reads the categories and counts of the real roster", () => {
  const roster = parseRoster(ROSTER_FILE)
  assert.ok(roster.length > 0)

  const core = roster.find((entry) => entry.name === "Core Development")
  assert.ok(core)
  assert.ok(core.agents.includes("core-developer"))

  for (const category of roster) {
    assert.equal(category.count, category.agents.length, `${category.name} count mismatch`)
  }
})

test("parseRoster returns an empty roster for a missing file", () => {
  assert.deepEqual(parseRoster(join(tmpdir(), "wippa-missing-roster", "nope.md")), [])
  assert.deepEqual(parseRoster(""), [])
  assert.deepEqual(readRoster([join(tmpdir(), "wippa-missing-roster")]), [])
})

test("buildCatalog indexes the whole bundle with unique ids", () => {
  const catalog = bundleCatalog()
  const files = bundleFiles()
  assert.ok(files.length > 0)
  assert.equal(catalog.agents.length, files.length, "every category file is indexed once")

  const ids = catalog.agents.map((agent) => agent.id)
  assert.equal(new Set(ids).size, ids.length)

  const { file } = firstCategoryFile()
  const id = file.replace(/\.md$/, "")
  const agent = catalog.agents.find((entry) => entry.id === id)
  assert.ok(agent)
  assert.equal(agent.scope, "project")
  assert.equal(agent.mode, "subagent")
  assert.ok(agent.description.length > 0)
})

test("buildCatalog survives a missing directory", () => {
  const catalog = buildCatalog([join(tmpdir(), "wippa-does-not-exist")])
  assert.deepEqual(catalog.agents, [])
})

test("buildCatalog resolves a nested categories path to a flat id, a category and a slug", () => {
  const catalog = bundleCatalog()
  const nested = catalog.agents.filter((agent) => agent.path.startsWith(`${CATEGORIES_DIR}/`))
  assert.ok(nested.length > 0)

  for (const agent of nested) {
    const parent = basename(dirname(agent.path))
    assert.equal(agent.id, basename(agent.path, ".md"))
    assert.ok(!agent.id.includes("/"), "the id stays flat in both layouts")
    assert.equal(agent.category, parent)
    assert.equal(agent.categorySlug, parent.replace(/^\d+-/, "").replace(/-/g, " "))
  }
})

test("buildCatalog gives a flat installed file the category of the roster", () => {
  const dir = tempDir()
  const roster = readRoster([CATEGORIES_DIR])
  const entry = roster.find((item) => item.agents.length > 0)
  assert.ok(entry)
  const id = entry.agents[0]

  writeFileSync(join(dir, `${id}.md`), "---\ndescription: probe\nmode: subagent\n---\n\nbody\n")
  const catalog = buildCatalog([dir], roster)

  const agent = catalog.agents.find((item) => item.id === id)
  assert.ok(agent)
  assert.equal(agent.category, entry.name)
  assert.equal(agent.categorySlug, entry.name)
})

test("buildCatalog leaves the category undefined for a flat file that is not in the roster", () => {
  const dir = tempDir()
  writeFileSync(join(dir, "unknown-agent.md"), "---\ndescription: probe\n---\n\nbody\n")
  const catalog = buildCatalog([dir], [])

  const agent = catalog.agents.find((item) => item.id === "unknown-agent")
  assert.ok(agent)
  assert.equal(agent.category, undefined)
  assert.equal(agent.categorySlug, undefined)
})

test("resolveAgentDirs finds the bundle categories directory", () => {
  const dirs = resolveAgentDirs(BUNDLE_ROOT)
  assert.ok(dirs.includes(CATEGORIES_DIR))
})

test("resolveAgentDirs keeps every candidate directory and deduplicates by real path", () => {
  const root = tempDir()
  const agents = join(root, "agents")
  const opencodeAgents = join(root, ".opencode", "agents")
  mkdirSync(agents, { recursive: true })
  mkdirSync(opencodeAgents, { recursive: true })

  const dirs = resolveAgentDirs(root)
  assert.ok(dirs.includes(agents))
  assert.ok(dirs.includes(opencodeAgents))
  assert.ok(dirs.includes(CATEGORIES_DIR))

  const previous = process.env.WIPPA_AGENT_DIR
  process.env.WIPPA_AGENT_DIR = CATEGORIES_DIR
  try {
    const overridden = resolveAgentDirs(root)
    assert.equal(overridden[0], CATEGORIES_DIR)
    assert.equal(
      overridden.filter((dir) => dir === CATEGORIES_DIR).length,
      1,
      "the same directory is indexed once",
    )
  } finally {
    if (previous === undefined) delete process.env.WIPPA_AGENT_DIR
    else process.env.WIPPA_AGENT_DIR = previous
  }
})

test("search finds an agent by a word from its description", () => {
  const catalog = bundleCatalog()
  const output = search(catalog, "kubernetes")

  assert.match(output, /infrastructure-engineer/)
  assert.match(output, /agent id \| description \| scope \| path/)
})

test("search is case-insensitive", () => {
  const catalog = bundleCatalog()
  const rows = (output: string) => output.split("\n").filter((line) => line.startsWith("| `"))
  assert.deepEqual(rows(search(catalog, "KUBERNETES")), rows(search(catalog, "kubernetes")))
})

test("search reports no matches for a nonsense query", () => {
  const catalog = bundleCatalog()
  const output = search(catalog, "zzzqqxnothingmatchesthis")

  assert.match(output, /No agent matches/)
  assert.ok(!/\| `core-developer`/.test(output))
})

test("search ranks an exact id match first", () => {
  const catalog = bundleCatalog()
  const output = search(catalog, "quality-auditor")
  const rows = output.split("\n").filter((line) => line.startsWith("| `"))
  assert.ok(rows.length > 0)
  assert.match(rows[0], /`quality-auditor`/)
})

test("search matches the category name and the category slug", () => {
  const catalog = bundleCatalog()

  const bySlug = search(catalog, "quality security")
  assert.match(bySlug, /quality-auditor/)

  const byDirectoryName = search(catalog, "infrastructure")
  assert.match(byDirectoryName, /infrastructure-engineer/)
})

test("get returns the file content of a known agent", () => {
  const catalog = bundleCatalog()
  const { file } = firstCategoryFile()
  const id = file.replace(/\.md$/, "")
  const agent = catalog.agents.find((entry) => entry.id === id)
  assert.ok(agent)

  const output = get(catalog, id)
  const original = readFileSync(agent.path, "utf8")

  assert.ok(output.includes(`--- begin file: ${id}.md ---`))
  assert.ok(output.includes(original.trimEnd()))
  assert.match(output, /scope: project/)
  assert.match(output, new RegExp(`path: .*${id}\\.md`))
})

test("get explains how to search when the id is unknown", () => {
  const catalog = bundleCatalog()
  const output = get(catalog, "definitely-not-an-agent")

  assert.match(output, /No agent with the id/)
  assert.match(output, /wippa_subagent_search/)
})

test("fingerprint is stable across two builds of an unchanged tree", () => {
  const first = fingerprint(bundleCatalog())
  const second = fingerprint(bundleCatalog())
  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{64}$/)
})

test("fingerprint changes when a file changes size or mtime", () => {
  const dir = tempDir()
  const path = join(dir, "sample.md")
  writeFileSync(path, "---\ndescription: one\n---\n\nbody\n")

  const before = fingerprint(buildCatalog([dir]))

  writeFileSync(path, "---\ndescription: one but longer\n---\n\nbody\n")
  const afterSize = fingerprint(buildCatalog([dir]))
  assert.notEqual(before, afterSize)

  const base = new Date(Date.now() - 60_000)
  utimesSync(path, base, new Date(base.getTime() + 30_000))
  const afterTime = fingerprint(buildCatalog([dir]))
  assert.notEqual(afterSize, afterTime)
})

test("fingerprint covers a nested category file", () => {
  const root = tempDir()
  const category = join(root, "01-probe-category")
  mkdirSync(category, { recursive: true })
  const path = join(category, "probe.md")
  writeFileSync(path, "---\ndescription: one\nmode: subagent\n---\n\nbody\n")

  const before = fingerprint(buildCatalog([root]))
  writeFileSync(path, "---\ndescription: one but longer\nmode: subagent\n---\n\nbody\n")
  const after = fingerprint(buildCatalog([root]))

  assert.notEqual(before, after)
})

test("scanFingerprint matches the fingerprint of the same tree", () => {
  const catalog = bundleCatalog()

  assert.equal(
    scanFingerprint([CATEGORIES_DIR]),
    fingerprint(catalog),
    "the cheap scan and the parsed catalog describe the same tree",
  )
})

test("scanFingerprint is not the fingerprint of an empty tree", () => {
  const empty = fingerprint(buildCatalog([]))

  assert.notEqual(
    scanFingerprint([CATEGORIES_DIR]),
    empty,
    "the scan sees the agent files on disk",
  )
})

test("scanFingerprint changes when a file changes", () => {
  const dir = tempDir()
  const path = join(dir, "sample.md")
  writeFileSync(path, "---\ndescription: one\n---\n\nbody\n")

  const before = scanFingerprint([dir])
  writeFileSync(path, "---\ndescription: one but longer\n---\n\nbody\n")
  const afterSize = scanFingerprint([dir])

  assert.notEqual(before, afterSize)
})

test("scanFingerprint covers a nested category file", () => {
  const root = tempDir()
  const category = join(root, "01-probe-category")
  mkdirSync(category, { recursive: true })
  const path = join(category, "probe.md")
  writeFileSync(path, "---\ndescription: one\nmode: subagent\n---\n\nbody\n")

  const before = scanFingerprint([root])
  writeFileSync(path, "---\ndescription: one but longer\nmode: subagent\n---\n\nbody\n")
  const after = scanFingerprint([root])

  assert.notEqual(before, after)
  assert.equal(scanFingerprint([root]), fingerprint(buildCatalog([root])))
})

test("scanFingerprint follows the scope precedence of the catalog", () => {
  const previousHome = process.env.HOME
  const home = tempDir()
  const globalDir = join(home, ".config", "opencode", "agents")
  mkdirSync(globalDir, { recursive: true })

  const projectDir = tempDir()
  writeFileSync(join(globalDir, "shared.md"), "---\ndescription: global\n---\n\nbody\n")
  writeFileSync(join(projectDir, "shared.md"), "---\ndescription: project\n---\n\nbody\n")

  process.env.HOME = home
  try {
    const catalog = buildCatalog([projectDir, globalDir])
    const agent = catalog.agents.find((entry) => entry.id === "shared")
    assert.ok(agent)
    assert.equal(agent.scope, "project")

    assert.equal(
      scanFingerprint([projectDir, globalDir]),
      fingerprint(catalog),
      "the scan resolves the same file the catalog does",
    )
  } finally {
    if (previousHome === undefined) delete process.env.HOME
    else process.env.HOME = previousHome
  }
})

test("describeDrift reports a deliberately mismatched roster", () => {
  const catalog = bundleCatalog()
  const mismatched: RosterCategory[] = [
    { name: "Imaginary", count: 2, agents: ["not-on-disk", "also-not-on-disk"] },
  ]

  const drift = describeDrift(catalog, mismatched)
  assert.ok(drift.length > 0)
  assert.ok(drift.some((line) => line.includes("not-on-disk")))
  assert.ok(drift.some((line) => line.includes("core-developer")))
})

test("describeDrift reports a roster entry with no file", () => {
  const catalog = bundleCatalog()
  const roster: RosterCategory[] = [{ name: "Imaginary", count: 1, agents: ["not-on-disk"] }]

  const drift = describeDrift(catalog, roster)
  assert.ok(
    drift.some((line) => line.includes("not-on-disk") && line.includes("no file on disk")),
    "a roster entry without a file is drift",
  )
})

test("describeDrift does not report the global custom agents as missing files", () => {
  const catalog = bundleCatalog()
  const roster: RosterCategory[] = [
    { name: "Custom Agents", count: 3, agents: [...GLOBAL_CUSTOM_AGENTS] },
  ]

  const drift = describeDrift(catalog, roster)
  for (const id of GLOBAL_CUSTOM_AGENTS) {
    assert.ok(
      !drift.some((line) => line.includes(id)),
      `${id} is a global custom agent and is not drift`,
    )
  }
})

test("describeDrift reports subagents disabled in opencode.json", () => {
  const root = tempDir()
  const agentsDir = join(root, "agents")
  mkdirSync(agentsDir, { recursive: true })
  writeFileSync(
    join(agentsDir, "disabled-probe.md"),
    "---\ndescription: probe\nmode: subagent\n---\n\nbody\n",
  )
  writeFileSync(
    join(root, "opencode.json"),
    JSON.stringify({ agents: { "disabled-probe": { disabled: true } } }, null, 2),
  )

  const catalog = buildCatalog([agentsDir])
  const drift = describeDrift(catalog, [])

  assert.ok(
    drift.some(
      (line) => line.includes("disabled in opencode.json") && line.includes("disabled-probe"),
    ),
    "an indexed subagent that is disabled in the config is drift",
  )
})

test("describeDrift reports no disabled agent for the real bundle", () => {
  const catalog = bundleCatalog()
  const roster = readRoster([CATEGORIES_DIR])
  const drift = describeDrift(catalog, roster)

  assert.ok(
    !drift.some((line) => line.includes("disabled in opencode.json")),
    "the disabled built-ins of opencode.json have no agent file and are not drift",
  )
})

test("list groups the catalog by the category of the file path", () => {
  const catalog = bundleCatalog()
  const roster = readRoster([CATEGORIES_DIR])
  const output = list(catalog, roster)

  const { dir, file } = firstCategoryFile()
  const id = file.replace(/\.md$/, "")
  const count = catalog.agents.filter((agent) => agent.category === dir).length

  assert.match(output, new RegExp(`## ${dir} \\(${count}\\)`))
  assert.match(output, new RegExp(`\`${id}\``))
})

test("list honours a category filter", () => {
  const catalog = bundleCatalog()
  const roster = readRoster([CATEGORIES_DIR])
  const { dir, file } = firstCategoryFile()
  const id = file.replace(/\.md$/, "")

  const output = list(catalog, roster, dir.replace(/^\d+-/, "").replace(/-/g, " "))

  assert.match(output, new RegExp(`## ${dir}`))
  assert.match(output, new RegExp(`\`${id}\``))
  for (const other of bundleFiles()) {
    const otherId = basename(other, ".md")
    if (otherId === id) continue
    assert.ok(!output.includes(`\`${otherId}\``), `${otherId} is not in the filtered category`)
  }
})

test("list groups a flat installed file under the category of the roster", () => {
  const dir = tempDir()
  const roster = readRoster([CATEGORIES_DIR])
  const entry = roster.find((item) => item.agents.length > 0)
  assert.ok(entry)
  const id = entry.agents[0]

  writeFileSync(join(dir, `${id}.md`), "---\ndescription: probe\nmode: subagent\n---\n\nbody\n")
  const catalog = buildCatalog([dir], roster)
  const output = list(catalog, roster)

  assert.match(output, new RegExp(`## ${entry.name} \\(1\\)`))
  assert.match(output, new RegExp(`\`${id}\``))
})

test("list falls back to a flat list when the roster is missing", () => {
  const dir = tempDir()
  writeFileSync(
    join(dir, "solo-agent.md"),
    "---\ndescription: A solo agent.\nmode: subagent\n---\n\nbody\n",
  )
  const catalog = buildCatalog([dir], [])
  const output = list(catalog, [])

  assert.match(output, /## Agents/)
  assert.match(output, /`solo-agent`/)
})

test("invalid reports the refresh, the counts and the drift", () => {
  const catalog = bundleCatalog()
  const roster = readRoster([CATEGORIES_DIR])
  const output = invalid(catalog, roster)

  assert.match(output, /cached catalog was dropped and rebuilt from disk/)
  assert.match(output, new RegExp(`Agents indexed: ${catalog.agents.length}`))
  assert.match(output, /Drift against the roster/)
})

test("verify marks a passing acceptance command as ok", () => {
  const result = verify("echo wippa-verify-passed")

  assert.equal(result.exitCode, 0)
  assert.equal(result.ok, true)
  assert.ok(result.stdout.includes("wippa-verify-passed"))
})

test("verify marks a failing acceptance command as not ok and keeps its real exit code", () => {
  const result = verify("exit 3")

  assert.equal(result.exitCode, 3)
  assert.equal(result.ok, false)
})

test("verify captures the output of the acceptance command", () => {
  const result = verify("echo wippa-verify-stderr-out >&2; exit 0")

  assert.equal(result.exitCode, 0)
  assert.equal(result.ok, true)
  assert.ok(result.stderr.includes("wippa-verify-stderr-out"))
})
