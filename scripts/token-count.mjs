#!/usr/bin/env node
// token-count.mjs — zero-dependency token budget for the prompt corpus.
//
// The prompt corpus is what every session pays for up front: the primary agent
// definition plus the twelve subagent definitions. Skill bodies are excluded
// from the corpus budget because they load on demand — they are listed
// separately for visibility. Skill *listings* are not on demand, though: at
// every model step OpenCode advertises each permitted skill's id, name and
// description, so that always-on surface is reported and can be budgeted with
// --max-skills.
//
// Heuristic: one token is taken as four characters. A real tokenizer's count
// depends on its vocabulary and on the text, but chars/4 tracks English plus
// Markdown closely enough to catch regressions, and unlike a real tokenizer it
// is deterministic, dependency-free, and stable across runs and machines: the
// same bytes always produce the same number. The budget is therefore an index
// for comparison, not a claim about any specific model's context window.
//
// Usage:
//   node scripts/token-count.mjs                    report only (exit 0)
//   node scripts/token-count.mjs --max 110000       enforce a corpus ceiling
//   node scripts/token-count.mjs --max-skills 1000  enforce a skill-listing ceiling
//   node scripts/token-count.mjs --help
//
// Run: npm run check:tokens   (exit 0 = within budget, exit 1 = over budget)

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/token-count.mjs [--max N] [--max-skills N]

Reports the estimated token count of the prompt corpus (wippaAGENT.md plus
categories/*/*.md), per file and total, the on-demand skill bodies, and the
always-on skill listings OpenCode advertises at every model step (each skill's
id, name and description). Either ceiling can be enforced.

Options:
  --max N          fail with exit 1 when the corpus exceeds N estimated tokens
  --max-skills N   fail with exit 1 when the always-on skill listings exceed N
  --help           print this help
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

/** The skill directories; a stray file under skills/ is skipped, not fatal. */
function skillDirectories() {
  const skills = join(ROOT, "skills")
  if (!existsSync(skills)) return []
  return readdirSync(skills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** The skill files on disk. They live beside the corpus but load on demand. */
function skillFiles() {
  const files = []
  for (const dir of skillDirectories()) {
    const path = join(ROOT, "skills", dir)
    let entries
    try {
      entries = readdirSync(path)
    } catch {
      continue
    }
    for (const file of entries.sort()) {
      if (file.endsWith(".md")) files.push(`skills/${dir}/${file}`)
    }
  }
  return files
}

/**
 * The `name` and `description` values of one SKILL.md frontmatter block: flat
 * `key: value` pairs plus the `>` and `|` block scalars an advertised
 * description may be written with. Mirrors the reader the catalog uses.
 */
function skillFrontmatter(rel) {
  const values = { name: "", description: "" }
  const text = read(rel).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const block = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!block) return values

  const lines = block[1].split("\n")
  for (let i = 0; i < lines.length; i++) {
    const match = /^(name|description):\s*(.*)$/.exec(lines[i])
    if (!match) continue
    const key = match[1]
    const raw = match[2].trim()

    const blockScalar = /^([>|])[+-]?$/.exec(raw)
    if (blockScalar) {
      const collected = []
      let j = i + 1
      for (; j < lines.length; j++) {
        const next = lines[j]
        if (next.trim() !== "" && !/^\s/.test(next)) break
        collected.push(next.replace(/^\s+/, ""))
      }
      while (collected.length > 0 && collected[collected.length - 1].trim() === "") collected.pop()
      values[key] =
        blockScalar[1] === "|"
          ? collected.join("\n").trim()
          : collected.join(" ").replace(/\s+/g, " ").trim()
      i = j - 1
      continue
    }

    values[key] = raw.length >= 2 && /^["']/.test(raw) && raw[0] === raw[raw.length - 1]
      ? raw.slice(1, -1)
      : raw
  }
  return values
}

/**
 * One row per skill for the always-on listing: what OpenCode advertises is the
 * path-derived id plus the frontmatter `name` and `description`; the body is
 * loaded only when the skill is called. A missing `name` falls back to the id,
 * exactly as OpenCode's display name does.
 */
function skillListingRows() {
  const rows = []
  for (const dir of skillDirectories()) {
    const rel = `skills/${dir}/SKILL.md`
    if (!existsSync(join(ROOT, rel))) continue
    const { name, description } = skillFrontmatter(rel)
    const advertised = `${dir} ${name || dir} ${description}`.replace(/\s+/g, " ").trim()
    rows.push({
      file: rel,
      chars: advertised.length,
      tokens: estimate(advertised),
      hasDescription: description.trim().length > 0,
    })
  }
  return rows
}

/** Read a repo-relative file as UTF-8, or fail cleanly rather than as a raw stack. */
function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), "utf8")
  } catch (error) {
    console.error(`error: cannot read ${rel}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

let max = null
let maxSkills = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--max") {
    const value = Number(args[++i])
    if (!Number.isFinite(value) || value <= 0) {
      console.error("error: --max expects a positive number of tokens")
      process.exit(2)
    }
    max = Math.round(value)
  } else if (args[i] === "--max-skills") {
    const value = Number(args[++i])
    if (!Number.isFinite(value) || value <= 0) {
      console.error("error: --max-skills expects a positive number of tokens")
      process.exit(2)
    }
    maxSkills = Math.round(value)
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
  console.log("on-demand skill bodies (loaded only when a skill is called, not budgeted):")
  for (const row of skillRows) {
    console.log(
      `  ${row.file.padEnd(nameWidth)}  ${String(row.chars).padStart(7)}  ${String(row.tokens).padStart(11)}`,
    )
  }
  console.log(
    `${"SKILLS TOTAL".padEnd(nameWidth)}  ${String(skillChars).padStart(7)}  ${String(skillTokens).padStart(11)}`,
  )
}

const listings = skillListingRows()
let listingTokens = 0
if (listings.length > 0) {
  const listingChars = listings.reduce((sum, row) => sum + row.chars, 0)
  listingTokens = listings.reduce((sum, row) => sum + row.tokens, 0)
  console.log("")
  console.log("always-on skill listings (id + name + description, advertised at every model step):")
  for (const row of listings) {
    const missing = row.hasDescription ? "" : " (no description: not advertised)"
    console.log(
      `  ${row.file.padEnd(nameWidth)}  ${String(row.chars).padStart(7)}  ${String(row.tokens).padStart(11)}${missing}`,
    )
  }
  console.log(
    `${"LISTINGS TOTAL".padEnd(nameWidth)}  ${String(listingChars).padStart(7)}  ${String(listingTokens).padStart(11)}`,
  )
}

const unchecked = []
if (max !== null && totalTokens > max) {
  console.error(
    `token budget exceeded: ${totalTokens} estimated tokens > budget of ${max} (${totalTokens - max} over, ${((totalTokens / max - 1) * 100).toFixed(1)}%). ` +
      "Shrink the agent definition files — move task-specific playbooks into skills/ or cut redundant prose.",
  )
  process.exitCode = 1
}
if (maxSkills !== null && listingTokens > maxSkills) {
  console.error(
    `skill-listing budget exceeded: ${listingTokens} estimated tokens > budget of ${maxSkills} (${listingTokens - maxSkills} over, ${((listingTokens / maxSkills - 1) * 100).toFixed(1)}%). ` +
      "Shorten the skill descriptions in skills/*/SKILL.md — they are advertised to the model every step.",
  )
  process.exitCode = 1
}
if (process.exitCode === 1) {
  process.exit(1)
}

console.log("")
if (max === null && maxSkills === null) {
  console.log("no budget given (report only) — pass --max N and --max-skills N to enforce a ceiling")
  process.exit(0)
}
if (max !== null) {
  console.log(
    `token budget OK: ${totalTokens} <= ${max} (${max - totalTokens} headroom, ${(((max - totalTokens) / max) * 100).toFixed(1)}% of budget)`,
  )
} else {
  unchecked.push("--max")
}
if (maxSkills !== null) {
  console.log(
    `skill-listing budget OK: ${listingTokens} <= ${maxSkills} (${maxSkills - listingTokens} headroom, ${(((maxSkills - listingTokens) / maxSkills) * 100).toFixed(1)}% of budget)`,
  )
} else {
  unchecked.push("--max-skills")
}
if (unchecked.length > 0) {
  console.log(`(no ceiling on: ${unchecked.join(", ")})`)
}
process.exit(0)
