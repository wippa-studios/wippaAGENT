/**
 * The subset of a session record the continuation lookup needs. It is a
 * structural type rather than an import of the client's `SessionInfo`, so the
 * helper stays pure and a test can build records without the service.
 */
export interface ChildSession {
  id: string
  parentID?: string
  agent?: string
  time: {
    created: number
    updated: number
    archived?: number
  }
}

/**
 * The most recently updated child session of `agent` whose parent is
 * `parentID`, or undefined when there is none.
 *
 * Archived sessions are ignored even though the caller asks the service not
 * to return them: the list filter is a request, not a guarantee, and the
 * lookup must never resume a session the user archived. Ties break on the
 * later creation time and then on the lexicographically smaller id, so the
 * choice is deterministic rather than dependent on list order.
 */
export function latestChildSession<S extends ChildSession>(
  sessions: readonly S[],
  agent: string,
  parentID: string,
): S | undefined {
  let latest: S | undefined
  for (const session of sessions) {
    if (session.parentID !== parentID) continue
    if (session.agent !== agent) continue
    if (session.time.archived !== undefined) continue
    if (latest === undefined || isNewer(session, latest)) latest = session
  }
  return latest
}

function isNewer(candidate: ChildSession, current: ChildSession): boolean {
  if (candidate.time.updated !== current.time.updated) {
    return candidate.time.updated > current.time.updated
  }
  if (candidate.time.created !== current.time.created) {
    return candidate.time.created > current.time.created
  }
  return candidate.id < current.id
}
