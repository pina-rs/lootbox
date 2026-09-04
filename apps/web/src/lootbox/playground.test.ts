import { afterEach, describe, expect, it, vi } from "vitest";
import {
	assertLoopback,
	formatUnits,
	initialInput,
	parseUnits,
	searchTokens,
	validateInput,
} from "./playground.js";

afterEach(() => vi.unstubAllGlobals());

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
		expect(() => validateInput({ ...initialInput, opensAt: "" })).toThrow(
			/future reveal date/,
		);
		expect(() =>
			validateInput({ ...initialInput, opensAt: "2020-01-01T00:00" })
		).toThrow(/at least one minute/);
		expect(() =>
			validateInput({
				...initialInput,
				rows: [{
					label: "Impossible copies",
					quantity: "2",
					assets: [{
						...initialInput.rows[2]!.assets[1]!,
					}],
				}],
			})
		).toThrow(/one copy/);
		expect(() => validateInput({ ...initialInput, rows: [] })).toThrow();
		expect(() => validateInput({ ...initialInput, name: "🎁".repeat(10) }))
			.toThrow(/UTF-8/);
	});
	it("hides catalog tokens that the amount parser cannot represent", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						source: "live",
						items: [
							{
								id: "nine",
								name: "Supported",
								symbol: "NINE",
								decimals: 9,
								verified: true,
								tokenProgram: "classic",
							},
							{
								id: "ten",
								name: "Unsupported",
								symbol: "TEN",
								decimals: 10,
								verified: true,
								tokenProgram: "classic",
							},
							{
								id: "missing",
								name: "Malformed",
								symbol: "NONE",
								verified: false,
								tokenProgram: "classic",
							},
						],
					}),
					{ status: 200 },
				)
			),
		);

		const response = await searchTokens("token");
		expect(response.items.map(({ symbol }) => symbol)).toEqual(["NINE"]);
	});
});
