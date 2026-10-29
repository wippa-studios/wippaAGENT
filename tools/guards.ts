/**
 * Pure input guards for the wippa tools. No imports, no I/O: every function
 * here is a total function from untrusted tool input to a verdict, so the
 * test battery can exercise the whole policy without a session or a spawn.
 *
 * `guardVerifyCommand` is the single source of the acceptance-command policy;
 * `operations.ts` and `index.ts` cite this module rather than restating the
 * policy. The policy, in execution order:
 *
 * 1. Character policy — command substitution (backtick, `$`), subshells
 *    (`(`, `)`), redirection (`<`, `>`), pipes, statement separators (`;`),
 *    newlines and carriage returns are refused anywhere in the string; any
 *    `&` that is not exactly `&&` is refused, so `&&&` fails too; only `&&`
 *    chains are accepted.
 * 2. Segment shape — each `&&` segment must tokenize into words (quotes
 *    stripped, unterminated quotes refused), and a segment that begins with
 *    `NAME=` is refused as an environment-variable assignment prefix.
 * 3. Fast-fail denials with specific reasons — dangerous words flat and
 *    inside quotes (the `sudo` and `rm` families, network and archive tools,
 *    file mutators, `awk`, `xargs`), interpreter-plus-eval-flag pairs
 *    (`bash -c`, `python -c`, `node -e`, `sed -i`, `find -exec`), mutating
 *    `git` subcommands, package install/publish/exec subcommands, npm's
 *    subcommand position, git's global options and git's per-subcommand
 *    argument rules.
 * 4. `install.sh` may only run with `--dry-run` (or under `bash -n` /
 *    `shellcheck`).
 * 5. The allowlist — the command word of every segment must be in
 *    `ALLOWED_COMMANDS`, or be exactly `./install.sh`. Everything else
 *    (`node`, `npx`, `python3`, `gh`, `docker`, `find`, a planted `./file`)
 *    is refused by default. `bash` is allowed only as `bash -n <file>`.
 *
 * This is an allowlist of the acceptance surface plus a character policy. It
 * is not a sandbox: an allowed command runs with the authority of the user
 * running OpenCode, and `npm test` / `npm run <script>` execute whatever the
 * project's package.json scripts contain — the script body is the documented
 * residual and is not inspected here.
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

/**
 * Any `&` outside an exact `&&` pair backgrounds a command or separates
 * statements. Removing every `&&` first makes `&&&` fail as well: what is
 * left of it is a single `&`.
 */
function hasLoneAmpersand(command: string): boolean {
  return command.replaceAll("&&", "").includes("&")
}

// ------------------------------------------------------------------ commands

/**
 * Commands denied wherever they appear, as command or as argument: an
 * argument-position `rm` is one `xargs` away from executing, so the guard
 * denies the word rather than reasoning about every possible caller. These
 * are fast-fail reasons; the allowlist below is the real gate.
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

// --------------------------------------------------------- the allowlist

/**
 * Every command word that may open an `&&` segment. Absence from this set is
 * the real gate: `node`, `npx`, `python3`, `ruby`, `sh`, `gh`, `docker`,
 * `kubectl`, `find`, `make`, `env` and the rest are refused because they are
 * not named here, not because a rule anticipated them.
 *
 * `npm` and `git` are gated further down by their own subcommand rules;
 * `bash` only as `bash -n <file>`; `sed` without `-i`; `./install.sh` only
 * with `--dry-run` (its own rule runs before this gate).
 *
 * `sleep`, `seq` and `exit` are inert — they wait, print integers, or end
 * the shell — and the verify tool's own timeout, cancellation, truncation
 * and exit-code tests need them; they execute nothing.
 */
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  "npm",
  "git",
  "grep",
  "rg",
  "cat",
  "head",
  "tail",
  "wc",
  "ls",
  "test",
  "echo",
  "true",
  "false",
  "basename",
  "dirname",
  "realpath",
  "pwd",
  "sort",
  "uniq",
  "tr",
  "cut",
  "stat",
  "sha256sum",
  "which",
  "date",
  "bash",
  "shellcheck",
  "sed",
  "sleep",
  "seq",
  "exit",
])

// ---------------------------------------------------- interpreter/eval pairs

/**
 * The shell interpreters, shared by the `-c` pair below and the install.sh
 * syntax-check rule, so the two lists cannot drift apart.
 */
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
  { commands: SHELLS, flags: ["-c"], label: "shell with -c" },
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
 * Long options are matched exactly or as the head of a `--flag=value` word.
 * Short options are matched against the whole short-flag bundle: a
 * two-character flag (`-e`, `-c`, `-i`, `-r`) matches when the bundle
 * contains its letter, so `node -pe` and `bash -ec` are caught; a longer
 * single-dash flag matches as the head of the word, so sed's `-i.bak` is
 * caught without claiming `--in-place`'s siblings.
 */
function flagMatches(word: string, flag: string): boolean {
  if (word === flag) return true
  if (flag.startsWith("--")) return word.startsWith(`${flag}=`)
  if (word.startsWith("--") || !word.startsWith("-")) return false
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

/**
 * Git subcommands that pass the plain read-only gate. `branch` and `remote`
 * are also allowed, under the pure-listing rules below; everything else —
 * `pull`, `push`, `checkout-index`, `difftool`, `daemon`, `instaweb`,
 * `shell`, `filter-repo`, `lfs`, `svn`, `receive-pack`, `upload-pack` — is
 * refused because it is absent here. Deliberately not inferred as read-only:
 * `worktree list`, `submodule status`, `stash list` and `bisect log` stay
 * denied with the mutating subcommand they belong to.
 */
const GIT_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "status",
  "log",
  "diff",
  "show",
  "blame",
  "ls-remote",
  "rev-parse",
  "describe",
  "grep",
  "shortlog",
  "fetch",
  "branch",
  "remote",
])

/**
 * Git's global options are refused wherever they appear in a `git` segment:
 * `-c` reconfigures git from the command line (the option-adjacency bypass
 * that ran arbitrary commands), `-C` relocates it, and the rest change which
 * program or pager runs.
 */
const GIT_DENIED_GLOBAL_OPTIONS: ReadonlySet<string> = new Set([
  "-c",
  "-C",
  "--git-dir",
  "--work-tree",
  "--exec-path",
  "--paginate",
  "--no-pager",
])

/** These subcommands may not carry `--output`, which writes a file from git. */
const GIT_OUTPUT_DENY: ReadonlySet<string> = new Set(["show", "archive", "diff", "log"])

/**
 * `git branch` lists branches bare; every other argument creates, moves or
 * deletes one. The flags are the pure-listing set — no positional words, so
 * `git branch newbranch` is refused.
 */
const GIT_BRANCH_LIST_FLAGS: ReadonlySet<string> = new Set([
  "-a",
  "-r",
  "-v",
  "-vv",
  "-l",
  "--list",
  "--all",
  "--show-current",
])

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

/**
 * npm's own allowlist: the subcommand must be the first non-option word, so
 * `npm --yes exec …` and `npm pkg set …` are refused rather than parsed past.
 * `npm run` and `npm test` remain the documented residual — the script body
 * they execute lives in package.json and is not inspected here.
 */
const NPM_SUBCOMMANDS: ReadonlySet<string> = new Set(["test", "run", "ls"])

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

    if (name === "git") {
      if (index === 0) {
        // Global options first: `-c` and `-C` change what git runs and
        // where, which is how option adjacency escaped the old denylist.
        for (const token of words) {
          if (GIT_DENIED_GLOBAL_OPTIONS.has(token)) {
            return `denied git global option: \`${token}\` (git configuration and location are set outside the command)`
          }
        }
        const leading = words[1]
        if (leading === undefined) {
          return "git subcommand missing (only read-only subcommands pass)"
        }
        if (leading.startsWith("-")) {
          return `denied git option before the subcommand: \`${leading}\` (fail closed; only read-only subcommands pass)`
        }
      }

      const subcommand = words[index + 1]
      // `git branch` lists with the pure-listing flags and no positional
      // words; `git remote` lists with `-v` or shows one remote by name.
      if (subcommand === "branch") {
        for (let next = index + 2; next < words.length; next++) {
          const argument = words[next]!
          if (!GIT_BRANCH_LIST_FLAGS.has(argument)) {
            return "denied arguments to `git branch` (only pure-listing flags are allowed)"
          }
        }
        continue
      }
      if (subcommand === "remote") {
        const arguments_ = words.slice(index + 2)
        const listing = arguments_.every((argument) => argument === "-v")
        const show =
          arguments_[0] === "show" &&
          arguments_.slice(1).every((argument) => !argument.startsWith("-"))
        if (!listing && !show) {
          return "denied arguments to `git remote` (only `-v` and `show <name>` are allowed)"
        }
        continue
      }
      if (subcommand !== undefined && GIT_MUTATING.has(subcommand)) {
        return `denied pair: \`git ${subcommand}\` (mutating git subcommand)`
      }
      if (index === 0 && subcommand !== undefined) {
        if (subcommand === "fetch") {
          for (const token of words) {
            if (token.startsWith("+")) {
              return "denied `git fetch` refspec: a `+` force-update refspec is refused"
            }
            if (token.startsWith("--upload-pack")) {
              return "denied `git fetch` option: `--upload-pack` runs an arbitrary command"
            }
          }
        }
        if (GIT_OUTPUT_DENY.has(subcommand)) {
          for (const token of words) {
            if (token.startsWith("--output")) {
              return `denied \`git ${subcommand} --output\`: writing a file from git is refused`
            }
          }
        }
        if (!GIT_SUBCOMMANDS.has(subcommand)) {
          return `denied git subcommand: \`${subcommand}\` (not in the read-only allowlist)`
        }
      }
    }

    const deniedSubcommands = PACKAGE_MANAGERS.get(name)
    if (deniedSubcommands !== undefined && index + 1 < words.length) {
      const subcommand = words[index + 1]!
      if (deniedSubcommands.has(subcommand)) {
        return `denied pair: \`${name} ${subcommand}\` (installing, publishing or executing packages)`
      }
    }

    if (name === "npm" && index === 0) {
      const subcommand = words[1]
      if (subcommand === undefined) {
        return "npm subcommand missing (only test, run and ls pass)"
      }
      if (subcommand.startsWith("-")) {
        return `denied npm option before the subcommand: \`${subcommand}\` (fail closed; only test, run and ls pass)`
      }
      if (!NPM_SUBCOMMANDS.has(subcommand)) {
        return `denied npm subcommand: \`${subcommand}\` (only test, run and ls pass)`
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

  // The allowlist gate: the command word must be named, or be the one path
  // execution allowed. A word containing `/` is a planted-file risk, so only
  // the exact string `./install.sh` passes it.
  const commandWord = words[0]!
  if (commandWord !== "./install.sh") {
    if (commandWord.includes("/")) {
      return `denied command: \`${commandWord}\` (only \`./install.sh\` may be run by path)`
    }
    if (!ALLOWED_COMMANDS.has(commandWord)) {
      return `denied command: \`${commandWord}\` (not in the acceptance allowlist)`
    }
    if (commandWord === "bash") {
      const arguments_ = words.slice(1)
      if (!arguments_.includes("-n")) {
        return "bash is only allowed as `bash -n <file>` (syntax check)"
      }
      for (const argument of arguments_) {
        if (argument.startsWith("-") && argument !== "-n") {
          return `denied bash option: \`${argument}\` (only \`-n\` passes)`
        }
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
 * The policy lives in this file's header: a character policy, `&&` chains
 * only, no `NAME=` assignment prefixes, fast-fail denials with reasons, the
 * `install.sh` `--dry-run` rule, and finally the allowlist on the command
 * word. A command outside the allowlist never runs.
 */
export function guardVerifyCommand(command: string): GuardVerdict {
  if (command.trim().length === 0) return denied("command is empty")

  for (const [character, label] of DENIED_CHARACTERS) {
    if (command.includes(character)) return denied(`denied character: ${label}`)
  }
  if (hasLoneAmpersand(command)) {
    return denied(
      "denied character: `&` outside an exact `&&` chain (backgrounding); only && chains are allowed",
    )
  }

  for (const segment of command.split("&&")) {
    // `GIT_TRACE2=… git log` exports a variable for one command; the guard
    // refuses any assignment prefix rather than reasoning about each one.
    if (/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(segment)) {
      return denied(
        "denied: environment-variable assignment prefix (`NAME=value`) before a command",
      )
    }
    const tokenized = tokenize(segment)
    if ("error" in tokenized) return denied(tokenized.error)
    const reason = guardSegment(tokenized.words)
    if (reason !== undefined) return denied(reason)
  }

  return { ok: true }
}

// ------------------------------------------------------------ verify cwd

/**
 * Validates the `cwd` of a verify call. A relative cwd resolves against the
 * location directory, so a `..` segment would escape it; line breaks and
 * null bytes are never legitimate in a path. Absolute paths pass — the
 * command that runs there is bounded by the allowlist above.
 */
export function validateVerifyCwd(cwd: string): string | undefined {
  if (cwd.includes("\0")) return "cwd must not contain null bytes"
  if (/[\r\n]/.test(cwd)) return "cwd must not contain line breaks"
  if (/(^|[\\/])\.\.([\\/]|$)/.test(cwd)) return "cwd must not contain `..` segments"
  return undefined
}

// ---------------------------------------------------------------- diff base

/** Git refs: a branch or tag name, a remote-tracking name, or a commit id. */
const DIFF_BASE_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._/-]*$/

/**
 * Validates the `base` ref of the diff tool before it reaches the VCS
 * service: a ref is a plain name, not a path and not an option, so absolute
 * paths, `..` traversal, option-like prefixes and shell-significant
 * characters are all refused with a stated reason.
 *
 * Deliberately fail-closed: `HEAD~1` and `main^` are refused even though git
 * accepts them, because `~` and `^` are outside the plain-ref character set.
 * A caller that needs history ranges names a full ref instead.
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
