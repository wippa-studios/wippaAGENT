import assert from "node:assert/strict"
import { test } from "node:test"

import { latestChildSession, type ChildSession } from "./continuation.ts"

const PARENT = "ses_parent"
const AGENT = "core-developer"

function session(
  id: string,
  updated: number,
  options: { created?: number; parentID?: string; agent?: string; archived?: number } = {},
): ChildSession {
  return {
    id,
    parentID: options.parentID ?? PARENT,
    agent: options.agent ?? AGENT,
    time: {
      created: options.created ?? updated,
      updated,
      ...(options.archived === undefined ? {} : { archived: options.archived }),
    },
  }
}

test("latestChildSession returns the greatest updated time regardless of list order", () => {
  const older = session("ses_older", 100)
  const newest = session("ses_newest", 300)
  const middle = session("ses_middle", 200)

  assert.equal(latestChildSession([middle, older, newest], AGENT, PARENT), newest)
  assert.equal(latestChildSession([], AGENT, PARENT), undefined, "an empty list has no child")
})

test("latestChildSession breaks an updated tie by created time, then by id", () => {
  const laterCreated = session("ses_later-created", 500, { created: 400 })
  const earlierCreated = session("ses_earlier-created", 500, { created: 300 })
  assert.equal(
    latestChildSession([earlierCreated, laterCreated], AGENT, PARENT),
    laterCreated,
  )

  // With both timestamps equal the smaller id wins, so a list that arrives in
  // a different order still resolves to the same session.
  const a = session("ses_a", 500, { created: 400 })
  const b = session("ses_b", 500, { created: 400 })
  assert.equal(latestChildSession([b, a], AGENT, PARENT), a)
  assert.equal(latestChildSession([a, b], AGENT, PARENT), a)
})

test("latestChildSession ignores an archived session even when it is the newest", () => {
  const archived = session("ses_archived", 900, { archived: 1 })
  const live = session("ses_live", 100)

  assert.equal(latestChildSession([archived, live], AGENT, PARENT), live)
  assert.equal(latestChildSession([archived], AGENT, PARENT), undefined)
})

test("latestChildSession ignores a child of a different parent", () => {
  const unrelated = session("ses_unrelated", 900, { parentID: "ses_other" })
  const child = session("ses_child", 100)

  assert.equal(latestChildSession([unrelated, child], AGENT, PARENT), child)
  assert.equal(latestChildSession([unrelated], AGENT, PARENT), undefined)
})

test("latestChildSession ignores a child of a different agent", () => {
  const otherAgent = session("ses_other-agent", 900, { agent: "debugger" })
  const child = session("ses_child", 100)

  assert.equal(latestChildSession([otherAgent, child], AGENT, PARENT), child)
  assert.equal(latestChildSession([otherAgent], AGENT, PARENT), undefined)
})
