# MLOps and the model lifecycle

- Track every experiment with the parameters, the metrics, the code version, the data version, and the environment. An untracked experiment cannot be reproduced.
- Keep the model registry as the single place a model is promoted from, with the approval that put it there.
- Store the artefact with its metadata, its signature, and the evaluation report, and keep a lineage from the data to the model to the deployment.
- Make the promotion path a pipeline with gates: the evaluation thresholds, the bias checks, the security scan, and the human approval for a high-impact model.
- Automate the retraining trigger, and define what the retrained model must beat before it replaces the current one.
- Make the rollback a matter of pointing the endpoint at the previous version. A deployment without a rollback path is a deployment with a scheduled incident.
- Watch the live model for drift. The input distribution moving, the confidence distribution moving, and the output rate moving are three separate signals and they mean different things.
- Track the cost of the platform and of the training runs. A training job that runs every night regardless of need is a budget item nobody approved.
- Give the platform a retention policy for the artefacts, and delete the ones that no longer have a consumer.
- Document the model card: the intended use, the training data, the evaluation results, the known limitations, and the out-of-scope uses.
