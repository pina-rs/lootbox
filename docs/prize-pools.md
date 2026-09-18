# PrizePool reference

Status: implemented for Bubblegum V1 and tested in local Surfpool. This is an experimental development build, not an independently audited mainnet release.

## Purpose

A PrizePool makes one bundle slot represent several distinct compressed NFTs. The bundle quantity equals the number of deposited leaves. Each winning copy receives one leaf.

The creator does not choose the delivery order. Allocation derives a uniform rank from the opening's committed entropy and selects that rank among the unassigned leaves. Public Merkle-tree order therefore gives the creator and the opener no useful timing signal.

## Accounts

One bundle can contain one PrizePool slot. The slot uses these manifest terms:

| Field      | Value                |
| ---------- | -------------------- |
| `kind`     | `PRIZE_POOL` (`10`)  |
| `target`   | `PrizePoolState` PDA |
| `amount`   | `1`                  |
| `decimals` | `0`                  |

`PrizePoolState` uses the PDA seeds `["prize-pool", bundle, asset_index]`. Its fixed header records the authority, bundle, tree, quantity, counters, manifest accumulator, status, and bump. Its compact `unavailable` bitmap grows by one byte for each eight deposited leaves:

```text
size = 168 + ceil(deposited leaves / 8) bytes
maximum = 680 bytes for 4,096 leaves
```

Each deposit creates a `PrizePoolItemState` PDA at `["prize-pool-item", pool, pool_index]`. The item records:

- the Bubblegum asset ID;
- the deposit-time data hash and creator hash as an audit snapshot;
- a normalized semantic metadata hash that masks only collection and creator verification flags;
- the nonce and tree index;
- the local pool index;
- the previous manifest accumulator, which supports safe tail recovery.

The fixed item account is 212 bytes. It first exists in a prepared state, then becomes deposited after the Bubblegum transfer. No instruction can rewrite its identity or semantic commitment. A claim or reclaim closes it and returns its rent to the fixed account for that path.

## Lifecycle

The PrizePool lifecycle is:

```text
Funding --prepare metadata--> Prepared --transfer leaf--> Funding
   |                              |                            |
   +--close empty pool------------+--cancel prepared item-----+
                                  +--repeat exact quantity-----+--seal--> Sealed

Sealed + staged bundle --reclaim unallocated items--> close
Sealed + retired active bundle --reclaim remaining items
Sealed + allocation --claim selected item--> recipient
```

`createPrizePool` fixes and reserves the bundle manifest slot, tree, and quantity. Ordinary funding and bundle cancellation cannot overwrite or bypass that reservation. Admission is deliberately split into two resumable transactions:

1. `preparePrizePoolItem` receives the canonical Bubblegum V1 `MetadataArgs` Borsh preimage. The program recomputes both leaf hashes, rejects mutable or malformed metadata, derives the asset ID, normalizes only verification flags, and stores the semantic commitment in the canonical next item PDA.
2. `depositPrizePoolItem` requires that exact prepared identity and transfers the leaf from the creator to the PrizePool PDA with a fresh proof. It then advances the compact cursor and ordered manifest accumulator.

If transfer never happens, `cancelPrizePoolItem` closes only the prepared item; it never touches an already deposited leaf. Every retry reads the pool and item accounts before deciding which step remains.

`sealPrizePool` succeeds only when `deposit_cursor == quantity`. It writes a domain-separated commitment to the pool address, tree, quantity, version, and ordered deposit accumulator into the bundle slot. Bundle activation folds that commitment into the treasury manifest. A result receipt therefore commits to the advertised PrizePool contents, not just its PDA. `activateBundle` then appends the same quantity to the template inventory.

An unfinished pool supports last-in, first-out recovery. This order lets the program restore the previous manifest accumulator and shrink the compact bitmap without rewriting earlier items. A sealed staged pool supports recovery of every unassigned item. An active pool supports recovery only after retirement, zero box supply, and zero pending openings. Terminal active pools can close only after every ticket is either claimed or reclaimed and all counters agree.

## Custody

Each deposited compressed NFT remains a leaf in its existing Bubblegum tree. The deposit changes the leaf owner to the PrizePool PDA. It does not move the leaf into a new tree.

The tree creator keeps tree authority, but tree authority is not leaf ownership. Bubblegum transfer and burn operations require the current leaf owner or its delegate. After deposit, only the lootbox program can sign for the PrizePool PDA.

The program pins the canonical Bubblegum, SPL Account Compression, and SPL Noop addresses. It passes the supplied root, current hashes, nonce, index, and leaf-to-root proof nodes to Bubblegum. Concurrent Merkle trees can fast-forward an unchanged leaf through buffered tree updates, so an older root is not automatically invalid. Bubblegum accepts it only while its changelog can prove that the same leaf is still current. A proof outside that window, a corrupted sibling, a different tree, a substituted leaf, or an old owner signature fails atomically.

Every compressed transfer accepts at most 16 proof-node accounts at the program boundary. Deeper trees remain usable when their configured canopy reduces the supplied proof to 16 nodes or fewer. This release does not compose address lookup tables for larger proof tails.

The creator UI accepts only DAS assets that report all of these properties:

- Bubblegum compression is enabled;
- the connected creator owns the leaf;
- metadata is explicitly immutable;
- no leaf delegate is active;
- the tree, leaf index, data hash, and creator hash are present;
- every selected leaf belongs to the same tree.

The UI fetches each proof again immediately before funding. The SDK repeats the identity checks, and Bubblegum verifies current ownership and the current root during the transfer.

### Exact metadata semantics

Bubblegum V1 stores data and creator hashes in the leaf. Tree, collection, and creator authorities can legitimately toggle verification flags without the leaf owner, and those toggles change the hashes. Some collection operations can also replace a collection identity. Pinning only the asset ID is therefore too weak, while pinning raw hashes would strand legitimate verification changes.

The program resolves this at both custody boundaries. Prepare recomputes the hashes from canonical metadata, requires `is_mutable == false`, and stores a semantic commitment with collection and creator `verified` booleans set to false. Claim and reclaim receive the current canonical metadata, recompute its current hashes, apply the same normalization, and require the semantic commitment to match. This permits only verification-flag drift. It rejects a changed collection key or presence, creator address/share/order, name, symbol, URI, royalty, token standard, use policy, mutability, or malformed encoding.

The DAS checks in the UI and SDK remain useful early feedback, but immutable admission is enforced by the program and cannot be bypassed by a raw client.

Off-chain image hosting remains outside the custody boundary. Immutable on-chain metadata can still point to a server that changes or disappears. Creators should use content-addressed or permanent metadata URIs.

## Allocation

Bundle selection remains the existing weighted draw over template copy counts. If the chosen bundle contains a PrizePool, `allocatePrizePoolOpen` performs a second selection during the same allocation:

1. Calculate `available = quantity - assigned_count - reclaimed_count`.
2. Require `available` to equal the selected bundle's remaining copy count.
3. Hash the committed opening entropy with the pool address, opening address, domain separator, and rejection counter.
4. Map the accepted sample to a rank from `0` through `available - 1`.
5. Walk the bitmap and reserve the leaf at that rank.

The domain separator is `pina-lootbox-prize-pool-selection`. The sampler uses eight bounded rejection rounds. The selected local item index and manifest slot are written to both the opening and the optional immutable result receipt.

The ordinary `allocateTemplateOpen` instruction rejects a bundle that contains a PrizePool. This rule prevents callers from consuming bundle inventory without reserving a leaf.

## Delivery

`claimPrizePoolItem` is permissionless to relay. It checks all of these bindings before its Bubblegum CPI:

- the opening is allocated to the supplied bundle;
- the opening contains a PrizePool assignment for the supplied manifest slot;
- the recipient equals the beneficiary recorded before the box burn;
- the item PDA matches the entropy-selected local index;
- the pool, bundle, tree, quantity, and manifest slot match;
- the nonce, tree index, and derived Bubblegum asset ID match the deposit;
- current metadata recomputes the supplied data and creator hashes;
- its normalized semantic commitment matches the admitted item;
- the root, hashes, and proof describe that owned leaf to Bubblegum;
- the selected bitmap bit is set and the claim counters remain valid.

The PrizePool PDA signs a Bubblegum transfer to the bound recipient. The program then records the claim and closes the item PDA. Solana transaction atomicity rolls back the accounting changes if Bubblegum rejects the proof or transfer.

## Invariants

The implementation enforces these invariants:

- Every pool ticket has one deposited leaf before bundle activation.
- A leaf is owned by the PrizePool PDA while it backs an unclaimed ticket.
- One bundle cannot contain more than one PrizePool.
- One PrizePool contains leaves from one pinned tree.
- An item can be assigned at most once.
- `assigned_count + reclaimed_count` equals the number of set bitmap bits.
- `claimed_count <= assigned_count`.
- A winner can receive only the leaf selected from committed entropy.
- A relayer cannot change the bound recipient.
- A proof can change with the tree root, but leaf identity and semantic metadata cannot change.
- Valid creator or collection verification-flag changes cannot strand an owned leaf.
- The creator cannot reclaim an assigned item.
- Recovery cannot make a published template editable.

## Failure behavior

| Attempt                                     | Result                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Reuse an older proof after a tree write     | Bubblegum accepts only if the concurrent tree can fast-forward the unchanged leaf within its changelog; otherwise it rejects |
| Supply more than 16 proof nodes             | Lootbox rejects before CPI; configure enough canopy to shorten the proof                                                     |
| Transfer a deposited leaf as the old owner  | Bubblegum rejects the owner signature                                                                                        |
| Supply arbitrary hashes or metadata         | Lootbox recomputes the hashes and semantic commitment before Bubblegum CPI                                                   |
| Supply a different nonce or index           | Lootbox rejects the asset identity before transfer                                                                           |
| Claim to a different wallet                 | Lootbox rejects the recipient                                                                                                |
| Allocate through the ordinary instruction   | Lootbox rejects the missing pool reservation                                                                                 |
| Deposit beyond the fixed quantity           | Lootbox rejects the full pool                                                                                                |
| Seal a partially funded pool                | Lootbox rejects the incomplete pool                                                                                          |
| Reclaim a non-tail unfinished deposit       | Lootbox rejects the state transition                                                                                         |
| Reclaim an assigned item                    | Lootbox rejects the unavailable item                                                                                         |
| Toggle collection/creator verification      | Fresh metadata and proof deliver the same semantically pinned asset                                                          |
| Replace a collection or creator identity    | Lootbox rejects the changed semantic commitment                                                                              |
| Admit mutable metadata through a raw client | `preparePrizePoolItem` rejects it on chain                                                                                   |

## Client behavior

The TypeScript SDK exposes resumable create, prepare, deposit, seal, allocation, permissionless claim, and recovery flows. The caller supplies a proof resolver because every tree write can change the root. The SDK refreshes again between prepare and deposit, refetches pool state after each confirmed transfer, validates canonical asset derivation, and verifies existing item PDAs before resuming. If another relayer wins a claim race, it refetches the opening and continues from the advanced claim mask instead of reporting a false failure.

Generated Rust, TypeScript, and Dart clients export `with_bubblegum_proof_accounts` / `withBubblegumProofAccounts` helpers. These replace the generator's single remaining-account placeholder with zero through 16 readonly proof nodes. The TypeScript funding options also accept a fresh proof resolver for standalone compressed-NFT prizes.

The Rust, TypeScript, and Dart planners enforce the 4,096-item limit, exact quantity, one tree, immutable metadata signals, distinct asset IDs across pooled and standalone prizes, and one PrizePool per bundle. The web creator flow adds a selected-item manifest, delegation and mutability gates, a transaction estimate, proof refresh, and per-transfer transaction progress.

## Verification

The test suite covers:

- exhaustive rank selection for every eight-bit bitmap;
- property tests for arbitrary bitmaps through 4,096 items;
- Kani proofs for available-bit selection and duplicate reservation rejection;
- compact-account size, counter, bit-count, and padding validation;
- cross-language planner vectors;
- stale and malformed proofs, proof-count overflow, old-owner transfers, delegated admission, ordinary-funding and allocation bypass, duplicate assignment, metadata/hash substitution, valid verification-flag changes, collection replacement, and recipient substitution;
- complete deposit, seal, activation, exact-supply lock, entropy allocation, claim, and item-account closure through deployed SBF programs in Surfpool;
- creator UI tree locking, mutable-item rejection, proof refresh, ownership refresh, and transfer-plan presentation.

The local Bubblegum fixture is intentionally narrower than production Bubblegum. It models ownership, leaf fields, changing mock roots, and atomic owner changes, but it does not execute a concurrent Merkle tree, canopy, changelog fast-forwarding, canonical tree-config PDA derivation, or real proof siblings. The program-level boundary tests and mock Surfpool journey catch lootbox state-machine errors; they do not establish upstream Bubblegum compatibility. A real Bubblegum + Account Compression devnet journey and an independent audit remain release gates.
