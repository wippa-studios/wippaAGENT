# Go

- Return errors, do not panic. A panic is for a programming error, and every returned error should be wrapped with the context that produced it.
- Define sentinel errors with `errors.Is` and typed errors with `errors.As` so callers can branch on them.
- Accept interfaces, return concrete types. Keep interfaces small and defined by the consumer, not the producer.
- Propagate `context.Context` as the first parameter on anything that does I/O, and honour cancellation and deadlines.
- Use channels to orchestrate and mutexes to protect state. A channel per value is a queue; a channel per message is usually the wrong shape.
- Close channels only from the sending side, and only when the channel will never be used again.
- Bound every goroutine. A `go` statement with no limit is a resource leak with a race condition attached.
- Use `sync.WaitGroup` for joins and `context` for cancellation in a worker pool.
- Run the race detector in CI. It finds real bugs that tests will not.
- Use table-driven tests with subtests, and `t.Parallel` where the test does not share state.
- Benchmark the code that matters, and compare against a baseline rather than against a feeling.
- Use `pprof` for CPU and memory profiles before guessing at a performance problem.
- Preallocate slices when the length is known, and use `strings.Builder` instead of repeated concatenation in a loop.
- Use `sync.Pool` for short-lived allocations in a hot path, and measure whether it helps before adopting it.
- Keep `go.mod` tidy, commit `go.sum`, and pin the toolchain version in the module file.
- Build a small `cmd` binary and a reusable `internal` package. A repository that is only a `main` package grows into a mess.
