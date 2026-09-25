import { defineConfig, devices } from "@playwright/test";

/** The GitHub Pages build is served from this sub-path. */
const PAGES_BASE = "/lootbox/";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			testIgnore: /pages\.spec\.ts/,
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "mobile",
			testIgnore: /pages\.spec\.ts/,
			use: { ...devices["Pixel 7"] },
		},
		{
			// A production build under the Pages base path, served statically.
			name: "pages",
			testMatch: /pages\.spec\.ts/,
			use: {
				...devices["Desktop Chrome"],
				baseURL: `http://127.0.0.1:4174${PAGES_BASE}`,
			},
		},
	],
	webServer: [{
		command: "pnpm --dir ../.. playground:rpc",
		url: "http://127.0.0.1:8898/config",
		reuseExistingServer: !process.env.CI,
	}, {
		command: "pnpm exec vite --host 127.0.0.1 --port 4173",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: !process.env.CI,
	}, {
		command:
			"pnpm exec vite build --outDir dist/pages --emptyOutDir && pnpm exec vite preview --outDir dist/pages --host 127.0.0.1 --port 4174 --strictPort",
		url: `http://127.0.0.1:4174${PAGES_BASE}`,
		env: {
			LOOTBOX_WEB_BASE: PAGES_BASE,
			VITE_SOLANA_CLUSTER: "devnet",
			VITE_TREASURY: "",
		},
		reuseExistingServer: false,
	}],
});
