# Cutting releases

**What to do**

- Agree the version before tagging. A semantic version carries three decisions: whether the change breaks compatibility, whether it adds functionality, and whether it fixes behaviour, and those three should drive the major, minor and patch numbers respectively.
- Make the tag, the release and the code agree. The tag points at the commit that was built, the release names that tag, and the build artifact comes from that commit.
- Generate the release notes from the commit history and the closed issues, then edit them. A list of commit subjects is not a changelog; group the entries by what a user will notice, and call out the breaking changes and the migration steps at the top.
- Attach the build artifacts and verify the download works from a clean client, because an artifact that only resolves from the build machine is not a release.
- Note the provenance of the build: the workflow run, the commit and the environment it came from.
- Keep a changelog in the repository, written for the reader who upgrades, not for the team that shipped.
- Make the release reversible and say so. A bad release needs a documented path forward, and writing it before you need it costs nothing.

**What to watch for**

- A tag pushed directly to a commit that was never built or never tested in the release environment.
- Version numbers that disagree between the tag, the manifest and the documentation.
- Release notes that omit the breaking change. The reader finds out at runtime instead of in the notes.
- Assets that include secrets, signing keys or environment configuration.
- A release published from an unverified local machine rather than from the pipeline.

**How to verify**

- The tag resolves to the commit the release claims, checked directly.
- The notes list the breaking changes and the fixes, and every entry maps to a commit or a closed issue.
- The artifact downloads and passes a smoke test from a clean environment.
- The published version matches the version in the package manifest.

**Hotfixes and reversals**

- Treat a production defect as a hotfix path of its own: a branch cut from the release tag, a minimal change, a focused test, and a patch release that states the severity and the workaround.
- Decide the ordering explicitly. A patch release on top of an existing release keeps history readable, and a re-release of a different commit under the same version destroys it.
- Write the rollback before the deploy: the exact command, the exact prior version, and who is authorised to run it. A rollback nobody has rehearsed is a hope.
- Do not delete a bad release outright. Mark it as superseded and point to the replacement, because someone pinned that version and will find out either way.
- After a reversal, write down what caused it and how it got through the checks. That note is the only thing that makes the next occurrence less likely.
