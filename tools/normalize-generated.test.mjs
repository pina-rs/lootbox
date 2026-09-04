import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDartHashes } from "./normalize-generated.mjs";

test("normalizes oversized generated hash calls reproducibly", () => {
	const fields = Array.from({ length: 22 }, (_, index) => `field${index}`).join(
		",\n",
	);
	const output = normalizeDartHashes(`Object.hash(${fields},)`);
	assert.equal(output, `Object.hashAll([${fields},])`);
	assert.equal(normalizeDartHashes(output), output);
	assert.equal(normalizeDartHashes("Object.hash(a, b)"), "Object.hash(a, b)");
});
