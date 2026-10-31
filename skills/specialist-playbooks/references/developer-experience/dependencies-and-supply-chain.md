# Dependencies and supply chain

- Inventory the direct dependencies and check each one for maintenance, licence, and advisories. An unused dependency is pure risk.
- Commit the lock file. Without it the build is not reproducible and a compromised version can be resolved silently.
- Pin the versions the project actually needs, and let the lock file carry the transitive resolution.
- Distinguish the direct dependencies from the transitive ones in your reviews, because the transitive ones are where the surprise lives.
- Use a version range strategy that matches the project's stability needs. A library with a stable public interface can take a wide range, and a fast-moving framework cannot.
- Group the dependencies that change together and the ones that change apart. This is the dependency-update exercise, and the grouping is the whole trick.
- Automate the updates with a scheduled pull request, and keep the failing ones open rather than closing them silently.
- Check for the dependency-confusion pattern and confirm the registry and scope rules in the manifest.
- Look for typosquatting in new package names, and check the publisher and the download counts.
- Audit the licences, including the licences of the transitive dependencies, and record the obligations.
- Generate a software bill of materials for each release artefact.
- Pin the CI actions and the base images by digest. A floating tag is an unreviewed change to your build.
- Use the workspace or the monorepo mechanism when the project has one, and hoist the shared dependency to the root so there is one copy of it.
- Remove the duplicates. Two copies of the same library in one tree produce subtle type and behaviour bugs.
- Watch the install scripts, since a dependency that runs code at install time runs with the developer's privileges.
- Check the size impact of a new dependency before adding it, both in install time and in the bundle.
