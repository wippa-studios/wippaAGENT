# Rust

- Let the borrow checker do the work. Most fights with it are a design problem, not a syntax problem.
- Use `&str` for borrowed data and `String` for owned data, and take `&self` in methods that do not mutate.
- Return `Result` from anything that can fail and use `?` to propagate. Reserve `panic` and `unwrap` for cases that are genuinely impossible, and prefer `expect` with a message over a bare `unwrap`.
- Define a custom error enum with `thiserror` for a library, and use `anyhow` for application-level context.
- Write traits for behaviour and generics for static dispatch, and use trait objects only when you genuinely need runtime polymorphism.
- Use `impl Trait` in return position for a simple concrete return type, and `Box<dyn Trait>` for a heterogeneous one.
- Keep lifetimes out of the public API where you can. Elision handles the common cases, and explicit lifetimes are a signal that the design needs another look.
- Use `Arc` for shared ownership across threads and `Rc` for single-threaded sharing. Reach for `RefCell` only when you have checked the runtime cost.
- Use `tokio` for async, and structure tasks so a panic in one does not take down the runtime. `JoinSet` and `CancellationToken` help.
- Keep the async block free of blocking work. `spawn_blocking` exists for a reason.
- Use `serde` with `#[derive]` for wire formats, and keep the representation stable if it is persisted or sent over the network.
- Enable `clippy` with pedantic lints for new code and fix the findings rather than allowing them.
- Run `cargo test`, `cargo clippy`, and `cargo fmt --check` before you claim the work is done.
- Keep `unsafe` to a minimum and concentrate it in one module with a documented safety argument for each block. Run Miri on that module.
- Commit `Cargo.lock` for applications and honour it for libraries within a workspace.
- Use zero-cost abstractions honestly. An abstraction that costs a heap allocation per call is not free, and the profile will say so.
