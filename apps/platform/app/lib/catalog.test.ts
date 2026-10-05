import { describe, expect, it } from "vitest";

import backed from "./.server/fixtures/backed.json";
import jupiter from "./.server/fixtures/jupiter-search.json";
import prestocks from "./.server/fixtures/prestocks.json";
import {
	type CatalogToken,
	compactUsd,
	displayName,
	fromBacked,
	fromJupiter,
	fromPreStocks,
	rankTokens,
	tokenWarnings,
} from "./catalog.js";

const present = <T>(value: T | null): value is T => value !== null;
const coins = jupiter.map(fromJupiter).filter(present);
const stocks = [
	...prestocks.map(fromPreStocks).filter(present),
	...backed.nodes.map(fromBacked).filter(present),
];

describe("catalog mapping", () => {
	it("normalises recorded Jupiter results", () => {
		const bonk = coins.find((token) => token.symbol === "Bonk");

		expect(bonk).toMatchObject({
			mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6XKj7D3WpqkDmzPK",
			decimals: 5,
			category: "coin",
			verified: true,
			usdPrice: 0.0000213,
			volume24h: 9_120_000 + 8_870_000,
		});
		expect(fromJupiter({ id: "nope", name: "x", symbol: "x", decimals: 6 }))
			.toBeNull();
	});

	it("files xStocks from Jupiter under stocks", () => {
		const xerox = coins.find((token) => token.symbol === "XRXx");

		expect(xerox).toMatchObject({
			category: "stock",
			issuer: "xStocks",
			tracks: "XRX",
		});
		expect(xerox && displayName(xerox)).toBe("xStocks tracking XRX");
	});

	it("names PreStocks by what they track, never as shares, without logos", () => {
		const openai = stocks.find((token) => token.symbol === "OPENAI");

		expect(openai).toMatchObject({
			issuer: "PreStocks",
			tracks: "OpenAI",
			icon: null,
		});
		expect(openai && displayName(openai)).toBe(
			"PreStocks tokens tracking OpenAI",
		);
		expect(stocks.some((token) => token.issuer === "xStocks")).toBe(true);
	});
});

describe("ranking", () => {
	it("puts the exact ticker first and trusted, liquid tokens above look-alikes", () => {
		const ranked = rankTokens(coins, "bonk");

		expect(ranked.map((token) => token.symbol)).toEqual(["Bonk", "BONKM"]);
	});

	it("matches mints exactly and removes duplicates", () => {
		const bonk = coins[0] as CatalogToken;

		expect(rankTokens([...coins, bonk], bonk.mint)).toHaveLength(1);
	});

	it("warns about unverified, thin, and inorganic tokens", () => {
		const lookalike = coins.find((token) =>
			token.symbol === "BONKM"
		) as CatalogToken;

		expect(tokenWarnings(lookalike)).toEqual([
			"Unverified",
			"Low liquidity",
			"Little organic trading",
		]);
		expect(tokenWarnings(coins[0] as CatalogToken)).toEqual([]);
	});

	it("formats compact prices", () => {
		expect(compactUsd(18_420_000)).toBe("$18.4M");
		expect(compactUsd(0.84)).toBe("$0.840");
		expect(compactUsd(152.4)).toBe("$152.40");
		expect(compactUsd(null)).toBe("—");
	});
});
