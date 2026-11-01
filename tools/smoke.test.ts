import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import type { Plugin } from "@opencode/plugin"

import plugin from "./index.ts"

// ---------------------------------------------------------------------------
// The real-type smoke test
// ---------------------------------------------------------------------------
//
// plugin.test.ts drives the plugin through hand-written copies of the context
// types. This file drives it through the real `@opencode/plugin` declarations:
// the host below is checked with `satisfies` against the members of
// `Plugin.Context` this plugin reads, the registered tools are stored as real
// tool definitions, and every execution context is a real `ToolContext`. When
// the upstream interface drifts, this file stops type-checking before any
// assertion runs; `tools/index.ts` itself is declared as `Plugin.Plugin` for
// the same reason.
//
// The branded fields of the real types (session and message ids, the absolute
// location directory) cannot be spelled as literals by a fixture. Each one is
// produced with a single leaf cast from the plain value; everything around the
// leaf is checked structurally.

type ToolDomain = Plugin.Context["tool"]
type ToolEditor = Parameters<Parameters<ToolDomain["transform"]>[0]>[0]
type ToolDefinition = Parameters<ToolEditor["add"]>[0]
type ToolContext = Parameters<ToolDefinition["execute"]>[1]
type Storage = Plugin.Context["storage"]
type DiffRequest = Parameters<Plugin.Context["vcs"]["diff"]>[1]
type DiffInput = Parameters<Plugin.Context["vcs"]["diff"]>[0]
type DiffOutput = Awaited<ReturnType<Plugin.Context["vcs"]["diff"]>>
type AssertInput = Parameters<Plugin.Context["permission"]["assert"]>[0]

/** The members of the real context this plugin reads, and nothing else. */
interface UsedContext {
  readonly location: Plugin.Context["location"]
  readonly storage: Storage
  readonly permission: Pick<Plugin.Context["permission"], "assert">
  readonly vcs: Pick<Plugin.Context["vcs"], "diff">
  readonly tool: Pick<Plugin.Context["tool"], "transform">
}

/** A project scope with one flat agent and its roster, as install.sh writes it. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "wippa-smoke-"))
  const agents = join(root, "agents")
  mkdirSync(agents, { recursive: true })
  writeFileSync(
    join(agents, "smoke-probe.md"),
    "---\ndescription: Smoke probe agent.\nmode: subagent\n---\n\nSmoke body.\n",
  )
  writeFileSync(
    join(agents, "wippaAGENT.md"),
    [
      "## Your roster",
      "",
      "| Agent | Category |",
      "| --- | --- |",
      "| `smoke-probe` | Smoke Group |",
      "",
    ].join("\n"),
  )
  return root
}

function smokeHost(directory: string): {
  host: UsedContext
  tools: ToolDefinition[]
  namespace(): { name: string; description: string } | undefined
  permissionCalls: AssertInput[]
  diffCalls: (DiffInput & { signal?: AbortSignal })[]
  setDiffFiles(files: DiffOutput["data"]): void
} {
  const namespaceHolder: { value: { name: string; description: string } | undefined } = {
    value: undefined,
  }
  const tools: ToolDefinition[] = []
  const permissionCalls: AssertInput[] = []
  const diffCalls: (DiffInput & { signal?: AbortSignal })[] = []
  const cache = new Map<string, Parameters<Storage["set"]>[1]>()
  let diffFiles: DiffOutput["data"] = []

  const host = {
    location: {
      directory: directory as Plugin.Context["location"]["directory"],
      project: {
        id: "smoke" as Plugin.Context["location"]["project"]["id"],
        directory: directory as Plugin.Context["location"]["project"]["directory"],
        canonical: directory as Plugin.Context["location"]["project"]["canonical"],
      },
    },
    storage: {
      async get(key: string) {
        return cache.get(key)
      },
      async set(key: string, value: Parameters<Storage["set"]>[1]) {
        cache.set(key, value)
      },
      async remove(key: string) {
        cache.delete(key)
      },
      async scan() {
        return { entries: [] }
      },
    },
    permission: {
      async assert(input: AssertInput) {
        permissionCalls.push(input)
      },
    },
    vcs: {
      async diff(input: DiffInput, options?: DiffRequest) {
        diffCalls.push({ ...input, signal: options?.signal })
        return {
          location: {
            directory: directory as DiffOutput["location"]["directory"],
          },
          data: diffFiles,
        }
      },
    },
    tool: {
      async transform(callback: (editor: ToolEditor) => void) {
        callback({
          list: () => [],
          get: () => undefined,
          namespace(value) {
            namespaceHolder.value = value
          },
          add(tool) {
            tools.push(tool)
          },
          update() {},
          remove() {},
        })
        return { dispose: async () => {} }
      },
    },
  } satisfies UsedContext

  return {
    host,
    tools,
    namespace: () => namespaceHolder.value,
    permissionCalls,
    diffCalls,
    setDiffFiles(files) {
      diffFiles = files
    },
  }
}

/** The real execution context: branded ids from a fixture need one leaf cast each. */
function toolContext(): ToolContext {
  return {
    sessionID: "ses_smoke" as ToolContext["sessionID"],
    agent: "wippaAGENT" as ToolContext["agent"],
    messageID: "msg_smoke" as ToolContext["messageID"],
    id: "call_smoke" as ToolContext["id"],
    signal: new AbortController().signal,
    progress: async () => {},
  }
}

function runTool(
  tools: ToolDefinition[],
  name: string,
  input: unknown,
  context: ToolContext,
): Promise<{ content: string }> {
  const found = tools.find((entry) => entry.name === name)
  assert.ok(found, `${name} is registered`)
  return found.execute(input, context).then((result) => {
    assert.equal(typeof result.content, "string", `${name} returns text content`)
    return { content: result.content as string }
  })
}

test("the plugin object is a real Plugin.Plugin and registers its tools through the real editor", async () => {
  const root = fixture()
  const { host, tools, namespace } = smokeHost(root)

  await plugin.setup(host as Plugin.Context)

  assert.equal(plugin.id, "wippa-subagent-tools")
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["subagent_search", "subagent_get", "subagent_list", "subagent_invalid", "verify", "diff", "plan_update"],
  )
  assert.equal(namespace()?.name, "wippa")
  assert.ok((namespace()?.description ?? "").length > 0)
})

test("a real-typed tool call runs against a real fixture and the real permission check", async () => {
  const root = fixture()
  const { host, tools, permissionCalls } = smokeHost(root)
  await plugin.setup(host as Plugin.Context)
  const context = toolContext()

  const found = await runTool(tools, "subagent_search", { query: "smoke-probe" }, context)
  assert.match(found.content, /`smoke-probe`/, "the fixture agent is found through the real context")
  assert.match(found.content, /Smoke probe agent\./)
  assert.equal(permissionCalls.length, 0, "a read-only tool asks for no permission")

  const verified = await runTool(tools, "verify", { command: "echo wippa-smoke" }, context)
  const verdict = JSON.parse(verified.content)
  assert.equal(verdict.ok, true)
  assert.ok(verdict.stdout.includes("wippa-smoke"))
  assert.equal(permissionCalls.length, 1, "verify asserts its permission before it runs")
  assert.equal(permissionCalls[0]?.action, "verify")
  assert.equal(permissionCalls[0]?.sessionID, "ses_smoke")
})

test("the diff tool unwraps the real VcsDiffOutput envelope", async () => {
  const root = fixture()
  const { host, tools, diffCalls, setDiffFiles } = smokeHost(root)
  const files = [
    {
      file: "src/a.ts",
      patch: "@@ -1 +1 @@\n-old\n+new\n",
      additions: 1,
      deletions: 1,
      status: "modified" as const,
    },
  ]
  setDiffFiles(files)
  await plugin.setup(host as Plugin.Context)

  const result = await runTool(tools, "diff", { mode: "working" }, toolContext())

  assert.deepEqual(JSON.parse(result.content), files)
  assert.equal(diffCalls.length, 1)
  assert.equal(diffCalls[0]?.mode, "working")
  assert.equal(diffCalls[0]?.context, 3)
})

test("plan_update writes .opencode/PLAN.md in smoke environment", async () => {
  const root = fixture()
  const { host, tools } = smokeHost(root)
  await plugin.setup(host as Plugin.Context)
  const context = toolContext()

  const content = "# Smoke Plan\n"
  const resultJson = await runTool(tools, "plan_update", { content }, context)
  const result = JSON.parse(resultJson.content)
  assert.equal(result.ok, true)
  assert.equal(result.path, ".opencode/PLAN.md")
  assert.equal(result.bytes, Buffer.byteLength(content, "utf8"))
  assert.equal(readFileSync(join(root, ".opencode", "PLAN.md"), "utf8"), content)
})
