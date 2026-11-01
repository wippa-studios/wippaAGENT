# Scenario 06: Polyglot Go Test Runner

## Scenario

06-polyglot-go-test

## Intent

Verify Go concurrent service changes and race detection via go test.

## Expected primary agent

wippaAGENT

## Expected subagent(s)

- `language-specialist` — implementation
- `quality-auditor` — code review

## Acceptance criteria

- The test suite passes under `go test` with race detection enabled.
- The review verifies channel synchronization and context cancellation.

## Acceptance command

- None. The outcome is the test execution log; the report assertion below is the check.

## Report must mention

- go test
- PASS
