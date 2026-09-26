import { describe, expect, it } from "vitest";

import {
	article,
	EXCLUSIVE_NFT_SYMBOL,
	exclusiveNftStem,
	exclusiveNftUri,
	metadataFor,
	parseExclusiveNftStem,
	playerHtml,
	rarestTraits,
	traitHex,
} from "../src/index.ts";

const BASE = "https://nft.example/exclusive/";
const OPTIONS = {
	base: BASE,
	externalUrl: "https://pina-rs.github.io/lootbox/",
};

describe("URIs", () => {
	it("encodes one hex byte per layer, bottom to top", () => {
		const traits = [3, 13, 5, 7, 10, 19, 13];

		expect(traitHex(traits)).toBe("030d05070a130d");
		expect(exclusiveNftStem(traits, 42)).toBe("030d05070a130d-42");
		expect(exclusiveNftUri(BASE, traits, 42)).toBe(
			`${BASE}030d05070a130d-42.json`,
		);
		expect(parseExclusiveNftStem("030d05070a130d-42")).toEqual({
			traits,
			serial: 42,
		});
	});

	it("rejects malformed, padded, uppercase, or out-of-range stems", () => {
		for (
			const stem of [
				"",
				"030d05070a130d",
				"030D05070A130D-42",
				"030d05070a130d-042",
				"030d05070a13-42",
				"030d05070a130d00-42",
				"100d05070a130d-1",
				"0000000000140d-1",
				"00000000000000-99999999999999999",
				"030d05070a130d-42.json",
			]
		) {
			expect(parseExclusiveNftStem(stem)).toBeNull();
		}

		expect(parseExclusiveNftStem("00000000000000-0")).toEqual({
			traits: [0, 0, 0, 0, 0, 0, 0],
			serial: 0,
		});
	});
});

describe("metadataFor", () => {
	it("lists every layer, the serial, and the rarity", () => {
		const metadata = metadataFor(rarestTraits(), 7, OPTIONS);
		const stem = exclusiveNftStem(rarestTraits(), 7);

		expect(metadata).toMatchObject({
			name: "Event Horizon Chest #7",
			symbol: EXCLUSIVE_NFT_SYMBOL,
			image: `${BASE}${stem}.svg`,
			animation_url: `${BASE}play.html?nft=${stem}`,
			external_url: OPTIONS.externalUrl,
			properties: { category: "html" },
		});
		expect(metadata.attributes).toEqual([
			{ trait_type: "Background", value: "Inside a Bigger Chest" },
			{ trait_type: "Finish", value: "Event Horizon" },
			{ trait_type: "Pattern", value: "Scrollwork" },
			{ trait_type: "Lock", value: "No Lock" },
			{ trait_type: "Decoration", value: "Googly Eyes" },
			{ trait_type: "Contents", value: "A Golden Ticket Stub (Void)" },
			{ trait_type: "Effect", value: "Singularity" },
			{ trait_type: "Serial", value: 7, display_type: "number" },
			{ trait_type: "Rarity", value: "1 in 31,250,000,000,000,000" },
			{ trait_type: "Rarity score", value: 54.79, display_type: "number" },
		]);
		expect(metadata.properties.files.map((file) => file.uri)).toEqual([
			`${BASE}${stem}.svg`,
			`${BASE}${stem}.animated.svg`,
			`${BASE}play.html?nft=${stem}`,
		]);
	});

	// Regression: "a Event Horizon chest" read wrong.
	it("chooses a or an by the finish name", () => {
		expect(article("Event Horizon")).toBe("an");
		expect(article("Eclipse")).toBe("an");
		expect(article("Solid Gold")).toBe("a");
		expect(metadataFor([0, 15, 0, 0, 0, 16, 0], 1, OPTIONS).description)
			.toContain(
				"A Pet Rock, in an Event Horizon chest.",
			);
		expect(metadataFor([0, 13, 0, 0, 0, 16, 0], 1, OPTIONS).description)
			.toContain("in an Eclipse chest.");
		expect(metadataFor([0, 9, 0, 0, 0, 16, 0], 1, OPTIONS).description)
			.toContain("in a Solid Gold chest.");
	});

	it("keeps the symbol within Metaplex's 10-byte limit", () => {
		expect(new TextEncoder().encode(EXCLUSIVE_NFT_SYMBOL).length)
			.toBeLessThanOrEqual(10);
	});
});

describe("playerHtml", () => {
	it("binds one Rive input per layer, in layer order", () => {
		const html = playerHtml();

		expect(html).toContain(
			'const LAYERS = ["background","finish","pattern","lock","decoration","contents","effect"];',
		);
		expect(html).toContain("const COUNTS = [15,16,8,10,12,20,14];");
		expect(html).toContain('src: "./exclusive-nft.riv"');
		expect(html).toContain('.animated.svg"');
	});
});
