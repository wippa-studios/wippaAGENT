# Angular

- Use standalone components by default. The module system still works, but the ecosystem has moved on.
- Keep strict mode on for the template type checker as well as the compiler. A template that does not type check is where Angular bugs hide.
- Use `OnPush` change detection and understand that it requires immutable input. Mutating an input in place and expecting the view to update is the classic OnPush bug.
- Prefer the signals model for local component state, and keep the reactive forms model for form value and validation state.
- Use `track` on loops. Without a stable track expression, the framework re-creates DOM nodes on every change detection pass.
- Unsubscribe from every subscription, or use the `async` pipe or `takeUntilDestroyed` so the teardown is automatic.
- Use the `async` pipe for observables in templates. It handles the subscribe and unsubscribe pair for you.
- Do not call a function from a template. It runs on every change detection cycle and hides expensive work.
- Use NgRx or the signal store when state is shared across routes or features, and keep the store free of component references.
- Use effects for side effects and selectors for derived state, and memoise the selectors.
- Use route guards for authorisation checks on the client, and remember that the server must enforce the same rules independently.
- Use interceptors for cross-cutting HTTP concerns, and make sure an interceptor that retries does not also swallow the error.
- Configure bundle budgets and the build will fail when they are exceeded. This is the point of a budget.
- Lazy load feature routes, and use preloading strategies deliberately so preloading does not negate the lazy load.
