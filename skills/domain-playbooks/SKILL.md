---
name: Domain Playbooks
description: Per-domain how-to playbooks for the domain-specialist subagent: on-chain value systems, payment processing and checkout, regulated financial systems, quantitative modelling and market risk, enterprise risk and control frameworks, constrained-device firmware, fleet-scale connected device platforms, mobile application delivery, real-time game systems, healthcare administration and revenue cycle, Microsoft 365 and Graph administration, transactional email deliverability, search visibility, workplace chat integrations, publishing platforms, and social platform data access. Use this skill when a brief matches one of these domains, and load it before starting domain work.
---

# Domain Playbooks

This skill carries the per-domain how-to playbooks that used to sit in the `domain-specialist` agent definition, so they load when the brief matches one of those domains instead of in every domain-specialist prompt. The `domain-specialist` file keeps every domain in its *What you cover* list, which stays the routing index; the one routing section it keeps inline is *Mobile boundaries*, because that decides which subagent owns the task.

## Playbooks

### On-chain value systems

Smart contract work fails in predictable ways, so design against the failure modes rather than discovering them.

**What to do**

- Model every contract as a state machine with explicit invariants. Write down what must always be true, then make the code enforce it rather than assuming reviewers will notice.

**The working stack**

- Chains: Ethereum and the other EVM networks, Solana, Cosmos SDK chains, Near, Polkadot parachains, Avalanche subnets, and the layer-2 and sidechain deployments that sit on top of them. Each has its own account, signature, fee and finality model, so the choice propagates into the contract design.
- Token standards: ERC-20 for fungible balances, ERC-721 for unique items, ERC-1155 for mixed holdings, ERC-4626 for a vault whose share is itself a token, and the permit and snapshot variants where a wallet or an accounting system needs them.
- Deployment patterns: the proxy and implementation split, the factory contract, deterministic deployment through CREATE2, and the multisig or timelock that owns the upgrade pointer.
- Verification: static analysis with Slither and Mythril, unit tests, fork tests pinned to a mainnet archive block, property-based fuzzing, and invariant tests that assert the system property holds across arbitrary call sequences.
- Pick the chain and the toolchain deliberately. EVM chains, Solana, Cosmos SDK chains, Near and Avalanche subnets have different account, signature and fee models; the abstraction does not survive contact with a production deployment.
- Use the token standard that matches the asset: ERC-20 for fungible, ERC-721 for unique, ERC-1155 for mixed holdings, ERC-4626 for a vault share that must itself be a token. Add permit and snapshot support only when a consumer actually needs it.
- For decentralized finance, treat the oracle as part of the trust boundary. A spot price read from a single liquidity pool is manipulable by a flash loan; use a time-weighted or median feed and enforce staleness limits.
- Make upgrades safe. Proxy patterns need a storage layout that survives the upgrade, a multisig or timelock that owns the implementation pointer, and an initialization function that cannot be called a second time.
- Keep gas a design constraint rather than a cleanup task. Pack storage variables into as few slots as possible, cache repeated reads in memory, use short-circuiting on conditions, batch operations, and prefer external library calls over duplicated inline logic.

**What to watch for**

- Reentrancy through any external call that can call back. Guard state changes that follow a call, or pull the pattern where it applies.
- Arithmetic that assumes a checked operation when the compiler version has moved. Pin the compiler, enable checked arithmetic, and do not hand-roll overflow-safe math.
- Front-running exposure in auctions and swaps. Commit-reveal schemes, private mempool routing and short deadline guards all reduce it; none eliminate it.
- Flash loan and price oracle attack paths when a contract reads external state to make a value decision.
- Keys and signing material in the repository. Deployment should be a multisig over a hardware wallet, and the deployer key should not survive the deployment.
- Verifiable source and deployment scripts. A contract that cannot be verified on a block explorer is unadoptable by anyone else.

**How to verify**

- Unit tests for each contract plus fork tests against a mainnet archive at a fixed block, so the result is reproducible.
- Property-based fuzzing for stateful invariants, plus invariant tests that assert the system property holds across arbitrary call sequences.
- Static analysis with Slither and Mythril, with any finding either fixed or written down with a justification.
- Gas profiling before and after optimization, reported as a snapshot of function cost rather than a percentage claim.
- A measured coverage figure from the coverage tool in use. Do not assert a percentage you did not read off the report.

### Payment processing and checkout

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

### Regulated financial systems

**What to do**

- Treat the ledger as the primary artifact. Every balance must be derivable from an append-only sequence of entries, and every entry must carry the idempotency key, the actor, and the timestamp.

**The working stack**

- Obligations: know your customer and know your own licensing position, because anti-money-laundering duties attach to the business and not only to the technology. Know-your-customer with document verification and liveness checks, politically exposed person (PEP) screening, sanctions and watchlist screening, beneficial ownership resolution, transaction monitoring against typology rules, and suspicious activity reporting on the regulator's own timetable.
- Architecture that survives failure: append-only ledgering, event sourcing with projections, command-query separation (CQRS), the saga pattern with compensating actions instead of a distributed transaction, and idempotent commands keyed end to end.
- Money handling: integer minor units with an explicit currency on every amount, a reconciliation job that runs against the processor and the bank on a fixed cadence, and a settlement file that is parsed rather than assumed.
- Write an explicit transaction state machine: initiated, authorized, captured, settled, disputed, reversed. Ambiguous states are where money disappears.
- Design the audit trail before the feature. Who approved, what changed, what the prior value was, and under which policy. If the audit log is an afterthought it will not survive an examination.
- Implement identity and transaction monitoring as a pipeline, not a form. Identity verification with document and liveness checks, watchlist and politically exposed person screening, beneficial ownership resolution, and risk scoring that feeds a case queue.
- Separate the compliance decision from the business decision. A rule engine evaluates a policy; a human reviews the queue; the outcome is recorded either way.
- Reconcile continuously. Internal balances against the processor, processor against the bank, and settlement files against both.

**What to watch for**

- Distributed transaction failure. Saga patterns with compensating actions, never a two-phase commit across a gateway boundary.
- Duplicate effects from retried requests. Every command carries an idempotency key and the server stores the outcome.
- Data residency and retention rules that differ by jurisdiction. Partition storage by residency requirement and fail closed when it is unclear.
- Personally identifiable financial data in logs, traces, analytics and error messages.
- Regulatory reporting deadlines, which are fixed dates and not backlog items.

**How to verify**

- A reconciliation report showing zero unexplained difference for the period, with the comparison method stated.
- Replay of the ledger from source events to confirm the derived balances reproduce exactly.
- Failure-mode tests that kill the process at each step of a transfer and confirm no partial or duplicated movement.
- Evidence collection mapped to the specific controls being claimed, with the control owner named.

### Quantitative modelling and market risk

**What to do**

- State the hypothesis before the model. A model that is not a falsifiable claim about a mechanism cannot be evaluated.

**The working stack**

- Pricing models: the Black-Scholes formula and its binomial tree equivalent for European options, the binomial tree for American options, Monte Carlo for paths that have no closed form, and the Greeks computed alongside every price.
- Volatility and correlation: implied volatility surfaces, the GARCH family of generalised autoregressive conditional heteroskedasticity models for modelled volatility, cointegration tests before a pairs strategy, and a factor model for decomposing returns.
- Risk and performance: value at risk and expected shortfall with the confidence level stated, the maximum drawdown, the Sharpe ratio, the Sortino ratio, and the profit factor, each with the sampling frequency and the risk-free rate given.
- Portfolio construction: mean-variance optimisation with its constraints, the Black-Litterman approach that blends a prior with a market view, and risk parity that equalises risk contribution rather than capital.
- Execution: volume-weighted (VWAP), time-weighted (TWAP) and participation-rate algorithms, market impact modelled against participation, and the latency and co-location considerations that matter at high message rates.
- Fit on one sample and validate on another that the model never saw. Use walk-forward or rolling out-of-sample windows rather than a single split, and reserve a final untouched period.
- Model the data pipeline honestly: survivorship bias from delisted instruments, look-ahead bias from restatements, corporate action adjustment, and the timestamp you actually could have had.
- Charge real costs. Spread, commission, market impact proportional to participation rate, borrow cost, and funding.
- Size positions by risk, not by conviction, and define the exit before entry: stop level, invalidation signal, and time stop.
- Report the distribution, not the point estimate. Median, interquartile range, worst drawdown, worst month, and the fraction of losing trades.

**What to watch for**

- Parameter fitting on the evaluation set. If a parameter is tuned on the same data used to report performance, the performance is fiction.
- Multiple testing. Every additional hypothesis tested multiplies the chance of a spurious result; account for it explicitly.
- Liquidity assumptions. A strategy that works on daily bars may be unexecutable intraday, and vice versa.
- Correlation breakdown in a crisis. Portfolio weights computed from calm-period correlation are wrong exactly when they matter.
- Regime dependence. A backtest covering one volatility regime is not evidence across regimes.

**How to verify**

- Out-of-sample results with the sample period stated, plus a walk-forward table showing performance per window rather than one aggregate.
- A parameter sensitivity surface. A strategy whose performance collapses when a parameter moves by ten percent is not a strategy.
- Monte Carlo resampling of the trade sequence to a distribution of outcomes, and a bootstrap of the drawdown path.
- Capacity analysis: performance as a function of notional, with the market impact assumption stated.

### Enterprise risk and control frameworks

**What to do**

- Maintain a risk register that names an owner per risk, a current control, and a residual rating. Unowned risks are unmanaged risks.

**The working stack**

- Frameworks to choose between: Basel III for banking with the foundations of the standardised approach and the fundamental review of the trading book (FRTB), COSO for enterprise internal control, ISO 31000 for a general risk process, and Solvency II with the own-risk solvency assessment (ORSA) for insurers, and the expected-credit-loss approach under IFRS 9 for accounting-driven provisions.
- Method: risk identification and mapping, the risk and control self-assessment (RCSA) for the operational estate, key risk indicators with owners and thresholds, a model inventory with independent validation, and a documented appetite statement that the executive actually reads.
- Quantification: exposure by class, stress and scenario analysis, reverse stress testing to find the conditions that would break the organisation, and a limit system where utilisation breaches are visible rather than inferred.
- Separate inherent risk from residual risk after controls, so a control that does not work is visible.
- Build key risk indicators from data that already exists and is trustworthy. An indicator nobody updates is theatre.
- Test controls rather than attesting to them. Sample the population, test the sample, and record the exceptions.
- Run stress tests that are internally consistent: a scenario in which the shock and the response are both modelled, not a single percentage haircut.
- Do reverse stress testing. Find the combination of conditions that would break the organisation, then check whether it is plausible.

**What to watch for**

- Model risk. A model that has never been challenged since approval is a liability, not an asset.
- Concentration that is invisible because it is measured per unit rather than per underlying. Aggregate a shared counterparty, a shared dependency, and a shared geography before declaring diversification.
- Third-party risk. Your provider's failure, breach, or exit is your incident.
- Compliance drift. A control that was compliant at the last annual review and is not now is the normal case, not the exception.

**How to verify**

- A current risk register with dated reviews and named owners.
- Control test results with the sample size and the exception list.
- Model validation records with the challenger model, the comparison, and the conclusion.
- A gap analysis against each named regulatory requirement, with the gap stated rather than a maturity score.

### Constrained-device firmware

**What to do**

- Budget memory before writing features. Know the flash and RAM budget, the per-task stack allocation, and the headroom you are willing to keep. Measure the map output, do not estimate it.

**The working stack**

- Processor families: ARM Cortex-M, STM32, the ESP32 and ESP8266 wireless parts, the Nordic nRF range, PIC, AVR, and RISC-V designs, plus the parts with a hardware floating point unit and the ones without.
- Real-time options: FreeRTOS, Zephyr, RT-Thread and Mbed for a scheduler, and bare metal where the task set is small enough that a scheduler is pure overhead.
- Peripherals and buses: I2C, SPI, UART, CAN, Modbus, and the radio protocols, plus direct memory access for bulk transfers, plus timers, watchdogs and the clock tree.
- Tooling: JTAG and serial-wire debugging, an oscilloscope and a logic analyser for the timing claims, a linker map for the size and stack figures, and a bootloader with checksum or signature validation, a rollback slot and a firmware update path.
- Choose bare metal or an RTOS deliberately. FreeRTOS, Zephyr, RT-Thread and Mbed each suit different constraints; an RTOS on a project that needs twenty microseconds of deterministic latency is overhead, and bare metal on a project with fifteen tasks is a rewrite waiting to happen.
- Keep hardware access behind a hardware abstraction layer so the same logic runs on the development host and the target.
- Design interrupts and tasks to a priority scheme, and give the highest priority work the tightest deadline. Measure worst-case interrupt latency on the target, not the average.
- Use DMA for bulk transfers so the CPU is not the bottleneck, and size buffers for the DMA behaviour of the specific peripheral.
- Include a watchdog, and give it a real recovery path rather than a blind reset.
- Plan the bootloader for field reality: image validation with a checksum or signature, a rollback slot, and an update path that cannot brick the device.

**What to watch for**

- Power, not just performance. Deep sleep modes, clock gating, and batching of radio transmissions usually decide battery life far more than code efficiency.
- Flash wear. Every write cycle counts against the erase budget.
- Stack overflow in interrupt context, which uses the main stack unless configured otherwise.
- Heap fragmentation and dynamic allocation in a system that must run for years.
- Floating point in hot paths on parts without a hardware FPU.

**How to verify**

- Static analysis of the built image for size, plus a stack usage analysis per task.
- Worst-case latency measurement on hardware with an oscilloscope or logic analyser, across several runs.
- A soak test of the full duty cycle for longer than the longest field interval.
- Hardware-in-the-loop tests for the paths that matter, not just host unit tests.

### Fleet-scale connected device platforms

**What to do**

- Design the device identity first. Per-device certificates with a managed rotation and a revocation path, not a shared password baked into firmware.

**The working stack**

- Protocols: MQTT over TLS as the default uplink, MQTT-SN for the constrained radio cases, CoAP for the strictly request-and-response endpoints, LoRaWAN for long range, narrowband IoT for cellular, Zigbee for the mesh, Bluetooth Low Energy for the personal area, and Wi-Fi, cellular and satellite where the device has power and budget for them.
- Platforms: AWS IoT Core, Azure IoT Hub, Google Cloud's device registry, ThingsBoard for the open-source path, and the hosted platforms from Losant and Particle.
- Fleet features: per-device certificates with automated rotation and revocation, device twins or shadows for the desired and reported state, staged over-the-air update with an abort threshold, time synchronisation, and local buffering with resynchronisation for the devices that lose connectivity.
- Provision devices through a factory step that enrols each unit uniquely, then enforce that enrolment at first boot.
- Use MQTT over TLS as the default uplink for constrained devices, with MQTT-SN where the radio makes it necessary, and CoAP where the endpoint model is strictly request and response.
- Push aggregation to the edge. A gateway that filters, aggregates, and translates protocols before the cloud sees the traffic is what makes fleets affordable.
- Design for disconnection. Devices lose connectivity, so buffer locally, resynchronise on reconnect, and make the cloud side tolerate out-of-order and duplicated messages.
- Build the telemetry pipeline to be inspectable. Store the raw payload alongside the parsed fields, because device firmware changes and you will need the original.

**What to watch for**

- Battery life against the reporting interval, which is the single largest operating cost in most fleets.
- Over-the-air update failures. An update that leaves a subset of devices bricked is an outage with a delayed fuse.
- Clock skew. Devices without time synchronisation produce telemetry that cannot be ordered or correlated.
- Certificate expiry and the tooling to renew before it bites.
- Cost per device per month, including egress and message volume.

**How to verify**

- A soak of the fleet at representative scale, with message throughput, end-to-end latency and drop rate measured from the platform side.
- A staged update rehearsal on a device subset with a defined abort threshold and a tested rollback.
- Security review of the enrolment and credential storage path.
- A measured per-device monthly cost for a representative device class.

### Mobile application delivery

**What to do**

- Choose the platform strategy deliberately. Native Swift and Kotlin give the best platform fidelity. React Native, Flutter, Expo and Ionic trade some of that for shared code. Decide on the basis of the native surface you actually need, not on headcount.

**The working stack**

- iOS: Swift with SwiftUI, UIKit where the newer toolkit has no equivalent control, Core Data for the local store, CloudKit for the sync, WidgetKit for the extensions, ARKit for the spatial features, and TestFlight for the distribution before the store.
- Android: Kotlin with Jetpack Compose, Material 3 for the design system, Room for the local database, WorkManager for the deferred work, the navigation component for the flow, DataStore for the preferences, CameraX for the capture, and the Play Console for the release.
- The cross-platform toolchains already named are joined by NativeScript, Xamarin and Ionic for the long tail of estates that need a shared codebase with an existing native base.
- Services and security: the Apple push service and Firebase Cloud Messaging for the notification path, the platform keystores for credential storage, and certificate pinning where the client holds a bearer token.
- Architect for offline from the first version. Local persistence, a write queue, explicit conflict resolution, and background sync. Retrofitting offline behaviour onto an app with a single remote source of truth is a rewrite.
- Keep secrets off the device. Store credentials in the platform keystore, and where a bearer token genuinely must exist, treat the device as hostile and scope the token narrowly.
- Push is a state machine. Handle permission denial, cold start from a notification, notification action routing, and the case where the token rotates.
- Instrument the performance budget: cold start time, memory ceiling, binary size, and crash-free session rate.

**What to watch for**

- Background execution limits. Schedule work through the platform work manager rather than assuming a background process runs.
- Deep link routing that loses state when the app was killed.
- Device fragmentation on Android and the old-device floor on iOS.
- Certificate pinning that breaks when the provider rotates the certificate.
- Store rejection causes: missing privacy declarations, in-app purchase rules, and account deletion requirements.

**How to verify**

- Tests on real hardware, not only simulators.
- A cold start measurement on the oldest supported device.
- Crash-free session rate from the crash reporting service over a stated window, plus a manual reproduction of every fixed crash.
- Accessibility review against the platform guidelines, including screen reader traversal and dynamic type at the largest setting.

### Real-time game systems

**What to do**

- Fix a frame budget and treat it as a contract. A 60 frame per second target on a 60 hertz display leaves roughly 16.6 milliseconds for everything: render, physics, animation, audio and gameplay logic. Spend it deliberately.

**The working stack**

- Engines: Unity with C#, Unreal with C++, Godot, and a custom engine only when the product is the engine. Unity ML-Agents and the Isaac simulator are the usual reinforcement learning targets in this space.
- Architecture: an entity component system where entity counts are high, with contiguous data and systems that scale to a thread; state machines and behaviour trees for gameplay logic; navigation meshes with pathfinding for the agents.
- Netcode: server authority with client prediction and server reconciliation, lag compensation for the shot that was on screen when it was fired, rollback for the cases where the correction is cheaper than the wait, interest management and delta compression to keep the bandwidth down, and matchmaking that balances latency and skill.
- Use an entity component system where the entity count is high and the behaviour set is varied. It keeps data contiguous and makes systems cheap to parallelise.
- Batch render work. Reduce draw calls by merging geometry and instancing, keep level of detail aggressive, and use occlusion culling for interior spaces.
- Profile on the target device with a real capture. The desktop editor profile is not the shipping profile.
- Build netcode on an explicit authority model. Decide what the server owns, what the client predicts, and what gets rolled back when the prediction was wrong.
- Scale multiplayer servers horizontally and make matchmaking aware of latency and skill.

**What to watch for**

- Physics broad phase cost. Use collision layers, sleeping bodies, fixed timesteps and simple colliders where possible.
- Thermal throttling and battery draw on mobile. Performance tiers and dynamic resolution exist for this reason.
- Asset download size, which dominates install conversion.
- Console certification requirements, which are non-negotiable and discovered late otherwise.
- Loot box and virtual currency regulations, which are jurisdiction-specific.

**How to verify**

- Frame time captured on the lowest supported hardware, with the slowest scenes identified.
- Network simulation under artificial latency, packet loss and jitter, with desync measured.
- Load time measured on a cold install.
- A soak of a full match to surface leaks and drift.

### Healthcare administration and revenue cycle

**What to do**

- Map the regulatory frame before changing anything operational. For a US facility that means the CMS Conditions of Participation, the HIPAA Security Rule at 45 CFR 164.308 through 164.312, the Privacy Rule, the Stark Law and Anti-Kickback Statute for physician arrangements, EMTALA in emergency departments, and state licensure and certificate-of-need rules.

**The working stack**

- Interoperability and reporting: HL7 FHIR resources and C-CDA documents for the clinical exchange, the certified health information technology rules of the 21st Century Cures Act, the quality reporting programmes for inpatient providers including MIPS, the hospital-acquired conditions programme, HEDIS and HCAHPS for the measurement, and NHSN for infection surveillance. On the vendor side, the reporting environments from Epic and the credentialing system at CAQH are the usual targets.
- Revenue: the charge description master, the cost report worksheets from the Medicare cost report data system, the enrolment system for providers, and the national provider identifier registry for identity.
- Accreditation and regulation: the survey standards of the Joint Commission, DNV and the Healthcare Facilities Accreditation Program (HFAP), the Conditions of Participation, the Stark Law and the Anti-Kickback Statute for physician arrangements, EMTALA in the emergency department, and the federal and state licensure regimes.
- Keep coding current. ICD-10-CM and ICD-10-PCS for diagnoses and procedures, CPT and HCPCS for outpatient and ancillary work, MS-DRGs for inpatient grouping, and APCs for outpatient payment.
- Work the denial cycle, because it is where the money leaks. Categorise denial reasons, build appeal templates per top reason, and track the overturn rate by reason.
- Close the loop on the federal data systems: HCRIS for cost report data, PECOS for provider enrolment, NHSN for infection surveillance, NPPES for provider identity, and the accreditation body evidence for survey readiness.
- Run quality reporting as a measurement program, not a reporting chore. The hospital readmissions programme, the value-based purchasing programme, the hospital-acquired conditions programme, HEDIS and HCAHPS all have specific measure specifications and deadlines.
- Document to survey standard. Build evidence so that a tracer can be followed end to end.

**What to watch for**

- Denials caused by coding or authorisation problems rather than payer disagreement. Split the categories before deciding it is a contract issue.
- 340B split billing, which is a self-audit matter with real consequences.
- The gap between the charge description master and the codes actually used.
- Plan changes, prior authorisation and network adequacy that quietly break continuity of care.
- Turnover in clinical documentation improvement staff, which resets institutional knowledge.

**How to verify**

- A gap analysis citing the specific CFR section and CMS transmittal for each finding.
- A denial rate computed from claims data over a stated period, with the top reasons and their trends.
- Readiness against the accreditation body's tracer methodology, walked end to end.
- For cost report work, the worksheet lineage traced back to HCRIS source fields.

### Microsoft 365 and Graph administration

**What to do**

- Automate identity and workload changes through the Graph API and the Microsoft Graph PowerShell module rather than through the portal, so that every change is scripted, reviewable and repeatable.

**The working stack**

- Workloads: Exchange Online for the mailbox lifecycle, transport rules and compliance configuration, shared mailboxes, message trace and the unified audit log, Teams site and team lifecycle, and SharePoint site provisioning with guest and external sharing.
- Automation surface: the Graph API and the Microsoft Graph PowerShell module for the call layer, service principals with application roles for the identity, and the admin role assignments for the privileged operations.
- Governance: licence assignment reconciled against actual usage, sensitivity labels and retention applied to the data, and conditional access and multifactor requirements that also cover the service accounts.
- Handle the connection model deliberately. Certificate-based app authentication, managed identity where the workload permits it, and delegated permissions only where a human's own context is genuinely required.
- Build the licence picture before optimising it. Reconcile assigned licences against actual usage, then reclaim rather than purchase.
- Treat Teams and SharePoint as governance surfaces. Validate external sharing and guest access, apply retention and sensitivity labels, and keep the sharing posture aligned with the data classification.
- Audit before you change. Every administrative action should have a read-only pre-check that lists exactly what will be touched.

**What to watch for**

- Least privilege. Automation identities need a role that covers the task and nothing more; broad directory roles in a script are a finding waiting to happen.
- Conditional access and MFA implications for service accounts.
- Retention and legal hold interacting with mailbox lifecycle changes.
- Teams site sprawl and orphaned sites, which cost money and dilute search.
- Throttling on Graph, which requires batching and retry handling.

**How to verify**

- A dry run that prints the intended delta without applying it.
- A post-change reconciliation against the pre-change inventory.
- Permission review of the automation identity against the tasks it performs.
- Export of the audit log entries covering the change window.

### Transactional email deliverability

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

### Search visibility

**What to do**

- Audit the technical layer before touching content. Crawl errors, redirect chains, duplicate titles and canonicals, orphan pages, pagination handling, hreflang, structured data validity and JavaScript rendering.

**The working stack**

- Technical surface: robots.txt, XML sitemaps, canonical URLs, hreflang for the multi-language case, redirect chains, pagination handling, structured data written as JSON-LD against the schema.org vocabulary, and the experience signals expressed as largest contentful paint, interaction to next paint and cumulative layout shift.
- Quality and expertise: the experience, expertise, authoritativeness and trust signals, usually written E-E-A-T that the content quality updates evaluate, and the helpful content baseline that thin or templated pages fail.
- Tooling: Search Console for the real search data, an analytics property for the traffic and engagement, a crawler such as Screaming Frog for the technical audit, PageSpeed Insights for the lab measurement of the core web vitals, and the rich results test for the structured data validation.
- Treat Core Web Vitals as the performance contract: largest contentful paint, interaction to next paint and cumulative layout shift, measured in the field through the search console or a real user monitoring tool, not only in a lab score.
- Build structured data with JSON-LD and validate it against the schema validator and the rich result test.
- Research intent before keywords. Classify each target by what the searcher actually wants, then write the page that answers it, and keep the page structure friendly to featured snippet extraction.
- Earn links rather than buy them. Authority comes from content other people cite.
- Design the internal link graph deliberately. Orphans and hub-and-spoke structures both affect crawl efficiency and topic clustering.

**What to watch for**

- Helpful content and expertise signals. Thin content that rewrites a source is a liability, not an asset.
- Core updates and spam updates. The recovery path is a real content audit, not a keyword refresh.
- Duplicate content across templated pages, which is the most common self-inflicted wound at scale.
- JavaScript-only rendering that the crawler cannot execute or index.

**How to verify**

- A crawl with a full export of status codes, canonical assignment, and heading structure.
- Field data before and after, with the date range and the device split stated.
- Structured data validation output with no errors on the templates you change.
- Ranking movement measured on a fixed keyword set over a fixed window, not cherry-picked winners.

### Workplace chat integrations

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

### Publishing platforms

**What to do**

- Keep custom code to a minimum and keep it to a known shape. Prefer a child theme or a small set of plugins over edits to core, so upgrades stay routine.

**The working stack**

- Core surface: PHP 8 and MySQL or MariaDB, the query builder, custom post types and taxonomies, post meta, the transients API, and the revision and cron behaviour of the core.
- Caching: a persistent object cache in Redis or Memcached in front of the database layer, a page cache at the edge, and a CDN for the static assets. Fix the query count before adding another cache layer.
- Theme and editor layer: classic themes with a child theme, and the full-site editing (FSE) block themes with the block templates, patterns and inner blocks for nested composition.
- Engineering standards: PSR-12 formatting, namespaced plugin code built on the hook system, nonces and capability checks on every privileged action, prepared statements for every query, and output escaping at every render. Operate it with the command line tool for the repeatable jobs, and use the REST API or a GraphQL layer for headless delivery.
- Respect the platform's conventions: the template hierarchy, `WP_Query`, custom post types and taxonomies, meta, and transients. Fighting the query builder is how sites end up with a hundred queries per page.
- Cache in layers. A page cache in front, an object cache for the database layer, and CDN offload for assets. Fix the query count before adding more cache.
- Write plugin code that is namespaced, structured around a small set of public functions with private helpers, and built on the hook system rather than on template overrides.
- Secure every input and output. Nonces on state-changing requests, capability checks on every privileged action, prepared statements for every query, escaping on output, and sanitisation on input.
- Plan the upgrade path. Core, PHP and plugin versions move, and a site that cannot be updated is a site with an unpatched vulnerability.

**What to watch for**

- Autoloaded options bloating every request, and unbounded postmeta queries.
- Cron events that pile up because the site traffic cannot trigger them.
- Admin and plugin directories exposed to the web, and file permissions that let the web server write to code.
- Third-party plugins with a large privilege surface, abandoned maintenance, and undisclosed data egress.

**How to verify**

- A query trace on a page load with the count before and after, reported as a real number from the trace.
- A page weight and Core Web Vitals field measurement.
- A static analysis and a dependency vulnerability scan on the codebase.
- A staged core, plugin and PHP upgrade rehearsal on a copy of the production database.

### Social platform data access

**What to do**

- Choose the provider before you write the client, and make the choice explicit in the design. The official API is the default. A documented alternative with REST, OpenAPI and webhook support is a legitimate choice when the official one does not meet the coverage or cost requirement, and it should be an opt-in configuration rather than a silent substitution.

**The working stack**

- Authentication: OAuth 2.0 with the authorisation code flow and proof key exchange for a user-authorised integration, and bearer tokens for application-only access. Keep the application context and the user context apart, because they carry different scopes and different rate budgets.
- Query surface: the post search and lookup endpoints, the user lookup, the timeline and mention reads, the trend endpoints, and the engagement snapshots. Pagination is cursor-based, so the continuation token has to be carried and stored rather than recomputed.
- Field selection: the expansion parameters that pull referenced objects into the response, and the explicit field lists for the post, user and media objects, so that the payload and the cost stay predictable.
- Delivery and tooling: the account activity webhook with its replay semantics, the higher tiers and the research access programme where the volume justifies it, the OpenAPI contract as the source of truth for the examples, and model context protocol tools where the workflow is agent-driven.
- Put a narrow interface in front of every provider. One method per operation, one normalised response shape, one error taxonomy, so the provider can change without rewriting the callers.
- Normalise at the boundary. Timestamps to a single format, identifiers to strings, pagination cursors to a single abstraction, and error codes to a stable set.
- Record the source version and the request parameters with every stored result. Social data is mutable and expiring, and an unlabelled snapshot is uninterpretable.
- Handle rate limits as ordinary control flow. A 429 is an expected response with a known retry budget, not an exception.
- Keep the credentials out of everything a user or a CI log can see, and treat any credential that appears in public output as compromised.

**What to watch for**

- Pagination that silently stops on an empty page rather than at the end of the cursor chain.
- Retries that duplicate a write. Reads are cheap to repeat, writes are not.
- Webhook replay, and the deduplication that goes with it.
- Empty result sets, suspended accounts, deleted posts and protected content. These are normal conditions and each needs a defined behaviour.
- Documentation that has drifted from the actual contract.

**How to verify**

- A contract test per supported operation, run against the provider's own schema.
- A test matrix covering the success path, an empty result, an invalid query, a rate limited response, a transient upstream failure, a pagination continuation, a webhook retry and missing credentials.
- Examples checked against the current published contract before the change is accepted.

