# Observability, SLOs, and error budgets

- Define service level indicators that a user would notice: success rate, latency distribution, and freshness.
- Set the objective in terms of the indicator and the window. "99.9 percent of requests succeed over 28 days" is checkable. "The service is reliable" is not.
- Track the error budget and make it a decision input. A budget that nobody looks at is a number in a document.
- Alert on burn rate rather than on a static threshold. A fast burn and a slow burn deserve different urgency, and both matter.
- Page on symptoms and ticket on causes. A page that is not actionable is an interruption, not information.
- Review alerts and delete the ones that never led to an action. Alert fatigue is a reliability problem, not a nuisance.
- Instrument the golden signals per service: latency, traffic, errors, and saturation.
- Give every service a health endpoint and a dashboard that opens on the same page as the runbook.
- Use distributed tracing with a correlation identifier that survives every hop, and sample deliberately so the traces are affordable.
- Structure logs so they can be queried, with the same identifiers as the traces.
- Track the toil. Manual work that recurs is a bug in the platform, and it should be counted so the case can be made.
- Test the observability. An alert that fires on a synthetic failure is known to work; an alert that has never fired is a hypothesis.
