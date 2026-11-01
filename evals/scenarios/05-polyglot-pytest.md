# Scenario 05: Polyglot Pytest Runner

## Scenario

05-polyglot-pytest

## Intent

Verify Python feature implementation and test suite execution via pytest.

## Expected primary agent

wippaAGENT

## Expected subagent(s)

- `language-specialist` — implementation
- `quality-auditor` — code review

## Acceptance criteria

- The test suite passes under pytest without interactive flags.
- The review verifies type hints and error handling.

## Acceptance command

- None. The outcome is the test execution log; the report assertion below is the check.

## Report must mention

- pytest
- passed
