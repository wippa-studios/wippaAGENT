# Evals

Scenario tasks define one behaviour the wippaAGENT agent set should handle, and what a passing run looks like.

## Scenario format

Each scenario lives in `evals/scenarios/` as one markdown file, named by its number and topic, for example `01-plain-bug-fix.md`.

A scenario carries six required fields, plus one optional report assertion:

- **Scenario name** — the short name of the behaviour under test, as used in the file name without the extension, for example `01-plain-bug-fix`.
- **Intent** — the one-sentence user-visible outcome the run should produce.
- **Expected primary agent** — the primary agent that owns the work, normally `wippaAGENT`.
- **Expected subagent(s)** — the specialist or specialists that should be dispatched, with the capability each dispatch should be routed on. One task may legitimately need two; write one line per dispatch.
- **Acceptance criteria** — the command or observable check that decides pass or fail. The acceptance command is mandatory whenever a command can decide the outcome; a scenario that reports `None` must name the artefact that stands as the evidence.
- **Acceptance command** — the exact command that produces the evidence, or `None` where the outcome is the research report itself. It is mandatory whenever a command can decide the outcome.
- **Report must mention** — optional literal phrases checked only in `--live` mode after a successful dispatch. If a phrase is missing from the dispatch output, the scenario fails. A command-less scenario with this field is skipped in a normal non-live run; `--check` validates it without dispatching, because there is no dispatch output to inspect.

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

Every run parses each file and checks that the scenario name matches the file name, that all six required fields are present, and that the optional report assertion is non-empty when present. It also checks that the primary agent has a definition, and that every expected subagent is in the catalog with `mode: subagent`. A scenario with a problem fails the run before its command is considered. Identical acceptance commands are run once and shared, so two scenarios that both check `npm test` do not pay for it twice.

A scenario whose acceptance command is `None` is validated and then reported as skipped: the runner cannot produce the written report that is the evidence. That is a pass for validation, not a pass for the behaviour under test, and the summary prints the skipped count separately.

The runner exits 0 only when no scenario failed. `npm test` covers the parser and every shipped scenario, so a scenario that stops matching the catalog fails the test suite as well.

## Live dispatch

The default run executes the acceptance commands; it never launches an agent. `npm run eval -- --live` does: it dispatches each scenario to the real `wippaAGENT` on an OpenCode binary, then runs the scenario's acceptance command and judges the run by its exit code. A scenario without a command passes when its dispatch completes and every report term is present; without a report assertion it passes on dispatch completion, because the report itself is the evidence.

```bash
npm run eval -- --live
npm run eval -- --live --model provider/model
```

Live mode needs three things:

| Requirement | How it is supplied |
|-------------|--------------------|
| The OpenCode binary | `opencode` on `PATH`, or `OPENCODE_BIN` |
| The model | `--model provider/model`, or `OPENCODE_EVAL_MODEL` |
| The provider key | `OPENCODE_EVAL_API_KEY` |

It installs the agent set into the repository's local `.opencode/` scope (`install.sh --project .`) and rewrites `.opencode/opencode.json` as plain JSON with `default_agent` and the provider's `apiKey` set to the `{env:OPENCODE_EVAL_API_KEY}` reference — the key itself is never written to a file. A config that cannot be parsed is refused rather than clobbered. The dispatched run gets `--auto`, so permission prompts that are not explicitly denied are auto-approved; treat a live run as a real agent session, because it is one.

The manual `.github/workflows/dispatch-eval.yml` workflow runs live mode when the `OPENCODE_EVAL_MODEL` and `OPENCODE_EVAL_API_KEY` repository secrets exist, and prints a notice and exits green when they do not — public CI has no model credentials, and that is an expected state. `scripts/opencode-smoke.mjs` (`npm run check:smoke`) is the credential-free counterpart: it proves the installed tree loads on a real binary (every agent resolves, the tools plugin loads) but does not dispatch a model or execute a tool.
