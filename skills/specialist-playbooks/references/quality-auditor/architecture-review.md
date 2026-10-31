# Architecture review

- Read the design for intent, then read the code for the gap between the design and what exists.
- Check the boundaries: whether the components are cohesive, whether the coupling is explicit, and whether the module could be replaced without a rewrite of its neighbours.
- Check the data flow, end to end, including the paths that are only taken on failure.
- Check the contracts: whether the interfaces are stable, whether the errors are part of the contract, and whether the versioning story holds.
- Check the scalability against the stated requirement rather than against an imagined one. Horizontal and vertical scaling, the partitioning, the load distribution, the caching, the database limits, and the queue depth all have ceilings.
- Check the technology choices for maturity, the team's ability to operate them, the licensing, the cost, and the migration path if the choice turns out to be wrong.
- Flag the security architecture questions: the authentication design, the authorisation model, the encryption, the network boundaries, the secret handling, the audit trail, and the compliance obligations. Route them to `security-reviewer`. You judge the structure; they judge the controls.
- Check the evolvability: can this change be reversed, can a component be extracted later, and does the design assume a scale that may never arrive.
- Report the debt honestly. Unbounded growth, a missing abstraction, and a duplicated mechanism are findings with a cost, even when the code works today.
- Separate the blocking problems from the ones worth discussing. A review that mixes them gets the blocking problems ignored.
