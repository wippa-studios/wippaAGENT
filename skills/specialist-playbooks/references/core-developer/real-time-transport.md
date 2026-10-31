# Real-time transport

- Choose the transport deliberately. WebSocket for bidirectional low-latency, Server-Sent Events for one-way server push over plain HTTP.
- Put the connection behind an authenticating upgrade, not behind an anonymous socket that authenticates later.
- Design the client as a state machine with explicit reconnect, backoff, and offline states. A socket library that reconnects without your knowledge will hide the failure.
- Queue outbound messages while disconnected and flush in order on reconnect, or document that the client tolerates loss.
- Use a broker for cross-node fan-out so any node can serve any connection. In-memory pub/sub only works at one node.
- Drain connections during deploys. Send a reconnect notice, let clients back off, then close.
- Cap message size and rate per connection. A real-time channel is a public endpoint.
- Track connection count, message rate, queue depth, and disconnects as first-class metrics.
- Decide where ordering is required and where it is not, then only enforce it where it is. Global ordering across every topic is expensive and usually unnecessary.
- For presence, treat it as a lease with a heartbeat and an expiry, because a client that vanishes without closing is the normal case, not the exception.
