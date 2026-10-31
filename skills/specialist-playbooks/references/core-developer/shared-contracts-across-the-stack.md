# Shared contracts across the stack

- Put the request and response types in one place and generate the client and the server from them. A hand-written client drifts from the server within a sprint.
- Share validation schemas as well as types, so the same rule rejects bad input on both sides.
- Generate an OpenAPI document from the server and a typed client from that document, and check the generated artefact into the repository.
- Version the shared package alongside the services that consume it, and publish it to an internal registry rather than copying it between repositories.
- Where a monorepo is in play, use path aliases and project references so the local experience does not require a publish step. Where a polyrepo is in play, automate the version bump and the release.
- Treat a breaking type change as a breaking API change and roll it the same way.
