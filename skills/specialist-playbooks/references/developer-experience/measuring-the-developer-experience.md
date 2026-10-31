# Measuring the developer experience

- Measure the wait, not the activity. The time between a save and a visible result, the time a pipeline takes, and the time a new developer needs to reach their first deploy are the numbers that matter.
- Instrument the loop. A build that reports where its time went turns a vague complaint into a specific fix.
- Track the build and test durations over time, and alert on a regression rather than on an absolute threshold. The absolute threshold depends on the machine.
- Watch the distribution, not the mean. A build that takes four seconds usually and forty seconds occasionally is a cache problem with a specific cause.
- Count the flaky tests, since a suite with a two percent flake rate will be rerun rather than trusted, and the rerun hides the defect.
- Measure the onboarding time, and treat a regression there as a real regression.
- Ask the developers where the time goes, and treat the answer as data. The perceived wait and the measured wait are often different, and both matter.
- Watch the queue at the pipeline. A pipeline that takes two minutes to start is a pipeline that gets queued behind a batch job.
- Track the dependency update effort. An update that takes a day of manual work will simply not happen, and the security consequence of that is real.
- Compare the measured wait with the perceived wait. When they diverge, the perceived wait is the one driving the complaint, and it is usually the number of context switches rather than the duration.
- Do not optimise the number that is easy to count. A metric nobody acts on is a metric that gets reported and ignored.
