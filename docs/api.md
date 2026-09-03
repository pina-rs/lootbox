# API

## Minimal on-chain lifecycle

The instruction discriminators are stable single bytes from `0` through `9`. Generated clients should be preferred over assembling account metas manually.

| Instruction        | Who can call | Purpose                                                                       |
| ------------------ | ------------ | ----------------------------------------------------------------------------- |
| `create_lootbox`   | Authority    | Create definition and vault PDAs around a fresh zero-decimal SPL mint.        |
| `add_outcome`      | Authority    | Append one positive weight and SOL reward; maximum eight.                     |
| `deposit`          | Any signer   | Add SOL to the vault.                                                         |
| `seal`             | Authority    | Permanently freeze the outcome table.                                         |
| `mint_boxes`       | Authority    | Mint boxes while enforcing max supply and worst-case solvency.                |
| `request_open`     | Box owner    | Create and commit fresh oracle state under a receipt PDA, then burn one box.  |
| `settle_open`      | Any relayer  | Reveal by PDA-authorized CPI, select an outcome, and pay the fixed recipient. |
| `refund_open`      | Recipient    | After 300 slots, claim the minimum configured reward.                         |
| `close_opening`    | Anyone       | Close terminal oracle/receipt accounts and return recoverable rent.           |
| `withdraw_surplus` | Authority    | Withdraw only lamports above rent plus worst-case live liability.             |

## Recommended transaction sequence

1. Create a zero-decimal SPL mint whose mint authority is the not-yet-created lootbox PDA and which has no freeze authority.
2. `create_lootbox`.
3. Call `add_outcome` once per reward.
4. Deposit at least `max_supply * max_reward_lamports` plus no extra rent—the vault creation handles its own rent reserve.
5. `seal`.
6. `mint_boxes` into recipients' canonical associated token accounts.
7. Generate a fresh randomness keypair and use Switchboard's `Randomness.create(...)` result only as a template for the initialization accounts and recent slot.
8. Send `request_open`, signed by the owner and randomness keypair. It creates the receipt, initializes and commits randomness with the receipt PDA as authority, then burns atomically.
9. In a later slot, fetch the gateway proof with Switchboard `randomness.revealIx(...)`, decode its instruction data with the ergonomic SDK helper, and send `settle_open`. The relayer pays fees; the stored owner receives the payout.
10. If no relayer settles within 300 slots, the recipient can sign `refund_open` to claim the minimum configured reward. This ends the draw without creating a selective retry option or letting an outsider force a lower result.
11. `close_opening` after settlement or refund to close both the Switchboard randomness account and receipt.

## Switchboard bridge

Do not send the instructions returned by Switchboard's `Randomness.create` or `revealIx` directly. They name the randomness authority as a signer, while Lootbox intentionally assigns that authority to the opening PDA. Use their data and non-authority accounts to construct the generated Lootbox instructions; Lootbox performs the CPI and signs for the PDA.

The handwritten SDKs expose `decode_switchboard_reveal` in Rust and `decodeSwitchboardReveal` in TypeScript/Dart. Each validates the current 105-byte Switchboard `randomness_reveal` layout and returns the `signature`, recovery ID, and value accepted by `settle_open`.

The opening APIs intentionally expose Switchboard's infrastructure accounts instead of wrapping the entire external SDK. That keeps the distributed clients compatible with `@solana/kit`, Rust, and Dart while leaving oracle discovery and gateway transport to Switchboard's maintained client. See [randomness integration](randomness.md) for the account flow and trust boundary.

## Rust SDK

```rust
use lootbox_sdk::LootboxPlan;

let plan = LootboxPlan::new(250)?
	.with_outcome(62, 5_000_000)?
	.with_outcome(28, 15_000_000)?
	.with_outcome(10, 50_000_000)?;

assert_eq!(plan.total_weight()?, 100);
assert_eq!(plan.minimum_reward_lamports()?, 5_000_000);
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
console.log(plan.minimumRewardLamports); // timeout floor
```

All values may be safe JavaScript integers or `bigint`. The planner rejects negative values, values above `u64`, total weights above `u32::MAX`, and collateral overflow before encoding.

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
print(plan.minimumRewardLamports); // timeout floor
```

The package re-exports every generated instruction, PDA, account, and error type.

## Deliberate limits

- Reward labels are client metadata; the program stores weights and lamports only.
- Boxes are standard SPL tokens, not Metaplex metadata accounts.
- There is no mutable admin key, pause switch, outcome edit, or emergency reward seizure.
- One opening produces exactly one SOL outcome. Bundles belong in a later adapter layer.
