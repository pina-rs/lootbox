import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

import { EMPTY_CHESTS } from "../src/launch/emptyChests.ts";

declare global {
	interface Window {
		rive: typeof import("@rive-app/canvas");
	}
}

/**
 * Render one 1024² ivory poster per Empty Chest from the compiled Rive file.
 *
 * Each poster is the idle loop's peek pose: the lid is cracked and the thing
 * is out. It uses the same browser runtime as the website and play.html, with
 * every input served from memory, so no dev server or network is needed.
 */
const output = new URL("../public/nft/empty-chest/", import.meta.url);
const SIZE = 1024;
const IVORY = "#f3edda";
/** Seconds into the idle loop where every thing is fully out of the chest. */
const PEEK_SECONDS = 1.9;
const resources: Record<string, { contentType: string; body: string | Buffer }> = {
	"/": {
		contentType: "text/html",
		body:
			`<canvas width="${SIZE}" height="${SIZE}"></canvas><script src="/rive.js"></script>`,
	},
	"/rive.js": {
		contentType: "text/javascript",
		body: readFileSync(new URL(import.meta.resolve("@rive-app/canvas"))),
	},
	"/rive.wasm": {
		contentType: "application/wasm",
		body: readFileSync(
			new URL(import.meta.resolve("@rive-app/canvas/rive.wasm")),
		),
	},
	"/chest.riv": {
		contentType: "application/octet-stream",
		body: readFileSync(new URL("empty-chest.riv", output)),
	},
};
const browser = await chromium.launch();

try {
	const page = await browser.newPage();

	await page.route("**/*", (route) => {
		const resource = resources[new URL(route.request().url()).pathname];
		return resource ? route.fulfill(resource) : route.abort();
	});
	await page.goto("http://rive-render.invalid/");

	for (const chest of EMPTY_CHESTS) {
		const png = await page.evaluate(
			({ variant, seconds, ivory }) =>
				new Promise<string>((resolve, reject) => {
					const canvas = document.querySelector("canvas");
					if (!canvas) throw new Error("Missing export canvas");
					const timeout = setTimeout(
						() => reject(new Error("Rive poster export timed out")),
						15_000,
					);
					const animations = ["Chest idle", `Thing ${variant} idle`];
					const { Rive, RuntimeLoader } = window.rive;
					RuntimeLoader.setWasmUrl("/rive.wasm");
					RuntimeLoader.setWasmFallbackUrl(null);
					const player = new Rive({
						canvas,
						src: "/chest.riv",
						artboard: "Empty chest",
						animations,
						autoplay: false,
						onLoadError: (event) => {
							clearTimeout(timeout);
							reject(new Error(`Rive export failed: ${String(event.data)}`));
						},
						onLoad: () => {
							player.scrub(animations, seconds);
							requestAnimationFrame(() =>
								requestAnimationFrame(() => {
									clearTimeout(timeout);
									const poster = document.createElement("canvas");
									poster.width = canvas.width;
									poster.height = canvas.height;
									const context = poster.getContext("2d");
									if (!context) throw new Error("Missing 2D context");
									context.fillStyle = ivory;
									context.fillRect(0, 0, poster.width, poster.height);
									context.drawImage(canvas, 0, 0);
									player.cleanup();
									resolve(poster.toDataURL("image/png"));
								})
							);
						},
					});
				}),
			{ variant: chest.variant, seconds: PEEK_SECONDS, ivory: IVORY },
		);
		const prefix = "data:image/png;base64,";

		if (!png.startsWith(prefix)) {
			throw new Error(`Invalid PNG export for variant ${chest.variant}`);
		}

		writeFileSync(
			new URL(`${chest.variant}.png`, output),
			Buffer.from(png.slice(prefix.length), "base64"),
		);
		console.log(`Rendered poster ${chest.variant}.png (${chest.thing})`);
	}
} finally {
	await browser.close();
}
