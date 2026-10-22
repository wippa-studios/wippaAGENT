import {
  buildCatalog,
  fingerprint,
  readRoster,
  resolveAgentDirs,
  scanFingerprint,
  type Catalog,
  type RosterCategory,
} from "./catalog.ts"
import { get, invalid, list, search } from "./operations.ts"

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

// The storage API is awaited, so it may be synchronous or asynchronous.
interface StorageLike {
  get(key: string): unknown
  set(key: string, value: unknown): unknown
  remove(key: string): unknown
}

interface CachedCatalog {
  fingerprint: string
  catalog: Catalog
}

interface LoadedCatalog {
  catalog: Catalog
  roster: RosterCategory[]
}

/**
 * Reads the cached catalog, rebuilding it when the cache is missing or when the
 * files on disk no longer match the fingerprint the cache was built from.
 */
async function loadCatalog(storage: StorageLike, cwd: string): Promise<LoadedCatalog> {
  const dirs = resolveAgentDirs(cwd)
  const roster = readRoster(dirs)

  const cached = (await storage.get(CACHE_KEY)) as CachedCatalog | undefined
  if (cached && cached.catalog && cached.fingerprint === scanFingerprint(dirs)) {
    return { catalog: cached.catalog, roster }
  }

  const catalog = buildCatalog(dirs)
  const entry: CachedCatalog = { fingerprint: fingerprint(catalog), catalog }
  await storage.set(CACHE_KEY, entry)
  return { catalog, roster }
}

const plugin: PluginPlugin = {
  id: "wippa-subagent-tools",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "wippa",
        description: "Find, inspect and refresh the wippaAGENT subagent catalog.",
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
          const { query, limit } = input as { query: string; limit?: number }
          const { catalog } = await loadCatalog(ctx.storage, ctx.location.directory)
          return { content: search(catalog, query, limit ?? 20) }
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
          const { id } = input as { id: string }
          const { catalog } = await loadCatalog(ctx.storage, ctx.location.directory)
          return { content: get(catalog, id) }
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
          const { category, limit } = input as { category?: string; limit?: number }
          const { catalog, roster } = await loadCatalog(ctx.storage, ctx.location.directory)
          return { content: list(catalog, roster, category, limit) }
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
    })
  },
}

export default plugin
