#!/usr/bin/env node
// check-claims.mjs — zero-dependency consistency checks over the product surface.
//
// The installer, the roster, the plugin catalog and the README each name the
// primary agent file independently (the plugin's install scope cannot carry
// repo-root files, so there is no single source of truth to import). This
// script is the consistency layer: it fails the build when any two of those
// claims disagree.
//
// Run: npm run check:claims   (exit 0 = pass, exit 1 = first failure, printed)

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, dirname, basename } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

let failures = 0
/** Report one failed assertion and keep going, so a run shows every drift at once. */
function fail(message) {
  failures++
  console.error(`FAIL: ${message}`)
}
function pass(message) {
  console.log(`ok:   ${message}`)
}

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8")
}

// ---------------------------------------------------------------------------
// 1. install.sh declares the primary agent file, and that file exists at root.
// ---------------------------------------------------------------------------
const installSh = read("install.sh")
const primaryMatch = installSh.match(/^PRIMARY_AGENT_FILE="([^"]+)"/m)
if (!primaryMatch) {
  fail('install.sh: no PRIMARY_AGENT_FILE="…" line found')
} else {
  const primaryFile = primaryMatch[1]
  if (!existsSync(join(ROOT, primaryFile))) {
    fail(`install.sh PRIMARY_AGENT_FILE="${primaryFile}" does not exist at the repository root`)
  } else {
    pass(`install.sh PRIMARY_AGENT_FILE="${primaryFile}" exists at repo root`)
  }
}

// ---------------------------------------------------------------------------
// 2. tools/catalog.ts names the same file for roster lookup.
// ---------------------------------------------------------------------------
const catalogTs = read("tools/catalog.ts")
const rosterMatch = catalogTs.match(/ROSTER_FILENAME\s*=\s*"([^"]+)"/)
if (!rosterMatch) {
  fail("tools/catalog.ts: no ROSTER_FILENAME = \"…\" found")
} else if (!primaryMatch) {
  // Assertion 1 already failed; say so instead of implying agreement.
  fail("tools/catalog.ts: cannot compare ROSTER_FILENAME — install.sh declares no PRIMARY_AGENT_FILE (see assertion 1)")
} else if (rosterMatch[1] !== primaryMatch[1]) {
  fail(
    `tools/catalog.ts ROSTER_FILENAME="${rosterMatch[1]}" differs from install.sh PRIMARY_AGENT_FILE="${primaryMatch[1]}"`,
  )
} else {
  pass(`tools/catalog.ts ROSTER_FILENAME="${rosterMatch[1]}" matches install.sh`)
}

// ---------------------------------------------------------------------------
// 3. opencode.json default_agent points at that same file (OpenCode derives
//    agent ids from filenames, so default_agent + ".md" must resolve).
// ---------------------------------------------------------------------------
const opencode = JSON.parse(read("opencode.json"))
const defaultAgent = opencode.default_agent
if (typeof defaultAgent !== "string") {
  fail('opencode.json: "default_agent" is missing or not a string')
} else if (!primaryMatch) {
  fail("opencode.json: cannot check default_agent — install.sh declares no PRIMARY_AGENT_FILE (see assertion 1)")
} else if (`${defaultAgent}.md` !== primaryMatch[1]) {
  fail(
    `opencode.json default_agent="${defaultAgent}" resolves to "${defaultAgent}.md", not "${primaryMatch[1]}"`,
  )
} else {
  pass(`opencode.json default_agent="${defaultAgent}" resolves to "${defaultAgent}.md"`)
}

// ---------------------------------------------------------------------------
// 4. Roster consistency — every categories/*/*.md has a roster row, every
//    roster row has a file, and the primary id itself has a row.
// ---------------------------------------------------------------------------
const rosterFile = primaryMatch ? primaryMatch[1] : "wippaAGENT.md"
const rosterText = read(rosterFile)
const headingIndex = rosterText.search(/^## Your roster\b/m)
if (headingIndex === -1) {
  fail(`${rosterFile}: no "## Your roster" section found`)
} else {
  // Slice from the heading to the next same-level heading (or end of file).
  const rest = rosterText.slice(headingIndex)
  const nextHeading = rest.slice(1).search(/^## /m)
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading + 1)
  // Roster rows look like: | `some-id` | Category | … |
  const rosterIds = [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1])

  const categoryIds = []
  for (const dir of readdirSync(join(ROOT, "categories"))) {
    const dirPath = join(ROOT, "categories", dir)
    if (!statSync(dirPath).isDirectory()) continue
    for (const file of readdirSync(dirPath)) {
      if (file.endsWith(".md")) categoryIds.push(basename(file, ".md"))
    }
  }

  let ok = true
  for (const id of categoryIds) {
    if (!rosterIds.includes(id)) {
      ok = false
      fail(`roster: agent file categories/*/${id}.md has no row in "${rosterFile}"`)
    }
  }
  // The primary id (from the root filename) must have its own roster row.
  const primaryId = rosterFile.endsWith(".md") ? basename(rosterFile, ".md") : rosterFile
  if (!rosterIds.includes(primaryId)) {
    ok = false
    fail(`roster: primary agent "${primaryId}" has no row in "${rosterFile}"`)
  }
  for (const id of rosterIds) {
    if (id === primaryId) continue
    if (!categoryIds.includes(id)) {
      ok = false
      fail(`roster: row "${id}" in "${rosterFile}" has no matching categories/*/${id}.md`)
    }
  }
  if (ok) {
    pass(`roster lists ${rosterIds.length} ids (incl. primary "${primaryId}"), matching categories/*/*.md (${categoryIds.length} files)`)
  }
}

// ---------------------------------------------------------------------------
// 5. Stale-id scan — the old primary id must not survive in any tracked file
//    name or content, in any case variant. CHANGELOG.md is excluded by name
//    so a future changelog may mention the old id.
// ---------------------------------------------------------------------------
// Built from parts so this script never trips its own stale-id scan.
const STALE_ID = ["agent", "WIPPA"].join("")
const needle = STALE_ID.toLowerCase()
const EXCLUDED = new Set(["changelog.md"])
let tracked = []
try {
  tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
} catch (err) {
  fail(`stale-id scan: git ls-files failed (${err.message.split("\n")[0]}) — is this a git checkout?`)
}
let staleHits = 0
for (const file of tracked) {
  if (EXCLUDED.has(basename(file).toLowerCase())) continue
  // File names count too: an agent definition named after the stale id is
  // exactly the drift this gate exists to catch.
  if (file.toLowerCase().includes(needle)) {
    fail(`stale id "${STALE_ID}" appears in tracked file name: ${file}`)
    staleHits++
    continue
  }
  let text
  try {
    text = readFileSync(join(ROOT, file), "utf8")
  } catch {
    continue // deleted-but-staged is not this script's problem
  }
  if (text.toLowerCase().includes(needle)) {
    fail(`stale id "${STALE_ID}" still present in ${file}`)
    staleHits++
  }
}
if (tracked.length > 0 && staleHits === 0) pass(`no tracked file name or content contains the stale id "${STALE_ID}"`)

// ---------------------------------------------------------------------------
// 6. Tool count — tools/index.ts registrations (comments stripped, so a
//    commented-out registration does not count) must equal BOTH README
//    surfaces: the shields badge and the "At a glance" table cell.
// ---------------------------------------------------------------------------
/** Remove block comments and full-line // comments before counting registrations. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n")
}
const toolCount = [...stripComments(read("tools/index.ts")).matchAll(/editor\.add\(\{/g)].length
const readme = read("README.md")

const badgeMatch = readme.match(/badge\/tools-(\d+)-/)
if (!badgeMatch) {
  fail("README.md: no `badge/tools-N-` shields.io badge found")
} else if (Number(badgeMatch[1]) !== toolCount) {
  fail(`README.md tools badge says ${badgeMatch[1]}, tools/index.ts registers ${toolCount}`)
} else {
  pass(`README tools badge (${badgeMatch[1]}) matches tools/index.ts registrations (${toolCount})`)
}

// The "At a glance" cell is its own claim: <h2>N</h2><b>Plugin tools</b>.
// The badge and the cell can drift apart, so check the cell directly.
const cellMatch = readme.match(/<h2>(\d+)<\/h2><b>Plugin tools/)
if (!cellMatch) {
  fail('README.md: no "At a glance" cell `<h2>N</h2><b>Plugin tools` found')
} else if (Number(cellMatch[1]) !== toolCount) {
  fail(`README.md "Plugin tools" cell says ${cellMatch[1]}, tools/index.ts registers ${toolCount}`)
} else {
  pass(`README "Plugin tools" cell (${cellMatch[1]}) matches tools/index.ts registrations (${toolCount})`)
}
if (readme.includes("5 Plugin tools")) {
  fail('README.md still contains the stale string "5 Plugin tools"')
}

// ---------------------------------------------------------------------------
if (failures > 0) {
  console.error(`\ncheck:claims failed — ${failures} problem${failures === 1 ? "" : "s"}`)
  process.exit(1)
}
console.log("\ncheck:claims passed")
