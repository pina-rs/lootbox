import { describe, expect, it } from "vitest";

import {
	EXCLUSIVE_NFT_SYMBOL,
	exclusiveNftStem,
	exclusiveNftUri,
	metadataFor,
	parseExclusiveNftStem,
} from "../src/index.ts";

const BASE = "https://nft.example/exclusive/";
const OPTIONS = {
	base: BASE,
	externalUrl: "https://pina-rs.github.io/lootbox/",
};

describe("URIs", () => {
	it("follows the on-chain URI contract", () => {
		const traits = {
			tier: 3,
			contents: 13,
			background: 5,
			pattern: 7,
			serial: 42,
		};

		expect(exclusiveNftStem(traits)).toBe("3-13-5-7-42");
		expect(exclusiveNftUri(BASE, traits)).toBe(`${BASE}3-13-5-7-42.json`);
		expect(parseExclusiveNftStem("3-13-5-7-42")).toEqual(traits);
	});

	it("rejects malformed, padded, or out-of-range stems", () => {
		for (
			const stem of [
				"",
				"3-13-5-7",
				"3-13-5-7-42.json",
				"03-13-5-7-42",
				"3-13-5-7-042",
				"16-0-0-0-1",
				"0-20-0-0-1",
				"0-0-12-0-1",
				"0-0-0-8-1",
				"-1-0-0-0-1",
				"0-0-0-0-99999999999999999",
			]
		) {
			expect(parseExclusiveNftStem(stem)).toBeNull();
		}

		expect(parseExclusiveNftStem("0-0-0-0-0")).toEqual({
			tier: 0,
			contents: 0,
			background: 0,
			pattern: 0,
			serial: 0,
		});
	});
});

describe("metadataFor", () => {
	it("builds Metaplex JSON with every trait", () => {
		const metadata = metadataFor({
			tier: 15,
			contents: 16,
			background: 11,
			pattern: 5,
			serial: 7,
		}, OPTIONS);

		expect(metadata).toMatchObject({
			name: "Event Horizon Chest #7",
			symbol: EXCLUSIVE_NFT_SYMBOL,
			image: `${BASE}15-16-11-5-7.svg`,
			animation_url: `${BASE}play.html?nft=15-16-11-5-7`,
			external_url: OPTIONS.externalUrl,
			properties: { category: "html" },
		});
		expect(metadata.attributes).toEqual([
			{ trait_type: "Tier", value: "Event Horizon" },
			{ trait_type: "Finish", value: "A chest so dense light won't leave it" },
			{ trait_type: "Contents", value: "A Pet Rock" },
			{ trait_type: "Background", value: "Velvet Curtain" },
			{ trait_type: "Pattern", value: "Scrollwork" },
			{ trait_type: "Serial", value: 7, display_type: "number" },
			{ trait_type: "Odds", value: "1 in 65,535" },
		]);
		expect(metadata.description).toContain(
			"A Pet Rock, in a Event Horizon chest.",
		);
	});

	it("keeps the symbol within Metaplex's 10-byte limit", () => {
		expect(new TextEncoder().encode(EXCLUSIVE_NFT_SYMBOL).length)
			.toBeLessThanOrEqual(10);
	});

	it("throws for out-of-range traits", () => {
		expect(() =>
			metadataFor({
				tier: 0,
				contents: 99,
				background: 0,
				pattern: 0,
				serial: 1,
			}, OPTIONS)
		).toThrow(RangeError);
	});
});
