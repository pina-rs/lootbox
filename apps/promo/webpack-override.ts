/**
 * Compile JSX with React's automatic runtime.
 *
 * Remotion's esbuild loader reads `jsx` from tsconfig.json through
 * `typescript.sys`, which TypeScript 7 no longer exposes, so esbuild falls
 * back to the classic `React.createElement` transform. That only works while
 * Remotion happens to put a global `React` in place, and fails for JSX that
 * runs at module load. Setting the option on the loader removes the guess.
 */
import type { WebpackOverrideFn } from "@remotion/bundler";

type LoaderEntry = { loader?: unknown; options?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function patch(entry: unknown): void {
	if (Array.isArray(entry)) {
		entry.forEach(patch);
		return;
	}

	if (!isRecord(entry)) return;

	const candidate = entry as LoaderEntry;

	if (
		typeof candidate.loader === "string" &&
		candidate.loader.includes("esbuild-loader") &&
		isRecord(candidate.options)
	) {
		candidate.options.jsx = "automatic";
	}

	for (const key of ["use", "oneOf", "rules"]) {
		if (key in entry) patch(entry[key]);
	}
}

export const automaticJsx: WebpackOverrideFn = (config) => {
	patch(config.module?.rules);

	return config;
};
