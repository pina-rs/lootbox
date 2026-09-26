import { describe, expect, it } from "vitest";

import { BACKGROUND_ART_COUNT } from "../src/art/backgrounds.ts";
import { CONTENTS_ART } from "../src/art/contents.ts";
import { PATTERN_ART_COUNT } from "../src/art/patterns.ts";
import {
	BACKGROUNDS,
	CONTENTS,
	MAX_CONTENTS,
	PATTERNS,
	REVEAL_DRAMA_ORDER,
	TIER_COUNT,
	tierAt,
	TIERS,
	tierWeight,
	TOTAL_TIER_WEIGHT,
	traitAt,
} from "../src/index.ts";

const ARGB = /^[0-9A-F]{8}$/;

describe("tiers", () => {
	it("has sixteen uniquely named tiers in index order", () => {
		expect(TIERS).toHaveLength(TIER_COUNT);
		expect(new Set(TIERS.map((tier) => tier.name)).size).toBe(TIER_COUNT);
		TIERS.forEach((tier, index) => expect(tier.index).toBe(index));
	});

	it("halves the default weight each tier and sums to 2^16 - 1", () => {
		TIERS.forEach((tier, index) => expect(tier.weight).toBe(2 ** (15 - index)));
		expect(TIERS.reduce((sum, tier) => sum + tier.weight, 0)).toBe(
			TOTAL_TIER_WEIGHT,
		);
		expect(TOTAL_TIER_WEIGHT).toBe(65_535);
		expect(tierWeight(15)).toBe(1);
	});

	it("displays odds under the default weights", () => {
		expect(TIERS.map((tier) => tier.odds)).toEqual([
			"1 in 2",
			"1 in 4",
			"1 in 8",
			"1 in 16",
			"1 in 32",
			"1 in 64",
			"1 in 128",
			"1 in 256",
			"1 in 512",
			"1 in 1,024",
			"1 in 2,048",
			"1 in 4,096",
			"1 in 8,192",
			"1 in 16,384",
			"1 in 32,768",
			"1 in 65,535",
		]);
		expect(TIERS.reduce((sum, tier) => sum + tier.probability, 0)).toBeCloseTo(
			1,
			12,
		);
	});

	it("uses AARRGGBB colors for every palette slot", () => {
		for (const tier of TIERS) {
			for (const color of Object.values(tier.palette)) {
				expect(color).toMatch(ARGB);
			}
		}
	});

	it("never gets quieter as tiers get rarer", () => {
		for (let index = 1; index < TIER_COUNT; index++) {
			const before = tierAt(index - 1);
			const after = tierAt(index);

			expect(REVEAL_DRAMA_ORDER.indexOf(after.drama)).toBeGreaterThanOrEqual(
				REVEAL_DRAMA_ORDER.indexOf(before.drama),
			);
			expect(after.effects.sparkles).toBeGreaterThanOrEqual(
				before.effects.sparkles,
			);
			expect(after.effects.halo).toBeGreaterThanOrEqual(before.effects.halo);
			expect(after.effects.cosmos).toBeGreaterThanOrEqual(
				before.effects.cosmos,
			);
			expect(after.intensity).toBeGreaterThan(before.intensity);
		}

		expect(tierAt(0).drama).toBe("dust");
		expect(tierAt(15).drama).toBe("cosmic");
	});

	it("rejects tiers outside 0..15", () => {
		for (const bad of [-1, 16, 1.5, Number.NaN]) {
			expect(() => tierAt(bad)).toThrow(RangeError);
		}
	});
});

describe("trait catalogs", () => {
	it("pairs every catalog entry with art", () => {
		expect(CONTENTS).toHaveLength(20);
		expect(BACKGROUNDS).toHaveLength(12);
		expect(PATTERNS).toHaveLength(8);
		expect(CONTENTS_ART).toHaveLength(CONTENTS.length);
		expect(BACKGROUND_ART_COUNT).toBe(BACKGROUNDS.length);
		expect(PATTERN_ART_COUNT).toBe(PATTERNS.length);
		expect(CONTENTS.length).toBeLessThanOrEqual(MAX_CONTENTS);
	});

	it("keeps names unique and lines non-empty", () => {
		for (const list of [CONTENTS, BACKGROUNDS, PATTERNS]) {
			expect(new Set(list.map((trait) => trait.name)).size).toBe(list.length);
			list.forEach((trait, index) => {
				expect(trait.index).toBe(index);
				expect(trait.line.length).toBeGreaterThan(0);
			});
		}
	});

	it("names the field when an index is out of range", () => {
		expect(() => traitAt(PATTERNS, 8, "pattern")).toThrow(
			/pattern must be an integer in 0\.\.7/,
		);
	});
});
