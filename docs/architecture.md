# Architecture

## Design goals

The original single-reward flow optimizes for a small auditable core:

- one box token equals one future draw;
- outcome odds become immutable before boxes exist;
- oracle initialization, commitment, and box burn happen atomically;
- oracle reveal and reward settlement happen atomically;
- payouts can never depend on the authority remaining online;
- every outstanding claim is funded at its worst possible value.

That compact flow deliberately supports SOL payouts only. Arbitrary SPL tokens, NFTs, bundles, metadata standards, and pluggable payout adapters are provided by treasury templates.

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
                            request_open + init CPI + commit CPI + burn
                                                       v
                                                    pending
                                                   /       \
                          reveal CPI + settle_open /         \ refund_open
                                                 v           v
                                             settled      floor paid
                                                   \       /
                                    oracle close + close_opening
```

`seal` is irreversible. A pending opening is also irreversible except through its two explicit terminal paths: revealed settlement or an unrevealed timeout refund.

## Solvency model

The liability count is the live SPL mint supply plus pending openings. Burning moves one unit from supply to pending and does not reduce liability. Settlement removes one pending unit and pays its selected reward; timeout refund removes one pending unit and pays the minimum configured reward. Neither path changes live mint supply. Therefore each transition preserves:

```text
available vault lamports >= active claims * maximum reward
```

The program reads the actual SPL mint supply instead of inferring it solely from counters. Direct holder burns therefore reduce liability safely, while unauthorized minting remains impossible because the lootbox PDA is the mint authority.

`withdraw_surplus` is authority-only and computes the same invariant against the live mint before transferring a lamport. Vault rent is never withdrawable.

## Selection

The oracle's 32-byte value is hashed with:

- domain separator `pina-lootbox-outcome`;
- lootbox address;
- opening address;
- a retry counter.

The first eight bytes become a little-endian `u64`. Rejection sampling discards the small high-range remainder that would otherwise create modulo bias, then maps the result into the cumulative weight table. The protocol caps the sum of weights at `u32::MAX`, so one sample rejects with probability below `2^-32`. After eight rejected hashes, a deterministic modulo fallback guarantees settlement; the probability of reaching that fallback—and therefore the statistical distance it can introduce—is below `2^-256` under the SHA-256 random-oracle assumption.

## Trust and liveness

The lootbox authority controls configuration, minting within `max_supply`, deposits, and genuine surplus withdrawals. It cannot change a sealed reward table, redirect a payout, choose a revealed outcome, or block settlement.

The opening PDA—not the holder or lootbox authority—is each Switchboard randomness account's authority. Only the Lootbox program can initialize, commit, reveal, or close through that PDA. Switchboard is the external trust/liveness dependency: if no relayer settles within 300 slots, the recipient can claim the minimum configured reward. A holder gains nothing by withholding an unfavorable off-chain proof because timeout never pays more than the authentic outcome and never creates another draw; the recipient signature also prevents a third party from forcing that lower floor payout.

## Treasury evolution

Likely follow-on work, intentionally outside this MVP:

| Capability            | Shape                                                                           | Estimated effort               |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| SPL-token rewards     | Per-mint vault adapters and token-account validation                            | 1–2 weeks                      |
| NFT or bundle rewards | Escrow inventory, deterministic bundle manifests, partial depletion rules       | 3–5 weeks                      |
| Networked playground  | Wallet adapter, Switchboard transport, devnet RPC gateway, transaction progress | 1–2 weeks                      |
| Production release    | External audit, devnet soak, monitoring/indexer, incident runbooks              | 3–6 weeks plus audit lead time |

These estimates assume the current account model remains stable.
