# GitOps and drift

- Keep the desired state in a repository and let a controller converge the live environment onto it.
- Use pull requests as the change mechanism, with the controller reading the merged state.
- Enable drift detection and alert on it, because silent drift is how an environment stops matching the code that built it.
- Use a sync mechanism that is explicit about who can write to the cluster. A controller with cluster-wide write access to every namespace is a controller that can break everything.
- Scope the credentials per repository and per namespace, with a short lifetime.
- Keep the repository structure predictable: one path per environment, one path per component.
- Use progressive sync for a rollout, with the same analysis and the same automatic rollback as a canary deploy.
- Understand what the controller does when a manual change is made. If it reverts it, that is a feature. If it merges it, that is a hole in the audit trail.
- Keep the GitOps repository and the application repository separate, so a change to the app does not need a change to the infrastructure.
