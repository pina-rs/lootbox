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

export function normalizeRustManifest(source) {
	let manifest = source
		.replace(/version = "[^"]+"/, "version.workspace = true")
		.replace(/edition = "[^"]+"/, "edition.workspace = true")
		.replace("publish = false\n", "");
	if (!manifest.includes('description = "Generated interface')) {
		manifest = manifest.replace(
			"[dependencies]",
			'description = "Generated interface and CPI helpers for the Pina Lootbox program"\nlicense.workspace = true\nhomepage.workspace = true\nrepository.workspace = true\n\n[dependencies]',
		);
	}
	return manifest;
}

export function normalizeDartManifest(source, version) {
	let manifest = source
		.replace(/^publish_to: none\n/m, "")
		.replace(/^version: .*$/m, `version: ${version}`)
		.replace(
			/^description: .*$/m,
			"description: Generated Codama client for the Pina lootbox program.",
		);
	if (!/^repository:/m.test(manifest)) {
		manifest = manifest.replace(
			/^(version: .*\n)/m,
			"$1repository: https://github.com/pina-rs/lootbox\n",
		);
	}
	return manifest;
}

function manifestVersion(source, pattern, label) {
	const version = source.match(pattern)?.[1];
	if (!version) throw new Error(`Cannot read ${label} package version`);
	return version;
}

/** Fail generation before one published client can drift from the others. */
export function assertWorkspaceVersions(
	typescriptVersion,
	cargoManifest,
	dartManifest,
) {
	const cargoVersion = manifestVersion(
		cargoManifest,
		/\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
		"Cargo workspace",
	);
	const dartVersion = manifestVersion(
		dartManifest,
		/^version:\s*([^\s#]+)/m,
		"Dart SDK",
	);
	if (cargoVersion !== typescriptVersion || dartVersion !== typescriptVersion) {
		throw new Error(
			`Client versions must match: Cargo ${cargoVersion}, Dart ${dartVersion}, TypeScript ${typescriptVersion}`,
		);
	}
}

function normalizeRustClient(root) {
	const manifestPath = join(root, "Cargo.toml");
	const libraryPath = join(root, "src/lib.rs");
	writeFileSync(
		manifestPath,
		normalizeRustManifest(readFileSync(manifestPath, "utf8")),
	);

	const library = readFileSync(libraryPath, "utf8");
	if (!library.includes("pub mod cpi;")) {
		writeFileSync(libraryPath, `pub mod cpi;\n${library}`);
	}
}

if (
	process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const version = JSON.parse(readFileSync(
		resolve(root, "sdks/typescript/package.json"),
		"utf8",
	)).version;
	const dartSdkManifestPath = resolve(root, "sdks/dart/pubspec.yaml");
	assertWorkspaceVersions(
		version,
		readFileSync(resolve(root, "Cargo.toml"), "utf8"),
		readFileSync(dartSdkManifestPath, "utf8"),
	);
	normalizeDirectory(
		resolve(root, "programs/lootbox_program/clients/dart/lib"),
	);
	const dartManifestPath = resolve(
		root,
		"programs/lootbox_program/clients/dart/pubspec.yaml",
	);
	writeFileSync(
		dartManifestPath,
		normalizeDartManifest(readFileSync(dartManifestPath, "utf8"), version),
	);
	normalizeRustClient(
		resolve(root, "programs/lootbox_program/clients/rust/lootbox_program"),
	);
	// Keep generated and ergonomic clients on the same Kit major as the token
	// instruction builders. Codama's default package versions currently lag it.
	const manifestPath = resolve(
		root,
		"programs/lootbox_program/clients/typescript/lootbox_program/package.json",
	);
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	manifest.version = version;
	delete manifest.private;
	manifest.description =
		"Generated TypeScript interface for the Pina Lootbox program";
	manifest.license = "Apache-2.0";
	manifest.repository = {
		type: "git",
		url: "git+https://github.com/pina-rs/lootbox.git",
	};
	manifest.publishConfig = { access: "public" };
	manifest.files = ["src"];
	manifest.dependencies["@solana/program-client-core"] = "^7.0.0";
	manifest.peerDependencies["@solana/kit"] = "^7.0.0";
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
