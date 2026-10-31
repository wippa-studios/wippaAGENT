# TypeScript and modern JavaScript

TypeScript configuration is the first thing to get right, because it decides what the compiler will catch for you.

- Enable `strict`. It is the single highest-value flag in the file, and it is cheap to adopt incrementally on new files if the whole repository cannot flip at once.
- Turn on `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` when the codebase can absorb them. They catch the class of bug where a value is assumed present because the type said so.
- Set `noImplicitOverride` and `noFallthroughCasesInSwitch` in strict projects. Both catch real mistakes.
- Keep `noImplicitAny` on and replace `any` with a specific type or a deliberate `unknown` that gets narrowed. A stray `any` in one position spreads through every expression it touches.
- Use `satisfies` when you want a value checked against a type without widening it. It is the right tool for configuration objects and route tables.
- Use discriminated unions for state machines. A union of variants with a literal discriminator gives you exhaustive checking in the switch.
- Use branded types for identifiers that must not be confused. A `UserId` and an `OrderId` are both strings until you make them different.
- Keep conditional and mapped types for genuinely type-level problems. If a reader cannot follow it in five seconds, replace it with a runtime check.
- `strictNullChecks` changes the meaning of every type in the file. It is not a formatting change and it needs a real pass.

Modern JavaScript practice:

- Use `async` and `await` with a try and catch at the boundary, and propagate errors deliberately rather than swallowing them.
- Compose promises with `all` when you need every result, `allSettled` when a failure in one should not cancel the rest, and `race` only when losing the race is genuinely a success.
- Prefer `AbortSignal` for cancellation over a bespoke flag. It integrates with the platform APIs that already accept it.
- Use dynamic `import()` for code splitting at a boundary that is real, such as a heavy editor or a chart library.
- Use `structuredClone` rather than a hand-rolled deep copy, and understand that it does not clone functions or prototypes.
- Use `WeakRef` and `FinalizationRegistry` only for caches that can tolerate losing an entry. They are not a general memory management tool.
- Know the event loop well enough to explain why a `for` loop with an `await` inside serialises. If a fan-out of independent calls is slow, it is usually this.
- Use the `Temporal` API where it is available; it removes a whole class of timezone and calendar bugs.
- In the browser, use event delegation for lists and `requestIdleCallback` for work that is not urgent.
- Use `SharedArrayBuffer` and a worker only when the work is genuinely CPU-bound and genuinely large. A worker costs a message protocol to maintain.
- `Intl` handles number, date, and collation formatting better than a hand-rolled formatter and respects the user's locale.
