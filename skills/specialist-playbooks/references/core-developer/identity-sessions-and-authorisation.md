# Identity, sessions, and authorisation

Authentication is where a system either earns trust or loses it. Treat every token, every callback, and every redirect as hostile input until the code proves otherwise.

- Use authorisation code flow with PKCE for every interactive client, including single-page apps. Do not use the implicit grant. Do not use the resource owner password grant.
- Use client credentials for machine-to-machine calls and device authorisation for input-constrained hardware. Use token exchange when a service needs to act on behalf of a user.
- Discover provider capabilities through `.well-known/openid-configuration` and cache the JWKS with a refresh that survives key rotation.
- On every request, verify the token signature, the issuer, the audience, the expiry, and the not-before. Pin the expected algorithm and reject `alg: none` and any algorithm-confusion attempt. Never fetch a key from a URL the token itself supplies.
- Generate `state` and `nonce`, store them, and validate them on callback. They are the CSRF and replay defence for the flow.
- Match redirect URIs exactly against an allowlist. A prefix match is an open redirect.
- Rotate refresh tokens and detect reuse. A replayed refresh token should revoke the whole token family, not just the one token.
- Keep access tokens short-lived. Long-lived tokens need a revocation story that stateless verification cannot provide, so either shorten their life or keep the session state server-side.
- Bound clock skew explicitly. An unbounded tolerance turns a token into a credential that stays valid for as long as the tolerance window.
- Set session cookies `HttpOnly`, `Secure`, and `SameSite`. Regenerate the session identifier on any privilege change so a fixated identifier cannot inherit new rights.
- Define both an idle timeout and an absolute lifetime, and a concurrent session limit with a device list the user can revoke.
- Enforce authorisation on the server, at the data access layer, next to the query. A check in the interface is a suggestion.
- Resolve the tenant from a verified token claim or a trusted host header, never from a request body field.
- Model organisation, workspace, and membership explicitly. Decide whether roles are hierarchical, whether attributes can override them, and how a permission string is composed.
- Enrolment and recovery paths need the same care as login. TOTP enrolment with drift handling, WebAuthn and passkey registration, hashed single-use recovery codes, step-up authentication for sensitive operations.
- Treat magic links carefully. Expiry, single use, and binding to the intended session all matter, and the link must not be replayed into a different account.
- Treat SMS one-time codes as the weakest factor you have. Every other factor should be available alongside it.
- Account recovery must not be a bypass around multi-factor. The recovery path is the attack path, so instrument it separately.
- SAML assertions need signature, `Audience`, `NotOnOrAfter`, and `Recipient` checked, and the assertion `ID` recorded to prevent replay. Guard against XML signature wrapping by validating the signed element and not a detached copy.
- For enterprise identity, support SCIM 2.0 provisioning and deprovisioning so access dies when the directory entry does.
- Centralise token verification in one module. Scattered verification is how one endpoint ends up accepting an unverified claim.
- Put an audit trail on identity events: sign-in, sign-out, factor enrolment, role change, token revocation. An audit trail that omits privilege changes is not an audit trail.
- When you change token formats, run both validators during the overlap window and cut over per client type rather than in one release.
