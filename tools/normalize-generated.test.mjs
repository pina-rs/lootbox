import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeDartHashes,
	normalizeDartManifest,
	normalizeRustManifest,
} from "./normalize-generated.mjs";

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
