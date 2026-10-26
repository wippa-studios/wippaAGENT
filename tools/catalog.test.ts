import assert from "node:assert/strict"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
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
import { deniedPattern, get, invalid, list, search, verify } from "./operations.ts"

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

test("search treats a zero or negative limit as uncapped", () => {
  const dir = tempDir()
  const ids = ["probe-a", "probe-b", "probe-c"]
  for (const id of ids) {
    writeFileSync(join(dir, `${id}.md`), "---\ndescription: probe agent\nmode: subagent\n---\n\nbody\n")
  }
  const catalog = buildCatalog([dir], [])

  const capped = search(catalog, "probe", 2)
  assert.match(capped, /Showing 2 of 3/)
  assert.ok(!capped.includes("`probe-c`"), "the cap hides the third match")

  for (const limit of [0, -5]) {
    const output = search(catalog, "probe", limit)
    for (const id of ids) {
      assert.ok(output.includes(`\`${id}\``), `${id} is shown for limit ${limit}`)
    }
    assert.ok(!output.includes("Showing"), `limit ${limit} adds no truncation note`)
  }
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

test("a global directory contributes only the agents the roster names", () => {
  const previous = process.env.OPENCODE_CONFIG_DIR
  const configDir = tempDir()
  const globalDir = join(configDir, "agents")
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(
    join(globalDir, "core-developer.md"),
    "---\ndescription: global core developer\nmode: subagent\n---\n\nbody\n",
  )
  writeFileSync(
    join(globalDir, "foreign-auditor.md"),
    "---\ndescription: an unrelated global agent\nmode: subagent\n---\n\nbody\n",
  )

  process.env.OPENCODE_CONFIG_DIR = configDir
  try {
    const roster: RosterCategory[] = [
      { name: "Core Development", count: 1, agents: ["core-developer"] },
    ]
    const catalog = buildCatalog([globalDir], roster)

    assert.deepEqual(
      catalog.agents.map((entry) => entry.id),
      ["core-developer"],
      "the unrelated global agent is not indexed",
    )
    assert.equal(catalog.agents[0]?.scope, "global")
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previous
  }
})

test("WIPPA_CUSTOM_AGENT_IDS adds a listed global agent to the catalog", () => {
  const previousConfig = process.env.OPENCODE_CONFIG_DIR
  const previousIds = process.env.WIPPA_CUSTOM_AGENT_IDS
  const configDir = tempDir()
  const globalDir = join(configDir, "agents")
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(
    join(globalDir, "claim-skeptic.md"),
    "---\ndescription: a user-owned global agent\nmode: subagent\n---\n\nbody\n",
  )

  process.env.OPENCODE_CONFIG_DIR = configDir
  process.env.WIPPA_CUSTOM_AGENT_IDS = "claim-skeptic"
  try {
    const roster: RosterCategory[] = [{ name: "Core Development", count: 1, agents: ["core-developer"] }]
    const catalog = buildCatalog([globalDir], roster)

    assert.deepEqual(catalog.agents.map((entry) => entry.id), ["claim-skeptic"])
    assert.equal(catalog.agents[0]?.category, undefined, "a custom agent carries no roster category")
  } finally {
    if (previousConfig === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previousConfig
    if (previousIds === undefined) delete process.env.WIPPA_CUSTOM_AGENT_IDS
    else process.env.WIPPA_CUSTOM_AGENT_IDS = previousIds
  }
})

test("scanFingerprint ignores a foreign file in the global directory", () => {
  const previous = process.env.OPENCODE_CONFIG_DIR
  const configDir = tempDir()
  const globalDir = join(configDir, "agents")
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(
    join(globalDir, "core-developer.md"),
    "---\ndescription: global core developer\nmode: subagent\n---\n\nbody\n",
  )

  process.env.OPENCODE_CONFIG_DIR = configDir
  try {
    const roster: RosterCategory[] = [
      { name: "Core Development", count: 1, agents: ["core-developer"] },
    ]
    const before = scanFingerprint([globalDir], roster)
    writeFileSync(
      join(globalDir, "foreign-auditor.md"),
      "---\ndescription: an unrelated global agent\nmode: subagent\n---\n\nbody\n",
    )

    assert.equal(scanFingerprint([globalDir], roster), before, "the foreign file is not indexed")
    assert.equal(
      scanFingerprint([globalDir], roster),
      fingerprint(buildCatalog([globalDir], roster)),
      "the scan and the build agree on what is indexed",
    )
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previous
  }
})

test("a project directory still indexes every file, roster or not", () => {
  const projectDir = tempDir()
  writeFileSync(
    join(projectDir, "team-agent.md"),
    "---\ndescription: a project-local agent\nmode: subagent\n---\n\nbody\n",
  )

  const roster: RosterCategory[] = [{ name: "Core Development", count: 1, agents: ["core-developer"] }]
  const catalog = buildCatalog([projectDir], roster)

  assert.deepEqual(catalog.agents.map((entry) => entry.id), ["team-agent"])
  assert.equal(catalog.agents[0]?.scope, "project")
})

test("the shipped bundle has no drift against its own roster", () => {
  const roster = readRoster([CATEGORIES_DIR])
  const catalog = buildCatalog([CATEGORIES_DIR], roster)

  assert.deepEqual(describeDrift(catalog, roster), [], "roster, files and counts agree")
  for (const agent of catalog.agents) {
    assert.equal(agent.mode, "subagent", `${agent.id} is a subagent`)
    assert.equal(agent.scope, "project", `${agent.id} comes from the bundle`)
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

test("describeDrift does not report the configured custom agents as missing files", () => {
  const catalog = bundleCatalog()
  const roster: RosterCategory[] = [
    { name: "Custom Agents", count: 3, agents: [...GLOBAL_CUSTOM_AGENTS] },
  ]

  const previous = process.env.WIPPA_CUSTOM_AGENT_IDS
  process.env.WIPPA_CUSTOM_AGENT_IDS = GLOBAL_CUSTOM_AGENTS.join(",")
  try {
    const drift = describeDrift(catalog, roster)
    for (const id of GLOBAL_CUSTOM_AGENTS) {
      assert.ok(
        !drift.some((line) => line.includes(id)),
        `${id} is a configured custom agent and is not drift`,
      )
    }
  } finally {
    if (previous === undefined) delete process.env.WIPPA_CUSTOM_AGENT_IDS
    else process.env.WIPPA_CUSTOM_AGENT_IDS = previous
  }
})

test("WIPPA_CUSTOM_AGENT_IDS suppresses the drift of exactly the listed ids", () => {
  const previous = process.env.WIPPA_CUSTOM_AGENT_IDS
  process.env.WIPPA_CUSTOM_AGENT_IDS = "custom-a, custom-b"
  try {
    const roster: RosterCategory[] = [
      { name: "Custom", count: 3, agents: ["custom-a", "custom-b", "still-drift"] },
    ]
    const drift = describeDrift(buildCatalog([tempDir()]), roster)

    assert.ok(!drift.some((line) => line.includes("custom-a")))
    assert.ok(!drift.some((line) => line.includes("custom-b")))
    assert.ok(drift.some((line) => line.includes("still-drift")), "an id outside the env list is drift")
  } finally {
    if (previous === undefined) delete process.env.WIPPA_CUSTOM_AGENT_IDS
    else process.env.WIPPA_CUSTOM_AGENT_IDS = previous
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

test("describeDrift unions the disabled agents of every candidate config", () => {
  const first = tempDir()
  const second = tempDir()
  const firstAgents = join(first, "agents")
  const secondAgents = join(second, "agents")
  mkdirSync(firstAgents, { recursive: true })
  mkdirSync(secondAgents, { recursive: true })

  writeFileSync(
    join(firstAgents, "disabled-a.md"),
    "---\ndescription: probe a\nmode: subagent\n---\n\nbody\n",
  )
  writeFileSync(
    join(secondAgents, "disabled-b.md"),
    "---\ndescription: probe b\nmode: subagent\n---\n\nbody\n",
  )
  writeFileSync(
    join(first, "opencode.json"),
    JSON.stringify({ agents: { "disabled-a": { disabled: true } } }, null, 2),
  )
  writeFileSync(
    join(second, "opencode.json"),
    JSON.stringify({ agents: { "disabled-b": { disabled: true } } }, null, 2),
  )

  const drift = describeDrift(buildCatalog([firstAgents, secondAgents]), [])

  for (const id of ["disabled-a", "disabled-b"]) {
    assert.ok(
      drift.some((line) => line.includes("disabled in opencode.json") && line.includes(id)),
      `${id} is disabled in one of the candidate configs`,
    )
  }
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

test("list treats a zero or negative limit as uncapped", () => {
  const dir = tempDir()
  const roster: RosterCategory[] = [
    { name: "Probe Group", count: 3, agents: ["probe-a", "probe-b", "probe-c"] },
  ]
  for (const id of roster[0].agents) {
    writeFileSync(join(dir, `${id}.md`), "---\ndescription: probe agent\nmode: subagent\n---\n\nbody\n")
  }
  const catalog = buildCatalog([dir], roster)

  const capped = list(catalog, roster, undefined, 2)
  assert.match(capped, /1 more in this category/)
  assert.ok(!capped.includes("`probe-c`"), "the cap hides the third agent")

  for (const limit of [0, -5]) {
    const output = list(catalog, roster, undefined, limit)
    for (const id of roster[0].agents) {
      assert.ok(output.includes(`\`${id}\``), `${id} is shown for limit ${limit}`)
    }
    assert.ok(!output.includes("more in this category"), `limit ${limit} adds no more-line`)
  }
})

test("invalid reports the refresh, the counts and the drift", () => {
  const catalog = bundleCatalog()
  const roster = readRoster([CATEGORIES_DIR])
  const output = invalid(catalog, roster)

  assert.match(output, /The cached catalog was dropped and rebuilt from disk\./)
  assert.ok(!output.includes("Cache cleared"), "the refresh line states the fact without the overclaim")
  assert.match(output, new RegExp(`Agents indexed: ${catalog.agents.length}`))
  assert.match(output, /Drift against the roster/)
})

test("deniedPattern names the shell rules the agent set ships", () => {
  assert.equal(deniedPattern("rm -rf build"), "rm -rf *")
  assert.equal(deniedPattern("rm -rf /"), "rm -rf *")
  assert.equal(deniedPattern("sudo apt-get install x"), "sudo *")
  assert.equal(deniedPattern("git push --force origin main"), "git push --force *")
  assert.equal(deniedPattern("npm test && sudo make install"), "sudo *")
})

test("deniedPattern leaves ordinary commands alone", () => {
  for (const command of [
    "npm test",
    "echo rm -rf sudo",
    "git push origin main",
    "rm -f build/output.js",
    "pnpm --filter web run build",
  ]) {
    assert.equal(deniedPattern(command), undefined, command)
  }
})

test("verify refuses a denied pattern and never spawns the command", async () => {
  const dir = tempDir()
  const marker = join(dir, "marker.txt")
  writeFileSync(marker, "untouched\n")

  const result = await verify({ command: "rm -rf *", cwd: dir })
  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "denied-pattern")
  assert.equal(result.stdout, "")
  assert.match(result.stderr, /rm -rf \*/)
  assert.equal(readFileSync(marker, "utf8"), "untouched\n", "nothing ran")
})

test("verify marks a passing acceptance command as ok", async () => {
  const result = await verify("echo wippa-verify-passed")

  assert.equal(result.exitCode, 0)
  assert.equal(result.ok, true)
  assert.ok(result.stdout.includes("wippa-verify-passed"))
})

test("verify marks a failing acceptance command as not ok and keeps its real exit code", async () => {
  const result = await verify("exit 3")

  assert.equal(result.exitCode, 3)
  assert.equal(result.ok, false)
})

test("verify captures the output of the acceptance command", async () => {
  const result = await verify("echo wippa-verify-stderr-out >&2; exit 0")

  assert.equal(result.exitCode, 0)
  assert.equal(result.ok, true)
  assert.ok(result.stderr.includes("wippa-verify-stderr-out"))
})

test("verify reports a timeout instead of waiting for the command", async () => {
  const started = Date.now()
  const result = await verify({ command: "sleep 5", timeoutMs: 1_000 })
  const elapsed = Date.now() - started

  assert.equal(result.ok, false)
  assert.equal(result.reason, "timeout")
  assert.equal(result.exitCode, -1)
  assert.ok(elapsed < 4_000, `the run was killed rather than waited out (${elapsed}ms)`)
  assert.equal(result.cwd, process.cwd())
})

test("verify does not block the event loop while the command runs", async () => {
  let ticks = 0
  const timer = setInterval(() => {
    ticks += 1
  }, 10)
  try {
    const result = await verify({ command: "sleep 0.3" })
    assert.equal(result.ok, true)
    assert.ok(ticks >= 5, `timers kept running during the command (${ticks} ticks)`)
  } finally {
    clearInterval(timer)
  }
})

test("verify stops a running command when its signal aborts", async () => {
  const controller = new AbortController()
  const started = Date.now()
  setTimeout(() => controller.abort(), 50)

  const result = await verify({ command: "sleep 5", signal: controller.signal })
  const elapsed = Date.now() - started

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "aborted")
  assert.ok(elapsed < 3_000, `the command was killed rather than waited out (${elapsed}ms)`)
})

test("verify does not start a command when the signal is already aborted", async () => {
  const dir = tempDir()
  const controller = new AbortController()
  controller.abort()

  const result = await verify({ command: `touch ${join(dir, "ran.txt")}`, signal: controller.signal })

  assert.equal(result.ok, false)
  assert.equal(result.reason, "aborted")
  assert.equal(result.durationMs, 0)
  assert.deepEqual(readdirSync(dir), [], "nothing ran")
})

test("verify reports how long the command ran", async () => {
  const result = await verify({ command: "sleep 0.2" })

  assert.equal(result.ok, true)
  assert.ok(result.durationMs >= 150, `the duration covers the run (${result.durationMs}ms)`)
  assert.ok(result.durationMs < 5_000, `the duration is not inflated (${result.durationMs}ms)`)
})

test("verify truncates a large stream keeping the head and the tail", async () => {
  const result = await verify({ command: "seq 1 20000", outputLimit: 4_096 })

  assert.equal(result.exitCode, 0)
  assert.equal(result.ok, true)
  assert.ok(result.stdout.length < 6_000, "the stream is capped")
  assert.match(result.stdout, /\[truncated: kept first 2048 and last 2048 of \d+ characters\]/)
  assert.ok(result.stdout.startsWith("1\n2\n"), "the head of the output is kept")
  assert.ok(result.stdout.trimEnd().endsWith("20000"), "the tail of the output is kept")
})

test("verify truncates stderr too", async () => {
  const result = await verify({ command: "seq 1 20000 >&2", outputLimit: 4_096 })

  assert.equal(result.exitCode, 0)
  assert.ok(result.stderr.includes("[truncated: kept first 2048 and last 2048 of"))
  assert.ok(result.stderr.length < 6_000)
})

test("verify reports an output limit when maxBuffer is exceeded", async () => {
  const result = await verify({ command: "seq 1 100000", maxBuffer: 1_024 })

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "output-limit")

  const truncated = await verify({ command: "seq 1 100000", maxBuffer: 1_024, outputLimit: 256 })
  assert.ok(truncated.stdout.includes("[truncated: kept first 128 and last 128 of"))
})

test("verify reports a working directory that does not exist", async () => {
  const missing = join(tempDir(), "does-not-exist")
  const result = await verify({ command: "echo hi", cwd: missing })

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "cwd-not-found")
  assert.equal(result.stdout, "")
  assert.ok(result.stderr.includes(missing))
  assert.equal(result.cwd, missing)
})

test("verify runs in the requested directory and records it as absolute", async () => {
  const dir = tempDir()
  writeFileSync(join(dir, "marker.txt"), "wippa-cwd-marker\n")

  const result = await verify("cat marker.txt", dir)
  assert.equal(result.exitCode, 0)
  assert.equal(result.ok, true)
  assert.ok(result.stdout.includes("wippa-cwd-marker"))
  assert.equal(result.cwd, dir)

  const relative = await verify("pwd", ".")
  assert.equal(relative.cwd, process.cwd())
})

test("parseRoster does not read an unrecognised table header as an agent id", () => {
  const markdown = [
    "## Your roster",
    "",
    "### Probe",
    "",
    "| probe-header | probe-category |",
    "| --- | --- |",
    "| `real-agent` | Probe |",
    "",
  ].join("\n")

  const roster = parseRoster(markdown)
  const ids = roster.flatMap((category) => category.agents)

  assert.deepEqual(ids, ["real-agent"])
  assert.ok(!ids.includes("probe-header"), "the header row is not a phantom agent id")
})

test("parseRoster still reads a table whose data follows a separator without a header", () => {
  const markdown = [
    "## Your roster",
    "",
    "### Probe",
    "",
    "| --- | --- |",
    "| `only-agent` | Probe |",
    "",
  ].join("\n")

  const roster = parseRoster(markdown)
  assert.deepEqual(
    roster.flatMap((category) => category.agents),
    ["only-agent"],
  )
})

test("parseFrontmatter reads a folded block scalar", () => {
  const text = [
    "---",
    "description: >",
    "  First line of the description",
    "  continues on the second line.",
    "mode: subagent",
    "---",
    "",
    "body",
  ].join("\n")

  const { data, body } = parseFrontmatter(text)
  assert.equal(data.description, "First line of the description continues on the second line.")
  assert.equal(data.mode, "subagent")
  assert.equal(body, "body")
})

test("parseFrontmatter reads a literal block scalar", () => {
  const text = ["---", "description: |", "  first", "  second", "---", "", "body"].join("\n")

  const { data } = parseFrontmatter(text)
  assert.equal(data.description, "first\nsecond")
})

test("parseFrontmatter tolerates a blank line before the opening fence", () => {
  const text = "\n---\ndescription: probe\nmode: subagent\n---\n\nbody\n"

  const { data, body } = parseFrontmatter(text)
  assert.equal(data.description, "probe")
  assert.equal(data.mode, "subagent")
  assert.equal(body, "body\n")
})

test("fingerprint detects a same-size content edit at the same mtime", () => {
  const dir = tempDir()
  const path = join(dir, "sample.md")
  const before = "---\ndescription: alpha\n---\n\nbody\n"
  const after = "---\ndescription: bravo\n---\n\nbody\n"
  assert.equal(before.length, after.length, "the two versions have the same size")

  const fixedMtime = new Date(Date.now() - 120_000)
  writeFileSync(path, before)
  utimesSync(path, fixedMtime, fixedMtime)
  const first = fingerprint(buildCatalog([dir]))

  writeFileSync(path, after)
  utimesSync(path, fixedMtime, fixedMtime)
  const second = fingerprint(buildCatalog([dir]))

  assert.equal(statSync(path).mtimeMs, fixedMtime.getTime(), "the mtime is really the same")
  assert.equal(statSync(path).size, before.length, "the size is really the same")
  assert.notEqual(first, second, "the content digest catches the edit")
})

test("scanFingerprint mirrors the digest and detects a same-size content edit", () => {
  const dir = tempDir()
  const path = join(dir, "sample.md")
  const before = "---\ndescription: alpha\n---\n\nbody\n"
  const after = "---\ndescription: bravo\n---\n\nbody\n"

  const fixedMtime = new Date(Date.now() - 120_000)
  writeFileSync(path, before)
  utimesSync(path, fixedMtime, fixedMtime)
  const first = scanFingerprint([dir])
  assert.equal(first, fingerprint(buildCatalog([dir])), "the scan matches a fresh build")

  writeFileSync(path, after)
  utimesSync(path, fixedMtime, fixedMtime)
  const second = scanFingerprint([dir])

  assert.notEqual(first, second, "the scan reads the content and sees the edit")
  assert.equal(second, fingerprint(buildCatalog([dir])), "the scan still matches a fresh build")
})

test("a project agents file overrides the bundle for the same id", () => {
  const root = tempDir()
  const agents = join(root, "agents")
  mkdirSync(agents, { recursive: true })
  writeFileSync(
    join(agents, "core-developer.md"),
    "---\ndescription: project override probe\nmode: subagent\n---\n\nbody\n",
  )

  const dirs = resolveAgentDirs(root)
  assert.ok(
    dirs.indexOf(agents) < dirs.indexOf(CATEGORIES_DIR),
    "the project directory is searched before the bundle",
  )

  const catalog = buildCatalog(dirs)
  const agent = catalog.agents.find((entry) => entry.id === "core-developer")
  assert.ok(agent)
  assert.ok(agent.path.startsWith(agents), `the project file wins (${agent.path})`)
  assert.equal(agent.description, "project override probe")
})

test("resolveAgentDirs honours OPENCODE_CONFIG_DIR for the global directory", () => {
  const previousConfig = process.env.OPENCODE_CONFIG_DIR
  const previousHome = process.env.HOME
  const home = tempDir()
  const configDir = join(home, "opencode-config")
  const globalAgents = join(configDir, "agents")
  mkdirSync(globalAgents, { recursive: true })

  process.env.OPENCODE_CONFIG_DIR = configDir
  process.env.HOME = home
  try {
    const dirs = resolveAgentDirs(tempDir())
    assert.ok(dirs.includes(globalAgents), "the override directory is indexed")
    assert.ok(
      !dirs.includes(join(home, ".config", "opencode", "agents")),
      "the default location is not indexed when the override is set",
    )
  } finally {
    if (previousConfig === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previousConfig
    if (previousHome === undefined) delete process.env.HOME
    else process.env.HOME = previousHome
  }
})

test("an empty OPENCODE_CONFIG_DIR is treated as unset, like install.sh does", () => {
  const previousConfig = process.env.OPENCODE_CONFIG_DIR
  const previousHome = process.env.HOME
  const home = tempDir()
  const defaultAgents = join(home, ".config", "opencode", "agents")
  mkdirSync(defaultAgents, { recursive: true })

  process.env.HOME = home
  try {
    for (const value of ["", "   "]) {
      process.env.OPENCODE_CONFIG_DIR = value
      const dirs = resolveAgentDirs(tempDir())
      assert.ok(
        dirs.includes(defaultAgents),
        `${JSON.stringify(value)} falls back to the home configuration`,
      )
    }
  } finally {
    if (previousConfig === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previousConfig
    if (previousHome === undefined) delete process.env.HOME
    else process.env.HOME = previousHome
  }
})
