# Deciding the shape of the thing

- Start with the simplest shape that satisfies the requirement: one deployable unit, one database, synchronous calls.
- Split a service when a specific pressure justifies it: an independent release cadence, an independent scaling profile, a team boundary, or a data ownership requirement. Not because a diagram looked cleaner.
- Do not begin with a microservice and work backwards. A monolith with a clean module boundary is a monolith you can split later, and a distributed system you cannot un-distribute.
- Keep the module boundary inside the process as long as you can. In-process calls are easier to refactor than network calls.
- Choose synchronous or asynchronous per interaction. If the caller does not need the answer to proceed, the answer does not need to be a request-response.
- Put the transaction boundary where the consistency boundary is. If two writes must succeed or fail together, they belong in the same store.
- Reserve a place for asynchronous side effects. A write that also sends an email, updates a search index, and calls a partner is three things, and only the first is part of the transaction.
- Prefer a monolith plus a worker over a service plus a queue when the split buys no operational independence.
- Reconsider the shape when the signals arrive: a release train that blocks everyone, a database that cannot be scaled to the hottest tenant, a team that cannot deploy independently.
