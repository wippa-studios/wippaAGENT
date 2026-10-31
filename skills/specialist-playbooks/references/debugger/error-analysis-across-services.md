# Error analysis across services

- Build a picture of the error distribution before you look for a cause. Which errors are frequent, which are rare, and which are new.
- Segment the errors by dimension: service, endpoint, version, region, client, user cohort, and time of day. A rate that hides inside an aggregate is usually a specific segment.
- Correlate across services using the trace. The error usually originates upstream of where it is reported.
- Look for the cascade. One failing dependency produces thousands of derived errors; find the root and the rest is noise.
- Establish a baseline before you set a threshold. A threshold chosen without a baseline is a guess.
- Watch the transition points, not just the levels. An error rate that is stable and high is often less urgent than one that is low and climbing.
- Reduce noise. Every alert on a condition that has never mattered is an alert that trains people to ignore alerts.
- Classify the errors by owner. An error the calling team can fix belongs to them; one the provider owns belongs to the provider. Vague ownership means nobody fixes it.
- Use anomaly detection to point at the unusual, and use a human to confirm the meaning. A model that flags every new value is a model nobody reads.
- Close the loop. When an error class is fixed, confirm the rate actually fell.
