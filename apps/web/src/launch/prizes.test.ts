import { describe, expect, it } from "vitest";

import {
	assignTiers,
	buildManifest,
	type BundleSummary,
	EMPTY_SOL_LAMPORTS,
	formatOdds,
	formatUnits,
	isEmptyBundle,
	plannedLineup,
	rowContents,
	rowTitle,
	snapshotPriceBook,
} from "./prizes.js";

const OPENAI = "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF";
const SPACEX = "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh";
const book = snapshotPriceBook();

const bundles: BundleSummary[] = [
	{
		index: 0,
		quantity: 1n,
		assets: [{ kind: "token", mint: OPENAI, amount: 47_900_000n, decimals: 9 }],
	},
	{
		index: 1,
		quantity: 2n,
		assets: [{
			kind: "token2022",
			mint: SPACEX,
			amount: 217_000_000n,
			decimals: 9,
		}],
	},
];

describe("prize manifest", () => {
	it("computes odds from remaining inventory, not original copies", () => {
		const fresh = buildManifest(bundles, [1n, 2n], book);
		const drawn = buildManifest(bundles, [0n, 2n], book);

		expect(fresh.map((row) => row.oddsPercent)).toEqual([33.3333, 66.6666]);
		expect(drawn.map((row) => row.oddsPercent)).toEqual([0, 100]);
		expect(drawn[0]?.remaining).toBe(0n);
	});

	it("values stock lines and marks the most valuable bundle as headline", () => {
		const rows = buildManifest(bundles, [1n, 2n], book);
		const openai = book.stocks.get(OPENAI);

		expect(rows[0]?.usdValue).toBeCloseTo(0.0479 * (openai?.usdPrice ?? 0));
		expect(rows.map((row) => row.tier)).toEqual(["headline", "standard"]);
		expect(rowTitle(rows[0] ?? { lines: [] })).toBe("0.0479 OPENAI");
	});

	it("falls back to rarity for unpriced prizes and never crowns ties", () => {
		expect(
			assignTiers([
				{ usdValue: null, copies: 1n, empty: false },
				{ usdValue: null, copies: 5n, empty: false },
			]),
		).toEqual(["headline", "standard"]);
		expect(
			assignTiers([
				{ usdValue: 20, copies: 1n, empty: false },
				{ usdValue: 20, copies: 1n, empty: false },
			]),
		).toEqual(["standard", "standard"]);
	});

	it("classifies a badge plus pocket-change SOL as the empty tier", () => {
		const badge = "Badge111111111111111111111111111111111111111";
		const rows = buildManifest(
			[
				...bundles,
				{
					index: 2,
					quantity: 13n,
					assets: [
						{ kind: "mintBadge", mint: badge, amount: 1n, decimals: 0 },
						{
							kind: "sol",
							mint: "11111111111111111111111111111111",
							amount: 1_000_000n,
							decimals: 9,
						},
					],
				},
			],
			[1n, 2n, 13n],
			book,
		);
		const empty = rows[2];

		expect(rows.map((row) => row.tier)).toEqual([
			"headline",
			"standard",
			"empty",
		]);
		expect(empty?.oddsPercent).toBe(81.25);
		expect(rowTitle(empty ?? { lines: [] })).toBe("Empty box");
		expect(rowContents(empty ?? { lines: [] })).toBe(
			"Empty Box badge + 0.001 SOL",
		);
	});

	it("keeps real SOL prizes out of the empty tier", () => {
		const sol = (lamports: bigint) => ({
			kind: "sol" as const,
			lamports,
		});

		expect(isEmptyBundle([sol(EMPTY_SOL_LAMPORTS)])).toBe(true);
		expect(isEmptyBundle([sol(EMPTY_SOL_LAMPORTS + 1n)])).toBe(false);
		expect(isEmptyBundle([])).toBe(false);
		expect(
			assignTiers([
				{ usdValue: 10, copies: 1n, empty: false },
				{ usdValue: null, copies: 13n, empty: true },
			]),
		).toEqual(["standard", "empty"]);
	});

	it("labels SOL and unknown tokens without inventing a value", () => {
		const rows = buildManifest(
			[{
				index: 0,
				quantity: 1n,
				assets: [{
					kind: "sol",
					mint: "11111111111111111111111111111111",
					amount: 100_000_000n,
					decimals: 9,
				}, {
					kind: "token",
					mint: "So11111111111111111111111111111111111111112",
					amount: 5n,
					decimals: 0,
				}],
			}],
			[1n],
			book,
		);

		expect(rows[0]?.usdValue).toBeNull();
		expect(rowTitle(rows[0] ?? { lines: [] })).toBe("0.1 SOL + 5 tokens");
	});

	it("names unknown tokens from their on-mint metadata", () => {
		const mint = "So11111111111111111111111111111111111111112";
		const rows = buildManifest(
			[{
				index: 0,
				quantity: 1n,
				assets: [{ kind: "token2022", mint, amount: 25n, decimals: 1 }],
			}],
			[1n],
			book,
			new Map([[mint, { name: "Test SpaceX", symbol: "tSPACEX" }]]),
		);

		expect(rowTitle(rows[0] ?? { lines: [] })).toBe("2.5 tSPACEX");
	});

	it("formats units and odds precisely", () => {
		expect(formatUnits(1_500_000_000n, 9)).toBe("1.5");
		expect(formatUnits(1_234_000n, 0)).toBe("1,234,000");
		expect(formatOdds(0)).toBe("0%");
		expect(formatOdds(0.01)).toBe("<0.1%");
		expect(formatOdds(33.3333)).toBe("33.3%");
		expect(formatOdds(100)).toBe("100%");
	});

	it("plans a £200 lineup from the catalog", () => {
		const lineup = plannedLineup(book);

		expect(lineup.reduce((sum, slice) => sum + slice.gbp, 0)).toBe(200);
		expect(lineup.filter((slice) => slice.gbp === 50)).toHaveLength(2);
	});
});

describe("price book", () => {
	it("serves the bundled snapshot with base-path logos and its capture date", () => {
		expect(Number.isNaN(Date.parse(book.capturedAt))).toBe(false);
		expect(book.stocks.get(OPENAI)?.logo).toBe("/logos/prestocks/openai.png");
		expect(book.stocks.size).toBe(8);
	});
});
