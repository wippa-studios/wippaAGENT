import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { buildCatalog, readRoster } from "../tools/catalog.ts"
import { parseScenario, validateScenario } from "./run.ts"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const SCENARIOS_DIR = join(REPO_ROOT, "evals", "scenarios")
const CATEGORIES_DIR = join(REPO_ROOT, "categories")

function catalog() {
  return buildCatalog([CATEGORIES_DIR], readRoster([CATEGORIES_DIR]))
}

type Overrides = Record<string, string | null>

/** A complete scenario file, with the named sections replaced or removed. */
function scenarioText(overrides: Overrides = {}): string {
  const fields: Record<string, string> = {
    Scenario: "99-probe",
    Intent: "Probe the parser.",
    "Expected primary agent": "wippaAGENT",
    "Expected subagent(s)": "- `core-developer` — implementation",
    "Acceptance criteria": "- The command passes.",
    "Acceptance command": "- `npm test`",
  }
  // A null override removes the section, so it is deleted rather than skipped:
  // skipping would leave the default in place and test nothing.
  for (const [heading, value] of Object.entries(overrides)) {
    if (value === null) delete fields[heading]
    else fields[heading] = value
  }
  return Object.entries(fields)
    .map(([heading, value]) => `## ${heading}\n\n${value}\n`)
    .join("\n")
}

test("every shipped scenario parses and references real agents", () => {
  const files = readdirSync(SCENARIOS_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort()
  assert.ok(files.length > 0, "the scenarios directory is not empty")

  const known = catalog()
  for (const file of files) {
    const scenario = parseScenario(readFileSync(join(SCENARIOS_DIR, file), "utf8"), file)
    assert.deepEqual(scenario.problems, [], `${file} parses`)
    assert.deepEqual(validateScenario(scenario, known), [], `${file} references real agents`)
    assert.ok(scenario.subagents.length > 0, `${file} names a subagent`)
    assert.ok(
      scenario.command !== undefined || scenario.criteria.length > 0,
      `${file} has a command or names its evidence`,
    )
  }
})

test("the parser reads backticked ids and ignores the routing prose after them", () => {
  const scenario = parseScenario(
    scenarioText({
      "Expected subagent(s)":
        "- `security-reviewer` — input handling and auth\n- core-developer — the fix",
    }),
    "99-probe.md",
  )

  assert.deepEqual(scenario.problems, [])
  assert.equal(scenario.primary, "wippaAGENT")
  assert.deepEqual(scenario.subagents, ["security-reviewer", "core-developer"])
  assert.equal(scenario.command, "npm test")
})

test("a scenario whose outcome is a report has no command", () => {
  const scenario = parseScenario(
    scenarioText({ "Acceptance command": "- None. The research report is the evidence." }),
    "99-probe.md",
  )

  assert.deepEqual(scenario.problems, [])
  assert.equal(scenario.command, undefined)
})

test("a missing section is a problem, not a silent default", () => {
  const scenario = parseScenario(
    scenarioText({ "Acceptance criteria": null }),
    "99-probe.md",
  )

  assert.ok(
    scenario.problems.some((problem) => problem.includes('missing section "## Acceptance criteria"')),
    scenario.problems.join("; "),
  )
})

test("a scenario name that does not match its file name is a problem", () => {
  const scenario = parseScenario(scenarioText(), "98-other.md")

  assert.ok(
    scenario.problems.some((problem) => problem.includes("does not match the file name")),
    scenario.problems.join("; "),
  )
})

test("two acceptance commands are a problem", () => {
  const scenario = parseScenario(
    scenarioText({ "Acceptance command": "- `npm test`\n- `npm run typecheck`" }),
    "99-probe.md",
  )

  assert.ok(scenario.problems.some((problem) => problem.includes("more than one")))
  assert.equal(scenario.command, undefined)
})

test("an unknown subagent is rejected against the catalog", () => {
  const scenario = parseScenario(
    scenarioText({ "Expected subagent(s)": "- `ghost-agent` — nothing" }),
    "99-probe.md",
  )
  const problems = validateScenario(scenario, catalog())

  assert.ok(problems.some((problem) => problem.includes("ghost-agent") && problem.includes("not in the catalog")))
})

test("a primary agent definition that is not on disk is rejected", () => {
  const scenario = parseScenario(
    scenarioText({ "Expected primary agent": "ghost-primary" }),
    "99-probe.md",
  )
  const problems = validateScenario(scenario, catalog())

  assert.ok(problems.some((problem) => problem.includes('"ghost-primary" has no definition')))
})

test("an id whose definition is not a subagent is rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "wippa-eval-"))
  writeFileSync(join(dir, "probe.md"), "---\ndescription: probe\nmode: primary\n---\n\nbody\n")
  const local = buildCatalog([dir], [{ name: "Probe", count: 1, agents: ["probe"] }])

  const scenario = parseScenario(
    scenarioText({ "Expected subagent(s)": "- probe" }),
    "99-probe.md",
  )
  const problems = validateScenario(scenario, local)

  assert.ok(problems.some((problem) => problem.includes('"probe" is not a subagent')))
})
