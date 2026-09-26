/**
 * Renders review contact sheets for the Exclusive Lootbox NFT art.
 *
 * Usage: node scripts/contact-sheet.ts [out-dir]   (default: output/contact-sheet)
 *
 * Writes `layers-<id>.png` (every trait of one layer on a fixed base),
 * `random-grid.png` (24 weighted random chests), `rarest.png` (the rarest
 * vector and its near neighbours), and `sizes.txt`. The renderer stays DOM-
 * and Node-free; only this review script uses resvg.
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { randomFrom, seedFrom } from "../src/random.ts";

import {
	LAYERS,
	rarestTraits,
	rarityOf,
	renderAnimatedExclusiveNft,
	renderExclusiveNft,
	type TraitVector,
} from "../src/index.ts";

type Tile = Readonly<{ traits: TraitVector; serial: number }>;

const out = resolve(process.argv[2] ?? "output/contact-sheet");
/** Ivory, Painted Pine, Plain Planks, Shield Latch, no decoration, A Lost Button, no effect. */
const BASE: TraitVector = [0, 0, 0, 0, 0, 7, 0];

function png(svg: string, width: number): Buffer {
	return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render()
		.asPng();
}

/** A grid of rendered posters embedded as images, so tile ids never collide. */
function sheet(tiles: readonly Tile[], columns: number, tile: number): string {
	const rows = Math.ceil(tiles.length / columns);
	const gap = 12;
	const width = columns * (tile + gap) + gap;
	const height = rows * (tile + gap) + gap;
	const images = tiles.map(({ traits, serial }, i) => {
		const x = gap + (i % columns) * (tile + gap);
		const y = gap + Math.floor(i / columns) * (tile + gap);
		const data = Buffer.from(renderExclusiveNft(traits, serial)).toString(
			"base64",
		);

		return `<image x="${x}" y="${y}" width="${tile}" height="${tile}" href="data:image/svg+xml;base64,${data}"/>`;
	});

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#1c2426"/>${
		images.join("")
	}</svg>`;
}

function save(name: string, svg: string, width: number) {
	const path = join(out, name);

	writeFileSync(path, png(svg, width));
	console.log(`wrote ${path}`);
}

/** Draw a vector the way the program does: each layer by its weights. */
function roll(random: () => number): TraitVector {
	return LAYERS.map((layer) => {
		let ticket = random() * layer.total;

		for (const trait of layer.traits) {
			ticket -= trait.weight;

			if (ticket < 0) {
				return trait.index;
			}
		}

		return layer.traits.length - 1;
	});
}

mkdirSync(out, { recursive: true });

for (const layer of LAYERS) {
	const tiles = layer.traits.map((trait): Tile => ({
		traits: BASE.map((value, i) => (i === layer.index ? trait.index : value)),
		serial: 7,
	}));

	save(`layers-${layer.id}.png`, sheet(tiles, 5, 320), 1660);
}

const random = randomFrom(seedFrom("contact-sheet"));
const rolled = Array.from(
	{ length: 24 },
	(_, i): Tile => ({ traits: roll(random), serial: 100 + i }),
);

save("random-grid.png", sheet(rolled, 6, 300), 1872);

const rarest = rarestTraits();
const neighbours = LAYERS.slice(0, 5).map((layer): Tile => {
	const byWeight = [...layer.traits].sort((a, b) => a.weight - b.weight);

	return {
		traits: rarest.map((
			value,
			i,
		) => (i === layer.index ? byWeight[1]?.index ?? value : value)),
		serial: 2 + layer.index,
	};
});

save(
	"rarest.png",
	sheet([{ traits: rarest, serial: 1 }, ...neighbours], 3, 540),
	1668,
);

const sizes = [...rolled, { traits: rarest, serial: 1 }].map(
	({ traits, serial }) => {
		const still = renderExclusiveNft(traits, serial).length / 1024;
		const animated = renderAnimatedExclusiveNft(traits, serial).length / 1024;

		return `${traits.join("-")} ${rarityOf(traits).label}: still ${
			still.toFixed(1)
		} KB, animated ${animated.toFixed(1)} KB`;
	},
);

writeFileSync(join(out, "sizes.txt"), `${sizes.join("\n")}\n`);
console.log(sizes.slice(-3).join("\n"));
