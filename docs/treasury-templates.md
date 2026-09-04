# Treasury-backed templates (v2)

Status: protocol, SDK foundation, and connected creator/recipient playground implemented on `feat/treasury-templates`, tested against local Surfpool. Public hosting and real-network readiness remain incomplete. This is not a mainnet release.

## What a box represents

A template is a reusable minter, an immutable prize manifest, and a shared logical treasury. One transferable, zero-decimal Token-2022 token represents one unopened claim against that treasury. Tokens from the same template are interchangeable; they are **not individually unique NFTs**. Prize bundles may contain unique NFTs. The template records its name, metadata URI, and earliest opening timestamp.

The first v2 mode is a finite, fully escrowed prize pool, drawn without replacement. It does not lend, invest, or probabilistically overcommit the treasury. **Probabilistic undercollateralization remains in scope as a separate reserve policy**, confirmed by the user; it is not implemented by these finite-pool instructions. That mode must model all outstanding obligations, define its shortfall behavior in advance, and retain finite allocation for specific unique NFTs.

Each outcome specifies a positive per-unit weight, a quantity of complete bundles, and one to four assets. A bundle could contain three specific NFTs and SOL. Its current probability is `weight × remaining / sum(weight × remaining)`. For example, 90 small SOL bundles, 9 token bundles, and 1 NFT bundle with equal per-unit weights start at 90%, 9%, and 1%. After the NFT is allocated its probability is zero, including for boxes already in circulation. Published odds are a snapshot, not a promise of the odds when a future box opens.

## Funding and issuance

- Funding a prize escrows its complete quantity before the template can be sealed.
- Asset vaults belong to the template's prize bundles, not to individual boxes. This prevents double-counting the same tokens across different advertised prizes.
- Sealing freezes quantities, weights, assets, amounts, metadata, and claim date.
- Minting is creator-authorized. The recipient owns and can transfer the box using the standard token program, including before its claim date.
- `live token supply + unallocated openings + new boxes <= remaining bundles`.
- Minting also stops as soon as any advertised outcome has no inventory. Previously issued boxes remain redeemable against the remaining inventory.
- Minting never assumes somebody will forget to open their box.

## Opening and delivery

`token → burn + oracle commitment → verified entropy → ordered allocation → claim`

1. The holder requests an opening after the template's timestamp. The transaction burns one token and commits fresh Switchboard randomness atomically, binding it to that holder and a monotonically increasing opening sequence.
2. Anyone may relay the proof. Verified entropy is persisted independently of prize delivery and allocation order.
3. Allocation follows request order. This prevents someone who knows several results from choosing which result gets first access to a scarce NFT. Each allocation consumes exactly one bundle and advances the queue.
4. Each asset can be claimed independently, always to the recorded recipient. A failed transfer can be retried but cannot change the allocated outcome.
5. The reveal animation presents the recorded result; animation timing never draws another result. Reloading must recover the receipt from chain.

## Security boundaries and deliberate exclusions

- Legacy v1 SOL-only accounts/instructions retain their existing ABI and semantics.
- No creator-controlled odds edits after issuance, arbitrary oracle programs, pre-revealed randomness, destination substitution, duplicate claims, or queue skips.
- The initial reward-token policy excludes transfer fees, transfer hooks, permanent delegates, pausing, and freeze authorities. A promise of a fixed amount must not silently become a net-of-fees or issuer-revocable promise.
- NFT classification requires supply one, zero decimals, and revoked mint authority. Compressed NFTs, programmable NFT transfer rules, and arbitrary NFT standards need explicit adapters; they must not be advertised as universally supported.
- There is no timeout reroll or creator-chosen fallback. Across different assets no objective “cheapest prize” exists. An unavailable oracle can delay the queue. A durable oracle/liveness review and real-network soak are release gates, not solved by local emulation. Do not deploy this experimental implementation for real funds.
- Fully funded is an asset-quantity guarantee, not a market-value or profitability guarantee. Token prices and the value of the remaining prize pool can fall.

## Acceptance checklist

- [x] Pina program: configuration, escrow, Token-2022 issuance, time gate, oracle boundary, ordered allocation, bundle delivery, retirement, and receipt cleanup.
- [x] Rust, TypeScript, and Dart generated clients and ergonomic template planners.
- [x] Real Surfpool transaction tests, including destination substitutions, double claims, scarcity, multiple pending openings, failed-transfer retries, token transfers, retirement, and receipt closure. The oracle is emulated, not a live cryptographic oracle.
- [x] Creator/recipient UI using real RPC transactions; no simulated balance presented as an on-chain reward.
- [x] Browser integration tests across desktop/mobile, recovery, time locks, transfers, and reduced-motion support.
- [x] Reproducible local Surfpool control plane with test-only labeling and HTTP smoke tests.
- [x] Connected local browser playground with browser-generated disposable test wallets.
- [ ] Probabilistically undercollateralized reserve policy, risk accounting, and explicit shortfall semantics.
- [ ] Safe public deployment path and production wallet integration.
- [ ] Internal security review, complete verification, PR, and green CI.
- [ ] Independent audit and real-network oracle/liveness review before real-value use.

## Developer API

The low-level generated clients expose the same 15 v2 instructions in Rust, TypeScript, and Dart; legacy discriminators 0–9 are unchanged. The v2 surface is:

| Phase                               | Instructions                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Configure and escrow                | `createTemplate`, `addBundle`, `fundSolPrize`, `fundTokenPrize`, `sealTemplate`           |
| Issue and open                      | `mintTemplateBoxes`, `requestTemplateOpen`, `fulfillTemplateOpen`, `allocateTemplateOpen` |
| Deliver and clean up                | `claimSolPrize`, `claimTokenPrize`, `closeTemplateOpening`                                |
| Retire and recover unused inventory | `retireTemplate`, `reclaimSolPrize`, `reclaimTokenPrize`                                  |

The planning layer totals full deposits before transaction construction:

```ts
import { createTemplatePlan } from "@pina-rs/lootbox";
import { address } from "@solana/kit";

const plan = createTemplatePlan({
	name: "A small miracle",
	opensAt: BigInt(Math.floor(Date.now() / 1000) + 86_400),
	bundles: [
		{
			label: "A little SOL",
			quantity: 99n,
			weight: 1n,
			assets: [{ kind: "sol", lamports: 100_000_000n }],
		},
		{
			label: "The jackpot",
			quantity: 1n,
			weight: 1n,
			assets: [
				{ kind: "nft", mint: address("REPLACE_WITH_YOUR_NFT_MINT") },
				{ kind: "sol", lamports: 1_000_000_000n },
			],
		},
	],
});

// 100 available boxes; initial jackpot odds 1/100.
// Full escrow: 10.9 SOL and one NFT, not 100 copies of the jackpot.
console.log(plan.treasury, plan.bundles[1]?.odds);
```

The address placeholder must be replaced before running the example. The Rust equivalent is `TemplatePlan::new(max_supply, &[PrizeBundle { ... }])`, using `PrizeAsset::Sol`, `PrizeAsset::Token`, and `PrizeAsset::Nft`. Dart exposes `TemplatePlan(bundles: [...])`, `PrizeBundle`, and the `PrizeAsset.sol`, `.token`, and `.nft` constructors. Both expose exact initial odds and collateral totals.

TypeScript additionally exports `LootboxClient`, used by the playground. It orchestrates `createTemplate`, `mint`, `transfer`, `requestOpen`, `fulfill`, `allocate`, and `claim`; `inventory`, `template`, `bundles`, and `boxBalance` read chain state. The constructor accepts an RPC URL, a Kit transaction signer, and an optional progress callback. `createTemplate` requires a stable template id and mint signer; callers must persist their creation intent before submitting transactions. It checks existing metadata, weights, and funded assets before resuming. `claim` checks the receipt's per-asset claim mask. Confirmation timeout does not automatically resend a potentially completed action.

This client currently uses `processed` commitment for the local single-node simulator; production-grade finality and oracle transport remain integration work. Rust and Dart expose generated builders and ergonomic planners, not matching high-level RPC orchestration yet. Plan validation never replaces on-chain mint/authority/escrow validation. See the [playground guide](../apps/web/README.md) for the executable journey.

## Probabilistic backing: retained scope

Full finite inventory is one reserve policy, not a decision to remove undercollateralization. The next policy must explicitly account for every circulating token, committed opening, allocated-but-unpaid asset, and prior reserve allocation. Reserving only expected payouts plus an arbitrary percentage is not a payout guarantee.

Before this policy can mint, its immutable terms must define a risk budget, exposure/mint cap, reserve buffer, assumptions about draw dependence, and what a winner receives when reserves are insufficient. Exact entitlement queued for recapitalization and a fully backed floor with risk-bearing bonuses are different products; neither should be silently substituted for the other. Inventory-conditioned draws must not reuse an independent fixed-odds estimate. Unique NFTs retain finite one-winner allocation.

The UI will distinguish fully funded from probabilistically backed templates before acquisition and show the shortfall terms alongside the prize table. The reserve policy cannot be changed after issuance. No probabilistic policy selector is enabled in this build: the new instructions do not enforce that contract yet.

## Local control plane

After building both SBF artifacts, run `pnpm playground:rpc` inside `devenv shell`. The process holds a fresh offline network until Ctrl-C and exposes:

- `GET /config`: RPC/WebSocket endpoints, program ID, test oracle addresses, and a per-network `instanceId` for isolated browser test-wallet persistence.
- `POST /faucet` with `{ "address": "..." }`: set a test wallet to 100 fake SOL.
- `GET /proof?randomness=...`: a stable test-only reveal value for that commitment.
- `POST /time-travel` with `{ "timestampSeconds": ... }`: local clock convenience; heed the cross-epoch Surfpool limitation in the security notes.

The HTTP service listens at `127.0.0.1:8898` by default; set `LOOTBOX_PLAYGROUND_PORT` for another loopback port. No payer private key is sent to clients. This process is not designed for public hosting or real oracle proofs.

Run `devenv shell -- test:surfpool` to build the artifacts, execute the real-transaction Rust journeys, and test the HTTP service. Run `devenv shell -- verify:all` for the wider regression suite. `test:web` starts a local Surfpool service when one is not already running and tests real browser-to-chain flows. Build both SBF programs first when running web tests separately.
