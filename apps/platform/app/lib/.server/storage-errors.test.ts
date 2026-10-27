import { describe, expect, it } from "vitest";

import { storageErrorResponse } from "./storage-errors.js";

describe("storage error boundary", () => {
	it("reports a known quota rejection and a fenced upload", () => {
		expect(
			storageErrorResponse(
				new Error("D1_ERROR: storage_quota: SQLITE_CONSTRAINT"),
			).status,
		).toBe(429);
		expect(
			storageErrorResponse(
				new Error("D1_ERROR: upload_unavailable: SQLITE_CONSTRAINT"),
			).status,
		).toBe(409);
	});

	it("preserves unexpected storage failures", () => {
		const error = new Error("D1 unavailable");

		expect(() => storageErrorResponse(error)).toThrow(error);
	});
});
