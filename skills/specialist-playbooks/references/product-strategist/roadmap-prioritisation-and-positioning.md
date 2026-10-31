# Roadmap, prioritisation and positioning

**What to do**

- Anchor on the problem and the customer, not on the feature list. A roadmap is a sequence of problems solved, expressed as capabilities.

**The frameworks in play**

- Prioritisation: RICE, the value against complexity ratio, the Kano model for the quality categories, the ICE score for confidence-weighted ranking, weighted shortest job first when there is a hard date, and jobs-to-be-done for the framing underneath all of them.
- Goal setting: objectives and key results with the key result written as a number and a date, and a north star metric with its guardrails named before the initiatives exist.
- Process: the lean startup loop of build, measure and learn with its hypotheses made explicit, design thinking for the discovery half, and the agile delivery methods the engineering side already uses.
- Use a prioritisation method that makes its tradeoffs visible. RICE, value against complexity, and a Kano read each answer a different question; name which one you used and why.
- Define the north star metric and the guardrails before the initiatives, so a win on one metric cannot quietly destroy another.
- Write positioning that names the alternative the buyer is currently choosing, because a positioning that does not name an alternative is not a positioning.
- Plan launches with the operational side included: support readiness, documentation, the enablement the sales team needs, and the measurement that will tell you whether it worked.
- Decide what you are not doing, and write it down with the reason.

**What to watch for**

- Roadmap items with no user request behind them and no business hypothesis.
- Feature work that duplicates something already shipped.
- Quarterly roadmap churn that leaves engineering unable to plan. A roadmap that changes every sprint is not a roadmap.
- Success metrics defined after the launch rather than before.

**Metrics and instrumentation**

- Define the metric before the work, not after it, and write down the event, the properties, and the aggregation window. A metric nobody can reproduce is a rumour.
- Separate the counter from the rate. Counting distinct users and counting events answer different questions, and mixing them produces a trend that reverses when you change the aggregation.
- Instrument the funnel at the points where people actually leave, not only where they convert.
- Keep the dashboard small. A metric that no one looks at is only maintenance, and a dashboard with thirty tiles is a dashboard where nothing is read.
- Write down when a metric was redefined, because a discontinuity in the chart is otherwise indistinguishable from a change in behaviour.

**How to verify**

- Every roadmap item traces to a stated problem, a persona and a metric.
- Each initiative has a named owner and a review date.
- The metric tree is walked end to end so the north star has a plausible causal path to it.
- The instrumentation for a new metric is exercised against a known set of events, so the count can be reconciled by hand.
