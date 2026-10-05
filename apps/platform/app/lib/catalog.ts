/**
 * The token catalog the prize picker searches: normalisation of each
 * upstream source into one shape, ranking, and plain-language warnings.
 *
 * Sources (all fetched by the Worker, never the browser):
 * - Jupiter Tokens API v2 search, for meme coins and any other token;
 * - the PreStocks public catalog, for PreStocks tokens;
 * - the Backed public assets API, for xStocks.
 *
 * Pure functions only, so ranking and mapping are unit tested against
 * recorded fixtures.
 */
export type TokenCategory = "coin" | "stock";

export type CatalogToken = Readonly<{
	mint: string;
	name: string;
	symbol: string;
	decimals: number | null;
	icon: string | null;
	tokenProgram: string | null;
	category: TokenCategory;
	verified: boolean;
	/** Jupiter's 0–100 organic activity score, when known. */
	organicScore: number | null;
	usdPrice: number | null;
	liquidity: number | null;
	volume24h: number | null;
	/** "PreStocks" or "xStocks" for tokenized stocks. */
	issuer: string | null;
	/** What a stock token tracks: a company (PreStocks) or ticker (xStocks). */
	tracks: string | null;
}>;

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null
		? Reflect.get(value, key)
		: undefined;
}

function text(value: unknown, max = 80): string | null {
	return typeof value === "string" && value.trim()
		? value.trim().slice(0, max)
		: null;
}

function number(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function httpsUrl(value: unknown): string | null {
	return typeof value === "string" && value.startsWith("https://")
		? value
		: null;
}

/** One Jupiter Tokens v2 search result. `null` for anything malformed. */
export function fromJupiter(item: unknown): CatalogToken | null {
	const mint = field(item, "id");
	const name = text(field(item, "name"));
	const symbol = text(field(item, "symbol"), 20);
	const decimals = number(field(item, "decimals"));

	if (
		typeof mint !== "string" || !BASE58.test(mint) || !name || !symbol ||
		decimals === null || !Number.isInteger(decimals) || decimals < 0 ||
		decimals > 18
	) return null;

	const stats = field(item, "stats24h");
	const buy = number(field(stats, "buyVolume")) ?? 0;
	const sell = number(field(stats, "sellVolume")) ?? 0;
	const program = field(item, "tokenProgram");
	const xStock = /xStock$/i.test(name) && /x$/.test(symbol);

	return {
		mint,
		name,
		symbol,
		decimals,
		icon: httpsUrl(field(item, "icon")),
		tokenProgram: typeof program === "string" && BASE58.test(program)
			? program
			: null,
		category: xStock ? "stock" : "coin",
		verified: field(item, "isVerified") === true,
		organicScore: number(field(item, "organicScore")),
		usdPrice: number(field(item, "usdPrice")),
		liquidity: number(field(item, "liquidity")),
		volume24h: stats === undefined ? null : buy + sell,
		issuer: xStock ? "xStocks" : null,
		tracks: xStock ? symbol.replace(/x$/, "") : null,
	};
}

/** One entry of the PreStocks public catalog. */
export function fromPreStocks(item: unknown): CatalogToken | null {
	const mint = field(item, "contract_address");
	const name = text(field(item, "name"));
	const symbol = text(field(item, "symbol"), 20);

	if (typeof mint !== "string" || !BASE58.test(mint) || !name || !symbol) {
		return null;
	}

	const company = name.replace(/\s*PreStocks$/i, "");

	return {
		mint,
		name: company,
		symbol,
		decimals: null,
		// Deliberately no company logo: lootbox.so is not affiliated with them.
		icon: null,
		tokenProgram: null,
		category: "stock",
		verified: true,
		organicScore: null,
		usdPrice: number(field(item, "tokenPrice")),
		liquidity: null,
		volume24h: null,
		issuer: "PreStocks",
		tracks: company,
	};
}

/** One Backed asset with a Solana deployment (an xStock). */
export function fromBacked(node: unknown): CatalogToken | null {
	const deployments = field(node, "deployments");
	const solana = Array.isArray(deployments)
		? deployments.find((deployment: unknown) =>
			field(deployment, "network") === "Solana"
		)
		: undefined;
	const mint = field(solana, "address");
	const name = text(field(node, "name"));
	const symbol = text(field(node, "symbol"), 20);
	const ticker = text(field(node, "underlyingSymbol"), 20);

	if (typeof mint !== "string" || !BASE58.test(mint) || !name || !symbol) {
		return null;
	}

	return {
		mint,
		name,
		symbol,
		decimals: null,
		icon: null,
		tokenProgram: null,
		category: "stock",
		verified: true,
		organicScore: null,
		usdPrice: null,
		liquidity: null,
		volume24h: null,
		issuer: "xStocks",
		tracks: ticker ?? symbol.replace(/x$/, ""),
	};
}

/** The name people should read: never "shares", always what it tracks. */
export function displayName(
	token: Pick<CatalogToken, "issuer" | "tracks" | "name">,
): string {
	if (token.issuer === "PreStocks" && token.tracks) {
		return `PreStocks tokens tracking ${token.tracks}`;
	}

	if (token.issuer === "xStocks" && token.tracks) {
		return `xStocks tracking ${token.tracks}`;
	}

	return token.name;
}

export function matches(token: CatalogToken, query: string): boolean {
	const needle = query.trim().toLowerCase();

	return !needle ||
		[token.mint, token.name, token.symbol, token.tracks ?? ""].some((value) =>
			value.toLowerCase().includes(needle)
		);
}

/**
 * Best match first: exact ticker or mint, then prefix matches, then trust
 * (verified, organic activity) and depth (liquidity).
 */
export function rankTokens(
	tokens: readonly CatalogToken[],
	query: string,
): CatalogToken[] {
	const needle = query.trim().toLowerCase();
	const score = (token: CatalogToken) => {
		const symbol = token.symbol.toLowerCase();
		const name = token.name.toLowerCase();
		let value = 0;

		if (needle && (token.mint.toLowerCase() === needle || symbol === needle)) {
			value += 1_000;
		} else if (
			needle && (symbol.startsWith(needle) || name.startsWith(needle))
		) value += 400;

		if (token.verified) value += 200;

		value += token.organicScore ?? 0;
		value += Math.log10((token.liquidity ?? 0) + 1) * 10;

		return value;
	};
	const unique = new Map<string, CatalogToken>();

	for (const token of tokens) {
		if (!unique.has(token.mint)) unique.set(token.mint, token);
	}

	return [...unique.values()]
		.filter((token) => matches(token, query))
		.sort((a, b) => score(b) - score(a));
}

/** Plain-language cautions shown beside a search result. */
export function tokenWarnings(token: CatalogToken): string[] {
	const warnings: string[] = [];

	if (!token.verified) warnings.push("Unverified");

	if (token.liquidity !== null && token.liquidity < 10_000) {
		warnings.push("Low liquidity");
	}

	if (token.organicScore !== null && token.organicScore < 20) {
		warnings.push("Little organic trading");
	}

	return warnings;
}

/** "$1.2M", "$840", "$0.0000123". */
export function compactUsd(value: number | null): string {
	if (value === null) return "—";

	if (value >= 1_000) {
		return `$${
			new Intl.NumberFormat("en-US", {
				notation: "compact",
				maximumFractionDigits: 1,
			})
				.format(value)
		}`;
	}

	if (value >= 1) return `$${value.toFixed(2)}`;

	return `$${value.toPrecision(3)}`;
}
