import assert from "node:assert/strict";
import test from "node:test";
import {
	assertWorkspaceVersions,
	normalizeDartHashes,
	normalizeDartManifest,
	normalizeRustManifest,
	normalizeRustVersionEnvelopeGuards,
	normalizeRustVersionEnvelopeTests,
	normalizeTypeScriptTypeArguments,
} from "./normalize-generated.mjs";

test("requires every handwritten client to use the workspace version", () => {
	const cargo = '[workspace.package]\nversion = "0.0.1-alpha.0"\n';
	const dart = "name: lootbox\nversion: 0.0.1-alpha.0\n";
	assert.doesNotThrow(() =>
		assertWorkspaceVersions("0.0.1-alpha.0", cargo, dart)
	);
	assert.throws(
		() => assertWorkspaceVersions("0.0.2-alpha.0", cargo, dart),
		/Client versions must match/,
	);
});

test("normalizes oversized generated hash calls reproducibly", () => {
	const fields = Array.from({ length: 22 }, (_, index) => `field${index}`).join(
		",\n",
	);
	const output = normalizeDartHashes(`Object.hash(${fields},)`);
	assert.equal(output, `Object.hashAll([${fields},])`);
	assert.equal(normalizeDartHashes(output), output);
	assert.equal(normalizeDartHashes("Object.hash(a, b)"), "Object.hash(a, b)");
});

test("normalizes publish manifests idempotently", () => {
	const rust =
		'[package]\nversion = "0.0.0"\nedition = "2021"\npublish = false\n\n[dependencies]\n';
	const normalizedRust = normalizeRustManifest(rust);
	assert.equal(normalizeRustManifest(normalizedRust), normalizedRust);
	assert.match(normalizedRust, /version\.workspace = true/);
	assert.match(normalizedRust, /publish = false/);

	const dart =
		"name: generated\ndescription: Generated\nversion: 0.0.0\npublish_to: none\n\nenvironment:\n";
	const normalizedDart = normalizeDartManifest(dart, "0.0.1-alpha.0");
	assert.equal(
		normalizeDartManifest(normalizedDart, "0.0.1-alpha.0"),
		normalizedDart,
	);
	assert.match(
		normalizedDart,
		/repository: https:\/\/github\.com\/pina-rs\/lootbox/,
	);
	assert.match(normalizedDart, /publish_to: none/);
});

const V0_ENVELOPE_TEST = `pub const VAULT_STATE_MIGRATION_VERSION: u8 = 0u8;

#[cfg(test)]
mod vault_state_version_error_tests {
	use super::*;

	fn envelope(version: u8) -> Vec<u8> {
		let mut data = vec![0_u8; core::mem::size_of::<VaultStateZc>()];
		data[..1].copy_from_slice(&[2]);
		data[1..2].copy_from_slice(&version.to_le_bytes());
		data
	}

	#[test]
	fn stale_and_future_versions_are_distinguishable() {
		let error = VaultState::try_from_bytes(&envelope(0 as u8)).err().expect("a stale envelope must fail");
		assert_eq!(error, VaultStateVersionError::Stale { stored: 0 });
		assert_eq!(VaultStateVersionError::Stale { stored: 0 }.to_string(), "migration version mismatch: expected 0, received 0 (the data predates this client; migrate it by sending a transaction to the program, or decode it with a client generated from an older IDL)");
		let error = VaultState::try_from_bytes(&envelope(1 as u8)).err().expect("a future envelope must fail");
		assert_eq!(error, VaultStateVersionError::Future { stored: 1 });
		assert!(VaultState::try_from_bytes(&envelope(0 as u8)).is_ok(), "the current version must decode",);
	}
}
`;

test("drops impossible stale assertions from v0 version-envelope tests", () => {
	const normalized = normalizeRustVersionEnvelopeTests(V0_ENVELOPE_TEST);
	assert.match(
		normalized,
		/expect\("a future envelope must fail"\)/,
		"keeps the future-path assertions",
	);
	assert.match(
		normalized,
		/the current version must decode/,
		"keeps the current-version assertion",
	);
	assert.equal(
		normalizeRustVersionEnvelopeTests(normalized),
		normalized,
		"idempotent",
	);
	assert.doesNotMatch(normalized, /a stale envelope must fail/);
	assert.doesNotMatch(normalized, /::Stale \{ stored: 0 \}/);
});

test("keeps stale assertions for contracts above the initial version", () => {
	const advanced = `pub const TEMPLATE_STATE_MIGRATION_VERSION: u8 = 2u8;

#[cfg(test)]
mod template_state_version_error_tests {
	#[test]
	fn stale_and_future_versions_are_distinguishable() {
		let error = TemplateState::try_from_bytes(&envelope(1_u8)).err().expect("a stale envelope must fail");
		assert_eq!(error, TemplateStateVersionError::Stale { stored: 1 });
		let error = TemplateState::try_from_bytes(&envelope(3_u8)).err().expect("a future envelope must fail");
		assert!(TemplateState::try_from_bytes(&envelope(2_u8)).is_ok(), "the current version must decode",);
	}
}
`;
	assert.equal(
		normalizeRustVersionEnvelopeTests(advanced),
		advanced,
		"untouched",
	);
});

test("drops the unreachable stale guard for v0 contracts", () => {
	const source = `pub const VAULT_STATE_MIGRATION_VERSION: u8 = 0u8;

pub fn vault_state_needs_migration(data: &[u8]) -> bool {
	data.len() >= 2
			&& data[0] == 2
			&& {
				let mut version = [0_u8; 8];
				version[..1]
					.copy_from_slice(&data[1..2]);
						 u64::from_le_bytes(version) < 0
			}
}
`;
	const normalized = normalizeRustVersionEnvelopeGuards(source);
	assert.match(
		normalized,
		/pub fn vault_state_needs_migration\(_data: &\[u8\]\) -> bool \{\n\tfalse\n\}/,
		"the helper becomes a constant false for v0 contracts",
	);
	assert.equal(
		normalizeRustVersionEnvelopeGuards(normalized),
		normalized,
		"idempotent",
	);

	const advanced = source.replace(
		"MIGRATION_VERSION: u8 = 0u8;",
		"MIGRATION_VERSION: u8 = 2u8;",
	);
	assert.equal(
		normalizeRustVersionEnvelopeGuards(advanced),
		advanced,
		"untouched",
	);
});

test("drops trailing commas before closing type-argument brackets", () => {
	const source =
		"export function getMigrateInstruction<\n\tA extends string = string,\n\tB extends string = string,\n>(";
	assert.equal(
		normalizeTypeScriptTypeArguments(
			"input: MigrateInput<\n\tA,\n\tB,\n>",
		),
		"input: MigrateInput<\n\tA,\n\tB\n>",
	);
	assert.equal(
		normalizeTypeScriptTypeArguments(source),
		source.replace(",\n>", "\n>"),
	);
	assert.equal(
		normalizeTypeScriptTypeArguments("MigrateInput<\n\tA\n>"),
		"MigrateInput<\n\tA\n>",
		"untouched when no trailing comma",
	);
});
