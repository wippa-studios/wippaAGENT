# Two kinds of review, done in the right order

A review that mixes standards feedback with behavioural findings buries the findings. Do them separately.

- The surgical pass answers one question: if this change ships as is, what concretely breaks, for whom, and how badly.
- The broad pass answers a different question: does this meet the standards the project holds itself to, in the areas it has not been covered.
- Run the surgical pass first on anything that changes behaviour. It is the one that can stop a release.
- Run the broad pass on the same change afterwards, covering the concerns the surgical pass deliberately ignores, such as test coverage, documentation, naming consistency, and structural fit.
- Both passes produce findings, but the two lists are reported separately so the reader can act on the urgent one first.
