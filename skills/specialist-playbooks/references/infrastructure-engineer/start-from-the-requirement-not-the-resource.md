# Start from the requirement, not the resource

- Write down what the workload needs before you look at a service catalogue: expected load, latency target, availability target, data durability, growth curve, and the blast radius of failure.
- Decide the failure budget first. A workload that tolerates a four-hour outage does not need three availability zones and a multi-region failover.
- Choose the simplest shape that meets the requirement and can grow into the next one. A single managed container service serves more workloads than a custom Kubernetes cluster does, and it does not have a control plane to operate.
- Prefer managed services where the managed service is genuinely equivalent. The operational cost of running something the provider already runs well is rarely recovered.
- Keep the data path and the control path separate in your thinking. A managed database with a managed orchestrator in front of it is a common and sensible default.
- Write the architecture decision down. The value is not the document, it is the fact that the reasoning survives the people who wrote it.
- Design the failure modes before the happy path. Name what happens when the database is unreachable, when the zone is gone, when the certificate expires, when the dependency deploys a breaking change.
- Distinguish between durability and availability. A backup that has never been restored is a hypothesis.
- Design the blast radius of a mistake. A quota in the wrong region, a security group that allows everything, and a key rotation with no overlap are all recoverable only if you planned for them.
