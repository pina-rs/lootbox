/**
 * Upstream market data for the prize picker, fetched only by the Worker.
 *
 * Every upstream response is cached with the Cache API (five minutes for
 * search and catalogs, one minute for prices). API keys stay in the Worker.
 * With `CATALOG_FIXTURES=true` (end-to-end tests) every call returns the
 * recorded fixtures instead, so tests are deterministic and offline.
 */
import {
	type CatalogToken,
	fromBacked,
	fromJupiter,
	fromPreStocks,
	rankTokens,
	type TokenCategory,
} from "../catalog.js";
import type { AppServices } from "./context.js";
import backedFixture from "./fixtures/backed.json";
import priceFixture from "./fixtures/jupiter-price.json";
import searchFixture from "./fixtures/jupiter-search.json";
import prestocksFixture from "./fixtures/prestocks.json";
import orderFixture from "./fixtures/swap-order.json";

const JUPITER = "https://api.jup.ag";
const PRESTOCKS = "https://prestocks.com/api/prestocks";
const BACKED = "https://api.backed.fi/api/v2/public/assets";
const FX = "https://api.frankfurter.app/latest?from=USD&to=GBP";
export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

export function usingFixtures(app: AppServices): boolean {
	return app.env.CATALOG_FIXTURES === "true";
}

async function cachedJson(
	app: AppServices,
	url: string,
	init: RequestInit,
	ttlSeconds: number,
): Promise<unknown> {
	const key = new Request(
		`https://cache.lootbox.internal/${encodeURIComponent(url)}`,
	);
	const cache = await caches.open("market-data");
	const hit = await cache.match(key);

	if (hit) return hit.json();

	const response = await fetch(url, {
		...init,
		signal: AbortSignal.timeout(8_000),
	});

	if (!response.ok) {
		throw new Error(`${new URL(url).host} returned ${response.status}`);
	}

	const body = await response.text();

	app.waitUntil(
		cache.put(
			key,
			new Response(body, {
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": `public, max-age=${ttlSeconds}`,
				},
			}),
		),
	);

	return JSON.parse(body);
}

function jupiterHeaders(app: AppServices): HeadersInit | null {
	const key = app.env.JUPITER_API_KEY;

	return key ? { "x-api-key": key } : null;
}

function list(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

async function jupiterSearch(
	app: AppServices,
	query: string,
): Promise<CatalogToken[]> {
	if (usingFixtures(app)) {
		return list(searchFixture).map(fromJupiter).flatMap((t) => (t ? [t] : []));
	}

	const headers = jupiterHeaders(app);

	if (!headers || !query) return [];

	const body = await cachedJson(
		app,
		`${JUPITER}/tokens/v2/search?query=${encodeURIComponent(query)}`,
		{ headers },
		300,
	);

	return list(body).map(fromJupiter).flatMap((token) => (token ? [token] : []));
}

async function preStocks(app: AppServices): Promise<CatalogToken[]> {
	const body = usingFixtures(app)
		? prestocksFixture
		: await cachedJson(app, PRESTOCKS, {}, 300);

	return list(body).map(fromPreStocks).flatMap((
		token,
	) => (token ? [token] : []));
}

async function xStocks(app: AppServices): Promise<CatalogToken[]> {
	if (usingFixtures(app)) {
		return list(Reflect.get(backedFixture, "nodes")).map(fromBacked).flatMap((
			t,
		) => (t ? [t] : []));
	}

	const tokens: CatalogToken[] = [];

	// The public list is paginated at 100; five pages covers every xStock.
	for (let page = 0; page < 5; page += 1) {
		const body = await cachedJson(
			app,
			`${BACKED}?limit=100&page=${page}`,
			{},
			3_600,
		);
		const nodes = typeof body === "object" && body !== null
			? Reflect.get(body, "nodes")
			: null;

		for (const node of list(nodes)) {
			const token = fromBacked(node);

			if (token) tokens.push(token);
		}

		const next = typeof body === "object" && body !== null
			? Reflect.get(Reflect.get(body, "page") ?? {}, "hasNextPage")
			: false;

		if (next !== true) break;
	}

	return tokens;
}

export type SearchResult = Readonly<{
	items: readonly CatalogToken[];
	/** Upstreams that failed; the rest still answered. */
	degraded: readonly string[];
	live: boolean;
}>;

/** Search one picker category, merging every source that serves it. */
export async function searchCatalog(
	app: AppServices,
	category: TokenCategory,
	query: string,
): Promise<SearchResult> {
	const sources: Record<string, () => Promise<CatalogToken[]>> =
		category === "stock"
			? {
				PreStocks: () => preStocks(app),
				xStocks: () => xStocks(app),
				Jupiter: async () =>
					(await jupiterSearch(app, query)).filter((token) =>
						token.category === "stock"
					),
			}
			: {
				Jupiter: async () =>
					(await jupiterSearch(app, query)).filter((token) =>
						token.category === "coin"
					),
			};
	const degraded: string[] = [];
	const results = await Promise.all(
		Object.entries(sources).map(([name, load]) =>
			load().catch((error: unknown) => {
				console.error(`${name} catalog failed`, error);
				degraded.push(name);

				return [];
			})
		),
	);

	return {
		items: rankTokens(results.flat(), query).slice(0, 25),
		degraded,
		live: usingFixtures(app) || jupiterHeaders(app) !== null,
	};
}

export type Prices = Readonly<{
	usd: Readonly<Record<string, number>>;
	/** British pounds per US dollar, for the £ amount input. */
	gbpPerUsd: number | null;
}>;

/** USD prices from Jupiter Price v3 plus a USD→GBP rate. */
export async function prices(
	app: AppServices,
	mints: readonly string[],
): Promise<Prices> {
	const usd: Record<string, number> = {};
	let body: unknown = {};

	if (usingFixtures(app)) {
		body = priceFixture;
	} else {
		const headers = jupiterHeaders(app);

		if (headers && mints.length > 0) {
			body = await cachedJson(
				app,
				`${JUPITER}/price/v3?ids=${mints.slice(0, 50).join(",")}`,
				{ headers },
				60,
			);
		}
	}

	for (const mint of mints) {
		const price = typeof body === "object" && body !== null
			? Reflect.get(Reflect.get(body, mint) ?? {}, "usdPrice")
			: undefined;

		if (typeof price === "number" && Number.isFinite(price)) usd[mint] = price;
	}

	// PreStocks are priced by their issuer's catalog, not by Jupiter.
	const missing = mints.filter((mint) => usd[mint] === undefined);

	if (missing.length > 0) {
		const stocks = await preStocks(app).catch(() => []);

		for (const stock of stocks) {
			if (missing.includes(stock.mint) && stock.usdPrice !== null) {
				usd[stock.mint] = stock.usdPrice;
			}
		}
	}

	let gbpPerUsd: number | null = usingFixtures(app) ? 0.75 : null;

	if (!usingFixtures(app)) {
		const fx = await cachedJson(app, FX, {}, 3_600).catch(() => null);
		const rate = typeof fx === "object" && fx !== null
			? Reflect.get(Reflect.get(fx, "rates") ?? {}, "GBP")
			: null;

		gbpPerUsd = typeof rate === "number" ? rate : null;
	}

	return { usd, gbpPerUsd };
}

export type SwapOrder = Readonly<{
	requestId: string;
	inAmount: string;
	outAmount: string;
	priceImpactPct: number;
	slippageBps: number;
	/** Base64 unsigned transaction; `null` for fixtures, which never sign. */
	transaction: string | null;
}>;

function toOrder(body: unknown): SwapOrder {
	const read = (key: string) =>
		typeof body === "object" && body !== null
			? Reflect.get(body, key)
			: undefined;
	const requestId = read("requestId");
	const inAmount = read("inAmount");
	const outAmount = read("outAmount");
	const transaction = read("transaction");

	if (
		typeof requestId !== "string" || typeof inAmount !== "string" ||
		typeof outAmount !== "string"
	) {
		const message = read("error") ?? read("errorMessage");

		throw new Error(
			typeof message === "string" ? message : "No swap route found",
		);
	}

	return {
		requestId,
		inAmount,
		outAmount,
		priceImpactPct: Number(read("priceImpactPct") ?? 0),
		slippageBps: Number(read("slippageBps") ?? 0),
		transaction: typeof transaction === "string" ? transaction : null,
	};
}

/** A Jupiter Swap v2 order: SOL in, `outputMint` out, for `taker`. */
export async function swapOrder(
	app: AppServices,
	input: Readonly<{ outputMint: string; lamports: bigint; taker: string }>,
): Promise<SwapOrder> {
	if (usingFixtures(app)) return toOrder(orderFixture);

	const headers = jupiterHeaders(app);

	if (!headers) throw new Error("Swaps need a Jupiter API key on the server");

	const url = new URL(`${JUPITER}/swap/v2/order`);

	url.searchParams.set("inputMint", WRAPPED_SOL);
	url.searchParams.set("outputMint", input.outputMint);
	url.searchParams.set("amount", input.lamports.toString());
	url.searchParams.set("taker", input.taker);
	url.searchParams.set("slippageBps", "100");

	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(10_000),
	});

	return toOrder(await response.json());
}

export type SwapExecution = Readonly<{
	status: string;
	signature: string | null;
	error: string | null;
}>;

/** Submit a wallet-signed order through Jupiter's managed landing. */
export async function swapExecute(
	app: AppServices,
	input: Readonly<{ signedTransaction: string; requestId: string }>,
): Promise<SwapExecution> {
	if (usingFixtures(app)) {
		return {
			status: "Failed",
			signature: null,
			error: "Fixture swaps never execute",
		};
	}

	const headers = jupiterHeaders(app);

	if (!headers) throw new Error("Swaps need a Jupiter API key on the server");

	const response = await fetch(`${JUPITER}/swap/v2/execute`, {
		method: "POST",
		headers: { ...headers, "Content-Type": "application/json" },
		body: JSON.stringify(input),
		signal: AbortSignal.timeout(30_000),
	});
	const body: unknown = await response.json();
	const read = (key: string) =>
		typeof body === "object" && body !== null
			? Reflect.get(body, key)
			: undefined;
	const status = read("status");
	const signature = read("signature");
	const error = read("error");

	return {
		status: typeof status === "string"
			? status
			: response.ok
			? "Unknown"
			: "Failed",
		signature: typeof signature === "string" ? signature : null,
		error: typeof error === "string" ? error : null,
	};
}
