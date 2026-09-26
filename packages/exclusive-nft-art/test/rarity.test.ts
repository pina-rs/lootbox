import { describe, expect, it } from "vitest";

import { vanDerCorput } from "../src/art/effects.ts";
import { sparklePlacements } from "../src/art/effects.ts";
import {
	commonestTraits,
	compactOneIn,
	formatOneIn,
	LAYERS,
	rarestTraits,
	rarityOf,
} from "../src/index.ts";

describe("rarityOf", () => {
	it("multiplies each layer's probability exactly", () => {
		const rarest = rarityOf(rarestTraits());

		// 500 × 1,000 × 50 × 125 × 200 × 200 × 250
		expect(rarest.oneIn).toBe(31_250_000_000_000_000n);
		expect(rarest.label).toBe("1 in 31,250,000,000,000,000");
		expect(rarest.compact).toBe("1 in 31 quadrillion");
		expect(rarest.oneIn).toBeGreaterThan(10n ** 9n);
	});

	it("scores in bits: Σ −log2 p", () => {
		const traits = [0, 0, 0, 0, 0, 0, 0];
		const expected = LAYERS.reduce(
			(sum, layer, i) =>
				sum -
				Math.log2((layer.traits[traits[i] ?? 0]?.weight ?? 0) / layer.total),
			0,
		);

		expect(rarityOf(traits).score).toBeCloseTo(expected, 2);
		expect(rarityOf(rarestTraits()).score).toBeCloseTo(
			Math.log2(31_250_000_000_000_000),
			2,
		);
	});

	it("ranks the commonest vector lowest", () => {
		const commonest = rarityOf(commonestTraits());

		expect(commonestTraits()).toEqual([0, 0, 0, 0, 0, 4, 0]);
		expect(commonest.label).toBe("1 in 16,958");
		expect(commonest.score).toBeLessThan(rarityOf([1, 1, 1, 1, 1, 1, 1]).score);
	});

	it("formats odds for plaques and metadata", () => {
		expect(formatOneIn(1234567n)).toBe("1 in 1,234,567");
		expect(compactOneIn(999_999n)).toBe("1 in 999,999");
		expect(compactOneIn(3_140_000_000n)).toBe("1 in 3.1 billion");
		expect(compactOneIn(2_000_000n)).toBe("1 in 2 million");
	});
});

describe("sparkle placement", () => {
	it("walks the van der Corput sequence", () => {
		expect([0, 1, 2, 3, 4, 5].map(vanDerCorput)).toEqual([
			0,
			.5,
			.25,
			.75,
			.125,
			.625,
		]);
	});

	// Regression: hosts show only the first n sparkles, so every prefix must be
	// spread around the ring rather than bunched on one side.
	it("spreads every prefix evenly around the ring", () => {
		const placements = sparklePlacements(16, "spread");

		for (let n = 2; n <= 16; n++) {
			const angles = placements.slice(0, n)
				.map(({ x, y }) =>
					(Math.atan2((y - 540) / 350, (x - 512) / 385) + Math.PI * 2) %
					(Math.PI * 2)
				)
				.sort((a, b) => a - b);
			const gaps = angles.map((angle, i) =>
				((angles[(i + 1) % n] ?? 0) - angle + Math.PI * 2) % (Math.PI * 2)
			);

			expect(Math.max(...gaps)).toBeLessThan(Math.PI * 2 / n * 2 + .5);
		}
	});
});
