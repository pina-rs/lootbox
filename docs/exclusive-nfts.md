# Exclusive Lootbox NFTs

Status: implemented and tested on local Surfpool against the real mainnet Bubblegum V2, Metaplex Core, MPL Account Compression, and MPL Noop programs. This is an experimental development build, not an independently audited mainnet release.

## Product

A box that draws the consolation bundle does not come up empty. Its holder receives an Exclusive Lootbox NFT: a compressed NFT built from stacked trait layers, minted at claim time. Nothing is pre-minted, so supply is limited only by the boxes that draw it. Rarity is the prize. The chance of a finished NFT is the product of the chances of its traits, so a collection with seven layers can make combinations rarer than one in a billion.

Every lootbox shares one protocol-level collection, the "Introductory" collection. Any treasury creator may attach a consolation bundle to it while its attach window is open. The window limits when bundles may attach, not how many copies they promise. Boxes that attached in time keep their promise after the window closes.

## Accounts and instructions

| Account                    | Seeds                                                     | Holds                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExclusiveCollectionState` | `["exclusive-collection", admin, collection_id (u64 LE)]` | admin, Core collection, active tree, tree count, layer count, trait counts, 12 × 64 `u32` weights, name prefix, symbol, base URI, global serial counter, attach window, frozen `layers_hash`, status. 3,423 bytes, about 0.0247 SOL rent. |
| `ExclusiveAttachmentState` | `["exclusive-attachment", bundle, asset_index (u8)]`      | template, bundle, collection, the collection's `layers_hash`, quantity, copies minted, per-mint fee. 157 bytes, about 0.002 SOL rent.                                                                                                     |
| Fee vault                  | `["exclusive-fee-vault", attachment]`                     | A zero-data System account that prepays Bubblegum's mint fee for each copy.                                                                                                                                                               |

The bundle slot uses kind `PRIZE_EXCLUSIVE_NFT` (`11`). Its target is the attachment PDA, its amount is `1`, and its commitment is `sha256("lootbox:exclusive-nft-attachment" || attachment || template || bundle || collection || layers_hash || quantity || asset_index)`. Bundle activation folds that commitment into the treasury manifest, so a locked treasury's result receipts and manifest hash prove which frozen layer tables its boxes use.

| Discriminator | Instruction                  | Signer                    | Effect                                                                                                                                                   |
| ------------- | ---------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `53`          | `createExclusiveCollection`  | admin                     | Creates the collection PDA and a Core collection with the `BubblegumV2` plugin whose update authority is the PDA.                                        |
| `54`          | `setExclusiveLayer`          | admin, draft only         | Loads one layer: its trait count and 64 weight slots. Layers load in chunks because all twelve do not fit one transaction.                               |
| `55`          | `appendExclusiveTree`        | admin, any time           | Creates a private Bubblegum V2 tree whose creator is the PDA and makes it the active tree.                                                               |
| `56`          | `publishExclusiveCollection` | admin, once               | Validates every layer, requires a tree, and freezes the tables under `layers_hash`.                                                                      |
| `57`          | `attachExclusiveNft`         | treasury creator          | While the window is open, binds the next bundle slot to the published collection and escrows `quantity × 90,000` lamports plus the vault's rent minimum. |
| `58`          | `claimExclusiveNft`          | none; any relayer submits | Records the claim bit, derives the traits, advances the serial, and mints to the bound beneficiary.                                                      |
| `59`          | `reclaimExclusiveFees`       | treasury creator          | Returns unused mint fees under the existing recovery rules.                                                                                              |

## Randomness and traits

The seed of one opening is

```text
S = sha256("lootbox:exclusive-nft" || template || opening || R)
```

where `R` is the verified Switchboard value that `fulfillTemplateOpen` stored in the opening and that allocation already consumed. The domain separates `S` from the allocation draw.

For each layer `i` from 0 (bottom) upward, the program draws a target in `0..total_i`:

```text
candidate = u64_le(sha256(S || "layer" || u8 i)[0..8])
accept when candidate >= 2^64 mod total_i, then target = candidate mod total_i
otherwise round r = 1..7 draws u64_le(sha256(S || "layer" || u8 i || u8 r)[0..8])
```

The accepted band holds exactly `total_i × floor(2^64 / total_i)` candidates, so every residue is equally likely. The trait is the first slot whose cumulative weight exceeds the target, so a zero-weight trait is never drawn and a trait's chance is exactly `weight / total_i`. Layer totals are capped at `u32::MAX`, so one rejection happens with probability below `2^-32` and eight in a row below `2^-256`. Exhaustion fails closed, like the allocation sampler.

The metadata is fixed by the collection and the serial:

```text
name = "{name_prefix} #{serial}"                    (at most 32 bytes)
uri  = "{base_uri}{hex(trait_i) for each layer}-{serial}.json"
```

Each layer contributes two lowercase hex digits, so seven layers produce fourteen. The name prefix is capped at 20 bytes so any ten-digit serial fits Bubblegum's 32-byte name. The base URI is capped at 128 bytes and must start with `https://`, so twelve layers and a twenty-digit serial still fit Bubblegum's 200-byte URI. The symbol is capped at 10 bytes. Every leaf is immutable, has zero royalties, no creators, and the Core collection as its verified collection. The Core collection itself is named after the prefix with the URI `{base_uri}collection.json`.

Anyone can recompute an NFT's traits from the opening's on-chain `entropy`, the template and opening addresses, and the collection's published tables. `deriveExclusiveTraits` in the TypeScript SDK, `exclusive_traits` in the Rust SDK, and `exclusiveTraits` in the Dart SDK replay `tests/vectors/exclusive-nft.json`, which the program also replays. Rarity, `−log2 p` or `1/p`, is computed off-chain from the trait vector.

The serial is a claim-order edition number shared by every attachment. Relay timing can change which serial an opening receives but never its traits: traits come only from `S` and the frozen tables, both fixed before anyone can claim.

### Why not an oracle-free seed

Block hashes, slots, timestamps, signatures, and account addresses are either visible before a transaction commits or chosen by a validator or the transaction's sender. A seed built from them lets a holder or a validator preview the traits and delay, reorder, or abandon a claim until a rare combination appears. The opening already carries a Switchboard value that was committed before the box burned and revealed only through the oracle, and that allocation already trusts. Reusing it with a new domain adds no oracle round trip and no new trust assumption.

## Minting and custody

Bubblegum V2 `mint_v2` is used with a Metaplex Core collection. Bubblegum V1 `mintToCollectionV1` would need a Token Metadata collection NFT, its metadata and master edition, and a collection authority record: more accounts, more rent, and a second metadata program in the trust boundary. Bubblegum V2 has been on mainnet since `release/bubblegum@1.0.0` (May 2025). The pinned layouts come from `release/bubblegum@2.0.0` (`79e1a1954bddb7fe5dcd52a5570a66a9f7d465e4`), the OtterSec-verified mainnet build deployed on 2026-09-22, and Core `e72d63e4118a0a95ac9b40221e81b19d49e1e102`, also verified. Sources: [Bubblegum V2](https://www.metaplex.com/docs/smart-contracts/bubblegum-v2), [creating V2 trees](https://www.metaplex.com/docs/smart-contracts/bubblegum-v2/create-trees), [minting into collections](https://www.metaplex.com/docs/smart-contracts/bubblegum-v2/collections), and the [Core `BubblegumV2` plugin](https://www.metaplex.com/docs/smart-contracts/core/plugins/bubblegum).

Only the program can mint:

- The collection PDA is the `tree_creator` of every tree. The program creates each tree through a CPI signed by the PDA, and Bubblegum never changes `tree_creator`. A private tree accepts mints only from its creator or delegate, and the program never delegates.
- The collection PDA is the Core collection's update authority. Bubblegum requires that authority's signature to mint into the collection, and the program signs with it only inside `claimExclusiveNft`.
- The admin can load layers only before publication and can append trees at any time, but can neither mint nor change published tables. The mainnet admin should be a multisig.

Pinned program IDs: Bubblegum `BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY`, Core `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`, MPL Account Compression `mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW`, MPL Noop `mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3`, and Bubblegum's Core CPI signer `CbNY3JiXdXNE9tPNEk1aRZVEkWdj2v7kfJLNQwZZgpXk`.

## Costs

| Item                      | Paid by          | Amount                                                                                     |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| Collection PDA            | admin, once      | about 0.0247 SOL rent                                                                      |
| Core collection           | admin, once      | a few thousandths of a SOL in rent; Core charges no creation fee for collections           |
| Tree, depth 20, buffer 64 | admin, per tree  | canopy 3: 0.3122 SOL; canopy 10: 0.7648 SOL; canopy 14: 7.6067 SOL (1,048,576 leaves each) |
| Attachment PDA            | treasury creator | about 0.002 SOL rent, returned when a staged attachment is unwound                         |
| Mint-fee escrow           | treasury creator | `quantity × 0.00009 SOL` plus 0.00089 SOL vault rent; unused fees return through recovery  |
| Claim                     | any submitter    | the transaction fee only                                                                   |

The default tree is depth 20 with a depth-10 canopy: 109,752 bytes and 0.7648 SOL. A holder then supplies at most ten proof nodes to transfer, which wallets and marketplaces handle without address lookup tables. `appendExclusiveTree` enforces that bound: the tree account must be large enough for a canopy leaving at most ten proof nodes. Canopy 3 would require seventeen-node proofs; canopy 14 costs ten times more for four fewer nodes. When a tree fills, claims fail closed until the admin appends another, so the admin must monitor `num_minted` and append ahead of time; later mints land in the new tree, and about 2.1 million mints need two trees, or about 1.53 SOL.

Bubblegum V2 charges `MINT_V2_FEE_LAMPORTS = 90,000` from the mint's payer. The attachment's fee vault PDA signs as that payer, so the claim submitter never pays it. If a future Bubblegum release raises the fee, claims fail closed until anyone tops up the vault; unsolicited lamports are accepted.

Measured on Surfpool with a seven-layer fixture, `claimExclusiveNft` uses 84,000–112,000 compute units in total, of which 62,000–80,000 are inside Bubblegum `mint_v2` (the first mint into a tree costs the most). The lootbox side, including the seven layer draws, the account checks, and the event, uses about 22,000–31,000. A claim fits the default 200,000-unit budget. The CPI depth is lootbox → Bubblegum → compression → noop, four of the five allowed levels, so a program that composes `claimExclusiveNft` through its own CPI reaches the limit exactly.

## Recovery

`reclaimExclusiveFees` reuses the existing rules for undrawn inventory:

- A staged bundle releases every copy. The attachment closes, the fee vault is emptied, and `cancelBundle` can then close the bundle.
- An active bundle releases its undrawn copies only after retirement, zero box supply, and zero pending openings. The vault keeps exactly one mint fee for every allocated but unclaimed copy, so a late winner can still mint. Repeating the call is harmless.

## Security notes

- Every PDA is re-derived canonically: collection, attachment, fee vault, tree config, template, bundle, and opening.
- A claim requires the committed attachment, the collection named by the attachment, an unchanged `layers_hash`, the collection's active tree, and its Core collection. Program accounts are pinned by address and executability.
- `record_claim` binds the leaf owner to the beneficiary recorded before the box burned and sets the per-asset claim bit, so a relayer cannot redirect a mint and an opening mints once.
- An attachment never mints more than its committed quantity, and the global serial and per-attachment counters use checked arithmetic.
- Published layers cannot change. The layer hash includes the admin, collection ID, Core collection, layer count, trait counts, every weight byte, the name prefix, the symbol, and the base URI. Unused weight slots must be zero, so the tables have one canonical encoding.
- The attach window is checked at attach time only. Closing it cannot strand a box that already attached.
- Off-chain JSON and images are outside the on-chain boundary. The URI names the trait vector and serial, so a server can serve art but cannot claim different traits; hosting must still be permanent.

## Follow-ups

- Sharding. Every claim writes the collection's serial counter and the active tree, so claims across all lootboxes serialize on those two accounts. That is acceptable for the introductory collection. A later version could keep `k` active trees with a serial counter per shard.
- Bonuses. A per-attachment escrowed bonus for rare trait vectors, keyed by an on-chain rarity score, was left out. Rarity itself is the prize.
- Admin rotation. The admin key is part of the collection's PDA seeds and cannot change.
- Real-network soak. The Surfpool journey executes the real program images, but a devnet run with DAS indexing, wallet display, and transfers remains a release gate.
