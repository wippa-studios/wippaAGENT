# Cohorts, retention and activation

**What to do**

- Choose the cohort dimension deliberately. Acquisition cohorts answer whether the product is improving. Behavioural cohorts answer which early action predicts staying. Segment cohorts answer which customer type is worth building for.
- Compute n-day retention for daily-use products and rolling retention for weekly or monthly-use products, and say which you used, because they answer different questions.
- Build the cohort table and read the shape of the curve. A curve that flattens at some level is a product with a floor. A curve that keeps sliding toward zero has a value-delivery problem, and no amount of acquisition will fix it.
- Compare cohorts over time. A rising week-one number across successive cohorts is the clearest evidence that product work is landing.
- Find the activation behaviour by comparing what long-retained users did in their first week against what short-retained users did, then instrument it as a single named activation metric.
- Track the time to first value, because it is the strongest lever on every downstream retention number.
- Segment the drop-off by cohort so that a problem confined to one channel or one plan does not read as a product-wide decline.

**What to watch for**

- Averages hiding the curve. A blended retention number rises while the newest cohort falls.
- A retention window shorter than the natural use cycle, which measures the return habit rather than the value.
- Counting a login as activity when the product's value is delivered somewhere else.
- Removing dormant users from the denominator, which flatters every number.

**How to verify**

- The cohort table is accompanied by the cohort definition and the retention definition.
- The curve shape is diagnosed explicitly rather than left for the reader to infer.
- The activation metric is stated with the behavioural evidence behind it, including the size of the compared groups.
- The time to first value is measured from instrumentation, not estimated.

**Instrumentation that makes cohorts possible**

- Define the activation event once, in the analytics layer, and use the same definition everywhere. A cohort table built on a different definition from the dashboard will not reconcile, and the disagreement will cost more than the definition.
- Capture the signup moment, the first session, the first key action and the first value moment with their own events, because each cohort boundary needs one.
- Keep identity resolution honest. A user counted twice in one cohort inflates the numerator and the table becomes unusable.
- Version the definition. When the activation definition changes, mark the break in the series rather than splicing two incompatible numbers together.
- Check that the event fires on the platform where the behaviour happens. A mobile-only activation event will quietly report zero for the web cohort.
