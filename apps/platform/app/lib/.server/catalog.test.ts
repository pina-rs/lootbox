import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCatalog } from "./catalog.js";

afterEach(() => vi.unstubAllGlobals());

describe("upstream catalog caching", () => {
	function harness(body: string | ReadableStream<Uint8Array>) {
		const put = vi.fn(async () => {});
		const waitUntil = vi.fn();
		const fetcher = vi.fn(async () => new Response(body));

		vi.stubGlobal("caches", {
			open: async () => ({ match: async () => undefined, put }),
		});
		vi.stubGlobal("fetch", fetcher);
		vi.spyOn(console, "error").mockImplementation(() => {});

		return {
			put,
			waitUntil,
			fetcher,
			app: { env: { JUPITER_API_KEY: "test" }, waitUntil },
		};
	}

	it("never caches malformed JSON", async () => {
		const { app, put, waitUntil } = harness("not json");
		const result = await searchCatalog(app, "coin", "token");

		expect(result.degraded).toEqual(["Jupiter"]);
		expect(put).not.toHaveBeenCalled();
		expect(waitUntil).not.toHaveBeenCalled();
	});

	it("cancels oversized chunked JSON before caching", async () => {
		let canceled = false;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.enqueue(new Uint8Array(512 * 1024));
			},
			cancel() {
				canceled = true;
			},
		});
		const { app, put } = harness(body);
		const result = await searchCatalog(app, "coin", "token");

		expect(result.degraded).toEqual(["Jupiter"]);
		expect(canceled).toBe(true);
		expect(put).not.toHaveBeenCalled();
	});

	it("caches bounded valid JSON after parsing it", async () => {
		const { app, put } = harness("[]");
		const result = await searchCatalog(app, "coin", "token");

		expect(result.degraded).toEqual([]);
		expect(put).toHaveBeenCalledOnce();
	});
});
