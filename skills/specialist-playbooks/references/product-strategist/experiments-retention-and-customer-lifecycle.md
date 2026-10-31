# Experiments, retention and customer lifecycle

**What to do**

- Design the experiment before running it: hypothesis, primary metric, guardrail metrics, the minimum effect worth detecting, the sample needed for that effect, and the fixed end date.

**The instruments**

- Analysis: a p-value read as the probability of a result this extreme under no effect, a confidence interval on the effect, a Bonferroni correction or a pre-specified primary metric when several are tested, and a Bayesian read as the probability the variant is better for the platforms that report it that way.
- Platforms and methods: VWO and Optimizely for the commercial testing, a custom harness with a proper statistics layer for the in-house case, and a heatmap or session replay tool for the qualitative read of where the drop-off happens.
- Read the p-value for what it is. It is the probability of a result this extreme if there were no effect. It is not the probability the variant is better and it is not the size of the effect.
- Always report the effect size with a confidence interval. A statistically significant 0.01 percent lift is not a product decision, and a real 5 percent lift on an underpowered test is a decision to gather more data.
- Check the guardrails before the primary metric. A variant that improves conversion while degrading refund rate has failed.
- Look at retention by cohort over time, not as an aggregate. Acquisition cohorts tell you whether the product is improving; behavioural cohorts tell you which early behaviour predicts staying.
- Find the activation behaviour by comparing what long-retained users did in their first week against what short-retained users did, then instrument it as an activation metric.
- Translate that into lifecycle work: onboarding toward activation, health scoring from usage and support signals, early warning on churn risk, renewal forecasting, and expansion based on the features the customer already pays for but does not yet use.

**The lifecycle instruments**

- Health scoring from the signals that actually predict churn: login cadence, the features the account actually uses, support volume, an unanswered ticket, the champion leaving, the contract date approaching, and a payment problem.
- The standard measures: net promoter score for the relationship, customer satisfaction for the transaction, and customer effort for the friction, each read alongside the usage numbers rather than instead of them.
- The account cycle: a success plan with milestones, the quarterly business review with the return demonstrated in the customer's own numbers, the renewal with its forecast and its risk mitigation, the expansion where the account already pays for the feature it has not adopted, and the win-back programme for the accounts that left for a reason you now understand.

**What to watch for**

- Peeking. Stopping when the p-value crosses the threshold inflates the false positive rate well past five percent.
- Post-hoc segment analysis. Only segments named before the test are evidence; everything else is a fishing expedition.
- Simpson's paradox, where the aggregate result reverses inside segments.
- Survivorship bias, from analysing only the users who completed the flow rather than everyone who was assigned to it.
- A retention curve that decays toward zero. That is a product-market fit problem, and more acquisition will not fix it.

**How to verify**

- The result table carries sample size, conversion rate, lift, confidence interval and p-value for both arms.
- A sample ratio mismatch check, which invalidates the whole test when it fails.
- The pre-registered decision rule, applied as written.
- A cohort table with the cohort definition stated, so it can be rebuilt.

**Content and editorial quality** — the playbooks for content, copy and editorial quality live in the skill `content-legal-media-playbooks`. Load it when the brief is content or editorial work.
