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
} else if (primaryMatch && rosterMatch[1] !== primaryMatch[1]) {
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
} else if (primaryMatch && `${defaultAgent}.md` !== primaryMatch[1]) {
  fail(
    `opencode.json default_agent="${defaultAgent}" resolves to "${defaultAgent}.md", not "${primaryMatch[1]}"`,
  )
} else {
  pass(`opencode.json default_agent="${defaultAgent}" resolves to "${defaultAgent}.md"`)
}

// ---------------------------------------------------------------------------
// 4. Roster consistency — every categories/*/*.md has a roster row, and every
//    roster row has a file. (The primary id row points at the root file.)
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

  for (const id of categoryIds) {
    if (!rosterIds.includes(id)) fail(`roster: agent file categories/*/${id}.md has no row in "${rosterFile}"`)
  }
  // The primary id (from the root filename) is also a roster row with a file.
  const primaryId = rosterFile.endsWith(".md") ? basename(rosterFile, ".md") : rosterFile
  for (const id of rosterIds) {
    if (id === primaryId) continue
    if (!categoryIds.includes(id)) fail(`roster: row "${id}" in "${rosterFile}" has no matching categories/*/${id}.md`)
  }
  if (failures === 0) pass(`roster lists ${rosterIds.length} ids, matching categories/*/*.md (${categoryIds.length} files)`)
}

// ---------------------------------------------------------------------------
// 5. Stale-id scan — the old primary id must not survive anywhere tracked.
//    CHANGELOG.md is excluded by name so a future changelog may mention it.
// ---------------------------------------------------------------------------
// Built from parts so this script never trips its own stale-id scan.
const STALE_ID = ["agent", "WIPPA"].join("")
const EXCLUDED = new Set(["CHANGELOG.md"])
const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
let staleHits = 0
for (const file of tracked) {
  if (EXCLUDED.has(basename(file))) continue
  let text
  try {
    text = readFileSync(join(ROOT, file), "utf8")
  } catch {
    continue // deleted-but-staged is not this script's problem
  }
  if (text.includes(STALE_ID)) {
    fail(`stale id "${STALE_ID}" still present in ${file}`)
    staleHits++
  }
}
if (staleHits === 0) pass(`no tracked file contains the stale id "${STALE_ID}"`)

// ---------------------------------------------------------------------------
// 6. Tool count — tools/index.ts registrations must equal the README badge,
//    and the README must not carry the old "5 Plugin tools" wording.
// ---------------------------------------------------------------------------
const indexTs = read("tools/index.ts")
const toolCount = [...indexTs.matchAll(/editor\.add\(\{/g)].length
const readme = read("README.md")
const badgeMatch = readme.match(/badge\/tools-(\d+)-/)
if (!badgeMatch) {
  fail("README.md: no `badge/tools-N-` shields.io badge found")
} else if (Number(badgeMatch[1]) !== toolCount) {
  fail(`README.md tools badge says ${badgeMatch[1]}, tools/index.ts registers ${toolCount}`)
} else {
  pass(`README tools badge (${badgeMatch[1]}) matches tools/index.ts registrations (${toolCount})`)
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
