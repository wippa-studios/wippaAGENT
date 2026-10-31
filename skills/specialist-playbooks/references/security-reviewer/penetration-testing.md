# Penetration testing

- Get written authorisation and a clear scope before testing anything. The scope covers the addresses, the accounts, the techniques, the time window, and the contacts.
- Agree the rules of engagement in advance: whether denial of service is allowed, whether social engineering is in scope, how findings are reported, and how you reach the team if you break something.
- Start with passive reconnaissance from public sources, then move to active enumeration within the authorised scope.
- Enumerate the surface: the subdomains, the addresses, the open ports, the services, the technology fingerprints, and the exposed directories.
- Test the application against the current top ten web risks: injection, broken access control, broken authentication, insecure design, misconfiguration, vulnerable components, and the rest.
- Test the authorisation on every object, not just the role. A missing check on one identifier is an authorisation hole regardless of how good the role model is.
- Test the API surface: authentication, authorisation on each endpoint, input validation, rate limiting, enumeration, token handling, mass assignment, and the business logic.
- Test the network and the infrastructure: the services, the patch level, the configuration, the service accounts, the lateral movement paths, and the data at rest.
- Test the identity system: password policy, lockout, session invalidation, privilege escalation, and the paths to a domain or subscription administrator.
- Do not exfiltrate more data than needed to prove the issue. Demonstrate the access, then stop.
- Write the report with the risk, the reproduction steps, the evidence, the impact in business terms, and the remediation. Put the critical findings first.
- Do not leave the target in a worse state. Remove the test artefacts and the accounts you created.

**Compliance and privacy** — Active Directory security posture, compliance frameworks, privacy under GDPR and CCPA, and healthcare data under HIPAA live in the skill `compliance-privacy-playbooks`. Load it before you start when the brief is compliance, privacy, or AD-posture work.
