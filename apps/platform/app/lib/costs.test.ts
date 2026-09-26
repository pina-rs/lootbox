import { describe, expect, it } from "vitest";

import { boxMintBytes, creationCost, rentFor, SIGNATURE_FEE } from "./costs.js";
import type { DraftBundle } from "./schemas.js";

/** Mainnet and devnet today: 890,880 lamports for a zero-byte account. */
const RENT_ZERO = 890_880n;

describe("rent", () => {
	it("matches getMinimumBalanceForRentExemption", () => {
		expect(rentFor(0n, RENT_ZERO)).toBe(890_880n);
		expect(rentFor(165n, RENT_ZERO)).toBe(2_039_280n);
		expect(rentFor(82n, RENT_ZERO)).toBe(1_461_600n);
	});

	it("sizes the box mint like the SDK", () => {
		expect(boxMintBytes("Box", "LOOT", "https://lootbox.so/m/x.json")).toBe(
			BigInt(234 + 4 + 64 + 4 + 3 + 4 + 4 + 4 + 27 + 4),
		);
	});
});

describe("creationCost", () => {
	const bundles: DraftBundle[] = [
		{
			id: "a",
			label: "Grand",
			quantity: 1,
			assets: [{ kind: "sol", lamports: "500000000" }],
		},
		{
			id: "b",
			label: "Pile",
			quantity: 3,
			assets: [{
				kind: "token",
				mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
				amount: "10000000",
				decimals: 6,
				symbol: "USDC",
				name: "USD Coin",
				icon: null,
				issuer: null,
				tracks: null,
				category: "coin",
				usdPrice: null,
			}],
		},
	];

	it("adds prizes, rent, and fees exactly", () => {
		const cost = creationCost({
			name: "Box",
			symbol: "LOOT",
			uri: "https://lootbox.so/m/x.json",
			bundles,
			bundleBytes: 300n,
			rentForZeroBytes: RENT_ZERO,
		});
		const line = (key: string) =>
			cost.lines.find((item) => item.key === key)?.lamports;

		// mint, template, publish + (add + fund + activate) per bundle
		expect(cost.transactions).toBe(3 + 3 + 3);
		expect(line("prizes")).toBe(500_000_000n);
		expect(line("template")).toBe(rentFor(548n + 16n, RENT_ZERO));
		expect(line("bundles")).toBe(rentFor(300n, RENT_ZERO) * 2n);
		expect(line("escrow")).toBe(rentFor(165n, RENT_ZERO));
		expect(line("fees")).toBe(BigInt(cost.transactions + 1) * SIGNATURE_FEE);
		expect(cost.totalLamports).toBe(
			cost.lines.reduce((sum, item) => sum + item.lamports, 0n),
		);
	});

	it("marks Token-2022 escrow as an estimate and prices the fee extension", () => {
		const stock: DraftBundle = {
			id: "c",
			label: "Stock",
			quantity: 1,
			assets: [{
				kind: "token",
				mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
				tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
				amount: "1",
				decimals: 9,
				symbol: "OPENAI",
				name: "",
				icon: null,
				issuer: { name: "PreStocks", feeBasisPoints: 100, maximumFee: "1000" },
				tracks: "OpenAI",
				category: "stock",
				usdPrice: null,
			}],
		};
		const cost = creationCost({
			name: "Box",
			symbol: "LOOT",
			uri: "",
			bundles: [stock],
			bundleBytes: 300n,
			rentForZeroBytes: RENT_ZERO,
		});
		const escrow = cost.lines.find((item) => item.key === "escrow");

		expect(escrow?.lamports).toBe(rentFor(182n, RENT_ZERO));
		expect(escrow?.note).toMatch(/Estimate/);
	});
});
