import assert from "node:assert/strict"
import { test } from "node:test"

import { harnessFiles } from "./harness.ts"

/** Asserts exactly the harness files, in the order they were supplied. */
function assertHarness(command: string, files: readonly string[], expected: readonly string[]): void {
  assert.deepEqual(harnessFiles(command, files), expected, command)
}

test("npm commands treat the manifest, lockfiles and tests as harness", () => {
  const files = [
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "src/a.test.ts",
    "src/a.spec.tsx",
    "test/a.js",
    "packages/web/tests/a.ts",
    "__tests__/a.js",
    "src/a.ts",
    "contest/a.ts",
  ]
  assertHarness("npm test", files, [
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "src/a.test.ts",
    "src/a.spec.tsx",
    "test/a.js",
    "packages/web/tests/a.ts",
    "__tests__/a.js",
  ])
  assertHarness("npm run typecheck && npm test", files, [
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "src/a.test.ts",
    "src/a.spec.tsx",
    "test/a.js",
    "packages/web/tests/a.ts",
    "__tests__/a.js",
  ])
})

test("npm commands treat .npmrc as harness", () => {
  assertHarness("npm test", [".npmrc", "package.json", "src/a.ts"], [".npmrc", "package.json"])
})

test("pytest commands treat its configuration and Python test files as harness", () => {
  const files = [
    "conftest.py",
    "pytest.ini",
    "tox.ini",
    "setup.cfg",
    "pyproject.toml",
    "test_a.py",
    "pkg/test_b.py",
    "pkg/a_test.py",
    "packages/web/tests/a.py",
    "src/a.py",
  ]
  const expected = [
    "conftest.py",
    "pytest.ini",
    "tox.ini",
    "setup.cfg",
    "pyproject.toml",
    "test_a.py",
    "pkg/test_b.py",
    "pkg/a_test.py",
    "packages/web/tests/a.py",
  ]
  assertHarness("pytest tests/", files, expected)
  assertHarness("python3 -m pytest -q", files, expected)
  assertHarness("python3 -mpytest", files, expected)
})

test("pytest treats positional test paths as scripts, including node ids", () => {
  assertHarness(
    "pytest specs/weird_check.py",
    ["specs/weird_check.py", "specs/other.py", "src/a.py"],
    ["specs/weird_check.py"],
  )
  assertHarness(
    "pytest -k unit specs/weird_check.py::test_login",
    ["specs/weird_check.py", "specs/other.py"],
    ["specs/weird_check.py"],
  )
  assertHarness(
    "python3 -m pytest -q specs/weird_check.py",
    ["specs/weird_check.py", "specs/other.py"],
    ["specs/weird_check.py"],
  )
  // The value of `-k` is not a script path.
  assertHarness("pytest -k unit", ["unit", "src/a.py"], [])
})

test("go commands treat Go test files as harness", () => {
  assertHarness(
    "go test -v ./...",
    ["pkg/a_test.go", "a_test.go", "pkg/a.go", "main.go"],
    ["pkg/a_test.go", "a_test.go"],
  )
})

test("go commands treat module and workspace files as harness", () => {
  assertHarness(
    "go test ./...",
    ["go.mod", "go.sum", "go.work", "go.work.sum", "cmd/app/go.mod", "pkg/a_test.go", "pkg/a.go"],
    ["go.mod", "go.sum", "go.work", "go.work.sum", "cmd/app/go.mod", "pkg/a_test.go"],
  )
})

test("cargo commands treat the manifest, build script, tests and benches as harness", () => {
  assertHarness(
    "cargo test --release",
    [
      "Cargo.toml",
      "crates/web/Cargo.toml",
      "build.rs",
      "tests/a.rs",
      "packages/web/benches/b.rs",
      "src/main.rs",
    ],
    ["Cargo.toml", "crates/web/Cargo.toml", "build.rs", "tests/a.rs", "packages/web/benches/b.rs"],
  )
})

test("cargo commands treat cargo config, the lockfile and toolchain files as harness", () => {
  assertHarness(
    "cargo check",
    [
      ".cargo/config.toml",
      ".cargo/config",
      "crates/web/.cargo/config.toml",
      "Cargo.lock",
      "crates/web/Cargo.lock",
      "rust-toolchain.toml",
      "rust-toolchain",
      "src/lib.rs",
    ],
    [
      ".cargo/config.toml",
      ".cargo/config",
      "crates/web/.cargo/config.toml",
      "Cargo.lock",
      "crates/web/Cargo.lock",
      "rust-toolchain.toml",
      "rust-toolchain",
    ],
  )
})

test("make commands treat every makefile spelling as harness", () => {
  assertHarness(
    "make -j4 test",
    ["Makefile", "makefile", "GNUmakefile", "build/rules.mk", "src/a.c"],
    ["Makefile", "makefile", "GNUmakefile", "build/rules.mk"],
  )
})

test("node commands treat package.json and the named script path as harness", () => {
  assertHarness(
    "node tests/runner.js",
    ["package.json", "tests/runner.js", "tests/other.js", "src/a.js"],
    ["package.json", "tests/runner.js"],
  )
  assertHarness(
    "node ./tests/runner.js",
    ["package.json", "tests/runner.js", "tests/other.js"],
    ["package.json", "tests/runner.js"],
  )
  assertHarness(
    "node --test-reporter spec tests/runner.js",
    ["package.json", "tests/runner.js", "src/a.js"],
    ["package.json", "tests/runner.js"],
  )
  assertHarness(
    "node --test",
    ["package.json", "tests/runner.js", "src/a.js"],
    ["package.json", "tests/runner.js"],
  )
})

test("node --test treats the files it discovers as harness", () => {
  assertHarness(
    "node --test",
    ["tests/foo.test.ts", "src/foo.test.ts", "src/app.ts"],
    ["tests/foo.test.ts", "src/foo.test.ts"],
  )
  assertHarness("node --test", ["package.json"], ["package.json"])
  assertHarness(
    "node --test",
    ["src/app.spec.js", "__tests__/a.ts", "test/b.js", "src/app.js"],
    ["src/app.spec.js", "__tests__/a.ts", "test/b.js"],
  )
})

test("node --test treats *-test, *_test, test-* and test.* discovery names as harness", () => {
  assertHarness(
    "node --test",
    ["src/app-test.js", "src/app_test.mjs", "src/test-helper.ts", "src/test.js", "src/app.js"],
    ["src/app-test.js", "src/app_test.mjs", "src/test-helper.ts", "src/test.js"],
  )
  // Without `--test` only the named script and package.json run; the
  // discovered names are not considered.
  assertHarness("node src/app.js", ["src/app-test.js", "src/test.js"], [])
})

test("python script commands treat only the named script path as harness", () => {
  assertHarness(
    "python3 tests/run.py",
    ["tests/run.py", "tests/other.py", "src/a.py"],
    ["tests/run.py"],
  )
  assertHarness(
    "python3 -u ./tests/run.py",
    ["tests/run.py", "tests/other.py"],
    ["tests/run.py"],
  )
})

test("python -m unittest treats tests/ and test*.py as harness", () => {
  const files = ["tests/test_foo.py", "test_bar.py", "src/app.py", "conftest.py"]
  const expected = ["tests/test_foo.py", "test_bar.py"]
  assertHarness("python3 -m unittest", files, expected)
  assertHarness("python -m unittest", files, expected)
  assertHarness("python3 -munittest", files, expected)
})

test("a command with no known runner matches nothing", () => {
  assertHarness("git status", ["package.json", "tests/a.ts", "Makefile"], [])
  assertHarness("echo harness", ["package.json", "tests/a.ts"], [])
})

test("the result preserves diff order and drops duplicates", () => {
  assertHarness(
    "npm test",
    ["tests/b.ts", "src/a.ts", "package.json", "tests/b.ts"],
    ["tests/b.ts", "package.json"],
  )
})
