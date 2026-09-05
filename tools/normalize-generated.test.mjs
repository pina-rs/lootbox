import assert from "node:assert/strict";
import test from "node:test";
import {
	assertWorkspaceVersions,
	normalizeDartHashes,
	normalizeDartManifest,
	normalizeRustManifest,
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
	assert.doesNotMatch(normalizedRust, /publish = false/);

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
	assert.doesNotMatch(normalizedDart, /publish_to/);
});
