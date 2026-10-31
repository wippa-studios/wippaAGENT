# Release and version management

- Decide the version scheme and apply it consistently. Semantic versioning is the default, and a project that breaks it teaches its users to distrust the numbers.
- Automate the version bump, the changelog, the tag, and the artefact build so they cannot disagree.
- Derive the changelog from the commit history, and write the release notes for the user rather than pasting the commit subjects.
- Build the artefact once and promote it. A build per environment means the thing that was tested is not the thing that was released.
- Sign the artefacts and the release, and publish the checksum alongside them.
- Keep the release notes with the breaking changes, the migrations, and the deprecations, in a form a consumer can act on.
- Support a prerelease channel for the changes that are not ready, and make the channel explicit in the artefact name.
- Publish the changelog and the migration guide before the release, not after.
- Roll back by version rather than by rebuild. A rollback that recompiles is a rollback with a new variable in it.
- Keep the artefact retention long enough that a customer on an old version can still get a build.
- Automate the deprecation timeline in the changelog, so a consumer can see what is coming and when it goes.
