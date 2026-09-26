import { describe, expect, it } from "vitest";

import {
	BACKGROUNDS,
	CONTENTS,
	type ExclusiveNftTraits,
	PATTERNS,
	renderExclusiveNft,
	TIERS,
} from "../src/index.ts";
import { assertWellFormedXml } from "./xml.ts";

const SIZE_BUDGET = 60 * 1024;

function sample(tier: number): ExclusiveNftTraits {
	return {
		tier,
		contents: (tier * 7) % CONTENTS.length,
		background: tier % BACKGROUNDS.length,
		pattern: tier % PATTERNS.length,
		serial: 42 + tier,
	};
}

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
	// Every tier × contents × background × pattern: 30,720 posters. Split by
	// tier so a failure names its tier and no single test runs too long.
	for (const tier of TIERS) {
		it(
			`renders every combination for tier ${tier.index} (${tier.name}) as well-formed SVG under budget`,
			() => {
				let largest = 0;

				for (const contents of CONTENTS) {
					for (const background of BACKGROUNDS) {
						for (const pattern of PATTERNS) {
							const traits = {
								tier: tier.index,
								contents: contents.index,
								background: background.index,
								pattern: pattern.index,
								serial: 4_294_967_295,
							};
							const svg = renderExclusiveNft(traits);
							const { root } = assertWellFormedXml(svg);

							expect(root).toBe("svg");
							largest = Math.max(largest, new TextEncoder().encode(svg).length);
						}
					}
				}

				expect(largest).toBeLessThan(SIZE_BUDGET);
			},
			60_000,
		);
	}

	it("declares a 1024² standalone SVG with an accessible title", () => {
		const svg = renderExclusiveNft(sample(9));

		expect(svg).toMatch(
			/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">/,
		);
		expect(svg).toContain(
			"<title>Solid Gold Chest No. 0051: A Cobweb, Tenant Included</title>",
		);
	});

	it("is deterministic for identical traits", () => {
		for (const tier of TIERS) {
			expect(renderExclusiveNft(sample(tier.index))).toBe(
				renderExclusiveNft(sample(tier.index)),
			);
		}
	});

	it("varies sparkles by serial but keeps the chest", () => {
		const first = renderExclusiveNft({ ...sample(12), serial: 1 });
		const second = renderExclusiveNft({ ...sample(12), serial: 2 });

		expect(first).not.toBe(second);
		expect(renderExclusiveNft({ ...sample(0), serial: 1 }).length)
			.toBeGreaterThan(0);
	});

	it("escalates visibly with tier", () => {
		const base = { contents: 5, background: 0, pattern: 0, serial: 1 };
		const plain = renderExclusiveNft({ ...base, tier: 0 });
		const gold = renderExclusiveNft({ ...base, tier: 9 });
		const cosmic = renderExclusiveNft({ ...base, tier: 15 });

		// Tier 0 has no effects, so its glow color never appears.
		expect(plain).not.toContain("#FFF1C2");
		expect(gold).toContain("#FFE27A");
		expect(cosmic).toContain("#FFB870");
		expect(cosmic.length).toBeGreaterThan(plain.length);
	});

	it("rejects out-of-range traits with a RangeError", () => {
		const good = sample(3);

		for (
			const bad of [
				{ ...good, tier: 16 },
				{ ...good, contents: CONTENTS.length },
				{ ...good, background: -1 },
				{ ...good, pattern: 0.5 },
				{ ...good, serial: -1 },
				{ ...good, serial: Number.MAX_SAFE_INTEGER + 1 },
			]
		) {
			expect(() => renderExclusiveNft(bad)).toThrow(RangeError);
		}
	});

	// Minted NFTs point at art rendered on demand, so the pixels behind a URI
	// must not drift. Update these hashes only for a deliberate, pre-release
	// art change.
	it("keeps the published art frozen", async () => {
		const hashes = await Promise.all(
			TIERS.map((tier) => sha256(renderExclusiveNft(sample(tier.index)))),
		);

		expect(hashes).toMatchSnapshot();
	});
});
