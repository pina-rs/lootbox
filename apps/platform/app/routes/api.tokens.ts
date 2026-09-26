/**
 * Token search, proxied server-side so the Jupiter key never reaches the
 * browser. Responses are cached at the edge for five minutes.
 */
import { jsonResponse, services } from "../lib/.server/context.js";
import {
	type CatalogToken,
	CLASSIC_TOKEN_PROGRAM,
	FALLBACK_TOKENS,
	matchesQuery,
	PRESTOCKS,
} from "../lib/tokens.js";
import type { Route } from "./+types/api.tokens";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TTL_SECONDS = 300;

function parseJupiter(payload: unknown): CatalogToken[] {
	if (!Array.isArray(payload)) {
		throw new TypeError("unexpected Jupiter response");
	}

	return payload.slice(0, 25).flatMap((item: unknown): CatalogToken[] => {
		if (typeof item !== "object" || item === null) return [];

		const id = Reflect.get(item, "id");
		const name = Reflect.get(item, "name");
		const symbol = Reflect.get(item, "symbol");
		const decimals = Reflect.get(item, "decimals");
		const icon = Reflect.get(item, "icon");
		const program = Reflect.get(item, "tokenProgram");

		if (
			typeof id !== "string" || !BASE58.test(id) || typeof name !== "string" ||
			typeof symbol !== "string" || typeof decimals !== "number" ||
			!Number.isInteger(decimals) || decimals < 0 || decimals > 18
		) return [];

		return [{
			mint: id,
			name: name.slice(0, 80),
			symbol: symbol.slice(0, 20),
			decimals,
			icon: typeof icon === "string" && icon.startsWith("https://")
				? icon
				: null,
			tokenProgram: typeof program === "string" && BASE58.test(program)
				? program
				: CLASSIC_TOKEN_PROGRAM,
			verified: Reflect.get(item, "isVerified") === true,
			tracks: PRESTOCKS.get(id) ?? null,
		}];
	});
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const query = (new URL(request.url).searchParams.get("q") ?? "").trim()
		.slice(0, 80);
	const fallback = {
		items: FALLBACK_TOKENS.filter((token) => matchesQuery(token, query)),
		source: "fallback" as const,
	};
	const apiKey = app.env.JUPITER_API_KEY;

	if (!apiKey) return jsonResponse(fallback);

	const cacheKey = new Request(
		`https://catalog.lootbox.internal/tokens?q=${
			encodeURIComponent(query.toLowerCase())
		}`,
	);
	const cache = await caches.open("token-catalog");
	const hit = await cache.match(cacheKey);

	if (hit) return hit;

	try {
		const upstream = await fetch(
			`https://api.jup.ag/tokens/v2/search?query=${
				encodeURIComponent(query || "SOL")
			}`,
			{ headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(7_000) },
		);

		if (!upstream.ok) throw new Error(`Jupiter returned ${upstream.status}`);

		const response = jsonResponse(
			{ items: parseJupiter(await upstream.json()), source: "live" },
			{ headers: { "Cache-Control": `public, max-age=${TTL_SECONDS}` } },
		);

		app.waitUntil(cache.put(cacheKey, response.clone()));

		return response;
	} catch (error) {
		console.error("token catalog failed", error);

		return jsonResponse({
			...fallback,
			message: "Live token search is unavailable; showing a starter list.",
		});
	}
}
