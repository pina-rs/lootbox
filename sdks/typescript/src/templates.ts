import type { TemplateState } from "@pina-rs/lootbox-generated";
import {
	type AccountMeta,
	type Address,
	address,
	type ReadonlyUint8Array,
} from "@solana/kit";

const U64_MAX = (1n << 64n) - 1n;
export const MAX_TEMPLATE_BUNDLES = 256;
const MAX_TOTAL_TICKETS = 0xffff_ffffn;
const ZERO_ADDRESS = address("11111111111111111111111111111111");
const WRAPPED_SOL = address("So11111111111111111111111111111111111111112");

export type CompressedNftProof = Readonly<{
	root: ReadonlyUint8Array;
	dataHash: ReadonlyUint8Array;
	creatorHash: ReadonlyUint8Array;
	nonce: bigint;
	leafIndex: number;
	tree: Address;
	treeConfig: Address;
	proof: readonly Address[];
}>;

export type PrizeAsset =
	| Readonly<{ kind: "sol"; lamports: bigint }>
	| Readonly<{
		kind: "token";
		mint: Address;
		amount: bigint;
		tokenProgram?: Address;
		symbol?: string;
		decimals?: number;
		icon?: string;
	}>
	| Readonly<{
		kind: "nft";
		mint: Address;
		name?: string;
		image?: string;
		metadata?: Address;
		edition?: Address;
		tokenRecord?: Address;
		destinationTokenRecord?: Address;
		authorizationRulesProgram?: Address;
		authorizationRules?: Address;
	}>
	| Readonly<{
		kind: "core";
		asset: Address;
		name?: string;
		image?: string;
		collection?: Address;
		pluginAccounts?: readonly AccountMeta[];
	}>
	| Readonly<{
		kind: "compressedNft";
		asset: Address;
		name?: string;
		image?: string;
		proof: CompressedNftProof;
	}>;

export type PrizeBundleInput = Readonly<{
	label: string;
	quantity: bigint;
	assets: readonly PrizeAsset[];
}>;

export type PrizeBundlePlan =
	& PrizeBundleInput
	& Readonly<{
		/** One bundle unit is one probability ticket. */
		odds: Readonly<{ numerator: bigint; denominator: bigint }>;
		probabilityPercent: number;
	}>;

export type TreasuryRequirement = Readonly<{
	/** Null is native SOL; unique assets are identified by their asset address. */
	asset: Address | null;
	amount: bigint;
	kind: PrizeAsset["kind"];
}>;

export type TemplatePlan = Readonly<{
	name: string;
	uri: string;
	opensAt: bigint;
	bundles: readonly PrizeBundlePlan[];
	totalBundles: bigint;
	/** Exact box issuance after the treasury receives its market lock. */
	fixedSupply: bigint;
	treasury: readonly TreasuryRequirement[];
}>;

function u64(value: bigint, field: string): bigint {
	if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
		throw new RangeError(`${field} must be a bigint in the u64 range`);
	}
	return value;
}

function assetAddress(asset: PrizeAsset): Address | null {
	if (asset.kind === "sol") return null;
	if (asset.kind === "token" || asset.kind === "nft") {
		return address(asset.mint);
	}
	return address(asset.asset);
}

function assetAmount(asset: PrizeAsset): bigint {
	if (asset.kind === "sol") return asset.lamports;
	if (asset.kind === "token") return asset.amount;
	return 1n;
}

/** Return the number of append-only bundle slots that remain. */
export function remainingTemplateBundleCapacity(bundleCount: number): number {
	if (
		!Number.isSafeInteger(bundleCount) || bundleCount < 0 ||
		bundleCount > MAX_TEMPLATE_BUNDLES
	) {
		throw new RangeError(
			`bundle count must be between 0 and ${MAX_TEMPLATE_BUNDLES}`,
		);
	}
	return MAX_TEMPLATE_BUNDLES - bundleCount;
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
	) throw new RangeError("template text cannot contain control characters");
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

/** Validate an append-only, fully collateralized treasury plan. */
export function createTemplatePlan(
	input: Readonly<{
		name: string;
		uri?: string;
		opensAt?: bigint;
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
	if (
		input.bundles.length < 1 ||
		input.bundles.length > MAX_TEMPLATE_BUNDLES
	) {
		throw new RangeError(
			`a template needs between one and ${MAX_TEMPLATE_BUNDLES} prize bundles`,
		);
	}

	const treasury = new Map<string, TreasuryRequirement>();
	const uniqueAssets = new Set<Address>();
	let totalBundles = 0n;
	const normalized = input.bundles.map((bundle) => {
		const quantity = u64(bundle.quantity, "bundle quantity");
		if (
			quantity === 0n || bundle.assets.length < 1 || bundle.assets.length > 4
		) {
			throw new RangeError(
				"bundles need positive quantity and one to four assets",
			);
		}
		totalBundles = u64(totalBundles + quantity, "total bundles");
		if (totalBundles > MAX_TOTAL_TICKETS) {
			throw new RangeError("total bundle copies cannot exceed u32::MAX");
		}
		const seen = new Set<Address | null>();
		const assets = bundle.assets.map((asset): PrizeAsset => {
			const identifier = assetAddress(asset);
			const amount = u64(assetAmount(asset), "prize amount");
			if (
				amount === 0n || seen.has(identifier) || identifier === ZERO_ADDRESS ||
				identifier === WRAPPED_SOL
			) {
				throw new RangeError(
					"assets must be positive and distinct within a bundle; use native SOL, not wrapped SOL",
				);
			}
			if (asset.kind !== "sol" && asset.kind !== "token") {
				if (quantity !== 1n || uniqueAssets.has(identifier as Address)) {
					throw new RangeError(
						"each unique NFT or Core asset can fund only one single-copy bundle",
					);
				}
				uniqueAssets.add(identifier as Address);
			}
			seen.add(identifier);
			const deposit = u64(amount * quantity, "prize collateral");
			const key = `${asset.kind}:${identifier ?? "sol"}`;
			const prior = treasury.get(key);
			treasury.set(
				key,
				Object.freeze({
					asset: identifier,
					amount: u64(
						(prior?.amount ?? 0n) + deposit,
						"total asset collateral",
					),
					kind: asset.kind,
				}),
			);
			return Object.freeze({ ...asset });
		});
		return { ...bundle, assets: Object.freeze(assets) };
	});

	return Object.freeze({
		name: input.name,
		uri,
		opensAt,
		totalBundles,
		fixedSupply: totalBundles,
		bundles: Object.freeze(normalized.map((bundle) =>
			Object.freeze({
				...bundle,
				odds: Object.freeze({
					numerator: bundle.quantity,
					denominator: totalBundles,
				}),
				probabilityPercent:
					Number(bundle.quantity * 1_000_000n / totalBundles) / 10_000,
			})
		)),
		treasury: Object.freeze(Array.from(treasury.values())),
	});
}

export type InventoryOutcome = Readonly<{
	index: number;
	remaining: bigint;
	probabilityPercent: number;
}>;

/** True after the creator has irreversibly fixed inventory and box supply. */
export function isTreasuryLocked(
	state: Pick<TemplateState, "lockedAt">,
): boolean {
	return state.lockedAt > 0n;
}

/** Read uniform live odds. Depleted bundles stay visible with zero probability. */
export function templateInventory(
	state: Pick<TemplateState, "remaining" | "bundleCount">,
	eligibleBundleCount = state.bundleCount,
): readonly InventoryOutcome[] {
	if (
		state.remaining.length !== MAX_TEMPLATE_BUNDLES * 8 ||
		!Number.isInteger(state.bundleCount) || state.bundleCount < 0 ||
		state.bundleCount > MAX_TEMPLATE_BUNDLES ||
		!Number.isInteger(eligibleBundleCount) ||
		eligibleBundleCount < 0 || eligibleBundleCount > state.bundleCount
	) throw new RangeError("invalid on-chain inventory table");
	const remaining = Uint8Array.from(state.remaining);
	const view = new DataView(
		remaining.buffer,
		remaining.byteOffset,
		remaining.byteLength,
	);
	const outcomes = Array.from({ length: eligibleBundleCount }, (_, index) => ({
		index,
		remaining: view.getBigUint64(index * 8, true),
	}));
	const total = outcomes.reduce((sum, outcome) => sum + outcome.remaining, 0n);
	return Object.freeze(outcomes.map((outcome) =>
		Object.freeze({
			...outcome,
			probabilityPercent: total === 0n
				? 0
				: Number(outcome.remaining * 1_000_000n / total) / 10_000,
		})
	));
}

/** Conservative issuance preview; the program rechecks this at execution. */
export function templateMintCapacity(
	state: TemplateState,
	mintSupply: bigint,
): bigint {
	u64(mintSupply, "mint supply");
	if (state.status !== 1 || isTreasuryLocked(state)) return 0n;
	const inventoryCapacity = state.remainingBundles - mintSupply -
		state.pendingOpenings;
	const lifetimeCapacity = state.totalBundles - state.totalMinted;
	const capacity = inventoryCapacity < lifetimeCapacity
		? inventoryCapacity
		: lifetimeCapacity;
	return capacity > 0n ? capacity : 0n;
}
