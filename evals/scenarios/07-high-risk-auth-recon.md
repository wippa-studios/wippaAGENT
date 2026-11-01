# Scenario 07: High-Risk Auth Recon and Audit

## Scenario

07-high-risk-auth-recon

## Intent

Safely update token comparison logic in authentication handlers, requiring recon and security audit.

## Expected primary agent

wippaAGENT

## Expected subagent(s)

- `research-analyst` — recon pass
- `core-developer` — implementation
- `security-reviewer` — security audit

## Acceptance criteria

- A recon pass surveys authentication handlers and token storage before implementation.
- The security review catches timing attack risks in token comparison and requires constant-time compare.

## Acceptance command

- None. The outcome is the security audit; the report assertion below is the check.

## Report must mention

- constant-time
- timing attack
