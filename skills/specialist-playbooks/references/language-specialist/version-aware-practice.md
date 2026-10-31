# Version-aware practice

- The lock file is the source of truth. A framework version changes the idioms, and the version floor is not a suggestion.
- Read the changelog for the version you are about to use when the API you remember is not present.
- When a project pins an old version for a reason, respect it. A forced upgrade is a project decision, not a personal one.
- When you introduce a dependency, check what it requires of the runtime and whether the project can carry that.
- Keep the language version and the runtime version aligned. A feature that needs a newer compiler than the CI image has is a broken build.
- For frameworks with a long-term support line, prefer the maintenance release over the newest feature release when the project is not chasing features.
- Record the versions in the documentation you write, so the next person knows what the code was written against.
