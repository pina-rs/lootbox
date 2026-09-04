# V2 security notes

This is an implementation self-review, not an independent audit or a production-readiness certificate. The [v1 review](security-review.md) still applies only to legacy discriminators 0–9.

## Security model

| Threat                                           | Implemented control                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Many boxes promise the same unique asset         | Fully escrowed finite inventory, unique identifiers may fund only one one-copy bundle, and allocation draws without replacement.                                                                                                                                                        |
| One balance is counted in several prizes         | Each bundle owns its own SOL or token escrow. Collection assets transfer into bundle PDA control. Activation requires every declared asset to be funded.                                                                                                                                |
| A half-funded append changes live odds           | Funding bundles are excluded from inventory, versions, and mint capacity. Only atomic activation appends a completed bundle.                                                                                                                                                            |
| Creator edits a jackpot after distribution       | Bundle indices, quantities, assets, amounts, unlock time, box mint, and metadata are immutable. Live changes are append-only and versioned.                                                                                                                                             |
| A pending opening receives a later addition      | Burn-time receipts snapshot the active bundle prefix and treasury version. Allocation cannot inspect bundles outside that prefix.                                                                                                                                                       |
| Known results are reordered around scarce prizes | Requests receive a monotonic sequence. Proofs may be verified out of order, but only the FIFO head may allocate or forfeit.                                                                                                                                                             |
| Failed delivery causes a reroll                  | Entropy, allocation, and claims are separate durable states. Per-asset claim bits make retries idempotent against the same selected bundle.                                                                                                                                             |
| Relayer redirects a reward                       | Recipient is bound at burn and must pay/sign the reveal. SOL uses that address and token claims require its canonical ATA. Core, Metadata, and Bubblegum destinations are derived from stored ownership transitions.                                                                    |
| Creator overissues boxes                         | Both cumulative activated-copy capacity and current `supply + pending <= remaining inventory` are checked with overflow-safe arithmetic.                                                                                                                                                |
| Empty tier freezes issuance                      | Capacity is based on aggregate remaining copies. Zero-copy bundles are skipped by the sampler.                                                                                                                                                                                          |
| Biased or nonterminating selection               | Total tickets are capped at `u32::MAX`; domain-separated SHA-256 rejection sampling uses eight attempts and a deterministic negligible-probability fallback. Property tests cover bounds.                                                                                               |
| Token behavior changes the promised amount       | Generic Token-2022 support allowlists only metadata extensions. Transfer fees, hooks, delegates, pausing, and other unreviewed extensions fail closed. Classic tokens reject freeze authority.                                                                                          |
| Fungible token is advertised as an NFT           | Legacy NFTs require supply one, zero decimals, no mint authority, no freeze authority, and a one-copy bundle. Token Metadata NFTs also require supply one and zero decimals; any mint/freeze authority must be the canonical Master Edition PDA. Other standards use explicit adapters. |
| Creator reclaims backing while claims exist      | Active-bundle recovery requires retirement, zero box supply, and zero pending openings. It releases only undrawn copies; allocated-but-unclaimed quantities stay reserved.                                                                                                              |
| Interrupted funding strands assets               | Funding state is resumable. The creator can reclaim each funded tail asset, and `cancelBundle` closes only after every funded asset is marked reclaimed.                                                                                                                                |
| Timeout creates a selective reroll               | Timeout never remints a box and never allocates a prize. Any signer may irreversibly forfeit the unrevealed FIFO head after 300 slots, without changing its recipient or redirecting value.                                                                                             |

## Oracle and FIFO liveness

Switchboard is an external trust and availability dependency. Requests bind the known program ID, queue, oracle, opening PDA authority, seed slot, and randomness account. Fulfillment rechecks those bindings, requires a later reveal slot, and compares the supplied signed value to the value persisted by the oracle CPI.

A holder may see a gateway proof before it appears on chain. Consequently, returning their box or recommitting fresh randomness after timeout would permit selective rerolls. V2 instead offers permissionless forfeiture after a fixed 300-slot deadline: the burned claim is lost, no inventory is consumed, the bound recipient is unchanged, and the FIFO queue advances. This prevents an inactive recipient from blocking all later openings, but it also makes the reveal deadline final; the UI discloses that tradeoff before opening. This preserves economic fairness but does not provide a positive payout guarantee during an oracle outage.

Production needs monitored relayers, durable proof transport, incident procedures, a real-network soak, and clear user disclosure. A separately funded relayer wallet can sponsor permissionless verification/allocation/claim calls. The prize treasury itself is not an uncapped fee reserve.

## Adapter boundaries

The program recognizes seven stored kinds: SOL, classic SPL token, strict legacy NFT, safe Token-2022 token, Token Metadata NFT/pNFT, Core asset, and compressed NFT.

- Metadata transfers use `TransferV1`, validate the metadata PDA and mint relationship, and accept the required edition, token-record, and rule accounts as an explicitly ordered tail.
- Core transfers validate program ownership, asset identity, collection, and forwarded plugin/external-adapter accounts.
- Compressed transfers validate the stored asset ID and forward the exact tree, root, hashes, nonce, leaf index, and Merkle proof to Bubblegum.
- Fresh dynamic accounts are required again at claim or reclaim time. A stale proof or changed plugin/rule set fails instead of silently downgrading to a generic transfer.
- Program IDs are pinned. Remaining-account flags and ordering remain part of the adapter contract and require compatibility tests against deployed external programs.

The local Surfpool suite deploys the Lootbox SBF and token programs, but it does not deploy production Token Metadata, Core, Bubblegum, compression, or Switchboard services. Those integrations are implemented and fail closed at their account/CPI boundaries; devnet fixtures remain a release gate.

## Lifecycle and upgrade trust

Retirement is one-way and blocks minting and appends, but holders keep their opening and claim rights. Outstanding standard box tokens do not expire. If a holder loses or deliberately burns one outside the program, the creator cannot force recovery until live mint supply is zero; after safe retirement, only still-undrawn inventory is recoverable.

The deployed program's upgrade authority can replace all logic. A production release must publish its authority policy and use a reviewed multisig/timelock or immutable deployment. Immutable on-chain metadata pointers do not make the content served by an HTTP/IPFS gateway immutable; the on-chain bundle manifest is authoritative.

## Browser and API boundary

The playground accepts only loopback HTTP origins/RPC URLs, the expected program IDs, and an explicit test-only network marker. It generates disposable browser wallets and stores their seeds in origin-scoped localStorage. They are unencrypted and unsuitable for value. Never import real keys or send real funds.

Jupiter and DAS credentials stay in the local server process. Queries, response sizes, timeouts, body sizes, host/origin values, and caches are bounded. Catalog verification badges are signals, not endorsements. The exact address, program, extensions, transfer rules, plugins, and proof freshness still determine whether funding succeeds.

The playground mirrors catalog selections into fixed-supply local fixtures. A successful Surfpool interaction does not prove ownership or transferability of a mainnet asset.

## Verification performed

- Rust unit and property tests cover 256 indices, snapshot prefixes, finite depletion, FIFO, claim masks, capacity, arithmetic, timeout forfeiture, retirement, and parsers.
- Surfpool executes real program/token transactions for staged funding, activation, cancellation/reclaim, issuance, pre-unlock rejection, transfer, six FIFO openings, SOL/token/NFT delivery, redirect rejection, duplicate-claim rejection, retirement, recovery, and receipt closure.
- TypeScript, Rust, and Dart planners share ticket, asset-count, uniqueness, amount, and collateral limits.
- TypeScript generated/high-level clients, Dart analysis/tests, proxy tests, React tests, production build, and desktop/mobile Playwright flows are part of the verification target.

## Remaining release gates

1. Independent program and SDK audit.
2. Real Switchboard integration, outage drills, monitored relayers, and sustained devnet soak.
3. Devnet compatibility tests for Metadata/pNFT rules, Core plugins/adapters, Bubblegum, compression, and safe Token-2022 mints.
4. Published upgrade-authority and emergency communication policy.
5. Production wallet transaction simulation, finality, priority-fee, RPC failover, and observability strategy.
6. Jurisdiction-specific review for randomized rewards, disclosures, eligibility, age gates, and any purchase flow.

Do not use this build for real-value deposits until those gates are complete.
