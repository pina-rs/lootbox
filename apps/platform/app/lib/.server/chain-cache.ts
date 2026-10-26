/**
 * Short-lived edge caching for chain reads.
 *
 * Home, explore, lootbox pages, and OG images each trigger at least one
 * live Solana RPC round trip per view; against the public devnet RPC that
 * dominates time-to-first-byte and burns quota. The Workers Cache API keeps
 * a per-colo copy for a few seconds, which is exactly how stale a status
 * chip or odds snapshot may be. Caching fails open: without a cache, or when
 * match/put throws, the read goes straight to the RPC as before.
 */
import { isAddress } from "@solana/kit";
import {
	type LootboxChainView,
	readLootboxChain,
	readTemplateSummaries,
	type TemplateSummary,
} from "../chain.js";
import type { Cluster } from "../clusters.js";

/** How long a template summary set stays fresh. */
export const SUMMARY_TTL_SECONDS = 10;
/** How long a full lootbox view stays fresh. */
export const VIEW_TTL_SECONDS = 5;

/** The subset of the Workers Cache API used here. */
type JsonCache = Readonly<Pick<Cache, "match" | "put">>;

function workerCache(): JsonCache | null {
	const registry = (globalThis as { caches?: { default?: Cache } }).caches;

	return registry?.default ?? null;
}

async function cachedChainRead<T>(
	path: string,
	ttlSeconds: number,
	produce: () => Promise<T>,
	cache: JsonCache | null = workerCache(),
): Promise<T> {
	if (cache === null) return produce();

	const request = new Request(`https://chain.cache.internal/${path}`);

	try {
		const hit = await cache.match(request);

		if (hit) return JSON.parse(await hit.text()) as T;
	} catch {
		// A cache read failure must never break the page; fall through.
	}

	const value = await produce();

	try {
		await cache.put(
			request,
			new Response(JSON.stringify(value), {
				headers: { "Cache-Control": `public, max-age=${ttlSeconds}` },
			}),
		);
	} catch {
		// Failing to warm the cache only costs the next reader.
	}

	return value;
}

/** Cache key fragment for one template set, stable across card ordering. */
function summariesPath(
	cluster: Cluster,
	templates: readonly string[],
): string | null {
	const valid = [...new Set(templates.filter(isAddress))].sort();

	return valid.length === 0 ? null : `summaries/${cluster}/${valid.join(",")}`;
}

/** Template summaries through the edge cache, skipping invalid addresses. */
export async function cachedTemplateSummaries(
	rpcUrl: string,
	cluster: Cluster,
	templates: readonly string[],
	cache?: JsonCache,
): Promise<TemplateSummary[]> {
	const path = summariesPath(cluster, templates);

	if (path === null) return [];

	return cachedChainRead(
		path,
		SUMMARY_TTL_SECONDS,
		() => readTemplateSummaries(rpcUrl, templates),
		cache,
	);
}

/** A full lootbox view through the edge cache. */
export async function cachedLootboxChain(
	rpcUrl: string,
	cluster: Cluster,
	template: string,
	cache?: JsonCache,
): Promise<LootboxChainView | null> {
	if (!isAddress(template)) return readLootboxChain(rpcUrl, template);

	return cachedChainRead(
		`view/${cluster}/${template}`,
		VIEW_TTL_SECONDS,
		() => readLootboxChain(rpcUrl, template),
		cache,
	);
}
