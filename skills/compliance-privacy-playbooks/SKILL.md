---
name: Compliance and Privacy Playbooks
description: Compliance, privacy and directory-hardening playbooks for the security-reviewer subagent: Active Directory security posture, compliance frameworks, privacy under GDPR and CCPA, and healthcare data under HIPAA. Use this skill when a brief involves a compliance framework, a privacy or data-protection review, an Active Directory security assessment, or handling health data, and load it before starting that work.
---

# Compliance and Privacy Playbooks

This skill carries the compliance, privacy and Active Directory playbooks that used to sit in the `security-reviewer` agent definition, so they load when the brief is compliance, privacy, or AD-posture work instead of in every security prompt. The `security-reviewer` file keeps all four capabilities in its *What you cover* list for routing; load this skill before you start when the brief matches one of them.

## Playbooks

### Active Directory security posture

- Review the privileged groups and require a documented justification for every member of each one. An unexplained domain administrator is a finding on its own.
- Check the tiering model and the delegation boundaries. Administrative tiering is a structural control, and its absence is harder to fix than a membership problem.
- Hunt for orphaned permissions and drift in the ACLs. Permissions that outlived the person who needed them are the normal outcome of a busy directory.
- Check the delegation model, especially the ability to add a member to a privileged group, and the ability to write a logon script or a scheduled task.
- Check the domain and forest functional levels and the compatibility implications of raising them.
- Review the authentication protocol posture: whether signing is required, whether channel binding is enforced, whether legacy protocols and weak encryption are still negotiable, and whether the trusted configurations cross a boundary that should not be crossed.
- Check the Group Policy security filtering, the restricted groups, the local administrator enforcement, and the permissions on the policy repository itself.
- Check the exposure to the well-known directory attack paths: a controller impersonation, a directory replication read, and service ticket abuse. Then look for the prerequisites, such as stale service principals, weak service accounts, and unconstrained delegation.
- Check the service accounts. A service account with a trivial password and a domain administrator membership is a full compromise waiting for a password guess.
- Prioritise the fixes in two bands: the quick wins that close a specific path now, and the structural changes that remove the class of problem.
- Describe the remediation as a script and a policy change with validation and a rollback, not as a paragraph of advice.

### Compliance frameworks

- Identify which frameworks actually apply. A product handling health data has a different obligation set from one handling payments, and over-auditing wastes the team's time.
- Map the controls to the framework, and record the control identifier, the implementation, the evidence, and the gap in one table.
- Separate the technical control from the administrative and physical ones. A technical control you can verify is different from a policy you can only read.
- Collect the evidence automatically where you can. Screenshots, configuration exports, log retention samples, access review records, test results, and configuration drift reports.
- Track the gaps as a register with an owner, a remediation date, and a risk acceptance where the gap is accepted.
- Measure the control, not the intention. "Quarterly access reviews are performed" is a claim; the review records are the evidence.
- Cover the lifecycle controls: provisioning, review, and deprovisioning. A control that only works at the start is not a control.
- Map the technical controls to the regulatory obligation where a specific requirement applies, such as a notification deadline.
- Review the exception process. An exception without an expiry date is a permanent hole with paperwork.
- Keep the mapping current. The control set changes when the product changes, and a stale mapping is the most common audit finding about the audit process itself.

### Privacy under GDPR and CCPA

GDPR rests on seven principles: lawfulness, fairness and transparency; purpose limitation; data minimisation; accuracy; storage limitation; integrity and confidentiality; and accountability. Every processing activity needs a documented legal basis from the fixed set of consent, contract, legal obligation, vital interests, public task, and legitimate interests. Legitimate interests is a balancing test that cannot override fundamental rights, and it needs a written assessment.

The data subject rights that must be supported: access, erasure, rectification, portability, restriction of processing, and objection to processing based on legitimate interests.

- Map the data inventory: what is collected, where it lives, why it is collected, and who at the organisation can see it.
- Make the consent flow unambiguous, unticked by default, and as easy to withdraw as it was to give.
- Ensure non-essential cookies are opt-in and the consent banner actually blocks the non-essential scripts.
- Build a data subject request process and test it end to end. The test is the only evidence that it works.
- Enforce the retention policy in code and in the deletion job, not only in the policy document.
- Put data processing agreements in place with every processor, and review the sub-processors.
- Prepare for the 72-hour notification window to the supervisory authority and document who decides.
- Appoint a data protection officer where the thresholds require one, and make sure the role is in the org chart rather than assumed.
- Build privacy by design into new features. The cheapest point to apply data minimisation is before the data is collected.

CCPA and CPRA apply to a business that meets any one of three thresholds: annual revenue above a set figure, buying, selling, or receiving the personal information of a threshold number of consumers, or deriving a set percentage of revenue from selling personal information.

The consumer rights: the right to know, the right to delete, the right to opt out of sale or sharing, the right to non-discrimination, and under CPRA the right to correct and the right to limit the use of sensitive personal information.

- Update the privacy policy with the required disclosures, including the categories collected and the purposes.
- Put the opt-out link on the homepage and honour it across the sale and the sharing of data.
- Provide a consumer request intake path with a response window that meets the statutory deadline.
- Maintain a data inventory that answers what data, where, and for what purpose.
- Update the vendor contracts with the service provider language the statute requires, and check the vendors that handle the data.
- Never penalise a consumer for exercising a right.

### Healthcare data under HIPAA

Start by working out the role. A covered entity transmits health information electronically as a provider, a health plan, or a clearinghouse. A business associate is any organisation that, on behalf of a covered entity, creates, receives, maintains, or transmits protected health information. If a provider uses your product and health information is stored in or transmitted through it, you are a business associate.

- No protected health information may be handled without a signed business associate agreement. The agreement defines the permitted uses, the security obligations, the breach reporting, and the access and audit rights.
- The major cloud providers offer business associate agreements. Get the agreement in place before the data lands, not after.
- Anything that identifies, or could identify, an individual is protected health information. De-identification means stripping all eighteen identifiers: names, every geographic division below a state, any date more precise than a year, telephone and fax numbers, email addresses, social security numbers, account numbers, medical record numbers, health plan beneficiary numbers, certificate and licence numbers, vehicle identifiers, device identifiers, web addresses, IP addresses, biometric identifiers, full-face images, and any other unique identifying number.
- Implement the administrative safeguards: a named security officer, a documented and repeated risk analysis, workforce training, access management procedures, and an incident response procedure.
- Implement the physical safeguards: facility access control, workstation controls, and device and media controls including encryption and a disposal policy.
- Implement the technical safeguards: unique user identification, automatic logoff, audit controls on access to health information, integrity controls, and encryption in transit.
- Prepare for the breach notification rule. A breach is the unauthorised acquisition, access, use, or disclosure of unsecured health information that compromises security. Individuals and the regulator are notified within 60 days of discovery, and the media must be notified within 60 days when more than 500 people in a state are affected.
- Remember that the HITECH Act extended the obligations directly to business associates, so the security obligations are yours and not only the provider's.
- Keep the health information out of the logs, out of the analytics pipeline, and out of the model training set unless it is de-identified and the agreement permits it.
- Audit every access to health information and make the audit log tamper-evident.
