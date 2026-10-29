/**
 * Pure input guards for the wippa tools. No imports, no I/O: every function
 * here is a total function from untrusted tool input to a verdict, so the
 * test battery can exercise the whole policy without a session or a spawn.
 */

/** The verdict of one guard: allowed, or denied with a reason to show a caller. */
export type GuardVerdict = { ok: true } | { ok: false; reason: string }

function denied(reason: string): GuardVerdict {
  return { ok: false, reason }
}

// ---------------------------------------------------------------- characters

/**
 * Characters denied anywhere in an acceptance command. Each one is a shell
 * feature an acceptance command has no legitimate use for: substitution,
 * expansion, redirection, pipelines, separators and line breaks.
 */
const DENIED_CHARACTERS: readonly (readonly [string, string])[] = [
  ["`", "backtick (command substitution)"],
  ["$", "dollar sign (expansion or substitution)"],
  ["(", "open parenthesis (subshell or substitution)"],
  [")", "close parenthesis (subshell or substitution)"],
  ["<", "less-than (input redirection or heredoc)"],
  [">", "greater-than (output redirection)"],
  ["|", "pipe"],
  ["\n", "newline"],
  ["\r", "carriage return"],
  [";", "semicolon (statement separator)"],
]

/** A single `&` backgrounds a command or separates statements; `&&` is the chain operator. */
const SINGLE_AMPERSAND = /(^|[^&])&([^&]|$)/

// ------------------------------------------------------------------ commands

/**
 * Commands denied wherever they appear, as command or as argument: an
 * argument-position `rm` is one `xargs` away from executing, so the guard
 * denies the word rather than reasoning about every possible caller.
 */
const DENIED_COMMANDS: ReadonlyMap<string, string> = new Map(
  (
    [
      ["sudo", "privilege escalation"],
      ["doas", "privilege escalation"],
      ["pkexec", "privilege escalation"],
      ["su", "privilege escalation"],
      ["rm", "file deletion"],
      ["rmdir", "file deletion"],
      ["unlink", "file deletion"],
      ["curl", "network transfer"],
      ["wget", "network transfer"],
      ["nc", "network transfer"],
      ["ncat", "network transfer"],
      ["netcat", "network transfer"],
      ["socat", "network transfer"],
      ["scp", "network transfer"],
      ["sftp", "network transfer"],
      ["ssh", "network transfer"],
      ["telnet", "network transfer"],
      ["ftp", "network transfer"],
      ["tftp", "network transfer"],
      ["rsync", "network transfer or file copy"],
      ["tar", "archive manipulation"],
      ["zip", "archive manipulation"],
      ["unzip", "archive manipulation"],
      ["gzip", "archive manipulation"],
      ["gunzip", "archive manipulation"],
      ["bzip2", "archive manipulation"],
      ["bunzip2", "archive manipulation"],
      ["xz", "archive manipulation"],
      ["unxz", "archive manipulation"],
      ["zstd", "archive manipulation"],
      ["7z", "archive manipulation"],
      ["7za", "archive manipulation"],
      ["tee", "file mutation"],
      ["mv", "file mutation"],
      ["cp", "file mutation"],
      ["ln", "file mutation"],
      ["chmod", "file mutation"],
      ["chown", "file mutation"],
      ["chgrp", "file mutation"],
      ["truncate", "file mutation"],
      ["dd", "file mutation"],
      ["shred", "file mutation"],
      ["touch", "file mutation"],
      ["install", "file mutation"],
      ["cpio", "file mutation"],
      ["awk", "inline program execution"],
      ["gawk", "inline program execution"],
      ["mawk", "inline program execution"],
      ["nawk", "inline program execution"],
      ["xargs", "indirect command execution"],
      ["busybox", "multi-call binary that can run any applet"],
    ] as const
  ).map(([word, category]) => [word, category] as const),
)

/**
 * The shell builtin `eval` executes in command position only, and the
 * acceptance chain legitimately contains the word `eval` as a script name
 * (`npm run eval -- --check`), so it is denied as a command word rather than
 * flat.
 */
const DENIED_FIRST_WORDS: ReadonlySet<string> = new Set(["eval", "source", "exec"])

// ---------------------------------------------------- interpreter/eval pairs

/**
 * An interpreter paired with a flag that evaluates code given as text, edits
 * files in place, or executes a program the guard cannot see. Both the bare
 * flag and a combined short flag (`-ec`, `-i.bak`) are matched.
 */
interface EvalFlagPair {
  readonly commands: ReadonlySet<string>
  /** Each flag, as an exact long option or the head of a combined short flag. */
  readonly flags: readonly string[]
  readonly label: string
}

const EVAL_FLAG_PAIRS: readonly EvalFlagPair[] = [
  {
    commands: new Set(["sh", "bash", "zsh", "dash", "ksh", "ksh93", "mksh", "ash"]),
    flags: ["-c"],
    label: "shell with -c",
  },
  {
    commands: new Set(["python", "python2", "python3", "pypy", "pypy3"]),
    flags: ["-c"],
    label: "python with -c",
  },
  { commands: new Set(["node", "nodejs"]), flags: ["-e", "--eval"], label: "node with an eval flag" },
  { commands: new Set(["ruby"]), flags: ["-e", "--eval"], label: "ruby with -e" },
  { commands: new Set(["perl"]), flags: ["-e", "-E", "--eval"], label: "perl with -e" },
  { commands: new Set(["php"]), flags: ["-r", "--run"], label: "php with -r" },
  { commands: new Set(["lua", "luajit"]), flags: ["-e"], label: "lua with -e" },
  { commands: new Set(["sed"]), flags: ["-i", "--in-place"], label: "sed with -i" },
  { commands: new Set(["find"]), flags: ["-exec", "-execdir", "-ok", "-delete"], label: "find with -exec or -delete" },
]

/**
 * Long options are matched exactly. Short options are matched against the
 * whole short-flag bundle: a two-character flag (`-e`, `-c`, `-i`, `-r`)
 * matches when the bundle contains its letter, so `node -pe` and
 * `bash -ec` are caught; a longer single-dash flag matches as the head of the
 * word, so sed's `-i.bak` is caught without claiming `--in-place`'s siblings.
 */
function flagMatches(word: string, flag: string): boolean {
  if (word === flag) return true
  if (word.startsWith("--") || !word.startsWith("-")) return false
  if (flag.startsWith("--")) return false
  if (flag.length === 2) return word.slice(1).includes(flag[1]!)
  return word.startsWith(flag)
}

// --------------------------------------------------------------------- git

/** Git subcommands that write refs, history, config or the working tree. */
const GIT_MUTATING: ReadonlySet<string> = new Set([
  "push",
  "commit",
  "reset",
  "checkout",
  "merge",
  "rebase",
  "clean",
  "add",
  "restore",
  "stash",
  "switch",
  "cherry-pick",
  "revert",
  "apply",
  "am",
  "mv",
  "rm",
  "tag",
  "init",
  "clone",
  "worktree",
  "submodule",
  "notes",
  "bisect",
  "maintenance",
  "gc",
  "repack",
  "filter-branch",
  "update-ref",
  "config",
  "bundle",
  "send-email",
  "format-patch",
])

/** `git branch` lists branches bare; every other argument creates, moves or deletes one. */
const GIT_BRANCH_LIST_FLAGS: ReadonlySet<string> = new Set([
  "-a",
  "-r",
  "-v",
  "-vv",
  "-l",
  "--list",
  "--show-current",
  "--contains",
  "--no-contains",
  "--merged",
  "--no-merged",
  "--no-color",
])

/** `git remote` lists with `-v` or `show <name>`; every other subcommand mutates remotes. */

// -------------------------------------------------------- package managers

/** Package managers and the subcommands that install, publish, mutate or execute. */
const PACKAGE_MANAGERS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  (
    [
      [
        "npm",
        [
          "install",
          "i",
          "add",
          "ci",
          "exec",
          "dlx",
          "publish",
          "unpublish",
          "link",
          "unlink",
          "update",
          "upgrade",
          "remove",
          "uninstall",
          "rm",
          "dedupe",
          "cache",
          "pack",
          "login",
          "logout",
          "token",
          "star",
          "unstar",
          "deprecate",
          "shrinkwrap",
          "explore",
        ],
      ],
      ["yarn", ["install", "add", "remove", "up", "upgrade", "publish", "link", "unlink", "global", "import", "cache", "dlx", "create"]],
      ["pnpm", ["install", "i", "add", "remove", "rm", "uninstall", "update", "up", "publish", "link", "unlink", "dlx", "exec", "deploy", "store", "patch", "patch-commit"]],
      ["bun", ["add", "install", "remove", "uninstall", "update", "publish", "link", "unlink", "create", "migrate"]],
      ["pip", ["install", "uninstall", "download", "cache"]],
      ["pip3", ["install", "uninstall", "download", "cache"]],
      ["gem", ["install", "uninstall", "push", "build"]],
      ["go", ["install", "get", "run", "mod", "clean"]],
      ["uv", ["add", "pip", "sync", "run", "tool", "venv", "python"]],
      ["cargo", ["install", "publish", "uninstall", "add", "remove", "update", "upgrade", "yank", "login", "logout"]],
    ] as const
  ).map(([name, subs]) => [name, new Set(subs)] as const),
)

// -------------------------------------------------------------- tokenizing

/** Splits one `&&` segment into words, stripping single and double quotes. */
function tokenize(segment: string): { words: string[] } | { error: string } {
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
  if (quote !== undefined) return { error: "unterminated quote" }
  if (current.length > 0) words.push(current)
  return { words }
}

/** The file name of a word, so `./install.sh` and `install.sh` match together. */
function basename(word: string): string {
  const slash = word.lastIndexOf("/")
  return slash === -1 ? word : word.slice(slash + 1)
}

/** The shell interpreters, used for the `-c` pair and the install.sh rule. */
const SHELLS: ReadonlySet<string> = new Set([
  "sh",
  "bash",
  "zsh",
  "dash",
  "ksh",
  "ksh93",
  "mksh",
  "ash",
])

/** The verdict on one tokenized `&&` segment, words in order. */
function guardSegment(words: string[]): string | undefined {
  if (words.length === 0) return "empty command segment in && chain"

  // A quoted span is one shell word, but its contents were scanned as words
  // by the policy, so each span is also split on whitespace for the flat
  // denylist: `'rm'` and `'sudo rm -rf /'` are both denied.
  const fragments: string[] = []
  for (const word of words) {
    for (const fragment of word.split(/\s+/)) {
      if (fragment.length > 0) fragments.push(fragment)
    }
  }

  for (let index = 0; index < words.length; index++) {
    const word = words[index]!
    const name = basename(word)

    if (index === 0 && DENIED_FIRST_WORDS.has(name)) {
      return `denied command: \`${name}\` (evaluates code or a script the guard cannot see)`
    }

    for (const pair of EVAL_FLAG_PAIRS) {
      if (!pair.commands.has(name)) continue
      for (let next = index + 1; next < words.length; next++) {
        for (const flag of pair.flags) {
          if (flagMatches(words[next]!, flag)) {
            return `denied pair: \`${name} ${flag}\` (${pair.label})`
          }
        }
      }
    }

    if (name === "git" && index + 1 < words.length) {
      const subcommand = words[index + 1]!
      if (subcommand === "branch") {
        for (let next = index + 2; next < words.length; next++) {
          const argument = words[next]!
          if (
            !GIT_BRANCH_LIST_FLAGS.has(argument) &&
            !argument.startsWith("--sort=")
          ) {
            return "denied arguments to `git branch` (only listing flags are allowed)"
          }
        }
        continue
      }
      if (subcommand === "remote") {
        const arguments_ = words.slice(index + 2)
        const listing = arguments_.every((argument) => argument === "-v")
        const show = arguments_[0] === "show"
        if (!listing && !show) {
          return "denied arguments to `git remote` (only `-v` and `show` are allowed)"
        }
        continue
      }
      if (GIT_MUTATING.has(subcommand)) {
        return `denied pair: \`git ${subcommand}\` (mutating git subcommand)`
      }
    }

    const deniedSubcommands = PACKAGE_MANAGERS.get(name)
    if (deniedSubcommands !== undefined && index + 1 < words.length) {
      const subcommand = words[index + 1]!
      if (deniedSubcommands.has(subcommand)) {
        return `denied pair: \`${name} ${subcommand}\` (installing, publishing or executing packages)`
      }
    }
  }

  // A quoted span is one shell word, but the flat denylist applies to the
  // words inside it too: `'rm'` and `'sudo rm -rf /'` are both denied. This
  // runs after the pair checks so a command like `bash -c 'rm -rf /'` is
  // reported by its more specific rule.
  for (const fragment of fragments) {
    const category = DENIED_COMMANDS.get(basename(fragment))
    if (category !== undefined) {
      return `denied command: \`${basename(fragment)}\` (${category})`
    }
  }

  if (words.some((word) => basename(word) === "install.sh")) {
    if (!words.includes("--dry-run")) {
      const command = basename(words[0] ?? "")
      const syntaxCheck = SHELLS.has(command) && words.slice(1).includes("-n")
      const staticAnalysis = command === "shellcheck"
      if (!syntaxCheck && !staticAnalysis) {
        return "install.sh may only be run with --dry-run"
      }
    }
  }

  return undefined
}

/**
 * The tokenizing guard on an acceptance command. It runs before the verify
 * tool's permission assertion and before anything is spawned, so a denied
 * command is refused outright rather than executed and reported.
 *
 * The policy, in order: no substitution, expansion, redirection, pipe,
 * separator or line-break characters anywhere; only `&&` chains; every word of
 * every segment scanned against a denylist of dangerous commands, flat and
 * inside quotes; interpreter-plus-eval-flag pairs denied; `install.sh` only
 * with `--dry-run`. Read-only commands and test runners pass.
 */
export function guardVerifyCommand(command: string): GuardVerdict {
  if (command.trim().length === 0) return denied("command is empty")

  for (const [character, label] of DENIED_CHARACTERS) {
    if (command.includes(character)) return denied(`denied character: ${label}`)
  }
  if (SINGLE_AMPERSAND.test(command)) {
    return denied("denied character: single & (backgrounding); only && chains are allowed")
  }

  for (const segment of command.split("&&")) {
    const tokenized = tokenize(segment)
    if ("error" in tokenized) return denied(tokenized.error)
    const reason = guardSegment(tokenized.words)
    if (reason !== undefined) return denied(reason)
  }

  return { ok: true }
}

// ---------------------------------------------------------------- diff base

/** Git refs: a branch or tag name, a remote-tracking name, or a commit id. */
const DIFF_BASE_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._/-]*$/

/**
 * Validates the `base` ref of the diff tool before it reaches the VCS
 * service: a ref is a plain name, not a path and not an option, so absolute
 * paths, `..` traversal, option-like prefixes and shell-significant
 * characters are all refused with a stated reason.
 */
export function validateDiffBase(base: string): string | undefined {
  if (base.length > 255) return "base must be at most 255 characters"
  if (base.startsWith("-")) return "base must not start with `-` (option-like input)"
  if (base.startsWith("/") || /^[A-Za-z]:[\\/]/.test(base)) {
    return "base must be a git ref, not an absolute path"
  }
  if (base.includes("..")) return "base must not contain `..`"
  if (!DIFF_BASE_PATTERN.test(base)) {
    return "base must be a plain git ref: letters, digits, `@`, `.`, `_`, `-` and `/` only"
  }
  if (base.includes("//") || base.endsWith("/") || base.includes("/./")) {
    return "base must be a plain git ref: no empty or `.` path segments"
  }
  return undefined
}
