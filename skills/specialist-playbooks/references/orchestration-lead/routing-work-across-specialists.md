# Routing work across specialists

**What to do**

- Read the request for its shape before routing. A request that names no tool and no platform is usually several requests wearing one sentence.
- Identify the domains it touches. Language and runtime, infrastructure and cloud, identity and security, interface and user experience, data and analytics, and delivery automation are separate axes, and a single request commonly spans two or three of them.
- Split the request into sub-problems where each one can be answered by one specialist, and where each one has an independently verifiable output. Splitting by layer usually works: the enumeration step, the validation step, and the implementation step often belong to different specialists.
- Choose the implementation route with a stated preference order. On Windows and hybrid estates, automation-first scripting is usually right; on cloud-native work, the platform tooling wins; where the environment spans both, take the modern cross-platform path for anything that runs outside the Windows boundary and the native path for the rest.
- Sequence the sub-problems so that safety checks happen before the change they gate. Validation, dry run, and approval belong ahead of execution, not after it.
- Return one response: the decomposition, with an owning specialist named for every sub-problem. Reconcile overlapping remits explicitly, state which owner takes the boundary and why, and remove the duplicated guidance so the user does not read the same advice twice.
- Carry context into the decomposition so the owners do not contradict each other. Record for each one the decisions already made, the constraints already established, and the specific question it owns.

**What to watch for**

- Routing on the noun in the request rather than on the operation. "Audit the directory" is an identity task, not a file task, and the wrong specialist produces a plausible answer to a question nobody asked.
- A task that crosses a boundary silently. When identity, cloud and scripting all appear, say so and say which part each specialist owns.
- A decomposition that is only a list. Three separate specialist assignments stapled together is not a synthesis.
- Parallel work where one piece blocks another. Order the sub-problems by dependency where the ordering is real.
- Scope creep from the routing step. Decompose the request that was made, not the request you would have preferred.

**Routing table**

| Shape of the request | Primary owner | Supporting owner |
|---|---|---|
| Windows directory, identity or policy change | Windows infrastructure | Automation scripting |
| Cloud resource lifecycle across subscriptions | Cloud infrastructure | Cross-platform scripting |
| Identity, mail, team or site administration | Workplace suite administration | Graph automation |
| Script or module that has to run in both worlds | Cross-platform scripting | Module architecture |
| Recurring failure across logs and runs | Failure analysis | Workflow orchestration |
| Review, approval and release mechanics | Repository workflow | Release ownership |

**Worked routing examples**

- "Find the stale directory accounts and disable the ones nobody has used in ninety days." The enumeration is a read against the directory and belongs to the Windows infrastructure side, the disable is a mutating operation and belongs to the automation side, and both sit behind a security posture check that runs first. Three sub-problems, three owners, one ordered sequence.
- "Build a cost-aware virtual machine rollout across our subscriptions." The architecture and the cost model belong to the cloud infrastructure side, and the automation that applies it belongs to the cross-platform scripting side, because the rollout will run from a pipeline rather than from a domain-joined host.
- "Scheduled tasks are storing credentials in their arguments." The security review belongs to the hardening side, the rewrite belongs to the Windows scripting side, and the logging that proves it afterwards belongs to the monitoring side.

**How to verify**

- Each sub-problem in the split has one owner and one acceptance criterion.
- The returned decomposition contains no unresolved overlap and no duplicated instruction.
- Every sub-problem in the request appears in the returned decomposition, with nothing silently dropped.
- The safety gating order is respected: no mutating step is sequenced before the check that gates it.

**Reporting the decomposition**

- Present the decomposition as one answer with the reasoning inline, not as a set of per-specialist memos. The user asked one question.
- Where two owners' remits overlap, say so, state the trade-off each would optimise for, and give the decision with a reason. An answer that hides the overlap is less useful than the overlap itself.
- Keep the routing visible in one short section: which specialist owns each sub-problem, what each part requires, and what was decided at the boundary. That section is what lets a reader check your decomposition.
- Report what did not get done. A sub-problem that was skipped, deferred, or answered with a caveat belongs in the report, not in the gap between the report and reality.
- Leave the user with the next concrete action rather than a summary of everything that was considered.

**Permission and safety gates**

- Put the read-only step first every time. An enumeration that shows exactly what would change is the cheapest safety mechanism there is, and it costs one extra call.
- Require an explicit approval boundary before any destructive action, and state what is about to be destroyed before asking.
- Prefer reversible operations to irreversible ones, and where an irreversible operation is unavoidable, produce the backup first.
- Apply least privilege to the automation identity as well as to the person. A script that needs read access should not hold write access.
- Treat a change to a shared environment as a change to production, because the consequences are the same even though the label is different.
