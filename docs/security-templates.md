# Treasury protocol security notes

This is an implementation self-review, not an independent audit or a production-readiness certificate. The [single-reward protocol review](security-review.md) still applies only to legacy discriminators 0–9.

## Security model

| Threat                                           | Implemented control                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Many boxes promise the same unique asset         | Fully escrowed finite inventory, unique identifiers may fund only one one-copy bundle, and allocation draws without replacement.                                                                                                                                                                                     |
| One balance is counted in several prizes         | Each bundle owns its own SOL or token escrow. Collection assets transfer into bundle PDA control. Activation requires every declared asset to be funded.                                                                                                                                                             |
| A half-funded append changes live odds           | Funding bundles are excluded from inventory, revisions, and mint capacity. Only atomic activation appends a completed bundle.                                                                                                                                                                                        |
| Creator edits a jackpot after market launch      | Before lock, changes are append-only and revisioned. Lock proves there is no staged tail, permanently blocks additions, and leaves bundle indices, quantities, assets, amounts, reveal time, box mint, and metadata immutable.                                                                                       |
| A pending opening receives a later addition      | Burn-time receipts snapshot the active bundle prefix and treasury revision. Allocation cannot inspect bundles outside that prefix.                                                                                                                                                                                   |
| Known results are reordered around scarce prizes | Requests receive a monotonic sequence. Proofs may be verified out of order, but only the FIFO head may allocate or forfeit.                                                                                                                                                                                          |
| Failed delivery causes a reroll                  | Entropy, allocation, and claims are separate durable states. Per-asset claim bits make retries idempotent against the same selected bundle.                                                                                                                                                                          |
| Relayer redirects a reward                       | The beneficiary is bound at burn. SOL uses that address and token claims require its canonical ATA. Core, Metadata, and Bubblegum destinations are derived from stored ownership transitions.                                                                                                                        |
| Creator dilutes a tradable series                | Lock requires pristine inventory and exact equality between actual supply, recorded issuance, and active bundle copies. It atomically mints missing units, revokes Token-2022 mint authority, and records the permanent lock before trading.                                                                         |
| A holder opens before the market date            | Opening requires a locked treasury and the on-chain clock at or after its immutable reveal timestamp. Transfers remain available before reveal.                                                                                                                                                                      |
| Creator locks while an append is hidden          | The next unused canonical bundle PDA must be empty, every active copy must remain undrawn, and opening counters must be zero. A funded or partially funded tail prevents lock.                                                                                                                                       |
| Missed lock deadline strands issued boxes        | Before reveal, issued treasuries may only use the exact-supply lock. At or after a missed deadline, the creator may permanently retire the treasury into a non-market recovery state: creator mutations stop, existing boxes remain openable, and surplus stays escrowed until all box/opening liabilities are gone. |
| Empty tier freezes issuance                      | Capacity is based on aggregate remaining copies. Zero-copy bundles are skipped by the sampler.                                                                                                                                                                                                                       |
| Large bundle limit overcharges small treasuries  | The compact template account stores only the activated append-only prefix. Activation reallocates by one checked eight-byte slot and charges the authenticated authority the exact rent delta. Depleted slots stay allocated so snapshot indices never move.                                                         |
| Biased or nonterminating selection               | Total tickets are capped at `u32::MAX`; domain-separated SHA-256 rejection sampling uses eight attempts and a deterministic negligible-probability fallback. Property tests cover bounds.                                                                                                                            |
| Token behavior changes the promised amount       | Generic Token-2022 support allowlists only metadata extensions. Transfer fees, hooks, delegates, pausing, and other unreviewed extensions fail closed. Classic tokens reject freeze authority.                                                                                                                       |
| Fungible token is advertised as an NFT           | Legacy NFTs require supply one, zero decimals, no mint authority, no freeze authority, and a one-copy bundle. Token Metadata NFTs also require supply one and zero decimals; any mint/freeze authority must be the canonical Master Edition PDA. Other standards use explicit adapters.                              |
| Creator reclaims backing while claims exist      | Active-bundle recovery requires retirement, zero box supply, and zero pending openings. It releases only undrawn copies; allocated-but-unclaimed quantities stay reserved.                                                                                                                                           |
| Interrupted funding strands assets               | Funding state is resumable. The creator can reclaim each funded tail asset, and `cancelBundle` closes only after every funded asset is marked reclaimed.                                                                                                                                                             |
| Timeout creates a selective reroll               | Timeout never remints a box and never allocates a prize. Any signer may irreversibly forfeit the unrevealed FIFO head after 300 slots, without changing its recipient or redirecting value.                                                                                                                          |
| A front end lies about the locked prize set      | Every active append updates an incremental commitment. Market lock stores a final domain-separated manifest hash covering identity, dates, oracle, supply, services, and the ordered bundle commitment. Optional immutable results carry that hash.                                                                  |
| Permanent receipts force rent onto users         | Result receipts are disabled by default. When enabled, the creator prepays one exact rent reserve per box at market lock; allocation spends only that isolated reserve and the immutable result cannot be closed or changed.                                                                                         |
| A crank drains treasury funds                    | Settlement bounties are optional, fixed at creation, capped by box supply, fully prepaid by the creator at lock, and held separately from prize inventory. Each opening can decrement the bounty count only once.                                                                                                    |
| A small bounty prevents treasury lock            | Any enabled service account receives its zero-data rent-exempt reserve in addition to the exact receipt-and-bounty reserve. The floor is isolated from payouts and recovered only when the service account closes.                                                                                                   |
| A large mixed prize cannot be delivered          | Every asset has an independent claim bit. The TypeScript SDK keeps each asset transfer atomic, partitions delivery by transaction size and account count, then refetches the opening before continuing.                                                                                                              |
| A sponsor or relayer steals rent or prizes       | The burn authority, beneficiary, transaction payer, and rent-refund address are separate immutable bindings. Claims use only the beneficiary, while opening rent returns only to the original payer.                                                                                                                 |
| A consumer replays an integration result         | The receipt binds the intended consumer program and 32-byte context. Consumers must verify the canonical PDA, program owner, all bindings and manifest hash, then persist their own one-time-use marker.                                                                                                             |

## Oracle and FIFO liveness

Switchboard is an external trust and availability dependency. Requests bind the known program ID, queue, oracle, opening PDA authority, seed slot, and randomness account. Fulfillment rechecks those bindings, requires a later reveal slot, and compares the supplied signed value to the value persisted by the oracle CPI.

A holder may see a gateway proof before it appears on chain. Consequently, returning their box or recommitting fresh randomness after timeout would permit selective rerolls. The treasury protocol instead offers permissionless forfeiture after a fixed 300-slot deadline: the burned claim is lost, no inventory is consumed, the bound beneficiary is unchanged, and the FIFO queue advances. This prevents an inactive beneficiary from blocking all later openings, but it also makes the reveal deadline final; the UI discloses that tradeoff before opening. This preserves economic fairness but does not provide a positive payout guarantee during an oracle outage.

Production needs monitored relayers, durable proof transport, incident procedures, a real-network soak, and clear user disclosure. A separately funded relayer wallet can sponsor permissionless verification/allocation/claim calls. The prize treasury itself is not an uncapped fee reserve.

## Adapter boundaries

The program recognizes seven stored kinds: SOL, classic SPL token, strict legacy NFT, safe Token-2022 token, Token standard Metadata NFT, Core asset, and compressed NFT.

- Metadata transfers validate the metadata PDA and mint relationship. Programmable token records and authorization rules fail closed because mutable third-party rules could strand a funded prize.
- Core transfers currently admit only uncollected assets with no plugins or external adapters, avoiding mutable transfer delegates and collection policy.
- Compressed transfers validate the stored asset ID and forward the exact tree, root, hashes, nonce, leaf index, and Merkle proof to Bubblegum.
- Fresh dynamic accounts are required again at claim or reclaim time. A stale proof or changed plugin/rule set fails instead of silently downgrading to a generic transfer.
- Program IDs are pinned. Remaining-account flags and ordering remain part of the adapter contract and require compatibility tests against deployed external programs.

The local Surfpool suite deploys the Lootbox SBF and token programs, but it does not deploy production Token Metadata, Core, Bubblegum, compression, or Switchboard services. Those integrations are implemented and fail closed at their account/CPI boundaries; devnet fixtures remain a release gate.

## Lifecycle and upgrade trust

Market lock and retirement are both one-way. Market lock revokes mint authority and blocks appends while preserving transfer and later opening; retirement preserves those holder rights while stopping the creator lifecycle. Outstanding standard box tokens do not expire. A pre-lock token burned outside the program prevents exact market lock because actual supply no longer matches recorded issuance. Before reveal, the creator cannot retire around that invariant. Once the reveal deadline has already been missed, retirement becomes a bounded non-market recovery seal: the canonical program mint authority remains visible, but retired-state checks make it unusable, holders can still open, and surplus cannot be reclaimed until live supply and pending openings are zero.

The deployed program's upgrade authority can replace all logic. A production release must publish its authority policy and use a reviewed multisig/timelock or immutable deployment. Immutable on-chain metadata pointers do not make the content served by an HTTP/IPFS gateway immutable; the on-chain bundle manifest is authoritative.

## Browser and API boundary

The playground accepts only loopback HTTP origins/RPC URLs, the expected program IDs, and an explicit test-only network marker. It generates disposable browser wallets and stores their seeds in origin-scoped localStorage. They are unencrypted and unsuitable for value. Never import real keys or send real funds.

Jupiter and DAS credentials stay in the local server process. Queries, response sizes, timeouts, body sizes, host/origin values, and caches are bounded. Catalog verification badges are signals, not endorsements. The exact address, program, extensions, transfer rules, plugins, and proof freshness still determine whether funding succeeds.

The playground mirrors catalog selections into fixed-supply local fixtures. A successful Surfpool interaction does not prove ownership or transferability of a mainnet asset.

## Verification performed

- Rust unit and property tests cover all 1,024 indices, compact layout bounds, snapshot prefixes, finite depletion, FIFO, claim masks, capacity, arithmetic, timeout forfeiture, retirement, and parsers.
- Surfpool executes real program/token transactions for staged funding, activation, cancellation/reclaim, exact issuance, mint-authority revocation, pre-reveal rejection, transfer, six FIFO openings, missed-deadline recovery, SOL/token/NFT delivery, redirect rejection, duplicate-claim rejection, retirement, recovery, and receipt closure.
- The independent Surfpool workspace is audited separately. Surfpool 1.5.0 is currently the latest release; its documented RustSec exceptions are confined to the offline, host-only test graph and must be re-evaluated when Surfpool updates. None is linked into the program, SDK, or web application artifacts.
- TypeScript, Rust, and Dart planners share ticket, asset-count, uniqueness, amount, and collateral limits.
- TypeScript generated/high-level clients, Dart analysis/tests, proxy tests, React tests, production build, and desktop/mobile Playwright flows are part of the verification target.

## Remaining release gates

1. Independent program and SDK audit.
2. Real Switchboard integration, outage drills, monitored relayers, and sustained devnet soak.
3. Devnet compatibility tests for Metadata transfer rules, Core plugins/adapters, Bubblegum, compression, and safe Token-2022 mints.
4. Published upgrade-authority and emergency communication policy.
5. Production wallet transaction simulation, finality, priority-fee, RPC failover, and observability strategy.
6. Jurisdiction-specific review for randomized rewards, disclosures, eligibility, age gates, and any purchase flow.
7. Production Raydium/Jupiter integration using a real wallet, audited market adapter, supported Token-2022 configuration, liquidity policy, and market-risk disclosures.

Do not use this build for real-value deposits until those gates are complete.
