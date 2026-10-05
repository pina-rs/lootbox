# Randomness lanes

Every opening today creates, commits, reveals, and closes a fresh Switchboard randomness account. Closing refunds most of the rent, but the account's address lookup table is never recovered, so each opening loses about 0.00144 SOL. That cost sets the minimum sensible value of a box.

A **lane** is a randomness account the program keeps and recommits for every opening instead. The account and its lookup table are paid for once, and each later opening costs only transaction fees. **Batching** goes further: several openings share one lane commit and derive their own values from its reveal.

Randomness lanes are unrelated to the inventory lanes in [performance](performance.md), which split a series' prize inventory.

This document records a devnet spike that tested whether Switchboard supports lanes and what a lane design has to enforce. The spike is [`sdks/typescript/scripts/randomness-lanes-spike.ts`](../sdks/typescript/scripts/randomness-lanes-spike.ts). It drives Switchboard On-Demand directly, with the payer as the randomness authority, so no program change was needed.

## Findings

Measured on devnet on 2026-09-26 against the default Switchboard queue, through the public devnet RPC.

| Question                                                        | Result                                                                                                                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can one account be committed and revealed repeatedly?           | **Yes.** One lane ran 5 consecutive cycles and another ran 2. Every reveal produced a different value.                                                                        |
| What does a recommit do to the account?                         | It records the new seed slot and oracle, resets `reveal_slot` to 0, and zeroes `value`. A reveal clears `oracle`.                                                             |
| Does Switchboard reject a commit while one is still unrevealed? | **No.** The second commit silently replaces the seed slot and oracle. The program must enforce this itself.                                                                   |
| Do accounts committed in the same slot get different values?    | **Yes.** Three accounts committed in one transaction shared a seed slot and slot hash, and all three values differed. The value is bound to the randomness account's address. |
| Can one transaction reveal round k and commit round k+1?        | **Yes.** A reveal followed by a commit on the same account is accepted, so a lane cycles with one transaction per opening.                                                    |
| How long does the gateway take to serve a proof?                | 107–539 ms after the commit is visible (p50 236 ms), always on the first request.                                                                                             |
| How fast can a lane cycle?                                      | Transactions landed within 2 slots at the median. The fastest full commit → reveal cycle was 6 slots (2.2 s).                                                                 |
| What does a lane cost?                                          | 6,009,480 lamports to create. Closing refunds 4,572,080, so 1,437,400 lamports (the lookup table and fees) is never recovered.                                                |
| What does a cycle cost?                                         | 10,000 lamports: two 5,000-lamport transaction fees. The fused reveal-plus-commit halves that. No oracle fee was charged.                                                     |
| How many oracles can commits spread across?                     | 5 usable of 9 on the devnet queue, 6 usable of 12 on the mainnet queue.                                                                                                       |

### What the spike could not measure

With 10 lanes cycling concurrently, the median cycle took 54 s. Transactions still landed within 2 slots, but polling the public RPC for confirmations took 11–22 s at the median, because the RPC rate-limits a single client to roughly ten requests a second. Those numbers measure the RPC, not Switchboard or the chain. A throughput measurement needs a dedicated RPC; rerun the `latency` experiment with `LOOTBOX_DEVNET_RPC_URL` set.

The spike also cannot show write-lock contention on the oracle accounts. `randomness_commit` writes the chosen oracle and `randomness_reveal` writes its stats account, and every Switchboard randomness user on the cluster shares the same handful of oracles. Their per-block write budget is a ceiling that only mainnet load can reveal.

## Design consequences

### Lanes need a busy flag

Because Switchboard accepts a commit over an unrevealed one, a lane without its own guard lets a second opening overwrite the first opening's commitment. The first opening then either verifies against the wrong seed slot or gets stuck. The program must record which opening holds each lane and reject any commit until that opening is revealed or forfeited. The lane PDA, not an opening PDA, becomes the randomness authority, so only the program can sign commits.

The existing reveal checks still bind each opening to its own draw: the seed slot, the oracle, and `reveal_slot > seed_slot`. Openings can no longer derive their PDA from the randomness address, so they are keyed by their template sequence instead.

### A lane cycles in one transaction

Because a reveal and the next commit can share a transaction, a busy lane can be revealed and handed to the next waiting opening in one step. A lane cycle is then one fee (5,000 lamports) plus the gateway round trip.

### Pool size

For plain lanes, one lane serves one pending opening:

**lanes needed = peak opens per second × seconds from commit to reveal**

The measured floor is about 2.2 s, and 3–5 s is a realistic planning figure until a dedicated-RPC run confirms it. At 4 s, 5 opens/s needs 20 lanes, 20 opens/s needs 80, and 100 opens/s needs 400. Each lane costs about 0.006 SOL, of which about 0.0014 SOL is never recovered.

With batching, openings that arrive before a lane's commit share it, and each derives its value as `sha256(domain ‖ lane ‖ seed_slot ‖ revealed_value ‖ sequence)`. The pool then scales with the commit cadence rather than with demand:

**lanes needed = seconds from commit to reveal ÷ seconds between commits**

Committing one lane per second with a 4 s cycle needs about 4 lanes at any opening rate. The cost is up to one extra second of waiting before an opening's commit. Openings must never join a lane after its commit, because the gateway can serve the value to anyone from then on.

## Running the spike

```bash
LOOTBOX_DEVNET_KEYPAIR=target/devnet/payer.json \
  pnpm --dir sdks/typescript spike:lanes -- --lanes 10 --cycles 5
```

`--experiments` selects any of `reuse`, `pending`, `sameslot`, `fused`, and `latency`. The script refuses any RPC that is not devnet, closes every lane it created unless `--keep` is passed, and writes a JSON report under `target/spikes/`.
