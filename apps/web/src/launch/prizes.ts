import { templateInventory } from "@pina-rs/lootbox";

import snapshot from "./prestocks-snapshot.json";

const PRESTOCKS_API = "https://prestocks.com/api/prestocks";

/** One PreStocks pre-IPO token as the manifest displays it. */
export type StockListing = Readonly<{
	symbol: string;
	name: string;
	mint: string;
	logo: string;
	url: string;
	usdPrice: number;
}>;

/**
 * Stock metadata and prices keyed by mint.
 *
 * `live` prices come from the PreStocks API at runtime. That API sends no CORS
 * headers today, so most browsers fall back to the bundled `snapshot`, which
 * carries its capture time so the UI can say how old the prices are.
 */
export type PriceBook = Readonly<{
	source: "live" | "snapshot";
	capturedAt: string;
	stocks: ReadonlyMap<string, StockListing>;
}>;

export function snapshotPriceBook(): PriceBook {
	return Object.freeze({
		source: "snapshot",
		capturedAt: snapshot.capturedAt,
		stocks: new Map(snapshot.stocks.map((stock) => [stock.mint, stock])),
	});
}

/** Merge a live PreStocks payload over the snapshot. Unknown shapes are ignored. */
export function applyLivePrices(book: PriceBook, body: unknown): PriceBook {
	if (!Array.isArray(body)) return book;

	const stocks = new Map(book.stocks);
	let updated = 0;

	for (const entry of body) {
		if (typeof entry !== "object" || entry === null) continue;

		const mint: unknown = Reflect.get(entry, "contract_address");
		const price: unknown = Reflect.get(entry, "tokenPrice");
		const known = typeof mint === "string" ? stocks.get(mint) : undefined;

		if (!known || typeof price !== "number" || !Number.isFinite(price)) {
			continue;
		}

		stocks.set(known.mint, { ...known, usdPrice: price });
		updated += 1;
	}

	if (updated === 0) return book;

	return Object.freeze({
		source: "live",
		capturedAt: new Date().toISOString(),
		stocks,
	});
}

export async function loadPriceBook(
	fetcher: typeof fetch = fetch,
): Promise<PriceBook> {
	const book = snapshotPriceBook();

	try {
		const response = await fetcher(PRESTOCKS_API, {
			signal: AbortSignal.timeout(5_000),
		});

		if (!response.ok) return book;

		return applyLivePrices(book, await response.json());
	} catch {
		// Expected in browsers: the API is not CORS-enabled. The snapshot is the
		// documented fallback and the UI labels its capture date.
		return book;
	}
}

export type PrizeLine =
	| Readonly<{
		kind: "stock";
		stock: StockListing;
		amount: bigint;
		decimals: number;
		usdValue: number;
	}>
	| Readonly<{ kind: "sol"; lamports: bigint }>
	| Readonly<{ kind: "token"; mint: string; amount: bigint; decimals: number }>
	| Readonly<{ kind: "collectible"; mint: string }>;

/** The subset of a decoded on-chain bundle the manifest needs. */
export type BundleSummary = Readonly<{
	index: number;
	quantity: bigint;
	assets: readonly Readonly<{
		kind: string;
		mint: string;
		amount: bigint;
		decimals: number;
	}>[];
}>;

export type PrizeTier = "headline" | "standard";

export type ManifestRow = Readonly<{
	index: number;
	lines: readonly PrizeLine[];
	copies: bigint;
	remaining: bigint;
	oddsPercent: number;
	usdValue: number | null;
	tier: PrizeTier;
}>;

const FUNGIBLE_KINDS = new Set(["token", "token2022", "quoteToken"]);
const SOL_KINDS = new Set(["sol", "quoteSol"]);

function unitsToNumber(amount: bigint, decimals: number): number {
	return Number(amount) / 10 ** decimals;
}

export function prizeLine(
	asset: BundleSummary["assets"][number],
	book: PriceBook,
): PrizeLine {
	if (SOL_KINDS.has(asset.kind)) {
		return { kind: "sol", lamports: asset.amount };
	}

	if (!FUNGIBLE_KINDS.has(asset.kind)) {
		return { kind: "collectible", mint: asset.mint };
	}

	const stock = book.stocks.get(asset.mint);

	if (!stock) {
		return {
			kind: "token",
			mint: asset.mint,
			amount: asset.amount,
			decimals: asset.decimals,
		};
	}

	return {
		kind: "stock",
		stock,
		amount: asset.amount,
		decimals: asset.decimals,
		usdValue: unitsToNumber(asset.amount, asset.decimals) * stock.usdPrice,
	};
}

function rowValue(lines: readonly PrizeLine[]): number | null {
	let total = 0;

	for (const line of lines) {
		if (line.kind !== "stock") return null;

		total += line.usdValue;
	}

	return total;
}

/**
 * Decide which bundles earn the big celebration.
 *
 * The headline tier is the highest-valued bundle when prices are known, or the
 * rarest bundle by original copies otherwise. When every bundle ties there is
 * no headline: nobody should get a "you won big" moment for an average prize.
 */
export function assignTiers(
	rows: readonly Readonly<{ usdValue: number | null; copies: bigint }>[],
): PrizeTier[] {
	const values = rows.map((row) => row.usdValue);
	const allValued = values.every((value) => value !== null);

	if (allValued && rows.length > 1) {
		const numeric = values.filter((value): value is number => value !== null);
		const top = Math.max(...numeric);
		const distinct = numeric.some((value) => value < top * 0.999);

		return numeric.map((value) =>
			distinct && value >= top * 0.999 ? "headline" : "standard"
		);
	}

	const rarest = rows.reduce<bigint | null>(
		(minimum, row) =>
			minimum === null || row.copies < minimum ? row.copies : minimum,
		null,
	);
	const distinct = rows.some((row) => row.copies !== rarest);

	return rows.map((row) =>
		distinct && row.copies === rarest ? "headline" : "standard"
	);
}

/** Build the live manifest: prizes, copies left, and odds from remaining inventory. */
export function buildManifest(
	bundles: readonly BundleSummary[],
	remaining: readonly bigint[],
	book: PriceBook,
): ManifestRow[] {
	const odds = templateInventory({
		remaining: [...remaining],
		bundleCount: remaining.length,
	});
	const drafts = bundles.map((bundle) => {
		const lines = bundle.assets.map((asset) => prizeLine(asset, book));

		return {
			index: bundle.index,
			lines,
			copies: bundle.quantity,
			remaining: remaining[bundle.index] ?? 0n,
			oddsPercent: odds[bundle.index]?.probabilityPercent ?? 0,
			usdValue: rowValue(lines),
		};
	});
	const tiers = assignTiers(drafts);

	return drafts.map((row, index) => ({
		...row,
		tier: tiers[index] ?? "standard",
	}));
}

/** Planned launch lineup, shown only until a locked treasury is configured. */
export type PlannedSlice = Readonly<{
	stock: StockListing;
	gbp: number;
	copies: number;
}>;

const PLAN: readonly Readonly<{ symbol: string; gbp: number }>[] = [
	{ symbol: "OPENAI", gbp: 50 },
	{ symbol: "ANTHROPIC", gbp: 50 },
	{ symbol: "SPACEX", gbp: 20 },
	{ symbol: "ANDURIL", gbp: 20 },
	{ symbol: "KALSHI", gbp: 20 },
	{ symbol: "NEURALINK", gbp: 20 },
	{ symbol: "POLYMARKET", gbp: 20 },
];

export function plannedLineup(book: PriceBook): PlannedSlice[] {
	const bySymbol = new Map(
		[...book.stocks.values()].map((stock) => [stock.symbol, stock]),
	);

	return PLAN.flatMap(({ symbol, gbp }) => {
		const stock = bySymbol.get(symbol);

		return stock ? [{ stock, gbp, copies: 1 }] : [];
	});
}

export function formatUnits(amount: bigint, decimals: number): string {
	const scale = 10n ** BigInt(decimals);
	const whole = amount / scale;
	const fraction = (amount % scale).toString().padStart(decimals, "0")
		.slice(0, 6).replace(/0+$/, "");

	return fraction ? `${whole.toLocaleString("en-US")}.${fraction}` : whole
		.toLocaleString("en-US");
}

export function formatUsd(value: number): string {
	return value.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: value < 100 ? 2 : 0,
	});
}

export function formatOdds(percent: number): string {
	if (percent === 0) return "0%";

	if (percent < 0.1) return "<0.1%";

	if (percent >= 99.95) return "100%";

	return `${percent.toFixed(1)}%`;
}

export function shortAddress(value: string): string {
	return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Human title for a single prize line, e.g. "0.0302 SPACEX" or "1 SOL". */
export function lineTitle(line: PrizeLine): string {
	switch (line.kind) {
		case "stock":
			return `${formatUnits(line.amount, line.decimals)} ${line.stock.symbol}`;
		case "sol":
			return `${formatUnits(line.lamports, 9)} SOL`;
		case "token":
			return `${formatUnits(line.amount, line.decimals)} tokens`;
		case "collectible":
			return "Collectible";
	}
}

export function rowTitle(row: Pick<ManifestRow, "lines">): string {
	return row.lines.map(lineTitle).join(" + ");
}
