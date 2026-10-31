import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const SKILL_DIR = join(REPO_ROOT, "skills", "domain-playbooks")
const REFERENCES_DIR = join(SKILL_DIR, "references")

/** Every Markdown file under `dir`, recursively, as paths relative to `dir`. */
function markdownFilesUnder(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...markdownFilesUnder(join(dir, entry.name), relative))
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(relative)
  }
  return files.sort()
}

test("the on-demand report counts every nested reference file", () => {
  const referenceFiles = markdownFilesUnder(REFERENCES_DIR)
  assert.ok(referenceFiles.length > 0, "skills/domain-playbooks/references/ must hold at least one file")

  const result = spawnSync(process.execPath, ["scripts/token-count.mjs"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(result.stderr, "", "a report-only run writes nothing to stderr")

  for (const file of referenceFiles) {
    const rel = `skills/domain-playbooks/references/${file}`
    assert.ok(
      result.stdout.includes(rel),
      `the on-demand report must list ${rel}`,
    )
  }
})

test("the index links each reference file exactly once", () => {
  const index = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8")

  for (const file of markdownFilesUnder(REFERENCES_DIR)) {
    const target = `references/${file}`
    const occurrences = index.split(target).length - 1
    assert.equal(occurrences, 1, `SKILL.md must link ${target} exactly once`)
  }
})

test("every reference link in the index resolves to a file", () => {
  const index = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8")
  const targets = [...index.matchAll(/\]\((references\/[^)]+\.md)\)/g)].map((match) => match[1])

  assert.ok(targets.length > 0, "SKILL.md must link at least one reference file")
  for (const target of targets) {
    assert.ok(
      existsSync(join(SKILL_DIR, target)),
      `SKILL.md links ${target}, which does not exist`,
    )
  }
})
