# Workplace chat integrations

**What to do**

- Choose the delivery mode on purpose. Socket Mode suits internal tools and avoids running a public endpoint. HTTP mode suits apps that need to be reached from outside.

**The working stack**

- Application surface: the Bolt SDK for the event and interaction handling, the Web API for the outbound calls, the Events API for the subscription, the Socket Mode for the internal tools that should not expose a public endpoint, and the HTTP mode for the apps reached from outside.
- Interaction model: Block Kit blocks for the payloads, interactive components for the buttons and menus, modals for the multi-step forms, the app home tab for the landing surface, and the response URL for the work that takes longer than the acknowledgement window allows. Thread the conversation with the thread timestamp rather than posting flat into the channel.
- Governance: OAuth 2.0 with the narrow scope set, request signature verification on every inbound call, rate limit handling keyed on the returned retry headers, the admin APIs and Enterprise Grid for organisation-wide administration, and the newer surfaces such as canvases, lists and workflow steps where they earn their place.
- Design the OAuth flow properly. Use OAuth 2.0 with granular scopes, request the narrowest scope set that works, and store the token where it can be rotated.
- Verify the request signature on every inbound request before parsing it. An unsigned endpoint is an open relay into your service.
- Build Block Kit payloads for anything interactive. Legacy attachments are deprecated and the newer blocks give you better rendering, accessible labels and cleaner interactivity.
- Make the app resilient to the platform's delivery semantics. Acknowledge events fast, handle duplicate delivery, respond within the acknowledgement window, and use the response URL for anything that takes longer than three seconds.
- Respect the rate limits. Read the returned headers, back off exponentially, and jitter the retry so a fleet of workers does not synchronise.

**What to watch for**

- Scopes that over-request. Ask for the narrow set and expand only when a real feature needs it.
- Tokens in source control or in logs.
- Team and channel churn. A bot that posts into a renamed channel becomes noise, and admins will remove it.
- The bot posting a raw exception into a channel. Users see your stack trace, and so does everyone else in the workspace.

**How to verify**

- Signature verification is exercised in the test suite with a bad signature case.
- A rate limit test that trips the limit and confirms the backoff behaviour.
- The token set the app requests, reviewed against the feature list.
- Manual walkthrough of each interactive component, including keyboard navigation and screen reader labels.

