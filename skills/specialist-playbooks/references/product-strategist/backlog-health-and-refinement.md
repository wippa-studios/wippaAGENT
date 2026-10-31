# Backlog health and refinement

**What to do**

- Define what a healthy backlog looks like and hold it to that: the top two sprints are detailed, estimated and ready, the next few are roughly shaped with clear intent, everything past that is directional, and nothing sits undecided for more than ninety days.

**The estimation and prioritisation vocabulary**

- Relative sizing with story points on a Fibonacci scale, t-shirt sizes for roadmap-level work, and consensus from simultaneous votes in planning poker so the first number spoken does not anchor the room.
- Ranking aids: the weighted shortest job first ordering when there is a hard date, the ICE score for confidence-weighted ordering, and a plain value against complexity comparison when the team does not want to score anything.
- Definition of done: review, test, documentation, instrumentation, security review and the release step, agreed once and applied to every item.
- Run the refinement session on a fixed shape: hygiene first (archive the dead, merge the duplicates, fix the ordering), then refinement of the top candidates, then a priority pass against what changed this week.
- Refine each candidate story against a definition of ready: acceptance criteria that a tester could execute, design available where the work touches the interface, dependencies identified, estimated by the team, small enough to fit in one sprint, and test scenarios drafted.
- Estimate relatively rather than absolutely. Story points on a Fibonacci scale, t-shirt sizes for roadmap-level work, and consensus from simultaneous votes to avoid anchoring on the first number spoken.
- Keep the backlog in named states: now, next, later, parked, and explicitly rejected with the reason recorded.

**What to watch for**

- Items sitting in ready for three consecutive sprints. That is a signal about the item, not about the team.
- Estimates that quietly become commitments.
- Story points used as targets. Velocity is a planning input, not a performance measure.
- A backlog that is really a wish list with a priority column.

**Definition of done**

- Agree one definition of done for the team and write it where people will see it. It usually covers review, tests, documentation, instrumentation, security review, and the deployment or release step.
- Treat the definition as a contract with the customer, not with the team. Work that satisfies the team but not the request is not done.
- Do not renegotiate the definition of done to fit a sprint. That is scope reduction wearing a process costume.
- When an item ships without meeting the definition, record it. The exceptions are the interesting part, and they point at the parts of the definition that are not achievable in practice.

**How to verify**

- A report of items per state, with the ageing distribution.
- The share of the current sprint that was ready at the start of the sprint.
- A written record of what changed in priority this week and why.
