import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			// Reports stay out of the package directory; `target` is ignored.
			reportsDirectory: "../../target/coverage/sdks-typescript",
			reporter: ["text", "json-summary"],
		},
	},
});
