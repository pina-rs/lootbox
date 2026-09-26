import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AURA_CENTER, GOLD_BURST_RAYS } from "../src/art/effects.ts";
import { LAYERS } from "../src/index.ts";

const riv = new URL("../assets/exclusive-nft.riv", import.meta.url);
const scene = readFileSync(
	new URL(
		"../../../assets/lootbox-reveals/rive/exclusive-nft/scene.rml",
		import.meta.url,
	),
	"utf8",
);
const [CX, CY] = AURA_CENTER;

describe("exclusive-nft.riv", () => {
	it("stays under the 250 KB runtime budget", () => {
		expect(statSync(riv).size).toBeLessThan(250 * 1024);
	});

	it("exposes one number per layer and the reveal trigger", () => {
		const names = [
			...scene.matchAll(/<ViewModelPropertyNumber name="([a-z]+)"/g),
		].map((match) => match[1]);

		expect(names).toEqual(LAYERS.map((layer) => layer.id));
		expect(scene).toContain('<ViewModelPropertyTrigger name="reveal"');
	});

	it("draws every trait in its layer, each bound to a visibility converter", () => {
		// The finish recolors one chest instead, through one pose per finish.
		const finish = LAYERS.find((layer) => layer.id === "finish");

		expect(scene.match(/<LinearAnimation name="Finish \d+"/g)).toHaveLength(
			finish?.traits.length ?? -1,
		);

		for (const layer of LAYERS.filter((item) => item.id !== "finish")) {
			for (const trait of layer.traits) {
				const node = new RegExp(
					`<Node name="${layer.id} ${trait.index}(-[a-z]+)?" id="0:\\d+"[^>]*><DataBindContext [^>]*propertyKey="18" converterId="0:\\d+"/>`,
				);

				expect(scene).toMatch(node);
			}
		}
	});

	// Regression: keyed groups that scale or spin must sit at their pivot, or
	// they swing around the canvas origin.
	it("pivots the burst fan and corona on the aura centre", () => {
		expect(scene).toMatch(
			new RegExp(`<Node name="Burst rays" id="0:\\d+" x="${CX}" y="${CY}"`),
		);
		expect(scene).toMatch(
			new RegExp(`<Node name="Corona" x="${CX}" y="${CY}"`),
		);
		expect(scene).not.toMatch(/<Node name="Burst fan" x=/);
	});

	// Regression: the Rive gold burst must match the poster's ray count.
	it("draws the same gold burst as the poster", () => {
		const rays = scene.match(/<Shape name="Rays">(.*?)<Fill>/)?.[1] ?? "";

		expect(rays.match(/<PointsPath/g)).toHaveLength(GOLD_BURST_RAYS);
	});

	it("loops each motion duration on its own ambient layer", () => {
		expect(scene).toMatch(/<StateMachineLayer name="Ambient 0\.5s">/);
		expect(scene).toMatch(/<StateMachineLayer name="Ambient 8s">/);
	});
});
