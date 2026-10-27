# Performance and scaling

The protocol keeps prize accounting on chain and fully collateralized. That makes its safety properties easy to explain, but it also makes the shared treasury state the primary throughput limit.

## Hot paths

| Path        | Shared writable accounts                                          | Practical consequence                                            | Current mitigation                                              |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Request     | Treasury, holder box ATA, opening, oracle accounts                | Requests for one treasury serialize on its inventory counters    | Use multiple independent treasuries for very large campaigns    |
| Fulfill     | Treasury, opening, oracle accounts, optional service vault        | Oracle and treasury contention; external CPI dominates compute   | Atomic SDK fulfill; bounded creator-funded bounty               |
| Allocate    | Treasury, opening, selected bundle, optional service vault/result | Every allocation updates the same finite inventory and FIFO head | Bounded scan of the compact active prefix, up to 1,024 slots    |
| Claim       | Opening and selected bundle plus adapter accounts                 | Complex NFT adapters can make transactions account-heavy         | Per-asset claim bits; SDK size/account-bounds each atomic batch |
| Create/fund | One bundle at a time plus asset programs                          | Large manifests require several creator signatures               | Resumable draft state and idempotent chain reads                |

## Hard limits

- 1,024 active bundle definitions per treasury.
- Four assets per bundle.
- `u32::MAX` total bundle copies.
- One indivisible Token-2022 box per bundle copy.
- FIFO allocation per treasury, so scarce inventory cannot be double-spent or reordered after results are known.

The bounded inventory prefix makes selection cost predictable. A new treasury stores no unused inventory slots and grows by eight bytes per activation, but a fully populated treasury still reaches 8,740 bytes. RPC consumers should use data slices or an indexer for discovery instead of repeatedly downloading every account.

## Ecosystem-scale topology

Do not route the entire ecosystem through one treasury. The scalable unit is a treasury series:

```text
project / campaign / season
          |
          +-- treasury A -- fixed box mint A -- FIFO A
          +-- treasury B -- fixed box mint B -- FIFO B
          +-- treasury C -- fixed box mint C -- FIFO C
```

Independent series execute in parallel because they do not share writable inventory. A project can shard by season, collection, geography, reveal window, or inventory size while keeping every mint fungible within its own locked series. A universal registry or indexer should stay read-only; putting a global writable registry in every instruction would recreate the bottleneck.

## What to measure before adding protocol sharding

1. Compute units and account-data bytes for the largest supported bundle and each external NFT adapter.
2. Successful settlements per slot for one treasury and for many treasuries.
3. Oracle proof latency, expiration rate, relayer inclusion rate, and bounty efficiency.
4. RPC time to discover treasuries, fetch up to 1,024 bundle accounts, and refresh live odds.
5. Transaction size and address lookup table use for mixed four-asset claims.
6. Failure rates by adapter, especially NFT transfer rules, Core plugins, and compressed-NFT proof depth.

Only introduce inventory lanes after measurements show that a single series needs more throughput than FIFO allows. Lanes change fairness semantics because they create several depletion pools; they must be visible in the box identity and locked manifest rather than hidden as an implementation optimization.

## Operational recommendations

- Index program accounts and materialize current odds off chain; always treat program state as authoritative when submitting.
- Keep proof fetchers and transaction senders separate, with durable queues and idempotent opening-address keys.
- Use several RPC providers, explicit commitment policies, simulation, priority fees, and alerting for the oldest FIFO head.
- Pre-resolve dynamic NFT accounts immediately before claim; cached proofs and authorization-rule accounts expire.
- Let the SDK split mixed prize delivery and resume from the current claim mask. Compressed transfers are capped at 16 supplied proof nodes on chain; configure sufficient tree canopy rather than relying on an address lookup table to bypass that account-count policy.
- Cap initial treasury value and supply, then increase only after observed load and adapter compatibility are stable.

## Compute units per instruction

Measured on the real SBF artifact by the deterministic Surfpool benchmark journeys (`devenv shell -- bench:compute-units`). The journeys use seed-derived fixture keys: the program's canonical-bump and associated-token-address assertions search from bump 255 downward, so random fixture keys shift the measured figures by thousands of units run to run. With fixed keys every enforced case reproduces exactly, which is what the `performance` workflow compares against on every pull request.

The box-curve family is measured but reported as advisory: Surfpool's local runtime meters those four instructions with a per-boot variance quantized at one sha256-syscall, independent of the fixture keys. The other 46 cases are byte-identical across runs.

### Treasury templates

| Instruction              | Compute units |
| ------------------------ | ------------: |
| `activate_bundle`        |         6,000 |
| `add_bundle`             |         6,590 |
| `allocate_template_open` |        21,204 |
| `cancel_bundle`          |         3,813 |
| `claim_mint_prize`       |        13,525 |
| `claim_sol_prize`        |         5,469 |
| `claim_token_prize`      |        15,025 |
| `close_service_vault`    |         5,359 |
| `close_template_opening` |         7,642 |
| `create_template`        |        11,931 |
| `forfeit_template_open`  |         8,997 |
| `fulfill_template_open`  |        13,579 |
| `fund_mint_prize`        |         5,338 |
| `fund_quote_sol_prize`   |         5,097 |
| `fund_quote_token_prize` |         8,559 |
| `fund_sol_prize`         |         5,098 |
| `fund_token_prize`       |         8,639 |
| `lock_treasury`          |        11,693 |
| `mint_template_boxes`    |         7,379 |
| `reclaim_mint_prize`     |         5,615 |
| `reclaim_sol_prize`      |         4,297 |
| `reclaim_token_prize`    |        13,422 |
| `request_template_open`  |        23,972 |
| `retire_template`        |         2,328 |
| `seal_template`          |         2,172 |

### Box curve

| Instruction        | Compute units |
| ------------------ | ------------: |
| `buy_curve_boxes`  |        11,369 |
| `close_box_curve`  |        10,490 |
| `open_box_curve`   |        11,654 |
| `sell_curve_boxes` |         9,014 |

### Prize pool

| Instruction                      | Compute units |
| -------------------------------- | ------------: |
| `allocate_prize_pool_open`       |        19,497 |
| `cancel_prize_pool_item`         |         7,564 |
| `claim_prize_pool_item`          |        15,249 |
| `claim_stranded_prize_pool_item` |        20,434 |
| `close_prize_pool`               |         5,767 |
| `create_prize_pool`              |        15,002 |
| `deposit_prize_pool_item`        |        14,979 |
| `prepare_prize_pool_item`        |        14,874 |
| `reclaim_prize_pool_item`        |        15,504 |
| `seal_prize_pool`                |         6,170 |

### Core-asset prizes (real MPL Core)

| Instruction                | Compute units |
| -------------------------- | ------------: |
| `claim_core_asset_prize`   |        12,135 |
| `fund_core_asset_prize`    |        10,246 |
| `reclaim_core_asset_prize` |        10,654 |

### Exclusive Lootbox NFTs (real Bubblegum V2 and MPL Core)

| Instruction                    | Compute units |
| ------------------------------ | ------------: |
| `append_exclusive_tree`        |       115,407 |
| `attach_exclusive_nft`         |        13,663 |
| `claim_exclusive_nft`          |       125,489 |
| `create_exclusive_collection`  |        23,905 |
| `publish_exclusive_collection` |        21,409 |
| `reclaim_exclusive_fees`       |         9,328 |
| `set_exclusive_layer`          |         3,231 |

The `compressedNftPrize` trio is gated by the deployed-binary size check and the static profile; its runtime journey needs the fixture program described in the benchmark module's documentation.

## Client compute budgets

The measured tables above are not only documentation: the TypeScript, Dart, and Rust planners budget every transaction from them, pinned across languages by [`tests/vectors/compute-units.json`](../tests/vectors/compute-units.json). A program change that regresses compute units fails the `performance` workflow in the same pull request that must update the vector file, so the client budgets and the measured tables cannot drift apart.

The budget policy doubles the summed measured units and adds 10,000, floored at 50,000 and capped at 1,398,000. The margin is deliberately generous: the journeys use fixture keys whose canonical bumps sit near 255, while real keys can land further down the bump search and shift an instruction by thousands of units. Priority fees are charged on the compute units a transaction consumes, never on the requested limit, so the margin cannot inflate a priority fee — it only guards against limit exhaustion. A transaction containing any instruction outside the measured lootbox tables is sent without a limit rather than guessing.

`LootboxClient.send` applies the budget automatically, accepts an explicit `computeUnitLimit` (or `"none"`), and attaches a `priorityFeeMicroLamports` price when given one. The Rust CLI prepends the same `SetComputeUnitLimit` instruction to every `--send` submission.

## Lookup-table compression

Opening transactions pass roughly twenty accounts, most of them static programs, sysvars, and mints. A program-owned address lookup table compresses those into one-byte indices, shrinking transactions and improving landing odds under congestion. `pnpm --dir sdks/typescript bootstrap:lut -- --cluster <devnet|mainnet> --keypair <path>` creates the table (lootbox, Switchboard, system, compute budget, both token programs, ATA, wrapped SOL, and the four sysvars), extends it in chunks, and verifies it on chain. Pass the printed address to `LootboxClient` through `lookupTableAddresses`; contents are fetched once per cache lifetime (five minutes by default) and every sent transaction is compressed with them. Lookup tables only shrink transactions whose static accounts they list, and only non-signer accounts are compressed.

## Program size

The deployed `lootbox_program.so` is **465,816 bytes**, built `cdylib`-only with fat LTO, `codegen-units = 1`, and `opt-level = 3` (the profile `pina build` applies). The crate must stay `cdylib`-only: a second `lib` crate type makes rustc silently drop LTO, which cost 17.9% of the program's size and several percent of compute units on every instruction before it was fixed. Removing the Token Metadata prize adapters (fund, claim, reclaim) and the unused `PrizeExhausted` error took another 37 KB after LTO; retiring the superseded single-reward family (ten instructions, three account types, and their helpers) took another 73 KB. The adapter, prize-pool, and exclusive families dispatch out of line so the LTO-inlined main dispatcher frame stays inside the SBF 4 KiB limit.

The size-optimised `opt-level = "s"` profile was measured and rejected: it saves under 2% of the binary but adds two-digit compute units to most families, up to +48% on `open_box_curve`.

Overflow checks stay enabled: every hand-written operation is already checked, and the checks turn any missed one into a failed transaction instead of a wrap (the same trade the other pina-rs programs make).

## Measuring yourself

```sh
devenv shell -- bench:compute-units   # writes target/perf/cu/<family>.json
node tools/perf/compare.mjs            # compares against the last recorded baseline
```

The `performance` workflow posts a pull-request comment comparing every instruction and the binary size against the PR base, and fails when a regression exceeds the thresholds in [`tools/perf/policy.json`](../tools/perf/policy.json).
