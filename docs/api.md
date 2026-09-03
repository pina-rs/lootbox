# API

## Minimal on-chain lifecycle

The instruction discriminators are stable single bytes from `0` through `9`. Generated clients should be preferred over assembling account metas manually.

| Instruction        | Who can call | Purpose                                                                          |
| ------------------ | ------------ | -------------------------------------------------------------------------------- |
| `create_lootbox`   | Authority    | Create definition and vault PDAs around a fresh zero-decimal SPL mint.           |
| `add_outcome`      | Authority    | Append one positive weight and SOL reward; maximum eight.                        |
| `deposit`          | Any signer   | Add SOL to the vault.                                                            |
| `seal`             | Authority    | Permanently freeze the outcome table.                                            |
| `mint_boxes`       | Authority    | Mint boxes while enforcing max supply and worst-case solvency.                   |
| `request_open`     | Box owner    | In the same transaction as the oracle commit, burn one box and create a receipt. |
| `settle_open`      | Anyone       | Verify the bound reveal, select an outcome, and pay the fixed recipient.         |
| `refund_open`      | Anyone       | After 300 slots without a reveal, remint the box to the fixed recipient.         |
| `close_opening`    | Anyone       | Close a terminal receipt and return rent to its fixed recipient.                 |
| `withdraw_surplus` | Authority    | Withdraw only lamports above rent plus worst-case live liability.                |

## Recommended transaction sequence

1. Create a zero-decimal SPL mint whose mint authority is the not-yet-created lootbox PDA and which has no freeze authority.
2. `create_lootbox`.
3. Call `add_outcome` once per reward.
4. Deposit at least `max_supply * max_reward_lamports` plus no extra rent—the vault creation handles its own rent reserve.
5. `seal`.
6. `mint_boxes` into recipients' canonical associated token accounts.
7. Create a Switchboard randomness account.
8. Put Switchboard `randomness.commitIx(...)` immediately before `request_open` in one transaction.
9. In a later slot, put Switchboard reveal and `settle_open` in one transaction, or settle an already revealed receipt permissionlessly.
10. `close_opening` after settlement or refund.

## Rust SDK

```rust
use lootbox_sdk::LootboxPlan;

let plan = LootboxPlan::new(250)?
	.with_outcome(62, 5_000_000)?
	.with_outcome(28, 15_000_000)?
	.with_outcome(10, 50_000_000)?;

assert_eq!(plan.total_weight()?, 100);
assert_eq!(plan.required_collateral_lamports()?, 12_500_000_000);
# Ok::<(), lootbox_sdk::PlanError>(())
```

The crate is `no_std` and re-exports the Codama client as `lootbox_sdk::generated`.

## TypeScript SDK

```ts
import {
	createLootboxPlan,
	getCreateLootboxInstructionAsync,
} from "@pina-rs/lootbox";

const plan = createLootboxPlan({
	maxSupply: 2n,
	outcomes: [
		{ label: "Common", weight: 90n, rewardLamports: 10_000n },
		{ label: "Rare", weight: 10n, rewardLamports: 500_000n },
	],
});

// Generated instruction builders are re-exported beside the checked plan API.
void getCreateLootboxInstructionAsync;
console.log(plan.outcomes.map((outcome) => outcome.probability));
```

All values may be safe JavaScript integers or `bigint`. The planner rejects negative values, values above `u64`, total-weight overflow, and collateral overflow before encoding.

## Dart SDK

```dart
import 'package:lootbox/lootbox.dart';

final plan = LootboxPlan(
  maxSupply: BigInt.from(2),
  outcomes: [
    LootboxOutcome(
      label: 'Common',
      weight: BigInt.from(90),
      rewardLamports: BigInt.from(10000),
    ),
    LootboxOutcome(
      label: 'Rare',
      weight: BigInt.from(10),
      rewardLamports: BigInt.from(500000),
    ),
  ],
);

print(plan.requiredCollateralLamports);
```

The package re-exports every generated instruction, PDA, account, and error type.

## Deliberate limits

- Reward labels are client metadata; the program stores weights and lamports only.
- Boxes are standard SPL tokens, not Metaplex metadata accounts.
- There is no mutable admin key, pause switch, outcome edit, or emergency reward seizure.
- One opening produces exactly one SOL outcome. Bundles belong in a later adapter layer.
