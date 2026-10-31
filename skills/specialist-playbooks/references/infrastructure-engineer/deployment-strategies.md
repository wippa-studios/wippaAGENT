# Deployment strategies

- Pick the strategy that matches the blast radius and the tolerance for a bad release.
- Use rolling updates for stateless services that can run two versions at once.
- Use blue-green for anything where an instant rollback matters, and pay for the double capacity.
- Use canary for changes with an uncertain effect, with the analysis defined before the rollout starts.
- Use feature flags to separate deploy from release, so a risky change can be turned off without a redeploy. Remember that flags accumulate and need an owner and a removal date.
- Use shadow traffic to exercise a new version without serving it, when the read path is safe to duplicate.
- Make rollback automatic on a defined signal, not only on a human decision. The signal has to be one the team watches.
- Ensure the old version can still talk to the new data. A rolling back application against a migrated schema is not a rollback.
- Warm the new version before it takes traffic, when startup is slow.
- Verify after every deploy. A deploy script that reports success without a post-deploy check is an assumption.
- Communicate the release to whoever is on call.
