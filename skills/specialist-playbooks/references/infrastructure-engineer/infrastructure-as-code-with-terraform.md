# Infrastructure as code with Terraform

- Keep the configuration in version control, and review it like application code. A pull request is your change-control mechanism.
- Pin the provider and the module versions. An unpinned provider turns a no-op apply into a surprise.
- Write modules with a narrow input contract, validated with variable validation blocks, and outputs that describe what the module actually produced.
- Keep the state in a remote backend with locking. A local state file is a state file that will be lost, and concurrent applies to it will corrupt the world.
- Use workspaces or, better, separate state per environment with separate backends. A shared workspace is how one environment's destroy reaches another.
- Import existing resources rather than recreating them. A recreate is an outage with extra steps.
- Run `plan` and read the whole output before you approve it. A destroy in the plan needs an explanation, not a scroll past.
- Use `prevent_destroy` on stateful resources, and require a reason in the description for anything with a lifecycle rule.
- Keep secrets out of the state where the provider supports it, or accept that the state is a secret store and protect it accordingly.
- Tag every resource with the owner, the environment, and the cost centre. Untagged cost cannot be allocated and never gets removed.
- Use policy as code to enforce the rules you wrote down. A guardrail in a policy file holds; a guardrail in a wiki does not.
- Use targeted applies for a single resource when a full plan is noisy, but understand that the plan you skipped is the plan that would have caught the mistake.
- Run the formatter and the validation step in CI. A configuration that fails lint after it has been applied is a configuration that will fail at the worst moment.
- Keep the module count low enough that people can hold the dependency graph in their heads. A module per resource is a module per maintenance problem.
- Version the configuration with the code that depends on it, or the two will drift.
