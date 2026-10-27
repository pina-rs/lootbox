import { describe, expect, it } from "vitest";
import { RELAYER_RUN_LIMITS, relayerBudget } from "./relayer-budget.js";

describe("hosted relayer transaction budgets", () => {
	it("bounds a large backlog across lootboxes and charges failed attempts", () => {
		const budget = relayerBudget(() => 100, new AbortController().signal);
		let attempts = 0;

		while (!budget.shouldStop()) {
			const local = budget.forLootbox();

			for (
				let index = 0;
				index < RELAYER_RUN_LIMITS.transactionsPerLootbox;
				index++
			) {
				local.reserve();
				attempts += 1;
				// No success notification: a failed transaction still spends its slot.
			}

			expect(local.shouldStop()).toBe(true);
			expect(() => local.reserve()).toThrow("budget exhausted");
		}

		expect(attempts).toBe(RELAYER_RUN_LIMITS.transactions);
		expect(() => budget.forLootbox().reserve()).toThrow("budget exhausted");
	});

	it("rejects new attempts at the run deadline", () => {
		let now = 100;
		const budget = relayerBudget(() => now, new AbortController().signal);
		const local = budget.forLootbox();

		local.reserve();
		now += RELAYER_RUN_LIMITS.durationSeconds;

		expect(budget.shouldStop()).toBe(true);
		expect(() => local.reserve()).toThrow("budget exhausted");
	});

	it("stops immediately when a pending run is aborted", () => {
		const controller = new AbortController();
		const budget = relayerBudget(() => 100, controller.signal);
		const local = budget.forLootbox();

		controller.abort();

		expect(local.shouldStop()).toBe(true);
		expect(() => local.reserve()).toThrow("budget exhausted");
	});
});
