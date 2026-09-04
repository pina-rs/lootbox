import type { TemplateState } from "@pina-rs/lootbox-generated";
import { type Address, address, type ReadonlyUint8Array } from "@solana/kit";

const U64_MAX = (1n << 64n) - 1n;
const WEIGHT_MAX = 0xffff_ffffn;
const ZERO_ADDRESS = address("11111111111111111111111111111111");
const WRAPPED_SOL = address("So11111111111111111111111111111111111111112");

export type PrizeAsset =
	| Readonly<{ kind: "sol"; lamports: bigint }>
	| Readonly<{ kind: "token"; mint: Address; amount: bigint }>
	| Readonly<{ kind: "nft"; mint: Address }>;

export type PrizeBundleInput = Readonly<{
	label: string;
	quantity: bigint;
	weight: bigint;
	assets: readonly PrizeAsset[];
}>;

export type PrizeBundlePlan =
	& PrizeBundleInput
	& Readonly<{
		/** Exact initial odds. Current odds change as complete bundles are won. */
		odds: Readonly<{ numerator: bigint; denominator: bigint }>;
		probabilityPercent: number;
	}>;

export type TreasuryRequirement = Readonly<{
	/** Null is native SOL, otherwise the classic SPL mint address. */
	mint: Address | null;
	amount: bigint;
}>;

export type TemplatePlan = Readonly<{
	name: string;
	uri: string;
	opensAt: bigint;
	maxSupply: bigint;
	bundles: readonly PrizeBundlePlan[];
	totalWeight: bigint;
	totalBundles: bigint;
	treasury: readonly TreasuryRequirement[];
}>;

function u64(value: bigint, field: string): bigint {
	if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
		throw new RangeError(`${field} must be a bigint in the u64 range`);
	}

	return value;
}

/** Encode a bounded on-chain UTF-8 field without silently truncating it. */
export function encodeTemplateText(value: string, length: number): Uint8Array {
	if (!Number.isSafeInteger(length) || length < 0 || length > 200) {
		throw new RangeError("template text capacity must be between 0 and 200");
	}
	if (
		Array.from(value).some((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code < 32 || (code >= 127 && code <= 159);
		})
	) {
		throw new RangeError("template text cannot contain control characters");
	}
	const encoded = new TextEncoder().encode(value);
	if (encoded.length > length) {
		throw new RangeError(`template text exceeds ${length} UTF-8 bytes`);
	}
	const bytes = new Uint8Array(length);
	bytes.set(encoded);

	return bytes;
}

export function decodeTemplateText(value: ReadonlyUint8Array): string {
	const bytes = Uint8Array.from(value);
	const zero = bytes.indexOf(0);

	return new TextDecoder("utf-8", { fatal: true }).decode(
		zero < 0 ? bytes : bytes.subarray(0, zero),
	);
}

/** Validate a finite pool and total all collateral before building transactions.
 * Mint supply/authorities and actual escrow balances still require chain checks.
 */
export function createTemplatePlan(
	input: Readonly<{
		name: string;
		uri?: string;
		opensAt?: bigint;
		maxSupply?: bigint;
		bundles: readonly PrizeBundleInput[];
	}>,
): TemplatePlan {
	const uri = input.uri ?? "";
	const opensAt = input.opensAt ?? 0n;
	if (input.name.trim().length === 0) {
		throw new RangeError("template name is required");
	}
	encodeTemplateText(input.name, 32);
	encodeTemplateText(uri, 200);
	if (
		typeof opensAt !== "bigint" || opensAt < 0n || opensAt > (1n << 63n) - 1n
	) {
		throw new RangeError("opensAt must be a nonnegative i64 Unix timestamp");
	}
	if (input.bundles.length < 1 || input.bundles.length > 8) {
		throw new RangeError(
			"a template needs between one and eight prize bundles",
		);
	}
	const treasury = new Map<Address | null, bigint>();
	const nftMints = new Set<Address>();
	let totalBundles = 0n;
	let totalWeight = 0n;
	const normalized = input.bundles.map((bundle) => {
		const quantity = u64(bundle.quantity, "bundle quantity");
		const weight = u64(bundle.weight, "bundle weight");
		if (
			quantity === 0n || weight === 0n || bundle.assets.length < 1 ||
			bundle.assets.length > 4
		) {
			throw new RangeError(
				"bundles need positive quantity and weight, and one to four assets",
			);
		}
		totalBundles = u64(totalBundles + quantity, "total bundles");
		totalWeight = u64(
			totalWeight + weight * quantity,
			"total inventory weight",
		);
		const seen = new Set<Address | null>();
		const assets = bundle.assets.map((asset): PrizeAsset => {
			const mint = asset.kind === "sol" ? null : address(asset.mint);
			const amount = u64(
				asset.kind === "sol"
					? asset.lamports
					: asset.kind === "nft"
					? 1n
					: asset.amount,
				"prize amount",
			);
			if (
				amount === 0n || seen.has(mint) || mint === ZERO_ADDRESS ||
				mint === WRAPPED_SOL
			) {
				throw new RangeError(
					"assets must be positive and distinct within a bundle; use native SOL, not wrapped SOL",
				);
			}
			if (asset.kind === "nft") {
				if (quantity !== 1n || nftMints.has(asset.mint)) {
					throw new RangeError("each unique NFT can fund only one bundle");
				}
				nftMints.add(asset.mint);
			}
			seen.add(mint);
			const deposit = u64(amount * quantity, "prize collateral");
			treasury.set(
				mint,
				u64((treasury.get(mint) ?? 0n) + deposit, "total asset collateral"),
			);

			return Object.freeze({ ...asset });
		});

		return { ...bundle, assets: Object.freeze(assets) };
	});
	if (totalWeight > WEIGHT_MAX) {
		throw new RangeError("total inventory weight exceeds u32::MAX");
	}
	const maxSupply = u64(input.maxSupply ?? totalBundles, "maxSupply");
	if (maxSupply === 0n || maxSupply > totalBundles) {
		throw new RangeError(
			"maxSupply must be between one and the funded bundle count",
		);
	}

	return Object.freeze({
		name: input.name,
		uri,
		opensAt,
		maxSupply,
		totalWeight,
		totalBundles,
		bundles: Object.freeze(normalized.map((bundle) =>
			Object.freeze({
				...bundle,
				odds: Object.freeze({
					numerator: bundle.weight * bundle.quantity,
					denominator: totalWeight,
				}),
				probabilityPercent:
					Number(bundle.weight * bundle.quantity * 1_000_000n / totalWeight) /
					10_000,
			})
		)),
		treasury: Object.freeze(
			Array.from(treasury, ([mint, amount]) => Object.freeze({ mint, amount })),
		),
	});
}

export type InventoryOutcome = Readonly<
	{
		index: number;
		weight: bigint;
		remaining: bigint;
		probabilityPercent: number;
	}
>;

/** Read live odds. A depleted jackpot stays visible with zero probability. */
export function templateInventory(
	state: Pick<TemplateState, "weights" | "remaining" | "outcomeCount">,
): readonly InventoryOutcome[] {
	if (
		state.weights.length !== 64 || state.remaining.length !== 64 ||
		!Number.isInteger(state.outcomeCount) || state.outcomeCount < 0 ||
		state.outcomeCount > 8
	) {
		throw new RangeError("invalid on-chain inventory table");
	}
	const weights = Uint8Array.from(state.weights);
	const remaining = Uint8Array.from(state.remaining);
	const outcomes = Array.from({ length: state.outcomeCount }, (_, index) => ({
		index,
		weight: new DataView(weights.buffer).getBigUint64(index * 8, true),
		remaining: new DataView(remaining.buffer).getBigUint64(index * 8, true),
	}));
	const total = outcomes.reduce(
		(sum, outcome) => sum + outcome.weight * outcome.remaining,
		0n,
	);
	if (total > WEIGHT_MAX) throw new RangeError("invalid inventory weight");

	return Object.freeze(outcomes.map((outcome) =>
		Object.freeze({
			...outcome,
			probabilityPercent: total === 0n
				? 0
				: Number(outcome.weight * outcome.remaining * 1_000_000n / total) /
					10_000,
		})
	));
}

/** Conservative issuance preview; the program rechecks this at execution. */
export function templateMintCapacity(
	state: TemplateState,
	mintSupply: bigint,
): bigint {
	u64(mintSupply, "mint supply");
	if (
		!state.sealed || state.retired ||
		templateInventory(state).some((outcome) => outcome.remaining === 0n)
	) return 0n;
	const inventoryCapacity = state.remainingBundles - mintSupply -
		state.pendingOpenings;
	const supplyCapacity = state.maxSupply - state.totalMinted;
	const capacity = inventoryCapacity < supplyCapacity
		? inventoryCapacity
		: supplyCapacity;

	return capacity > 0n ? capacity : 0n;
}
