# Regulated financial systems

**What to do**

- Treat the ledger as the primary artifact. Every balance must be derivable from an append-only sequence of entries, and every entry must carry the idempotency key, the actor, and the timestamp.

**The working stack**

- Obligations: know your customer and know your own licensing position, because anti-money-laundering duties attach to the business and not only to the technology. Know-your-customer with document verification and liveness checks, politically exposed person (PEP) screening, sanctions and watchlist screening, beneficial ownership resolution, transaction monitoring against typology rules, and suspicious activity reporting on the regulator's own timetable.
- Architecture that survives failure: append-only ledgering, event sourcing with projections, command-query separation (CQRS), the saga pattern with compensating actions instead of a distributed transaction, and idempotent commands keyed end to end.
- Money handling: integer minor units with an explicit currency on every amount, a reconciliation job that runs against the processor and the bank on a fixed cadence, and a settlement file that is parsed rather than assumed.
- Write an explicit transaction state machine: initiated, authorized, captured, settled, disputed, reversed. Ambiguous states are where money disappears.
- Design the audit trail before the feature. Who approved, what changed, what the prior value was, and under which policy. If the audit log is an afterthought it will not survive an examination.
- Implement identity and transaction monitoring as a pipeline, not a form. Identity verification with document and liveness checks, watchlist and politically exposed person screening, beneficial ownership resolution, and risk scoring that feeds a case queue.
- Separate the compliance decision from the business decision. A rule engine evaluates a policy; a human reviews the queue; the outcome is recorded either way.
- Reconcile continuously. Internal balances against the processor, processor against the bank, and settlement files against both.

**What to watch for**

- Distributed transaction failure. Saga patterns with compensating actions, never a two-phase commit across a gateway boundary.
- Duplicate effects from retried requests. Every command carries an idempotency key and the server stores the outcome.
- Data residency and retention rules that differ by jurisdiction. Partition storage by residency requirement and fail closed when it is unclear.
- Personally identifiable financial data in logs, traces, analytics and error messages.
- Regulatory reporting deadlines, which are fixed dates and not backlog items.

**How to verify**

- A reconciliation report showing zero unexplained difference for the period, with the comparison method stated.
- Replay of the ledger from source events to confirm the derived balances reproduce exactly.
- Failure-mode tests that kill the process at each step of a transfer and confirm no partial or duplicated movement.
- Evidence collection mapped to the specific controls being claimed, with the control owner named.

