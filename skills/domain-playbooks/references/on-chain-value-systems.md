# On-chain value systems

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

