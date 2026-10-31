# Model serving

- Separate the training path from the serving path, and make sure the features are computed the same way in both.
- Choose the serving mode per use case. A synchronous endpoint for interactive use, a batch job for scheduled scoring, and an asynchronous queue for anything slow.
- Batch the requests at serving time where the model benefits from it, and cap the batch so latency stays bounded.
- Cache the model in memory and load it once, and version the endpoint so two model versions can be served side by side during a rollout.
- Set a timeout and a circuit breaker on the inference call, and define the fallback behaviour when the model is unavailable.
- Quantise, prune, or distil the model when the latency budget requires it, and measure the accuracy cost rather than assuming it.
- Export to a portable runtime format where one exists, so the serving stack does not depend on the training framework.
- Accelerate with the available hardware where it is warranted, and profile before adding the dependency.
- Serve the model version in the response, so a bad prediction can be traced back to the artefact that produced it.
- Roll out progressively with a shadow phase, and compare the new model against the old on live traffic before switching.
- Monitor the live predictions, not only the serving errors. A model that is up and serving degraded predictions is a silent failure.
