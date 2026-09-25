# Deploying the program

The lootbox program is deployed with the upgradeable BPF loader through two manual devenv scripts. Neither script runs from CI, hooks, or another script; a human starts every deploy.

```bash
devenv shell deploy:devnet
devenv shell deploy:mainnet
```

Both scripts build with `build:program` and then run `solana program deploy` with an explicit `--url`, `--keypair`, `--program-id`, and `--upgrade-authority`. Before building they check that:

- the RPC endpoint's genesis hash belongs to the requested cluster, so a devnet run can never reach mainnet and the reverse;
- the program keypair's address equals the `declare_id!` in `programs/lootbox_program/src/lib.rs`, because every PDA and ownership check is compiled against that id.

`deploy:mainnet` also requires an interactive terminal and the exact phrase `deploy <program id> to mainnet` before it sends anything.

## Environment

| Variable                            | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `LOOTBOX_DEPLOY_KEYPAIR`            | Fee payer keypair file. It also funds the program rent.                         |
| `LOOTBOX_PROGRAM_KEYPAIR`           | Program-id keypair file matching `declare_id!`. Keep it outside the repository. |
| `LOOTBOX_UPGRADE_AUTHORITY`         | Upgrade-authority keypair file. It signs the first deploy and every upgrade.    |
| `LOOTBOX_DEVNET_RPC_URL`            | Optional devnet RPC (default `https://api.devnet.solana.com`).                  |
| `LOOTBOX_MAINNET_RPC_URL`           | Required mainnet RPC. Use a dedicated provider; public RPC drops deploy writes. |
| `LOOTBOX_DEPLOY_COMPUTE_UNIT_PRICE` | Optional priority fee in micro-lamports per compute unit.                       |

Keep keypair files outside the repository. Never commit them, and never paste them into a shell history or chat.

## SOL required

Rent is `(128 + account bytes) × 5,080` lamports on both devnet and mainnet today (read from `getMinimumBalanceForRentExemption`; the older `× 6,960` rule of thumb overstates it). The scripts print live figures before deploying. For the current build (`lootbox_program.so` = 524,632 bytes):

| Account                           | Bytes   | Rent (lamports) | SOL      | Lifetime                           |
| --------------------------------- | ------- | --------------- | -------- | ---------------------------------- |
| ProgramData (`45 + .so`)          | 524,677 | 2,666,009,400   | 2.666009 | Locked while the program lives     |
| Program (`36`)                    | 36      | 833,120         | 0.000833 | Locked while the program lives     |
| Write buffer (`37 + .so`)         | 524,669 | 2,665,968,760   | 2.665969 | Refunded when the deploy completes |
| Write transactions (~560 × 5,000) | —       | ~2,800,000      | ~0.0028  | Spent                              |

Fund the fee payer with at least **5.4 SOL** for a first mainnet deploy: about 2.667 SOL stays locked and the ~2.666 SOL buffer comes back afterwards. Add headroom for priority fees on a congested cluster. An upgrade needs another buffer (~2.67 SOL, refunded) and, if the new build is larger than the current ProgramData, `solana program extend` for the difference first.

If a deploy is interrupted, the buffer keeps its lamports. Recover them with `solana program show --buffers --keypair "$LOOTBOX_DEPLOY_KEYPAIR"` and `solana program close <buffer>`.

## Switchboard On-Demand per cluster

The program accepts only these two Switchboard program ids (`switchboard_randomness_cpi::{DEVNET_ID, MAINNET_ID}`); a template records its `oracleProgram` and `oracleQueue` at creation, and every opening is checked against them.

| Cluster | Switchboard program                            | Randomness queue                               |
| ------- | ---------------------------------------------- | ---------------------------------------------- |
| devnet  | `Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2` | `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7` |
| mainnet | `SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv`  | `A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w` |

Sources: `ON_DEMAND_{DEVNET,MAINNET}_{PID,QUEUE}` in `@switchboard-xyz/on-demand` 3.10.6 (`dist/esm/utils/index.js`), and the on-chain Anchor IDL of both programs, whose `randomness_init`, `randomness_commit`, `randomness_reveal`, and `randomness_close` discriminators and account order match `crates/switchboard_randomness_cpi`.

The TypeScript SDK's `createSwitchboardOracle({ rpcUrl, cluster })` selects a verified queue oracle with a fresh heartbeat, derives the per-randomness lookup table (`LutSigner` PDA plus the `recent_slot` passed to `randomness_init`), and fetches the reveal proof from the bound oracle's gateway.

## Oracle timeout and relayer duty

An opening commits to a Switchboard seed slot. If no reveal lands within `RANDOMNESS_TIMEOUT_SLOTS` (300 slots, about two minutes), anyone may call `forfeitTemplateOpen`, which consumes no inventory and pays any settlement bounty to the bound beneficiary. Forfeits are a liveness backstop, not a fair outcome for the holder, so a deployment must run a relayer that:

1. watches pending openings in FIFO order;
2. calls `SwitchboardOracle.fetchProof(randomness)` as soon as the seed slot has passed;
3. submits `settle` (reveal plus allocation) well inside the 300-slot window, retrying with a fresh blockhash but never with a different proof source;
4. alerts when the queue has no usable oracle (`SwitchboardError` code `noUsableOracle`) or a gateway keeps failing.

The gateway response is not trusted: `randomness_reveal` verifies the oracle signature on-chain, so a bad gateway can only cost a failed transaction.

## Measuring a reveal on devnet

`sdks/typescript/scripts/devnet-e2e.ts` creates a small SOL + SPL treasury, locks it with a reveal time two minutes ahead, opens one box against live Switchboard, settles, claims, closes the receipt, and prints each signature with its fee and lamport movement:

```bash
LOOTBOX_DEVNET_KEYPAIR=/path/to/devnet-only.json pnpm --dir sdks/typescript e2e:devnet
```

It refuses to run when the RPC genesis hash is not devnet's or the program is not deployed. `LOOTBOX_E2E_TEMPLATE` opens a box from an existing locked treasury instead of creating one, and `LOOTBOX_E2E_OPENING` resumes a pending opening.

### Measured cost of one open (devnet, 2026-09-25)

Payer lamports for one open of a SOL prize, with no settlement bounty or result receipt, against program `LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E` and live Switchboard devnet:

| Step                               | Fee    | Rent locked (−) / refunded (+) | Notes                                                                                   |
| ---------------------------------- | ------ | ------------------------------ | --------------------------------------------------------------------------------------- |
| Burn box and commit randomness     | 10,000 | −8,168,640                     | Two signatures (payer and randomness key); 150,487 of the default 200,000 compute units |
| Verify randomness and record prize | 5,000  | 0                              | Switchboard reveal plus allocation in one transaction                                   |
| Claim                              | 5,000  | 0                              | Prize delivered (+1,000,000 lamports here)                                              |
| Close receipt                      | 5,000  | +6,746,240                     | Opening, randomness, and reward escrow closed                                           |
| **Net, excluding the prize**       | 25,000 | −1,422,400                     | **1,447,400 lamports ≈ 0.00145 SOL per open**                                           |

The rent locked by the commit is the opening receipt (2,169,160), the Switchboard randomness account (480 bytes, 3,088,640), its wrapped-SOL reward escrow (1,488,440), and a Switchboard address lookup table (1,422,400). The devnet queue charged no oracle fee: the escrow held exactly its rent.

The lookup table is the one cost that does not come back. `randomness_close` deactivates it, and Switchboard's separate `randomness_close_lut` can reclaim it only after the deactivation cooldown and only when signed by the randomness key, which `requestOpen` generates and discards. Keeping that key for a later sweep would recover about 0.0014 SOL per open.

## Launching a token treasury

`sdks/typescript/scripts/launch-treasury.ts` launches a token-prize treasury from a JSON plan (name, symbol, uri, `revealAt`, `supplyRecipient`, and bundles of raw-unit token prizes). It prints a dry run first: bundles, per-mint escrow and issuer-fee gross-up from the mint's current `TransferFeeConfig`, creator balances, estimated SOL, and box supply. It sends nothing without `--execute`:

```bash
pnpm --dir sdks/typescript launch:treasury -- --plan treasury.json --cluster devnet --keypair ~/devnet.json
pnpm --dir sdks/typescript launch:treasury -- --plan treasury.json --cluster devnet --keypair ~/devnet.json --execute
```

Execution is resumable: a state file next to the plan (`treasury.launch.json`) pins the template id and box mint key, and the SDK continues from on-chain state. The run ends by locking the treasury, which mints the exact box supply to `supplyRecipient`, and prints `VITE_TREASURY=<template>` for the web app. For devnet tests, `pnpm --dir sdks/typescript create:stock-mint` creates a Token-2022 mint shaped like a PreStocks stock (PreStocks issuer as permanent delegate and freeze authority, a 100 bps transfer fee, on-mint metadata).

## Upgrade-authority custody

- Use a dedicated upgrade authority, never the fee payer or a hot wallet. For mainnet, transfer it to a multisig (for example Squads) right after the first deploy: `solana program set-upgrade-authority <program> --new-upgrade-authority <multisig vault>`.
- Keep the program-id keypair offline once the program exists; it is needed again only if the program is closed and redeployed.
- Publish the upgrade authority and a verifiable build hash (`solana-verify`) so holders can check what they are trusting.
- When the protocol is final, consider `--final` or setting the authority to `none`; that is irreversible.
