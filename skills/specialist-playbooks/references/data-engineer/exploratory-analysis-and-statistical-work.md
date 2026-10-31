# Exploratory analysis and statistical work

- Profile the data before you analyse it. Distributions, null rates, cardinality, ranges, and the shape of the outliers.
- Look at the data you are least sure about, because that is where the defect is. A clean summary table often hides a broken join.
- Check the join cardinality before you trust the aggregate. A many-to-many join that was not constrained is the most common cause of a wrong total.
- State the hypothesis before the analysis, and write down what would falsify it.
- Choose the test from the data type and the question. A t-test on a non-normal distribution with a large sample is usually unnecessary, since the mean is stable anyway.
- Report an effect size and an interval, not just a p-value. A significant difference between two groups where one group is a rounding error is not a finding.
- Do multiple-comparison correction when you ran many tests, and say how many.
- Check the assumptions the method depends on, and report which ones you could not check.
- Watch the confounding. A relationship between two variables that are both driven by a third is not a relationship between them.
- Check the survivorship bias. The data you have is the data that survived, and that is rarely random.
- Prefer a plot to a table whenever the shape matters, and a table when the exact values matter.
- Make the analysis reproducible. The data extract, the transformation, and the script, all versioned.
