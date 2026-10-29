#!/usr/bin/env node
// token-count.mjs — zero-dependency token budget for the prompt corpus.
//
// The prompt corpus is what every session pays for up front: the primary agent
// definition plus the twelve subagent definitions. Skills are excluded from the
// budget because they load on demand — they are listed separately for
// visibility so a move out of the corpus is never invisible.
//
// Heuristic: one token is taken as four characters. A real tokenizer's count
// depends on its vocabulary and on the text, but chars/4 tracks English plus
// Markdown closely enough to catch regressions, and unlike a real tokenizer it
// is deterministic, dependency-free, and stable across runs and machines: the
// same bytes always produce the same number. The budget is therefore an index
// for comparison, not a claim about any specific model's context window.
//
// Usage:
//   node scripts/token-count.mjs              report only (exit 0)
//   node scripts/token-count.mjs --max 110000 enforce a ceiling (exit 1 if over)
//   node scripts/token-count.mjs --help
//
// Run: npm run check:tokens   (exit 0 = within budget, exit 1 = over budget)

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/token-count.mjs [--max N]

Reports the estimated token count of the prompt corpus (wippaAGENT.md plus
categories/*/*.md), per file and total, and optionally enforces a ceiling.

Options:
  --max N   fail with exit 1 when the total exceeds N estimated tokens
  --help    print this help
`)
  process.exit(0)
}

/** Estimated tokens for a string: the four-characters-per-token heuristic. */
function estimate(text) {
  return Math.round(text.length / 4)
}

/** The budgeted corpus, in a fixed order so the table never shuffles. */
function corpusFiles() {
  const files = ["wippaAGENT.md"]
  const categories = join(ROOT, "categories")
  if (existsSync(categories)) {
    for (const dir of readdirSync(categories).sort()) {
      const path = join(categories, dir)
      let entries
      try {
        entries = readdirSync(path)
      } catch {
        continue
      }
      for (const file of entries.sort()) {
        if (file.endsWith(".md")) files.push(`categories/${dir}/${file}`)
      }
    }
  }
  return files
}

/** Skills live beside the corpus but load on demand, so they are not budgeted. */
function skillFiles() {
  const skills = join(ROOT, "skills")
  if (!existsSync(skills)) return []
  const files = []
  for (const dir of readdirSync(skills).sort()) {
    for (const file of readdirSync(join(skills, dir)).sort()) {
      if (file.endsWith(".md")) files.push(`skills/${dir}/${file}`)
    }
  }
  return files
}

/** Read a repo-relative file as UTF-8. */
function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8")
}

let max = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--max") {
    const value = Number(args[++i])
    if (!Number.isFinite(value) || value <= 0) {
      console.error("error: --max expects a positive number of tokens")
      process.exit(2)
    }
    max = Math.round(value)
  } else {
    console.error(`error: unknown argument "${args[i]}" (try --help)`)
    process.exit(2)
  }
}

const files = corpusFiles()
if (files.length === 0) {
  console.error("error: no agent definition files found — is this the repository root?")
  process.exit(2)
}

const nameWidth = Math.max(...files.map((f) => f.length), "TOTAL".length)
const rows = files.map((rel) => {
  const text = read(rel)
  return { file: rel, chars: text.length, tokens: estimate(text) }
})

const totalChars = rows.reduce((sum, row) => sum + row.chars, 0)
const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0)

console.log("prompt corpus token estimate (4 chars ≈ 1 token)")
console.log("")
console.log(
  `${"file".padEnd(nameWidth)}  ${"chars".padStart(7)}  ${"est. tokens".padStart(11)}`,
)
console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(7)}  ${"-".repeat(11)}`)
for (const row of rows) {
  console.log(
    `${row.file.padEnd(nameWidth)}  ${String(row.chars).padStart(7)}  ${String(row.tokens).padStart(11)}`,
  )
}
console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(7)}  ${"-".repeat(11)}`)
console.log(
  `${`TOTAL (${rows.length} files)`.padEnd(nameWidth)}  ${String(totalChars).padStart(7)}  ${String(totalTokens).padStart(11)}`,
)

const skills = skillFiles()
if (skills.length > 0) {
  const skillRows = skills.map((rel) => {
    const text = read(rel)
    return { file: rel, chars: text.length, tokens: estimate(text) }
  })
  const skillChars = skillRows.reduce((sum, row) => sum + row.chars, 0)
  const skillTokens = skillRows.reduce((sum, row) => sum + row.tokens, 0)
  console.log("")
  console.log("on-demand skills (not in the prompt corpus, not budgeted):")
  for (const row of skillRows) {
    console.log(
      `  ${row.file.padEnd(nameWidth)}  ${String(row.chars).padStart(7)}  ${String(row.tokens).padStart(11)}`,
    )
  }
  console.log(
    `${"SKILLS TOTAL".padEnd(nameWidth)}  ${String(skillChars).padStart(7)}  ${String(skillTokens).padStart(11)}`,
  )
}

if (max === null) {
  console.log("")
  console.log("no budget given (report only) — pass --max N to enforce a ceiling")
  process.exit(0)
}

console.log("")
if (totalTokens > max) {
  console.error(
    `token budget exceeded: ${totalTokens} estimated tokens > budget of ${max} (${totalTokens - max} over, ${((totalTokens / max - 1) * 100).toFixed(1)}%). ` +
      "Shrink the agent definition files — move task-specific playbooks into skills/ or cut redundant prose.",
  )
  process.exit(1)
}
console.log(
  `token budget OK: ${totalTokens} <= ${max} (${max - totalTokens} headroom, ${(((max - totalTokens) / max) * 100).toFixed(1)}% of budget)`,
)
process.exit(0)
