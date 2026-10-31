# Kotlin and multiplatform

- Use `data class` for value types and `sealed class` for closed hierarchies, which gives exhaustive `when` branches.
- Use `when` with the subject form instead of a chain of `if` and `else if`.
- Use extension functions to add behaviour without inheritance, and keep them in the package where they belong.
- Choose the right scope function. `let` for a local result, `apply` for configuring an object, `also` for a side effect, `run` for a combined scope, `with` for a receiver you already have.
- Use coroutines for concurrency, and never use `GlobalScope`. A scope tied to a lifecycle is what makes cancellation work.
- Use `viewModelScope` in Android and `CoroutineScope` you own elsewhere, and cancel it deliberately.
- Use `StateFlow` for observable state and `SharedFlow` for events. A `StateFlow` always has a current value; a `SharedFlow` does not.
- Use `flowOn` to control the context of upstream work and `withContext` for a scoped change.
- Structure coroutine code so a failure cancels its siblings. `coroutineScope` and `supervisorScope` differ in exactly that behaviour.
- Test coroutines with a test dispatcher and an injected scheduler, never with real delays.
- Use `expect` and `actual` sparingly. Every actual declaration is a place the platforms can diverge, and the divergence is where the bug will be.
- Keep the common module free of platform assumptions, and put platform-specific code behind a small interface with a common default.
- With Compose, hoist state above the composable that needs it, and keep the composable itself free of side effects.
- Use `remember` for values that survive recomposition and `rememberSaveable` for values that should survive process death.
- In Ktor, define routes in a DSL, register plugins explicitly, and use serialisation with a configured content negotiation.
- Enable `explicitApi` mode in library modules so the public surface is deliberate.
- Run `ktlint` and `detekt` before you finish. They are cheap and the Kotlin ecosystem expects them.
