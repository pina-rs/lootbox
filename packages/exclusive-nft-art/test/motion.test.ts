import { describe, expect, it } from "vitest";

import { motion, phasedKeys, sample } from "../src/art/motion.ts";

describe("motion", () => {
	it("rejects loops that do not close or fit the shared loop", () => {
		expect(() => motion("open", 2, { y: [[0, 0], [1, 5]] })).toThrow(
			/must end where it starts/,
		);
		expect(() => motion("short", 2, { y: [[0, 0], [.5, 5]] })).toThrow(
			/must span/,
		);
		expect(() => motion("odd", 3, { y: [[0, 0], [1, 0]] })).toThrow(
			/does not divide/,
		);
	});

	it("keeps the curve when phase-shifted", () => {
		const keys = [[0, 0], [.25, 10], [.75, -10], [1, 0]] as const;
		const shifted = phasedKeys(keys, .25);

		expect(shifted[0]).toEqual([0, 10]);
		expect(shifted.at(-1)).toEqual([1, 10]);

		for (const t of [0, .1, .3, .6, .9]) {
			expect(sample(shifted, t)).toBeCloseTo(sample(keys, (t + .25) % 1), 5);
		}
	});
});
