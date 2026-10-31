# Transactional email deliverability

**What to do**

- Authenticate first. SPF within the ten DNS lookup limit, DKIM with a rotated key and a defined selector per sending domain, and DMARC staged from monitoring to quarantine to reject. Record the aggregate reports and act on them.

**The working stack**

- Authentication records: SPF within the ten DNS lookup limit, DKIM with a rotated key and a defined selector per sending domain, DMARC staged from monitoring through quarantine to rejection with the aggregate reports parsed, and brand indicators through BIMI with a verified certificate where the sending domain qualifies.
- Transport: TLS with MTA-STS and the associated reporting policy, a custom return path so the bounce domain is under your control, and feedback loop registration at the major mailbox providers.
- Providers: the Amazon, SendGrid, Postmark and Mailgun transactional services, or direct SMTP with a client library such as nodemailer when the volume justifies it. Keep the transactional path and the marketing path on separate subdomains with separate reputations.
- Compliance: the CAN-SPAM rules of the United States with the required headers and physical address, GDPR consent and retention, and the one-click unsubscribe mechanism specified in RFC 8058.
- Keep transactional and bulk mail on separate subdomains and separate reputations, so a marketing problem does not cost you password resets.
- Give each message a return path that lands in a domain you control, and process the bounce and complaint webhooks into a suppression list.
- Classify bounces correctly. A hard bounce means the address does not exist and is suppressed permanently. A soft bounce means a temporary delivery failure and gets retried with backoff before it is given up on.
- Keep the list clean. Double opt-in at signup, filtering of role accounts and disposable domains, a sunset policy for inactive addresses, and suppression synchronised across every sending system.
- Warm new domains and IP pools. Send to your most engaged recipients first, ramp the daily volume, and define the checkpoint that stops the ramp.

**What to watch for**

- Complaint rate above one tenth of one percent, which is the line at which sending reputation starts to collapse.
- Bounce rate above two percent as a signal of list decay rather than a delivery problem.
- Blocklist appearances, checked against the major lists, and the postmaster tools the ISPs publish.
- Duplicate suppression entries across systems, so a suppressed address is not mailed by one system while another still lists it.
- Rendering damage in dark mode and in clients that strip CSS.

**How to verify**

- Authentication status checked with a real verifier, not read off the DNS panel.
- Inbox placement measured on a seed list across the major mailbox providers, not inferred from open rates.
- Complaint and bounce rates computed from your own event data over a stated window.
- One-click unsubscribe and the required headers confirmed against the current regulation for the sending jurisdictions.

