import { grossForNetTransfer } from "@pina-rs/lootbox";
import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
	describeChance,
	draftAssetToPrize,
	escrowLines,
	formatUnits,
	oddsRows,
	parseUnits,
} from "./plan.js";
import type { DraftBundle } from "./schemas.js";

describe("units", () => {
	it("parses and formats decimals without floating point", () => {
		expect(parseUnits("1.25", 9)).toBe(1_250_000_000n);
		expect(parseUnits("0.000000001", 9)).toBe(1n);
		expect(parseUnits("0.0000000001", 9)).toBeNull();
		expect(parseUnits("1e3", 9)).toBeNull();
		expect(formatUnits(1_250_000_000n, 9)).toBe("1.25");
		expect(formatUnits(12_345_000_000n, 6)).toBe("12,345");
	});
});

describe("odds", () => {
	it("treats every copy as one equal ticket", () => {
		const rows = oddsRows([
			{ key: "a", label: "A", copies: 1n },
			{ key: "b", label: "B", copies: 3n },
		]);

		expect(rows.map((row) => row.percent)).toEqual([25, 75]);
		expect(oddsRows([{ key: "a", label: "A", copies: 0n }])[0]?.percent).toBe(
			0,
		);
	});

	it("uses 1-in-N for rare prizes", () => {
		expect(describeChance(1n, 4n)).toBe("25%");
		expect(describeChance(1n, 100n)).toBe("1 in 100");
		expect(describeChance(3n, 1_000n)).toBe("1 in 333.3");
		expect(describeChance(0n, 10n)).toBe("0%");
	});
});

describe("draft to SDK", () => {
	it("maps each prize kind", () => {
		const metadata = address("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

		expect(draftAssetToPrize({ kind: "sol", lamports: "5" }, () => metadata))
			.toEqual({ kind: "sol", lamports: 5n });
		expect(
			draftAssetToPrize({
				kind: "nft",
				mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				standard: "tokenMetadata",
				name: "N",
				image: null,
			}, () => metadata),
		).toMatchObject({ kind: "nft", metadata });
	});

	it("grosses up issuer-stock escrow once per bundle", () => {
		const bundle: DraftBundle = {
			id: "s",
			label: "Stock",
			quantity: 7,
			assets: [{
				kind: "token",
				mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
				tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
				amount: "47900000",
				decimals: 9,
				symbol: "OPENAI",
				name: "",
				icon: null,
				issuer: {
					name: "PreStocks",
					feeBasisPoints: 100,
					maximumFee: "1000000000",
				},
				tracks: "OpenAI",
				category: "stock",
				usdPrice: null,
			}],
		};
		const [line] = escrowLines([bundle]);
		const net = 47_900_000n * 7n;

		expect(line?.net).toBe(net);
		expect(line?.gross).toBe(
			grossForNetTransfer(net, {
				basisPoints: 100,
				maximumFee: 1_000_000_000n,
			}),
		);
		expect(line?.issuerFee).toBe((line?.gross ?? 0n) - net);
		expect(line?.issuerFee).toBeGreaterThan(0n);
	});
});
