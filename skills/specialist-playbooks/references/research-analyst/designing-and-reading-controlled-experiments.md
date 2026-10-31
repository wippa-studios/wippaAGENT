# Designing and reading controlled experiments

**What to do**

- Pre-specify everything before the test runs: the hypothesis, the primary metric, the guardrail metrics, the minimum effect worth detecting, the significance level, the sample size, the assignment unit, and the fixed end date. Everything decided afterwards is a choice made after seeing the data.
- Compute the sample size from the baseline rate, the minimum effect and the power you want. A test that runs to a date rather than to a sample size will stop wherever the calendar stops it.
- Choose the assignment unit that matches the mechanism. Randomising at the user level a change that works at the group level produces a null result that tells you nothing.
- Check the sample ratio mismatch before anything else. If the two arms received materially different numbers of users, the test is invalid regardless of the p-value.
- Read the effect size with its confidence interval and treat that as the finding. The p-value is a filter, not a result.
- Check the guardrails before the primary metric.
- Look only at segments named before the test started, and mark everything else as exploratory.
- Report what the test did not show as carefully as what it did.

**What to watch for**

- Peeking and stopping when the threshold is crossed.
- Testing many metrics and reporting the winner without a correction for multiplicity.
- Simpson's paradox, where the aggregate reverses inside segments.
- Survivorship bias from analysing only the users who completed the flow.
- A metric that changed definition mid-test.

**How to verify**

- The pre-registration is attached and the decision rule is applied as written.
- The result table carries sample size, rate, lift, confidence interval and p-value for both arms, plus the sample ratio check.
- The power calculation is shown, and a null result is interpreted against the detectable effect rather than as absence of effect.
- Guardrail status is reported for every guardrail, not only the ones that passed.

**Choosing guardrails**

- Pick guardrails that represent the ways the change could hurt someone. Refund rate, support contact rate, latency, error rate and downstream conversion are typical candidates.
- Guardrails are evaluated with the same rigour as the primary metric, including a threshold in advance. A guardrail you only look at when the primary metric wins is not a guardrail.
- A guardrail that is already noisy at the baseline will produce false alarms. Check the baseline variance before choosing a threshold.
- When a guardrail and the primary metric disagree, the correct outcome is usually to redesign and retest rather than to pick the one you prefer. Say that explicitly in the write-up.
