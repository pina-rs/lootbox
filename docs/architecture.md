# Architecture

## Design goals

Lootbox v1 optimizes for a small auditable core:

- one box token equals one future draw;
- outcome odds become immutable before boxes exist;
- the oracle commitment and box burn happen atomically;
- payouts can never depend on the authority remaining online;
- every outstanding claim is funded at its worst possible value.

The first version deliberately supports SOL payouts only. Arbitrary SPL tokens, NFTs, bundles, metadata standards, and pluggable payout adapters are deferred until the base accounting and randomness contract has production history.

## Accounts

### `LootboxState`

Definition and accounting PDA derived from `['lootbox', authority, id]`. It stores the mint, selected Switchboard program and queue, at most eight `(weight, reward_lamports)` pairs, maximum supply, live counters, and canonical PDA bumps.

### `VaultState`

Program-owned SOL vault derived from `['vault', lootbox]`. It stores only its parent lootbox, immutable rent reserve, and bump. Keeping rewards in a separate account prevents definition data from being resized or entangled with payout accounting.

### `OpeningState`

Per-draw receipt derived from `['opening', lootbox, randomness]`. It binds the burned box to one randomness account, seed slot, and recipient. Its terminal state records either the selected outcome and payout or a refund.

## State transitions

```text
draft --add_outcome--> draft --seal--> sealed --mint_boxes--> circulating
                                                       |
                                    commit + request_open + burn
                                                       v
                                                    pending
                                                   /       \
                                      settle_open /         \ refund_open
                                                 v           v
                                             settled       refunded
                                                   \       /
                                                close_opening
```

`seal` is irreversible. A pending opening is also irreversible except through its two explicit terminal paths: revealed settlement or an unrevealed timeout refund.

## Solvency model

The liability count is the live SPL mint supply plus pending openings. Burning moves one unit from supply to pending and does not reduce liability. Settlement removes one pending unit and pays no more than `max_reward`; refund removes one pending unit and remints one box. Therefore each transition preserves:

```text
available vault lamports >= active claims * maximum reward
```

The program reads the actual SPL mint supply instead of inferring it solely from counters. Direct holder burns therefore reduce liability safely, while unauthorized minting remains impossible because the lootbox PDA is the mint authority.

`withdraw_surplus` is authority-only and computes the same invariant against the live mint before transferring a lamport. Vault rent is never withdrawable.

## Selection

The oracle's 32-byte value is hashed with:

- domain separator `pina-lootbox-outcome-v1`;
- lootbox address;
- opening address;
- a retry counter.

The first eight bytes become a little-endian `u64`. Rejection sampling discards the small high-range remainder that would otherwise create modulo bias, then maps the result into the cumulative weight table. The retry bound of eight has negligible failure probability while keeping compute bounded; failure leaves the opening pending and retryable.

## Trust and liveness

The authority controls configuration, minting within `max_supply`, deposits, and genuine surplus withdrawals. It cannot change a sealed reward table, redirect a payout, choose a revealed outcome, or block settlement.

Switchboard is the only external trust/liveness dependency. If its committed randomness remains unrevealed for 300 slots, anyone can restore the burned token to the fixed recipient. A revealed draw cannot be converted into a refund.

## Scope after v1

Likely follow-on work, intentionally outside this MVP:

| Capability            | Shape                                                                          | Estimated effort               |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------ |
| SPL-token rewards     | Per-mint vault adapters and token-account validation                           | 1–2 weeks                      |
| NFT or bundle rewards | Escrow inventory, deterministic bundle manifests, partial depletion rules      | 3–5 weeks                      |
| Live playground       | Wallet adapter, Switchboard client, Surfpool RPC gateway, transaction progress | 1–2 weeks                      |
| Production release    | External audit, devnet soak, monitoring/indexer, incident runbooks             | 3–6 weeks plus audit lead time |

These estimates assume the current account model remains stable.
