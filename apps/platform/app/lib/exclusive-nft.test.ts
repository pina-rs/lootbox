import { describe, expect, it } from "vitest";

import {
	combinationProbability,
	decodeTraits,
	encodeTraits,
	exclusiveNftAdapter,
	exclusiveNftUri,
	INTRODUCTORY_COLLECTION,
	layerOdds,
	parseExclusiveUri,
	rarestCombination,
	rarityLabel,
	sampleCombinations,
} from "./exclusive-nft.js";

const collection = INTRODUCTORY_COLLECTION;

describe("Introductory Exclusive collection", () => {
	it("has at most sixteen traits per layer and odds that sum to one", () => {
		for (const layer of layerOdds(collection)) {
			expect(layer.traits.length).toBeLessThanOrEqual(16);
			expect(layer.traits.reduce((sum, trait) => sum + trait.probability, 0))
				.toBeCloseTo(1, 12);
		}
	});

	it("multiplies layer odds into rarity", () => {
		const common = collection.layers.map(() => 0);
		const expected = layerOdds(collection).reduce(
			(product, layer) => product * (layer.traits[0]?.probability ?? 0),
			1,
		);

		expect(combinationProbability(collection, common)).toBeCloseTo(
			expected,
			15,
		);
		expect(rarestCombination(collection)).toBeLessThan(1e-9);
		expect(rarityLabel(1 / 4_812_337)).toBe("1 in 4,812,337");
		expect(() => combinationProbability(collection, [0])).toThrow(RangeError);
	});

	it("encodes traits as hex digits in the metadata URI", () => {
		const indices = [7, 7, 5, 5, 7, 9, 5];

		expect(encodeTraits(collection, indices)).toBe("7755795");
		expect(decodeTraits(collection, "7755795")).toEqual(indices);
		expect(decodeTraits(collection, "f755795")).toBeNull();
		expect(exclusiveNftUri("https://lootbox.so/x/", collection, indices, 42))
			.toBe("https://lootbox.so/x/7755795-42.json");
		expect(
			parseExclusiveUri(collection, "https://lootbox.so/x/7755795-42.json"),
		)
			.toEqual({ indices, serial: 42 });
	});

	it("samples stable gallery examples", () => {
		expect(sampleCombinations(collection, 4)).toEqual(
			sampleCombinations(collection, 4),
		);
		expect(sampleCombinations(collection, 4, 1)).not.toEqual(
			sampleCombinations(collection, 4, 2),
		);
	});

	it("stays unavailable until the SDK exposes the prize kind", () => {
		expect(exclusiveNftAdapter({}).status).toBe("unavailable");
		expect(
			exclusiveNftAdapter({ createExclusiveNftBundle: () => "bundle" }).status,
		)
			.toBe("available");
	});
});
