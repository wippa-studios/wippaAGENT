import { resolve } from "node:path"

import {
  buildCatalog,
  fingerprint,
  readRoster,
  resolveAgentDirs,
  rosterFingerprint,
  scanFingerprint,
  type Catalog,
  type RosterCategory,
} from "./catalog.ts"
import { get, invalid, list, search, verify, type VerifyResult } from "./operations.ts"

/**
 * The plugin contract of `@opencode/plugin`.
 *
 * Upstream the package exports the plugin interface as a namespace —
 * `Plugin.Plugin`, with `Plugin.define` as an identity helper — and the
 * OpenCode host provides that package at runtime. It is not a dependency of
 * this repository and it is not installed here, so importing the namespace
 * would not resolve and this file would not type-check. The declarations
 * below spell out the subset of `Plugin.Context`, `Plugin.ToolEditor` and
 * `Plugin.StorageDomain` that this plugin uses.
 */
interface PluginPlugin {
  readonly id: string
  readonly setup: (context: PluginContext) => Promise<void> | void
}

/** The tool editor a transform callback receives. */
interface PluginToolEditor {
  namespace(namespace: { name: string; description?: string }): void
  add(tool: PluginToolDefinition): void
}

/** A tool definition, with the input schema the tool accepts. */
interface PluginToolDefinition {
  name: string
  description: string
  input: {
    type: "object"
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
    additionalProperties?: boolean
  }
  options?: { namespace?: string; codemode?: boolean }
  execute(input: unknown, context: PluginToolContext): Promise<{ content: string }>
}

/** The context a tool execution receives. */
interface PluginToolContext {
  progress(update: { status: string }): Promise<void>
}

/** The plugin context, reduced to the members this plugin reads. */
interface PluginContext {
  readonly location: { readonly directory: string }
  readonly storage: StorageLike
  readonly tool: {
    readonly transform: (callback: (editor: PluginToolEditor) => void) => Promise<unknown>
  }
}

const CACHE_KEY = "catalog"
const COMMAND_MAX_LENGTH = 10_000
const LIMIT_MAX = 1_000

// The storage API is awaited, so it may be synchronous or asynchronous.
interface StorageLike {
  get(key: string): unknown
  set(key: string, value: unknown): unknown
  remove(key: string): unknown
}

interface CachedCatalog {
  fingerprint: string
  /**
   * Fingerprint of the roster. The category fields of a catalog are read from
   * the roster at build time, and a roster edit leaves every agent file
   * untouched, so the file fingerprint alone cannot see it.
   */
  rosterFingerprint: string
  catalog: Catalog
}

interface LoadedCatalog {
  catalog: Catalog
  roster: RosterCategory[]
}

/**
 * Reads the cached catalog, rebuilding it when the cache is missing or when
 * the files on disk or the roster no longer match what the cache was built
 * from.
 */
async function loadCatalog(storage: StorageLike, cwd: string): Promise<LoadedCatalog> {
  const dirs = resolveAgentDirs(cwd)
  const roster = readRoster(dirs)
  const rosterDigest = rosterFingerprint(dirs)

  const cached = (await storage.get(CACHE_KEY)) as CachedCatalog | undefined
  if (
    cached &&
    cached.catalog &&
    cached.fingerprint === scanFingerprint(dirs) &&
    cached.rosterFingerprint === rosterDigest
  ) {
    return { catalog: cached.catalog, roster }
  }

  const catalog = buildCatalog(dirs)
  const entry: CachedCatalog = {
    fingerprint: fingerprint(catalog),
    rosterFingerprint: rosterDigest,
    catalog,
  }
  await storage.set(CACHE_KEY, entry)
  return { catalog, roster }
}

/**
 * Coerces a tool-input limit to an integer in 1..1000. A missing or non-finite
 * value takes the caller's default, which is what an unset optional field is.
 */
function coerceLimit(value: unknown, fallback: number | undefined): number | undefined {
  const number = typeof value === "number" ? value : Number.NaN
  if (!Number.isFinite(number)) return fallback
  return Math.min(LIMIT_MAX, Math.max(1, Math.floor(number)))
}

/** A tool input is untrusted: a non-string is treated as absent, not coerced. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

const plugin: PluginPlugin = {
  id: "wippa-subagent-tools",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "wippa",
        description:
          "Find, inspect and refresh the wippaAGENT subagent catalog, and run acceptance commands with a real exit code.",
      })

      editor.add({
        name: "subagent_search",
        description: "Find wippaAGENT subagents by name, by category, or by a word from their description.",
        input: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "An agent name fragment or a capability word, for example 'python'.",
            },
            limit: {
              type: "number",
              description: "Maximum number of matches to return. Defaults to 20.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false },
        execute: async (input, context) => {
          await context.progress({ status: "subagent_search" })
          const { query, limit } = input as { query?: unknown; limit?: unknown }
          const { catalog } = await loadCatalog(ctx.storage, ctx.location.directory)
          return { content: search(catalog, asString(query), coerceLimit(limit, 20)) }
        },
      })

      editor.add({
        name: "subagent_get",
        description: "Get the full definition of one wippaAGENT subagent, frontmatter included.",
        input: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The agent id, which is the file name without the .md extension.",
            },
          },
          required: ["id"],
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false },
        execute: async (input, context) => {
          await context.progress({ status: "subagent_get" })
          const { id } = input as { id?: unknown }
          const { catalog } = await loadCatalog(ctx.storage, ctx.location.directory)
          return { content: get(catalog, asString(id)) }
        },
      })

      editor.add({
        name: "subagent_list",
        description: "List every wippaAGENT subagent, grouped by the category of its agent file.",
        input: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Show only this category, for example 'Language Specialists'.",
            },
            limit: {
              type: "number",
              description: "Maximum number of agents to show per category. Defaults to all.",
            },
          },
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false },
        execute: async (input, context) => {
          await context.progress({ status: "subagent_list" })
          const { category, limit } = input as { category?: unknown; limit?: unknown }
          const { catalog, roster } = await loadCatalog(ctx.storage, ctx.location.directory)
          const coerced = coerceLimit(limit, undefined)
          return { content: list(catalog, roster, asString(category), coerced) }
        },
      })

      editor.add({
        name: "subagent_invalid",
        description: "Clear the cached subagent catalog and re-read it from disk.",
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false },
        execute: async (_input, context) => {
          await context.progress({ status: "subagent_invalid" })
          await ctx.storage.remove(CACHE_KEY)
          const { catalog, roster } = await loadCatalog(ctx.storage, ctx.location.directory)
          return { content: invalid(catalog, roster) }
        },
      })

      editor.add({
        name: "verify",
        description: "Run an acceptance command and report the real exit code, so a pass/fail verdict never rests on subagent prose.",
        input: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The acceptance command to run, for example 'npm test'.",
            },
            cwd: {
              type: "string",
              description: "The working directory to run the acceptance command in. Defaults to the current directory.",
            },
          },
          required: ["command"],
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false },
        execute: async (input, context) => {
          await context.progress({ status: "verify" })
          const { command, cwd } = input as { command?: unknown; cwd?: unknown }
          const location = resolve(ctx.location.directory)
          if (
            typeof command !== "string" ||
            command.trim().length === 0 ||
            command.length > COMMAND_MAX_LENGTH
          ) {
            const failure: VerifyResult = {
              command: "",
              exitCode: -1,
              ok: false,
              reason: "invalid-command",
              stdout: "",
              stderr: `command must be a non-empty string of at most ${COMMAND_MAX_LENGTH} characters`,
              cwd: location,
            }
            return { content: JSON.stringify(failure) }
          }
          // The default is the location directory, not the server process cwd,
          // and a relative cwd is resolved against it.
          const workingDir = typeof cwd === "string" && cwd.trim() ? resolve(location, cwd) : location
          const result = verify(command, workingDir)
          return { content: JSON.stringify(result) }
        },
      })
    })
  },
}

export default plugin
