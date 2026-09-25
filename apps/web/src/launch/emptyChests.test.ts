import { describe, expect, it } from "vitest";

import {
	EMPTY_CHEST_COUNT,
	EMPTY_CHESTS,
	emptyChestFor,
	emptyChestLeafName,
	emptyChestName,
	fallbackVariant,
	parseEmptyChestManifest,
} from "./emptyChests.js";

const OPENING = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const ASSET = "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY";
const manifest = {
	cluster: "devnet",
	tree: "Tree111111111111111111111111111111111111111",
	assets: { [ASSET]: { variant: 7, leafIndex: 3 } },
};

describe("Empty Chest catalogue", () => {
	it("has thirteen distinct variants in order", () => {
		expect(EMPTY_CHEST_COUNT).toBe(13);
		expect(EMPTY_CHESTS.map((chest) => chest.variant)).toEqual(
			Array.from({ length: 13 }, (_, index) => index),
		);
		expect(new Set(EMPTY_CHESTS.map((chest) => chest.thing)).size).toBe(13);
	});

	it("names each chest by its one-based number and contents", () => {
		const chest = EMPTY_CHESTS[4];

		if (!chest) throw new Error("missing variant 4");

		expect(emptyChestName(chest)).toBe("Empty Chest #5 — A Dust Bunny");
	});

	it("keeps every leaf name within Bubblegum's 32-byte limit", () => {
		for (const chest of EMPTY_CHESTS) {
			expect(new TextEncoder().encode(emptyChestLeafName(chest)).length)
				.toBeLessThanOrEqual(32);
		}
	});
});

describe("emptyChestFor", () => {
	it("maps a minted asset to its variant", () => {
		expect(emptyChestFor(OPENING, ASSET, manifest).variant).toBe(7);
	});

	it("falls back to the opening address without a manifest or asset", () => {
		const expected = fallbackVariant(OPENING);

		expect(emptyChestFor(OPENING, null, manifest).variant).toBe(expected);
		expect(emptyChestFor(OPENING, ASSET, null).variant).toBe(expected);
		expect(
			emptyChestFor(
				OPENING,
				"Unknown1111111111111111111111111111111111",
				manifest,
			).variant,
		)
			.toBe(expected);
	});
});

describe("fallbackVariant", () => {
	it("is deterministic and in range", () => {
		expect(fallbackVariant(OPENING)).toBe(fallbackVariant(OPENING));
		expect(fallbackVariant(OPENING)).toBeGreaterThanOrEqual(0);
		expect(fallbackVariant(OPENING)).toBeLessThan(13);
	});

	it("reaches every variant across openings", () => {
		const seen = new Set<number>();

		for (let index = 0; index < 500; index++) {
			seen.add(
				fallbackVariant(
					`${OPENING.slice(0, -4)}${index.toString().padStart(4, "0")}`,
				),
			);
		}

		expect(seen.size).toBe(13);
	});
});

describe("parseEmptyChestManifest", () => {
	it("accepts the mint script's shape", () => {
		expect(parseEmptyChestManifest(manifest)).toEqual(manifest);
	});

	it.each([
		null,
		"nope",
		{ cluster: "devnet", tree: "x" },
		{
			cluster: "devnet",
			tree: "x",
			assets: { [ASSET]: { variant: 13, leafIndex: 0 } },
		},
		{
			cluster: "devnet",
			tree: "x",
			assets: { [ASSET]: { variant: 1.5, leafIndex: 0 } },
		},
		{ cluster: "devnet", tree: "x", assets: { [ASSET]: { variant: 2 } } },
	])("rejects malformed manifests (%#)", (value) => {
		expect(parseEmptyChestManifest(value)).toBeNull();
	});
});
