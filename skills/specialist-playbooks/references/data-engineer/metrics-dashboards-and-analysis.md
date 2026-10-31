# Metrics, dashboards, and analysis

- Define the metric before the dashboard. A metric without an owner, a formula, a source, and a refresh cadence will be calculated two ways and argued about.
- Write the business rule down in the same place as the calculation, so the two cannot drift.
- Separate the metric definition from its presentation. A dashboard should read a versioned metric rather than reimplementing the logic.
- Use one definition per metric and publish it. A second definition of revenue in a slide deck is a data incident waiting to be discovered by a customer.
- Match the query to the latency requirement. A dashboard that takes a minute to load gets screenshotted and never refreshed.
- Make the dashboard answer a question, not display everything. A wall of charts with no hierarchy is a report nobody reads.
- Choose the chart for the relationship: a line for a trend over time, a bar for a comparison across categories, a scatter for a relationship, and a distribution shape for a spread.
- Annotate the chart with the events that explain it. A deployment, a campaign, or an outage on the timeline is worth more than another series.
- Write the summary in prose with the number, the direction, and the cause. A chart without a sentence is a data file.
- Check the population, the time window, and the join before you publish a number. Most wrong numbers are one of those three.
- Make the query efficient with the same rules as any other query. A dashboard query is a query.
- Track the metric definition in version control, and record the change when it changes.
