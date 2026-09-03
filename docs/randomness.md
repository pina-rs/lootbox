# Randomness

## Why an oracle

Solana programs are deterministic, so block time, recent hashes, signatures, and account addresses are not safe entropy. Lootbox v1 consumes Switchboard On-Demand's commit/reveal randomness instead of inventing a protocol-specific oracle.

Switchboard's official guide identifies the core failure mode: if value is committed only after reveal, a user can selectively continue favorable draws. Lootbox binds the box burn to a fresh commitment and makes reveal inseparable from settlement. See the [Switchboard randomness tutorial](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial).

## PDA-controlled atomic flow

```text
transaction A:
  owner + fresh randomness keypair sign request_open
    -> create opening PDA
    -> opening PDA signs Switchboard randomness_init CPI
    -> opening PDA signs Switchboard randomness_commit CPI
    -> verify committed oracle state
    -> burn one box and store the exact seed slot

transaction B, after the committed slot:
  any relayer signs settle_open with a Switchboard gateway proof
    -> opening PDA signs Switchboard randomness_reveal CPI
    -> verify the revealed oracle state and proof value
    -> select and pay the stored recipient

cleanup:
  close_opening
    -> opening PDA signs Switchboard randomness_close CPI
    -> return randomness and receipt rent to the recipient
```

The opening PDA, derived from `['opening', lootbox, randomness]`, is the Switchboard randomness authority for the entire lifecycle. A box holder cannot sign a direct re-commit, reveal, or close. The only instruction that can create that PDA is `request_open`, and it accepts only a fresh, signer-backed randomness account. This closes both selective-refund and commitment-overwrite paths.

`request_open` rolls back the receipt, both oracle CPIs, accounting, and burn if any step fails. `settle_open` likewise rolls back the oracle reveal if recipient validation, selection, solvency, or payout fails.

## Client construction

Switchboard's `Randomness.create(...)` helper returns a randomness object and an unsigned `randomness_init` instruction. Use that instruction as an account/slot template; do not submit it directly because it names the wallet as authority. Pass its initialization accounts and `recentSlot` into Lootbox's generated `request_open` builder instead. Lootbox substitutes the opening PDA as authority inside its CPI.

The request transaction must be signed by both the box owner and the fresh randomness keypair. The generated Rust and TypeScript clients mark both correctly, and derive the opening PDA from the lootbox and randomness addresses.

After the commitment matures, call Switchboard's `Randomness.revealIx(...)` to fetch the gateway proof but do not submit that instruction directly. Decode its 105-byte data with `decode_switchboard_reveal` or `decodeSwitchboardReveal` in the Rust, TypeScript, or Dart SDK. Feed those signature, recovery ID, and value fields—plus the reveal instruction's oracle accounts—into Lootbox's generated `settle_open` builder. Lootbox performs the authenticated reveal CPI under the opening PDA and pays in one atomic instruction.

The [official Switchboard TypeScript implementation](https://github.com/switchboard-xyz/on-demand/blob/main/src/accounts/randomness.ts) is the reference for initialization account derivation, fresh-oracle selection, gateway proof retrieval, and lookup-table addresses.

## Validations

At request, the program requires:

- the configured oracle program to be one of the compiled-in Switchboard mainnet/devnet IDs;
- a fresh, writable randomness account whose new keypair signed the outer transaction;
- the configured queue, a writable oracle, canonical slot-hashes sysvar, and known system/token/ATA/wrapped-SOL/lookup-table addresses;
- Switchboard initialization to store the opening PDA as authority and the configured queue;
- Switchboard commit to produce a non-zero seed slot and remain unrevealed;
- the owner to hold a box in their canonical associated token account.

At settlement, it re-checks the oracle program, queue, oracle, randomness owner/layout, opening PDA, stored recipient, stored seed, and unrevealed state before CPI. After CPI it requires a later reveal slot and an exact match between the signed proof value and stored oracle value before selecting or paying an outcome.

At cleanup, it re-checks the terminal receipt and oracle binding before the opening PDA authorizes Switchboard account closure. Switchboard currently deactivates the per-randomness address lookup table but cannot recover that table's rent after the protocol's cooldown in the same call; this upstream limitation is documented as a residual cost in the security review.

The parser offsets and 408-byte minimum are pinned to the official [`RandomnessAccountData` source](https://docs.rs/switchboard-on-demand/latest/src/switchboard_on_demand/on_demand/accounts/randomness.rs.html). The official client source also confirms the compiled-in [mainnet and devnet program IDs](https://docs.rs/switchboard-on-demand-client/latest/src/switchboard_on_demand_client/lib.rs.html).

## Why the program uses a small local parser

The on-chain crate must remain `no_std` and use Pina's Solana types. Pulling the full oracle SDK into the SBF program would add a second framework/type graph and significantly enlarge the trusted dependency surface. The program instead parses only the fields it needs from the documented zero-copy ABI and constructs the four pinned Switchboard instructions directly.

That tradeoff makes ABI monitoring an explicit maintenance duty. Any Switchboard change to the discriminators, account ordering, data layout, or deployed IDs requires a Lootbox release and a devnet compatibility run before mainnet use. Short data, unknown owners, mismatched accounts, and unexpected post-CPI state fail closed.

## Failure path

An opening still unrevealed at `seed_slot + 300` may be refunded by its recipient. The signed refund re-checks the PDA authority, queue, owner, stored seed, and absence of an on-chain reveal, then pays the lowest reward in the immutable outcome table and terminalizes the receipt. Recipient authorization prevents an outsider from racing a valid settlement merely to force the lower floor payout.

It deliberately does not remint the box. A gateway proof exists off chain before the reveal CPI, so reminting would let a holder inspect an unfavorable proof, withhold it, wait for timeout, and buy another draw. The minimum reward is never better than the authentic outcome; withholding a proof therefore cannot improve the recipient's result. This trades retry liveness for economic fairness while still guaranteeing the configured reward floor.

## Surfpool test oracle

`tests/fixtures/mock_switchboard` is a separate SBF program deployed at the Switchboard devnet address only inside an isolated offline Surfpool. It owns a canonical 408-byte account and models the current initialization, commit, reveal, and close CPI account shapes. There is no feature flag, alternate owner, or test instruction in the production lootbox binary.
