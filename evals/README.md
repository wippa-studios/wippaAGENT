# Evals

Scenario tasks define one behaviour the wippaAGENT agent set should handle, and what a passing run looks like.

## Scenario format

Each scenario lives in `evals/scenarios/` as one markdown file, named by its number and topic, for example `01-plain-bug-fix.md`.

A scenario carries six fields:

- **Scenario name** — the short name of the behaviour under test, as used in the file name without the extension, for example `01-plain-bug-fix`.
- **Intent** — the one-sentence user-visible outcome the run should produce.
- **Expected primary agent** — the primary agent that owns the work, normally `wippaAGENT`.
- **Expected subagent(s)** — the specialist or specialists that should be dispatched, with the capability each dispatch should be routed on. One task may legitimately need two; write one line per dispatch.
- **Acceptance criteria** — the command or observable check that decides pass or fail. The acceptance command is mandatory whenever a command can decide the outcome; a scenario that reports `None` must name the artefact that stands as the evidence.
- **Acceptance command** — the exact command that produces the evidence, or `None` where the outcome is the research report itself. It is mandatory whenever a command can decide the outcome.

## Writing a new scenario

1. Take the next free number in the sequence.
2. Name the file `<number>-<kebab-case-topic>.md`.
3. Fill in all six fields. A scenario with an empty field is a scenario with an unanswered question.
4. Keep one acceptance criterion per scenario. Two unrelated checks are two scenarios.

## Running a scenario

A scenario is only useful if it stays executable. Keep the acceptance command tied to something that runs in the repository, such as the test suite in `package.json`, and keep the scenario's intent stable when the behaviour under test changes.

`evals/run.ts` runs them.

```bash
npm run eval                  # validate, then run each acceptance command
npm run eval -- --check       # validate only, run nothing
npm run eval -- --timeout 60000
```

Every run parses each file and checks that the scenario name matches the file name, that all six fields are present, that the primary agent has a definition, and that every expected subagent is in the catalog with `mode: subagent`. A scenario with a problem fails the run before its command is considered. Identical acceptance commands are run once and shared, so two scenarios that both check `npm test` do not pay for it twice.

A scenario whose acceptance command is `None` is validated and then reported as skipped: the runner cannot produce the written report that is the evidence. That is a pass for validation, not a pass for the behaviour under test, and the summary prints the skipped count separately.

The runner exits 0 only when no scenario failed. `npm test` covers the parser and every shipped scenario, so a scenario that stops matching the catalog fails the test suite as well.
