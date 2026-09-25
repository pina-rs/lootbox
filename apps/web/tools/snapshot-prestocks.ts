/**
 * Snapshot the public PreStocks catalog into the static launch site.
 *
 * The PreStocks API does not send CORS headers, so the browser never calls it.
 * This tool records the catalog (symbol, mint, logo, token price) with its
 * capture time and copies each logo locally so the prize manifest renders
 * offline. The Pages workflow runs it before every build and keeps the
 * committed snapshot if it fails; the page shows the capture date.
 *
 * Run from `apps/web`: `node tools/snapshot-prestocks.ts`
 */
import { mkdirSync, writeFileSync } from "node:fs";

type RawStock = {
	name: string;
	symbol: string;
	image: string;
	external_url: string;
	contract_address: string;
	tokenPrice: number;
};

const API = "https://prestocks.com/api/prestocks";
const logos = new URL("../public/logos/prestocks/", import.meta.url);
const output = new URL(
	"../src/launch/prestocks-snapshot.json",
	import.meta.url,
);

function isRawStock(value: unknown): value is RawStock {
	if (typeof value !== "object" || value === null) return false;

	const entry = value as Record<string, unknown>;

	return typeof entry.name === "string" && typeof entry.symbol === "string" &&
		typeof entry.image === "string" &&
		typeof entry.external_url === "string" &&
		typeof entry.contract_address === "string" &&
		typeof entry.tokenPrice === "number";
}

const response = await fetch(API, { signal: AbortSignal.timeout(15_000) });

if (!response.ok) {
	throw new Error(`PreStocks API responded ${response.status}`);
}

const body: unknown = await response.json();

if (!Array.isArray(body) || !body.every(isRawStock)) {
	throw new Error("PreStocks API returned an unexpected shape");
}

mkdirSync(logos, { recursive: true });

const stocks = [];

for (const stock of body) {
	const file = `${stock.symbol.toLowerCase()}.png`;
	const logo = await fetch(stock.image, {
		signal: AbortSignal.timeout(15_000),
	});

	if (!logo.ok) throw new Error(`logo for ${stock.symbol} is unavailable`);

	writeFileSync(new URL(file, logos), Buffer.from(await logo.arrayBuffer()));
	stocks.push({
		symbol: stock.symbol,
		name: stock.name.replace(/ PreStocks$/, ""),
		mint: stock.contract_address,
		logo: `/logos/prestocks/${file}`,
		url: stock.external_url,
		usdPrice: stock.tokenPrice,
	});
}

writeFileSync(
	output,
	`${
		JSON.stringify({ capturedAt: new Date().toISOString(), stocks }, null, "\t")
	}\n`,
);
console.log(`Captured ${stocks.length} PreStocks entries`);
