import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	define: {
		"process.env.NODE_ENV": JSON.stringify(
			mode === "production" ? "production" : "development",
		),
	},
	plugins: [react()],
	test: {
		environment: "jsdom",
		exclude: ["e2e/**", "node_modules/**"],
		setupFiles: "./src/test/setup.ts",
	},
}));
