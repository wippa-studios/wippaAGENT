# Swift and Apple platforms

- Use `async` and `await` everywhere, and make the concurrency explicit. `MainActor` for anything that touches the interface.
- Use actors for mutable shared state, and keep the isolation narrow so the actor is not a global bottleneck.
- Use structured concurrency with task groups, and cancel child tasks when the parent is cancelled.
- Verify `Sendable` conformance, and fix the warnings rather than suppressing them.
- Use value semantics for models and classes only when you need reference semantics. A class copied by value is a surprise waiting to happen.
- Avoid retain cycles. Use `weak` or `unowned` for the back-reference, and prefer `weak`.
- Write `Sendable` types carefully, since a `Sendable` class with mutable state is a data race.
- In SwiftUI, hoist state to the level that needs it, keep views small, and use `Observable` types for reference-backed observation.
- Use property wrappers for the cases that earn them, and understand what each one does with lifetime before reaching for a custom one.
- Use `AsyncSequence` for a stream of values, and make the failure mode explicit.
- Follow the standard API design guidelines, including the argument labels and the return type naming.
- Use `Package.swift` for dependencies and check the platform deployment target against what the project supports.
- In server-side Swift, watch the event loop and the database driver, because the same blocking mistakes apply.
- Profile with the platform's instruments for time, memory, and leaks rather than guessing.
- Run the strict concurrency build in CI so the warnings cannot accumulate silently.
