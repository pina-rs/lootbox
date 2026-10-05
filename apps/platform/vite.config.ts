import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

/** End-to-end runs keep their own local D1/R2 state. */
const persistPath = process.env.LOOTBOX_PERSIST_PATH;
const configPath = process.env.LOOTBOX_WRANGLER_CONFIG;
const port = Number(process.env.LOOTBOX_PORT ?? 5174);

/**
 * Serve the Exclusive Lootbox NFT Rive reveal from the art package at
 * `/exclusive-nft.riv`: from the source file in dev, as a static asset in
 * builds. `/x/<collection>/exclusive-nft.riv` redirects here.
 */
function exclusiveRive(): Plugin {
	const source = fileURLToPath(
		new URL(
			"../../packages/exclusive-nft-art/assets/exclusive-nft.riv",
			import.meta.url,
		),
	);

	return {
		name: "lootbox:exclusive-rive",
		configureServer(server) {
			server.middlewares.use("/exclusive-nft.riv", (_request, response) => {
				response.setHeader("Content-Type", "application/octet-stream");
				response.end(readFileSync(source));
			});
		},
		applyToEnvironment: (environment) => environment.name === "client",
		generateBundle() {
			this.emitFile({
				type: "asset",
				fileName: "exclusive-nft.riv",
				source: readFileSync(source),
			});
		},
	};
}

export default defineConfig(({ mode }) => ({
	// Some Solana packages read `process.env.NODE_ENV`, which browsers lack.
	define: {
		"process.env.NODE_ENV": JSON.stringify(
			mode === "production" ? "production" : "development",
		),
	},
	plugins: [
		cloudflare({
			viteEnvironment: { name: "ssr" },
			...(persistPath ? { persistState: { path: persistPath } } : {}),
			...(configPath ? { configPath } : {}),
		}),
		reactRouter(),
		exclusiveRive(),
	],
	resolve: { tsconfigPaths: true },
	server: { port, strictPort: true },
}));
