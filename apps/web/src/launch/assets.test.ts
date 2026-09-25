import { describe, expect, it } from "vitest";

import { assetUrl, routeOf } from "./assets.js";

describe("base-path assets", () => {
	it("prefixes public files with the base path", () => {
		expect(assetUrl("/logos/a.png", "/")).toBe("/logos/a.png");
		expect(assetUrl("logos/a.png", "/lootbox/")).toBe("/lootbox/logos/a.png");
		expect(assetUrl("/logos/a.png", "/lootbox")).toBe("/lootbox/logos/a.png");
	});

	it("reads routes relative to the base path", () => {
		expect(routeOf("/playground", "/")).toBe("/playground");
		expect(routeOf("/lootbox/playground/", "/lootbox/")).toBe("/playground");
		expect(routeOf("/lootbox/", "/lootbox/")).toBe("/");
		expect(routeOf("/lootbox", "/lootbox/")).toBe("/");
	});
});
