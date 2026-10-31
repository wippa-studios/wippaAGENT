#!/usr/bin/env node
/**
 * Generates the README wordmark from the installer banner.
 *
 * `install.sh` is the single source of the art: the heredoc that the installer
 * prints is parsed here and the same character grid is rendered into the
 * README as a `<pre>` block, so the two surfaces cannot describe a different
 * wordmark. Run `npm run wordmark` after changing the art, and
 * `node scripts/wordmark.ts --check` to report whether the committed block is
 * stale.
 *
 * The README copy pads every row to the width of the widest row, because the
 * block sits in a centred container and a renderer that centres each line on
 * its own would shear the glyph grid. The installer copy is not padded: a
 * terminal left-aligns, so trailing spaces there would be noise rather than
 * alignment.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const INSTALLER = join(REPO_ROOT, "install.sh")
const README = join(REPO_ROOT, "README.md")
const START_MARKER =
  "<!-- wordmark:start - generated from the install.sh banner by npm run wordmark -->"
const END_MARKER = "<!-- wordmark:end -->"

/**
 * The lines of the installer banner, with trailing whitespace removed.
 *
 * The heredoc opener carries other shell text on the same line, so the opener
 * is matched as a substring. The closer is a line of its own.
 */
export function extractArt(installerSource: string): string[] {
  const lines = installerSource.replace(/\r\n/g, "\n").split("\n")
  const start = lines.findIndex((line) => line.includes("<<'BANNER'"))
  if (start === -1) throw new Error("install.sh has no <<'BANNER' heredoc")

  const art: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === "BANNER") {
      return art.map((line) => line.replace(/\s+$/, ""))
    }
    art.push(lines[index])
  }
  throw new Error("the <<'BANNER' heredoc in install.sh is not closed by a line reading BANNER")
}

/**
 * The README block: the generation markers around a `<pre>` that carries the
 * art one line per row. Each row is padded on the right with ASCII spaces to
 * the width of the widest row, so every line box is the same width inside the
 * centred container and the grid stays aligned. `role="img"` and the label
 * stop a screen reader from reading the box-drawing characters as text.
 */
export function renderBlock(art: string[]): string {
  const width = art.reduce((widest, line) => Math.max(widest, line.length), 0)
  const padded = art.map((line) => line.padEnd(width, " "))
  const lines = [
    START_MARKER,
    `<pre role="img" aria-label="wippaAGENT">`,
    ...padded,
    `</pre>`,
    END_MARKER,
  ]
  return `${lines.join("\n")}\n`
}

/** The single line index of `marker`, or an error naming README.md and the marker. */
function markerLine(lines: string[], marker: string): number {
  const found: number[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === marker) found.push(index)
  }
  if (found.length !== 1) {
    throw new Error(`README.md must contain exactly one line reading "${marker}" (found ${found.length})`)
  }
  return found[0]
}

/** The README's lines and the span from the start marker to the end marker. */
function wordmarkRegion(readme: string): { lines: string[]; start: number; end: number } {
  const lines = readme.split("\n")
  const start = markerLine(lines, START_MARKER)
  const end = markerLine(lines, END_MARKER)
  if (end < start) {
    throw new Error(`README.md puts "${END_MARKER}" before "${START_MARKER}"`)
  }
  return { lines, start, end }
}

/** Rows and columns of the art, for the one-line report. */
function measure(art: string[]): { rows: number; columns: number } {
  return {
    rows: art.length,
    columns: art.reduce((widest, line) => Math.max(widest, line.length), 0),
  }
}

function main(argv: string[]): void {
  const check = argv.includes("--check")
  const art = extractArt(readFileSync(INSTALLER, "utf8"))
  const block = renderBlock(art)
  const { rows, columns } = measure(art)
  const bytes = Buffer.byteLength(block, "utf8")
  const summary = `${rows} rows, ${columns} columns, ${bytes} bytes`

  let region: ReturnType<typeof wordmarkRegion>
  try {
    region = wordmarkRegion(readFileSync(README, "utf8"))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${message} (${summary}); run npm run wordmark`)
    process.exitCode = 1
    return
  }

  const { lines, start, end } = region
  const committed = `${lines.slice(start, end + 1).join("\n")}\n`

  if (check) {
    if (committed !== block) {
      console.error(`README.md wordmark block is stale (${summary}); run npm run wordmark`)
      process.exitCode = 1
      return
    }
    console.log(`README.md wordmark block is up to date (${summary})`)
    return
  }

  const blockLines = block.split("\n").slice(0, -1)
  const next = [...lines.slice(0, start), ...blockLines, ...lines.slice(end + 1)].join("\n")
  writeFileSync(README, next)
  console.log(`README.md wordmark block written (${summary})`)
}

const entry = process.argv[1]
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main(process.argv.slice(2))
}
