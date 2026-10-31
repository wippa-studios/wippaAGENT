# Monorepo and workspace management

- Put the workspace definition in the root and make the package boundaries explicit. A workspace with an implicit glob will pick up a directory that was not meant to be a package.
- Hoist the shared dependencies to the root so there is one copy of each. Two copies of the same library in one tree produce subtle type and runtime mismatches.
- Use the workspace protocol or the local path reference for the internal packages, so a change to a shared package is picked up without a publish.
- Make the build order explicit. A build that relies on the dependency order being discovered by the file system will break when a package is added.
- Cache the toolchain per package, and share the download cache across the whole workspace.
- Run the affected packages only, based on the dependency graph, so a change to one leaf does not rebuild the world.
- Make the lint, the type check, and the test runnable for one package and for the whole workspace, with the same semantics.
- Version the internal packages together by default, and split the versions only when a package has an independent release rhythm.
- Keep the release order automated, with the dependency graph driving the publication order.
- Watch the whole-workspace type check time. A monorepo that takes a minute to type check is a monorepo where people skip the check.
- Keep a single version of each major tool across the workspace, since a mixed set of tool versions produces inconsistent output.
- Put the shared configuration in one place and extend it in each package, so a change to the base reaches everything without a rewrite.
