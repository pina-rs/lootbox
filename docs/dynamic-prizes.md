# Dynamic prize delivery

Status: winner-routed quote delivery and badge minting are implemented and tested on local Surfpool. Fixed bonding-curve adapters and fresh-mint NFT factories are design-gated and are not accepted by the program.

## Invariants

- A quote prize is denominated in SOL or a specific token that the bundle already escrows. The program never promises a launch-token amount.
- Funding escrows `amount per win × quantity` before activation. Allocation consumes one bundle copy; each claim releases exactly one funded unit.
- The opening fixes its beneficiary at burn time. A relayer may submit a claim, but cannot substitute a destination.
- A winner-selected route receives only quote assets already delivered to that winner. No route receives a bundle or treasury PDA signature.
- Route execution and quote delivery share one Solana transaction. Any failed route instruction rolls back the quote claim and leaves the escrow unchanged.
- The program stores no runtime instruction bytes and provides no generic CPI executor.
- A badge is collateralized by mint authority surrendered to the bundle PDA plus the bundle's arithmetic claim cap. It is created at claim time and does not exist as circulating supply at funding time.

## Winner-routed quote prizes

Shape B ships first. It keeps routing outside the program while preserving atomic execution.

| Manifest field | SOL quote        | Token quote         |
| -------------- | ---------------- | ------------------- |
| `kind`         | `7`              | `8`                 |
| `target`       | all zeroes       | quote mint          |
| `amount`       | lamports per win | base units per win  |
| `decimals`     | `9`              | quote-mint decimals |

`fundQuoteSolPrize` transfers the full SOL liability into the bundle PDA. `fundQuoteTokenPrize` transfers the full token liability into the bundle's canonical ATA. Token quotes accept classic SPL Token and only the existing safe Token-2022 extension allowlist; wrapped SOL, freeze authority, delegates, close authority, frozen accounts, and behavior-changing extensions fail closed.

The existing beneficiary-bound SOL and token claim paths recognize the quote kinds. A plain claim delivers the quote itself and is the graceful fallback. For a dynamic purchase, the TypeScript client composes the claim first and the winner's route second:

```ts
const instructions = composeWinnerRoutedSolQuoteClaim({
	template,
	opening,
	bundle,
	assetIndex: 0,
	winner,
	route: winnerSelectedBuyInstructions,
});
```

The helper requires a non-empty route containing the bound winner as a signer. The wallet submits the returned instructions as one transaction. A curve or DEX failure reverts the entire transaction, including the preceding quote transfer. The winner may instead claim the quote without a route.

There is deliberately no oracle, launch-token promise, program-selected price, curve pin, or floor in this shape. Price protection belongs in the winner-selected buy instruction, where the winner can set its minimum output. Route choice cannot change which bundle was allocated and cannot produce a reroll.

## Badge mint prizes

`PRIZE_MINT_BADGE` uses manifest kind `9`, stores the badge mint as its target, and fixes the per-win amount to one.

Funding accepts an empty classic or safe Token-2022 mint only when it has zero supply, zero decimals, the creator as mint authority, and no freeze authority. Funding then transfers mint authority to the bundle PDA. The authority transfer is irreversible from the creator's perspective.

Each successful `claimMintPrize`:

1. verifies the opening's bound beneficiary and canonical destination ATA;
2. verifies the stored mint, token program, extension allowlist, zero decimals, no freeze authority, and bundle PDA mint authority;
3. checks that current supply equals the manifest's prior claim count;
4. records exactly one claim and mints exactly one badge; and
5. revokes mint authority when the final allowed copy is minted.

The existing allocation accounting makes the cap equal to `quantity`. Supply is checked against the claim counter before every mint, so out-of-band supply changes fail closed. Duplicate claims and claims beyond quantity fail.

If a staged bundle is cancelled or an eligible retired bundle is reclaimed, `reclaimMintPrize` permanently revokes the PDA's mint authority. It never returns authority to the creator. This can leave unminted capacity intentionally unusable, which is safer than restoring an advertised cap to mutable creator control.

## Fixed curve adapters: not enabled

Shape A requires more than a curve address in the four-slot manifest. A safe adapter needs a small rule PDA that pins an audited adapter version, curve program, canonical state derivation, quote asset, amount, output mint, minimum net output, and a fallback policy. The program must construct a fixed CPI schema, route output through a bundle-owned scratch ATA, verify the post-CPI balance delta, deliver only to the bound beneficiary, and sweep no value to caller-selected accounts.

Adapter governance should be global and versioned for buyer safety. A per-treasury arbitrary program choice would make program validation look like an endorsement and expands the CPI attack surface. A per-bundle output floor is preferable to a protocol-wide drift percentage because different curves expose different units, fees, and price behavior.

No adapter is currently allowlisted. The reviewed Meteora Dynamic Bonding Curve deployment is upgradeable, and its current swap ABI has optional referral plus transfer-hook and rate-limiter account variants. It therefore does not satisfy an immutable-program policy. Supporting it safely requires an explicit deployment-pinning policy—program data address and deployment slot, with claims disabled after an upgrade—or acceptance of its upgrade authority as a trust dependency. Until that policy is chosen, the program fails closed by exposing no fixed-adapter instruction.

## NFT factory: not enabled

A fresh supply-one mint does not exist at funding time, so its mint authority cannot be surrendered in the same way as a badge. An NFT factory therefore needs a separately pinned authority primitive, such as a collection or master authority controlled by the bundle PDA, plus a decision about metadata program trust and compute limits.

If added, the deterministic serial must be assigned during allocation from the committed opening result, not from claim order. Claim-order serials would make item assignment depend on relay timing. Metadata must be immutable, mint and freeze authorities must be revoked, and a two-step flow must preserve the allocated serial without permitting destination substitution or rerolls.

## Instruction additions

Existing discriminators remain unchanged.

| Discriminator | Instruction           |
| ------------- | --------------------- |
| `39`          | `fundQuoteSolPrize`   |
| `40`          | `fundQuoteTokenPrize` |
| `41`          | `fundMintPrize`       |
| `42`          | `claimMintPrize`      |
| `43`          | `reclaimMintPrize`    |

Quote delivery and recovery reuse the existing SOL and token claim/reclaim instructions. Generated TypeScript, Rust, and Dart clients expose all new instructions. Their planners understand `quoteSol`, `quoteToken`, and `mintBadge`; quote collateral multiplies by quantity, while one badge mint may back multiple wins.

## Verification

Unit tests cover manifest planning, amount overflow, badge exclusivity, and the arithmetic mint cap. Surfpool executes real SBF and token-program transactions proving quote funding, transaction-level rollback when a winner-signed route fails, later permissionless fallback delivery, authority transfer to the bundle, capped badge minting, duplicate-claim rejection, and final authority revocation.

This remains an experimental development build. Dynamic prizes require the same independent audit and production release gates as the rest of the treasury system.
