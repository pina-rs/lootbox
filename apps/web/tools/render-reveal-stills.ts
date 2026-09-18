import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

declare global {
	interface Window {
		rive: typeof import("@rive-app/canvas");
	}
}

const output = new URL("../public/animations/ink-chest/", import.meta.url);
const resources: Record<
	string,
	{ contentType: string; body: string | Buffer }
> = {
	"/": {
		contentType: "text/html",
		body:
			'<canvas width="640" height="640"></canvas><script src="/rive.js"></script>',
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
		body: readFileSync(new URL("ink-chest.riv", output)),
	},
};
const browser = await chromium.launch();

try {
	const page = await browser.newPage();
	// Serve only these in-memory build inputs. No dev server or network is needed.
	await page.route("**/*", (route) => {
		const resource = resources[new URL(route.request().url()).pathname];
		return resource ? route.fulfill(resource) : route.abort();
	});
	await page.goto("http://rive-render.invalid/");

	for (
		const [name, animation] of [
			["closed", "Idle"],
			["big-prize", "Big prize"],
			["small-prize", "Small prize"],
			["disappointed", "Disappointed"],
		] as const
	) {
		const png = await page.evaluate(
			(animation) =>
				new Promise<string>((resolve, reject) => {
					const canvas = document.querySelector("canvas");
					if (!canvas) throw new Error("Missing export canvas");
					const timeout = setTimeout(
						() => reject(new Error("Rive still export timed out")),
						15_000,
					);
					const { Rive, RuntimeLoader } = window.rive;
					RuntimeLoader.setWasmUrl("/rive.wasm");
					RuntimeLoader.setWasmFallbackUrl(null);
					const player = new Rive({
						canvas,
						src: "/chest.riv",
						artboard: "Ink chest",
						animations: animation,
						autoplay: false,
						onLoadError: (event) => {
							clearTimeout(timeout);
							reject(new Error(`Rive export failed: ${String(event.data)}`));
						},
						onLoad: () => {
							player.scrub(animation, animation === "Idle" ? 0 : 5);
							requestAnimationFrame(() =>
								requestAnimationFrame(() => {
									clearTimeout(timeout);
									const png = canvas.toDataURL("image/png");
									player.cleanup();
									resolve(png);
								})
							);
						},
					});
				}),
			animation,
		);
		const prefix = "data:image/png;base64,";
		if (!png.startsWith(prefix)) {
			throw new Error(`Invalid PNG export for ${name}`);
		}
		writeFileSync(
			new URL(`${name}.png`, output),
			Buffer.from(png.slice(prefix.length), "base64"),
		);
		console.log(`Rendered transparent ${name}.png`);
	}
} finally {
	await browser.close();
}
