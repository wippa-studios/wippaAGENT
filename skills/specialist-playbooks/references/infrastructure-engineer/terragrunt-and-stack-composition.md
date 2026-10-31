# Terragrunt and stack composition

- Use Terragrunt to remove the duplication that a multi-environment Terraform layout always accumulates, not to add a second layer of magic.
- Organise the repository as live stacks by unit, with one directory per deployable unit and a shared root configuration.
- Use `find_in_parent_folders` with a single root that holds the provider, the backend, and the tags. Each unit then declares only what makes it different.
- Use the `include` block with exposed values so the root configuration is the single source of environment-specific values.
- Use the `dependency` block to express real cross-stack ordering. A dependency that exists only in the plan is a dependency that will be wrong at apply time.
- Supply mock outputs for a dependency that does not exist yet. Terragrunt can plan against a mocked output, and that keeps a new stack from blocking the whole plan.
- Watch for circular dependencies. They are almost always a sign that the split is at the wrong boundary.
- Use `generate` blocks for the values a provider needs before the stack is initialised, such as a generated backend configuration.
- Use the `errors` block with a retry for transient provider failures and an ignore for a known-not-found condition, and keep the patterns narrow.
- Use `exclude` blocks to scope a unit to a subset of resources, and understand that an exclude silently drops a resource from management.
- Put the state backend in the `remote_state` block with an `init` that creates it, and keep encryption and locking on.
- Run the plan per unit in the dependency order, and re-plan dependents after a change upstream. A stale dependent plan is the classic Terragrunt failure.
- Keep the stack boundaries aligned with the deployable unit. A stack that is split across several services is a stack that always deploys together.
