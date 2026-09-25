# Deploying the program

The lootbox program is deployed with the upgradeable BPF loader through two manual devenv scripts. Neither script runs from CI, hooks, or another script; a human starts every deploy.

```bash
devenv shell deploy:devnet
devenv shell deploy:mainnet
```

Both scripts build with `build:program` and then run `solana program deploy` with an explicit `--url`, `--keypair`, `--program-id`, and `--upgrade-authority`. Before building they check that:

- the RPC endpoint's genesis hash belongs to the requested cluster, so a devnet run can never reach mainnet and the reverse;
- the program keypair's address equals the program's `declare_id!` (`Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op`), because every PDA and ownership check is compiled against that id.

`deploy:mainnet` also requires an interactive terminal and the exact phrase `deploy <program id> to mainnet` before it sends anything.

## Environment

| Variable                            | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `LOOTBOX_DEPLOY_KEYPAIR`            | Fee payer keypair file. It also funds the program rent.                         |
| `LOOTBOX_PROGRAM_KEYPAIR`           | Program-id keypair file for `Bp6AJD3Q…`. Needed only for the first deploy.      |
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

It refuses to run when the RPC genesis hash is not devnet's or the program is not deployed.

## Upgrade-authority custody

- Use a dedicated upgrade authority, never the fee payer or a hot wallet. For mainnet, transfer it to a multisig (for example Squads) right after the first deploy: `solana program set-upgrade-authority <program> --new-upgrade-authority <multisig vault>`.
- Keep the program-id keypair offline once the program exists; it is needed again only if the program is closed and redeployed.
- Publish the upgrade authority and a verifiable build hash (`solana-verify`) so holders can check what they are trusting.
- When the protocol is final, consider `--final` or setting the authority to `none`; that is irreversible.
