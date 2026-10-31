# The legacy and hybrid estate

- Inventory what is running and who owns it. An estate that nobody has surveyed is an estate nobody can safely change.
- Classify each system: keep, refactor, wrap, or retire. A system with no classification is a system that stays forever.
- Prefer a strangler approach. Put a new edge in front of the old system, move the traffic gradually, and leave the old path available until the new one is proven.
- Use branch by abstraction when you cannot put an edge in front. Introduce an interface over the old implementation, migrate the callers, then replace the implementation behind the interface.
- Intercept the traffic rather than rewriting the legacy code. A thin proxy that translates a modern request into a legacy call is often cheaper than a rewrite.
- Modernise the parts with the highest pain and the lowest risk first, not the oldest code.
- Keep the legacy platform alive and secure while the new one is built. An unpatched legacy system is the thing that actually gets exploited.
- Move the data last, or move it continuously. A big-bang data migration is where legacy modernisations fail.
- Budget for the double-running period in both cost and complexity, and set the end date before you start.
- Keep the knowledge about the legacy system in the repository rather than in one person's head, and pair that person with whoever will own it next.
