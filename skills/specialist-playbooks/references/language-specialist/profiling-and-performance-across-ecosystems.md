# Profiling and performance across ecosystems

- Measure before you optimise, and measure the same thing before and after.
- Use the ecosystem's profiler: the language's own tooling, the framework's inspector, and a sampling profiler for production-shaped workloads.
- Find the allocation hotspot before the CPU hotspot. Most slow paths are allocation-bound rather than compute-bound.
- Keep the hot path free of abstraction overhead when the abstraction is inlined anyway. The compiler usually handles this, and the profiler confirms it.
- Set a performance budget in the build or the test suite, so a regression fails automatically.
- Do not trade a correctness property for a benchmark. A faster wrong answer is still wrong.
