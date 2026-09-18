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

/** Some generated version-envelope tests use `N as u8` literal casts, which clippy's
 * `unnecessary_cast` rejects; rewrite them as `N_u8` literals.
 *
 * Older Pina releases also treated version zero as both stale and current.
 * Keep removing those impossible assertions so regeneration remains stable
 * across supported Pina upgrades.
 */
export function normalizeRustVersionEnvelopeTests(source) {
	const withoutCasts = source.replace(
		/envelope\((\d+) as u8\)/g,
		"envelope($1_u8)",
	);
	if (!isInitialVersionContract(withoutCasts)) return withoutCasts;
	return withoutCasts.replace(
		/^\t\tlet error = \w+::try_from_bytes\(&envelope\(0_u8\)\)\.err\(\)\.expect\("a stale envelope must fail"\);\n\t\tassert_eq!\(error, \w+::Stale \{ stored: 0 \}\);\n\t\tassert_eq!\(\w+::Stale \{ stored: 0 \}\.to_string\(\), "[^"]*"\);\n/gm,
		"",
	);
}

/** Older Pina releases emitted a `*_needs_migration` helper whose stale comparison
 * (`version < 0`) rustc rejects as a useless comparison for v0 contracts under
 * `-D warnings`. No envelope can predate the initial version, so the helper
 * is always false there.
 */
export function normalizeRustVersionEnvelopeGuards(source) {
	if (!isInitialVersionContract(source)) return source;
	return source.replace(
		/pub fn (\w+_needs_migration)\(data: &\[u8\]\) -> bool \{[\s\S]*?\n\}/,
		"pub fn $1(_data: &[u8]) -> bool {\n\tfalse\n}",
	);
}

function isInitialVersionContract(source) {
	return /pub const \w+_MIGRATION_VERSION: u\d+ = 0u\d;/.test(source);
}

/** Some generated reserved-Migrate modules leave a trailing comma in
 * TypeScript type argument lists, which tsc rejects (TS1009). Drop commas
 * that directly precede a closing angle bracket line. Kept in the
 * reproducible generation pipeline, never patched by hand.
 */
export function normalizeTypeScriptTypeArguments(source) {
	return source.replace(/,(\n\t*)>/g, "$1>");
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

function normalizeTypeScriptDirectory(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			normalizeTypeScriptDirectory(path);
			continue;
		}
		if (!entry.name.endsWith(".ts")) continue;
		const source = readFileSync(path, "utf8");
		const normalized = normalizeTypeScriptTypeArguments(source);
		if (normalized !== source) writeFileSync(path, normalized);
	}
}

function normalizeRustAccounts(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			normalizeRustAccounts(path);
			continue;
		}
		if (!entry.name.endsWith(".rs")) continue;
		const source = readFileSync(path, "utf8");
		const normalized = normalizeRustVersionEnvelopeGuards(
			normalizeRustVersionEnvelopeTests(source),
		);
		if (normalized !== source) writeFileSync(path, normalized);
	}
}

export function normalizeRustManifest(source) {
	let manifest = source
		.replace(/^name = "[^"]+"$/m, 'name = "lootbox_program_client"')
		.replace(/version = "[^"]+"/, "version.workspace = true")
		.replace(/edition = "[^"]+"/, "edition.workspace = true");
	if (!/^name = "lootbox_program_client"$/m.test(manifest)) {
		manifest = manifest.replace(
			"[package]\n",
			'[package]\nname = "lootbox_program_client"\n',
		);
	}
	if (!/^publish = false$/m.test(manifest)) {
		manifest = manifest.replace("[package]\n", "[package]\npublish = false\n");
	}
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
		.replace(/^name: .*$/m, "name: lootbox_program_client")
		.replace(/^version: .*$/m, `version: ${version}`)
		.replace(
			/^description: .*$/m,
			"description: Generated Codama client for the Pina lootbox program.",
		);
	if (!/^publish_to: none$/m.test(manifest)) {
		manifest = `publish_to: none\n${manifest}`;
	}
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
	let normalizedLibrary = library;
	for (const module of ["cpi", "proof"]) {
		if (!normalizedLibrary.includes(`pub mod ${module};`)) {
			normalizedLibrary = `pub mod ${module};\n${normalizedLibrary}`;
		}
	}
	if (!normalizedLibrary.includes("pub use proof::*;")) {
		normalizedLibrary = `${normalizedLibrary.trimEnd()}\npub use proof::*;\n`;
	}
	if (normalizedLibrary !== library) {
		writeFileSync(libraryPath, normalizedLibrary);
	}
}

function ensureExport(path, statement) {
	const source = readFileSync(path, "utf8");
	if (!source.includes(statement)) {
		writeFileSync(path, `${source.trimEnd()}\n${statement}\n`);
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
		resolve(root, "clients/dart/lib"),
	);
	ensureExport(
		resolve(root, "clients/dart/lib/lootbox_program.dart"),
		"export 'src/proof_accounts.dart';",
	);
	const dartManifestPath = resolve(
		root,
		"clients/dart/pubspec.yaml",
	);
	writeFileSync(
		dartManifestPath,
		normalizeDartManifest(readFileSync(dartManifestPath, "utf8"), version),
	);
	normalizeRustClient(
		resolve(root, "clients/rust/lootbox_program"),
	);
	normalizeRustAccounts(
		resolve(
			root,
			"clients/rust/lootbox_program/src/generated/accounts",
		),
	);
	normalizeTypeScriptDirectory(
		resolve(
			root,
			"clients/typescript/lootbox_program/src/generated",
		),
	);
	ensureExport(
		resolve(root, "clients/typescript/lootbox_program/src/index.ts"),
		'export * from "./proofAccounts.js";',
	);
	// Keep generated and ergonomic clients on the same Kit major as the token
	// instruction builders. Codama's default package versions currently lag it.
	const manifestPath = resolve(
		root,
		"clients/typescript/lootbox_program/package.json",
	);
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	manifest.name = "@pina-rs/lootbox-program-client";
	manifest.version = version;
	manifest.private = true;
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
	const sortedManifest = Object.fromEntries(
		Object.entries(manifest).sort(([left], [right]) =>
			left.localeCompare(right)
		),
	);
	writeFileSync(manifestPath, `${JSON.stringify(sortedManifest, null, 2)}\n`);
}
