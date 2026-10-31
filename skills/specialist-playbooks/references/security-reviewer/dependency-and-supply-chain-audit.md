# Dependency and supply-chain audit

- Inventory the direct and transitive dependencies, and identify which of them actually run in production rather than only in the build or the test tooling.
- Match the version of each dependency against the advisory database and record the finding. A dependency that is unused but present still widens the supply chain.
- Check the maintenance signals: the release cadence, the open issue backlog, the number of maintainers, and the security policy. A single-maintainer dependency on a critical path is a continuity risk.
- Check for the dependency-confusion pattern, where a package name resolves to an unexpected source, and confirm the registry and the scope rules in the manifest.
- Check the lock file is committed and that the resolved versions are the ones the pipeline installs. An unpinned transitive dependency is a supply-chain hole.
- Look for a package that duplicates the functionality of one already in the tree, and for two packages that pull different major versions of the same library.
- Review the install scripts. A dependency that executes code at install time runs with the developer's privileges.
- Generate a software bill of materials and keep it in the release artefacts, so a consumer can answer what was inside the thing they were given.
- Scan the container images for operating system packages as well as application dependencies. A base image carries a large set of packages that nobody chose.
- Check the licence obligations for every dependency and for the distribution as a whole.
- Verify the provenance of the published artefacts, and check the signature where the build produces one.
- Treat an abandoned dependency as a defect with a remediation plan, not as a note.
