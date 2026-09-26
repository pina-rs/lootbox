import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BACKGROUNDS, CONTENTS, PATTERNS, TIERS } from "../src/index.ts";

const riv = new URL("../assets/exclusive-nft.riv", import.meta.url);
const scene = readFileSync(
	new URL(
		"../../../assets/lootbox-reveals/rive/exclusive-nft/scene.rml",
		import.meta.url,
	),
	"utf8",
);

describe("exclusive-nft.riv", () => {
	it("stays under the 250 KB runtime budget", () => {
		expect(statSync(riv).size).toBeLessThan(250 * 1024);
	});

	it("exposes the view-model contract hosts bind to", () => {
		for (const name of ["tier", "contents", "background", "pattern"]) {
			expect(scene).toContain(`<ViewModelPropertyNumber name="${name}"`);
		}

		expect(scene).toContain('<ViewModelPropertyTrigger name="reveal"');
	});

	it("has one pose per tier and trait value", () => {
		const count = (prefix: string) =>
			scene.match(new RegExp(`<LinearAnimation name="${prefix} \\d+"`, "g"))
				?.length ?? 0;

		expect(count("Tier")).toBe(TIERS.length);
		expect(count("Background")).toBe(BACKGROUNDS.length);
		expect(count("Pattern")).toBe(PATTERNS.length);
		expect(count("Contents")).toBe(CONTENTS.length);
	});
});
