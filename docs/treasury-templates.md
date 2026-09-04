# Treasury-backed templates (v2)

Status: protocol and SDK foundation implemented on `feat/treasury-templates`, verified locally against Surfpool. UI/RPC orchestration and deployment remain incomplete. This is not a claim that the deployed v1 already supports v2.

## What a box represents

A template is a reusable minter, an immutable prize manifest, and a shared logical treasury. One transferable, zero-decimal Token-2022 token represents one unopened claim against that treasury. Tokens from the same template are interchangeable; they are **not individually unique NFTs**. Prize bundles may contain unique NFTs. The template records its name, metadata URI, and earliest opening timestamp.

The first v2 mode is a finite, fully escrowed prize pool, drawn without replacement. It does not lend, invest, or probabilistically overcommit the treasury. A statistical buffer cannot make one unique NFT cover two independent winning claims.

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
- [ ] Creator/recipient UI using real RPC transactions; no simulated balance presented as an on-chain reward.
- [ ] Browser integration tests across desktop/mobile and reduced-motion reveal.
- [x] Reproducible local Surfpool control plane with test-only labeling and HTTP smoke tests.
- [ ] Connected browser playground and public deployment path.
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

These are planning helpers plus generated transaction builders, not yet a one-call create/fund/open client. RPC orchestration and the UI remain integration work. Plan validation never replaces on-chain mint/authority/escrow validation.

## Local control plane

After building both SBF artifacts, run `pnpm playground:rpc` inside `devenv shell`. The process holds a fresh offline network until Ctrl-C and exposes:

- `GET /config`: RPC/WebSocket endpoints, program ID, test oracle addresses.
- `POST /faucet` with `{ "address": "..." }`: set a test wallet to 100 fake SOL.
- `GET /proof?randomness=...`: a stable test-only reveal value for that commitment.
- `POST /time-travel` with `{ "timestampSeconds": ... }`: local clock convenience; heed the cross-epoch Surfpool limitation in the security notes.

The HTTP service listens at `127.0.0.1:8898` by default; set `LOOTBOX_PLAYGROUND_PORT` for another loopback port. No payer private key is sent to clients. This process is not designed for public hosting or real oracle proofs.

Run `devenv shell -- test:surfpool` to build the artifacts, execute the real-transaction Rust journeys, and test the HTTP service. Run `devenv shell -- verify:all` for the wider regression suite. Existing web tests cover the legacy simulated UI; they are not evidence of a v2 browser-to-chain flow.
