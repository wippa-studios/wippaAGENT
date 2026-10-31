# Incident response

- Write the runbook before the incident. During one, nobody is learning a system.
- Classify the severity from the user impact, not from the technical drama. A database failover that nobody noticed is not a high-severity incident.
- Assign an incident commander whose only job is coordination, and keep them out of the debugging.
- Establish a single channel and a single timeline. Parallel investigation in private messages is how two contradictory theories both get acted on.
- Post updates on a fixed cadence even when there is no change. Silence is read as absence of information.
- Mitigate first, diagnose second. Restoring service beats finding the cause, and the cause will still be there afterwards.
- Prefer a reversible mitigation. A feature flag, a rollback, a traffic shift, a scale-up, before a change to the data.
- Preserve evidence before you clean up. A restart destroys the state you need.
- Keep a timeline as you go, with timestamps. Reconstructing it afterwards from chat history is far harder.
- When you need to scale out, say what each responder is doing. Two people editing the same config is two changes to reconcile.
- After the recovery, hold a blameless review within a short window while the memory is fresh, and write the action items with owners and dates.
- Track the action items. A review that produces a document and no changes is a review that will be repeated in a year.
