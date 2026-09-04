import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
	createTemplatePlan,
	decodeTemplateText,
	encodeTemplateText,
	remainingTemplateBundleCapacity,
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
					assets: [{ kind: "sol", lamports: 100_000_000n }],
				},
				{
					label: "Jackpot",
					quantity: 1n,
					assets: [{ kind: "nft", mint: nft }, {
						kind: "sol",
						lamports: 1_000_000_000n,
					}],
				},
			],
		});
		expect(plan.totalBundles).toBe(100n);
		expect(plan.fixedSupply).toBe(plan.totalBundles);
		expect(plan.bundles.map((bundle) => bundle.probabilityPercent)).toEqual([
			99,
			1,
		]);
		expect(plan.treasury).toEqual([{
			asset: null,
			amount: 10_900_000_000n,
			kind: "sol",
		}, {
			asset: nft,
			amount: 1n,
			kind: "nft",
		}]);
	});

	it("rejects duplicated NFT inventory and overflow", () => {
		expect(() =>
			createTemplatePlan({
				name: "Invalid",
				bundles: [{
					label: "NFT",
					quantity: 2n,
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
		const remaining = new Uint8Array(2048);
		new DataView(remaining.buffer).setBigUint64(0, 9n, true);
		expect(
			templateInventory({ remaining, bundleCount: 2 }).map((
				outcome,
			) => outcome.probabilityPercent),
		).toEqual([100, 0]);
	});

	it("supports all 256 append slots and snapshots an earlier prefix", () => {
		const bundles = Array.from({ length: 256 }, (_, index) => ({
			label: `Bundle ${index}`,
			quantity: 1n,
			assets: [{ kind: "sol" as const, lamports: 1n }],
		}));
		const plan = createTemplatePlan({ name: "Large manifest", bundles });
		expect(plan.totalBundles).toBe(256n);
		const remaining = new Uint8Array(2048);
		const view = new DataView(remaining.buffer);
		for (let index = 0; index < 256; index++) {
			view.setBigUint64(index * 8, 1n, true);
		}
		expect(templateInventory({ remaining, bundleCount: 256 }, 9)).toHaveLength(
			9,
		);
		expect(templateInventory({ remaining, bundleCount: 256 })).toHaveLength(
			256,
		);
	});

	it("rejects an append before any partial bundle can exceed the slot cap", () => {
		expect(remainingTemplateBundleCapacity(0)).toBe(256);
		expect(remainingTemplateBundleCapacity(255)).toBe(1);
		expect(remainingTemplateBundleCapacity(256)).toBe(0);
		expect(() => remainingTemplateBundleCapacity(-1)).toThrow("bundle count");
		expect(() => remainingTemplateBundleCapacity(257)).toThrow("bundle count");
	});
});
