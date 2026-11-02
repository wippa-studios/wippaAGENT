/**
 * Pure classification of the working-diff files an acceptance command runs as
 * a harness. A harness file decides what the command runs or what counts as a
 * pass — a test runner configuration, a test file, a build script, a package
 * manifest — rather than production source.
 *
 * The function has no imports and no I/O: it answers from the command string
 * and the diff's file names alone, so the tool can refuse before spawning
 * anything. It is a policy gate, not a sandbox: it cannot inspect the
 * contents of a harness file, and an acknowledged harness still runs with the
 * authority of the user running OpenCode.
 *
 * Three gaps remain because closing them needs file contents or history this
 * classifier does not read. (a) A harness reached indirectly through an npm
 * script: `npm test` runs whatever `package.json` names, so a `node` or
 * `pytest` command inside that script is invisible here; the manifest itself
 * is matched, which is why the script body is covered only as far as the
 * `package.json` diff goes. (b) A path named on the command line that lives
 * outside the repository: the diff lists repository-relative files, so a
 * runner pointed at a file outside the repository matches nothing. (c) A
 * committed harness: the diff is the working diff against HEAD, so a harness
 * file committed before that diff started is not in the file list at all.
 */

/** The runners whose files this classifier knows. */
type HarnessRunner =
  | "npm"
  | "pytest"
  | "unittest"
  | "go"
  | "cargo"
  | "make"
  | "node"
  | "python"

interface HarnessTarget {
  readonly runners: ReadonlySet<HarnessRunner>
  /** Script paths named on the command line, normalised for comparison. */
  readonly scripts: ReadonlySet<string>
  /** Whether a `node` segment enables the test runner with a bare `--test`. */
  readonly nodeTest: boolean
}

/**
 * Splits an `&&` chain into tokenized segments. The guard has already refused
 * quotes it cannot close and characters the classifier should not see; this
 * tokenizer only needs to keep a quoted path with spaces together.
 */
function segments(command: string): string[][] {
  return command.split("&&").map((segment) => {
    const words: string[] = []
    let current = ""
    let quote: '"' | "'" | undefined
    for (const character of segment) {
      if (quote !== undefined) {
        if (character === quote) quote = undefined
        else current += character
        continue
      }
      if (character === '"' || character === "'") {
        quote = character
        continue
      }
      if (/\s/.test(character)) {
        if (current.length > 0) {
          words.push(current)
          current = ""
        }
        continue
      }
      current += character
    }
    if (current.length > 0) words.push(current)
    return words
  })
}

/** A repository-relative path with `./` and backslashes normalised away. */
function normalise(path: string): string {
  return path.replaceAll("\\", "/").replace(/^(?:\.\/)+/, "")
}

function baseName(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? path : path.slice(slash + 1)
}

function directoryNames(path: string): string[] {
  return normalise(path).split("/").slice(0, -1)
}

/** The directories that make a file part of a test harness. */
const TEST_DIRECTORIES: ReadonlySet<string> = new Set(["test", "tests", "__tests__"])
const CARGO_HARNESS_DIRECTORIES: ReadonlySet<string> = new Set(["tests", "benches"])
const CARGO_CONFIG_DIRECTORIES: ReadonlySet<string> = new Set([".cargo"])

/** Manifest and toolchain files that decide what `go` and `cargo` run. */
const GO_HARNESS_FILES: ReadonlySet<string> = new Set([
  "go.mod",
  "go.sum",
  "go.work",
  "go.work.sum",
])
const CARGO_HARNESS_FILES: ReadonlySet<string> = new Set([
  "Cargo.lock",
  "rust-toolchain.toml",
  "rust-toolchain",
])

/**
 * Node's test discovery patterns, beyond the `*.test.*` / `*.spec.*` names:
 * Node also discovers `*-test.*`, `*_test.*`, `test-*.*` and `test.*`.
 */
function nodeTestName(base: string): boolean {
  return (
    /\.(?:test|spec)\.[^/]+$/.test(base) ||
    /[-_]test\.[^/]+$/.test(base) ||
    /^test-.+\.[^/]+$/.test(base) ||
    /^test\..+$/.test(base)
  )
}

function underDirectory(path: string, names: ReadonlySet<string>): boolean {
  return directoryNames(path).some((directory) => names.has(directory))
}

/**
 * Options of `node` and `python` that consume the following word. The
 * classifier only needs this to avoid mistaking a flag value for the script
 * path; the guard is the authority on whether the option may run at all.
 */
const NODE_VALUE_LONG: ReadonlySet<string> = new Set([
  "--test-reporter",
  "--test-reporter-destination",
  "--test-name-pattern",
  "--test-concurrency",
  "--test-shard",
  "--test-timeout",
  "--require",
  "--import",
  "--loader",
  "--experimental-loader",
  "--conditions",
  "--env-file",
  "--input-type",
  "--openssl-config",
  "--icu-data-dir",
  "--max-old-space-size",
  "--inspect-port",
  "--title",
  "--redirect-warnings",
  "--diagnostic-dir",
  "--report-dir",
  "--report-filename",
  "--trace-event-file-pattern",
  "--v8-pool-size",
  "--stack-trace-limit",
])
const NODE_VALUE_SHORT: ReadonlySet<string> = new Set(["-r", "-e", "-p", "-C"])
const PYTHON_VALUE_SHORT: ReadonlySet<string> = new Set(["-W", "-X"])

/**
 * pytest options that consume the following word. The classifier uses this
 * only to tell a flag value from a test path; the guard is the authority on
 * whether the option may run at all.
 */
const PYTEST_VALUE_LONG: ReadonlySet<string> = new Set([
  "--maxfail",
  "--show-capture",
  "--tb",
  "--capture",
  "--code-highlight",
  "--color",
  "--durations",
  "--durations-min",
  "--ignore",
  "--ignore-glob",
  "--deselect",
  "--rootdir",
  "--import-mode",
  "--cov-report",
  "--cov-fail-under",
  "--log-level",
  "--log-cli-level",
])
const PYTEST_VALUE_SHORT: ReadonlySet<string> = new Set(["-k", "-m", "-r", "-W", "-n"])

/**
 * The positional words from `start` on: the script paths a `node`, `python`
 * or `pytest` command runs. A flag that takes a value skips its value, so
 * `node --test-reporter spec tests/run.js` names `tests/run.js` and
 * `pytest -k unit tests/` names `tests/`. A word after `--` is the last
 * positional this classifier needs.
 */
function scriptPaths(
  words: readonly string[],
  longValueFlags: ReadonlySet<string>,
  shortValueFlags: ReadonlySet<string>,
  start = 1,
): string[] {
  const paths: string[] = []
  for (let index = start; index < words.length; index++) {
    const token = words[index]!
    if (token === "--") {
      const next = words[index + 1]
      if (next !== undefined && !next.startsWith("-")) paths.push(next)
      return paths
    }
    if (token.startsWith("--")) {
      if (!token.includes("=") && longValueFlags.has(token)) index += 1
      continue
    }
    if (token.startsWith("-") && token !== "-") {
      if (shortValueFlags.has(token)) index += 1
      continue
    }
    paths.push(token)
  }
  return paths
}

/** The first positional word, the shape `node` and `python` scripts use. */
function scriptPath(
  words: readonly string[],
  longValueFlags: ReadonlySet<string>,
  shortValueFlags: ReadonlySet<string>,
): string | undefined {
  return scriptPaths(words, longValueFlags, shortValueFlags)[0]
}

/**
 * The module a `python -m` command names, attached or separate, and the index
 * of the first word after it. The index keeps interpreter options out of the
 * pytest positional list.
 */
function pythonModule(
  words: readonly string[],
): { module: string; start: number } | undefined {
  for (let index = 1; index < words.length; index++) {
    const token = words[index]!
    if (token === "-m") {
      const module = words[index + 1]
      return module === undefined ? undefined : { module, start: index + 2 }
    }
    if (token.startsWith("-m")) return { module: token.slice(2), start: index + 1 }
  }
  return undefined
}

/**
 * A pytest path may end in a node id (`tests/test_a.py::test_login`); the
 * file part is the path the diff knows.
 */
function normaliseScript(path: string): string {
  const nodeId = path.indexOf("::")
  return normalise(nodeId === -1 ? path : path.slice(0, nodeId))
}

function classify(command: string): HarnessTarget {
  const runners = new Set<HarnessRunner>()
  const scripts = new Set<string>()
  let nodeTest = false

  for (const words of segments(command)) {
    const commandWord = baseName(words[0] ?? "")
    if (commandWord === "npm") runners.add("npm")
    else if (commandWord === "pytest") {
      runners.add("pytest")
      // Positional test paths are scripts, so a changed file outside the
      // `tests/` convention still matches when the command names it.
      for (const path of scriptPaths(words, PYTEST_VALUE_LONG, PYTEST_VALUE_SHORT)) {
        scripts.add(normaliseScript(path))
      }
    } else if (commandWord === "go") runners.add("go")
    else if (commandWord === "cargo") runners.add("cargo")
    else if (commandWord === "make") runners.add("make")
    else if (commandWord === "node") {
      runners.add("node")
      if (words.includes("--test")) nodeTest = true
      const script = scriptPath(words, NODE_VALUE_LONG, NODE_VALUE_SHORT)
      if (script !== undefined) scripts.add(normalise(script))
    } else if (commandWord === "python3" || commandWord === "python") {
      const module = pythonModule(words)
      if (module?.module === "pytest") {
        runners.add("pytest")
        for (const path of scriptPaths(
          words,
          PYTEST_VALUE_LONG,
          PYTEST_VALUE_SHORT,
          module.start,
        )) {
          scripts.add(normaliseScript(path))
        }
      } else if (module?.module === "unittest") {
        runners.add("unittest")
      } else if (module === undefined) {
        const script = scriptPath(words, new Set(), PYTHON_VALUE_SHORT)
        if (script !== undefined) {
          runners.add("python")
          scripts.add(normalise(script))
        }
      }
    }
  }

  return { runners, scripts, nodeTest }
}

/** The harness predicates, one per runner. */
const RUNNER_MATCHERS: Readonly<Record<HarnessRunner, (path: string) => boolean>> = {
  npm: (path) => {
    const base = baseName(path)
    return (
      base === "package.json" ||
      base === "package-lock.json" ||
      base === "npm-shrinkwrap.json" ||
      /\.(?:test|spec)\.[^/]+$/.test(base) ||
      underDirectory(path, TEST_DIRECTORIES)
    )
  },
  pytest: (path) => {
    const base = baseName(path)
    return (
      base === "conftest.py" ||
      base === "pytest.ini" ||
      base === "tox.ini" ||
      base === "setup.cfg" ||
      base === "pyproject.toml" ||
      /^test_.*\.py$/.test(base) ||
      base.endsWith("_test.py") ||
      underDirectory(path, new Set(["tests"]))
    )
  },
  // unittest discovery matches every `test*.py`, not pytest's `test_*.py`,
  // and has no configuration file of its own. It also discovers anything
  // under `tests/`; pytest-only configuration files are deliberately absent.
  unittest: (path) => {
    const base = baseName(path)
    return /^test.*\.py$/.test(base) || underDirectory(path, new Set(["tests"]))
  },
  go: (path) => {
    const base = baseName(path)
    return base.endsWith("_test.go") || GO_HARNESS_FILES.has(base)
  },
  cargo: (path) => {
    const base = baseName(path)
    return (
      base === "Cargo.toml" ||
      base === "build.rs" ||
      CARGO_HARNESS_FILES.has(base) ||
      ((base === "config.toml" || base === "config") &&
        underDirectory(path, CARGO_CONFIG_DIRECTORIES)) ||
      underDirectory(path, CARGO_HARNESS_DIRECTORIES)
    )
  },
  make: (path) => {
    const base = baseName(path)
    return (
      base === "Makefile" ||
      base === "makefile" ||
      base === "GNUmakefile" ||
      base.endsWith(".mk")
    )
  },
  node: (path) => {
    const base = baseName(path)
    return (
      base === "package.json" ||
      nodeTestName(base) ||
      underDirectory(path, TEST_DIRECTORIES)
    )
  },
  python: () => false,
}

/**
 * Returns the diff files the command runs as a harness, in the order they
 * appear in `files`. An empty list means the command runs no harness this
 * diff changes, or the command is one this classifier does not know.
 */
export function harnessFiles(command: string, files: readonly string[]): string[] {
  const target = classify(command)
  if (target.runners.size === 0 && target.scripts.size === 0) return []

  const matched: string[] = []
  const seen = new Set<string>()
  for (const file of files) {
    if (seen.has(file)) continue
    seen.add(file)
    const normalised = normalise(file)
    // A `node` invocation that runs a named script executes that script, not
    // the test files around it; only `node --test` discovers by pattern and
    // directory. The exact script path is matched below in both cases.
    const isHarness =
      [...target.runners].some((runner) =>
        runner === "node" && !target.nodeTest
          ? baseName(normalised) === "package.json"
          : RUNNER_MATCHERS[runner](normalised),
      ) || target.scripts.has(normalised)
    if (isHarness) matched.push(file)
  }
  return matched
}
