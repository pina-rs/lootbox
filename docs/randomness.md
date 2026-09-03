# Randomness

## Why an oracle

Solana programs are deterministic, so block time, recent hashes, signatures, and account addresses are not safe entropy. Lootbox v1 consumes Switchboard On-Demand's commit/reveal randomness instead of inventing a protocol-specific oracle.

Switchboard's official guide calls out the core failure mode directly: if value is taken only after reveal, a user can selectively continue favorable draws. Lootbox therefore commits and burns in one transaction, before a reveal is possible. See the [Switchboard randomness tutorial](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial).

## Atomic flow

```text
transaction A, slot N:
  1. Switchboard commit
  2. Lootbox request_open -> validate seed_slot == N -> burn -> bind receipt

transaction B, slot > N:
  1. Switchboard reveal
  2. Lootbox settle_open -> validate receipt + value -> pay recipient
```

The second transaction does not need the box owner to sign. A relayer or any third party can finish it.

## Validations

At request, the program requires:

- the configured oracle program is one of Switchboard's compiled-in mainnet/devnet IDs;
- the randomness account is owned by that exact program;
- its discriminator and minimum account size match `RandomnessAccountData`;
- its authority is the box owner and its queue is the lootbox's configured queue;
- it is unrevealed;
- `seed_slot` equals the current slot, forcing atomic commit-and-burn construction.

At settlement it re-checks owner, discriminator, queue, authority, stored randomness address, stored seed slot, receipt PDA, recipient, and reveal ordering.

The current parser offsets and 408-byte minimum are checked against the official [`RandomnessAccountData` source](https://docs.rs/switchboard-on-demand/latest/src/switchboard_on_demand/on_demand/accounts/randomness.rs.html). The official client source also confirms the compiled-in [mainnet and devnet program IDs](https://docs.rs/switchboard-on-demand-client/latest/src/switchboard_on_demand_client/lib.rs.html).

## Why the program uses a small local parser

The on-chain crate must remain `no_std` and use Pina's Solana types. Pulling the full oracle SDK into the SBF program would add a second framework/type graph and significantly enlarge the trusted dependency surface. The program instead parses only the six fields it needs from the documented zero-copy ABI.

That tradeoff makes ABI monitoring an explicit maintenance duty. Any Switchboard change to the discriminator, layout, or deployed IDs requires a release and a devnet compatibility run before mainnet use. The parser rejects short data and unknown account owners rather than attempting best-effort decoding.

## Failure path

An opening still unrevealed at `seed_slot + 300` may be refunded permissionlessly. Refund re-checks the same oracle binding, rejects any account with a reveal slot, restores one box to the original owner's canonical associated token account, and preserves vault liability. Once revealed, only settlement is valid.

## Surfpool test oracle

`tests/fixtures/mock_switchboard` is a separate SBF program deployed at the Switchboard devnet address only inside an isolated offline Surfpool. It owns a canonical 408-byte account and models commit/reveal state transitions. There is no feature flag, alternate owner, or test instruction in the production lootbox binary.
