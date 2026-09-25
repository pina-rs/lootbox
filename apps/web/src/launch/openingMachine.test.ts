import { describe, expect, it } from "vitest";

import {
	chargeLevel,
	HOLD_TO_OPEN_MS,
	initialOpening,
	openingAnnouncement,
	type OpeningEvent,
	openingReducer,
	type OpeningState,
	reactionFor,
	type RecordedResult,
} from "./openingMachine.js";

const result: RecordedResult = {
	opening: "Opening1111111111111111111111111111111111111",
	bundleIndex: 1,
	tier: "headline",
	signature: "sig",
};

function run(...events: OpeningEvent[]): OpeningState {
	return events.reduce(openingReducer, initialOpening);
}

describe("opening machine", () => {
	it("walks the happy path from hold to claimed", () => {
		const phases = [
			{ type: "hold", at: 0 },
			{ type: "charged" },
			{ type: "committed", opening: result.opening, signature: "burn" },
			{ type: "recorded", result },
			{ type: "revealFinished" },
			{ type: "claim" },
			{ type: "claimed", signature: "claim" },
		] as const satisfies readonly OpeningEvent[];
		const seen: string[] = [];

		phases.reduce<OpeningState>((state, event) => {
			const next = openingReducer(state, event);

			seen.push(next.phase);

			return next;
		}, initialOpening);

		expect(seen).toEqual([
			"charging",
			"burning",
			"rolling",
			"revealing",
			"revealed",
			"claiming",
			"claimed",
		]);
	});

	it("drains an early release back to idle without opening", () => {
		expect(run({ type: "hold", at: 0 }, { type: "release" })).toEqual(
			initialOpening,
		);
	});

	it("ignores a second charge while a box is burning", () => {
		const burning = run({ type: "hold", at: 0 }, { type: "charged" });

		expect(openingReducer(burning, { type: "charged" })).toBe(burning);
		expect(openingReducer(burning, { type: "hold", at: 5 })).toBe(burning);
	});

	it("keeps the opening address on failure so it can resume", () => {
		const failed = run(
			{ type: "charged" },
			{ type: "committed", opening: result.opening, signature: null },
			{ type: "fail", message: "oracle down" },
		);

		expect(failed).toEqual({
			phase: "failed",
			message: "oracle down",
			opening: result.opening,
			result: null,
		});
		expect(
			openingReducer(failed, {
				type: "committed",
				opening: result.opening,
				signature: null,
			}).phase,
		).toBe("rolling");
	});

	it("allows retrying a failed claim with the recorded result", () => {
		const failed = run(
			{ type: "recorded", result },
			{ type: "claim" },
			{ type: "fail", message: "rpc" },
		);

		expect(openingReducer(failed, { type: "claim" })).toEqual({
			phase: "claiming",
			result,
		});
	});

	it("lets the claim start before the reveal clip finishes", () => {
		expect(run({ type: "recorded", result }, { type: "claim" }).phase).toBe(
			"claiming",
		);
	});

	it("clamps the charge level", () => {
		expect(chargeLevel(100, 50)).toBe(0);
		expect(chargeLevel(0, HOLD_TO_OPEN_MS / 2)).toBe(0.5);
		expect(chargeLevel(0, HOLD_TO_OPEN_MS * 3)).toBe(1);
	});

	it("maps tiers to reactions and announces text-first status", () => {
		expect(reactionFor("headline")).toBe("big-prize");
		expect(reactionFor("standard")).toBe("small-prize");
		expect(reactionFor("empty")).toBe("disappointed");
		expect(
			openingAnnouncement(
				run({ type: "recorded", result: { ...result, tier: "empty" } }),
				() => "a badge",
			),
		).toBe(
			"Recorded on-chain: an empty box. You still get a badge. Not yet claimed.",
		);
		expect(
			openingAnnouncement(run({ type: "recorded", result }), () => "1 OPENAI"),
		).toBe("Recorded on-chain: you won 1 OPENAI. Not yet claimed.");
		expect(openingAnnouncement(initialOpening, () => "")).toBe("");
	});
});
