import type { TemplateState } from "@pina-rs/lootbox-generated";
import { type Address, address } from "@solana/kit";
import { templateInventory } from "./templates.js";

const BASIS_POINTS = 10_000n;
const WRAPPED_SOL = address("So11111111111111111111111111111111111111112");

export type MarketLockReadiness = Readonly<{
	canLock: boolean;
	mintRequired: bigint;
	fixedSupply: bigint;
	reasons: readonly string[];
}>;

/** Explain every condition needed for an irreversible market lock. */
export function marketLockReadiness(
	state: TemplateState,
	mintSupply: bigint,
	chainTime: bigint,
): MarketLockReadiness {
	const reasons: string[] = [];
	const mintRequired = state.totalBundles > state.totalMinted
		? state.totalBundles - state.totalMinted
		: 0n;

	if (state.status !== 1) reasons.push("the treasury must be live");
	if (state.lockedAt !== 0n) reasons.push("the treasury is already locked");
	if (state.bundleCount === 0 || state.totalBundles === 0n) {
		reasons.push("at least one active prize-bundle copy is required");
	}
	if (state.opensAt <= chainTime) {
		reasons.push("the reveal date must still be in the future");
	}
	if (state.remainingBundles !== state.totalBundles) {
		reasons.push("no prize-bundle copy may be drawn before locking");
	}
	if (
		state.pendingOpenings !== 0n || state.nextRequest !== 0n ||
		state.nextAllocation !== 0n
	) reasons.push("there must be no opening history before locking");
	if (state.totalMinted > state.totalBundles) {
		reasons.push("lifetime issuance exceeds prize-bundle copies");
	}
	if (mintSupply !== state.totalMinted) {
		reasons.push("an issued box was burned outside the opening flow");
	}

	return Object.freeze({
		canLock: reasons.length === 0,
		mintRequired,
		fixedSupply: state.totalBundles,
		reasons: Object.freeze(reasons),
	});
}

export type BundleValuation = Readonly<{
	index: number;
	/** Estimated value in one consistent quote currency's base units. */
	quoteValue: bigint;
}>;

export type ExpectedValue = Readonly<{
	complete: boolean;
	knownValue: bigint;
	remainder: bigint;
	remainingCopies: bigint;
	unknownBundleIndexes: readonly number[];
}>;

/** Compute transparent remaining-inventory EV without floating-point loss. */
export function remainingExpectedValue(
	state: TemplateState,
	valuations: readonly BundleValuation[],
): ExpectedValue {
	const inventory = templateInventory(state);
	const values = new Map<number, bigint>();

	for (const valuation of valuations) {
		if (
			!Number.isSafeInteger(valuation.index) || valuation.index < 0 ||
			valuation.index >= state.bundleCount || valuation.quoteValue < 0n
		) throw new RangeError("invalid bundle valuation");
		values.set(valuation.index, valuation.quoteValue);
	}

	let weightedValue = 0n;
	let remainingCopies = 0n;
	const unknownBundleIndexes: number[] = [];

	for (const outcome of inventory) {
		remainingCopies += outcome.remaining;
		const value = values.get(outcome.index);

		if (value === undefined) {
			if (outcome.remaining > 0n) unknownBundleIndexes.push(outcome.index);
			continue;
		}

		weightedValue += value * outcome.remaining;
	}

	if (remainingCopies === 0n) {
		return Object.freeze({
			complete: unknownBundleIndexes.length === 0,
			knownValue: 0n,
			remainder: 0n,
			remainingCopies,
			unknownBundleIndexes: Object.freeze(unknownBundleIndexes),
		});
	}

	return Object.freeze({
		complete: unknownBundleIndexes.length === 0,
		knownValue: weightedValue / remainingCopies,
		remainder: weightedValue % remainingCopies,
		remainingCopies,
		unknownBundleIndexes: Object.freeze(unknownBundleIndexes),
	});
}

export type ConstantProductQuote = Readonly<{
	input: bigint;
	output: bigint;
	fee: bigint;
	minimumUnitSatisfied: boolean;
}>;

/** Quote an integer-only box trade against constant-product reserves. */
export function quoteBoxTrade(
	input: Readonly<{
		inputAmount: bigint;
		inputReserve: bigint;
		outputReserve: bigint;
		feeBps?: number;
		boxIsOutput: boolean;
	}>,
): ConstantProductQuote {
	const feeBps = BigInt(input.feeBps ?? 25);
	if (
		input.inputAmount <= 0n || input.inputReserve <= 0n ||
		input.outputReserve <= 0n || feeBps < 0n || feeBps >= BASIS_POINTS
	) throw new RangeError("invalid constant-product quote inputs");

	const afterFee = input.inputAmount * (BASIS_POINTS - feeBps);
	const denominator = input.inputReserve * BASIS_POINTS + afterFee;
	const output = afterFee * input.outputReserve / denominator;
	const fee = input.inputAmount - afterFee / BASIS_POINTS;

	return Object.freeze({
		input: input.inputAmount,
		output,
		fee,
		minimumUnitSatisfied: !input.boxIsOutput || output >= 1n,
	});
}

export type RaydiumCpmmMarketManifest = Readonly<{
	venue: "raydium-cpmm";
	network: "mainnet-beta";
	boxMint: Address;
	boxDecimals: 0;
	quoteMint: Address;
	fixedSupply: bigint;
	revealAt: bigint;
	lockedAt: bigint;
	initialBoxLiquidity: bigint;
	initialQuoteLiquidity: bigint;
}>;

/** Build the checked parameters needed by a production Raydium CPMM adapter.
 * Pool creation is intentionally separate from treasury locking: it requires a
 * production wallet, mainnet RPC, Raydium SDK, and quote inventory.
 */
export function createRaydiumCpmmMarketManifest(
	state: TemplateState,
	input: Readonly<{
		initialBoxLiquidity: bigint;
		initialQuoteLiquidity: bigint;
		quoteMint?: Address;
	}>,
): RaydiumCpmmMarketManifest {
	if (state.lockedAt <= 0n) {
		throw new Error("lock the treasury before creating a market");
	}
	if (
		state.totalMinted !== state.totalBundles ||
		input.initialBoxLiquidity <= 0n ||
		input.initialBoxLiquidity > state.totalBundles ||
		input.initialQuoteLiquidity <= 0n
	) {
		throw new RangeError(
			"market liquidity must be positive and cannot exceed fixed box supply",
		);
	}

	return Object.freeze({
		venue: "raydium-cpmm",
		network: "mainnet-beta",
		boxMint: state.boxMint,
		boxDecimals: 0,
		quoteMint: input.quoteMint ?? WRAPPED_SOL,
		fixedSupply: state.totalBundles,
		revealAt: state.opensAt,
		lockedAt: state.lockedAt,
		initialBoxLiquidity: input.initialBoxLiquidity,
		initialQuoteLiquidity: input.initialQuoteLiquidity,
	});
}

/** JSON-safe representation for deployment tooling and wallet adapters. */
export function serializeMarketManifest(
	manifest: RaydiumCpmmMarketManifest,
): string {
	return JSON.stringify(
		manifest,
		(_key, value: unknown) =>
			typeof value === "bigint" ? value.toString() : value,
		2,
	);
}
