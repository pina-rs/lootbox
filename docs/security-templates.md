# V2 security notes

This is an implementation self-review, not an independent audit or a production readiness certificate. The previous [v1 review](security-review.md) still applies to legacy instructions. V2 uses different accounts, instructions, and economics.

## Threats addressed in the implementation

| Threat                                                              | Control and reason                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Many boxes promise the same unique NFT                              | Draw without replacement from fully escrowed finite inventory. A probability buffer cannot duplicate an NFT.                                                                                                        |
| Counting one balance toward multiple outcomes                       | Each bundle owns separate asset escrow accounts. A transfer funds each recorded prize; declaring an amount does not fund it.                                                                                        |
| Creator removes collateral after issuance                           | No general withdrawal authority. Retirement stops minting; recovery requires zero live box supply and zero unallocated openings, and excludes allocated but unclaimed prizes.                                       |
| Updating the jackpot or odds after people acquire boxes             | Prize terms, per-unit weights, metadata pointers, and claim date are frozen. Only inventory counts and lifecycle bookkeeping change.                                                                                |
| One result is submitted before another to capture the remaining NFT | Request-time FIFO sequence fixes allocation order. Proofs can be persisted out of order, but allocations cannot skip the queue.                                                                                     |
| Failed prize transfer causes a reroll                               | Verified entropy and allocation are separate transactions from delivery. Each asset has a claim bit; retries use the same recorded outcome.                                                                         |
| A relayer redirects the prize                                       | The burn signer is stored as recipient. Claims require that exact recipient; token destinations must be their canonical ATA.                                                                                        |
| Mint more NFTs later or freeze the winning asset                    | NFT prizes require supply one, zero decimals, revoked mint authority, no freeze authority, and bundle quantity one. All reward mints reject freeze authority.                                                       |
| Transfer fee, hook, or permanent-delegate surprises                 | Initial reward support is classic SPL only. Token-2022 box mints allow only standard metadata extensions, with pointer/update authority revoked.                                                                    |
| Mutable or misleading box metadata                                  | Metadata pointer targets the box mint; on-mint name/URI must match the template and update authority must be absent. An external URI can still serve mutable content; the on-chain prize manifest is authoritative. |
| Arithmetic overflow or biased weighted indexing                     | Checked u64 arithmetic, positive quantities and weights, bounded `weight × remaining`, and the existing bounded rejection sampler.                                                                                  |
| Opening before a specified date                                     | Request checks Solana's Clock Unix timestamp before the burn and commitment. The date applies to all tokens from that template.                                                                                     |
| Creator-controlled oracle or pre-revealed entropy                   | Known Switchboard program IDs only; fresh randomness account, opening-PDA authority, queue/address/slot binding, atomic commit and burn, verified reveal CPI.                                                       |

## What remains a release gate

### Oracle liveness

V2 intentionally has no timeout refund/reroll or arbitrary fallback winner. A recipient who learns an unfavorable result must not be able to discard it and re-enter the pool. Unlike v1 SOL-only rewards, there is no objective minimum across different NFTs and tokens.

This means an unavailable or permanently expired oracle proof can block FIFO allocation. Relayers can save later proofs while waiting, but that does not repair the missing proof at the head of the queue. Durable proof availability, monitored permissionless relaying, outage recovery, and a real Switchboard devnet soak need to be resolved before accepting real-value deposits. Full collateral does not guarantee immediate delivery.

### Upgrade and metadata trust

The Solana program's upgrade authority can replace program logic. Any production deployment must publish its upgrade policy and authority, and preferably use a reviewed multisig/timelock or immutable deployment. Nothing in these tests removes that trust assumption. Off-chain metadata URLs can change content independently of their immutable on-chain URL.

### Asset coverage and fund lifecycle

Compressed NFTs, Metaplex programmable transfer rules, frozen NFTs, Token-2022 reward assets, and arbitrary token adapters are not supported. A token with one unit and no mint authority proves supply constraints, not artistic authenticity.

Allocated prizes can be claimed after retirement. Unopened tokens have no expiry; their backing cannot be recovered simply because their holders disappear. Template and bundle account rent remains allocated for discoverability; opening/oracle rent can be reclaimed after all assets are delivered. Oracle lookup-table lifecycle limitations from v1 still need a real-network review.

### Local test infrastructure

The mock Switchboard program verifies account relationships and lifecycle but does not verify real enclave signatures. Anyone controlling the local RPC can alter test state. Never deploy it to devnet/mainnet or describe its results as cryptographically verified production randomness.

The local control plane binds loopback only, rejects unexpected Host/Origin headers, serves no private keys, and caps request bodies. Its faucet, proof endpoint, and clock controls are strictly local test conveniences, not a hosted backend.

The browser additionally rejects non-loopback origins/RPC URLs, credentials embedded in RPC URLs, unexpected program IDs, and configurations without the explicit test-network marker. Disposable test seeds are generated in-browser and stored in localStorage, namespaced by a random network instance id. That storage is not encrypted or appropriate for valuable funds: an origin compromise can read it. No imported or real wallet is supported. Restarting Surfpool isolates new wallets from the old instance; clearing browser storage loses saved draft signers and test-wallet access.

Browser integration caught a zero-based prize-tag mismatch in the handwritten client (`SOL=0`, `token=1`, `NFT=2`). The mismatch sent the wrong delivery instruction, which the program rejected; it did not allow redirecting rewards. The decoder is corrected, unknown tags fail closed, a unit test fixes the ABI mapping, and browser tests check actual recipient SOL/token/NFT balances after claiming every outcome.

Creation persists stable draft signers only after plan validation and compares already-funded assets, weights, and immutable metadata before resuming. An out-of-funds browser test funds two bundles, reloads, tops up the creator, then funds only the remaining bundle. Proof transport failure after a successful burn is recoverable from the on-chain opening receipt. The UI does not claim a new random result during retry. Transaction confirmation timeout reports its signature and requires a chain refresh rather than automatically duplicating a mint/open.

The TypeScript transaction helper currently confirms at `processed` commitment for local Surfpool. It is not a production finality policy. A public frontend must use production wallet signing and stronger confirmation/reconciliation, and must not expose this test control plane or mint emulator assets as real prizes.

The isolated Surfpool host dependency graph still has the seven advisories recorded in the [v1 review](security-review.md): `RUSTSEC-2024-0344`, `RUSTSEC-2022-0093`, `RUSTSEC-2026-0258`, `RUSTSEC-2024-0421`, `RUSTSEC-2026-0104`, `RUSTSEC-2026-0098`, and `RUSTSEC-2026-0099`. A separate `cargo audit --file programs/lootbox_program/tests/surfpool/Cargo.lock` fails on these; they are not fixed or suppressed here. `cargo tree` traces them through Agave precompiles and Surfpool's `txtx`/JSON-RPC HTTP dependencies, which require incompatible major-version changes to replace. The production-workspace and mock-oracle audits pass separately. The native JavaScript simulator is also test infrastructure; a clean npm audit alone does not certify its embedded Rust dependency graph.

Surfpool 1.5 uses bounded observer channels; long test journeys drain those channels. Its time-travel helper sets an epoch-relative Clock slot across epoch boundaries. The harness uses 400 ms slots and an intra-epoch one-hour date jump; that test does not validate cross-epoch Surfpool time travel. Offline transactions confirm at processed commitment rather than waiting for network finality on a single-node simulator. These accommodations do not weaken any checks in the lootbox program.

Codama's Dart renderer generates `Object.hash` calls with more than Dart's 20-argument limit for large accounts. `clean:generated` reproducibly replaces those calls with `Object.hashAll`, covered by a regression test. Generated output must always be reproduced through this pipeline.

## Verification scope

Unit/property tests cover finite inventory conservation, exhausted odds, pending liability, FIFO rejection, per-asset claim replay, destination binding, duplicate collateral, overflow, metadata bounds, and retirement liabilities. Rust Surfpool journeys and desktop/mobile browser tests exercise real SBF and token programs, with only the oracle emulated. Browser tests additionally cover reload recovery, insufficient-funds resumption, pre-unlock token transfer, offline UI, and RPC balance assertions. Hosted deployment, production wallet/oracle integration, probabilistic reserve accounting, and an independent audit remain incomplete; consult the live checklist in the v2 specification.

The 2026-09-04 local verification passed `lint:all`, regenerated/formatted all three clients without ABI drift, passed the Rust/TypeScript/Dart unit suites, three real-SBF Surfpool journeys, the HTTP smoke test, five web unit tests, eight desktop/mobile browser tests, and the production web build. Production-workspace and mock-oracle Rust dependency checks passed. `pnpm audit --audit-level high` repeatedly failed with `ERR_SOCKET_TIMEOUT` from npm's advisory endpoint; the combined `verify:all` run is therefore not a clean pass. This external check remains unresolved and must not be treated as evidence of no JavaScript advisories.
