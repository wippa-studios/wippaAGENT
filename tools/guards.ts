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
 *    `&` that is not exactly `&&` is refused, so `&&&` fails too, and only
 *    `&&` chains are accepted. An unquoted backslash is refused: the shell
 *    removes it before the command runs, so `pytest \-p evil` reaches pytest
 *    as `-p evil` and never matches an option rule. Unquoted glob
 *    metacharacters (`*`, `?`, `[`, `]`) are refused as well, because the
 *    shell expands them into file names — a crafted file named `-p` is an
 *    option the guard never saw. An unquoted brace expansion (`{a,b}`,
 *    `{1..3}`) is refused for the same reason; a lone `{}` or `{a}`, which
 *    the shell leaves literal, is not. A backslash, glob or brace inside
 *    single or double quotes is data and stays allowed.
 * 2. Segment shape — each `&&` segment must tokenize into words (quotes
 *    stripped, unterminated quotes refused), and a segment that begins with
 *    `NAME=` is refused as an environment-variable assignment prefix.
 * 3. Fast-fail denials with specific reasons — dangerous words flat and
 *    inside quotes (the `sudo` and `rm` families, network and archive tools,
 *    file mutators, `awk`, `xargs`), interpreter-plus-eval-flag pairs
 *    (`bash -c`, `python -c`, `node -e`, `sed -i`, `find -exec`), package
 *    install/publish/exec subcommands, npm's subcommand position (the
 *    subcommand must immediately follow `npm`; any option in that position
 *    fails closed), and — in a segment whose command word is `git` — git's
 *    global options in `--flag` and `--flag=value` form and at any
 *    unambiguous long-option prefix (`--up` reaches `--upload-pack`), git's
 *    exec-channel options (`--upload-pack`, `--open-files-in-pager` and its
 *    short form `-O`, `--ext-diff`, `--textconv`), any argument containing
 *    `::` (transport syntax such as `ext::cmd`), mutating subcommands and
 *    each subcommand's argument rules.
 * 4. Per-command flag policies — `sort` and `uniq` accept only the options
 *    named in their read-only flag allowlist, so `-o` truncates nothing and
 *    `--compress-program` executes nothing; `rg` refuses `--pre` and
 *    `--pre-glob`, which run a program per file searched; and `bash` runs
 *    only as `bash -n <file>` — `-n` must be the first argument and every
 *    later word a bare file name, so `bash evil.sh -n` (which executes
 *    `evil.sh`) never runs. The polyglot runners (`pytest`, `go`, `cargo`,
 *    `make`, `node`, `python3`/`python`) use fail-closed flag allowlists:
 *    every option token must be named in that runner's table, an option with
 *    a value consumes exactly that value (and the value may not begin with
 *    `-`, so `cargo check --target --config=…` cannot smuggle a second
 *    option through the first one's value slot), a value pattern an option
 *    names is enforced (`cargo --target` refuses a path or a `.json` target
 *    spec), and the subcommands and python modules are closed sets. A bare
 *    `--` is refused unless the
 *    subcommand names a post-`--` allowlist. For `make`, every positional
 *    word matching an assignment (`=` and the `:=`, `::=`, `:::=`, `+=`,
 *    `?=` and `!=` operators, with leading whitespace and whitespace before
 *    the operator, as make trims it) is refused as a command-line variable
 *    assignment (`MAKEFILES=…` loads another makefile, `SHELL=…` picks the
 *    recipe shell); for `pytest`, directly or through `python -m pytest`, a
 *    token in an argument-file spelling (`@file`, `=@file`, `-k@file`) is
 *    refused as an argument file that expands options the guard cannot see,
 *    while an `@` anywhere else — a test path or a keyword expression — is
 *    data and passes.
 * 5. `install.sh` may only run with `--dry-run`, and only from the command
 *    word that would execute it (`./install.sh`, or a shell or `shellcheck`
 *    naming it): `bash -n install.sh` and `shellcheck install.sh` pass as
 *    static checks, while `cat install.sh` reads the file as data.
 * 6. The allowlist — the command word of every segment must be in
 *    `ALLOWED_COMMANDS`, or be exactly `./install.sh`. Polyglot test runners
 *    (`pytest`, `go test/vet`, `cargo test/check/clippy`, `make`, `node`
 *    and `python3`) are allowed under their fail-closed policies. Everything
 *    else (`npx`, `gh`, `docker`, `find`, `sed`, a planted `./file`) is
 *    refused by default.
 *
 * This is an allowlist of the acceptance surface plus a character policy. It
 * is not a sandbox: an allowed command runs with the authority of the user
 * running OpenCode. The residual is explicit, in three parts. (a) `npm test`
 * and `npm run <script>` execute whatever the project's package.json scripts
 * contain — the script body lives in package.json and is not inspected here.
 * (b) Commands other than the polyglot runners are policed only where a rule
 * above is written: git's denied global and exec-channel options, `sort`'s
 * and `uniq`'s read-only flag allowlists, `rg`'s denied `--pre` flags,
 * `bash`'s positional rule and npm's five named options
 * (`--script-shell`, `--shell`, `--prefix`, `--userconfig`,
 * `--globalconfig`, including their single-dash and abbreviated spellings).
 * An option no rule names is passed through to those
 * commands — git's read-only options, `grep` flags, `head`/`tail` ranges,
 * npm options after the subcommand other than those five, and `git fetch`
 * contacting the network all reach the command itself, under the user's own
 * authority. The runner tables do not have that residual: an option the table
 * does not name is refused. (c) A harness the acceptance command runs remains
 * uninspected by the guard. `wippa_verify`
 * separately asks the caller to acknowledge a working diff that changes the
 * harness, but that check is a policy gate, not a sandbox: an acknowledged
 * harness still runs with the user's authority.
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

/**
 * Finds the `}` that closes an unquoted `{`, tracking quote state from the
 * opening brace. `pytest {x"}"y,-p}` has a `}` inside double quotes and a
 * real close after it; `indexOf("}")` would stop at the quoted one and let
 * the comma past the brace rule. Escapes inside double quotes follow the same
 * rule as `unquotedMetacharacter`: a backslash escapes only `$`, a backtick,
 * `"`, `\` or a newline. A `{` with no closing `}` outside quotes is literal
 * in the shell, so the caller leaves it alone.
 */
function closingBrace(command: string, open: number): number | undefined {
  let quote: '"' | "'" | undefined
  for (let index = open + 1; index < command.length; index++) {
    const character = command[index]!
    if (quote === "'") {
      if (character === "'") quote = undefined
      continue
    }
    if (quote === '"') {
      if (character === '"') {
        quote = undefined
        continue
      }
      if (character === "\\") {
        const next = command[index + 1]
        if (next === "$" || next === "`" || next === '"' || next === "\\" || next === "\n") {
          index += 1
        }
      }
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      continue
    }
    if (character === "}") return index
  }
  return undefined
}

/**
 * Refuses metacharacters the shell rewrites before the command word sees
 * them. A backslash outside quotes escapes the next character, which is how
 * `pytest \-p evil` becomes `pytest -p evil` after tokenizing has already
 * passed it through as a word starting with `\`. An unquoted glob expands
 * into file names, so a file called `-p` becomes an option (and `*` can add
 * one); brace expansion similarly synthesises words.
 *
 * The scan runs on the raw command, before `tokenize`, and tracks quotes the
 * way the shell does: a backslash inside double quotes escapes only `$`,
 * a backtick, `"`, `\` or a newline, so `"a\"b"` keeps the quote state that
 * a naive counter would lose. Inside either quote kind these characters are
 * data and stay allowed: `pytest -k 'a\-b'` and `pytest -k "test_*"` never
 * reach the shell as an escape or a glob.
 */
function unquotedMetacharacter(command: string): string | undefined {
  let quote: '"' | "'" | undefined
  for (let index = 0; index < command.length; index++) {
    const character = command[index]!
    if (quote === "'") {
      if (character === "'") quote = undefined
      continue
    }
    if (quote === '"') {
      if (character === '"') {
        quote = undefined
        continue
      }
      if (character === "\\") {
        const next = command[index + 1]
        if (next === "$" || next === "`" || next === '"' || next === "\\" || next === "\n") {
          index += 1
        }
      }
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      continue
    }
    if (character === "\\") {
      return "denied character: unquoted backslash (the shell removes it before the command sees the word)"
    }
    if (character === "*" || character === "?" || character === "[" || character === "]") {
      return "denied character: unquoted glob (the shell expands it into file names the guard cannot see)"
    }
    if (character === "{") {
      // Only a real brace expansion is refused. `{}` (as in `find -exec …
      // {}`) and `{a}` are literal in the shell, and denying them would
      // shadow the more specific rules that already refuse those commands.
      // The close must be found with quote tracking: a `}` inside quotes is
      // data, so `{x"}"y,-p}` must still see the comma after it.
      const close = closingBrace(command, index)
      if (close !== undefined) {
        const body = command.slice(index + 1, close)
        if (body.includes(",") || body.includes("..")) {
          return "denied character: unquoted brace expansion (synthesises words the guard cannot see)"
        }
      }
      continue
    }
  }
  return undefined
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
 * the real gate: `npx`, `ruby`, `sh`, `gh`, `docker`, `kubectl`, `find`,
 * `env`, `sed` and the rest are refused because they are not named here,
 * not because a rule anticipated them. `sed` is
 * deliberately absent: a sed script is a program of its own — `1e sh -c …`
 * executes a shell and `w /path` writes a file — and the acceptance chain
 * never invokes sed, so the whole dialect is refused rather than parsed.
 *
 * `npm` and `git` are gated further down by their own subcommand rules;
 * `bash` only as `bash -n <file>`; `sort` and `uniq` only under their
 * read-only flag allowlist; `rg` without `--pre`; `./install.sh` only with
 * `--dry-run` (its own rule runs before this gate).
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
  "sleep",
  "seq",
  "exit",
  "pytest",
  "go",
  "cargo",
  "make",
  "node",
  "python3",
  "python",
])

// -------------------------------------------------- per-command flag policy

/**
 * The shape of a read-only flag allowlist: exact long options, and the
 * single letters that may appear in any short bundle (`sort -nr` passes,
 * `sort -no` does not). No option in either set takes an operand, so a word
 * that does not start with `-` is always a file operand.
 */
interface UtilityFlagPolicy {
  readonly short: ReadonlySet<string>
  readonly long: ReadonlySet<string>
}

/**
 * Read-only flag allowlists for the two allowlisted commands that ship an
 * option able to break the boundary: `sort -o FILE` and BSD `uniq -o FILE`
 * truncate and write FILE, and `sort --compress-program=…` executes an
 * arbitrary program. So for `sort` and `uniq` every option word must be
 * named here — fail closed, bundles included — while words that do not
 * start with `-` are file operands.
 */
const UTILITY_FLAG_ALLOWLIST: ReadonlyMap<string, UtilityFlagPolicy> = new Map([
  [
    "sort",
    {
      short: new Set(["n", "u", "r", "b", "f", "i", "g", "h", "c", "V", "s"]),
      long: new Set([
        "--numeric-sort",
        "--unique",
        "--reverse",
        "--stable",
        "--ignore-case",
        "--dictionary-order",
        "--general-numeric-sort",
        "--human-numeric-sort",
        "--check",
        "--version-sort",
      ]),
    },
  ],
  [
    "uniq",
    {
      short: new Set(["c", "d", "u", "f", "i", "s", "w"]),
      long: new Set(["--count", "--unique", "--repeat", "--repeated", "--group", "--all-repeated"]),
    },
  ],
])

/**
 * `rg --pre=COMMAND` and `rg --pre-glob` run a program per file searched —
 * the only command-execution channel ripgrep exposes on the command line.
 * Everything else ripgrep accepts reads files or prints to stdout, which
 * this tool already captures under its output cap; ripgrep has no
 * file-writing flag.
 */
const COMMAND_DENIED_OPTIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ["rg", ["--pre", "--pre-glob"]],
])

/** Whether an option word of `sort` / `uniq` is named in the allowlist. */
function utilityFlagAllowed(token: string, policy: UtilityFlagPolicy): boolean {
  if (token.startsWith("--")) return policy.long.has(token)
  for (const letter of token.slice(1)) {
    if (!policy.short.has(letter)) return false
  }
  return true
}

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
  // `sed -i` is a fast-fail reason, not the only gate: `sed` itself is off
  // the command allowlist, so every `sed` segment is refused anyway. The
  // pair stays so `sed -i …` reports the specific reason before the
  // allowlist refusal.
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

/**
 * Git accepts any unambiguous prefix of a long option, so `--up=…` reaches
 * `--upload-pack` and runs the named program. A long token therefore matches
 * a denied name when the denied name starts with the token's head (the part
 * before `=`); the head must be longer than the two dashes, so `--u` matches
 * and a bare `--` does not. Short options keep `flagMatches`' rule: git does
 * not abbreviate them, and the bundle form (`-cfoo`) is still refused.
 */
function gitOptionMatches(token: string, option: string): boolean {
  if (!option.startsWith("--")) return flagMatches(token, option)
  if (!token.startsWith("--")) return false
  const equals = token.indexOf("=")
  const head = equals === -1 ? token : token.slice(0, equals)
  if (head.length < 3) return false
  return option.startsWith(head)
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
 * Git's global options are refused wherever they appear in a `git` segment,
 * as `--flag` or `--flag=value`: `-c` reconfigures git from the command line
 * (the option-adjacency bypass that ran arbitrary commands), `-C`
 * relocates it, and the rest change which program or pager runs.
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

/**
 * Git options that run a program the command line cannot show, refused in
 * every `git` segment, in both `--flag` and `--flag=value` form:
 * `--upload-pack` spawns the named program locally (from `fetch` and from
 * `ls-remote`, which executes it without contacting a remote first),
 * `--open-files-in-pager` runs it from `git grep` and its short form `-O`
 * is the same option, and `--ext-diff` / `--textconv` run the diff driver and
 * textconv filters the repository config names. `-O` is matched by the
 * short-flag bundle rule, so the attached (`-O/bin/sh`), separate
 * (`-O /bin/sh`) and bare forms are all refused.
 */
const GIT_EXEC_CHANNEL_OPTIONS: readonly string[] = [
  "--upload-pack",
  "--open-files-in-pager",
  "-O",
  "--ext-diff",
  "--textconv",
]

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
 * npm's own allowlist: the subcommand must immediately follow `npm`, and
 * any option in that position fails closed — `npm --yes exec …`,
 * `npm pkg set …` and `npm config set …` are refused rather than parsed
 * past. `npm run` and `npm test` remain the documented residual — the
 * script body they execute lives in package.json and is not inspected here.
 */
const NPM_SUBCOMMANDS: ReadonlySet<string> = new Set(["test", "run", "ls"])

/**
 * npm options that change the shell a script runs in, the directory npm treats
 * as the project, or the configuration file npm reads. They belong to npm, not
 * to the runner the script names, so the runner flag tables never see them.
 * Refused in both `--flag=value` and `--flag value` form; every other npm
 * option after the subcommand is the header's residual (b).
 */
const NPM_DENIED_OPTIONS: readonly string[] = [
  "--script-shell",
  "--shell",
  "--prefix",
  "--userconfig",
  "--globalconfig",
]

/**
 * npm accepts a long option with one or two leading dashes (`-script-shell=…`
 * is `--script-shell=…`) and any unambiguous prefix (`--script=…`,
 * `--prefi=…`). Normalise a dash-prefixed token to its option name — strip
 * one or two dashes, cut at `=` — and return the denied option it abbreviates,
 * or undefined. A name shorter than three characters is not matched: `-s` is
 * npm's short silent flag, not the head of `--shell`.
 */
function npmDeniedOption(token: string): string | undefined {
  if (!token.startsWith("-")) return undefined
  const withoutDashes = token.startsWith("--") ? token.slice(2) : token.slice(1)
  const equals = withoutDashes.indexOf("=")
  const name = equals === -1 ? withoutDashes : withoutDashes.slice(0, equals)
  if (name.length < 3) return undefined
  return NPM_DENIED_OPTIONS.find((option) => option.slice(2).startsWith(name))
}

// -------------------------------------------------- polyglot runner policy

/**
 * How an option takes its value. `none` never consumes the next word;
 * `value` requires one; `optional` consumes the next word only when it is a
 * positional and any pattern the spec names accepts it (so `make -j 4` and
 * `make -j4` both pass, `make -j MAKEFILES=…` leaves the assignment
 * positioned for the make rule, and `make -j -C /x` leaves `-C` to be
 * refused on its own).
 */
type FlagArity = "none" | "value" | "optional"

interface FlagSpec {
  readonly arity: FlagArity
  /** When present, only these values are accepted (`node --test-reporter`). */
  readonly values?: ReadonlySet<string>
  /**
   * When present, the option's value must match. On an `optional` flag a
   * separate word is consumed only if it matches: GNU make's `-j` takes an
   * optional numeric argument but leaves a following target alone, so
   * `make -j MAKEFILES=…` is an assignment, not a job count. On a `value`
   * flag the value is checked after it is consumed, so `cargo --target` can
   * refuse a path to a custom target JSON whose linker field names a program.
   */
  readonly pattern?: RegExp
}

/**
 * One runner's flags. For GNU-style commands `long` is keyed with the leading
 * dashes (`--verbose`) and `short` by the bare letter (`v`), so short bundles
 * follow the same rule as `flagMatches`: every letter in `-vq` must be named.
 * For `go` style, `long` is keyed by the bare name because Go accepts either
 * one or two dashes (`-race`, `--race`) and does not bundle short options.
 */
interface FlagSet {
  readonly long: ReadonlyMap<string, FlagSpec>
  readonly short: ReadonlyMap<string, FlagSpec>
}

interface RunnerPolicy {
  readonly style: "gnu" | "go"
  /** The subcommands that may follow the command word; absent means none. */
  readonly subcommands?: ReadonlySet<string>
  /** Flags accepted before a bare `--`. */
  readonly flags: FlagSet
  /** Flags accepted after a bare `--`, per subcommand. */
  readonly afterDoubleDash?: ReadonlyMap<string, FlagSet>
  /** Python only: modules that may follow `-m`, with the policy after it. */
  readonly modules?: ReadonlyMap<string, FlagSet>
}

const NO_VALUE: FlagSpec = { arity: "none" }
const TAKES_VALUE: FlagSpec = { arity: "value" }
const OPTIONAL_VALUE: FlagSpec = { arity: "optional" }

function flagSet(
  long: Readonly<Record<string, FlagSpec>> = {},
  short: Readonly<Record<string, FlagSpec>> = {},
): FlagSet {
  return { long: new Map(Object.entries(long)), short: new Map(Object.entries(short)) }
}

/**
 * pytest's fail-closed flag allowlist. The debugger (`--pdb`, `--trace`),
 * plugin loader (`-p`), config-file selectors (`-c`, `--config-file`) and ini
 * overrides (`-o`, `--override-ini`) are deliberately absent: each one names
 * or loads code or configuration the guard cannot inspect. `--cov` takes an
 * optional value because pytest-cov accepts it bare; the `=` form matches on
 * the head.
 */
const PYTEST_FLAGS: FlagSet = flagSet(
  {
    "--verbose": NO_VALUE,
    "--quiet": NO_VALUE,
    "--exitfirst": NO_VALUE,
    "--maxfail": TAKES_VALUE,
    "--strict-markers": NO_VALUE,
    "--strict-config": NO_VALUE,
    "--disable-warnings": NO_VALUE,
    "--show-capture": TAKES_VALUE,
    "--tb": TAKES_VALUE,
    "--capture": TAKES_VALUE,
    "--code-highlight": TAKES_VALUE,
    "--color": TAKES_VALUE,
    "--collect-only": NO_VALUE,
    "--continue-on-collection-errors": NO_VALUE,
    "--durations": TAKES_VALUE,
    "--durations-min": TAKES_VALUE,
    "--ignore": TAKES_VALUE,
    "--ignore-glob": TAKES_VALUE,
    "--deselect": TAKES_VALUE,
    "--rootdir": TAKES_VALUE,
    "--import-mode": TAKES_VALUE,
    "--last-failed": NO_VALUE,
    "--failed-first": NO_VALUE,
    "--new-first": NO_VALUE,
    "--cache-clear": NO_VALUE,
    "--cache-show": OPTIONAL_VALUE,
    "--lf": NO_VALUE,
    "--ff": NO_VALUE,
    "--nf": NO_VALUE,
    "--stepwise": NO_VALUE,
    "--stepwise-skip": NO_VALUE,
    "--sw": NO_VALUE,
    "--setup-show": NO_VALUE,
    "--showlocals": NO_VALUE,
    "--no-showlocals": NO_VALUE,
    "--full-trace": NO_VALUE,
    "--fixtures": NO_VALUE,
    "--markers": NO_VALUE,
    "--version": NO_VALUE,
    "--help": NO_VALUE,
    "--no-header": NO_VALUE,
    "--no-summary": NO_VALUE,
    "--cov": OPTIONAL_VALUE,
    "--cov-report": TAKES_VALUE,
    "--cov-fail-under": TAKES_VALUE,
    "--cov-append": NO_VALUE,
    "--cov-branch": NO_VALUE,
    "--no-cov": NO_VALUE,
    "--log-level": TAKES_VALUE,
    "--log-cli-level": TAKES_VALUE,
    "--runxfail": NO_VALUE,
  },
  {
    v: NO_VALUE,
    q: NO_VALUE,
    x: NO_VALUE,
    s: NO_VALUE,
    l: NO_VALUE,
    h: NO_VALUE,
    k: TAKES_VALUE,
    m: TAKES_VALUE,
    r: TAKES_VALUE,
    W: TAKES_VALUE,
    n: TAKES_VALUE,
  },
)

/**
 * `python3 -m unittest` flags. `-c` is absent both here and in the pytest
 * table: `EVAL_FLAG_PAIRS` already refuses any `python -c` as inline code, so
 * the unittest `--catch` short form is refused rather than special-cased.
 */
const UNITTEST_FLAGS: FlagSet = flagSet(
  {
    "--verbose": NO_VALUE,
    "--quiet": NO_VALUE,
    "--failfast": NO_VALUE,
    "--catch": NO_VALUE,
    "--buffer": NO_VALUE,
    "--locals": NO_VALUE,
    "--help": NO_VALUE,
    "--durations": TAKES_VALUE,
    "--start-directory": TAKES_VALUE,
    "--pattern": TAKES_VALUE,
    "--top-level-directory": TAKES_VALUE,
  },
  {
    v: NO_VALUE,
    q: NO_VALUE,
    f: NO_VALUE,
    b: NO_VALUE,
    h: NO_VALUE,
    k: TAKES_VALUE,
    s: TAKES_VALUE,
    p: TAKES_VALUE,
    t: TAKES_VALUE,
  },
)

/**
 * `go test` and `go vet` flags. The exec-channel flags (`-exec`, `-toolexec`,
 * `-vettool`) and `-args` are absent, so they are refused by the allowlist
 * rather than by a named denial. Go accepts one or two leading dashes, which
 * is why this set is keyed by bare names.
 */
const GO_FLAGS: FlagSet = flagSet({
  v: NO_VALUE,
  race: NO_VALUE,
  run: TAKES_VALUE,
  bench: TAKES_VALUE,
  benchtime: TAKES_VALUE,
  count: TAKES_VALUE,
  cover: NO_VALUE,
  covermode: TAKES_VALUE,
  coverpkg: TAKES_VALUE,
  cpu: TAKES_VALUE,
  list: TAKES_VALUE,
  json: NO_VALUE,
  short: NO_VALUE,
  timeout: TAKES_VALUE,
  tags: TAKES_VALUE,
  parallel: TAKES_VALUE,
  failfast: NO_VALUE,
  shuffle: OPTIONAL_VALUE,
  mod: TAKES_VALUE,
  p: TAKES_VALUE,
  vet: TAKES_VALUE,
  work: NO_VALUE,
  x: NO_VALUE,
  n: NO_VALUE,
  help: NO_VALUE,
})

/**
 * Cargo's shared flags. `--config`, `-Z` and `--manifest-path` are absent:
 * each one can load configuration or a wrapper the guard cannot inspect.
 * `--target` takes a triple or a built-in target name, not a path: a path to
 * a custom target JSON names a `linker` program cargo will run, so the value
 * is restricted to the characters a triple uses, and a value ending in
 * `.json` is refused even without a slash — a bare `target.json` is a custom
 * target spec, not a triple.
 */
const CARGO_FLAGS: FlagSet = flagSet(
  {
    "--release": NO_VALUE,
    "--target": { arity: "value", pattern: /^(?!.*\.json$)[A-Za-z0-9_.-]+$/i },
    "--features": TAKES_VALUE,
    "--all-features": NO_VALUE,
    "--no-default-features": NO_VALUE,
    "--workspace": NO_VALUE,
    "--all": NO_VALUE,
    "--package": TAKES_VALUE,
    "--exclude": TAKES_VALUE,
    "--locked": NO_VALUE,
    "--offline": NO_VALUE,
    "--frozen": NO_VALUE,
    "--jobs": TAKES_VALUE,
    "--verbose": NO_VALUE,
    "--quiet": NO_VALUE,
    "--color": TAKES_VALUE,
    "--message-format": TAKES_VALUE,
    "--target-dir": TAKES_VALUE,
    "--profile": TAKES_VALUE,
    "--timings": NO_VALUE,
    "--keep-going": NO_VALUE,
    "--tests": NO_VALUE,
    "--lib": NO_VALUE,
    "--bins": NO_VALUE,
    "--examples": NO_VALUE,
    "--benches": NO_VALUE,
    "--doc": NO_VALUE,
    "--no-run": NO_VALUE,
    "--no-fail-fast": NO_VALUE,
    "--future-incompat-report": NO_VALUE,
    "--ignore-rust-version": NO_VALUE,
  },
  { v: NO_VALUE, q: NO_VALUE, p: TAKES_VALUE, j: TAKES_VALUE },
)

/** `cargo clippy -- …` receives the lint-level flags it passes to rustc. */
const CARGO_CLIPPY_POST: FlagSet = flagSet(
  {
    "--deny": TAKES_VALUE,
    "--warn": TAKES_VALUE,
    "--allow": TAKES_VALUE,
    "--forbid": TAKES_VALUE,
  },
  { D: TAKES_VALUE, W: TAKES_VALUE, A: TAKES_VALUE, F: TAKES_VALUE },
)

/** `cargo test -- …` receives the libtest flags named here. */
const CARGO_TEST_POST: FlagSet = flagSet({
  "--nocapture": NO_VALUE,
  "--exact": NO_VALUE,
  "--ignored": NO_VALUE,
  "--include-ignored": NO_VALUE,
  "--show-output": NO_VALUE,
  "--test-threads": TAKES_VALUE,
  "--skip": TAKES_VALUE,
  "--list": NO_VALUE,
  "--format": TAKES_VALUE,
  "--color": TAKES_VALUE,
  "--fail-fast": NO_VALUE,
  "--shuffle": OPTIONAL_VALUE,
  "--seed": TAKES_VALUE,
})

/**
 * GNU make flags. `-C`/`--directory`, `-f`/`--file`/`--makefile`,
 * `-I`/`--include-dir` and `-E`/`--eval` are absent: they change directory,
 * load another makefile, or evaluate text as make syntax.
 */
const MAKE_FLAGS: FlagSet = flagSet(
  {
    "--jobs": { arity: "optional", pattern: /^\d+$/ },
    "--keep-going": NO_VALUE,
    "--dry-run": NO_VALUE,
    "--just-print": NO_VALUE,
    "--silent": NO_VALUE,
    "--quiet": NO_VALUE,
    "--always-make": NO_VALUE,
    "--no-builtin-rules": NO_VALUE,
    "--no-builtin-variables": NO_VALUE,
    "--print-directory": NO_VALUE,
    "--no-print-directory": NO_VALUE,
    "--warn-undefined-variables": NO_VALUE,
    "--trace": NO_VALUE,
    "--help": NO_VALUE,
    "--version": NO_VALUE,
  },
  {
    j: { arity: "optional", pattern: /^\d+$/ },
    k: NO_VALUE,
    n: NO_VALUE,
    s: NO_VALUE,
    B: NO_VALUE,
    r: NO_VALUE,
    R: NO_VALUE,
    i: NO_VALUE,
    w: NO_VALUE,
    h: NO_VALUE,
  },
)

/**
 * Node's test-runner flags. The eval and preload channels (`-e`, `-p`, `-r`,
 * `--import`, `--loader`, `--experimental-loader`, `--watch`) are absent, and
 * `--test-reporter` is value-constrained to the reporters Node ships. A
 * reporter destination is a file write, so it is not named either.
 */
const NODE_FLAGS: FlagSet = flagSet(
  {
    "--test": NO_VALUE,
    "--test-only": NO_VALUE,
    "--test-concurrency": TAKES_VALUE,
    "--test-name-pattern": TAKES_VALUE,
    "--test-reporter": { arity: "value", values: new Set(["spec", "tap", "dot", "junit"]) },
    "--test-shard": TAKES_VALUE,
    "--test-timeout": TAKES_VALUE,
    "--experimental-test-coverage": NO_VALUE,
    "--experimental-strip-types": NO_VALUE,
    "--no-warnings": NO_VALUE,
    "--enable-source-maps": NO_VALUE,
    "--version": NO_VALUE,
    "--help": NO_VALUE,
  },
  { v: NO_VALUE, h: NO_VALUE },
)

/**
 * The policy table. A command word is looked up here once, at command
 * position; adding the next runner is a row, not another block in
 * `guardSegment`. Any option token the row does not name is refused, so the
 * table is the complete list of what each runner may be passed.
 */
const PYTHON_MODULES: ReadonlyMap<string, FlagSet> = new Map([
  ["unittest", UNITTEST_FLAGS],
  ["pytest", PYTEST_FLAGS],
])

const RUNNER_POLICIES: ReadonlyMap<string, RunnerPolicy> = new Map([
  ["pytest", { style: "gnu", flags: PYTEST_FLAGS }],
  ["go", { style: "go", subcommands: new Set(["test", "vet"]), flags: GO_FLAGS }],
  [
    "cargo",
    {
      style: "gnu",
      subcommands: new Set(["test", "check", "clippy"]),
      flags: CARGO_FLAGS,
      afterDoubleDash: new Map([
        ["clippy", CARGO_CLIPPY_POST],
        ["test", CARGO_TEST_POST],
      ]),
    },
  ],
  ["make", { style: "gnu", flags: MAKE_FLAGS }],
  ["node", { style: "gnu", flags: NODE_FLAGS }],
  ["python3", { style: "gnu", flags: flagSet(), modules: PYTHON_MODULES }],
  ["python", { style: "gnu", flags: flagSet(), modules: PYTHON_MODULES }],
])

/** `a and b`, or `a, b and c`, for a denial that names the closed set. */
function joined(values: Iterable<string>): string {
  const list = [...values]
  if (list.length <= 1) return list.join("")
  return `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`
}

function flagDenied(name: string, token: string): string {
  return `denied \`${name}\` option: \`${token}\` (not in ${name}'s flag allowlist)`
}

function requiresValue(name: string, token: string): string {
  return `denied \`${name}\` option: \`${token}\` (requires a value)`
}

function checkValue(
  name: string,
  display: string,
  spec: FlagSpec,
  value: string,
): string | undefined {
  if (value.length === 0) {
    return spec.arity === "optional" ? undefined : requiresValue(name, display)
  }
  if (spec.values !== undefined && !spec.values.has(value)) {
    return `denied \`${name}\` option: \`${display}\` (allowed values: ${[...spec.values].join(", ")})`
  }
  if (spec.pattern !== undefined && !spec.pattern.test(value)) {
    return `denied \`${name}\` option: \`${display}\` (value does not match \`${spec.pattern.source}\`)`
  }
  return undefined
}

interface OptionVerdict {
  readonly reason?: string
  /** True when the option consumed the following word as its value. */
  readonly consumedNext?: boolean
}

/** Consumes the next word for a value-taking option, or checks it as a value. */
function consumeValue(
  name: string,
  token: string,
  spec: FlagSpec,
  next: string | undefined,
): OptionVerdict {
  if (spec.arity === "value") {
    // A word beginning with `-` is another option, not this option's value:
    // `cargo check --target --config=…` would otherwise consume the second
    // option as a target name and leave `--config` unchecked. No flag in the
    // tables takes a negative value, so the rule is unconditional.
    if (next === undefined || next === "--" || next.startsWith("-")) {
      return { reason: requiresValue(name, token) }
    }
    const error = checkValue(name, `${token}=${next}`, spec, next)
    return error === undefined ? { consumedNext: true } : { reason: error }
  }
  if (spec.arity === "optional") {
    if (next !== undefined && next !== "--" && next !== "-" && !next.startsWith("-")) {
      if (spec.pattern !== undefined && !spec.pattern.test(next)) return {}
      const error = checkValue(name, `${token}=${next}`, spec, next)
      return error === undefined ? { consumedNext: true } : { reason: error }
    }
  }
  return {}
}

/**
 * Checks one option word against the active flag set. Short bundles follow
 * the `flagMatches` rule — every letter in the bundle must be named — and a
 * value-taking letter consumes the rest of the bundle (`-j4`) or the next
 * word (`-j 4`), so a value token is a positional and is not itself checked.
 */
function checkOption(
  name: string,
  token: string,
  style: RunnerPolicy["style"],
  set: FlagSet,
  next: string | undefined,
): OptionVerdict {
  if (style === "go") {
    const withoutDashes = token.startsWith("--") ? token.slice(2) : token.slice(1)
    const equals = withoutDashes.indexOf("=")
    const key = equals === -1 ? withoutDashes : withoutDashes.slice(0, equals)
    const spec = set.long.get(key)
    if (spec === undefined) return { reason: flagDenied(name, token) }
    if (equals !== -1) {
      if (spec.arity === "none") {
        return { reason: `denied \`${name}\` option: \`${token}\` (does not take a value)` }
      }
      const error = checkValue(name, token, spec, withoutDashes.slice(equals + 1))
      return error === undefined ? {} : { reason: error }
    }
    return consumeValue(name, token, spec, next)
  }

  if (token.startsWith("--")) {
    const equals = token.indexOf("=")
    const head = equals === -1 ? token : token.slice(0, equals)
    const spec = set.long.get(head)
    if (spec === undefined) return { reason: flagDenied(name, token) }
    if (equals !== -1) {
      if (spec.arity === "none") {
        return { reason: `denied \`${name}\` option: \`${token}\` (does not take a value)` }
      }
      const error = checkValue(name, token, spec, token.slice(equals + 1))
      return error === undefined ? {} : { reason: error }
    }
    return consumeValue(name, token, spec, next)
  }

  const bundle = token.slice(1)
  for (let position = 0; position < bundle.length; position++) {
    const letter = bundle[position]!
    const spec = set.short.get(letter)
    if (spec === undefined) return { reason: flagDenied(name, token) }
    if (spec.arity === "none") continue
    const rest = bundle.slice(position + 1)
    if (rest.length > 0) {
      const value = rest.startsWith("=") ? rest.slice(1) : rest
      const error = checkValue(name, token, spec, value)
      return error === undefined ? {} : { reason: error }
    }
    return consumeValue(name, token, spec, next)
  }
  return {}
}

/**
 * A positional word policy for a runner. `checkRunnerFlags` calls it for every
 * word it treats as a positional, after the option tables have decided which
 * words are values, so a policy never has to re-implement value consumption.
 */
type PositionalRule = (name: string, word: string) => string | undefined

/**
 * `make MAKEFILES=…`, `make SHELL=…`: an assignment macro on the command
 * line. GNU make trims leading blanks from every word and treats a word whose
 * left-hand side is a variable name and whose next characters are an
 * assignment operator as an assignment, so the `=`, `:=`, `::=`, `:::=`,
 * `+=`, `?=` and `!=` spellings all reach this pattern, with or without
 * leading whitespace; the name may contain `.` or `-` as make allows, and
 * make trims whitespace between the name and the operator
 * (`' MAKEFILES =evil.mk'` is one argv word after the shell strips the
 * quotes). The name's first character may not be `:`, `#`, `=`, whitespace or
 * `-`: those begin make syntax, a comment, or an option rather than a macro.
 */
const MAKE_ASSIGNMENT = /^\s*[^:#=\s-][^:#=\s]*\s*(?:\+=|\?=|!=|[:]{0,3}=)/

/**
 * `make MAKEFILES=/tmp/evil.mk target` loads another makefile and
 * `make SHELL=/tmp/evil target` picks the recipe shell. Both are make
 * command-line variable assignments, so every positional word is checked,
 * not just the first.
 */
function makePositional(name: string, word: string): string | undefined {
  if (MAKE_ASSIGNMENT.test(word)) {
    return `denied \`${name}\` variable assignment: \`${word}\` (a command-line assignment can name another makefile or recipe shell)`
  }
  return undefined
}

/**
 * Whether a word is an argument-file spelling pytest expands: the whole word
 * is `@file`, the value follows `=` (`--deselect=@file`, `-k=@file`), or a
 * short option carries the value directly (`-k@file`). An `@` anywhere else
 * is data: `tests/@fixtures/test_x.py` and `-k name@example` name no file.
 * The `=@` test covers the `-k=@file` form as well as the long options.
 */
function pytestArgumentFile(token: string): boolean {
  return token.startsWith("@") || token.includes("=@") || /^-[A-Za-z]@/.test(token)
}

/**
 * `pytest @argfile` expands the file's contents into options, including the
 * plugin/config selectors (`-p`, `-c`, `-o`) the flag table refuses;
 * `python -m pytest @argfile` is the same command. A positional word is
 * refused only when it is an argument-file spelling, so a test path or a
 * keyword expression containing `@` passes; `pytestToken` applies the same
 * rule to option values, which this positional rule never sees.
 */
function pytestPositional(name: string, word: string): string | undefined {
  if (pytestArgumentFile(word)) {
    return `denied \`${name}\` argument file: \`${word}\` (\`@file\` expands options the guard cannot see)`
  }
  return undefined
}

/**
 * pytest expands an argument file it finds in an option's value as well as in
 * a positional, so `pytest -k @c.args` loads the file and can enable `-c`,
 * `-o` and a plugin. The scan therefore covers every token, but only the
 * argument-file spellings: the attached (`-k@file`), `=` (`--deselect=@file`)
 * and bare (`@file`) forms. The name is the argv-facing one, `pytest` or
 * `python3 -m pytest`.
 */
function pytestToken(name: string, token: string): string | undefined {
  if (name !== "pytest" && !name.endsWith(" -m pytest")) return undefined
  if (!pytestArgumentFile(token)) return undefined
  return `denied \`${name}\` argument file: \`${token}\` (\`@file\` expands options the guard cannot see)`
}

/**
 * Walks the runner's arguments. Positional words pass (test paths, package
 * patterns, make targets), except after `--`: there the allowlist is the only
 * thing that passes, so a bare `--` with no named post-allowlist is refused.
 * A runner with a positional rule passes each positional through it first.
 */
function checkRunnerFlags(
  name: string,
  words: string[],
  start: number,
  flags: FlagSet,
  after: FlagSet | undefined,
  style: RunnerPolicy["style"],
  subcommand: string | undefined,
  positional: PositionalRule | undefined,
): string | undefined {
  // pytest's argument-file expansion works on option values too, so the scan
  // covers every word up front rather than only the words the loop reaches:
  // `pytest -k @file` consumes `@file` as `-k`'s value and would skip it.
  for (let scan = start; scan < words.length; scan++) {
    const argumentFile = pytestToken(name, words[scan]!)
    if (argumentFile !== undefined) return argumentFile
  }
  let postDoubleDash = false
  let index = start
  while (index < words.length) {
    const token = words[index]!
    if (token === "--") {
      if (postDoubleDash) return flagDenied(name, token)
      if (after === undefined) {
        const scope = subcommand === undefined ? "" : ` for \`${subcommand}\``
        return `denied \`${name}\` option: \`--\` (no post-\`--\` allowlist${scope})`
      }
      postDoubleDash = true
      index += 1
      continue
    }
    if (!token.startsWith("-") || token === "-") {
      if (postDoubleDash) {
        return `denied \`${name}\` option: \`${token}\` (only named flags pass after \`--\`)`
      }
      const refused = positional?.(name, token)
      if (refused !== undefined) return refused
      index += 1
      continue
    }
    const active = postDoubleDash ? after! : flags
    const verdict = checkOption(name, token, style, active, words[index + 1])
    if (verdict.reason !== undefined) return verdict.reason
    index += verdict.consumedNext === true ? 2 : 1
  }
  return undefined
}

/**
 * Python's `-m` is handled before the generic flag check: `-m module` and the
 * attached `-mmodule` both name a module the interpreter imports and runs.
 * Only `unittest` and `pytest` pass, and the words after the module are
 * checked against that module's own policy.
 */
function checkPythonModules(
  name: string,
  words: string[],
  modules: ReadonlyMap<string, FlagSet>,
): string | undefined {
  let index = 1
  while (index < words.length) {
    const token = words[index]!
    if (token === "--") {
      return `denied \`${name}\` option: \`--\` (no post-\`--\` allowlist)`
    }
    if (token === "-m" || token.startsWith("-m")) {
      const attached = token !== "-m"
      const module = attached ? token.slice(2) : words[index + 1]
      const afterModule = attached ? index + 1 : index + 2
      if (module === undefined || module.length === 0 || module === "--") {
        return requiresValue(name, "-m")
      }
      const flagSet = modules.get(module)
      if (flagSet === undefined) {
        return `denied \`${name}\` module: \`${module}\` (only ${joined(modules.keys())} pass)`
      }
      // Name the module policy in the reason so a refused flag reads
      // `python3 -m pytest`, not the interpreter's empty base allowlist.
      return checkRunnerFlags(
        `${name} -m ${module}`,
        words,
        afterModule,
        flagSet,
        undefined,
        "gnu",
        module,
        module === "pytest" ? pytestPositional : undefined,
      )
    }
    if (token.startsWith("-") && token !== "-") return flagDenied(name, token)
    index += 1
  }
  return undefined
}

/** The policy verdict on one runner segment, command-position only. */
function checkRunner(
  name: string,
  words: string[],
  policy: RunnerPolicy,
): string | undefined {
  if (policy.modules !== undefined) return checkPythonModules(name, words, policy.modules)

  let start = 1
  let subcommand: string | undefined
  if (policy.subcommands !== undefined) {
    subcommand = words[1]
    if (subcommand === undefined || !policy.subcommands.has(subcommand)) {
      const received = subcommand === undefined ? "" : `: \`${subcommand}\``
      return `denied ${name} subcommand${received} (only ${joined(policy.subcommands)} pass)`
    }
    start = 2
  }
  const after = subcommand === undefined ? undefined : policy.afterDoubleDash?.get(subcommand)
  const positional =
    name === "make" ? makePositional : name === "pytest" ? pytestPositional : undefined
  return checkRunnerFlags(name, words, start, policy.flags, after, policy.style, subcommand, positional)
}

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

    // Every git rule is command-position only: `git` as an argument word is
    // data (`echo git push` prints two words), and the allowlist gate below
    // decides which command words run at all.
    if (name === "git" && index === 0) {
      // Global options first: `-c` and `-C` change what git runs and
      // where, which is how option adjacency escaped the old denylist.
      // `flagMatches` matches the `--flag=value` spellings too, so
      // `--git-dir=/x` fails exactly like `--git-dir`. The exec-channel
      // options and `::` transport syntax run or name a program outside the
      // command line; both are refused across the whole segment, at any
      // position.
      for (const token of words) {
        for (const option of GIT_DENIED_GLOBAL_OPTIONS) {
          if (gitOptionMatches(token, option)) {
            return `denied git global option: \`${token}\` (matches \`${option}\`; git configuration and location are set outside the command)`
          }
        }
        for (const option of GIT_EXEC_CHANNEL_OPTIONS) {
          if (gitOptionMatches(token, option)) {
            return `denied git option: \`${token}\` (matches \`${option}\`, which runs a program loaded from configuration or named in the argument)`
          }
        }
        if (token.includes("::")) {
          return `denied git transport syntax: \`${token}\` (\`::\` names a transport that runs an arbitrary command)`
        }
      }
      const subcommand = words[1]
      if (subcommand === undefined) {
        return "git subcommand missing (only read-only subcommands pass)"
      }
      if (subcommand.startsWith("-")) {
        return `denied git option before the subcommand: \`${subcommand}\` (fail closed; only read-only subcommands pass)`
      }
      // `git branch` lists with the pure-listing flags and no positional
      // words; `git remote` lists with `-v` or shows one remote by name.
      if (subcommand === "branch") {
        for (let next = 2; next < words.length; next++) {
          const argument = words[next]!
          if (!GIT_BRANCH_LIST_FLAGS.has(argument)) {
            return "denied arguments to `git branch` (only pure-listing flags are allowed)"
          }
        }
        continue
      }
      if (subcommand === "remote") {
        const arguments_ = words.slice(2)
        const listing = arguments_.every((argument) => argument === "-v")
        const show =
          arguments_[0] === "show" &&
          arguments_.slice(1).every((argument) => !argument.startsWith("-"))
        if (!listing && !show) {
          return "denied arguments to `git remote` (only `-v` and `show <name>` are allowed)"
        }
        continue
      }
      if (GIT_MUTATING.has(subcommand)) {
        return `denied pair: \`git ${subcommand}\` (mutating git subcommand)`
      }
      if (subcommand === "fetch") {
        for (const token of words.slice(2)) {
          if (token.startsWith("+")) {
            return "denied `git fetch` refspec: a `+` force-update refspec is refused"
          }
        }
      }
      if (GIT_OUTPUT_DENY.has(subcommand)) {
        for (const token of words.slice(2)) {
          if (gitOptionMatches(token, "--output")) {
            return `denied \`git ${subcommand} --output\`: writing a file from git is refused`
          }
        }
      }
      if (!GIT_SUBCOMMANDS.has(subcommand)) {
        return `denied git subcommand: \`${subcommand}\` (not in the read-only allowlist)`
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
      for (const token of words.slice(2)) {
        const option = npmDeniedOption(token)
        if (option !== undefined) {
          return `denied npm option: \`${option}\` (changes the script shell, the prefix or the npm configuration)`
        }
      }
    }

    // The polyglot runners share one fail-closed table. The check is
    // command-position only; `pytest` as an argument word is data, and the
    // allowlist gate below decides which command words run at all.
    if (index === 0) {
      const runnerPolicy = RUNNER_POLICIES.get(name)
      if (runnerPolicy !== undefined) {
        const reason = checkRunner(name, words, runnerPolicy)
        if (reason !== undefined) return reason
      }
    }

    // Per-command flag policies, command-position only: `sort` and `uniq`
    // accept only options named in their read-only allowlist (`-o` truncates
    // a file, `--compress-program` executes a program), and `rg` refuses the
    // flags that run a program per file searched. An option no rule names is
    // passed through to the command — the header's residual says so.
    if (index === 0) {
      const utilityFlags = UTILITY_FLAG_ALLOWLIST.get(name)
      if (utilityFlags !== undefined) {
        for (const token of words.slice(1)) {
          if (token.startsWith("-") && !utilityFlagAllowed(token, utilityFlags)) {
            return `denied \`${name}\` option: \`${token}\` (not in ${name}'s read-only flag allowlist)`
          }
        }
      }
      const deniedOptions = COMMAND_DENIED_OPTIONS.get(name)
      if (deniedOptions !== undefined) {
        for (const token of words.slice(1)) {
          for (const option of deniedOptions) {
            if (flagMatches(token, option)) {
              return `denied \`${name}\` option: \`${token}\` (runs a program this guard cannot see)`
            }
          }
        }
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

  // `install.sh` may only run with `--dry-run`, and only from the command
  // word that would execute it: `./install.sh` itself, or a shell or
  // `shellcheck` naming it (`bash -n install.sh` parses without running,
  // `shellcheck install.sh` only lints). In argument position the word is
  // data — `cat install.sh` and `grep install.sh README.md` read the file,
  // and the allowlist gate below decides whether those run at all.
  const commandName = basename(words[0] ?? "")
  const shellCommand = SHELLS.has(commandName)
  const staticAnalysis = commandName === "shellcheck"
  const runsInstallSh =
    commandName === "install.sh" ||
    ((shellCommand || staticAnalysis) &&
      words.slice(1).some((argument) => basename(argument) === "install.sh"))
  if (runsInstallSh && !words.includes("--dry-run")) {
    const syntaxCheck = shellCommand && words[1] === "-n"
    if (!syntaxCheck && !staticAnalysis) {
      return "install.sh may only be run with --dry-run"
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
      // `bash -n <file>` only: `-n` must be the first argument and every
      // later word a bare file name. Accepting `-n` anywhere in the
      // arguments let `bash evil.sh -n` execute evil.sh with `-n` as a
      // positional parameter — and `bash install.sh -n` run the installer
      // without `--dry-run`.
      if (words[1] !== "-n" || words[2] === undefined) {
        return "bash is only allowed as `bash -n <file>` (syntax check)"
      }
      for (const argument of words.slice(2)) {
        if (argument.startsWith("-")) {
          return `denied bash option: \`${argument}\` (only \`bash -n <file>\` passes)`
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
 * per-command flag policies, the polyglot runners' fail-closed allowlists,
 * the `install.sh` `--dry-run` rule, and finally the allowlist on the command
 * word. A segment whose command word is in neither `ALLOWED_COMMANDS` nor the
 * exact string `./install.sh` never runs: it is refused here, before the
 * permission check and before any spawn. What an allowed command may still do
 * beyond these rules is the header's residual paragraph — package.json script
 * bodies, options no rule names on the non-runner commands, and a harness the
 * acceptance command runs — not an accident of this function. The guard is
 * not a sandbox.
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
  // Runs on the raw string, before tokenizing, so the check sees a backslash
  // or glob the tokenizer would otherwise treat as an ordinary word
  // character. A command word that is already flat-denied keeps its more
  // specific reason — `rm -rf *` is refused for `rm`, not for the glob — but
  // everything else is refused here, before the words are parsed.
  const metacharacter = unquotedMetacharacter(command)
  if (metacharacter !== undefined) {
    const firstWord = command.trim().split(/\s+/, 1)[0] ?? ""
    const category = DENIED_COMMANDS.get(basename(firstWord))
    if (category !== undefined) {
      return denied(`denied command: \`${basename(firstWord)}\` (${category})`)
    }
    return denied(metacharacter)
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
