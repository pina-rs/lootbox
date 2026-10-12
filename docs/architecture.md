# Architecture

## Design goals

The treasury-template protocol optimizes for a small auditable core:

- one box token equals one future draw;
- every bundle is fully escrowed before any box exists;
- oracle initialization, commitment, and box burn happen atomically;
- oracle reveal, allocation, and claim delivery are permissionless relays;
- payouts can never depend on the authority remaining online;
- every outstanding claim is funded at its worst possible value.

A template controls a zero-decimal Token-2022 box mint and an append-only inventory of prize bundles. Opening burns one box before randomness is known, records the exact Switchboard commitment, then allocates one escrowed bundle uniformly without replacement after that commitment is revealed.

## Accounts

### `TemplateState`

Treasury template derived from `['template', authority, id]`. It stores the box mint, selected Switchboard program and queue, bundle inventory counters, activated ticket accounting, market-lock and reveal terms, and canonical PDA bumps. See [Treasury templates](treasury-templates.md).

### `BundleState`

Prize bundle derived from `['bundle', template, index]`. It stores up to four fully escrowed prize assets, its ticket count, and funding/activation status. Activation appends a funded bundle to the template's live inventory and its tickets to the issuance cap.

### `TemplateOpeningState`

Per-draw receipt derived from `['template-opening', template, randomness]`. It binds the burned box to one randomness account, seed slot, and beneficiary, and records the entropy-verified allocation outcome.

### `ResultReceiptState`

Immutable allocation result derived from `['result-receipt', opening, sequence]`. It binds one allocated asset slot to its opening so each prize can be claimed independently.

The remaining program-owned accounts — `PrizePoolState`, `PrizePoolItemState`, `ExclusiveCollectionState`, `ExclusiveAttachmentState`, and `BoxCurveState` — hold Bubblegum prize-pool custody, layered Exclusive NFT collections, and box bonding curves; [PrizePools](prize-pools.md), [Exclusive NFTs](exclusive-nfts.md), and [Box curves](box-curves.md) document them.

## State transitions

```text
draft --add_bundle/fund--> staged --activate_bundle--> live --lock_treasury--> locked
                                                                   |
             request_open + init CPI + commit CPI + burn           v
                                    +--------------------------- pending
                                    |        fulfill (reveal CPI)
                                    |  timeout, unrevealed FIFO head    |
                                    |                                  v
                                    v                              allocated
                          forfeit (consumes no        claim_prize / ... / claim_prize
                          inventory, pays any bounty)         |
                                                               v
                                                    close_template_opening
```

`lockTreasury` is irreversible. An opening is irreversible except through its two terminal paths: entropy-verified allocation with per-asset claims, or an unrevealed timeout forfeiture that consumes no inventory, never remints the box, and never changes the beneficiary.

## Solvency model

Activated tickets are the lifetime issuance cap: box supply plus pending openings may never exceed undrawn tickets, and minting stops at the cap. Every ticket is backed by its bundle's fully escrowed assets before activation, so no transition can create an unfunded claim. Retirement and reclamation return only inventory that no live ticket can still draw.

## Selection

The oracle's 32-byte value is hashed with:

- domain separator `pina-lootbox-outcome`;
- template address;
- opening address;
- a retry counter.

The first eight bytes become a little-endian `u64`. Rejection sampling discards the small high-range remainder that would otherwise create modulo bias, then maps the result into the undrawn ticket count. The protocol caps the sampling domain at `u32::MAX`, so one sample rejects with probability below `2^-32`. After eight rejected hashes, a deterministic modulo fallback guarantees settlement; the probability of reaching that fallback—and therefore the statistical distance it can introduce—is below `2^-256` under the SHA-256 random-oracle assumption.

## Trust and liveness

The template authority controls configuration, bundle staging, activation, and minting within the activated inventory. It cannot change a locked template, redirect a payout, choose an allocated outcome, or block settlement. Anyone may relay the reveal, allocation, and claims: the program pins the beneficiary on the opening, so a relayer can never redirect a prize.

The opening PDA—not the holder or template authority—is each Switchboard randomness account's authority. Only the Lootbox program can initialize, commit, reveal, or close through that PDA. Switchboard is the external trust/liveness dependency: if no relayer fulfills within 300 slots, an uninvolved signer can forfeit the FIFO head so later openings can allocate, and any configured settlement bounty still goes to the bound beneficiary.

## Production readiness

The unfinished protocol work is fixed bonding-curve adapters and fresh supply-one NFT minting. Production release work remains separate and includes an external audit, real Bubblegum and Switchboard devnet journeys, sustained soak, monitoring, and incident runbooks.
