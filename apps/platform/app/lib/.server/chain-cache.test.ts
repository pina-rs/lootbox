import { describe, expect, it, vi } from "vitest";
import { readLootboxChain, readTemplateSummaries } from "../chain.js";
import type { Cluster } from "../clusters.js";
import {
	cachedLootboxChain,
	cachedTemplateSummaries,
	SUMMARY_TTL_SECONDS,
	VIEW_TTL_SECONDS,
} from "./chain-cache.js";

const TEMPLATE = "LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E";

vi.mock("../chain.js", () => ({
	readLootboxChain: vi.fn(),
	readTemplateSummaries: vi.fn(),
}));

/** A Map-backed Cache honoring max-age expiry against a mutable clock. */
function fakeCache() {
	const stored = new Map<string, { body: string; expiresAt: number }>();
	let now = 100;

	return {
		clock: {
			advance(seconds: number) {
				now += seconds;
			},
		},
		cache: {
			async match(request: Request) {
				const hit = stored.get(request.url);

				if (!hit || hit.expiresAt <= now) return undefined;

				return new Response(hit.body, {
					headers: { "Cache-Control": `public, max-age=1` },
				});
			},
			async put(request: Request, response: Response) {
				stored.set(request.url, {
					body: await response.clone().text(),
					expiresAt: now + SUMMARY_TTL_SECONDS,
				});
			},
		},
	};
}

describe("chain cache", () => {
	it("serves repeat summary reads from the cache", async () => {
		const { cache, clock } = fakeCache();
		const produce = vi.fn(async () => [{ template: TEMPLATE }]);

		vi.mocked(readTemplateSummaries).mockImplementation(produce);

		const first = await cachedTemplateSummaries(
			"http://localhost:8899",
			"devnet" as Cluster,
			[TEMPLATE],
			cache,
		);
		const second = await cachedTemplateSummaries(
			"http://localhost:8899",
			"devnet" as Cluster,
			[TEMPLATE],
			cache,
		);

		expect(first).toEqual([{ template: TEMPLATE }]);
		expect(second).toEqual(first);
		expect(produce).toHaveBeenCalledTimes(1);

		clock.advance(SUMMARY_TTL_SECONDS + 1);

		await cachedTemplateSummaries(
			"http://localhost:8899",
			"devnet" as Cluster,
			[TEMPLATE],
			cache,
		);

		expect(produce).toHaveBeenCalledTimes(2);
	});

	it("keys summary sets by cluster and sorted templates", async () => {
		const { cache } = fakeCache();
		const produce = vi.fn(async () => []);

		vi.mocked(readTemplateSummaries).mockImplementation(produce);

		await cachedTemplateSummaries("http://a", "devnet" as Cluster, [
			TEMPLATE,
		], cache);
		await cachedTemplateSummaries("http://a", "devnet" as Cluster, [
			TEMPLATE,
			"not-an-address",
		], cache);

		expect(produce).toHaveBeenCalledTimes(1);

		await cachedTemplateSummaries("http://a", "mainnet" as Cluster, [
			TEMPLATE,
		], cache);

		expect(produce).toHaveBeenCalledTimes(2);
	});

	it("caches lootbox views and skips invalid templates", async () => {
		const { cache } = fakeCache();
		const produce = vi.fn(async () => null);

		vi.mocked(readLootboxChain).mockImplementation(produce);

		await cachedLootboxChain("http://a", "devnet" as Cluster, TEMPLATE, cache);
		await cachedLootboxChain("http://a", "devnet" as Cluster, TEMPLATE, cache);

		expect(produce).toHaveBeenCalledTimes(1);

		await cachedLootboxChain(
			"http://a",
			"devnet" as Cluster,
			"not-an-address",
			cache,
		);

		expect(produce).toHaveBeenCalledTimes(2);
		expect(VIEW_TTL_SECONDS).toBeLessThan(SUMMARY_TTL_SECONDS);
	});

	it("fails open when the cache throws", async () => {
		const produce = vi.fn(async () => []);
		const throwing: Cache = {
			match: async () => {
				throw new Error("cache read failed");
			},
			put: async () => {
				throw new Error("cache write failed");
			},
		} as unknown as Cache;

		vi.mocked(readTemplateSummaries).mockImplementation(produce);

		const value = await cachedTemplateSummaries(
			"http://a",
			"devnet" as Cluster,
			[TEMPLATE],
			throwing,
		);

		expect(value).toEqual([]);
		expect(produce).toHaveBeenCalledTimes(1);
	});
});
