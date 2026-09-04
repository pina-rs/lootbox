import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
	createTemplatePlan,
	decodeTemplateText,
	encodeTemplateText,
	templateInventory,
} from "./templates.js";

const nft = address("Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op");

describe("finite template plans", () => {
	it("escrows the complete inventory instead of a probabilistic buffer", () => {
		const plan = createTemplatePlan({
			name: "A small miracle",
			bundles: [
				{
					label: "SOL",
					quantity: 99n,
					weight: 1n,
					assets: [{ kind: "sol", lamports: 100_000_000n }],
				},
				{
					label: "Jackpot",
					quantity: 1n,
					weight: 1n,
					assets: [{ kind: "nft", mint: nft }, {
						kind: "sol",
						lamports: 1_000_000_000n,
					}],
				},
			],
		});
		expect(plan.maxSupply).toBe(100n);
		expect(plan.bundles.map((bundle) => bundle.probabilityPercent)).toEqual([
			99,
			1,
		]);
		expect(plan.treasury).toEqual([{ mint: null, amount: 10_900_000_000n }, {
			mint: nft,
			amount: 1n,
		}]);
	});

	it("rejects duplicated NFT inventory and overflow", () => {
		expect(() =>
			createTemplatePlan({
				name: "Invalid",
				bundles: [{
					label: "NFT",
					quantity: 2n,
					weight: 1n,
					assets: [{ kind: "nft", mint: nft }],
				}],
			})
		).toThrow("unique NFT");
		expect(() =>
			createTemplatePlan({
				name: "Invalid",
				bundles: [{
					label: "SOL",
					quantity: 2n,
					weight: 1n,
					assets: [{ kind: "sol", lamports: (1n << 64n) - 1n }],
				}],
			})
		).toThrow("collateral");
	});

	it("bounds metadata by UTF-8 bytes and rejects hidden control text", () => {
		expect(decodeTemplateText(encodeTemplateText("🎁", 32))).toBe("🎁");
		expect(() => encodeTemplateText("🎁".repeat(9), 32)).toThrow("UTF-8");
		expect(() => encodeTemplateText("safe\0evil", 32)).toThrow("control");
	});

	it("shows an exhausted prize at zero percent", () => {
		const weights = new Uint8Array(64);
		const remaining = new Uint8Array(64);
		new DataView(weights.buffer).setBigUint64(0, 1n, true);
		new DataView(weights.buffer).setBigUint64(8, 1n, true);
		new DataView(remaining.buffer).setBigUint64(0, 9n, true);
		expect(
			templateInventory({ weights, remaining, outcomeCount: 2 }).map((
				outcome,
			) => outcome.probabilityPercent),
		).toEqual([100, 0]);
	});
});
