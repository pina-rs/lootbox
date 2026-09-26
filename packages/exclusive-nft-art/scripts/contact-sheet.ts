/**
 * Renders review contact sheets for the Exclusive Lootbox NFT art.
 *
 * Usage: node scripts/contact-sheet.ts [out-dir]   (default: output/contact-sheet)
 *
 * Writes one 1024² PNG per tier, a 4×4 tier sheet, a contents sheet (every
 * contents item), a backgrounds × patterns sheet, and the SVG sizes. The
 * renderer itself stays DOM- and Node-free; only this review script uses resvg.
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
	BACKGROUNDS,
	CONTENTS,
	type ExclusiveNftTraits,
	PATTERNS,
	renderExclusiveNft,
	TIERS,
} from "../src/index.ts";

const out = resolve(process.argv[2] ?? "output/contact-sheet");

function png(svg: string, width: number): Buffer {
	return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render()
		.asPng();
}

/** A grid of rendered SVGs embedded as images, so tile ids never collide. */
function sheet(
	items: readonly ExclusiveNftTraits[],
	columns: number,
	tile: number,
): string {
	const rows = Math.ceil(items.length / columns);
	const gap = 12;
	const width = columns * (tile + gap) + gap;
	const height = rows * (tile + gap) + gap;
	const images = items.map((traits, i) => {
		const x = gap + (i % columns) * (tile + gap);
		const y = gap + Math.floor(i / columns) * (tile + gap);
		const data = Buffer.from(renderExclusiveNft(traits)).toString("base64");

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

mkdirSync(out, { recursive: true });

const tierSamples = TIERS.map((tier): ExclusiveNftTraits => ({
	tier: tier.index,
	contents: (tier.index * 7) % CONTENTS.length,
	background: tier.index % BACKGROUNDS.length,
	pattern: tier.index % PATTERNS.length,
	serial: 42 + tier.index,
}));
const sizes: string[] = [];

for (const traits of tierSamples) {
	const svg = renderExclusiveNft(traits);
	const name = `tier-${String(traits.tier).padStart(2, "0")}`;

	writeFileSync(join(out, `${name}.svg`), svg);
	sizes.push(`${name}.svg ${(svg.length / 1024).toFixed(1)} KB`);
	save(`${name}.png`, svg, 1024);
}

save("tiers-sheet.png", sheet(tierSamples, 4, 400), 1660);
save(
	"contents-sheet.png",
	sheet(
		CONTENTS.map((contents) => ({
			tier: 0,
			contents: contents.index,
			background: 0,
			pattern: 0,
			serial: 7,
		})),
		5,
		320,
	),
	1660,
);
save(
	"backgrounds-patterns-sheet.png",
	sheet(
		BACKGROUNDS.map((background) => ({
			tier: (background.index * 5) % TIERS.length,
			contents: (background.index * 3) % CONTENTS.length,
			background: background.index,
			pattern: background.index % PATTERNS.length,
			serial: 1000 + background.index,
		})),
		4,
		400,
	),
	1660,
);
writeFileSync(join(out, "sizes.txt"), `${sizes.join("\n")}\n`);
console.log(sizes.join("\n"));
