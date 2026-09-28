/**
 * Render compositions to `out/`, bundling once.
 *
 *   pnpm render                         every composition, as MP4
 *   pnpm render sting-wide open-it-tall  just these
 *   pnpm render --stills sting-wide 15,30,90   PNG frames for review
 *
 * Renders use Chrome Headless Shell. Set REMOTION_BROWSER to its path, or
 * install Playwright's (`pnpm --dir apps/platform exec playwright install
 * chromium`) and it is found automatically.
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { automaticJsx } from "../webpack-override.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");

function playwrightShell(): string | null {
	const cache = join(homedir(), "Library/Caches/ms-playwright");

	if (!existsSync(cache)) return null;

	const newest = readdirSync(cache)
		.filter((name) => name.startsWith("chromium_headless_shell-"))
		.sort()
		.at(-1);

	if (!newest) return null;

	const binary = join(
		cache,
		newest,
		"chrome-headless-shell-mac-arm64",
		"chrome-headless-shell",
	);

	return existsSync(binary) ? binary : null;
}

const browserExecutable = process.env.REMOTION_BROWSER ?? playwrightShell();
const args = process.argv.slice(2);
const stills = args[0] === "--stills";
const ids = stills ? args.slice(1, 2) : args;
const frames = stills
	? (args[2] ?? "0").split(",").map((value) => Number(value.trim()))
	: [];

console.log("Bundling…");
const serveUrl = await bundle({
	entryPoint: join(root, "src/index.ts"),
	webpackOverride: automaticJsx,
});
const compositions = await getCompositions(serveUrl, { browserExecutable });
const selected = ids.length === 0
	? compositions
	: compositions.filter((composition) => ids.includes(composition.id));
const missing = ids.filter((id) =>
	!compositions.some((composition) => composition.id === id)
);

if (missing.length > 0) {
	throw new Error(
		`Unknown composition ${missing.join(", ")}. Known: ${
			compositions.map((composition) => composition.id).join(", ")
		}`,
	);
}

mkdirSync(join(out, "stills"), { recursive: true });

for (const composition of selected) {
	if (stills) {
		for (const frame of frames) {
			const output = join(out, "stills", `${composition.id}-${frame}.png`);

			await renderStill({
				composition,
				serveUrl,
				frame,
				output,
				browserExecutable,
			});
			console.log(`still  ${output}`);
		}

		continue;
	}

	if (composition.durationInFrames === 1) {
		const output = join(out, `${composition.id}.png`);

		await renderStill({
			composition,
			serveUrl,
			frame: 0,
			output,
			browserExecutable,
		});
		console.log(`still  ${output}`);
		continue;
	}

	const output = join(out, `${composition.id}.mp4`);
	const started = performance.now();

	await renderMedia({
		composition,
		serveUrl,
		codec: "h264",
		crf: 18,
		audioCodec: "aac",
		audioBitrate: "192k",
		pixelFormat: "yuv420p",
		outputLocation: output,
		browserExecutable,
		concurrency: 6,
	});
	console.log(
		`video  ${output}  (${
			((performance.now() - started) / 1000).toFixed(0)
		} s)`,
	);
}
