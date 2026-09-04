import { describe, expect, it } from "vitest";
import {
	assertLoopback,
	formatUnits,
	initialInput,
	parseUnits,
	validateInput,
} from "./playground.js";

describe("test wallet and creator safety", () => {
	it("refuses nonlocal RPCs, credentials, and lookalike hosts", () => {
		for (
			const url of [
				"https://api.mainnet-beta.solana.com",
				"http://localhost.example.com",
				"http://user:password@127.0.0.1",
				"https://localhost:8899",
			]
		) expect(() => assertLoopback(url)).toThrow();
		expect(() => assertLoopback("http://127.0.0.1:8899")).not.toThrow();
	});
	it("keeps decimal token amounts exact without floating point rounding", () => {
		expect(parseUnits("0.000000001", 9)).toBe(1n);
		expect(formatUnits(100_000_001n)).toBe("0.100000001");
		expect(parseUnits("18446744073709551615", 0)).toBe((1n << 64n) - 1n);
		for (
			const value of [
				"1e9",
				"-1",
				"NaN",
				"0.0000000001",
				"18446744073709551616",
			]
		) expect(() => parseUnits(value, 9)).toThrow();
	});
	it("validates finite inventory and one-copy NFT bundles", () => {
		expect(() => validateInput(initialInput)).not.toThrow();
		expect(() =>
			validateInput({
				...initialInput,
				rows: [{
					kind: "nft",
					amount: "1",
					quantity: "2",
					weight: "1",
					nftCount: "2",
				}],
			})
		).toThrow(/one copy/);
		expect(() => validateInput({ ...initialInput, rows: [] })).toThrow();
		expect(() => validateInput({ ...initialInput, name: "🎁".repeat(10) }))
			.toThrow(/UTF-8/);
	});
});
