# Scenario 04: Domain Playbook Load

## Scenario

04-domain-playbook-load

## Intent

Review a payment webhook handler for idempotency and name the domain reference that was loaded.

## Expected primary agent

wippaAGENT

## Expected subagent(s)

domain-specialist

## Acceptance criteria

- The report identifies the double-charge risk when a payment webhook is delivered twice.
- The report names the single domain reference it loaded and quotes the idempotency-key rule from it.

## Acceptance command

- None. The outcome is the written review; the report assertion below is the check.

## Report must mention

- references/payment-processing-and-checkout.md
- network retry cannot double-charge
