# Webhooks in both directions

For consuming:

- Verify the signature against the raw request body before parsing. A framework that parses first cannot verify correctly.
- Compare signatures in constant time.
- Enforce a timestamp freshness window so a captured request cannot be replayed later.
- Accept more than one valid secret during a rotation window, then remove the old one.
- Assume at-least-once delivery. Persist the event identifier, deduplicate with a TTL that covers the provider's retry window, and make the handler idempotent so a replay converges on the same state.
- Persist or enqueue the event durably before returning a success status, then process asynchronously. Acknowledge quickly, work later.
- Treat out-of-order arrival as normal. Use sequence numbers or timestamps to discard stale updates, and make state transitions reject invalid moves.
- Route failures into a dead-letter queue with a replay path for operators. Never drop an event silently.
- Record unknown event types with safe metadata and leave them observable, discarding them only under an explicit written policy.

For producing:

- Design the event payload for stability, and version it. Additive change is not breaking; a removed field is.
- Sign the payload per subscriber, with per-subscriber secrets so one rotation does not disturb the others.
- Block internal address ranges, link-local metadata endpoints, and non-HTTPS targets on outbound delivery. A subscriber controls that URL, which makes it an SSRF primitive.
- Do not follow redirects on outbound delivery, or constrain them tightly, and resolve the hostname once so a rebinding attack cannot swap the target between check and send.
- Set timeouts and response size limits on delivery attempts. A slow subscriber must not hold a delivery worker.
- Track delivery state per subscriber with exponential backoff and jitter, disable persistently failing endpoints automatically, and expose a delivery history the subscriber can read.
- Minimise the payload. A webhook that carries personal data inherits the compliance obligations of the system that stores it.
