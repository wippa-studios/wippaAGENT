# Kubernetes

- Design the cluster for the workload: node pools, availability zones, instance types, and the autoscaling boundaries.
- Set requests and limits on every container. Without requests the scheduler is guessing, and without limits one pod can starve the node.
- Use a horizontal pod autoscaler on a metric that reflects load, not a metric that is easy to scrape.
- Use a pod disruption budget so a node drain does not take out a whole service. A budget that allows zero voluntary disruptions can block maintenance forever.
- Use readiness and liveness probes with different purposes. Readiness controls traffic, liveness controls restarts, and a liveness probe that fails under load will restart a healthy service.
- Make startup slow paths tolerant. A liveness probe with a short initial delay will kill a service that is still warming up.
- Use rolling updates with a max surge and max unavailable chosen so the service keeps capacity during the rollout.
- Keep the namespace as a boundary for quotas, limits, and policy. A flat namespace with no quotas is a flat namespace with one loud team.
- Apply pod security standards and an admission controller for anything the policy engine should refuse.
- Use network policies to make the default deny explicit. Without a default deny, a network policy that allows one path allows every path it does not mention.
- Keep secrets in an external store and mount them, rather than baking them into the image or committing them.
- Use a service mesh only when the operational cost is worth what it gives you. A mesh adds a control plane, a sidecar, and a failure domain.
- Configure the ingress with TLS termination, a rate limit, and a request body size limit.
- Set up the metrics, the log aggregation, and the trace collection as part of the platform, not as a later project.
- Use read-only root filesystems, dropped capabilities, and a non-root user as the default in the pod security context.
- Test the disruption. Drain a node in a staging environment and see what the service does.
