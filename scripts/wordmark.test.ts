import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { extractArt, renderBlock } from "./wordmark.ts"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const README = join(REPO_ROOT, "README.md")
const WORDMARK_SVG = join(REPO_ROOT, "brand-assets", "wippaAGENT-wordmark.svg")

/** The art is six rows of "wippa", one blank row and six rows of "AGENT". */
const EXPECTED_ROWS = 13
/** The width of the widest art line, in characters; update it with the art. */
const EXPECTED_COLUMNS = 44

const START_MARKER =
  "<!-- wordmark:start - generated from the install.sh banner by npm run wordmark -->"
const END_MARKER = "<!-- wordmark:end -->"

function readArt(): string[] {
  return extractArt(readFileSync(join(REPO_ROOT, "install.sh"), "utf8"))
}

/** Every line index that is exactly `marker`. */
function markerIndexes(lines: string[], marker: string): number[] {
  const found: number[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === marker) found.push(index)
  }
  return found
}

test("the committed README block is what the installer art renders to", () => {
  const lines = readFileSync(README, "utf8").split("\n")
  const start = markerIndexes(lines, START_MARKER)
  const end = markerIndexes(lines, END_MARKER)

  assert.equal(start.length, 1, "README.md must have exactly one wordmark start marker")
  assert.equal(end.length, 1, "README.md must have exactly one wordmark end marker")
  assert.ok(start[0] < end[0], "the start marker must come before the end marker")

  const committed = `${lines.slice(start[0], end[0] + 1).join("\n")}\n`
  assert.equal(
    committed,
    renderBlock(readArt()),
    "README.md wordmark block does not match install.sh; run npm run wordmark",
  )
})

test("every README art row is padded to EXPECTED_COLUMNS so a centred renderer keeps the grid", () => {
  const lines = readFileSync(README, "utf8").split("\n")
  const start = markerIndexes(lines, START_MARKER)
  const end = markerIndexes(lines, END_MARKER)

  assert.equal(start.length, 1, "README.md must have exactly one wordmark start marker")
  assert.equal(end.length, 1, "README.md must have exactly one wordmark end marker")
  assert.ok(start[0] < end[0], "the start marker must come before the end marker")

  const region = lines.slice(start[0] + 1, end[0])
  const open = region.findIndex((line) => line.startsWith("<pre "))
  const close = region.findIndex((line) => line === "</pre>")

  assert.notEqual(open, -1, "the wordmark region must contain the <pre> opener")
  assert.notEqual(close, -1, "the wordmark region must contain the </pre> closer")
  assert.ok(open < close, "the <pre> opener must come before the closer")

  const artLines = region.slice(open + 1, close)
  assert.equal(artLines.length, EXPECTED_ROWS, `the README block has ${artLines.length} art rows`)

  for (const [index, line] of artLines.entries()) {
    const columns = [...line].length
    assert.equal(
      columns,
      EXPECTED_COLUMNS,
      `README art row ${index + 1} is ${columns} characters; every row must be padded to ${EXPECTED_COLUMNS}`,
    )
  }
})

test("the art has the expected row count and its widest line the expected width", () => {
  const art = readArt()
  const rows = art.length
  const columns = Math.max(...art.map((line) => [...line].length))

  assert.equal(rows, EXPECTED_ROWS, `the art has ${rows} rows; the current art has ${EXPECTED_ROWS}`)
  assert.equal(
    columns,
    EXPECTED_COLUMNS,
    `the widest art line is ${columns} characters; the current art is ${EXPECTED_COLUMNS} columns wide, so update the expectation with the art`,
  )
})

test("the README has one wordmark region and no reference to the removed SVG", () => {
  const readme = readFileSync(README, "utf8")
  const lines = readme.split("\n")

  assert.equal(markerIndexes(lines, START_MARKER).length, 1, "exactly one start marker")
  assert.equal(markerIndexes(lines, END_MARKER).length, 1, "exactly one end marker")
  assert.ok(
    readme.includes('<pre role="img" aria-label="wippaAGENT">'),
    "the wordmark <pre> must keep role=\"img\" and its aria-label",
  )
  assert.ok(
    !readme.includes("wippaAGENT-wordmark.svg"),
    "README.md must not reference brand-assets/wippaAGENT-wordmark.svg",
  )
})

test("the SVG wordmark file is removed", () => {
  assert.ok(
    !existsSync(WORDMARK_SVG),
    "brand-assets/wippaAGENT-wordmark.svg must not exist; the README block is the only wordmark",
  )
})

test("the end marker is never followed by a second copy of the art", () => {
  const art = readArt()
  const lines = readFileSync(README, "utf8").split("\n")
  const end = markerIndexes(lines, END_MARKER)

  assert.equal(end.length, 1, "exactly one end marker")
  const after = lines.slice(end[0] + 1)
  for (const row of art) {
    if (row === "") continue
    assert.ok(!after.includes(row), `the art row "${row}" appears again after the end marker`)
  }
})
