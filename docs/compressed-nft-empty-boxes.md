# Compressed NFT empty boxes

Status: the Empty Chest art, metadata, player, website presentation, and mint script are implemented. Thirteen leaves are minted on devnet. The PrizePool funding path below uses existing SDK calls; `launch:treasury` does not yet accept a `prizePool` asset kind.

## Why compressed NFTs and a PrizePool

An empty Unlisted box is empty, but not nothing. Instead of 13 identical Token-2022 "Empty Box" badges, each empty copy is backed by one of 13 distinct Empty Chest compressed NFTs (a moth, an odd sock, an IOU for 0 shares, and so on). Art, names, and player live in `assets/lootbox-reveals/rive/empty-chest/` and `apps/web/public/nft/empty-chest/`.

A [PrizePool](prize-pools.md) is the only way to make one bundle slot represent several distinct leaves:

- **Distinct:** the bundle quantity equals the number of deposited leaves, 13. Each winning copy receives exactly one leaf.
- **Uniform:** allocation derives a rank from the opening's committed Switchboard entropy and picks that rank among the unassigned leaves. The creator does not choose the order, and tree order gives nobody a timing signal.
- **Immutable:** `preparePrizePoolItem` rejects leaves with `isMutable: true`. The mint script mints every chest immutable, so name, URI, and creators are fixed for good.
- **Verifiable:** sealing commits the ordered deposit accumulator into the bundle, and activation folds it into the treasury manifest.

### Cost comparison

Measured on devnet on 2026-09-25 for the 13 chests, and computed from rent for the rest:

| Item                     | Empty Chest cNFTs                                                                                                              | Token-2022 badge                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Mint up front            | 0.01141 SOL total (tree 0.01020, config 0.00111, fees)                                                                         | one badge mint with on-mint metadata      |
| Per winner, creator side | about 0.00088 SOL                                                                                                              | nothing until claim                       |
| Escrow while locked      | PrizePool state about 0.00207 SOL plus 13 item PDAs of about 0.00237 SOL each, refunded when each item is claimed or reclaimed | none                                      |
| Winner pays at claim     | transaction fee only; no token account                                                                                         | about 0.00204 SOL associated-account rent |
| What the winner holds    | one of 13 distinct, immutable collectibles                                                                                     | one of 13 identical fungible-style badges |

## What wallets show

Each leaf's URI is `https://pina-rs.github.io/lootbox/nft/empty-chest/<variant>.json`. The JSON carries the full name (`Empty Chest #5 — A Dust Bunny`), a witty line plus the disclosure "An empty Unlisted box. Randomness by Switchboard; allocation recorded on-chain.", the 1024² ivory poster as `image`, and `play.html?v=<variant>` as `animation_url` with `properties.category: "html"`. Wallets show the poster. Marketplaces that render HTML play the Rive loop, and a tap plays the reveal. The on-chain leaf name is the 32-byte-safe short form (`Empty Chest #5 — Dust Bunny`) because Bubblegum V1 caps names at 32 bytes.

The leaves are immutable, so the hosted JSON, PNG, `play.html`, and `empty-chest.riv` must never move. The PrizePool pins metadata on-chain, but off-chain hosting stays outside that boundary. Treat `/lootbox/nft/empty-chest/` as permanent.

## Requirements

- A creator keypair with SOL. The same wallet mints the leaves, owns them, and funds the treasury.
- A **DAS-capable RPC** (for example Helius) for every step after minting. Prepare, deposit, and claim need each leaf's current Merkle proof, data hash, creator hash, and canonical `MetadataArgs` preimage. A public RPC cannot serve `getAsset` or `getAssetProof`. Minting alone works on a public RPC.
- Canopy and the proof cap. The lootbox program accepts at most 16 proof-node accounts per compressed transfer. The Empty Chest tree has max depth 5 (32 leaves) and buffer 8, so every proof is 5 nodes and needs no canopy. If you change the tree, keep `maxDepth - canopyDepth <= 16`.

## Step by step

### 1. Mint the tree and the leaves

```sh
# Dry run: prints the tree shape, proof length, rent, fees, and every leaf.
pnpm --dir sdks/typescript mint:empty-chests -- --cluster devnet --keypair ~/devnet.json

# Create the tree, mint 13 immutable leaves, and write assets.json.
pnpm --dir sdks/typescript mint:empty-chests -- --cluster devnet --keypair ~/devnet.json --execute
```

The script uses Bubblegum V1 (`createTree`, `mintV1`), never V2, because PrizePool admission verifies V1 leaves. Leaf index equals variant. A re-run resumes from the tree config's `numMinted`, and `empty-chests.<cluster>.launch.json` (gitignored) keeps the tree key until its account exists. The script refuses an RPC whose genesis hash is another cluster, and mainnet requires `--rpc`.

It writes `apps/web/public/nft/empty-chest/assets.json`:

```json
{
	"cluster": "devnet",
	"tree": "<tree>",
	"assets": { "<asset id>": { "variant": 4, "leafIndex": 4 } }
}
```

Commit it. The website uses it to show the chest a winner actually received.

Devnet run (2026-09-25): tree `DD68T1hcDXauKuUgANhPugFC2etjxW26M1k3CBoHdjou`, total cost 0.01141 SOL, asset ids in the committed `assets.json`.

### 2. Create the bundle, prepare and deposit each leaf, seal, and activate

`launch:treasury` handles stock, SOL, and badge bundles. For the chest bundle, call the SDK directly. One bundle carries both the PrizePool and the 0.001 SOL:

```ts
const emptyChestBundle: PrizeBundleInput = {
	label: "Empty box",
	quantity: 13n,
	assets: [
		{ kind: "prizePool", tree, items }, // 13 PrizePoolItem, in the order to deposit
		{ kind: "sol", lamports: 1_000_000n },
	],
};

const plan = createTemplatePlan({
	...seriesPlan,
	bundles: [...stockBundles, emptyChestBundle],
});
await client.createTemplate(
	plan,
	id,
	boxMint,
	SWITCHBOARD_PROGRAM,
	SWITCHBOARD_QUEUE,
	{
		symbol: "PREBOX",
		resolvePrizePoolProof: async (item) => fetchPrizePoolItem(das, item.asset),
	},
);
await client.lockTreasury(/* same arguments launch:treasury uses */);
```

Build each `PrizePoolItem` and the proof resolver from DAS the same way `tools/playground.mjs` (`nftProof`) does: `getAssetWithProof(umi, assetId)` from `@metaplex-foundation/mpl-bubblegum`, then

- `asset`: the asset id;
- `metadataMutable`: DAS `mutable`, which must be `false`;
- `metadata`: `getMetadataArgsSerializer().serialize(resolved.metadata)`, the canonical V1 Borsh preimage of at most 512 bytes;
- `proof`: `root`, `dataHash`, and `creatorHash` as 32 bytes; `nonce` and `leafIndex` from `leaf_id`; `tree`; `treeConfig` from `findTreeConfigPda`; and the proof nodes.

`createTemplate` then runs the PrizePool lifecycle inside funding:

1. `createPrizePool` reserves the bundle slot, tree, and quantity 13.
2. For each leaf, `preparePrizePoolItem` recomputes the hashes from the preimage, rejects mutable metadata, and stores the semantic commitment. `depositPrizePoolItem` then transfers the leaf to the PrizePool PDA with a fresh proof. The two steps are separate transactions and fully resumable: every run rereads the pool and item accounts, verifies already-deposited items against the plan, and continues from the deposit cursor. The resolver is called again before every transfer because each tree write changes the root.
3. `sealPrizePool` succeeds only when all 13 are deposited, and writes the pool commitment into the bundle.
4. Bundle activation appends the 13 copies to the template inventory.
5. `lockTreasury` fixes the supply and mints the boxes.

### 3. How a winner receives a leaf

When an opening selects the empty bundle, `allocatePrizePoolOpen` reserves one uniformly ranked unassigned leaf and records its pool index on the opening. The website reads that item PDA's asset id while the prize card is showing (`prizePoolAssetOf` in `apps/web/src/launch/series.ts`), maps it through `assets.json`, and plays that chest.

`claimPrizePoolItem` is permissionless to relay. It checks that the recipient is the beneficiary recorded before the box was burned, recomputes the leaf from current metadata, and has the PrizePool PDA sign a Bubblegum transfer to the winner. The claim needs the current DAS proof:

```ts
await client.claim(opening, {
	prizePoolItem: await fetchPrizePoolItem(das, assetId),
});
```

The same claim delivers the bundle's 0.001 SOL. The item PDA closes and refunds its rent.

The launch site's recipient claim currently builds only the badge and SOL path. Before switching a live series to the PrizePool bundle, pass a DAS resolver to its claim. The website then shows the exact chest won. Series without a mapping, such as the local badge flow, show a stand-in chest derived from the opening address.

## Recovery

- **Mint interrupted:** re-run `mint:empty-chests --execute`. It reuses the saved tree key and continues from `numMinted`.
- **Deposit interrupted:** re-run the same `createTemplate` call. It resumes at the deposit cursor. A prepared item whose transfer never landed can be cancelled with `cancelPrizePoolItem` without touching deposited leaves.
- **Stale proof:** fetch a fresh DAS proof and retry. Bubblegum accepts an older root only while its changelog can fast-forward the unchanged leaf.
- **Unfinished pool:** reclaim deposits last-in, first-out, then close the empty pool.
- **Sealed but not active:** reclaim every unassigned item.
- **Active series:** remaining leaves can be reclaimed only after retirement, zero box supply, and zero pending openings. Assigned leaves always belong to their winners.

See the [PrizePool reference](prize-pools.md) for the full failure table and invariants.

## Rebuilding the art

See `assets/lootbox-reveals/rive/empty-chest/README.md`. Never rebuild metadata with different URIs or names after minting: the leaves are immutable, and PrizePool admission pins their semantic metadata.
