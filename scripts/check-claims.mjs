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

  // 4b. The quick routing table, not the roster, names the capability owner.
  // Every subagent file needs a row here, or the agent ships unroutable.
  const routingIndex = rosterText.search(/^## Quick routing\b/m)
  if (routingIndex === -1) {
    fail(`${rosterFile}: no "## Quick routing" section found`)
  } else {
    const routingRest = rosterText.slice(routingIndex)
    const nextRouting = routingRest.slice(1).search(/^## /m)
    const routingSection = nextRouting === -1 ? routingRest : routingRest.slice(0, nextRouting + 1)
    const routingIds = []
    for (const line of routingSection.split("\n")) {
      if (!line.startsWith("|")) continue
      // `| Need | \`id\` |` splits to ["", " Need ", " \`id\` ", ""].
      const owner = line.split("|")[2]?.trim().match(/^`([^`]+)`$/)
      if (owner) routingIds.push(owner[1])
    }
    let routingOk = true
    for (const id of categoryIds) {
      if (!routingIds.includes(id)) {
        routingOk = false
        fail(
          `quick routing: agent "${id}" has no row in the "## Quick routing" table of "${rosterFile}" — it would be unroutable`,
        )
      }
    }
    for (const id of routingIds) {
      if (!categoryIds.includes(id)) {
        routingOk = false
        fail(`quick routing: row "${id}" in "${rosterFile}" has no matching categories/*/${id}.md`)
      }
    }
    const seen = new Set()
    for (const id of routingIds) {
      if (seen.has(id)) {
        routingOk = false
        fail(`quick routing: "${id}" has more than one row in "${rosterFile}"`)
      }
      seen.add(id)
    }
    if (routingOk) {
      pass(
        `quick routing table names all ${categoryIds.length} subagent ids and no others ` +
          `(${routingIds.length} rows, each with one owner)`,
      )
    }
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
// 7. opencode.json and the installer's JSON template agree on everything
//    --apply-config writes: the default agent, the whole `agents` object and
//    the whole `mcp.servers` object, every URL and command included. The two
//    sides are compared key by key; a change to one without the other would
//    ship two different products depending on how a scope was created.
// ---------------------------------------------------------------------------
const templateMatch = installSh.match(/cat <<'JSON'\n([\s\S]*?)\nJSON\n/)
if (!templateMatch) {
  fail("install.sh: no `cat <<'JSON'` … `JSON` template found for the --apply-config keys")
} else {
  let template
  try {
    template = JSON.parse(templateMatch[1])
  } catch (error) {
    fail(`install.sh: the \`cat <<'JSON'\` template does not parse: ${error.message}`)
  }
  if (template) {
    let drift = 0
    /** Key-sorted JSON at every level, so key order is never read as a value change. */
    const stableStringify = (value) => {
      if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
      if (value !== null && typeof value === "object") {
        return `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
          .join(",")}}`
      }
      return JSON.stringify(value)
    }
    /** The first path at which two values differ, with both sides, or null. */
    const firstDifference = (configValue, templateValue, path) => {
      if (stableStringify(configValue) === stableStringify(templateValue)) return null
      const bothObjects =
        configValue !== null &&
        templateValue !== null &&
        typeof configValue === "object" &&
        typeof templateValue === "object" &&
        !Array.isArray(configValue) &&
        !Array.isArray(templateValue)
      if (bothObjects) {
        const keys = [...new Set([...Object.keys(configValue), ...Object.keys(templateValue)])].sort()
        for (const key of keys) {
          const difference = firstDifference(configValue[key], templateValue[key], `${path}.${key}`)
          if (difference) return difference
        }
      }
      if (Array.isArray(configValue) && Array.isArray(templateValue)) {
        const length = Math.max(configValue.length, templateValue.length)
        for (let index = 0; index < length; index++) {
          const difference = firstDifference(
            configValue[index],
            templateValue[index],
            `${path}[${index}]`,
          )
          if (difference) return difference
        }
      }
      return { path, configValue, templateValue }
    }
    const compare = (claim, configValue, templateValue) => {
      const difference = firstDifference(configValue, templateValue, claim)
      if (!difference) return
      drift++
      fail(
        `config/template drift: ${difference.path} is ${JSON.stringify(difference.configValue)} in opencode.json ` +
          `but ${JSON.stringify(difference.templateValue)} in the install.sh template`,
      )
    }

    compare("default_agent", opencode.default_agent, template.default_agent)
    compare("agents", opencode.agents, template.agents)
    compare("mcp.servers", opencode.mcp?.servers, template.mcp?.servers)

    // The two sides can agree and both still carry the demoted shape the
    // installer now migrates away. The shipped built-ins are disabled
    // outright, so assert that shape as well as the agreement.
    for (const id of ["general", "explore", "build"]) {
      const entry = template.agents?.[id]
      if (stableStringify(entry) !== stableStringify({ disabled: true })) {
        drift++
        fail(
          `config/template drift: agents.${id} is ${JSON.stringify(entry)} in the install.sh template, ` +
            `but a built-in must be exactly {"disabled":true}`,
        )
      }
    }
    if (drift === 0) {
      pass(
        "opencode.json matches the install.sh JSON template: default_agent, the whole agents object (built-ins exactly {disabled:true}) and the whole mcp.servers object, compared key by key",
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 8. The installer ships every skill directory, not a hardcoded subset. The
//    copy path is a glob loop over skills/*/; if that loop is ever replaced by
//    an explicit list, every skill directory must still appear in the copy and
//    remove calls, so a newly added skill can never be silently left out.
// ---------------------------------------------------------------------------
const SKILLS_LOOP = 'for src in "$SCRIPT_DIR"/skills/*/; do'
const skillNames = (() => {
  const dir = join(ROOT, "skills")
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort()
})()
// The installer counts every directory under skills/, whether or not it holds a
// SKILL.md, so the prose count has to use the same total. Assertion 10 fails
// when the two lists disagree.
const skillDirNames = (() => {
  const dir = join(ROOT, "skills")
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
})()
const hasSkillsLoop = installSh.split(SKILLS_LOOP).length - 1 >= 2 // install path + uninstall path
const hasSkillCopy = installSh.includes('copy_tree "$SCRIPT_DIR/skills/$name" "$SKILLS_DIR/$name"')
const hasSkillRemove = installSh.includes(
  'remove_tree_files "$SCRIPT_DIR/skills/$name" "$SKILLS_DIR/$name"',
)
if (skillNames.length === 0) {
  fail("skills/: no skill directories with a SKILL.md found — assertion 8 expects at least one")
} else if (!hasSkillsLoop) {
  fail(
    `install.sh: no "${SKILLS_LOOP}" loop found on both the install and uninstall paths — ` +
      `the installer would ship a hardcoded subset, leaving ${skillNames.join(", ")} out`,
  )
} else if (!hasSkillCopy) {
  fail('install.sh: the skills loop does not copy_tree "$SCRIPT_DIR/skills/$name" → "$SKILLS_DIR/$name"')
} else if (!hasSkillRemove) {
  fail(
    'install.sh: --uninstall does not remove_tree_files "$SCRIPT_DIR/skills/$name" from "$SKILLS_DIR/$name"',
  )
} else {
  pass(`install.sh installs and uninstalls all ${skillNames.length} skills via a skills/*/ loop`)
}

// ---------------------------------------------------------------------------
// 9. Every "skill `X`" pointer in the agent definitions resolves to a real
//    SKILL.md, so a pointer can never point at a skill that is absent from
//    skills/ (and therefore absent from every installed scope).
// ---------------------------------------------------------------------------
const pointerFiles = ["wippaAGENT.md"]
for (const dir of readdirSync(join(ROOT, "categories"), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  for (const file of readdirSync(join(ROOT, "categories", dir.name))) {
    if (file.endsWith(".md")) pointerFiles.push(join("categories", dir.name, file))
  }
}
let dangling = 0
for (const rel of pointerFiles) {
  for (const match of read(rel).matchAll(/skill `([^`]+)`/g)) {
    const target = join(ROOT, "skills", match[1], "SKILL.md")
    if (!existsSync(target)) {
      dangling++
      fail(`${rel}: pointer to skill \`${match[1]}\` — no skills/${match[1]}/SKILL.md exists`)
    }
  }
}
if (dangling === 0) {
  pass(`every "skill \`X\`" pointer in wippaAGENT.md and categories/*/*.md resolves to a SKILL.md`)
}

// ---------------------------------------------------------------------------
// 10. The skill count stated in prose matches skills/. The README and the
//     capability map both spell the count as a word, so adding or removing a
//     skill directory without moving both surfaces must fail the build.
// ---------------------------------------------------------------------------
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
]
/** Spell 0–20, or null outside the range this claim can express. */
function numberWord(n) {
  return NUMBER_WORDS[n] ?? null
}

const expectedSkillWord = numberWord(skillDirNames.length)
const expectedOtherWord = numberWord(skillDirNames.length - 1)
const readmeSkill = readme.match(/Skills \(all of `skills\/`, currently ([a-z]+)\)/)
const capabilityMap = read("docs/tool-capability-map.md")
const mapSkill = capabilityMap.match(/^One primary agent,.*\b([a-z]+) skills/m)
const mapLoads = capabilityMap.match(/The ([a-z]+) skills under `skills\/` load on demand/)
const mapOther = capabilityMap.match(/The other ([a-z]+) —/)
const readmeSkillValue = readmeSkill ? `"${readmeSkill[1]}"` : "no count"
const mapSkillValue = mapSkill ? `"${mapSkill[1]}"` : "no count"
const mapLoadsValue = mapLoads ? `"${mapLoads[1]}"` : "no count"
const mapOtherValue = mapOther ? `"${mapOther[1]}"` : "no count"

for (const name of skillDirNames) {
  if (!existsSync(join(ROOT, "skills", name, "SKILL.md"))) {
    fail(
      `skill count: skills/${name}/ has no SKILL.md, so the installer would count it but the listing would not`,
    )
  }
}

if (!expectedSkillWord) {
  fail(
    `skill count: skills/ holds ${skillDirNames.length} skill directories, outside the 0–20 range this assertion can spell`,
  )
} else if (
  !readmeSkill ||
  !mapSkill ||
  !mapLoads ||
  !mapOther ||
  readmeSkill[1] !== expectedSkillWord ||
  mapSkill[1] !== expectedSkillWord ||
  mapLoads[1] !== expectedSkillWord ||
  mapOther[1] !== expectedOtherWord
) {
  fail(
    `skill count: skills/ holds ${skillDirNames.length} skill directories, so README.md and the docs summary must say "${expectedSkillWord} skills", ` +
      `and docs/tool-capability-map.md must say "The ${expectedSkillWord} skills" and "The other ${expectedOtherWord}"; ` +
      `README.md says ${readmeSkillValue}, the summary line says ${mapSkillValue}, ` +
      `"The … skills under \`skills/\`" says ${mapLoadsValue}, "The other …" says ${mapOtherValue}`,
  )
} else {
  pass(
    `README.md and docs/tool-capability-map.md match ${skillDirNames.length} skill directories ` +
      `("${expectedSkillWord} skills", then "${expectedOtherWord}" in the capability map)`,
  )
}

// ---------------------------------------------------------------------------
if (failures > 0) {
  console.error(`\ncheck:claims failed — ${failures} problem${failures === 1 ? "" : "s"}`)
  process.exit(1)
}
console.log("\ncheck:claims passed")
