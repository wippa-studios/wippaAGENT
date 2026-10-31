# Frontend architecture

- Match the framework already in the repository. A second UI framework in one codebase is a permanent cost.
- Keep the state model explicit. Server state, client state, form state, and URL state are four different problems and four different tools.
- Fetch server data through a layer that handles caching, deduplication, revalidation, and error states in one place.
- Make optimistic updates reversible. Every optimistic path needs the rollback that undoes it.
- Push work off the main thread for anything heavy enough to be felt.
- Virtualise long lists. Render the visible window, not the array.
- Set bundle budgets in the build and let the build fail when they are exceeded. A budget that only appears in a wiki is not a budget.
- Enforce strict typing in TypeScript projects, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` where the codebase can absorb them.
- Handle the four states of every async surface: loading, empty, error, and success. Empty is not success, and it is the one that gets skipped.
- Use an error boundary at a sensible granularity so one broken widget does not blank the page.
- Use a Content Security Policy that the application actually satisfies. Start from a report-only policy if you have to, then tighten.
- Keep the accessibility of a component in the component. Focus management, labels, and keyboard order do not survive being bolted on later.
- Avoid a new dependency for something the platform already does well. Every dependency is a supply-chain surface and an upgrade obligation.
