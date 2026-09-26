import { describe, expect, it } from "vitest";

import {
	commonestTraits,
	LAYERS,
	rarestTraits,
	renderAnimatedExclusiveNft,
	renderExclusiveNft,
	type TraitVector,
} from "../src/index.ts";
import { assertWellFormedXml } from "./xml.ts";

const STILL_BUDGET = 60 * 1024;
const ANIMATED_BUDGET = 80 * 1024;
const BASES: readonly TraitVector[] = [commonestTraits(), rarestTraits(), [
	5,
	12,
	5,
	8,
	10,
	13,
	12,
]];

/** Fixed vectors whose art is frozen: minted NFTs render on demand. */
const GOLDEN: readonly (readonly [TraitVector, number])[] = [
	[[0, 0, 0, 0, 0, 5, 0], 1],
	[[5, 9, 2, 1, 4, 0, 3], 42],
	[[12, 12, 6, 7, 11, 13, 9], 1024],
	[rarestTraits(), 65_535],
];

const bytes = (text: string) => new TextEncoder().encode(text).length;

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);

	return [...new Uint8Array(digest)].map((byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

describe("renderExclusiveNft", () => {
	// Every trait of every layer, on three different bases, still and animated.
	for (const layer of LAYERS) {
		it(`renders every ${layer.id} trait as well-formed SVG under budget`, () => {
			for (const base of BASES) {
				for (const trait of layer.traits) {
					const traits = base.map((
						value,
						i,
					) => (i === layer.index ? trait.index : value));
					const still = renderExclusiveNft(traits, 4_294_967_295);
					const animated = renderAnimatedExclusiveNft(traits, 4_294_967_295);

					expect(assertWellFormedXml(still).root).toBe("svg");
					expect(assertWellFormedXml(animated).root).toBe("svg");
					expect(bytes(still)).toBeLessThan(STILL_BUDGET);
					expect(bytes(animated)).toBeLessThan(ANIMATED_BUDGET);
				}
			}
		});
	}

	it("declares a 1024² standalone SVG with an accessible title", () => {
		const svg = renderExclusiveNft([0, 9, 0, 0, 0, 3, 0], 51);

		expect(svg).toMatch(
			/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">/,
		);
		expect(svg).toContain(
			"<title>Solid Gold Chest No. 0051: A Cobweb, Tenant Included</title>",
		);
		expect(svg).not.toContain("<style>");
	});

	it("animates with CSS keyframes and honours reduced motion", () => {
		const svg = renderAnimatedExclusiveNft([0, 0, 0, 8, 11, 0, 3], 1);

		expect(svg).toContain("@keyframes k-moth-flap{");
		expect(svg).toContain("@keyframes k-butterfly-flight{");
		expect(svg).toContain(
			"@media (prefers-reduced-motion:reduce){.m{animation:none!important}}",
		);
		expect(svg).toMatch(/class="m a\d+"/);
	});

	it("is deterministic", () => {
		for (const [traits, serial] of GOLDEN) {
			expect(renderExclusiveNft(traits, serial)).toBe(
				renderExclusiveNft(traits, serial),
			);
			expect(renderAnimatedExclusiveNft(traits, serial)).toBe(
				renderAnimatedExclusiveNft(traits, serial),
			);
		}
	});

	it("varies glint scatter by serial only", () => {
		const glints = [0, 0, 0, 0, 0, 5, 2];

		const scatter = (svg: string) =>
			svg.match(/<g transform="translate\([\d. ]+\)rotate\([-\d.]+\)">/g);

		expect(scatter(renderExclusiveNft(glints, 1))).not.toEqual(
			scatter(renderExclusiveNft(glints, 2)),
		);
	});

	it("rejects invalid vectors and serials with a RangeError", () => {
		for (
			const [traits, serial] of [
				[[0, 0, 0, 0, 0, 0], 1],
				[[15, 0, 0, 0, 0, 0, 0], 1],
				[[0, 0, 0, 0, 0, 0, 14], 1],
				[[0, 0, 0, 0, 0, 0, 0], -1],
				[[0, 0, 0, 0, 0, 0, 0], Number.MAX_SAFE_INTEGER + 1],
			] as const
		) {
			expect(() => renderExclusiveNft(traits, serial)).toThrow(RangeError);
		}
	});

	// Update only for a deliberate, pre-release art change.
	it("keeps the published art frozen", async () => {
		const hashes = await Promise.all(GOLDEN.flatMap(([traits, serial]) => [
			sha256(renderExclusiveNft(traits, serial)),
			sha256(renderAnimatedExclusiveNft(traits, serial)),
		]));

		expect(hashes).toMatchSnapshot();
	});
});
