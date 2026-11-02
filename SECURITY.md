# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository. If that is not
available, open a minimal issue asking for a private channel. Do not paste
exploit details in a public issue.

## Scope

The agent definitions under `categories/` and `wippaAGENT.md`, the tools plugin
under `tools/`, and `install.sh`.

## Expected behaviour you should know

`wippa_verify` runs the command you give it through a shell, by design, with a
five-minute default timeout that callers may raise up to one hour, capped
output, and a working directory that must exist. It is not unrestricted. A
guard runs first, before the permission check and before anything is
spawned. The guard is an allowlist of the acceptance surface with a character
policy on top — not a sandbox. Its single source is `tools/guards.ts`; every
sentence below is derived from it.

The character policy: command substitution, expansion, redirection, pipes,
statement separators, newlines and carriage returns are refused anywhere in
the command string; only `&&` chains are accepted, and any `&` that is not
exactly `&&` (so `&&&` too) is refused; a segment beginning `NAME=` is
refused as an environment-variable assignment prefix; a command word may not
be a path — only the exact string `./install.sh` may be run by path, so a
planted `./file` cannot be executed. An unquoted backslash, or an unquoted
glob metacharacter (`*`, `?`, `[`, `]`) or brace expansion, is refused: the
shell would rewrite it into an argument the guard did not inspect; the same
characters inside quotes are data.

The allowlist: every segment's command word must be named in
`tools/guards.ts`, or be exactly `./install.sh`, or the segment is refused
with a reason before anything spawns. The list is `npm` with only `test`,
`run` and `ls` (the subcommand must immediately follow `npm`; any option in
that position fails closed, so `npm pkg set`, `npm config set` and
`npm --yes exec` are refused, and options that select another shell or config
are refused: `--script-shell`, `--shell`, `--prefix`, `--userconfig` and
`--globalconfig`); `git` with only `status`, `log`,
`diff`, `show`, `blame`, `ls-remote`, `rev-parse`, `describe`, `grep`,
`shortlog`, `fetch`, plus `branch` and `remote` in pure-listing form
(`branch` accepts only `-a -r -v -vv -l --list --all --show-current` and no
positional word; `remote` accepts only no arguments, `-v`, or `show` with an
optional remote name); the read-only
utilities `grep`, `rg`, `cat`, `head`, `tail`, `wc`, `ls`, `test`, `echo`,
`true`, `false`, `basename`, `dirname`, `realpath`, `pwd`, `sort`, `uniq`,
`tr`, `cut`, `stat`, `sha256sum`, `which`, `date` — `sort` and `uniq` only
under their read-only flag allowlist (every option outside it is refused,
including `-o` and `--compress-program`), and `rg` without `--pre` and
`--pre-glob` — and the inert `sleep`,
`seq` and `exit` (which wait, print integers or end the shell, and are what
the tool's own timeout, cancellation, truncation and exit-code tests run);
the static checks
`shellcheck` and `bash -n <file>` (`-n` must be the first argument, every
later word a file name); and `./install.sh` only with
`--dry-run`. Six test runners are allowed under fail-closed flag
allowlists: `pytest`; `go test` and `go vet`; `cargo test`, `check` and
`clippy`; `make`; `node` test runners and scripts; and `python3`/`python`
test modules and scripts. A flag not named in a runner's allowlist is
refused with the flag in the reason, so `python3 -m` accepts only
`unittest` and `pytest` (the attached `-munittest` form included), and
`cargo --config`, `go -toolexec`, `make -E`, `node -p` and `pytest --pdb`
are refused by construction. Everything else — `npx`, `sh`, `sed`,
`curl`, `gh`, `docker`, `kubectl`, `awk`, `xargs`, `find`, `env` and the
rest — is denied because it is not on the list.

Fast-fail denials with specific reasons run on top: the `sudo` and `rm`
families, network and archive tools, file mutators, `awk` and `xargs` are
refused as words, flat and inside quotes; interpreter-plus-eval-flag pairs
such as `bash -c`, `python -c`, `node -e` and `sed -i` are refused; in a
segment whose command word is `git`, git's global options (`-c`, `-C`,
`--git-dir`, `--work-tree`, `--exec-path`, `--paginate`, `--no-pager`) are
refused in both `--flag` and `--flag=value` form, any option before the git
subcommand fails closed, the exec-channel options `--upload-pack`,
`--open-files-in-pager`, `--ext-diff` and `--textconv` are refused anywhere
in the segment, and any argument containing `::` (transport syntax such as
`ext::cmd`) is refused; `git fetch` refuses a `+` force-update refspec;
`git show`, `git diff`, `git log` and `git archive` refuse `--output`;
`install.sh` runs only with `--dry-run`, only as the command itself —
`cat install.sh` reads it as data; `sort` and `uniq` refuse every option
outside their read-only flag allowlist; `rg` refuses `--pre` and
`--pre-glob`. Nothing is inferred as read-only: `git worktree list`,
`git submodule status`, `git stash list` and `git bisect log` are denied,
because only the subcommands named above pass.

The documented residual: the acceptance commands execute whatever the
project's test files, `conftest.py`, `Makefile`, configuration and scripts
contain. The guard inspects the command line, not the code that command
runs, so a test file or a build script is trusted input once its runner is
allowed. Each runner is a fail-closed flag allowlist, so an option outside
its list is refused rather than passed through; the other allowlisted
commands are policed where `tools/guards.ts` writes a rule (git's global
and exec-channel options, `sort`'s and `uniq`'s flag allowlists, `rg`'s
denied `--pre` flags, `bash`'s positional rule). `wippa_verify` also reads
the working diff before it spawns anything: when a changed file is part of
the harness the command runs (a test file, `conftest.py`, `Makefile`,
`package.json` or runner configuration), it returns `harness-modified`
with the file list and refuses to run unless the caller passes
`acknowledgeHarnessChanges: true`; if the diff cannot be read it reports
`harnessCheck: "skipped"`. That check is a heuristic file match, not a
sandbox.

The guard matches git and npm long options by unambiguous prefix, so an
abbreviated option is refused as the option it names rather than passed
through. It refuses make command-line assignments including whitespace and the
`!=` operator, refuses pytest argument files in positional and option-value
form, and refuses a quoted closing brace. The remaining harness gaps are the
four named in the README note: an outside-repo path named on the command line,
a harness committed before the working diff, an included makefile without a
`.mk` suffix, and a custom unittest `-p` pattern.

After the guard, the tool asserts a `verify` permission action with the
command as its resource before spawning anything, so a deny rule for `verify`
stops it exactly as the same rule stops `shell`. The guard is not a sandbox:
an allowed command runs with the authority of the user running OpenCode —
filesystem, processes, and network. A caller's `cwd` must resolve inside the
workspace and must not contain `..` segments, line breaks or null bytes, or it
is refused with a stated reason before anything runs. The call is
asynchronous, so it does not block the session, and cancelling the call kills
the command. On POSIX the timeout kills the command's process group; on
Windows it kills the shell, so a background process that holds the output
open may still stall the call. Agent shell and edit rules, such as `rm -rf` or `sudo` denies, are
literal-pattern guardrails, not a sandbox either.

`wippa_diff` validates its `base` ref before handing it to git: absolute
paths, `..` traversal, option-like `-…` input, and shell-significant
characters are refused with a stated error.

`wippa_plan_update` takes no path argument and writes exactly
`<workspace>/.opencode/PLAN.md`. A symlink at that path or at the `.opencode`
directory, dangling or not, or a hard link at that path, is refused before the
write, and the `plan_update` permission is asserted first.

`wippa_subagent_continue` takes only an agent id and a prompt. It resolves a
child of the current session, asserts `subagent_continue` before listing
anything, and cannot name an arbitrary session: there is no session id, parent
id or path in its input.

## Token scope for the github MCP server

The `github` MCP server is registered with the `repos`, `issues`,
`pull_requests` and `actions` toolsets only — the surface the roster routes
through `orchestration-lead`. The token is still the real boundary: use a
fine-grained `GITHUB_PERSONAL_ACCESS_TOKEN` scoped to a single repository,
granting only Issues (read and write), Pull requests (read and write),
Contents (read, for refs and releases metadata) and Actions (read, for CI
status). The release workflow in `orchestration-lead` creates GitHub releases,
which needs a separately-scoped Contents **write** permission on that one
repository; grant it as its own narrowly-scoped token rather than widening the
default guidance above. No agent-level rule restricts which MCP servers each
agent may call,
so the registered toolsets and the token scope are what limit the `github`
server for every agent.

## Response

Best effort, with no warranty. Released under the MIT licence; see `LICENSE`.
