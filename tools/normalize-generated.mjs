import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Codama's Dart renderer emits Object.hash with >20 arguments for large
 * accounts. Dart caps that API at 20; hashAll preserves the full field list.
 * Kept in the reproducible generation pipeline, never patched by hand.
 */
export function normalizeDartHashes(source) {
	return source.replace(/Object\.hash\(([\w\s,]+)\)/g, (match, fields) => {
		const argumentsList = fields.split(",").map((field) => field.trim()).filter(
			Boolean,
		);
		return argumentsList.length > 20 ? `Object.hashAll([${fields}])` : match;
	});
}

function normalizeDirectory(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			normalizeDirectory(path);
			continue;
		}
		if (!entry.name.endsWith(".dart")) continue;
		const source = readFileSync(path, "utf8");
		const normalized = normalizeDartHashes(source);
		if (normalized !== source) writeFileSync(path, normalized);
	}
}

if (
	process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	normalizeDirectory(
		resolve(
			dirname(fileURLToPath(import.meta.url)),
			"../programs/lootbox_program/clients/dart/lib",
		),
	);
}
