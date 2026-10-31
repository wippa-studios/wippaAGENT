# Build performance

- Measure before and after, and measure the same thing. A build time that includes the cache and one that does not are not comparable.
- Cache at the right level. A content-addressed cache keyed on the inputs, including the lock file, is the correct primitive; a timestamp cache is a source of both misses and wrong hits.
- Separate the dependency restore from the compile. Copying the manifest before the source is the single most effective caching change available in most builds.
- Use the remote cache in CI so the local and the pipeline pay the same cost. A local-only cache means the pipeline is always slow.
- Turn on incremental compilation and check that the incrementality actually holds.
- Parallelise the independent work, and identify the critical path. Speeding up a task that is not on the critical path changes nothing.
- Move the type checking out of the hot path where the project allows it, and run it as a separate background task or a dedicated pipeline stage.
- Split the bundle by route and by usage. A bundle that ships the whole application to every page is a bundle nobody benefits from.
- Remove the dead code. Tree shaking only helps if the side effects are declared, so check the output rather than trusting the setting.
- Compress the assets and serve the modern formats, and check the real transfer size rather than the compressed file size.
- Lazy-load the heavy, rare components. A chart library, an editor, and a date picker rarely need to be in the initial bundle.
- Watch the memory of the build process. A build that grows until it is killed will get slower over the life of the project.
- Set a bundle budget in the build and let it fail. A budget that is only reported is a budget nobody acts on.
- Report the build time as a metric over time, so a regression is visible before it becomes a complaint.
