import { describe, expect, it } from "vitest";

import { createSlug, isSlug, slugStem } from "./slug.js";

describe("slugs", () => {
	it("makes readable ASCII stems", () => {
		expect(slugStem("Summer Drop! 2026")).toBe("summer-drop-2026");
		expect(slugStem("  Café   Crème  ")).toBe("cafe-creme");
		expect(slugStem("🎁🎁")).toBe("lootbox");
		expect(slugStem("a".repeat(80))).toHaveLength(32);
	});

	it("adds an unambiguous suffix and validates the result", () => {
		const slug = createSlug("Mystery Box", (length) => new Uint8Array(length));

		expect(slug).toBe("mystery-box-aaaaa");
		expect(isSlug(slug)).toBe(true);
		expect(isSlug(createSlug("x".repeat(40)))).toBe(true);
		expect(isSlug("../etc")).toBe(false);
		expect(isSlug("UPPER")).toBe(false);
	});
});
