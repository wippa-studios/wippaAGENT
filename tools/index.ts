import { readFileSync, readdirSync, realpathSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

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
  updatePlan,
  verify,
  type VerifyOptions,
  type VerifyResult,
} from "./operations.ts"
import { latestChildSession } from "./continuation.ts"
import { guardVerifyCommand, validateDiffBase, validateVerifyCwd } from "./guards.ts"
import { harnessFiles } from "./harness.ts"

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

/**
 * The reason a resolved working directory is not inside the workspace, or
 * undefined when it is. Both paths are canonicalised, so a `..` that survived
 * resolution, a symlink inside the workspace pointing out of it, and a
 * sibling directory named with a shared prefix (`/repo-other` against
 * `/repo`) all fail the same check. A path that cannot be resolved does not
 * exist or has a broken parent link, and is refused for the same reason: the
 * containment cannot be proved.
 */
function workspaceCwdRefusal(location: string, workingDir: string): string | undefined {
  let root: string
  let target: string
  try {
    root = realpathSync(location)
    target = realpathSync(workingDir)
  } catch {
    return `the working directory could not be resolved: ${workingDir}`
  }
  if (target === root) return undefined
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (target.startsWith(prefix)) return undefined
  return `the working directory is outside the workspace: ${target} is not inside ${root}`
}

/**
 * Splits an npm command segment or script body into shell words, keeping a
 * quoted name with spaces (`"build step"`) as one word. The guard has already
 * refused the characters a shell would rewrite, so this only has to agree on
 * where a word ends. An unterminated quote keeps the rest as one word: the
 * lookup then misses, which is the same non-fatal result as an unknown script.
 */
function shellWords(segment: string): string[] {
  const words: string[] = []
  let current = ""
  let quote: '"' | "'" | undefined
  let quoted = false
  for (const character of segment) {
    if (quote !== undefined) {
      if (character === quote) quote = undefined
      else current += character
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      quoted = true
      continue
    }
    if (/\s/.test(character)) {
      if (quoted || current.length > 0) {
        words.push(current)
        current = ""
        quoted = false
      }
      continue
    }
    current += character
  }
  if (quoted || current.length > 0) words.push(current)
  return words
}

/**
 * Splits a command or script body into shell segments on `&&`, `||`, `;` and
 * `|`, keeping a separator inside quotes literal. This is over-approximate
 * shell parsing on purpose: a false positive asks the caller to acknowledge a
 * harness, while a false negative would run an inspected command unchecked.
 * Command substitution, escapes and single `&` are not special-cased; the
 * guard has already refused the characters this classifier should not see in
 * a caller-supplied command, and a script body is only read, never executed.
 */
function shellSegments(command: string): string[] {
  const segments: string[] = []
  let current = ""
  let quote: '"' | "'" | undefined
  for (let index = 0; index < command.length; index++) {
    const character = command[index]!
    if (quote !== undefined) {
      current += character
      if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      current += character
      continue
    }
    if (character === "&" || character === "|") {
      if (command[index + 1] === character) {
        segments.push(current)
        current = ""
        index += 1
        continue
      }
      if (character === "|") {
        segments.push(current)
        current = ""
        continue
      }
      current += character
      continue
    }
    if (character === ";") {
      segments.push(current)
      current = ""
      continue
    }
    current += character
  }
  segments.push(current)
  return segments
}

/**
 * npm options that consume the next word as their value. `npm run` accepts
 * configuration options before the script name, and without skipping the
 * value `npm run --workspace pkg build` would look up the script `pkg`. The
 * list is bounded: an option it does not name is treated as valueless, which
 * at worst misses an indirect harness rather than inventing one.
 */
const NPM_RUN_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  "-w",
  "--workspace",
  "--prefix",
  "--script-shell",
  "--shell",
  "--userconfig",
  "--globalconfig",
  "--loglevel",
])

/**
 * The npm script a command segment names, or undefined when the segment does
 * not invoke `npm test`, `npm start` or `npm run <script>`. Leading
 * `NAME=value` environment words are stripped, options before the script name
 * are skipped (with the value of a known value-taking option), and a quoted
 * script name is one word. The words after the script name are arguments to
 * the script, not part of its name.
 */
function npmScriptName(segment: string): string | undefined {
  const words = shellWords(segment)
  let index = 0
  while (index < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]!)) index += 1
  if (words[index] !== "npm") return undefined
  const subcommand = words[index + 1]
  if (subcommand === "test" || subcommand === "start") return subcommand
  if (subcommand !== "run") return undefined
  index += 2
  while (index < words.length) {
    const word = words[index]!
    if (!word.startsWith("-")) return word
    if (word === "--" || word.includes("=")) {
      index += 1
      continue
    }
    index += NPM_RUN_VALUE_OPTIONS.has(word) ? 2 : 1
  }
  return undefined
}

/** A parsed npm manifest and the directory it belongs to. */
interface NpmManifest {
  readonly directory: string
  readonly path: string
  readonly manifest: Record<string, unknown>
}

/** A command's npm workspace request: every workspace, or the named ones. */
interface WorkspaceSelection {
  readonly all: boolean
  readonly names: readonly string[]
}

/** A directory is inside the workspace root when it is the root or beneath it. */
function insideDirectory(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)
}

/**
 * The physical path of a directory, or the resolved path when it cannot be
 * canonicalised. The walk compares directories, so a `cwd` that reaches the
 * workspace through a symlink has to be compared in the same space as the
 * root; the cwd check has already proved the physical path is inside it.
 */
function canonicalDirectory(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

/** Reads a manifest, or undefined when it is missing, unreadable or not JSON. */
function readNpmManifest(path: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (typeof parsed !== "object" || parsed === null) return undefined
    return parsed as Record<string, unknown>
  } catch {
    return undefined
  }
}

function manifestScripts(
  manifest: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const scripts = manifest.scripts
  if (typeof scripts !== "object" || scripts === null) return undefined
  return scripts as Record<string, unknown>
}

/**
 * The manifest npm resolves for `workingDir`: the first readable
 * `package.json` on the way up to the workspace root, because npm walks up
 * from the invocation directory rather than reading only that directory. An
 * unparsable manifest is skipped and the walk continues rather than failing
 * the check, which errs toward following a script. Nothing is read above the
 * root.
 */
function findNpmManifest(workingDir: string, root: string): NpmManifest | undefined {
  let directory = workingDir
  for (;;) {
    const path = join(directory, "package.json")
    const manifest = readNpmManifest(path)
    if (manifest !== undefined) return { directory, path, manifest }
    if (directory === root) return undefined
    const parent = dirname(directory)
    if (parent === directory || !insideDirectory(root, parent)) return undefined
    directory = parent
  }
}

/** The `workspaces` patterns of a root manifest, in array or object form. */
function workspacePatterns(manifest: Record<string, unknown>): string[] {
  const workspaces = manifest.workspaces
  if (Array.isArray(workspaces)) {
    return workspaces.filter((value): value is string => typeof value === "string")
  }
  if (typeof workspaces === "object" && workspaces !== null) {
    const packages = (workspaces as { packages?: unknown }).packages
    if (Array.isArray(packages)) {
      return packages.filter((value): value is string => typeof value === "string")
    }
  }
  return []
}

/**
 * Expands one workspace pattern to directories. Only a trailing `/*` is a
 * glob, and it is expanded with one directory read rather than a glob library;
 * every other pattern is a path relative to the workspace root. A pattern
 * that leaves the root is ignored.
 */
function expandWorkspacePattern(root: string, pattern: string): string[] {
  const normalised = pattern
    .replaceAll("\\", "/")
    .replace(/^(?:\.\/)+/, "")
    .replace(/\/+$/, "")
  if (normalised === "" || normalised === ".") return [root]
  if (normalised.endsWith("/*")) {
    const directory = resolve(root, normalised.slice(0, -2))
    if (!insideDirectory(root, directory)) return []
    try {
      return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(directory, entry.name))
        .sort()
    } catch {
      return []
    }
  }
  return [resolve(root, normalised)]
}

/** The readable workspace manifests the root manifest lists. */
function workspaceManifests(root: string): NpmManifest[] {
  const rootManifest = readNpmManifest(join(root, "package.json"))
  if (rootManifest === undefined) return []
  const manifests: NpmManifest[] = []
  const seen = new Set<string>()
  for (const pattern of workspacePatterns(rootManifest)) {
    for (const directory of expandWorkspacePattern(root, pattern)) {
      if (!insideDirectory(root, directory) || seen.has(directory)) continue
      seen.add(directory)
      const path = join(directory, "package.json")
      const manifest = readNpmManifest(path)
      if (manifest === undefined) continue
      manifests.push({ directory, path, manifest })
    }
  }
  return manifests
}

/**
 * The workspace flags an npm command carries: `--workspace <name>`,
 * `--workspace=<name>`, `-w <name>`, `-w=<name>`, `--workspaces` and
 * `--workspaces=true`. A flag value is one shell word, so a quoted workspace
 * name survives. Anything after `--` is the script's own argument, not npm's.
 */
function npmWorkspaceSelection(segment: string): WorkspaceSelection {
  const words = shellWords(segment)
  let index = 0
  while (index < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]!)) index += 1
  if (words[index] !== "npm") return { all: false, names: [] }
  index += 2
  const names: string[] = []
  let all = false
  while (index < words.length) {
    const word = words[index]!
    if (word === "--") break
    if (word === "--workspaces") {
      all = true
      index += 1
      continue
    }
    if (word.startsWith("--workspaces=")) {
      if (word.slice("--workspaces=".length) === "true") all = true
      index += 1
      continue
    }
    if (word === "--workspace" || word === "-w") {
      const value = words[index + 1]
      if (value !== undefined && value !== "--") names.push(value)
      index += 2
      continue
    }
    if (word.startsWith("--workspace=")) {
      names.push(word.slice("--workspace=".length))
      index += 1
      continue
    }
    if (word.startsWith("-w=")) {
      names.push(word.slice("-w=".length))
      index += 1
      continue
    }
    index += 1
  }
  return { all, names }
}

/** Normalises a workspace name or path for comparison. */
function normaliseWorkspaceName(name: string): string {
  return name.replaceAll("\\", "/").replace(/^(?:\.\/)+/, "").replace(/\/+$/, "")
}

/**
 * The workspace manifests a selection names. A name matches either the
 * directory path relative to the root or the manifest's own `name`, which are
 * the two forms npm accepts. `--workspaces` selects every workspace.
 */
function selectWorkspaces(root: string, selection: WorkspaceSelection): NpmManifest[] {
  const workspaces = workspaceManifests(root)
  if (selection.all) return workspaces
  const wanted = new Set(selection.names.map(normaliseWorkspaceName))
  return workspaces.filter((workspace) => {
    if (wanted.has(normaliseWorkspaceName(relative(root, workspace.directory)))) return true
    const name = workspace.manifest.name
    return typeof name === "string" && wanted.has(name)
  })
}

/**
 * Harness files an npm script runs indirectly: `npm test` executes the
 * `test` entry from `package.json`, which may name a runner the direct
 * classification never sees (`make check`, `pytest tests/`, another
 * `npm run …`). The manifest is the nearest one from the working directory up
 * to the workspace root, which is where npm resolves it, and a workspace flag
 * redirects the lookup to the root manifest's `workspaces` entries. The body
 * is split on `&&`, `||`, `;` and `|` outside quotes, and every segment is
 * both classified directly and scanned for a nested npm command, at most two
 * levels deep. A missing or unparsable manifest is skipped, not fatal: the
 * direct classification already ran, and an unknown body is the residual the
 * harness header documents.
 */
function npmIndirectHarness(
  command: string,
  files: readonly string[],
  workingDir: string,
  location: string,
): string[] {
  const root = canonicalDirectory(location)
  const manifest = findNpmManifest(canonicalDirectory(workingDir), root)
  if (manifest === undefined) return []

  const matched: string[] = []
  const seen = new Set<string>()
  const visited = new Set<string>()

  const addMatches = (segment: string): void => {
    for (const file of harnessFiles(segment, files)) {
      if (seen.has(file)) continue
      seen.add(file)
      matched.push(file)
    }
  }

  const followSegment = (segment: string, owner: NpmManifest, depth: number): void => {
    const script = npmScriptName(segment)
    if (script === undefined) return
    const selection = npmWorkspaceSelection(segment)
    if (selection.all || selection.names.length > 0) {
      const workspaces = selectWorkspaces(root, selection)
      // A workspace flag that names nothing npm would refuse to run at all.
      // Falling back to the invoked manifest can only over-approximate the
      // harness, while following nothing could miss the script npm would run
      // in a slightly different layout.
      if (workspaces.length > 0) {
        for (const workspace of workspaces) {
          followScript(workspace, script, depth)
        }
        return
      }
    }
    followScript(owner, script, depth)
  }

  const followScript = (owner: NpmManifest, script: string, depth: number): void => {
    if (depth >= 2) return
    // The same script name in two workspaces is two different scripts.
    const key = `${owner.path}\0${script}`
    if (visited.has(key)) return
    visited.add(key)
    const scripts = manifestScripts(owner.manifest)
    if (scripts === undefined) return
    const body = scripts[script]
    if (typeof body !== "string") return
    for (const segment of shellSegments(body)) {
      addMatches(segment)
      followSegment(segment, owner, depth + 1)
    }
  }

  for (const segment of shellSegments(command)) followSegment(segment, manifest, 0)
  return matched
}

const plugin: Plugin.Plugin = {
  id: "wippa-subagent-tools",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "wippa",
        description:
          "Find, inspect and refresh the wippaAGENT subagent catalog, continue the latest session of a named subagent, run acceptance commands with a real exit code, and read diffs as structured files.",
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
          // The location directory is where OpenCode searches for configs, so
          // the drift report reads the same files the session's OpenCode does.
          return { content: invalid(catalog, roster, ctx.location.directory) }
        },
      })

      editor.add({
        name: "subagent_continue",
        description:
          "Continue the latest child session of the named subagent under the current session, so its work resumes where it stopped. No session id is accepted and a fresh dispatch is not needed.",
        input: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              description: "The id of the subagent whose latest child session should continue.",
            },
            prompt: {
              type: "string",
              description: "The text to send to that child session.",
            },
          },
          required: ["agent", "prompt"],
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false, permission: "subagent_continue" },
        execute: async (input, context) => {
          await context.progress({ status: "subagent_continue" })
          const { agent: rawAgent, prompt } = input as { agent?: unknown; prompt?: unknown }
          if (typeof rawAgent !== "string" || rawAgent.trim().length === 0) {
            return { content: JSON.stringify({ error: "agent must be a non-empty string" }) }
          }
          if (typeof prompt !== "string" || prompt.trim().length === 0) {
            return { content: JSON.stringify({ error: "prompt must be a non-empty string" }) }
          }
          const agent = rawAgent.trim()
          // The target is selected only from the children of this session, so
          // the caller cannot name an arbitrary or unrelated session: there is
          // no session id, parent id or path in the input at all. The write
          // shape of resuming a session is a permission of its own, asserted
          // before the list so a denial prevents even reading the children.
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "subagent_continue",
            resources: [agent],
            save: [agent],
          })
          const children = await ctx.session.list(
            { parentID: context.sessionID, order: "desc", archived: false },
            { signal: context.signal },
          )
          const child = latestChildSession(children.data, agent, context.sessionID)
          if (child === undefined) {
            return {
              content: JSON.stringify({
                error: `no child session was found for agent "${agent}" under the current session`,
              }),
            }
          }
          await ctx.session.prompt(
            { sessionID: child.id, text: prompt },
            { signal: context.signal },
          )
          return { content: JSON.stringify({ ok: true, agent, sessionID: child.id }) }
        },
      })

      editor.add({
        name: "verify",
        description:
          "Run an acceptance command and report the real exit code, so a pass/fail verdict never rests on subagent prose. The working directory must resolve inside the workspace. The command guard and the harness-acknowledgement check are policy gates, not a sandbox: the harness check sees working-diff file names only, so an outside-repo path named on the command line, a harness committed before the working diff, an included makefile without a .mk suffix, and a custom unittest -p pattern are not seen.",
        input: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The acceptance command to run, for example 'npm test'.",
            },
            cwd: {
              type: "string",
              description:
                "The working directory to run the acceptance command in. Must resolve to a directory inside the workspace; defaults to the workspace root.",
            },
            timeoutMs: {
              type: "number",
              description: "Milliseconds before the command is killed. Defaults to 300000; clamped to 1000..3600000.",
            },
            acknowledgeHarnessChanges: {
              type: "boolean",
              description:
                "Run even when the working diff changes a harness the command runs (a test file, runner configuration or script). Defaults to false.",
            },
          },
          required: ["command"],
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false, permission: "verify" },
        execute: async (input, context) => {
          await context.progress({ status: "verify" })
          const { command, cwd, timeoutMs, acknowledgeHarnessChanges } = input as {
            command?: unknown
            cwd?: unknown
            timeoutMs?: unknown
            acknowledgeHarnessChanges?: unknown
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
          // The resolved directory must canonicalise inside the workspace.
          // Without this a caller could run an acceptance command in another
          // checkout, where the harness check reads no diff and the guard's
          // relative paths mean something else entirely.
          const cwdRefusal = workspaceCwdRefusal(location, workingDir)
          if (cwdRefusal !== undefined) {
            const refusal: VerifyResult = {
              command,
              exitCode: -1,
              ok: false,
              reason: "invalid-cwd",
              stdout: "",
              stderr: `The working directory was refused: ${cwdRefusal}.`,
              cwd: workingDir,
              durationMs: 0,
            }
            return { content: JSON.stringify(refusal) }
          }
          // The harness check reads the working diff, then compares its file
          // names against what this command runs. It runs after the permission
          // assertion and before any spawn, so refusing a modified harness
          // stops the command outright. The check is a policy gate, not a
          // sandbox: it sees file names, not their contents, and an
          // acknowledged harness still runs with the user's authority.
          let harnessChanges: string[] = []
          let harnessCheck: "skipped" | undefined
          try {
            const workingDiff = await ctx.vcs.diff(
              { mode: "working" },
              { signal: context.signal },
            )
            const files = workingDiff.data.map((file) => file.file)
            harnessChanges = harnessFiles(command, files)
            // An npm script runs a body this classifier cannot see from the
            // command line. Follow it through the nearest manifest from the
            // directory the command runs in up to the workspace root, or the
            // selected workspace manifest, and union the files it names, so a
            // changed Makefile reached via `npm test` still requires
            // acknowledgement.
            for (const file of npmIndirectHarness(command, files, workingDir, location)) {
              if (!harnessChanges.includes(file)) harnessChanges.push(file)
            }
          } catch {
            // A VCS failure is not a reason to block a run the caller could
            // already perform with the diff tool; the result says the check
            // was skipped rather than pretending it passed.
            harnessCheck = "skipped"
          }
          if (harnessChanges.length > 0 && acknowledgeHarnessChanges !== true) {
            const refusal: VerifyResult = {
              command,
              exitCode: -1,
              ok: false,
              reason: "harness-modified",
              harnessChanges,
              stdout: "",
              stderr: `the acceptance command runs a harness this diff modifies: ${harnessChanges.join(", ")}; pass acknowledgeHarnessChanges: true to run it`,
              cwd: workingDir,
              durationMs: 0,
            }
            return { content: JSON.stringify(refusal) }
          }
          const options: VerifyOptions = { command, cwd: workingDir, signal: context.signal }
          // A non-finite value is not a timeout: the default applies instead.
          // The bounds clamp inside verify.
          if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs)) {
            options.timeoutMs = timeoutMs
          }
          const result = await verify(options)
          // Carry the harness verdict alongside the run it describes. An empty
          // list is not reported; `skipped` is, because the caller should know
          // the check did not run.
          const report: VerifyResult =
            harnessChanges.length > 0
              ? { ...result, harnessChanges }
              : harnessCheck === "skipped"
                ? { ...result, harnessCheck }
                : result
          return { content: JSON.stringify(report) }
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

      editor.add({
        name: "plan_update",
        description:
          "Write the session plan ledger to the fixed path .opencode/PLAN.md. The only input is content; the path is not caller-selectable, and a symbolic link at .opencode or at .opencode/PLAN.md (dangling or not), or a hard-linked .opencode/PLAN.md, is refused.",
        input: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The full markdown content to write to .opencode/PLAN.md.",
            },
          },
          required: ["content"],
          additionalProperties: false,
        },
        options: { namespace: "wippa", codemode: false, permission: "plan_update" },
        execute: async (input, context) => {
          await context.progress({ status: "plan_update" })
          const { content } = input as { content?: unknown }
          if (typeof content !== "string") {
            return { content: JSON.stringify({ error: "content must be a string" }) }
          }
          // The plan ledger is a write, so it asserts its own permission
          // before touching the file. A rejection propagates rather than
          // becoming output, so the model sees the denial.
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "plan_update",
            resources: [".opencode/PLAN.md"],
            save: [".opencode/PLAN.md"],
          })
          const location = resolve(ctx.location.directory)
          const result = updatePlan(location, content)
          return { content: JSON.stringify(result) }
        },
      })
    })
  },
}

export default plugin
