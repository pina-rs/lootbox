import { describe, expect, it } from "vitest";
import { revealOutcome } from "./reveal.js";

describe("wish-based reveal", () => {
	it.each([
		["bundle-a", "", "small-prize"],
		["bundle-a", "bundle-a", "big-prize"],
		["bundle-a", "bundle-b", "disappointed"],
	])("presents %s with wish %s as %s", (recorded, wish, outcome) => {
		expect(revealOutcome(recorded, wish)).toBe(outcome);
	});
});
