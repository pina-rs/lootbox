import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

/** End-to-end runs keep their own local D1/R2 state. */
const persistPath = process.env.LOOTBOX_PERSIST_PATH;
const configPath = process.env.LOOTBOX_WRANGLER_CONFIG;
const port = Number(process.env.LOOTBOX_PORT ?? 5174);

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
	],
	resolve: { tsconfigPaths: true },
	server: { port, strictPort: true },
}));
