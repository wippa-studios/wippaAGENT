# Containers and the image supply chain

- Use a multi-stage build. The final image carries the runtime, not the compiler, the source, and the package manager caches.
- Copy the dependency manifest before the source so the dependency layer caches across source changes. This is the single biggest build-time win available.
- Add a `.dockerignore` so the build context does not carry the whole repository into the daemon.
- Run as a non-root user with a read-only root filesystem and dropped capabilities where the application allows it.
- Use a minimal, pinned base image, and track the digest rather than only the tag.
- Put a health check in the image so the orchestrator can use the same definition the operator expects.
- Add a `STOPSIGNAL` and handle it in the application, so a rolling update drains rather than kills.
- Enable the build cache features your builder supports, and mount the package cache for the ecosystem in use.
- Scan images in the pipeline and gate the release on the finding, with a documented exception process.
- Produce a software bill of materials for every published image, and sign the image.
- Verify the signature at deploy time. A signature nobody checks is a signature that proves nothing.
- Use hardened base images where the vendor provides them and the cost is acceptable.
- Keep the image small enough that a pull is not a user-facing wait.
- Tag with the immutable commit identifier and promote the same artefact between environments. Rebuilding per environment means the thing you tested is not the thing you shipped.
