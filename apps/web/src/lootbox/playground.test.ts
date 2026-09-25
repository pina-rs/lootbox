import { afterEach, describe, expect, it, vi } from "vitest";
import {
	assertLoopback,
	formatUnits,
	hasSavedDraft,
	initialInput,
	parseUnits,
	type Playground,
	previewInput,
	savedDraftInfo,
	searchTokens,
	validateInput,
} from "./playground.js";

afterEach(() => {
	vi.unstubAllGlobals();
	localStorage.clear();
});

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
	it("keeps expired and unreadable funding drafts available for recovery", () => {
		const expired = { ...initialInput, opensAt: "2020-01-01T00:00" };
		expect(() => validateInput(expired)).toThrow(/at least one minute/);
		expect(() => validateInput(expired, { allowExpiredReveal: true }))
			.not.toThrow();
		expect(previewInput(expired, { allowExpiredReveal: true })).not.toBeNull();

		const sandbox = {
			config: { instanceId: "resume-test" },
		} as unknown as Playground;
		const key = "lootbox:draft:resume-test";
		localStorage.setItem(
			key,
			JSON.stringify({
				format: "treasury",
				mode: "create",
				id: "1",
				mint: [1],
				rewards: expired.rows.map((row) => row.assets.map(() => null)),
				input: expired,
			}),
		);
		expect(hasSavedDraft(sandbox)).toBe(true);
		expect(savedDraftInfo(sandbox)?.input.opensAt).toBe(expired.opensAt);

		localStorage.setItem(key, "not-json-but-may-contain-recovery-seeds");
		expect(hasSavedDraft(sandbox)).toBe(true);
		expect(savedDraftInfo(sandbox)).toBeNull();
		expect(localStorage.getItem(key)).toBe(
			"not-json-but-may-contain-recovery-seeds",
		);
	});
	it("fails closed when a PrizePool manifest changes tree, count, or identity", () => {
		const tree = "7RmhTYBS7Uv9PSNmJGX6tM8BjSn7HVbGdVgV6EtCNKLm";
		const item = {
			asset: "LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E",
			name: "Pinned leaf",
			tree,
			treeConfig: tree,
			root: tree,
			dataHash: "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK",
			creatorHash: "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
			nonce: "7",
			leafIndex: 7,
			proof: [],
			metadata: "AQ==",
		};
		const pool = {
			id: "pool",
			kind: "prizePool" as const,
			label: "Two compressed NFTs",
			amount: "1",
			source: "das" as const,
			decimals: 0,
			mint: tree,
			poolItems: [item, {
				...item,
				asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				nonce: "8",
				leafIndex: 8,
			}],
		};
		const input = {
			...initialInput,
			rows: [{ label: "Pool", quantity: "2", assets: [pool] }],
		};
		expect(() => validateInput(input)).not.toThrow();
		expect(() =>
			validateInput({
				...input,
				rows: [{ ...input.rows[0]!, quantity: "1" }],
			})
		).toThrow(/copies must exactly match/);
		expect(() =>
			validateInput({
				...input,
				rows: [{
					...input.rows[0]!,
					assets: [{ ...pool, poolItems: [item, item] }],
				}],
			})
		).toThrow(/distinct immutable NFTs/);
		expect(() =>
			validateInput({
				...input,
				rows: [{
					...input.rows[0]!,
					assets: [{
						...pool,
						poolItems: [item, {
							...item,
							asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
							tree: "So11111111111111111111111111111111111111112",
						}],
					}],
				}],
			})
		).toThrow(/one tree/);
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
