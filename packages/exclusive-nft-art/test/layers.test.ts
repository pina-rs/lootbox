import { describe, expect, it } from "vitest";

import { BACKGROUND_ART_COUNT } from "../src/art/backgrounds.ts";
import { CONTENTS_ART } from "../src/art/contents.ts";
import { DECORATION_ART_COUNT } from "../src/art/decorations.ts";
import { EFFECT_ART_COUNT } from "../src/art/effects.ts";
import { LOCK_ART_COUNT } from "../src/art/locks.ts";
import { PATTERN_ART_COUNT } from "../src/art/patterns.ts";
import {
	FINISHES,
	LAYER,
	LAYER_COUNT,
	LAYERS,
	MAX_LAYERS,
	MAX_TRAITS_PER_LAYER,
	parseVersionedTraits,
	resolveTraits,
	TRAIT_VECTOR_VERSION,
	traitCode,
	versionedTraits,
} from "../src/index.ts";

describe("layer tables", () => {
	it("stays within the program's limits", () => {
		expect(LAYER_COUNT).toBeLessThanOrEqual(MAX_LAYERS);

		for (const layer of LAYERS) {
			expect(layer.traits.length).toBeGreaterThan(1);
			expect(layer.traits.length).toBeLessThanOrEqual(MAX_TRAITS_PER_LAYER);
		}
	});

	it("uses positive u32 weights and unique names", () => {
		for (const layer of LAYERS) {
			expect(new Set(layer.traits.map((trait) => trait.name)).size).toBe(
				layer.traits.length,
			);
			expect(layer.total).toBe(
				layer.traits.reduce((sum, trait) => sum + trait.weight, 0),
			);

			layer.traits.forEach((trait, index) => {
				expect(trait.index).toBe(index);
				expect(
					Number.isInteger(trait.weight) && trait.weight > 0 &&
						trait.weight < 2 ** 32,
				).toBe(true);
				expect(trait.description.length).toBeGreaterThan(0);
			});
		}
	});

	it("draws bottom to top in the published order", () => {
		expect(LAYERS.map((layer) => layer.id)).toEqual([
			"background",
			"finish",
			"pattern",
			"lock",
			"decoration",
			"contents",
			"effect",
		]);
		LAYERS.forEach((layer, index) => expect(LAYER[layer.id]).toBe(index));
	});

	it("pairs every trait with art", () => {
		const art = [
			BACKGROUND_ART_COUNT,
			FINISHES.length,
			PATTERN_ART_COUNT,
			LOCK_ART_COUNT,
			DECORATION_ART_COUNT,
			CONTENTS_ART.length,
			EFFECT_ART_COUNT,
		];

		expect(LAYERS.map((layer) => layer.traits.length)).toEqual(art);
	});

	// The program stores these tables verbatim and minted vectors point into
	// them, so indices are append-only. Append traits at the end and update
	// this snapshot; never reorder, rename, or remove.
	it("keeps the published tables append-only", () => {
		expect(LAYERS.map((layer) => ({
			id: layer.id,
			traits: layer.traits.map((trait) =>
				`${trait.index} ${trait.name} ${trait.weight}`
			),
		}))).toMatchSnapshot();
	});
});

describe("trait vectors", () => {
	it("round-trips the versioned form and short code", () => {
		const traits = [3, 9, 2, 1, 4, 5, 8];
		const encoded = JSON.parse(JSON.stringify(versionedTraits(traits)));

		expect(encoded).toEqual({ version: TRAIT_VECTOR_VERSION, traits });
		expect(parseVersionedTraits(encoded)).toEqual(traits);
		expect(traitCode(traits)).toBe("3-9-2-1-4-5-8");
	});

	it("rejects other versions, lengths, and ranges", () => {
		expect(parseVersionedTraits({ version: 2, traits: [0, 0, 0, 0, 0, 0, 0] }))
			.toBeNull();
		expect(parseVersionedTraits({ version: 1, traits: [0, 0, 0] })).toBeNull();
		expect(parseVersionedTraits({ version: 1, traits: [0, 16, 0, 0, 0, 0, 0] }))
			.toBeNull();
		expect(
			parseVersionedTraits({ version: 1, traits: [0, 0.5, 0, 0, 0, 0, 0] }),
		).toBeNull();
		expect(parseVersionedTraits("nope")).toBeNull();
		expect(() => resolveTraits([0, 0, 0, 0, 0, 20, 0])).toThrow(
			/contents must be an integer in 0\.\.19/,
		);
	});
});
