import { describe, expect, it } from "vitest";

import {
	metadataFor,
	rarityOf,
	renderExclusiveNft,
	renderPlan,
} from "../src/index.ts";

const OPTIONS = {
	base: "https://nft.example/",
	externalUrl: "https://example.com/",
};

describe("render rules", () => {
	it("hides the crown trim under tall contents", () => {
		expect(renderPlan([0, 0, 0, 0, 9, 0, 0]).hidden.has("decoration")).toBe(
			true,
		);
		expect(renderPlan([0, 0, 0, 0, 9, 7, 0]).hidden.has("decoration")).toBe(
			false,
		);
		expect(renderExclusiveNft([0, 0, 0, 0, 9, 0, 0], 1)).not.toContain(
			'#F5C54E" stroke="#243D40" stroke-width="3"/><path d="M-133.5',
		);
	});

	it("drops the keyhole eye below the googly eyes", () => {
		expect(renderPlan([0, 0, 0, 8, 11, 0, 0]).offsets.lock).toEqual({
			x: 0,
			y: 14,
		});
		expect(renderPlan([0, 0, 0, 8, 0, 0, 0]).offsets.lock).toBeUndefined();
	});

	it("never changes odds or metadata", () => {
		const hidden = [0, 0, 0, 0, 9, 0, 0];

		expect(rarityOf(hidden).oneIn).toBeGreaterThan(0n);
		expect(metadataFor(hidden, 1, OPTIONS).attributes).toContainEqual({
			trait_type: "Decoration",
			value: "Crown Trim",
		});
	});
});
