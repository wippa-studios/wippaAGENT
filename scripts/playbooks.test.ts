import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const CATEGORIES_DIR = join(REPO_ROOT, "categories")
const SKILLS_DIR = join(REPO_ROOT, "skills")
const REFERENCES_DIR = join(REPO_ROOT, "skills", "specialist-playbooks", "references")

interface TableRow {
  topic: string
  file: string
}

/** Every agent definition under categories/, keyed by id (the file name). */
function agentDefinitions(): Map<string, string> {
  const agents = new Map<string, string>()
  for (const dir of readdirSync(CATEGORIES_DIR).sort()) {
    const category = join(CATEGORIES_DIR, dir)
    for (const file of readdirSync(category).sort()) {
      if (!file.endsWith(".md")) continue
      agents.set(file.slice(0, -3), join(category, file))
    }
  }
  return agents
}

/** The body under `## Playbooks`, up to the next level-two heading. */
function playbooksSection(text: string): string {
  const lines = text.split("\n")
  const start = lines.findIndex((line) => line.trim() === "## Playbooks")
  if (start === -1) return ""
  const end = lines.findIndex((line, index) => index > start && /^##\s/.test(line))
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n")
}

/** Rows of the form `| Topic | `file.md` |`, excluding the header row. */
function playbookRows(section: string): TableRow[] {
  const rows: TableRow[] = []
  for (const line of section.split("\n")) {
    const match = /^\|\s*(.+?)\s*\|\s*`([^`]+\.md)`\s*\|\s*$/.exec(line)
    if (match === null || match[1] === "Topic") continue
    rows.push({ topic: match[1], file: match[2] })
  }
  return rows
}

/** The text of the first `# ` heading in a file, or null when there is none. */
function firstHeading(text: string): string | null {
  for (const line of text.split("\n")) {
    if (/^# /.test(line)) return line.slice(2).trim()
  }
  return null
}

/** Every Markdown file directly inside a reference folder, sorted. */
function folderFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort()
}

/** The playbook folders, sorted by agent id. */
function referenceFolders(): string[] {
  return readdirSync(REFERENCES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** Every Markdown file under `dir`, recursively, as paths relative to `dir`. */
function markdownFilesUnder(dir: string, prefix = ""): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...markdownFilesUnder(join(dir, entry.name), relative))
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(relative)
  }
  return files.sort()
}

/** Every skill directory holding a SKILL.md and a references/ folder, sorted by name. */
function skillDirectories(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(SKILLS_DIR, name, "SKILL.md")))
    .filter((name) => {
      const references = join(SKILLS_DIR, name, "references")
      return existsSync(references) && statSync(references).isDirectory()
    })
    .sort()
}

test("every playbook file is in exactly one routing table", () => {
  const agents = agentDefinitions()
  const folders = referenceFolders()
  const tables = folders.map((folder) => {
    const definition = agents.get(folder)
    assert.ok(definition, `${folder}: no agent definition at categories/*/${folder}.md`)
    return {
      folder,
      rows: playbookRows(playbooksSection(readFileSync(definition, "utf8"))),
    }
  })
  const rowCount = tables.reduce((sum, table) => sum + table.rows.length, 0)
  const summary = `${folders.length} folders and ${rowCount} rows`

  for (const { folder, rows } of tables) {
    assert.ok(rows.length > 0, `${folder}: the routing table must not be empty (${summary})`)

    for (const row of rows) {
      const path = join(REFERENCES_DIR, folder, row.file)
      assert.ok(existsSync(path), `${folder}: the table names ${row.file}, which does not exist (${summary})`)
      assert.equal(
        firstHeading(readFileSync(path, "utf8")),
        row.topic,
        `${folder}/${row.file}: the table topic must equal the file's first # heading (${summary})`,
      )
    }

    const named = rows.map((row) => row.file)
    for (const file of folderFiles(join(REFERENCES_DIR, folder))) {
      const count = named.filter((name) => name === file).length
      assert.equal(
        count,
        1,
        `${folder}/${file}: named ${count} times in the routing table, expected exactly once (${summary})`,
      )
    }
  }
})

test("the playbook folders and the agent tables describe the same set", () => {
  const agents = agentDefinitions()
  const folders = referenceFolders()
  const withTable = [...agents.entries()]
    .filter(([, path]) => /^\|\s*Topic\s*\|\s*File\s*\|/m.test(playbooksSection(readFileSync(path, "utf8"))))
    .map(([id]) => id)
    .sort()

  assert.equal(folders.length, 11, `expected eleven playbook folders, found ${folders.length}`)
  assert.deepEqual(
    folders,
    withTable,
    `the folders under references/ must equal the agents carrying a ## Playbooks table (${folders.length} folders, ${withTable.length} tables)`,
  )
})

test("an agent definition keeps a routing table, not a playbook body", () => {
  const agents = agentDefinitions()
  const tables = [...agents.entries()].filter(([, path]) =>
    /^\|\s*Topic\s*\|\s*File\s*\|/m.test(playbooksSection(readFileSync(path, "utf8"))),
  )
  assert.equal(tables.length, 11, `expected eleven agent tables, found ${tables.length}`)

  for (const [id, path] of tables) {
    const section = playbooksSection(readFileSync(path, "utf8"))
    assert.ok(
      !/^###\s/m.test(section),
      `${id}: the ## Playbooks section must hold a table only, found a ### heading (${tables.length} tables checked)`,
    )
  }
})

test("every skill links each reference file exactly once and every link resolves", () => {
  const inspected = skillDirectories().map((skill) => {
    const dir = join(SKILLS_DIR, skill)
    const index = readFileSync(join(dir, "SKILL.md"), "utf8")
    const targets = [...index.matchAll(/\]\((references\/[^)\s]+\.md)\)/g)].map((match) => match[1])
    return { skill, dir, files: markdownFilesUnder(join(dir, "references")), targets }
  })
  const linked = inspected.filter((entry) => entry.targets.length > 0)
  const skipped = inspected.filter((entry) => entry.targets.length === 0).map((entry) => entry.skill)
  const linkCount = linked.reduce((sum, entry) => sum + entry.targets.length, 0)
  const summary =
    `${linked.length} skills link ${linkCount} reference files` +
    (skipped.length > 0 ? `; ${skipped.length} skipped with no reference link: ${skipped.join(", ")}` : "")

  assert.ok(
    linked.length > 0,
    `no skill links a reference file; scanned ${inspected.length} skills holding SKILL.md and references/`,
  )

  for (const { skill, dir, files, targets } of linked) {
    for (const target of targets) {
      assert.ok(
        existsSync(join(dir, target)),
        `${skill}: SKILL.md links ${target}, which does not exist (${summary})`,
      )
    }

    for (const file of files) {
      const target = `references/${file}`
      const count = targets.filter((name) => name === target).length
      assert.equal(
        count,
        1,
        `${skill}: SKILL.md links ${target} ${count} times, expected exactly once (${summary})`,
      )
    }
  }
})
