# Treasury-backed templates (v2)

Status: implemented and tested on local Surfpool. This is an experimental development build, not an independently audited mainnet release.

## Product model

A treasury template is an append-only inventory of complete prize bundles. One transferable, zero-decimal Token-2022 token is one unopened lootbox claim. The tokens are interchangeable; NFTs may be prizes inside bundles.

Each bundle contains one to four assets and a positive copy count. Every copy is one equal ticket:

```text
chance(bundle) = remaining copies of bundle / all remaining eligible copies
```

There are no hidden weights and no creator-entered supply cap. If a treasury has eight copies of a 0.001 SOL bundle, four copies of a 100 BONK bundle, one NFT A, one NFT B + D + A bundle, and one 10 SOL bundle, it starts with 15 tickets and can authorize at most 15 lifetime box mints. A unique asset can appear only once and forces that bundle's copy count to one.

The implementation is deliberately fully collateralized. It does not use expected value, fractional reserves, lending, or probabilistic undercollateralization.

## Append-only lifecycle

Templates have three states:

```text
Draft --publish--> Live --retire--> Retired
```

Bundles have a separate staging lifecycle:

```text
Funding --fund every asset--> Active
Funding --reclaim every funded asset--> Cancelled and closed
```

- A new bundle is always staged at the next sequential `u32` index.
- It is invisible to draws and adds no mint capacity until every asset is escrowed and `activateBundle` succeeds.
- Activation atomically appends its inventory, increments the treasury version, and adds its copies to lifetime mint capacity.
- A live template may receive more bundles at any time. Existing bundles, amounts, identifiers, the unlock time, and metadata cannot be edited or reordered.
- An interrupted funding workflow is resumable from chain. The creator can reclaim and cancel only the unpublished tail bundle; already active history is immutable.
- Retirement stops new mints and additions. Outstanding boxes and committed openings remain valid. Unallocated inventory is reclaimable only after box supply and pending openings both reach zero; allocated but unclaimed prizes remain reserved for their recipient.

## Capacity and snapshots

The client and program enforce both bounds:

```text
lifetime mints remaining = total activated copies - total boxes ever minted
live liability headroom = remaining prize copies - live box supply - pending openings
mint capacity = min(lifetime mints remaining, live liability headroom)
```

Depleting one bundle does not stop minting while other funded copies remain. A won copy is removed from the pool, so future live odds update automatically.

Opening a box snapshots the current treasury version and active bundle prefix before the token is burned. Bundles appended later are eligible for boxes that have not opened yet, including boxes already circulating, but never enter an already committed receipt. FIFO allocation still observes depletion caused by earlier receipts inside that saved prefix. The snapshot is therefore a promise about the eligible manifest, not a frozen percentage.

## Opening and recovery

```text
burn + commit -> verify entropy -> FIFO allocation -> per-asset claims -> close receipt
```

1. After the configured unlock timestamp, the owner signs a request that atomically burns one box and creates fresh Switchboard randomness.
2. The receipt records the owner, sequence, treasury version, and eligible bundle count.
3. Anyone may relay a valid proof. Verification persists entropy without moving a prize.
4. Allocation must process the FIFO head and uses domain-separated, bounded rejection sampling over remaining copies in the saved prefix. There is no reroll.
5. Claims are permissionless to submit but can deliver only to the recipient recorded at burn time. Each asset has an independent claim bit, so failures retry the same allocation.
6. A delivered receipt can be closed by its recipient to recover rent.

If the FIFO head remains unrevealed for 300 slots, only its recipient may forfeit it. Forfeiture advances the queue without consuming inventory or returning the burned box. Returning a box would be unsafe: a holder could inspect an unfavorable off-chain proof, suppress it, wait, and reroll. The UI warns about this irreversible tradeoff before signing. Reliable relaying and a production oracle outage policy remain deployment gates.

## Supported prize adapters

| Prize                     | On-chain policy                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native SOL                | Lamports are held by the bundle PDA and transferred directly. Wrapped SOL is rejected as a token prize.                                                                                                                        |
| Classic SPL token         | Canonical mint and ATA checks, checked transfer, positive base-unit amount, and no freeze authority.                                                                                                                           |
| Token-2022 token          | Only the explicitly allowlisted Metadata Pointer and Token Metadata extensions are accepted; fee, hook, delegate, pause, and other behavior-changing extensions fail closed.                                                   |
| Legacy NFT                | Supply one, zero decimals, revoked mint authority, no freeze authority, and a one-copy bundle.                                                                                                                                 |
| Token Metadata NFT / pNFT | `TransferV1` adapter with supply/decimal and metadata PDA validation. Mint/freeze authority must be revoked or held by the canonical Master Edition PDA; edition, token-record, and authorization-rule accounts are forwarded. |
| Metaplex Core             | Core transfer adapter with owner, collection, plugin, and external-adapter account validation.                                                                                                                                 |
| Compressed NFT            | Bubblegum transfer adapter bound to the asset ID, tree, leaf index, hashes, nonce, and fresh Merkle proof accounts.                                                                                                            |

Collection and compressed transfers require fresh account resolution at funding, claim, and reclaim time. The typed SDK prevents silently routing those assets through the generic token path.

## Payers and authority

- The treasury creator signs and pays for creation, staged funding, activation, append operations, cancellation, retirement, and box minting.
- The box owner signs and pays for burn/commit. The playground also uses that owner for proof verification, FIFO allocation, and claim transactions.
- Verification, allocation, and claim instructions are permissionless so a relayer may pay instead; destination substitution is impossible.
- The program does not contain an unbounded on-chain crank subsidy. Production operators may fund a dedicated relayer wallet or sponsor transactions outside the prize inventory. Any future reimbursement policy needs an explicit cap and separate audit.

## Developer API

Legacy v1 discriminators 0–9 are unchanged. V2 uses discriminators 10–36:

| Phase      | Instructions                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template   | `createTemplate`, `sealTemplate`, `retireTemplate`                                                                                                      |
| Stage      | `addBundle`, `fundSolPrize`, `fundTokenPrize`, `fundMetadataNftPrize`, `fundCoreAssetPrize`, `fundCompressedNftPrize`, `activateBundle`, `cancelBundle` |
| Issue/open | `mintTemplateBoxes`, `requestTemplateOpen`, `fulfillTemplateOpen`, `allocateTemplateOpen`, `forfeitTemplateOpen`                                        |
| Deliver    | `claimSolPrize`, `claimTokenPrize`, `claimMetadataNftPrize`, `claimCoreAssetPrize`, `claimCompressedNftPrize`                                           |
| Recover    | `reclaimSolPrize`, `reclaimTokenPrize`, `reclaimMetadataNftPrize`, `reclaimCoreAssetPrize`, `reclaimCompressedNftPrize`, `closeTemplateOpening`         |

The TypeScript planner calculates exact inventory and collateral before building transactions:

```ts
import { createTemplatePlan } from "@pina-rs/lootbox";
import { address } from "@solana/kit";

const plan = createTemplatePlan({
	name: "A small miracle",
	opensAt: BigInt(Math.floor(Date.now() / 1000) + 86_400),
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
console.log(plan.bundles[1]?.odds); // { numerator: 1n, denominator: 100n }
console.log(plan.treasury); // exact deposits grouped by asset identifier
```

Replace the placeholder with a valid address before running the example. Rust exposes `TemplatePlan::new(&bundles)` with `PrizeAsset::{Sol, ClassicToken, Token2022, LegacyNft, MetadataNft, CoreAsset, CompressedNft}`. Dart exposes `TemplatePlan`, `PrizeBundle`, and matching `PrizeAsset` constructors. All planners validate the 256-bundle limit, one-to-four asset limit, `u64` collateral math, `u32` ticket limit, and unique-asset ownership.

`LootboxClient` provides resumable `createTemplate` and `appendBundles`, `publishTemplate`, `cancelFundingBundle`, mint/transfer/open/fulfill/allocate/claim orchestration, timeout forfeiture, receipt closure, and read APIs. It uses processed commitment only for the local single-node sandbox; production applications must choose appropriate finality, transaction simulation, wallet, and oracle transport policies.

## Searchable asset picker

The local control plane exposes:

- `GET /assets/tokens?q=...`: Jupiter Tokens V2 search through a server-side `JUPITER_API_KEY`, with a five-minute bounded cache and a clearly labeled fallback list.
- `GET /assets/nfts?owner=...&q=...`: Metaplex DAS `getAssetsByOwner` through `DAS_RPC_URL`, normalized across standard, Core, and compressed assets.

Keys never reach the browser. Search results show source, verification status, exact identifiers, standard, and warnings. The local playground mirrors selected catalog entries into disposable Surfpool assets; it never moves mainnet property. Manual addresses remain available for integration work.

Official integration references: [Jupiter Tokens API](https://developers.jup.ag/docs/tokens), [Jupiter token information guide](https://developers.jup.ag/docs/guides/how-to-get-token-information), and [Metaplex DAS `getAssetsByOwner`](https://developers.metaplex.com/dev-tools/das-api/methods/get-assets-by-owner).

## Verification and release gates

Implemented verification covers Rust unit/property tests, Rust/TypeScript/Dart planners, generated clients, real SBF transactions in Surfpool, local control-plane tests, React unit tests, and desktop/mobile Playwright journeys. The Surfpool oracle is an ABI emulator, not production randomness, and external Metadata/Core/Bubblegum programs still need real-network compatibility fixtures.

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
