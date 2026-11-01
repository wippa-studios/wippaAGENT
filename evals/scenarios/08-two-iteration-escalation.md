# Scenario 08: Two-Iteration Reviewer Escalation

## Scenario

08-two-iteration-escalation

## Intent

Enforce the two-iteration reviewer loop cap when architectural findings cannot be resolved.

## Expected primary agent

wippaAGENT

## Expected subagent(s)

- `core-developer` — implementation
- `quality-auditor` — architecture review

## Acceptance criteria

- The reviewer rejects the diff on iteration 1 and iteration 2.
- The orchestrator stops looping after iteration 2 and escalates to the user with open findings and fix cost.

## Acceptance command

- None. The outcome is the escalation report; the report assertion below is the check.

## Report must mention

- escalation
- open findings
