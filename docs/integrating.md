# Integrating Lootbox

Lootbox is intended to be a protocol primitive, not a required front end. An integrator can use the zero-decimal box token as a transferable claim, sponsor opening transactions, and optionally consume an immutable result in its own program.

## Choose an integration mode

| Mode                 | Best for                                                  | Result handling                              | Cost                                                      |
| -------------------- | --------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Wallet flow          | Collectibles, community drops, simple games               | Read the normal opening account off chain    | Opener pays the opening unless sponsored                  |
| Sponsored flow       | Consumer apps that hide transaction complexity            | Relayer pays request, settlement, and claims | Sponsor pays fees; creator may configure a bounded bounty |
| Program-bound result | Games, quests, loyalty, tournaments, composable protocols | Verify an immutable `ResultReceipt` PDA      | Creator prepays result rent for every box at lock         |

Leave result receipts disabled unless another program needs durable on-chain verification. Disabled treasuries create no result PDA and reserve no receipt rent.

## CPI-safe request bindings

`requestTemplateOpen` separates four roles:

- `payer` signs and funds the opening and oracle accounts. Opening rent returns only to this address.
- `boxAuthority` signs the burn of one whole, zero-decimal box token.
- `beneficiary` is the only destination accepted by prize claims.
- `consumerProgram` plus `consumerContext` bind a result to an integrating program and one application-defined action.

Use a deterministic context such as a hash of your program's quest, player, season, and nonce. Do not put secrets in it; account data is public. A nonzero context requires a non-default consumer program.

```ts
const context = new Uint8Array(
	await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(`quest:${quest}:${player}:${nonce}`),
	),
);

await lootbox.requestOpen(template, oracle, {
	beneficiary: player,
	consumerProgram: MY_PROGRAM,
	consumerContext: context,
});
```

The TypeScript client also provides `settle`, which verifies the oracle proof and allocates the predicted bundle in one atomic transaction. `claim` batches all supported assets in the selected bundle into one delivery transaction.

## Verifying immutable results

The generated Rust package exports `cpi::verify_result_receipt`. A consumer must verify all application-relevant bindings, not only the selected bundle:

```rust,ignore
let result = lootbox_program_client::cpi::verify_result_receipt(
	result_receipt,
	lootbox_program_client::cpi::ResultExpectation {
		template: expected_template,
		beneficiary: player,
		consumer_program: program_id,
		consumer_context: expected_context,
		manifest_hash: Some(expected_manifest_hash),
	},
)?;
```

The helper checks the account owner, account discriminator/layout, canonical PDA derived from the opening, treasury, beneficiary, consumer binding, and optional locked manifest hash. Copy out the verified values before releasing the account-data borrow.

The Lootbox result is immutable, but it cannot stop your program from applying it twice. Before granting anything, derive a consumer-owned marker from the opening or context, require it to be empty, and initialize it atomically with your state transition. Never use only `selectedBundle` as authorization.

## Integration checklist

1. Pin the exact program ID and generated interface commit.
2. Decide whether results need to be durable on chain before the treasury is created; the receipt setting cannot change later.
3. Read `manifestHash` after market lock and store or display it in the product.
4. Require `lockedAt > 0`, revoked mint authority, zero decimals, and exact supply before presenting boxes as a fungible market series.
5. Simulate transactions, choose confirmed/finalized reads as appropriate, and retry by reading chain state rather than blindly resubmitting.
6. Run a monitored settlement service. A bounty can decentralize cranking but is not a substitute for outage operations.
7. Build explicit states for pending, expired, allocated, partially claimed, and complete openings.
8. Have counsel review randomized-reward, sale, age, geography, and disclosure rules for the intended launch.

This repository is pre-release. Until it has both a compatibility release tag and a supported live deployment, pin a commit rather than assuming interface stability.
