import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url))
const SCRIPT = join(REPO_ROOT, "scripts", "opencode-memory.sh")
// Honour the host's temporary directory. TMPDIR is set to /var/tmp in the
// environment this suite runs in; os.tmpdir() covers hosts without it.
const TMP_ROOT = process.env.TMPDIR ?? tmpdir()
const HAS_SQLITE = spawnSync("sqlite3", ["--version"], { encoding: "utf8" }).status === 0
const LOG_TEXT = "first log line\nsecond log line\n"

interface Fixture {
  root: string
  data: string
  snapshot: string
  log: string
  rotated: string
  db: string
  env: NodeJS.ProcessEnv
}

/**
 * A temporary data directory with two snapshot entries, a log with content,
 * untouched sentinels for the directories the script must never touch, and a
 * real SQLite database when sqlite3 is available.
 *
 * `pgrepExit` and `fuserExit` stub the two process checks on PATH: 1 means no
 * opencode is running, 0 means one is. The stubs are required because this test
 * suite usually runs inside an opencode process, which the real guard would
 * correctly refuse. fuser defaults to the same answer as pgrep so each fixture
 * has one clear process state.
 */
function makeFixture(
  { pgrepExit = 1, fuserExit = pgrepExit }: { pgrepExit?: 0 | 1; fuserExit?: 0 | 1 } = {},
): Fixture {
  const root = mkdtempSync(join(TMP_ROOT, "opencode-memory-test-"))
  const data = join(root, "data")
  const snapshot = join(data, "snapshot")
  const log = join(data, "log", "opencode.log")

  mkdirSync(snapshot, { recursive: true })
  mkdirSync(join(data, "log"), { recursive: true })
  writeFileSync(join(snapshot, "a"), "snapshot a\n")
  mkdirSync(join(snapshot, "b"))
  writeFileSync(join(snapshot, "b", "nested"), "snapshot b\n")
  writeFileSync(log, LOG_TEXT)

  for (const name of ["tool-output", "repos", "shell"]) {
    mkdirSync(join(data, name), { recursive: true })
    writeFileSync(join(data, name, "keep"), `${name}\n`)
  }

  const db = join(data, "opencode.db")
  if (HAS_SQLITE) {
    const created = spawnSync(
      "sqlite3",
      [
        db,
        "PRAGMA journal_mode=WAL; " +
          "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT); " +
          "INSERT INTO notes (body) VALUES ('alpha'), ('beta'); " +
          "DELETE FROM notes WHERE id = 2;",
      ],
      { encoding: "utf8" },
    )
    assert.equal(created.status, 0, created.stderr)
  } else {
    // The dry run and --apply never open the database; only the vacuum tests
    // need a real one, and those are skipped without sqlite3.
    writeFileSync(db, "not a sqlite database\n")
  }

  const bin = join(root, "bin")
  mkdirSync(bin)
  const pgrep = join(bin, "pgrep")
  writeFileSync(pgrep, `#!/bin/sh\nexit ${pgrepExit}\n`)
  chmodSync(pgrep, 0o755)
  const fuser = join(bin, "fuser")
  writeFileSync(fuser, `#!/bin/sh\nexit ${fuserExit}\n`)
  chmodSync(fuser, 0o755)

  return {
    root,
    data,
    snapshot,
    log,
    rotated: `${log}.1`,
    db,
    env: {
      ...process.env,
      OPENCODE_DATA_DIR: data,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
    },
  }
}

function run(fixture: Fixture, args: string[]) {
  return spawnSync("bash", [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    env: fixture.env,
    encoding: "utf8",
  })
}

function backups(fixture: Fixture): string[] {
  return readdirSync(fixture.data).filter((name) => {
    if (!name.startsWith("opencode.db.bak-")) return false
    return lstatSync(join(fixture.data, name)).isFile()
  })
}

function sqliteQuery(db: string, sql: string): string {
  const result = spawnSync("sqlite3", [db, sql], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function assertSentinels(fixture: Fixture): void {
  for (const name of ["tool-output", "repos", "shell"]) {
    assert.equal(
      readFileSync(join(fixture.data, name, "keep"), "utf8"),
      `${name}\n`,
      `${name}/ must be left alone`,
    )
  }
}

test("the default run reports sizes and changes nothing", () => {
  const fixture = makeFixture()
  try {
    const dbBefore = readFileSync(fixture.db)
    const result = run(fixture, [])

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /OpenCode data directory:/)
    assert.ok(result.stdout.includes(fixture.data), "output names the data directory")
    assert.match(result.stdout, /opencode\.db\s+[0-9.]+ (KiB|MiB|GiB)/)
    assert.match(result.stdout, /opencode\.db-wal\s+[0-9.]+ (KiB|MiB|GiB)/)
    assert.match(result.stdout, /log\/opencode\.log\s+[0-9.]+ (KiB|MiB|GiB)/)
    assert.match(result.stdout, /snapshot\/\s+.*entries/)
    assert.match(result.stdout, /No files were changed \(dry run\)/)
    assert.match(result.stdout, /--apply would:/)
    assert.match(result.stdout, /--vacuum would:/)

    assert.deepEqual(readFileSync(fixture.db), dbBefore)
    assert.equal(readFileSync(fixture.log, "utf8"), LOG_TEXT)
    assert.deepEqual(readdirSync(fixture.snapshot).sort(), ["a", "b"])
    assert.equal(existsSync(fixture.rotated), false)
    assert.deepEqual(backups(fixture), [])
    assertSentinels(fixture)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("the dry run still reports while an opencode process is running", () => {
  const fixture = makeFixture({ pgrepExit: 0 })
  try {
    const result = run(fixture, [])

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /No files were changed \(dry run\)/)
    assert.match(result.stdout, /--apply would:/)
    assert.deepEqual(readdirSync(fixture.snapshot).sort(), ["a", "b"])
    assert.equal(readFileSync(fixture.log, "utf8"), LOG_TEXT)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("--apply prunes snapshots, rotates the log, and is idempotent", () => {
  const fixture = makeFixture()
  try {
    const dbBefore = readFileSync(fixture.db)
    const first = run(fixture, ["--apply"])

    assert.equal(first.status, 0, first.stderr)
    assert.deepEqual(readdirSync(fixture.snapshot), [])
    assert.equal(statSync(fixture.log).size, 0)
    assert.equal(readFileSync(fixture.rotated, "utf8"), LOG_TEXT)
    assert.deepEqual(readFileSync(fixture.db), dbBefore, "the database must not change")
    assertSentinels(fixture)

    const second = run(fixture, ["--apply"])

    assert.equal(second.status, 0, second.stderr)
    assert.match(second.stdout, /snapshot\/: already empty/)
    assert.match(second.stdout, /already empty; not rotated/)
    assert.equal(statSync(fixture.log).size, 0)
    assert.equal(
      readFileSync(fixture.rotated, "utf8"),
      LOG_TEXT,
      "a second run must not replace the rotated log with the empty live log",
    )
    assert.deepEqual(readFileSync(fixture.db), dbBefore)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("--apply refuses while an opencode process is running", () => {
  const fixture = makeFixture({ pgrepExit: 0 })
  try {
    const dbBefore = readFileSync(fixture.db)
    const result = run(fixture, ["--apply"])

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /stop OpenCode first/)
    assert.match(result.stderr, /holds the log descriptor and snapshots are revert points/)
    assert.deepEqual(readdirSync(fixture.snapshot).sort(), ["a", "b"])
    assert.equal(readFileSync(fixture.log, "utf8"), LOG_TEXT)
    assert.equal(existsSync(fixture.rotated), false)
    assert.deepEqual(readFileSync(fixture.db), dbBefore)
    assert.deepEqual(backups(fixture), [])
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("--apply still runs when no process holds the database", () => {
  const fixture = makeFixture({ pgrepExit: 0, fuserExit: 1 })
  try {
    const result = run(fixture, ["--apply"])

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(readdirSync(fixture.snapshot), [])
    assert.equal(statSync(fixture.log).size, 0)
    assert.equal(readFileSync(fixture.rotated, "utf8"), LOG_TEXT)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("--vacuum without --yes refuses before changing anything", () => {
  const fixture = makeFixture()
  try {
    const result = run(fixture, ["--vacuum"])

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /refusing --vacuum without --yes/)
    assert.deepEqual(backups(fixture), [])
    assert.equal(readFileSync(fixture.log, "utf8"), LOG_TEXT)
    assert.deepEqual(readdirSync(fixture.snapshot).sort(), ["a", "b"])
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("--vacuum refuses while an opencode process is running", () => {
  const fixture = makeFixture({ pgrepExit: 0 })
  try {
    const result = run(fixture, ["--vacuum", "--apply", "--yes"])

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /opencode process is running/)
    assert.deepEqual(backups(fixture), [])
    assert.equal(readFileSync(fixture.log, "utf8"), LOG_TEXT)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test(
  "--vacuum --apply --yes backs up the database, compacts it, and rotates the log",
  { skip: HAS_SQLITE ? false : "sqlite3 is not installed" },
  () => {
    const fixture = makeFixture()
    try {
      // Keep the committed row in the WAL instead of letting the closing
      // connection checkpoint it into the main file. A raw copy of
      // opencode.db alone would then miss the row; SQLite's .backup must not.
      const inserted = spawnSync(
        "sqlite3",
        [
          fixture.db,
          ".dbconfig no_ckpt_on_close on",
          "INSERT INTO notes (body) VALUES ('gamma');",
        ],
        { encoding: "utf8" },
      )
      assert.equal(inserted.status, 0, inserted.stderr)
      const wal = `${fixture.db}-wal`
      assert.ok(existsSync(wal), "the fixture must leave a WAL file behind")
      assert.ok(statSync(wal).size > 0, "the committed row must live in the WAL")

      const result = run(fixture, ["--vacuum", "--apply", "--yes"])

      assert.equal(result.status, 0, result.stderr)

      const names = backups(fixture)
      assert.equal(names.length, 1, "exactly one backup must be written")
      assert.match(names[0], /^opencode\.db\.bak-\d{14}\.[A-Za-z0-9]{6}$/)

      const backupPath = join(fixture.data, names[0])
      const backupInfo = lstatSync(backupPath)
      assert.equal(backupInfo.isFile(), true, "the backup must be a regular file")
      assert.equal(backupInfo.isSymbolicLink(), false, "the backup must not be a symlink")
      assert.equal(backupInfo.mode & 0o777, 0o600, "the backup must be mode 600")
      assert.ok(backupInfo.size > 0, "the backup must not be empty")
      assert.match(
        result.stdout,
        /Backup written to .*opencode\.db\.bak-\d{14}\.[A-Za-z0-9]{6}/,
      )
      assert.match(result.stdout, /Database before:/)
      assert.match(result.stdout, /Database after:/)

      assert.equal(sqliteQuery(backupPath, "PRAGMA integrity_check;"), "ok")
      const sourceRows = sqliteQuery(fixture.db, "SELECT count(*) FROM notes;")
      const backupRows = sqliteQuery(backupPath, "SELECT count(*) FROM notes;")
      assert.equal(sourceRows, "2", "the source must keep both committed rows")
      assert.equal(backupRows, sourceRows, "the backup must hold every committed row")
      assert.equal(sqliteQuery(fixture.db, "PRAGMA integrity_check;"), "ok")

      assert.deepEqual(readdirSync(fixture.snapshot), [])
      assert.equal(statSync(fixture.log).size, 0)
      assert.equal(readFileSync(fixture.rotated, "utf8"), LOG_TEXT)
      assert.ok(existsSync(backupPath), "the backup must still exist after the vacuum")
      assert.equal(existsSync(fixture.db), true, "the database must never be deleted")
      assertSentinels(fixture)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  },
)

test(
  "a pre-created symlink at the predictable backup name is never followed",
  { skip: HAS_SQLITE ? false : "sqlite3 is not installed" },
  () => {
    const fixture = makeFixture()
    try {
      const stamp = spawnSync("date", ["+%Y%m%d%H%M%S"], { encoding: "utf8" })
      assert.equal(stamp.status, 0, stamp.stderr)
      const predictable = join(fixture.data, `opencode.db.bak-${stamp.stdout.trim()}`)
      const victim = join(fixture.root, "victim.db")
      // Dangling on purpose: the old `[ -e ]` guard treated this as absent,
      // and .backup then created the victim through the link.
      symlinkSync(victim, predictable)
      assert.equal(lstatSync(predictable).isSymbolicLink(), true)

      const result = run(fixture, ["--vacuum", "--apply", "--yes"])

      assert.equal(result.status, 0, result.stderr)
      assert.equal(existsSync(victim), false, "the backup must never be written through a symlink")
      assert.equal(lstatSync(predictable).isSymbolicLink(), true, "the symlink must be left alone")

      const names = backups(fixture)
      assert.equal(names.length, 1, "exactly one regular backup must be written")
      const backupPath = join(fixture.data, names[0])
      const backupInfo = lstatSync(backupPath)
      assert.equal(backupInfo.isFile(), true)
      assert.equal(backupInfo.isSymbolicLink(), false)
      assert.equal(backupInfo.mode & 0o777, 0o600)
      assert.equal(sqliteQuery(backupPath, "PRAGMA integrity_check;"), "ok")
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  },
)

test(
  "a failed SQLite .backup removes the partial backup",
  { skip: HAS_SQLITE ? false : "sqlite3 is not installed" },
  () => {
    const fixture = makeFixture()
    try {
      writeFileSync(fixture.db, "not a sqlite database\n")
      const result = run(fixture, ["--vacuum", "--apply", "--yes"])

      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /SQLite \.backup failed/)
      assert.deepEqual(backups(fixture), [], "no partial backup may be left behind")
      assert.equal(existsSync(fixture.db), true)
      assert.equal(statSync(fixture.log).size, 0, "cleanup happened before the backup")
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  },
)

test(
  "an unreadable snapshot directory fails instead of reporting zero",
  { skip: process.getuid?.() === 0 ? "root can read a mode 000 directory" : false },
  () => {
    const fixture = makeFixture()
    try {
      chmodSync(fixture.snapshot, 0o000)
      const result = run(fixture, [])

      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /error: cannot measure .*snapshot/)
      assert.match(result.stderr, /Permission denied/)
      assert.doesNotMatch(result.stdout, /No files were changed/)
    } finally {
      chmodSync(fixture.snapshot, 0o700)
      rmSync(fixture.root, { recursive: true, force: true })
    }
  },
)

test("--help exits 0 and writes nothing", () => {
  const fixture = makeFixture()
  try {
    const dbBefore = readFileSync(fixture.db)
    const result = run(fixture, ["--help"])

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage: opencode-memory\.sh/)
    assert.match(result.stdout, /Requires no running opencode process/)
    assert.match(result.stdout, /opencode\.db\.bak-<YYYYmmddHHMMSS>\.XXXXXX \(mode\s+600\)/)
    assert.match(result.stdout, /falls back to pgrep -x opencode/)
    assert.deepEqual(readFileSync(fixture.db), dbBefore)
    assert.equal(readFileSync(fixture.log, "utf8"), LOG_TEXT)
    assert.deepEqual(readdirSync(fixture.snapshot).sort(), ["a", "b"])
    assert.equal(existsSync(fixture.rotated), false)
    assert.deepEqual(backups(fixture), [])
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("an unknown flag exits 2 with usage", () => {
  const fixture = makeFixture()
  try {
    const result = run(fixture, ["--bogus"])

    assert.equal(result.status, 2)
    assert.match(result.stderr, /unknown option: --bogus/)
    assert.match(result.stderr, /Usage: opencode-memory\.sh/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})
