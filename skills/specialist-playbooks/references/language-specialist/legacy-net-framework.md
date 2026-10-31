# Legacy .NET Framework

Legacy work is mostly about not breaking things.

- Establish the target framework and the C# language version first. .NET Framework 4.8 tops out at C# 7.3, so the newer syntax is not available.
- Measure before you change. A baseline of memory, CPU, and response time tells you whether the change helped.
- Treat the Web Forms page lifecycle as the constraint it is. `PreInit`, `Init`, `Load`, and the control events each have their own rules, and moving work between them changes behaviour.
- Reduce ViewState where the page is heavy. Disable it per control where possible, and use `EnableViewStateMac` deliberately.
- Keep the master page and user controls as the composition model, and do not introduce a second one.
- For WCF, keep the message contracts stable, because they are the wire format. Validate the binding and the security mode.
- Prefer transport security with message security where the service can be upgraded, and keep the client and server clocks synchronised.
- For Windows services, handle the stop and power-management events, and make the service idempotent on restart.
- For Entity Framework 6, watch the lazy-loading proxies and the N+1 pattern. Use eager loading explicitly.
- Keep the Web API or WCF surface backward compatible during a migration. Add the new endpoint, move the callers, then remove the old one.
- Isolate the legacy code behind an adapter so the modern code does not depend on the framework types.
- Set the target framework on new projects and keep the legacy solution building. A migration that breaks the build is a migration that stops.
- Use the `packages.config` to `PackageReference` move as a separate mechanical change, not bundled with behaviour changes.
