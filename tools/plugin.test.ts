import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import plugin from "./index.ts"

// ---------------------------------------------------------------- fake host

// The plugin's context, editor and tool types are declared in index.ts but not
// exported, and this test drives the plugin through its real entry point rather
// than a copy of those types. The fake host is therefore cast once, here.

interface FakeToolDefinition {
  name: string
  description: string
  input: {
    type: string
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
    additionalProperties?: boolean
  }
  options?: { namespace?: string; codemode?: boolean }
  execute(
    input: unknown,
    context: { progress: (update: { status: string }) => Promise<void> },
  ): Promise<{ content: string }>
}

interface FakeEditor {
  namespace(namespace: { name: string; description?: string }): void
  add(tool: FakeToolDefinition): void
}

interface FakeContext {
  location: { directory: string }
  storage: {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
  }
  tool: { transform(callback: (editor: FakeEditor) => void): Promise<void> }
}

const setup = plugin.setup as unknown as (context: FakeContext) => Promise<void> | void

interface FakeHost {
  context: FakeContext
  tools: FakeToolDefinition[]
  namespace(): { name: string; description?: string } | undefined
}

function fakeHost(directory: string): FakeHost {
  const cache = new Map<string, unknown>()
  const tools: FakeToolDefinition[] = []
  let namespace: { name: string; description?: string } | undefined

  const context: FakeContext = {
    location: { directory },
    storage: {
      async get(key) {
        return cache.get(key)
      },
      async set(key, value) {
        cache.set(key, value)
      },
      async remove(key) {
        cache.delete(key)
      },
    },
    tool: {
      async transform(callback) {
        callback({
          namespace(value) {
            namespace = value
          },
          add(tool) {
            tools.push(tool)
          },
        })
      },
    },
  }

  return { context, tools, namespace: () => namespace }
}

async function runTool(host: FakeHost, name: string, input: unknown): Promise<string> {
  const tool = host.tools.find((entry) => entry.name === name)
  assert.ok(tool, `${name} is registered`)
  const result = await tool.execute(input, { progress: async () => {} })
  return result.content
}

// ---------------------------------------------------------------- fixture

function probeAgent(description: string): string {
  return `---\ndescription: ${description}\nmode: subagent\n---\n\nProbe body.\n`
}

function probeRoster(category: string): string {
  return [
    "## Your roster",
    "",
    "Three probe agents.",
    "",
    "| Agent | Category | Covers |",
    "| --- | --- | --- |",
    `| \`probe-alpha\` | ${category} | probing |`,
    `| \`probe-beta\` | ${category} | probing |`,
    `| \`probe-gamma\` | ${category} | probing |`,
    "",
  ].join("\n")
}

/** A project scope with three flat agents and a roster, as install.sh writes it. */
function probeFixture(rosterBeside = false): { root: string; agents: string; roster: string } {
  const root = mkdtempSync(join(tmpdir(), "wippa-plugin-"))
  const agents = join(root, "agents")
  mkdirSync(agents, { recursive: true })
  writeFileSync(join(agents, "probe-alpha.md"), probeAgent("Alpha probe agent."))
  writeFileSync(join(agents, "probe-beta.md"), probeAgent("Beta probe agent."))
  writeFileSync(join(agents, "probe-gamma.md"), probeAgent("Gamma probe agent."))

  const roster = rosterBeside ? join(root, "agentWIPPA.md") : join(agents, "agentWIPPA.md")
  writeFileSync(roster, probeRoster("Probe Group"))
  return { root, agents, roster }
}

// ---------------------------------------------------------------- tests

test("setup registers the five wippa tools in the wippa namespace", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  assert.equal(plugin.id, "wippa-subagent-tools")
  assert.deepEqual(
    host.tools.map((tool) => tool.name),
    ["subagent_search", "subagent_get", "subagent_list", "subagent_invalid", "verify"],
  )
  for (const tool of host.tools) {
    assert.deepEqual(tool.options, { namespace: "wippa", codemode: false })
    assert.equal(tool.input.type, "object")
    assert.ok(tool.description.length > 0, `${tool.name} carries a description`)
  }
  assert.deepEqual(host.tools.find((tool) => tool.name === "subagent_search")?.input.required, [
    "query",
  ])
  assert.deepEqual(host.tools.find((tool) => tool.name === "verify")?.input.required, ["command"])

  assert.equal(host.namespace()?.name, "wippa")
  assert.equal(
    host.namespace()?.description,
    "Find, inspect and refresh the wippaAGENT subagent catalog, and run acceptance commands with a real exit code.",
  )
})

test("subagent_search returns a match for a fixture agent", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const content = await runTool(host, "subagent_search", { query: "probe-alpha" })
  assert.match(content, /`probe-alpha`/)
  assert.match(content, /Alpha probe agent\./)
})

test("subagent_list groups the fixture agents by their roster category", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const content = await runTool(host, "subagent_list", {})
  assert.match(content, /## Probe Group \(3\)/)
  assert.match(content, /`probe-beta`/)
})

test("subagent_search treats limit 0 as uncapped and limit 2 as a cap", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  // The bundle ships its own agents beside the fixture ones, so only the
  // fixture rows are pinned; the cap itself is what the assertion checks.
  const capped = await runTool(host, "subagent_search", { query: "probe", limit: 2 })
  assert.match(capped, /Showing 2 of \d+/)
  assert.ok(!capped.includes("`probe-gamma`"), "the cap hides the third match")

  const uncapped = await runTool(host, "subagent_search", { query: "probe", limit: 0 })
  for (const id of ["probe-alpha", "probe-beta", "probe-gamma"]) {
    assert.ok(uncapped.includes(`\`${id}\``), `${id} is shown for limit 0`)
  }
  assert.ok(!uncapped.includes("Showing"), "limit 0 adds no truncation note")
})

test("subagent_list treats limit 0 as uncapped and limit 2 as a cap", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const capped = await runTool(host, "subagent_list", { limit: 2 })
  assert.match(capped, /1 more in this category/)
  assert.ok(!capped.includes("`probe-gamma`"), "the cap hides the third agent")

  const uncapped = await runTool(host, "subagent_list", { limit: 0 })
  assert.match(uncapped, /`probe-gamma`/)
  assert.ok(!uncapped.includes("more in this category"), "limit 0 adds no more-line")
})

test("subagent_search accepts the 1000 boundary and a limit above the maximum", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  // Above the maximum the limit clamps to 1000, which is larger than every
  // fixture match, so both values must take the same path as an uncapped
  // search: 1001 is accepted rather than rejected as a bad input.
  for (const limit of [1_000, 1_001]) {
    const content = await runTool(host, "subagent_search", { query: "probe", limit })
    assert.match(content, /agents? match "probe"\./)
    for (const id of ["probe-alpha", "probe-beta", "probe-gamma"]) {
      assert.ok(content.includes(`\`${id}\``), `${id} is shown for limit ${limit}`)
    }
    assert.ok(!content.includes("Showing"), `limit ${limit} truncates nothing`)
  }
})

test("subagent_list accepts a limit above the maximum without truncating a small category", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const content = await runTool(host, "subagent_list", { limit: 1_001 })
  assert.match(content, /## Probe Group \(3\)/)
  for (const id of ["probe-alpha", "probe-beta", "probe-gamma"]) {
    assert.ok(content.includes(`\`${id}\``), `${id} is shown`)
  }
  assert.ok(
    !content.includes("more in this category"),
    "the clamped limit is above every category",
  )
})

test("a non-string query, id or category is treated as absent, not coerced", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  // A number in a string position must reach the friendly message path rather
  // than throw or match the literal text.
  assert.match(await runTool(host, "subagent_search", { query: 123 }), /A query is required\./)

  const get = await runTool(host, "subagent_get", { id: 42 })
  assert.match(
    get,
    /No agent with the id "" is installed\./,
    "the number is absent, not stringified to \"42\"",
  )
  assert.match(get, /wippa_subagent_search/)

  const list = await runTool(host, "subagent_list", { category: 7 })
  assert.match(list, /## Probe Group \(3\)/)
  assert.match(list, /`probe-alpha`/)
})

test("verify runs an acceptance command and returns the verdict as JSON", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const content = await runTool(host, "verify", { command: "echo wippa-plugin-verify" })
  const result = JSON.parse(content)

  assert.equal(result.ok, true)
  assert.equal(result.exitCode, 0)
  assert.ok(result.stdout.includes("wippa-plugin-verify"))
  assert.equal(result.cwd, root, "the location directory is the default working directory")
})

test("verify rejects a bad command without spawning anything", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  for (const bad of ["", "   ", "x".repeat(10_001), 42, undefined]) {
    const result = JSON.parse(await runTool(host, "verify", { command: bad }))
    assert.equal(result.ok, false, `${String(bad).slice(0, 20)} is rejected`)
    assert.equal(result.exitCode, -1)
    assert.equal(result.reason, "invalid-command")
    assert.equal(result.command, "")
    assert.match(result.stderr, /command must be a non-empty string of at most 10000 characters/)
    assert.equal(result.cwd, root)
  }
})

test("verify passes timeoutMs through to the command", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const tool = host.tools.find((entry) => entry.name === "verify")
  assert.ok(tool?.input.properties.timeoutMs, "the tool input exposes timeoutMs")

  const started = Date.now()
  const result = JSON.parse(await runTool(host, "verify", { command: "sleep 5", timeoutMs: 500 }))
  const elapsed = Date.now() - started

  assert.equal(result.ok, false)
  assert.equal(result.reason, "timeout")
  assert.equal(result.exitCode, -1)
  // 500 is raised to the 1000ms floor inside verify: far below the 5s the
  // command would take, and below the 300s default.
  assert.ok(elapsed >= 500 && elapsed < 3_000, `killed at ~1s rather than waited out (${elapsed}ms)`)
})

test("editing the roster invalidates the cached catalog", async () => {
  const { root, roster } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const first = await runTool(host, "subagent_list", {})
  assert.match(first, /## Probe Group \(3\)/)

  writeFileSync(roster, probeRoster("Renamed Group"))

  const second = await runTool(host, "subagent_list", {})
  assert.match(second, /## Renamed Group \(3\)/)
  assert.ok(!second.includes("## Probe Group"), "the cached category fields are not reused")
})

test("a roster beside the agents directory still invalidates the cache", async () => {
  // The roster is not itself an agent file here, so only the roster
  // fingerprint can see the edit and force a rebuild.
  const { root, roster } = probeFixture(true)
  const host = fakeHost(root)
  await setup(host.context)

  const first = await runTool(host, "subagent_list", {})
  assert.match(first, /## Probe Group \(3\)/)

  writeFileSync(roster, probeRoster("Beside Renamed"))

  const second = await runTool(host, "subagent_list", {})
  assert.match(second, /## Beside Renamed \(3\)/)
  assert.ok(!second.includes("## Probe Group"), "the cached category fields are not reused")
})
