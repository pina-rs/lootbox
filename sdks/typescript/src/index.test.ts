import { describe, expect, it } from "vitest";

import {
	createLootboxPlan,
	decodeOutcomeTable,
	decodeSwitchboardReveal,
	LootboxPlanError,
	SWITCHBOARD_REVEAL_DISCRIMINATOR,
} from "./index.js";

describe("createLootboxPlan", () => {
	it("normalizes weights and calculates worst-case collateral", () => {
		const plan = createLootboxPlan({
			maxSupply: 100,
			outcomes: [
				{ label: "Spark", weight: 70, rewardLamports: 10_000 },
				{ label: "Nova", weight: 30, rewardLamports: 50_000 },
			],
		});

		expect(plan.totalWeight).toBe(100n);
		expect(plan.minimumRewardLamports).toBe(10_000n);
		expect(plan.requiredCollateralLamports).toBe(5_000_000n);
		expect(plan.outcomes.map((outcome) => outcome.probability)).toEqual([
			70,
			30,
		]);
	});

	it("rejects invalid unsigned inputs", () => {
		expect(() =>
			createLootboxPlan({
				maxSupply: 1,
				outcomes: [{ label: "Impossible", weight: 0, rewardLamports: 1 }],
			})
		).toThrowError("outcome 0 must have a positive weight");

		try {
			createLootboxPlan({
				maxSupply: 1,
				outcomes: [{ label: "Impossible", weight: 0, rewardLamports: 1 }],
			});
		} catch (error: unknown) {
			expect(error).toBeInstanceOf(LootboxPlanError);
			expect((error as LootboxPlanError).code).toBe("ZERO_WEIGHT");
		}

		expect(() =>
			createLootboxPlan({
				maxSupply: -1n,
				outcomes: [{ label: "Impossible", weight: 1n, rewardLamports: 1n }],
			})
		).toThrowError("maxSupply must be greater than zero");
		expect(() =>
			createLootboxPlan({
				maxSupply: 1n,
				outcomes: [{ label: "Impossible", weight: -1n, rewardLamports: 1n }],
			})
		).toThrowError("outcome 0 must have a positive weight");
	});

	it("rejects values that cannot be encoded on-chain", () => {
		expect(() =>
			createLootboxPlan({
				maxSupply: 1n << 64n,
				outcomes: [{ label: "Too large", weight: 1n, rewardLamports: 1n }],
			})
		).toThrowError("maxSupply exceeds the u64 maximum");

		expect(() =>
			createLootboxPlan({
				maxSupply: 2n,
				outcomes: [
					{ label: "Overflow", weight: 1n, rewardLamports: (1n << 64n) - 1n },
				],
			})
		).toThrowError("worst-case collateral exceeds the u64 maximum");
	});

	it("rejects total weights above the settlement-safe bound", () => {
		expect(() =>
			createLootboxPlan({
				maxSupply: 1,
				outcomes: [
					{ label: "Bound", weight: 0xffff_ffffn, rewardLamports: 1 },
					{ label: "Overflow", weight: 1, rewardLamports: 1 },
				],
			})
		).toThrowError("the sum of outcome weights must not exceed 4294967295");
	});
});

describe("decodeOutcomeTable", () => {
	it("decodes the account's little-endian reward slots", () => {
		const weights = new Uint8Array(64);
		const rewards = new Uint8Array(64);
		new DataView(weights.buffer).setBigUint64(0, 75n, true);
		new DataView(rewards.buffer).setBigUint64(0, 1_000_000n, true);

		expect(decodeOutcomeTable(weights, rewards, 1)).toEqual([
			{ rewardLamports: 1_000_000n, weight: 75n },
		]);
	});
});

describe("decodeSwitchboardReveal", () => {
	it("extracts the signed fields for settleOpen", () => {
		const data = new Uint8Array(105);
		data.set(SWITCHBOARD_REVEAL_DISCRIMINATOR);
		data.fill(9, 8, 72);
		data[72] = 1;
		data.fill(4, 73);

		expect(decodeSwitchboardReveal(data)).toEqual({
			recoveryId: 1,
			signature: new Uint8Array(64).fill(9),
			value: new Uint8Array(32).fill(4),
		});
	});

	it("rejects unrelated instruction data", () => {
		expect(() => decodeSwitchboardReveal(new Uint8Array(105))).toThrowError(
			"instruction is not a Switchboard randomness reveal",
		);
	});
});
