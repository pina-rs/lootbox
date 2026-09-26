import type { TemplateState } from "@pina-rs/lootbox-program-client";
import {
	type AccountMeta,
	type Address,
	address,
	type ReadonlyUint8Array,
} from "@solana/kit";

const U64_MAX = (1n << 64n) - 1n;
export const MAX_TEMPLATE_BUNDLES = 1_024;
export const MAX_PRIZE_POOL_ITEMS = 4_096;
export const MAX_PRIZE_POOL_METADATA_BYTES = 512;
/** Largest proof the SDK can always deliver without an address lookup table. */
export const MAX_PRIZE_POOL_PROOF_NODES = 16;
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

export type PrizePoolItem = Readonly<{
	asset: Address;
	name?: string;
	image?: string;
	/** Explicit DAS mutability signal captured by the checked creator flow. */
	metadataMutable: boolean;
	/** Canonical Bubblegum V1 `MetadataArgs` Borsh preimage verified on-chain. */
	metadata: ReadonlyUint8Array;
	proof: CompressedNftProof;
}>;

export type PrizeAsset =
	| Readonly<{ kind: "sol"; lamports: bigint }>
	| Readonly<{ kind: "quoteSol"; lamports: bigint }>
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
		kind: "quoteToken";
		mint: Address;
		amount: bigint;
		tokenProgram?: Address;
		symbol?: string;
		decimals?: number;
		icon?: string;
	}>
	| Readonly<{
		kind: "mintBadge";
		mint: Address;
		tokenProgram?: Address;
		name?: string;
		image?: string;
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
	}>
	| Readonly<{
		kind: "prizePool";
		/** Every item must be a Bubblegum V1 leaf from this one pinned tree. */
		tree: Address;
		items: readonly PrizePoolItem[];
	}>
	| Readonly<{
		/** One Exclusive Lootbox NFT minted on claim from a published
		 * `ExclusiveCollectionState`; many bundles may attach to one collection.
		 */
		kind: "exclusiveNft";
		collection: Address;
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
	settlementBountyLamports: bigint;
	resultReceiptsEnabled: boolean;
	bundles: readonly PrizeBundlePlan[];
	totalBundles: bigint;
	/** Exact box issuance after the treasury receives its market lock. */
	fixedSupply: bigint;
	treasury: readonly TreasuryRequirement[];
}>;

export type TemplatePlanErrorCode =
	| "INVALID_NAME"
	| "INVALID_TIMESTAMP"
	| "INVALID_BUNDLE_COUNT"
	| "INVALID_BUNDLE"
	| "INVALID_ASSET"
	| "DUPLICATE_UNIQUE_ASSET"
	| "TICKET_LIMIT_EXCEEDED"
	| "OUT_OF_RANGE";

/** Invalid treasury configuration rejected before transaction construction. */
export class TemplatePlanError extends RangeError {
	readonly code: TemplatePlanErrorCode;

	constructor(code: TemplatePlanErrorCode, message: string) {
		super(message);
		this.name = "TemplatePlanError";
		this.code = code;
	}
}

/** Exact creator-funded service deposit collected when a treasury locks. */
export function requiredServiceBudget(
	plan: Pick<
		TemplatePlan,
		"totalBundles" | "settlementBountyLamports" | "resultReceiptsEnabled"
	>,
	resultReceiptRent: bigint,
	serviceVaultRent: bigint,
): bigint {
	const rent = u64(resultReceiptRent, "result receipt rent");
	const vaultRent = u64(serviceVaultRent, "service vault rent");
	const receiptBudget = plan.resultReceiptsEnabled
		? u64(rent * plan.totalBundles, "result receipt budget")
		: 0n;
	const bountyBudget = u64(
		plan.settlementBountyLamports * plan.totalBundles,
		"settlement bounty budget",
	);
	const reserve = u64(receiptBudget + bountyBudget, "service reserve");
	return reserve === 0n ? 0n : u64(reserve + vaultRent, "service budget");
}

function u64(value: bigint, field: string): bigint {
	if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
		throw new TemplatePlanError(
			"OUT_OF_RANGE",
			`${field} must be a bigint in the u64 range`,
		);
	}
	return value;
}

function assetAddress(asset: PrizeAsset): Address | null {
	if (asset.kind === "sol" || asset.kind === "quoteSol") return null;
	if (
		asset.kind === "token" || asset.kind === "quoteToken" ||
		asset.kind === "mintBadge" || asset.kind === "nft"
	) {
		return address(asset.mint);
	}
	if (asset.kind === "prizePool") return address(asset.tree);
	if (asset.kind === "exclusiveNft") return address(asset.collection);
	return address(asset.asset);
}

function assetAmount(asset: PrizeAsset): bigint {
	if (asset.kind === "sol" || asset.kind === "quoteSol") {
		return asset.lamports;
	}
	if (asset.kind === "token" || asset.kind === "quoteToken") {
		return asset.amount;
	}
	return 1n;
}

function copyCompressedProof(proof: CompressedNftProof): CompressedNftProof {
	return Object.freeze({
		...proof,
		root: Uint8Array.from(proof.root),
		dataHash: Uint8Array.from(proof.dataHash),
		creatorHash: Uint8Array.from(proof.creatorHash),
		proof: Object.freeze([...proof.proof]),
	});
}

/** Own every nested collection and byte buffer used after asynchronous RPCs. */
function copyPrizeAsset(asset: PrizeAsset): PrizeAsset {
	if (asset.kind === "compressedNft") {
		return Object.freeze({ ...asset, proof: copyCompressedProof(asset.proof) });
	}
	if (asset.kind === "prizePool") {
		return Object.freeze({
			...asset,
			items: Object.freeze(asset.items.map((item) =>
				Object.freeze({
					...item,
					metadata: Uint8Array.from(item.metadata),
					proof: copyCompressedProof(item.proof),
				})
			)),
		});
	}
	if (asset.kind === "core") {
		return Object.freeze({
			...asset,
			...(asset.pluginAccounts
				? {
					pluginAccounts: Object.freeze(
						asset.pluginAccounts.map((account) =>
							Object.freeze({ ...account })
						),
					),
				}
				: {}),
		});
	}
	return Object.freeze({ ...asset });
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
		settlementBountyLamports?: bigint;
		resultReceiptsEnabled?: boolean;
		bundles: readonly PrizeBundleInput[];
	}>,
): TemplatePlan {
	const uri = input.uri ?? "";
	const opensAt = input.opensAt ?? 0n;
	const settlementBountyLamports = u64(
		input.settlementBountyLamports ?? 0n,
		"settlement bounty",
	);
	const resultReceiptsEnabled = input.resultReceiptsEnabled ?? false;
	if (input.name.trim().length === 0) {
		throw new TemplatePlanError("INVALID_NAME", "template name is required");
	}
	encodeTemplateText(input.name, 32);
	encodeTemplateText(uri, 200);
	if (
		typeof opensAt !== "bigint" || opensAt < 0n || opensAt > (1n << 63n) - 1n
	) {
		throw new TemplatePlanError(
			"INVALID_TIMESTAMP",
			"opensAt must be a nonnegative i64 Unix timestamp",
		);
	}
	if (
		input.bundles.length < 1 ||
		input.bundles.length > MAX_TEMPLATE_BUNDLES
	) {
		throw new TemplatePlanError(
			"INVALID_BUNDLE_COUNT",
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
			throw new TemplatePlanError(
				"INVALID_BUNDLE",
				"bundles need positive quantity and one to four assets",
			);
		}
		totalBundles = u64(totalBundles + quantity, "total bundles");
		if (totalBundles > MAX_TOTAL_TICKETS) {
			throw new TemplatePlanError(
				"TICKET_LIMIT_EXCEEDED",
				"total bundle copies cannot exceed u32::MAX",
			);
		}
		const seen = new Set<Address | null>();
		let prizePools = 0;
		const assets = bundle.assets.map((inputAsset): PrizeAsset => {
			const asset = copyPrizeAsset(inputAsset);
			if (
				asset.kind === "compressedNft" &&
				(asset.asset === ZERO_ADDRESS || asset.proof.tree === ZERO_ADDRESS ||
					asset.proof.treeConfig === ZERO_ADDRESS ||
					asset.proof.root.length !== 32 ||
					asset.proof.dataHash.length !== 32 ||
					asset.proof.creatorHash.length !== 32 ||
					typeof asset.proof.nonce !== "bigint" ||
					asset.proof.nonce < 0n || asset.proof.nonce > U64_MAX ||
					!Number.isInteger(asset.proof.leafIndex) ||
					asset.proof.leafIndex < 0 ||
					asset.proof.leafIndex > 0xffff_ffff ||
					asset.proof.proof.length > MAX_PRIZE_POOL_PROOF_NODES)
			) {
				throw new TemplatePlanError(
					"INVALID_ASSET",
					"compressed NFTs need a canonical identity and a complete bounded proof",
				);
			}
			if (
				asset.kind === "nft" &&
				(asset.tokenRecord || asset.destinationTokenRecord ||
					asset.authorizationRulesProgram || asset.authorizationRules)
			) {
				throw new TemplatePlanError(
					"INVALID_ASSET",
					"programmable NFT rules are not admitted until their mutability is compatibility-tested",
				);
			}
			if (
				asset.kind === "core" &&
				(asset.collection || (asset.pluginAccounts?.length ?? 0) > 0)
			) {
				throw new TemplatePlanError(
					"INVALID_ASSET",
					"only plain uncollected Core assets without plugins are admitted",
				);
			}
			if (asset.kind === "prizePool") {
				prizePools += 1;
				if (
					prizePools > 1 || bundle.quantity > BigInt(MAX_PRIZE_POOL_ITEMS) ||
					BigInt(asset.items.length) !== bundle.quantity
				) {
					throw new TemplatePlanError(
						"INVALID_ASSET",
						`a bundle supports one prize pool containing exactly its ${bundle.quantity} tickets (maximum ${MAX_PRIZE_POOL_ITEMS})`,
					);
				}
				for (const item of asset.items) {
					if (
						item.asset === ZERO_ADDRESS ||
						item.metadata.length === 0 ||
						item.metadata.length > MAX_PRIZE_POOL_METADATA_BYTES ||
						item.proof.tree !== asset.tree ||
						item.proof.treeConfig === ZERO_ADDRESS ||
						item.proof.root.length !== 32 ||
						item.proof.dataHash.length !== 32 ||
						item.proof.creatorHash.length !== 32 ||
						typeof item.proof.nonce !== "bigint" ||
						item.proof.nonce < 0n || item.proof.nonce > U64_MAX ||
						!Number.isInteger(item.proof.leafIndex) ||
						item.proof.leafIndex < 0 ||
						item.proof.leafIndex > 0xffff_ffff ||
						item.proof.proof.length > MAX_PRIZE_POOL_PROOF_NODES ||
						item.metadataMutable !== false || uniqueAssets.has(item.asset)
					) {
						throw new TemplatePlanError(
							"INVALID_ASSET",
							"prize-pool items must be distinct, immutable Bubblegum leaves from one tree with complete proofs",
						);
					}
					uniqueAssets.add(item.asset);
				}
			}
			const identifier = assetAddress(asset);
			const amount = u64(assetAmount(asset), "prize amount");
			if (
				amount === 0n || seen.has(identifier) || identifier === ZERO_ADDRESS ||
				identifier === WRAPPED_SOL
			) {
				throw new TemplatePlanError(
					"INVALID_ASSET",
					"assets must be positive and distinct within a bundle; use native SOL, not wrapped SOL",
				);
			}
			const exclusive = ![
				"sol",
				"quoteSol",
				"token",
				"quoteToken",
				"prizePool",
				"exclusiveNft",
			].includes(asset.kind);
			const singleCopy = exclusive && asset.kind !== "mintBadge";
			if (exclusive) {
				if (
					(singleCopy && quantity !== 1n) ||
					uniqueAssets.has(identifier as Address)
				) {
					throw new TemplatePlanError(
						"DUPLICATE_UNIQUE_ASSET",
						"each unique asset can fund only one bundle; non-mint assets require one copy",
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
			return asset;
		});
		return { ...bundle, assets: Object.freeze(assets) };
	});

	return Object.freeze({
		name: input.name,
		uri,
		opensAt,
		settlementBountyLamports,
		resultReceiptsEnabled,
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
		state.remaining.length !== state.bundleCount ||
		!Number.isInteger(state.bundleCount) || state.bundleCount < 0 ||
		state.bundleCount > MAX_TEMPLATE_BUNDLES ||
		!Number.isInteger(eligibleBundleCount) ||
		eligibleBundleCount < 0 || eligibleBundleCount > state.bundleCount
	) throw new RangeError("invalid on-chain inventory table");
	const outcomes = Array.from({ length: eligibleBundleCount }, (_, index) => ({
		index,
		remaining: state.remaining[index] ?? 0n,
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

/** One Token-2022 transfer-fee schedule, as read from `TransferFeeConfig`. */
export type TransferFeeSchedule = Readonly<{
	basisPoints: number;
	maximumFee: bigint;
}>;

const ONE_IN_BASIS_POINTS = 10_000n;
const MAX_TRANSFER = (1n << 64n) - 1n;

/** The fee Token-2022 withholds from a transfer of `amount`: the ceiling of
 * `amount * basisPoints / 10_000`, capped at `maximumFee`.
 */
export function transferFeeFor(
	amount: bigint,
	schedule: TransferFeeSchedule,
): bigint {
	if (schedule.basisPoints === 0 || amount === 0n) return 0n;

	const raw = (amount * BigInt(schedule.basisPoints) + ONE_IN_BASIS_POINTS -
		1n) / ONE_IN_BASIS_POINTS;

	return raw < schedule.maximumFee ? raw : schedule.maximumFee;
}

/** The smallest gross transfer that credits exactly `net`, or `undefined`
 * when no `u64` transfer can. Mirrors the program's funding gross-up
 * (`TransferFee::gross_for_net`) so a creator can quote the balance a
 * fee-bearing prize needs before funding it.
 */
export function grossForNetTransfer(
	net: bigint,
	schedule: TransferFeeSchedule,
): bigint | undefined {
	const basisPoints = BigInt(schedule.basisPoints);
	let gross: bigint;

	if (basisPoints === 0n || net === 0n) {
		gross = net;
	} else if (basisPoints >= ONE_IN_BASIS_POINTS) {
		gross = net + schedule.maximumFee;
	} else {
		const denominator = ONE_IN_BASIS_POINTS - basisPoints;
		const raw = (net * ONE_IN_BASIS_POINTS + denominator - 1n) / denominator;

		gross = raw - net >= schedule.maximumFee ? net + schedule.maximumFee : raw;
	}

	if (gross > MAX_TRANSFER) return undefined;

	return gross - transferFeeFor(gross, schedule) === net ? gross : undefined;
}
