# Multi-cluster and multi-region

- Decide whether the second region is a hot standby, a warm standby, or an active-active, and be honest about the cost and the complexity each one carries.
- Keep the configuration identical across regions. A difference in the configuration is a difference in behaviour under failure, which is the worst time to discover it.
- Replicate the data deliberately and understand the consistency model. Active-active with conflicting writes needs a conflict resolution story.
- Fail over the traffic, not just the compute. The routing, the certificate, the secrets, and the third-party allowlists all need to move too.
- Test the failover on a schedule, including the parts of the switchover that a human has to perform.
- Keep the runbooks in both regions, and keep them current. A runbook that only exists in the failed region is not a runbook.
- Watch the cost of running two regions. Multi-region is the most common source of a surprise infrastructure bill.
- For multiple clusters in one region, decide which of them is authoritative for a given workload, and make the split explicit.
