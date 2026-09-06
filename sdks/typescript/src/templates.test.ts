import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
	createTemplatePlan,
	decodeTemplateText,
	encodeTemplateText,
	remainingTemplateBundleCapacity,
	requiredServiceBudget,
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

	it("rejects mutable collection transfer policies", () => {
		expect(() =>
			createTemplatePlan({
				name: "Mutable programmable NFT",
				bundles: [{
					label: "NFT",
					quantity: 1n,
					assets: [{ kind: "nft", mint: nft, tokenRecord: nft }],
				}],
			})
		).toThrow("programmable NFT");
		expect(() =>
			createTemplatePlan({
				name: "Mutable Core",
				bundles: [{
					label: "Core",
					quantity: 1n,
					assets: [{ kind: "core", asset: nft, collection: nft }],
				}],
			})
		).toThrow("uncollected Core");
	});

	it("bounds metadata by UTF-8 bytes and rejects hidden control text", () => {
		expect(decodeTemplateText(encodeTemplateText("🎁", 32))).toBe("🎁");
		expect(() => encodeTemplateText("🎁".repeat(9), 32)).toThrow("UTF-8");
		expect(() => encodeTemplateText("safe\0evil", 32)).toThrow("control");
	});

	it("shows an exhausted prize at zero percent", () => {
		const remaining = [9n, 0n];
		expect(
			templateInventory({ remaining, bundleCount: 2 }).map((
				outcome,
			) => outcome.probabilityPercent),
		).toEqual([100, 0]);
	});

	it("supports all 1,024 append slots and snapshots an earlier prefix", () => {
		const bundles = Array.from({ length: 1_024 }, (_, index) => ({
			label: `Bundle ${index}`,
			quantity: 1n,
			assets: [{ kind: "sol" as const, lamports: 1n }],
		}));
		const plan = createTemplatePlan({ name: "Large manifest", bundles });
		expect(plan.totalBundles).toBe(1_024n);
		const remaining = Array<bigint>(1_024).fill(1n);
		expect(templateInventory({ remaining, bundleCount: 1_024 }, 9))
			.toHaveLength(
				9,
			);
		expect(templateInventory({ remaining, bundleCount: 1_024 })).toHaveLength(
			1_024,
		);
	});

	it("rejects an append before any partial bundle can exceed the slot cap", () => {
		expect(remainingTemplateBundleCapacity(0)).toBe(1_024);
		expect(remainingTemplateBundleCapacity(1_023)).toBe(1);
		expect(remainingTemplateBundleCapacity(1_024)).toBe(0);
		expect(() => remainingTemplateBundleCapacity(-1)).toThrow("bundle count");
		expect(() => remainingTemplateBundleCapacity(1_025)).toThrow(
			"bundle count",
		);
	});

	it("funds optional services exactly at lock", () => {
		const plan = createTemplatePlan({
			name: "Services",
			settlementBountyLamports: 50_000n,
			resultReceiptsEnabled: true,
			bundles: [{
				label: "SOL",
				quantity: 3n,
				assets: [{ kind: "sol", lamports: 1n }],
			}],
		});
		expect(requiredServiceBudget(plan, 2_000_000n, 890_880n)).toBe(
			7_040_880n,
		);
		expect(
			requiredServiceBudget(
				{ ...plan, resultReceiptsEnabled: false },
				2_000_000n,
				890_880n,
			),
		).toBe(1_040_880n);
		expect(
			requiredServiceBudget(
				{
					...plan,
					resultReceiptsEnabled: false,
					settlementBountyLamports: 0n,
				},
				2_000_000n,
				890_880n,
			),
		).toBe(0n);
	});
});
