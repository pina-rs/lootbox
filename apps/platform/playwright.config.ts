import { defineConfig, devices } from "@playwright/test";

const PORT = 5175;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	timeout: 240_000,
	expect: { timeout: 20_000 },
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
	webServer: [
		{
			command: "pnpm --dir ../.. playground:rpc",
			url: "http://127.0.0.1:8898/config",
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
		{
			command: [
				"node e2e/prepare.ts",
				"./node_modules/.bin/wrangler d1 migrations apply lootbox --local --config e2e/wrangler.e2e.jsonc --persist-to .wrangler/e2e",
				// A production build served by Miniflare: no dev-only dependency
				// re-optimisation, and the same Worker bundle `wrangler deploy` ships.
				"./node_modules/.bin/react-router build",
				"./node_modules/.bin/vite preview --host 127.0.0.1 --port 5175 --strictPort",
			].join(" && "),
			url: `http://127.0.0.1:${PORT}`,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				LOOTBOX_PORT: String(PORT),
				LOOTBOX_PERSIST_PATH: ".wrangler/e2e",
				LOOTBOX_WRANGLER_CONFIG: "e2e/wrangler.e2e.jsonc",
			},
		},
	],
});
