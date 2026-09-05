import type { TemplateState } from "@pina-rs/lootbox-generated";
import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
	createRaydiumCpmmMarketManifest,
	marketLockReadiness,
	quoteBoxTrade,
	remainingExpectedValue,
	serializeMarketManifest,
} from "./market.js";

function inventory(...quantities: bigint[]): Uint8Array {
	const bytes = new Uint8Array(256 * 8);
	const view = new DataView(bytes.buffer);
	quantities.forEach((quantity, index) =>
		view.setBigUint64(index * 8, quantity, true)
	);
	return bytes;
}

function state(patch: Partial<TemplateState> = {}): TemplateState {
	return {
		authority: address("11111111111111111111111111111111"),
		boxMint: address("11111111111111111111111111111111"),
		oracleProgram: address("11111111111111111111111111111111"),
		oracleQueue: address("11111111111111111111111111111111"),
		id: 1n,
		opensAt: 2_000n,
		lockedAt: 0n,
		totalBundles: 3n,
		totalMinted: 0n,
		remainingBundles: 3n,
		pendingOpenings: 0n,
		nextRequest: 0n,
		nextAllocation: 0n,
		revision: 2n,
		manifestAccumulator: new Uint8Array(32),
		manifestHash: new Uint8Array(32),
		settlementBountyLamports: 0n,
		resultReceiptRentLamports: 0n,
		remainingResultReceipts: 0n,
		remainingSettlementBounties: 0n,
		remaining: inventory(2n, 1n),
		name: new Uint8Array(32),
		uri: new Uint8Array(200),
		bundleCount: 2,
		status: 1,
		resultReceiptsEnabled: false,
		bump: 1,
		serviceVaultBump: 0,
		...patch,
	} as TemplateState;
}

describe("market lock", () => {
	it("reports the exact mint needed for a pristine treasury", () => {
		expect(marketLockReadiness(state(), 0n, 1_000n)).toEqual({
			canLock: true,
			mintRequired: 3n,
			fixedSupply: 3n,
			reasons: [],
		});
	});

	it("rejects a burned or already-opened pre-lock series", () => {
		const readiness = marketLockReadiness(
			state({ totalMinted: 3n, remainingBundles: 2n }),
			2n,
			1_000n,
		);
		expect(readiness.canLock).toBe(false);
		expect(readiness.reasons).toContain(
			"no prize-bundle copy may be drawn before locking",
		);
		expect(readiness.reasons).toContain(
			"an issued box was burned outside the opening flow",
		);
	});
});

describe("market transparency", () => {
	it("computes remaining expected value exactly", () => {
		expect(remainingExpectedValue(state(), [
			{ index: 0, quoteValue: 100n },
			{ index: 1, quoteValue: 1_000n },
		])).toEqual({
			complete: true,
			knownValue: 400n,
			remainder: 0n,
			remainingCopies: 3n,
			unknownBundleIndexes: [],
		});
	});

	it("marks partial EV when a live bundle has no valuation", () => {
		const value = remainingExpectedValue(state(), [
			{ index: 0, quoteValue: 100n },
		]);
		expect(value.complete).toBe(false);
		expect(value.unknownBundleIndexes).toEqual([1]);
	});

	it("never reports a fractional box as executable output", () => {
		const quote = quoteBoxTrade({
			inputAmount: 1n,
			inputReserve: 1_000_000n,
			outputReserve: 10n,
			boxIsOutput: true,
		});
		expect(quote.output).toBe(0n);
		expect(quote.minimumUnitSatisfied).toBe(false);
	});

	it("exports a zero-decimal Raydium CPMM deployment manifest", () => {
		const manifest = createRaydiumCpmmMarketManifest(
			state({ lockedAt: 500n, totalMinted: 3n }),
			{
				initialBoxLiquidity: 2n,
				initialQuoteLiquidity: 2_000_000_000n,
			},
		);
		expect(manifest.boxDecimals).toBe(0);
		expect(manifest.fixedSupply).toBe(3n);
		expect(JSON.parse(serializeMarketManifest(manifest))).toMatchObject({
			venue: "raydium-cpmm",
			fixedSupply: "3",
			initialBoxLiquidity: "2",
		});
	});
});
