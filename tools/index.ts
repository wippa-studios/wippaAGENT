import { resolve } from "node:path"

import type { Plugin } from "@opencode/plugin"

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
import {
  get,
  invalid,
  list,
  search,
  verify,
  type VerifyOptions,
  type VerifyResult,
} from "./operations.ts"
import { guardVerifyCommand, validateDiffBase, validateVerifyCwd } from "./guards.ts"

/**
 * The plugin contract of `@opencode/plugin`.
 *
 * Upstream the package exports the plugin interface as a namespace —
 * `Plugin.Plugin`, with `Plugin.define` as an identity helper — and OpenCode
 * provides that package to the plugins it loads. It is a devDependency here so
 * `tsc` checks this file against the real interface rather than a copy of it;
 * the import is type-only, so it is erased at runtime and the host never has
 * to resolve the package for this plugin to load. `Plugin.Context` supplies
 * the context, editor, tool, storage, permission and VCS types used below.
 */
const CACHE_KEY = "catalog"
const COMMAND_MAX_LENGTH = 10_000
const LIMIT_MAX = 1_000
const DIFF_CONTEXT_DEFAULT = 3
const DIFF_CONTEXT_MAX = 100

/**
 * The storage API, reduced to the untyped JSON store the cache uses. The real
 * `Plugin.Context["storage"]` is assignable to this: its reads and writes
 * resolve to JSON values, which `unknown` accepts, so the domain types of the
 * cached catalog do not have to satisfy the store's `Json` index signature.
 */
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
    cached.fingerprint === scanFingerprint(dirs, roster) &&
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
 * Coerces a tool-input limit to an integer in 1..1000. The exact value 0 and
 * any negative number mean "no cap" and coerce to `undefined`, which is the
 * uncapped value the query helpers read; a missing or non-numeric value takes
 * the caller's default, which is what an unset optional field is.
 */
function coerceLimit(value: unknown, fallback: number | undefined): number | undefined {
  const number = typeof value === "number" ? value : Number.NaN
  if (!Number.isFinite(number)) return fallback
  if (number <= 0) return undefined
  return Math.min(LIMIT_MAX, Math.max(1, Math.floor(number)))
}

/** A tool input is untrusted: a non-string is treated as absent, not coerced. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/**
 * Coerces a tool-input number to an integer in `min..max`. A missing or
 * non-finite value takes the default; a finite one is clamped, not rejected,
 * because the caller cannot know the bounds the service enforces.
 */
function coerceBounded(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number.NaN
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

const plugin: Plugin.Plugin = {
  id: "wippa-subagent-tools",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "wippa",
        description:
          "Find, inspect and refresh the wippaAGENT subagent catalog, run acceptance commands with a real exit code, and read diffs as structured files.",
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
              description: "Maximum matches to return, 1..1000. Defaults to 20; 0 means no cap.",
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
              description: "Maximum agents to show per category, 1..1000. Defaults to all; 0 means no cap.",
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
            timeoutMs: {
              type: "number",
              description: "Milliseconds before the command is killed. Defaults to 300000; clamped to 1000..3600000.",
            },
          },
          required: ["command"],
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false, permission: "verify" },
        execute: async (input, context) => {
          await context.progress({ status: "verify" })
          const { command, cwd, timeoutMs } = input as {
            command?: unknown
            cwd?: unknown
            timeoutMs?: unknown
          }
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
              durationMs: 0,
            }
            return { content: JSON.stringify(failure) }
          }
          // The working directory is untrusted tool input as well: a `..`
          // segment would resolve outside the location, and line breaks or
          // null bytes are never legitimate in a path. Refused here with a
          // stated reason, before the guard and before the permission call.
          if (typeof cwd === "string" && cwd.trim().length > 0) {
            const cwdError = validateVerifyCwd(cwd)
            if (cwdError) {
              const refusal: VerifyResult = {
                command,
                exitCode: -1,
                ok: false,
                reason: "invalid-cwd",
                stdout: "",
                stderr: `The working directory was refused: ${cwdError}.`,
                cwd: location,
                durationMs: 0,
              }
              return { content: JSON.stringify(refusal) }
            }
          }
          // The guard (allowlist plus character policy, defined in
          // guards.ts) runs before the permission assertion and before any
          // spawn; the verdict is structured output, not a throw, so the
          // caller sees the reason.
          const verdict = guardVerifyCommand(command)
          if (!verdict.ok) {
            const refusal: VerifyResult = {
              command,
              exitCode: -1,
              ok: false,
              reason: "denied-pattern",
              stdout: "",
              stderr: `The acceptance command was refused by the verify guard before it ran: ${verdict.reason}. This tool runs a shell and does not bypass the shell rules the agent definitions ship.`,
              cwd: location,
              durationMs: 0,
            }
            return { content: JSON.stringify(refusal) }
          }
          // The check runs before anything is spawned, so a denied rule stops
          // the command rather than reporting its exit code. A rejection is
          // rethrown, not turned into output: the model should see the denial.
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "verify",
            resources: [command],
            save: [command],
          })
          // The default is the location directory, not the server process cwd,
          // and a relative cwd is resolved against it.
          const workingDir = typeof cwd === "string" && cwd.trim() ? resolve(location, cwd) : location
          const options: VerifyOptions = { command, cwd: workingDir, signal: context.signal }
          // A non-finite value is not a timeout: the default applies instead.
          // The bounds clamp inside verify.
          if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs)) {
            options.timeoutMs = timeoutMs
          }
          const result = await verify(options)
          return { content: JSON.stringify(result) }
        },
      })

      editor.add({
        name: "diff",
        description:
          "Read the working, branch or committed diff as structured per-file patches with additions and deletions, so a review reads files and line counts instead of raw console text.",
        input: {
          type: "object",
          properties: {
            mode: {
              type: "string",
              description:
                "Which diff to read: working (uncommitted), branch (against the branch base) or committed. Defaults to working.",
            },
            base: {
              type: "string",
              description: "The git ref to diff against, for branch or committed mode.",
            },
            context: {
              type: "number",
              description: `Lines of context around each hunk. Defaults to ${DIFF_CONTEXT_DEFAULT}; clamped to 0..${DIFF_CONTEXT_MAX}.`,
            },
          },
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false },
        execute: async (input, context) => {
          await context.progress({ status: "diff" })
          const { mode, base, context: contextLines } = input as {
            mode?: unknown
            base?: unknown
            context?: unknown
          }
          const requestedMode = mode === undefined ? "working" : mode
          if (
            requestedMode !== "working" &&
            requestedMode !== "branch" &&
            requestedMode !== "committed"
          ) {
            return {
              content: JSON.stringify({ error: "mode must be one of working, branch or committed" }),
            }
          }

          // The base reaches the VCS service as a git ref. It is untrusted
          // tool input: absolute paths, `..` traversal and option-like
          // prefixes are refused here with a stated reason rather than passed
          // through to git.
          let diffBase: string | undefined
          if (typeof base === "string" && base.trim()) {
            const trimmed = base.trim()
            const baseError = validateDiffBase(trimmed)
            if (baseError) {
              return { content: JSON.stringify({ error: `invalid base: ${baseError}` }) }
            }
            diffBase = trimmed
          }

          // The VCS service takes its location from the plugin instance, not
          // from the caller: the real input carries the mode, an optional base
          // and the context lines only.
          const options: Parameters<Plugin.Context["vcs"]["diff"]>[0] = {
            mode: requestedMode,
            context: coerceBounded(contextLines, DIFF_CONTEXT_DEFAULT, 0, DIFF_CONTEXT_MAX),
            ...(diffBase === undefined ? {} : { base: diffBase }),
          }

          try {
            // The signal is forwarded, so a cancelled call stops the service
            // work as well as waiting for it. The service reports a refusal as
            // a rejection, which becomes structured output rather than a
            // half-rendered patch list. The reply wraps the files in a
            // location envelope; the tool reports the per-file list itself.
            const result = await ctx.vcs.diff(options, { signal: context.signal })
            return { content: JSON.stringify(result.data) }
          } catch (error) {
            return {
              content: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            }
          }
        },
      })
    })
  },
}

export default plugin
