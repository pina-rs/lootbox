/**
 * Writes the logo files other tools need: SVG and PDF logos in `assets/logo`,
 * the app icon as SVG and PNGs in `assets/icons`, and the site's favicon and
 * touch icon in `apps/platform/public`. The React components stay the source
 * of truth; `test/brand.test.tsx` fails when these files drift from them.
 *
 * Usage: pnpm --dir packages/brand export
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type BrandFile, brandFiles } from "./files.tsx";
import { printPdfs } from "./pdf.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function write(path: string, contents: string | Buffer): void {
	const target = join(root, path);

	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, contents);
	console.log(`wrote ${path}`);
}

const files = brandFiles();
const pdfs = files.filter((file): file is Extract<BrandFile, { kind: "pdf" }> =>
	file.kind === "pdf"
);

for (const file of files) {
	if (file.kind === "svg") write(file.path, file.svg);

	if (file.kind === "png") {
		write(
			file.path,
			new Resvg(file.svg, { fitTo: { mode: "width", value: file.width } })
				.render()
				.asPng(),
		);
	}
}

// One browser prints every PDF.
const printed = await printPdfs(pdfs);

for (const [index, file] of pdfs.entries()) {
	const pdf = printed[index];

	if (!pdf) throw new Error(`No PDF printed for ${file.path}`);

	write(file.path, pdf);
}
