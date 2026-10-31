# Payment processing and checkout

**What to do**

- Design the money flow before the code. Separate the customer-facing intent, the gateway interaction, the internal ledger entry, and the settlement record, and make each idempotent.

**The working stack**

- Gateway styles: direct API integration, hosted checkout pages, and the mobile software development kits. API access gives the most control, hosted pages give the least friction, and the choice should follow the risk profile of the product rather than conversion folklore.
- Authentication: authorisation, capture, void, partial refund and settlement. Splitting authorisation from capture is what lets you reserve funds at checkout and take the money later, and getting it wrong means you refund instead of cancelling.
- Fraud controls: address verification (AVS), card verification value matching (CVV), three-dimensional secure step-up, velocity rules per account and per card, and a risk score that combines them. Each is a separate decision with its own false-positive cost.
- Recurring billing: trial handling, plan changes with proration, dunning schedules with retry intervals, cancellation that respects the paid period, and a recovery path that stops after the agreed attempt count.
- Use idempotency keys on every create, capture and refund call so a network retry cannot double-charge. Store the key with the resulting transaction reference.
- Handle webhooks as the source of truth about what happened at the gateway, not the browser redirect. Acknowledge quickly, enqueue, and process asynchronously with your own deduplication on the event id.
- Tokenize card data at the gateway and keep only the token. That single decision removes most of the cardholder data environment and is the difference between a self-assessment and a full assessment of PCI DSS scope.
- Implement 3D Secure and Strong Customer Authentication where the region requires it, and step up only the transactions that need it rather than applying it universally.
- Build the subscription lifecycle properly: trials, plan changes with proration, dunning schedules, retry attempts, and cancellation that takes effect at the end of the paid period.

**What to watch for**

- Race conditions between the browser returning from checkout and the webhook arriving. Both paths must land on the same idempotent transition.
- Amount and currency mismatch between your internal order and what the gateway charged. Assert them server side.
- Floating point for money. Use integer minor units throughout and be explicit about which currency a stored amount is in.
- Chargebacks and disputes. Keep the evidence trail: order, authorization, capture, delivery, and customer communications in one retrievable place.
- Secrets on the client. Publishable keys belong in the app, secret keys never do.

**How to verify**

- Sandbox transactions for the full lifecycle including declined, expired, and refunded cards.
- A fault-injection pass that kills the process between the gateway call and the local write, then confirms the state converges.
- Reconciliation against the gateway settlement file, run daily, with a zero-difference report rather than a sampled check.
- Reported success rate and processing latency measured from your own logs over a stated window.

