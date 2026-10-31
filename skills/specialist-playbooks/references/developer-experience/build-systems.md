# Build systems

- Treat the build as a product with users. The users are the developers, and the metric is the time between making a change and seeing the result.
- Choose the build tool the project already uses. Migrating a build system is a project-sized decision with a payoff that has to be argued for.
- Configure the build in one place with a layered override mechanism, so a local tweak does not become a committed change.
- Keep the task graph explicit. A build that hides an implicit dependency between two tasks will fail intermittently, and it will fail on someone else's machine.
- Use the ecosystem's native mechanism: a task runner for the language, a bundler for the frontend, a workspace definition for the monorepo.
- Keep the build configuration in version control and make it readable. A build file nobody can read is a build nobody can fix.
- Make the build deterministic. Pin the tool versions, the dependency versions, and the environment.
- Keep the output out of the source tree or in an ignored location, and make sure the ignore rules are right. A stale build artefact that survives a branch switch is a classic wasted afternoon.
- Keep the production build and the development build honest. If they diverge in a way that matters, that difference becomes a production incident.
- Fail the build on the checks that matter and wire them into the same entry point, so there is one command that means "is this good".
- Document how to run the build, the test, and the lint in one place, and make sure the commands in that document are the ones that work.
