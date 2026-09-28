/**
 * Writes the logo files other tools need: SVG lockups in `assets/logo`, PNG
 * app icons in `assets/icons`, and the site's favicon and touch icon in
 * `apps/platform/public`. The React components stay the source of truth;
 * `test/assets.test.tsx` fails when these files drift from them.
 *
 * Usage: pnpm --dir packages/brand export
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { brandFiles } from "./files.tsx";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const file of brandFiles()) {
	const target = join(root, file.path);

	mkdirSync(dirname(target), { recursive: true });

	if (file.kind === "svg") {
		writeFileSync(target, file.svg);
	} else {
		const png = new Resvg(file.svg, {
			fitTo: { mode: "width", value: file.width },
		}).render().asPng();

		writeFileSync(target, png);
	}

	console.log(`wrote ${file.path}`);
}
