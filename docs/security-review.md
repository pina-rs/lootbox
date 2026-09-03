# Security Review

Review date: 2026-09-03\
Scope: lootbox program, generated account surface, handwritten SDK validation, test oracle boundary, and playground gateway\
Reviewer: internal implementation review; this is not a substitute for an independent production audit

## Result

No known critical, high, or medium findings remain open in the deployable program, SDK, or web workspace. Two high-impact design flaws and several defense-in-depth issues were found while building and were fixed before this report. The full SBF path now passes offline Surfpool tests, including adversarial attempts.

## Security invariants

1. A user loses a box before its random result can be known.
2. Only an account owned by a compiled-in Switchboard program can supply entropy.
3. Every mint, vault, lootbox, receipt, queue, and recipient is bound to the expected address.
4. Vault balance excluding rent always covers every minted or pending box at the maximum payout.
5. Outcome weights cannot change after the first box is minted because sealing is irreversible and minting requires sealed state.
6. A receipt can reach exactly one terminal state and pays only its stored recipient.
7. Arithmetic failure aborts; it never wraps into a smaller liability or weight domain.

## Findings fixed

| Severity | Finding                                                                                                       | Why it mattered                                                                                                                                                                            | Resolution                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| High     | Prior-slot commitments were initially accepted                                                                | A user could potentially obtain or infer a reveal before choosing whether to burn, turning the box into a selective-opening option.                                                        | `request_open` now requires `seed_slot == current_slot`; Switchboard commit and box burn must share one atomic transaction. Surfpool rejects an aged commitment and proves no token is burned.   |
| High     | Settlement's explicit post-payout check originally counted pending receipts but did not read live mint supply | Earlier transitions happened to preserve the bound algebraically, but the settlement instruction did not independently prove the full invariant and would be fragile under future changes. | `settle_open` now receives and validates the box mint, then reserves `(live supply + remaining pending) * max reward` after payout.                                                              |
| High     | Fake randomness account risk                                                                                  | Matching bytes alone are forgeable and would let an attacker choose a result.                                                                                                              | The program restricts configured oracle IDs, asserts exact account ownership, validates the canonical discriminator/layout, queue, authority, seed, reveal state, and stored randomness address. |
| High     | Payout redirection                                                                                            | Permissionless settlement is unsafe if a caller can substitute the receiver.                                                                                                               | `request_open` stores the owner as recipient; settlement and closure require that exact writable address. An adversarial Surfpool settlement with a substituted recipient fails.                 |
| Medium   | Modulo bias in weighted selection                                                                             | `random % total_weight` favors some outcomes unless the domain divides evenly.                                                                                                             | Domain-separated SHA-256 plus bounded rejection sampling produces an unbiased target. Property tests assert every result remains in range.                                                       |
| Medium   | Double settlement and randomness replay                                                                       | The same reveal could otherwise pay repeatedly or across boxes.                                                                                                                            | A receipt PDA includes both lootbox and randomness addresses, stores a terminal status, and rejects all finalization after the first. Revealed randomness cannot create a new opening.           |
| Medium   | Oracle outage could permanently destroy a box                                                                 | Commit/reveal protocols need an explicit liveness failure path.                                                                                                                            | After 300 slots, an unrevealed receipt can remint exactly one box to its fixed recipient. Revealed receipts cannot refund.                                                                       |
| Medium   | Mint/account substitution                                                                                     | A caller could try another mint or token account to alter supply accounting or receive a refund.                                                                                           | Every path checks the stored mint address, zero decimals, lootbox PDA mint authority, absent freeze authority, and canonical associated token account.                                           |
| Medium   | Surplus withdrawal could consume claim funds                                                                  | Authority-controlled vault withdrawal must not trust stored counters alone.                                                                                                                | Withdrawal reads live mint supply, adds pending receipts, includes rent, uses checked arithmetic, and is signer/authority gated. Surfpool proves fully reserved collateral cannot be withdrawn.  |
| Low      | Client planners admitted values not representable as on-chain `u64`                                           | Transactions would fail late and cross-language behavior differed; negative big integers could also produce nonsensical plans.                                                             | Rust types and checked math plus explicit TypeScript/Dart range, negativity, sum, and collateral checks now fail before transaction construction.                                                |
| Low      | Unused account in withdrawal API                                                                              | Extra accounts enlarge the caller surface and make audit assumptions less obvious.                                                                                                         | Removed the unused token-program account from `withdraw_surplus`; generated clients were regenerated.                                                                                            |

| Low | Mutable state borrow crossed account-creation and burn CPIs | Borrow guards held across CPI make aliasing assumptions difficult to audit and can fail if a callee touches an overlapping account. | Pending state is now written and its guard explicitly dropped before either CPI; transaction rollback preserves atomicity on failure. | | Low | Program ownership before direct lamport debits was implicit in typed deserialization | The check was valid but hidden inside `assert_vault`, making the critical debit precondition harder for static analysis and reviewers to prove. | Settlement and surplus withdrawal now repeat an explicit vault owner assertion immediately before direct lamport mutation. | | Informational | Deposit used a trait wrapper around system transfer | Pina's lint could not prove the wrapper avoided dynamic allocation in an on-chain handler. | Deposit now invokes the fixed-shape `system::instructions::Transfer` helper directly. |

## Threat review

### Authority abuse

The authority can decide the initial odds and may choose not to mint. Once sealed, it cannot edit rewards. It cannot withdraw collateral backing live claims, freeze box transfers, redirect payouts, or prevent third-party settlement/refund. A malicious front end can still mislabel client-side outcome names; consumers should derive numeric odds and rewards from `LootboxState`.

### Oracle manipulation

The program assumes the configured Switchboard deployment and queue correctly implement their randomness guarantees. Owner checks prevent user-authored fake accounts, while atomic commit/burn removes the user's selective reveal option. Oracle compromise, queue misconfiguration, or protocol failure remains an external trust risk.

### Account confusion

All program-owned accounts validate discriminators, owners, stored parents, canonical seeds, and bumps. Opening actions bind both the randomness address and recipient. Token accounts must be canonical ATAs. Known system, token, clock, and oracle program addresses are asserted where used.

### Arithmetic and distribution

Supply, counters, weight totals, payouts, liability, and withdrawal minima use checked operations. Rejection sampling avoids modulo bias. Outcomes with zero weight are rejected; zero-lamport outcomes remain valid as intentional no-prize results.

### CPI and rollback

Box mint, burn, remint, account creation, and SOL movement are performed through Pina's typed helpers. State transitions and transfers share one Solana instruction/transaction boundary, so any downstream failure rolls back the entire change. Settlement marks the receipt terminal before the payout operation, following checks-effects-interactions discipline.

## Verification evidence

- Rust unit and property tests cover instruction decoding, outcome boundaries, random-domain range, liability counting, and SDK planning.
- TypeScript and Dart unit tests cover collateral math, invalid weights, negative values, and `u64` overflow.
- The Surfpool test deploys two real SBF artifacts and proves create → configure → fund → seal → mint, then both atomic commit/burn → reveal → permissionless settle → exact payout → close and atomic commit/burn → timeout → permissionless remint → close.
- The same Surfpool journey rejects over-minting, reserved-fund withdrawal, aged commitments, pre-reveal settlement, early refund, and payout redirection.
- React component tests and Playwright tests cover the user-visible commit/burn/reveal states on desktop and mobile.
- `cargo clippy`, Pina security lint, TypeScript checks, Dart analysis, dprint, `cargo audit`, `cargo deny`, pnpm audit, and the production web build are part of release verification.

The production workspace, test-oracle workspace, and pnpm workspace have no known dependency advisories at review time. The isolated Surfpool host harness inherits advisories from Surfpool/Solana's legacy transitive graph (`RUSTSEC-2024-0344`, `RUSTSEC-2022-0093`, `RUSTSEC-2026-0258`, `RUSTSEC-2024-0421`, `RUSTSEC-2026-0104`, `RUSTSEC-2026-0098`, and `RUSTSEC-2026-0099`). It runs offline, is excluded from the production workspace, and none of those crates are linked into either SBF artifact or the distributed SDKs. This is a tooling risk accepted for the required Surfpool coverage and should be removed by upgrading when Surfpool's dependency graph permits it.

## Residual risks and release gates

- This code has not received an independent audit or mainnet adversarial history.
- The compact Switchboard parser intentionally pins an external binary ABI. Monitor upstream releases and rerun devnet integration before each program release.
- The timeout restores the asset but cannot guarantee oracle availability or transaction inclusion.
- Fully collateralizing at the maximum reward is safe but capital-inefficient.
- The program is SOL-only and supports classic SPL Token mints, not Token-2022 extensions or arbitrary reward bundles.
- Upgrade authority policy, deployment reproducibility, multisig control, monitoring, and incident response must be decided before a public deployment.

Recommended production gates: independent audit, devnet soak with the real Switchboard program, reproducible binary verification, multisig upgrade authority, capped launch supply/value, monitoring for pending receipts and vault coverage, and a published incident process.
