# Treasury-backed templates

Status: implemented and tested on local Surfpool. This is an experimental development build, not an independently audited mainnet release.

## Product model

A treasury template begins as an append-only inventory of complete prize bundles. An irreversible market lock turns it into a fixed series: one transferable, zero-decimal Token-2022 token is one unopened lootbox claim. Tokens from the same locked treasury are interchangeable; NFTs may be prizes inside bundles.

Each bundle contains one to four assets and a positive copy count. Every copy is one equal ticket:

```text
chance(bundle) = remaining copies of bundle / all remaining eligible copies
```

There are no hidden weights and no creator-entered supply cap. If a treasury has eight copies of a 0.001 SOL bundle, four copies of a 100 BONK bundle, one NFT A, one NFT B + D + A bundle, and one 10 SOL bundle, it has 15 outcomes. Locking succeeds only when exactly 15 boxes exist; the lock transaction mints any missing boxes before revoking mint authority. A unique asset can appear only once and forces that bundle's copy count to one.

The implementation is deliberately fully collateralized. It does not use expected value, fractional reserves, lending, or probabilistic undercollateralization.

## Append-only lifecycle

Templates retain three lifecycle statuses plus an independent permanent lock:

```text
Draft --publish--> Live --retire--> Retired
                    |
                    +--lock exact supply--> Market locked

Live + missed reveal deadline --retire--> Retired recovery
```

Bundles have a separate staging lifecycle:

```text
Funding --fund every asset--> Active
Funding --reclaim every funded asset--> Cancelled and closed
```

- A new bundle is always staged at the next sequential `u32` index.
- It is invisible to draws and adds no mint capacity until every asset is escrowed and `activateBundle` succeeds.
- Activation atomically appends its inventory, increments the treasury revision, and adds its copies to lifetime mint capacity.
- An unlocked live template may receive more bundles before its reveal date. Existing bundles, amounts, identifiers, the reveal time, and metadata cannot be edited or reordered.
- An interrupted funding workflow is resumable from chain. The creator can reclaim and cancel only the unpublished tail bundle; already active history is immutable.
- Market lock requires a live treasury, future reveal time, pristine inventory, no opening history, no staged tail, and actual mint supply matching recorded issuance. It atomically mints every missing claim to the creator-selected account, proves `mint supply == active bundle copies`, revokes mint authority, and records `lockedAt`.
- After lock, additions and mints fail permanently. Boxes can transfer immediately but cannot open before the reveal timestamp.
- Retirement stops any remaining lifecycle operations but does not undo a market lock. Before reveal, an issued unlocked treasury cannot retire around the exact-supply invariant. At or after a missed reveal deadline, retirement becomes a non-market recovery seal: creator mutations stop and existing holders may still open, but the series is never presented as market-locked. Unallocated inventory is reclaimable only after box supply and pending openings both reach zero; allocated but unclaimed prizes remain reserved for their recipient.

## Capacity and snapshots

The append-only inventory uses Pina's compact-account layout. A new treasury starts with a 547-byte fixed header. Each successful bundle activation grows it by exactly one eight-byte `u64` remaining-copy slot, up to 1,024 bundles and an 8,739-byte maximum. The activating authority funds only the incremental rent. Slots remain allocated after depletion because opening receipts snapshot stable bundle indices; compactness changes rent growth, not draw semantics.

Before lock, the client and program enforce both issuance bounds:

```text
lifetime mints remaining = total activated copies - total boxes ever minted
live liability headroom = remaining prize copies - live box supply - pending openings
mint capacity = min(lifetime mints remaining, live liability headroom)
```

Lock converts that capacity into a strict equality:

```text
fixed box issuance = total active bundle copies
mint authority after lock = none
```

A won copy is removed from the pool and its corresponding box was burned, so circulating supply and remaining prize copies decline together. Future live odds and remaining expected value update automatically.

Opening is impossible for an active unlocked treasury, so every box in a tradable series has the same locked eligible manifest. The only exception is an explicitly retired, non-market recovery series after a missed reveal deadline. Burning a box snapshots the treasury revision and active bundle prefix. FIFO allocation still observes depletion caused by earlier receipts inside that saved prefix. The snapshot is therefore a promise about the eligible manifest, not a frozen percentage.

## Opening and recovery

```text
burn + commit -> verify entropy -> FIFO allocation -> per-asset claims -> close receipt
```

1. After the configured reveal timestamp, the owner signs a request that atomically burns one box and creates fresh Switchboard randomness. The treasury must be market-locked or permanently retired through the missed-deadline recovery path.
2. The opening records the box authority, prize beneficiary, rent-refund address, optional consumer binding, sequence, treasury revision, and eligible bundle count.
3. Anyone may relay a valid proof. Verification persists entropy without moving a prize.
4. Allocation must process the FIFO head and uses domain-separated, bounded rejection sampling over remaining copies in the saved prefix. There is no reroll.
5. Claims are permissionless to submit but can deliver only to the recipient recorded at burn time. Each asset has an independent claim bit, so failures retry the same allocation.
6. A delivered opening can be closed and its rent always returns to the original request payer.

### Optional immutable results and settlement bounties

Creators choose both service options when the treasury is created. They become immutable with the rest of the treasury terms:

- `resultReceiptsEnabled = false` is the default. Allocation creates no result account and charges neither the creator nor the opener any result-account rent.
- When enabled, the creator prepays the current rent-exempt minimum for exactly one `ResultReceipt` PDA per box at market lock. Allocation creates the PDA from that reserved balance; reveal callers never pay its rent.
- A `ResultReceipt` permanently binds the treasury, opening, box authority, beneficiary, consumer program and 32-byte context, locked manifest hash, randomness account, request sequence, and selected bundle. It has no update or close instruction.
- A per-settlement bounty is also optional. The creator prepays exactly one bounty per box at lock, and the signer who successfully fulfills or expires the FIFO head receives it. Prize collateral is never used for service costs.
- The service account also holds one zero-data rent-exempt reserve so every valid low-bounty configuration can lock. That reserve is not spendable as a bounty or receipt and returns to the creator when the service account closes.
- After retirement and final settlement, the creator may close the service vault and recover its rent reserve plus any unused prepaid receipt rent and bounties.

The lock deposit is exact:

```text
service deposit = box supply × (settlement bounty + enabled receipt rent)
                + one zero-data service-account rent reserve
```

The final term is present only when at least one service is enabled.

Each opening may name a beneficiary distinct from its box authority and may bind a consumer program plus opaque context. A nonzero context is rejected unless a consumer program is supplied. Integrators must additionally record a one-time-use marker in their own state when consuming a result.

If the FIFO head remains unrevealed for 300 slots, any signer may forfeit it. Forfeiture advances the queue without consuming inventory, changing the bound recipient, or returning the burned box. Returning a box would be unsafe: a holder could inspect an unfavorable off-chain proof, suppress it, wait, and reroll. Permissionless expiry prevents an inactive recipient from blocking every later opening, while making the disclosed deadline final. Reliable relaying and a production oracle outage policy remain deployment gates.

## Supported prize adapters

| Prize               | On-chain policy                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native SOL          | Lamports are held by the bundle PDA and transferred directly. Wrapped SOL is rejected as a token prize.                                                                                                                                                              |
| Winner-routed quote | SOL or a pinned token is fully escrowed per win. A bound winner may atomically append a self-signed curve/DEX route; route failure rolls back delivery, and direct quote delivery remains the fallback.                                                              |
| Classic SPL token   | Canonical mint and ATA checks, checked transfer, positive base-unit amount, and no freeze authority.                                                                                                                                                                 |
| Token-2022 token    | Only the explicitly allowlisted Metadata Pointer and Token Metadata extensions are accepted; fee, hook, delegate, pause, and other behavior-changing extensions fail closed.                                                                                         |
| Mint-on-claim badge | An empty zero-decimal mint irrevocably transfers mint authority to the bundle. Claims mint one unit, supply must equal the prior claim count, and final delivery revokes authority.                                                                                   |
| Legacy NFT          | Supply one, zero decimals, revoked mint authority, no freeze authority, and a one-copy bundle.                                                                                                                                                                       |
| Token Metadata NFT  | Transfer adapter with supply/decimal and metadata PDA validation. Mint/freeze authority must be revoked or held by the canonical Master Edition PDA. Programmable token records and authorization rules are rejected until their mutability is compatibility-tested. |
| Metaplex Core       | Only plain, uncollected Core assets with no plugins or external adapters are admitted, preventing a third-party mutable transfer policy from stranding escrow.                                                                                                       |
| Compressed NFT      | Bubblegum transfer adapter bound to the asset ID, tree, leaf index, hashes, nonce, and fresh Merkle proof accounts.                                                                                                                                                  |

Collection and compressed transfers require fresh account resolution at funding, claim, and reclaim time. The typed SDK prevents silently routing those assets through the generic token path.

See [Dynamic prize delivery](dynamic-prizes.md) for quote composition, badge collateral, explicit invariants, and the fixed-adapter and NFT-factory design gates.

## Payers and authority

- The treasury creator signs and pays for creation, staged funding, activation, append operations, cancellation, exact box issuance, market lock, retirement, and any optional result/bounty service reserve.
- The box authority signs the burn. The transaction payer may be a sponsor and is recorded as the rent-refund address; the beneficiary may be another wallet or an integrating program's controlled account.
- Verification, allocation, and claim instructions are permissionless so a relayer may pay; destination substitution is impossible.
- The bounded creator-funded bounty rewards successful fulfillment or timeout recovery without exposing prize collateral or requiring the beneficiary to sign.

## Developer API

The generated interface currently exposes these treasury instructions:

| Phase      | Instructions                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template   | `createTemplate`, `sealTemplate`, `lockTreasury`, `retireTemplate`                                                                                                                                                   |
| Stage      | `addBundle`, `fundSolPrize`, `fundTokenPrize`, `fundQuoteSolPrize`, `fundQuoteTokenPrize`, `fundMintPrize`, `fundMetadataNftPrize`, `fundCoreAssetPrize`, `fundCompressedNftPrize`, `activateBundle`, `cancelBundle` |
| Issue/open | `mintTemplateBoxes`, `requestTemplateOpen`, `fulfillTemplateOpen`, `allocateTemplateOpen`, `forfeitTemplateOpen`                                                                                                     |
| Deliver    | `claimSolPrize`, `claimTokenPrize`, `claimMintPrize`, `claimMetadataNftPrize`, `claimCoreAssetPrize`, `claimCompressedNftPrize`                                                                                      |
| Recover    | `reclaimSolPrize`, `reclaimTokenPrize`, `reclaimMintPrize`, `reclaimMetadataNftPrize`, `reclaimCoreAssetPrize`, `reclaimCompressedNftPrize`, `closeTemplateOpening`, `closeServiceVault`                             |

The TypeScript planner calculates exact inventory and collateral before building transactions:

```ts
import { createTemplatePlan } from "@pina-rs/lootbox";
import { address } from "@solana/kit";

const plan = createTemplatePlan({
	name: "A small miracle",
	opensAt: BigInt(Math.floor(Date.now() / 1000) + 86_400),
	resultReceiptsEnabled: true,
	settlementBountyLamports: 50_000n,
	bundles: [
		{
			label: "A little SOL",
			quantity: 99n,
			assets: [{ kind: "sol", lamports: 100_000_000n }],
		},
		{
			label: "The jackpot",
			quantity: 1n,
			assets: [
				{ kind: "core", asset: address("REPLACE_WITH_CORE_ASSET") },
				{ kind: "sol", lamports: 1_000_000_000n },
			],
		},
	],
});

console.log(plan.totalBundles); // 100n
console.log(plan.fixedSupply); // 100n after market lock
console.log(plan.bundles[1]?.odds); // { numerator: 1n, denominator: 100n }
console.log(plan.treasury); // exact deposits grouped by asset identifier
```

Replace the placeholder with a valid address before running the example. Rust exposes `TemplatePlan::new(&bundles)` with `PrizeAsset::{Sol, QuoteSol, ClassicToken, Token2022, QuoteToken, MintBadge, LegacyNft, MetadataNft, CoreAsset, CompressedNft}`. Dart exposes `TemplatePlan`, `PrizeBundle`, and matching `PrizeAsset` constructors. All planners validate the 1,024-bundle limit, one-to-four asset limit, `u64` collateral math, `u32` ticket limit, and unique-asset ownership.

`LootboxClient` provides resumable `createTemplate` and `appendBundles`, `publishTemplate`, `cancelFundingBundle`, exact `lockTreasury`, transfer/open/fulfill/allocate/claim orchestration, timeout forfeiture, receipt closure, and read APIs. Prize delivery keeps each asset's setup and claim atomic, partitions mixed bundles into transaction-size/account-bounded batches, and refetches the claim mask after every confirmed batch. Market helpers validate lock readiness, compute explicit remaining-inventory EV, quote integer-only constant-product trades, and export a checked Raydium CPMM deployment manifest. Pool creation itself stays in a production wallet/network adapter. The client uses processed commitment only for the local single-node sandbox; production applications must choose appropriate finality, transaction simulation, wallet, and oracle transport policies.

## Searchable asset picker

The local control plane exposes:

- `GET /assets/tokens?q=...`: Jupiter Tokens search through a server-side `JUPITER_API_KEY`, with a five-minute bounded cache and a clearly labeled fallback list.
- `GET /assets/nfts?owner=...&q=...`: Metaplex DAS `getAssetsByOwner` through `DAS_RPC_URL`, normalized across standard, Core, and compressed assets.

Keys never reach the browser. Search results show source, verification status, exact identifiers, standard, and warnings. The local playground mirrors selected catalog entries into disposable Surfpool assets; it never moves mainnet property. Manual addresses remain available for integration work.

Official integration references: [Jupiter Tokens API](https://developers.jup.ag/docs/tokens), [Jupiter token information guide](https://developers.jup.ag/docs/guides/how-to-get-token-information), and [Metaplex DAS `getAssetsByOwner`](https://developers.metaplex.com/dev-tools/das-api/methods/get-assets-by-owner).

## Verification and release gates

Implemented verification covers Rust unit/property tests, Rust/TypeScript/Dart planners, generated clients, exact issuance and mint-authority revocation through real SBF transactions in Surfpool, local control-plane tests, React unit tests, and desktop/mobile Playwright journeys. The Surfpool oracle is an ABI emulator, not production randomness, and external Metadata/Core/Bubblegum programs still need real-network compatibility fixtures.

Before real value: independent audit, real Switchboard soak and monitored relayer policy, upgrade-authority policy, external-adapter compatibility tests, production wallet simulation/finality, API reliability controls, jurisdiction-specific review, and incident response.

## Local run

```sh
devenv shell
build:program
build:test-programs
pnpm playground:rpc
```

The service binds `127.0.0.1:8898` by default. Set `LOOTBOX_PLAYGROUND_PORT` for another loopback port, `JUPITER_API_KEY` for live token search, and `DAS_RPC_URL` for wallet asset discovery. Its faucet, proof, and time controls are test-only.

Use `devenv shell -- test:surfpool` for real transaction journeys and `devenv shell -- verify:all` for the complete regression suite.
