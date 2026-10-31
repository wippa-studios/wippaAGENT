# Azure and Entra ID

- Model the resource hierarchy before you deploy: subscriptions, resource groups, management groups, and the naming convention that ties them together.
- Use a consistent naming scheme with the environment, the service, the region, and the resource type in a fixed order, so a list of resources is readable.
- Use Bicep or ARM for the deployment. A portal click is not a reviewable artefact.
- Preview the deployment before you apply it, and record the rollback or deletion path for every resource you create.
- Prefer managed identity over a stored credential for any service that supports it. A managed identity has no secret to leak and no key to rotate.
- Give every identity least privilege at the scope it needs. A contributor role at subscription scope is a standing incident.
- Use Conditional Access to require stronger factors for administrative roles and for access from new locations.
- Set up the hybrid identity sync with a planned direction, a filtering rule for the objects that must not sync, and a monitoring alert for the sync status.
- Use policy and management groups to enforce the guardrails at the top of the hierarchy.
- Monitor costs by resource group and by tag, and set a budget alert before the bill surprises you.
- Deploy with a staged rollout, and keep the previous version deployable until the new one has proven itself.

**PowerShell** — runtime choice and the 5.1/7 compatibility gap, the RSAT administration modules, PowerShell 7 cloud automation, module architecture, profile design, hardening the scripting estate, and interfaces over the automation all live in the skill `powershell-automation-playbooks`. Load it before you start when the brief is PowerShell or Windows scripting work.
