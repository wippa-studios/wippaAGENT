# Vue and Nuxt

- Use the Composition API. The Options API still works, but new code should not mix the two in one component without a reason.
- Use `ref` for primitives and `reactive` for objects, and understand that `reactive` unwraps refs in templates while `ref` does not in scripts.
- Reach for `shallowRef` or `shallowReactive` when the object is large and only the top level changes. Deep reactivity on a big structure is a measurable cost.
- Use `computed` for derived state. It caches, and it keeps the derivation in one place.
- Prefer `watch` with an explicit source over `watchEffect` when you can. `watchEffect` tracks whatever it touches, which makes the dependency list implicit.
- Use `watch` with `flush: 'post'` when you need the DOM updated first.
- Extract reusable logic into composables that take their inputs as arguments and return refs. A composable that reaches for a global is a hidden dependency.
- Use `provide` and `inject` for a genuine subtree contract, and type the injected key so the contract is checked.
- Use Pinia for shared state, and keep the store small. A store that fetches, formats, and renders has become a second application layer.
- Use `useAsyncData` and `useFetch` in Nuxt rather than a manual effect, so the server payload is transferred rather than refetched.
- In Nuxt, understand the server and client lifecycle split. Code that touches `window` at module scope breaks the server render.
- Use `NuxtLink` for internal navigation so the router intercepts it, and reserve plain anchors for external links.
- Use `useAsyncData` with explicit keys where a page renders the same data twice, so the request is deduplicated.
