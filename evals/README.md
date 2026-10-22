# Evals

Scenario tasks define one behaviour the wippaAGENT agent set should handle, and what a passing run looks like.

## Scenario format

Each scenario lives in `evals/scenarios/` as one markdown file, named by its number and topic, for example `01-plain-bug-fix.md`.

A scenario carries five fields:

- **Scenario name** — the short name of the behaviour under test, as used in the file name without the number prefix and extension, for example `plain-bug-fix`.
- **Intent** — the one-sentence user-visible outcome the run should produce.
- **Expected primary agent** — the primary agent that owns the work, normally `agentWIPPA`.
- **Expected subagent(s)** — the specialist or specialists that should be dispatched, with the capability each dispatch should be routed on. One task may legitimately need two; write one line per dispatch.
- **Acceptance criteria** — the command or observable check that decides pass or fail. The acceptance command is mandatory even when the change looks trivial, because a run without one has no evidence to check against.

## Writing a new scenario

1. Take the next free number in the sequence.
2. Name the file `<number>-<kebab-case-topic>.md`.
3. Fill in all five fields. A scenario with an empty field is a scenario with an unanswered question.
4. Keep one acceptance criterion per scenario. Two unrelated checks are two scenarios.

## Running a scenario

A scenario is only useful if it stays executable. Keep the acceptance command tied to something that runs in the repository, such as the test suite in `package.json`, and keep the scenario's intent stable when the behaviour under test changes.
