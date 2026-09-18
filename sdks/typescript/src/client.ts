import * as generated from "@pina-rs/lootbox-program-client";
import { getCreateAccountInstruction } from "@solana-program/system";
import * as token from "@solana-program/token-2022";
import {
	type AccountMeta,
	AccountRole,
	type AccountSignerMeta,
	type Address,
	address,
	appendTransactionMessageInstructions,
	createSolanaRpc,
	createTransactionMessage,
	generateKeyPairSigner,
	getAddressDecoder,
	getAddressEncoder,
	getBase64EncodedWireTransaction,
	getBase64Encoder,
	getProgramDerivedAddress,
	getU32Encoder,
	getU64Encoder,
	getU8Encoder,
	type Instruction,
	isTransactionMessageWithinSizeLimit,
	pipe,
	type ReadonlyUint8Array,
	setTransactionMessageFeePayer,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners,
	type TransactionSigner,
} from "@solana/kit";
import { marketLockReadiness } from "./market.js";
import {
	type CompressedNftProof,
	createTemplatePlan,
	encodeTemplateText,
	MAX_PRIZE_POOL_METADATA_BYTES,
	MAX_PRIZE_POOL_PROOF_NODES,
	MAX_TEMPLATE_BUNDLES,
	type PrizeAsset,
	type PrizeBundleInput,
	type PrizePoolItem,
	remainingTemplateBundleCapacity,
	requiredServiceBudget,
	templateInventory,
	type TemplatePlan,
} from "./templates.js";

export const CLASSIC_TOKEN_PROGRAM = address(
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const BOX_TOKEN_PROGRAM = token.TOKEN_2022_PROGRAM_ADDRESS;
export const TOKEN_METADATA_PROGRAM = address(
	"metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
export const CORE_PROGRAM = address(
	"CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
);
export const BUBBLEGUM_PROGRAM = address(
	"BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY",
);
export const ACCOUNT_COMPRESSION_PROGRAM = address(
	"cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK",
);
export const NOOP_PROGRAM = address(
	"noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
);
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const INSTRUCTIONS_SYSVAR = address(
	"Sysvar1nstructions1111111111111111111111111",
);
const ASSOCIATED_TOKEN_PROGRAM = token.ASSOCIATED_TOKEN_PROGRAM_ADDRESS;
const SLOT_HASHES = address("SysvarS1otHashes111111111111111111111111111");
const WRAPPED_SOL = address("So11111111111111111111111111111111111111112");
const LOOKUP_TABLE = address("AddressLookupTab1e1111111111111111111111111");
const utf8 = new TextEncoder();
const addressBytes = getAddressEncoder();
const commitment = "processed" as const;
const PRIZE_POOL_MANIFEST_DOMAIN = utf8.encode(
	"pina-lootbox-prize-pool-manifest",
);
const PRIZE_POOL_COMMITMENT_DOMAIN = utf8.encode(
	"pina-lootbox-prize-pool-commitment",
);
const PRIZE_POOL_METADATA_DOMAIN = utf8.encode(
	"pina-lootbox-prize-pool-metadata",
);
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

export type ChainTemplate = Readonly<
	{ address: Address; data: generated.TemplateState }
>;
export type ChainOpening = Readonly<
	{ address: Address; data: generated.TemplateOpeningState }
>;
export type ChainBundle = Readonly<
	{ address: Address; data: generated.BundleState }
>;
export type OracleAccounts = Readonly<{
	queue: Address;
	oracle: Address;
	rewardEscrow: Address;
	programState: Address;
	lutSigner: Address;
	lut: Address;
	stats: Address;
}>;
export type OracleProof = Readonly<
	{
		signature: ReadonlyUint8Array;
		recoveryId: number;
		value: ReadonlyUint8Array;
	}
>;
export type ClientProgress = (message: string, signature?: string) => void;
export type OpenRequest = Readonly<{
	beneficiary?: Address;
	consumerProgram?: Address;
	consumerContext?: ReadonlyUint8Array;
}>;
export type ServiceFundingQuote = Readonly<{
	resultReceiptRent: bigint;
	serviceVaultRent: bigint;
	reservedForResultsAndBounties: bigint;
	totalCreatorDebit: bigint;
}>;
export type PrizePoolProofResolver = (
	item: PrizePoolItem,
	context: Readonly<{
		pool: Address;
		poolIndex: number;
		bundle: Address;
		assetIndex: number;
	}>,
) => Promise<Pick<PrizePoolItem, "asset" | "metadata" | "proof">>;
export type CompressedNftProofResolver = (
	asset: Extract<PrizeAsset, { kind: "compressedNft" }>,
	context: Readonly<{
		template: Address;
		bundle: Address;
		bundleNumber: number;
		assetIndex: number;
	}>,
) => Promise<
	Pick<Extract<PrizeAsset, { kind: "compressedNft" }>, "asset" | "proof">
>;
export type TemplateFundingOptions = Readonly<{
	/** Fetch a fresh DAS proof after each previous tree mutation. */
	resolvePrizePoolProof?: PrizePoolProofResolver;
	/** Fetch a fresh DAS proof immediately before a standalone cNFT transfer. */
	resolveCompressedNftProof?: CompressedNftProofResolver;
}>;
export type PrizeClaimResolution = Readonly<{
	assets?: readonly PrizeAsset[];
	/** Fresh DAS identity, metadata preimage, and proof for the selected item. */
	prizePoolItem?: Pick<PrizePoolItem, "asset" | "metadata" | "proof">;
}>;

function bytesEqual(
	left: ReadonlyUint8Array,
	right: ReadonlyUint8Array,
): boolean {
	return left.length === right.length &&
		left.every((byte, index) => byte === right[index]);
}

async function hashParts(
	parts: readonly ReadonlyUint8Array[],
): Promise<Uint8Array<ArrayBuffer>> {
	const length = parts.reduce((total, part) => total + part.length, 0);
	const input = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		input.set(part, offset);
		offset += part.length;
	}
	return new Uint8Array(
		await globalThis.crypto.subtle.digest("SHA-256", input),
	);
}

async function prizePoolSemanticMetadataHash(
	metadata: ReadonlyUint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
	const normalized = Uint8Array.from(metadata);
	let offset = 0;
	const malformed = (): never => {
		throw new Error(
			"PrizePool metadata is not canonical Bubblegum V1 metadata",
		);
	};
	const take = (length: number): Uint8Array => {
		const end = offset + length;
		if (!Number.isSafeInteger(end) || end > normalized.length) malformed();
		const value = normalized.subarray(offset, end);
		offset = end;
		return value;
	};
	const byte = (): number => take(1)[0] ?? malformed();
	const boolean = (): boolean => {
		const value = byte();
		if (value > 1) malformed();
		return value === 1;
	};
	const option = (): boolean => {
		const tag = byte();
		if (tag > 1) malformed();
		return tag === 1;
	};
	const enumeration = (variants: number): void => {
		if (byte() >= variants) malformed();
	};
	const u16 = (): number => {
		const value = take(2);
		return new DataView(value.buffer, value.byteOffset, 2).getUint16(0, true);
	};
	const u32 = (): number => {
		const value = take(4);
		return new DataView(value.buffer, value.byteOffset, 4).getUint32(0, true);
	};
	const string = (maximumBytes: number): void => {
		const length = u32();
		if (length > maximumBytes) malformed();
		try {
			strictUtf8.decode(take(length));
		} catch {
			malformed();
		}
	};
	const normalizeVerification = (): void => {
		const verificationOffset = offset;
		boolean();
		normalized[verificationOffset] = 0;
	};

	if (
		normalized.length === 0 || normalized.length > MAX_PRIZE_POOL_METADATA_BYTES
	) {
		malformed();
	}
	string(32);
	string(10);
	string(200);
	if (u16() > 10_000) malformed();
	boolean(); // primary_sale_happened
	if (boolean()) throw new Error("PrizePool metadata must be immutable");
	if (option()) byte(); // edition_nonce
	if (option()) enumeration(4); // TokenStandard
	if (option()) {
		normalizeVerification();
		take(32); // collection key
	}
	if (option()) {
		enumeration(3); // UseMethod
		take(16); // remaining + total
	}
	enumeration(2); // TokenProgramVersion
	const creatorCount = u32();
	if (creatorCount > 5) malformed();
	for (let index = 0; index < creatorCount; index += 1) {
		take(32);
		normalizeVerification();
		byte(); // share
	}
	if (offset !== normalized.length) malformed();

	return hashParts([PRIZE_POOL_METADATA_DOMAIN, normalized]);
}

/** Reproduce the ordered on-chain PrizePool inventory commitment. */
export async function prizePoolManifestAccumulator(
	pool: Address,
	items: readonly PrizePoolItem[],
): Promise<Uint8Array<ArrayBuffer>> {
	let accumulator = new Uint8Array(32);
	for (const [poolIndex, item] of items.entries()) {
		accumulator = await hashParts([
			PRIZE_POOL_MANIFEST_DOMAIN,
			accumulator,
			addressBytes.encode(pool),
			getU32Encoder().encode(poolIndex),
			addressBytes.encode(item.asset),
			item.proof.dataHash,
			item.proof.creatorHash,
			await prizePoolSemanticMetadataHash(item.metadata),
			getU64Encoder().encode(item.proof.nonce),
			getU32Encoder().encode(item.proof.leafIndex),
		]);
	}
	return accumulator;
}

/** Reproduce the commitment stored in the parent bundle after sealing. */
export async function prizePoolCommitment(
	input: Readonly<{
		pool: Address;
		tree: Address;
		manifestAccumulator: ReadonlyUint8Array;
		quantity: bigint;
		assetIndex: number;
		version: bigint;
	}>,
): Promise<Uint8Array<ArrayBuffer>> {
	return hashParts([
		PRIZE_POOL_COMMITMENT_DOMAIN,
		addressBytes.encode(input.pool),
		addressBytes.encode(input.tree),
		input.manifestAccumulator,
		getU64Encoder().encode(input.quantity),
		getU8Encoder().encode(input.assetIndex),
		getU64Encoder().encode(input.version),
	]);
}

const MAX_TRANSACTION_ACCOUNTS = 64;

function transactionAccountCount(
	payer: Address,
	instructions: readonly Instruction[],
): number {
	const addresses = new Set<Address>([payer]);
	for (const instruction of instructions) {
		addresses.add(instruction.programAddress);
		for (const account of instruction.accounts ?? []) {
			addresses.add(account.address);
		}
	}
	return addresses.size;
}

function instructionBatchFits(
	payer: Address,
	instructions: readonly Instruction[],
): boolean {
	if (transactionAccountCount(payer, instructions) > MAX_TRANSACTION_ACCOUNTS) {
		return false;
	}
	try {
		const message = pipe(
			createTransactionMessage({ version: 0 }),
			(current) => setTransactionMessageFeePayer(payer, current),
			(current) => appendTransactionMessageInstructions(instructions, current),
		);
		return isTransactionMessageWithinSizeLimit(message);
	} catch {
		return false;
	}
}

/** Pack atomic per-asset instruction groups into independently valid versioned
 * transactions. A group is never split because ATA creation and its matching
 * claim must succeed or fail together.
 */
export function partitionPrizeDeliveryInstructions(
	payer: Address,
	assetInstructionGroups: readonly (readonly Instruction[])[],
): readonly (readonly Instruction[])[] {
	const batches: Instruction[][] = [];
	let current: Instruction[] = [];
	for (const group of assetInstructionGroups) {
		if (group.length === 0) continue;
		const candidate = [...current, ...group];
		if (instructionBatchFits(payer, candidate)) {
			current = candidate;
			continue;
		}
		if (current.length > 0) {
			batches.push(current);
			current = [];
		}
		if (!instructionBatchFits(payer, group)) {
			throw new RangeError(
				"one prize delivery exceeds Solana transaction limits; shorten its proof with a tree canopy",
			);
		}
		current = [...group];
	}
	if (current.length > 0) batches.push(current);
	return batches;
}

export function readU64(bytes: ReadonlyUint8Array, index: number): bigint {
	return new DataView(Uint8Array.from(bytes).buffer).getBigUint64(
		index * 8,
		true,
	);
}

export function bundleAssets(
	bundle: Pick<
		generated.BundleState,
		"assetCount" | "kinds" | "mints" | "amounts" | "decimals"
	>,
) {
	if (
		bundle.assetCount < 1 || bundle.assetCount > 4 ||
		Array.from(bundle.kinds.slice(0, bundle.assetCount)).some((kind) =>
			kind > 10
		)
	) throw new Error("invalid prize asset kind or count");
	return Array.from({ length: bundle.assetCount }, (_, index) => ({
		index,
		kind: ([
			"sol",
			"token",
			"nft",
			"token2022",
			"metadataNft",
			"core",
			"compressedNft",
			"quoteSol",
			"quoteToken",
			"mintBadge",
			"prizePool",
		] as const)[bundle.kinds[index] ?? -1],
		mint: getAddressDecoder().decode(
			bundle.mints.slice(index * 32, (index + 1) * 32),
		),
		amount: readU64(bundle.amounts, index),
		decimals: bundle.decimals[index] ?? 0,
	}));
}

function accountMeta(
	address: Address,
	role = AccountRole.READONLY,
): AccountMeta {
	return Object.freeze({ address, role });
}

function replaceGeneratedTail(
	instruction: Instruction,
	replacements: readonly AccountMeta[],
): Instruction {
	const accounts = instruction.accounts ?? [];
	return Object.freeze({
		...instruction,
		accounts: Object.freeze([...accounts.slice(0, -1), ...replacements]),
	});
}

async function compressedAssetAddress(
	tree: Address,
	nonce: bigint,
): Promise<Address> {
	return (await getProgramDerivedAddress({
		programAddress: BUBBLEGUM_PROGRAM,
		seeds: [
			utf8.encode("asset"),
			addressBytes.encode(tree),
			getU64Encoder().encode(nonce),
		],
	}))[0];
}

function assertCompressedProofShape(proof: CompressedNftProof): void {
	if (
		proof.tree === SYSTEM_PROGRAM || proof.treeConfig === SYSTEM_PROGRAM ||
		proof.root.length !== 32 || proof.dataHash.length !== 32 ||
		proof.creatorHash.length !== 32 || typeof proof.nonce !== "bigint" ||
		proof.nonce < 0n || proof.nonce > ((1n << 64n) - 1n) ||
		!Number.isInteger(proof.leafIndex) || proof.leafIndex < 0 ||
		proof.leafIndex > 0xffff_ffff ||
		proof.proof.length > MAX_PRIZE_POOL_PROOF_NODES
	) {
		throw new Error(
			"compressed NFT proof is malformed or exceeds the protocol limit",
		);
	}
}

/** Validate a DAS cNFT witness before it can reach a transfer instruction. */
export async function validateCompressedNftIdentity(
	asset: Address,
	proof: CompressedNftProof,
): Promise<void> {
	if (asset === SYSTEM_PROGRAM) {
		throw new Error("compressed NFT asset address cannot be the zero address");
	}
	assertCompressedProofShape(proof);
	if (await compressedAssetAddress(proof.tree, proof.nonce) !== asset) {
		throw new Error(
			"compressed NFT address does not match its Bubblegum tree and nonce",
		);
	}
}

async function validatePrizePoolPlanIdentities(
	plan: TemplatePlan,
): Promise<void> {
	for (const bundle of plan.bundles) {
		for (const asset of bundle.assets) {
			if (asset.kind === "compressedNft") {
				await validateCompressedNftIdentity(asset.asset, asset.proof);
				continue;
			}
			if (asset.kind !== "prizePool") continue;
			for (const item of asset.items) {
				await validateCompressedNftIdentity(item.asset, item.proof);
				if (
					item.metadataMutable !== false || item.proof.tree !== asset.tree ||
					item.metadata.length === 0 ||
					item.metadata.length > MAX_PRIZE_POOL_METADATA_BYTES
				) {
					throw new Error(
						"PrizePool plan contains a noncanonical or mutable Bubblegum asset",
					);
				}
			}
		}
	}
}

function planContainsPrizePool(plan: TemplatePlan): boolean {
	return plan.bundles.some((bundle) =>
		bundle.assets.some((asset) => asset.kind === "prizePool")
	);
}

function expectedStoredKind(asset: PrizeAsset) {
	if (asset.kind === "token") {
		return asset.tokenProgram === BOX_TOKEN_PROGRAM ? "token2022" : "token";
	}
	if (asset.kind === "quoteSol") return "quoteSol";
	if (asset.kind === "quoteToken") return "quoteToken";
	if (asset.kind === "mintBadge") return "mintBadge";
	if (asset.kind === "nft") return asset.metadata ? "metadataNft" : "nft";
	return asset.kind;
}

function prizeIdentifier(asset: PrizeAsset): Address {
	if (asset.kind === "sol" || asset.kind === "quoteSol") return SYSTEM_PROGRAM;
	if (
		asset.kind === "token" || asset.kind === "quoteToken" ||
		asset.kind === "mintBadge" || asset.kind === "nft"
	) return asset.mint;
	if (asset.kind === "prizePool") return asset.tree;
	return asset.asset;
}

/** Reject a resumed funding plan that differs from escrowed on-chain data. */
export function assertFundedPrizeMatches(
	bundle: Pick<
		generated.BundleState,
		"assetCount" | "kinds" | "mints" | "amounts" | "decimals"
	>,
	assetIndex: number,
	asset: PrizeAsset,
	expectedIdentifier = prizeIdentifier(asset),
): void {
	const existing = bundleAssets(bundle)[assetIndex];
	const amount = asset.kind === "sol" || asset.kind === "quoteSol"
		? asset.lamports
		: asset.kind === "token" || asset.kind === "quoteToken"
		? asset.amount
		: 1n;
	if (
		!existing || existing.kind !== expectedStoredKind(asset) ||
		existing.amount !== amount || existing.mint !== expectedIdentifier
	) throw new Error("saved prize differs from already funded asset");
}

type WinnerRoutedQuoteBase = Readonly<{
	template: Address;
	opening: Address;
	bundle: Address;
	assetIndex: number;
	winner: TransactionSigner;
	route: readonly Instruction[];
}>;

function winnerSignedRoute(
	input: WinnerRoutedQuoteBase,
): readonly Instruction[] {
	if (input.route.length === 0) {
		throw new RangeError(
			"a winner-routed quote needs at least one route instruction",
		);
	}
	let winnerSigns = false;
	const route = input.route.map((instruction) => {
		if (!instruction.accounts) return instruction;
		const accounts = instruction.accounts.map((account) => {
			if (
				account.address !== input.winner.address ||
				(account.role !== AccountRole.READONLY_SIGNER &&
					account.role !== AccountRole.WRITABLE_SIGNER)
			) return account;
			winnerSigns = true;
			return Object.freeze(
				{
					address: account.address,
					role: account.role,
					signer: input.winner,
				} satisfies AccountSignerMeta,
			);
		});
		return Object.freeze({ ...instruction, accounts: Object.freeze(accounts) });
	});
	if (!winnerSigns) {
		throw new Error("the bound winner must sign the appended quote route");
	}
	return Object.freeze(route);
}

/** Compose atomic quote release plus winner-selected route instructions.
 * The caller signs and submits the returned instruction list as one transaction.
 * Any route failure rolls the quote release back with the transaction.
 */
export function composeWinnerRoutedSolQuoteClaim(
	input: WinnerRoutedQuoteBase,
): readonly Instruction[] {
	const route = winnerSignedRoute(input);
	return Object.freeze([
		generated.getClaimSolPrizeInstruction({
			template: input.template,
			opening: input.opening,
			bundle: input.bundle,
			recipient: input.winner.address,
			assetIndex: input.assetIndex,
		}),
		...route,
	]);
}

/** Token-quote counterpart to {@link composeWinnerRoutedSolQuoteClaim}. */
export function composeWinnerRoutedTokenQuoteClaim(
	input:
		& WinnerRoutedQuoteBase
		& Readonly<{
			mint: Address;
			escrow: Address;
			destination: Address;
			tokenProgram: Address;
		}>,
): readonly Instruction[] {
	const route = winnerSignedRoute(input);
	return Object.freeze([
		generated.getClaimTokenPrizeInstruction({
			template: input.template,
			opening: input.opening,
			bundle: input.bundle,
			recipient: input.winner.address,
			assetIndex: input.assetIndex,
			mint: input.mint,
			escrow: input.escrow,
			destination: input.destination,
			tokenProgram: input.tokenProgram,
		}),
		...route,
	]);
}

/** Reduce an already-hashed candidate stream with the program's exact bounded
 * rejection policy. Eight rejections are a permanent, deterministic failure.
 */
export function boundedRejectionTarget(
	candidates: readonly bigint[],
	total: bigint,
): bigint {
	if (total <= 0n || total > 0xffff_ffffn) {
		throw new RangeError("the inventory is outside sampler bounds");
	}
	const threshold = (1n << 64n) % total;
	for (const candidate of candidates.slice(0, 8)) {
		if (candidate < 0n || candidate >= 1n << 64n) {
			throw new RangeError("sampler candidates must be unsigned 64-bit values");
		}
		if (candidate >= threshold) return candidate % total;
	}
	throw new Error("entropy rejection exhausted after 8 rounds");
}

/** Mirrors the program's domain-separated, bounded rejection sampler. */
export async function selectTemplateBundle(
	template: ChainTemplate,
	opening: ChainOpening,
): Promise<number> {
	const eligibleInventory = templateInventory(
		template.data,
		opening.data.eligibleBundleCount,
	);
	const total = eligibleInventory.reduce(
		(sum, item) => sum + item.remaining,
		0n,
	);
	if (total <= 0n || total > 0xffff_ffffn) {
		throw new RangeError("the snapshotted inventory is outside sampler bounds");
	}
	const candidates: bigint[] = [];
	for (let counter = 0; counter < 8; counter++) {
		const bytes = Uint8Array.from([
			...utf8.encode("pina-lootbox-outcome"),
			...opening.data.entropy,
			...addressBytes.encode(template.address),
			...addressBytes.encode(opening.address),
			counter,
		]);
		candidates.push(
			new DataView(await crypto.subtle.digest("SHA-256", bytes))
				.getBigUint64(0, true),
		);
	}
	const target = boundedRejectionTarget(candidates, total);
	let cumulative = 0n;
	for (const item of eligibleInventory) {
		cumulative += item.remaining;
		if (target < cumulative) return item.index;
	}
	throw new Error("no outcome for sampled target");
}

/** Transaction orchestration over the generated ABI. The caller owns signing,
 * oracle transport, persistence, and cluster selection. No wallet secrets leave
 * the signer. A timeout never causes an automatic duplicate submission.
 */
export class LootboxClient {
	readonly rpc: ReturnType<typeof createSolanaRpc>;
	constructor(
		rpcUrl: string,
		readonly payer: TransactionSigner,
		readonly progress: ClientProgress = () => {},
	) {
		this.rpc = createSolanaRpc(rpcUrl);
	}

	async send(
		instructions: readonly Instruction[],
		label: string,
	): Promise<string> {
		this.progress(label);
		const { value: blockhash } = await this.rpc.getLatestBlockhash({
			commitment,
		}).send();
		const message = pipe(
			createTransactionMessage({ version: 0 }),
			(message) => setTransactionMessageFeePayerSigner(this.payer, message),
			(message) =>
				setTransactionMessageLifetimeUsingBlockhash(blockhash, message),
			(message) => appendTransactionMessageInstructions(instructions, message),
		);
		const transaction = await signTransactionMessageWithSigners(message);
		const signature = await this.rpc.sendTransaction(
			getBase64EncodedWireTransaction(transaction),
			{
				encoding: "base64",
				preflightCommitment: commitment,
			},
		).send();
		for (let attempt = 0; attempt < 80; attempt++) {
			const { value } = await this.rpc.getSignatureStatuses([signature]).send();
			const status = value[0];
			if (status?.err) {
				throw new Error(
					`Transaction ${signature} failed: ${JSON.stringify(status.err)}`,
				);
			}
			if (status) {
				this.progress(label, signature);
				return signature;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		throw new Error(
			`Confirmation timed out. Refresh chain state before retrying. Signature: ${signature}`,
		);
	}

	async templateAddress(id: bigint) {
		return getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("template"),
				addressBytes.encode(this.payer.address),
				getU64Encoder().encode(id),
			],
		});
	}
	async bundleAddress(template: Address, index: number) {
		return getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("bundle"),
				addressBytes.encode(template),
				getU32Encoder().encode(index),
			],
		});
	}
	async prizePoolAddress(bundle: Address, assetIndex: number) {
		if (!Number.isInteger(assetIndex) || assetIndex < 0 || assetIndex > 3) {
			throw new RangeError("prize-pool asset index must be between 0 and 3");
		}
		return getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("prize-pool"),
				addressBytes.encode(bundle),
				getU8Encoder().encode(assetIndex),
			],
		});
	}
	async prizePoolItemAddress(pool: Address, poolIndex: number) {
		if (
			!Number.isSafeInteger(poolIndex) || poolIndex < 0 || poolIndex > 4_095
		) {
			throw new RangeError("prize-pool item index must be between 0 and 4,095");
		}
		return getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("prize-pool-item"),
				addressBytes.encode(pool),
				getU32Encoder().encode(poolIndex),
			],
		});
	}
	async serviceVaultAddress(template: Address) {
		return getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [utf8.encode("service-vault"), addressBytes.encode(template)],
		});
	}
	async resultReceiptAddress(opening: Address, sequence: bigint) {
		return generated.findResultReceiptPda({ opening, sequence });
	}
	async ata(
		owner: Address,
		mint: Address,
		tokenProgram: Address = BOX_TOKEN_PROGRAM,
	) {
		return (await token.findAssociatedTokenPda({ owner, mint, tokenProgram }))[
			0
		];
	}
	async createAta(
		owner: Address,
		mint: Address,
		tokenProgram: Address = BOX_TOKEN_PROGRAM,
	) {
		return token.getCreateAssociatedTokenIdempotentInstruction({
			payer: this.payer,
			ata: await this.ata(owner, mint, tokenProgram),
			owner,
			mint,
			tokenProgram,
		});
	}
	async metadataPda(mint: Address) {
		return (await getProgramDerivedAddress({
			programAddress: TOKEN_METADATA_PROGRAM,
			seeds: [
				utf8.encode("metadata"),
				addressBytes.encode(TOKEN_METADATA_PROGRAM),
				addressBytes.encode(mint),
			],
		}))[0];
	}
	async editionPda(mint: Address) {
		return (await getProgramDerivedAddress({
			programAddress: TOKEN_METADATA_PROGRAM,
			seeds: [
				utf8.encode("metadata"),
				addressBytes.encode(TOKEN_METADATA_PROGRAM),
				addressBytes.encode(mint),
				utf8.encode("edition"),
			],
		}))[0];
	}
	async tokenRecordPda(mint: Address, tokenAccount: Address) {
		return (await getProgramDerivedAddress({
			programAddress: TOKEN_METADATA_PROGRAM,
			seeds: [
				utf8.encode("metadata"),
				addressBytes.encode(TOKEN_METADATA_PROGRAM),
				addressBytes.encode(mint),
				utf8.encode("token_record"),
				addressBytes.encode(tokenAccount),
			],
		}))[0];
	}
	async template(template: Address): Promise<ChainTemplate> {
		return generated.fetchTemplateState(this.rpc, template, { commitment });
	}
	async bundles(template: ChainTemplate): Promise<ChainBundle[]> {
		return Promise.all(
			Array.from(
				{ length: template.data.bundleCount },
				async (_, index) =>
					generated.fetchBundleState(
						this.rpc,
						(await this.bundleAddress(template.address, index))[0],
						{ commitment },
					),
			),
		);
	}
	async inventory() {
		const accounts = await this.rpc.getProgramAccounts(
			generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			{ encoding: "base64", commitment },
		).send();
		const templates: ChainTemplate[] = [];
		const openings: ChainOpening[] = [];
		for (const account of accounts) {
			const bytes = getBase64Encoder().encode(account.account.data[0]);
			if (bytes[0] === 4) {
				templates.push({
					address: account.pubkey,
					data: generated.getTemplateStateDecoder().decode(bytes),
				});
			}
			if (bytes[0] === 6) {
				openings.push({
					address: account.pubkey,
					data: generated.getTemplateOpeningStateDecoder().decode(bytes),
				});
			}
		}
		return { templates, openings };
	}
	async boxBalance(owner: Address, mint: Address): Promise<bigint> {
		const ata = await this.ata(owner, mint);
		const { value } = await this.rpc.getAccountInfo(ata, {
			encoding: "base64",
			commitment,
		}).send();
		if (!value) return 0n;
		if (value.owner !== BOX_TOKEN_PROGRAM) {
			throw new Error("unexpected token account owner");
		}
		return token.getTokenDecoder().decode(
			getBase64Encoder().encode(value.data[0]),
		).amount;
	}
	async mintSupply(mint: Address): Promise<bigint> {
		const response = await this.rpc.getTokenSupply(mint, { commitment }).send();
		return BigInt(response.value.amount);
	}
	private async tokenProgramForMint(mint: Address): Promise<Address> {
		const account = await this.rpc.getAccountInfo(mint, {
			encoding: "base64",
			commitment,
		}).send();
		if (
			account.value?.owner !== CLASSIC_TOKEN_PROGRAM &&
			account.value?.owner !== BOX_TOKEN_PROGRAM
		) throw new Error("quote or badge mint has an unsupported token program");
		return account.value.owner;
	}

	private async fundPrizePool(
		asset: Extract<PrizeAsset, { kind: "prizePool" }>,
		template: Address,
		bundle: Address,
		bundleNumber: number,
		assetIndex: number,
		options: TemplateFundingOptions,
	): Promise<string> {
		if (!options.resolvePrizePoolProof) {
			throw new Error(
				"PrizePool funding requires a fresh-proof resolver for every sequential tree write",
			);
		}
		const [pool, poolBump] = await this.prizePoolAddress(bundle, assetIndex);
		for (const item of asset.items) {
			if (
				item.metadataMutable !== false || item.proof.tree !== asset.tree ||
				item.metadata.length === 0 ||
				item.metadata.length > MAX_PRIZE_POOL_METADATA_BYTES ||
				await compressedAssetAddress(asset.tree, item.proof.nonce) !==
					item.asset
			) {
				throw new Error(
					"PrizePool funding requires immutable canonical Bubblegum asset identities",
				);
			}
		}
		let state = await generated.fetchMaybePrizePoolState(this.rpc, pool, {
			commitment,
		});
		let signature = "";
		if (!state.exists) {
			signature = await this.send([generated.getCreatePrizePoolInstruction({
				authority: this.payer,
				template,
				bundle,
				prizePool: pool,
				merkleTree: asset.tree,
				assetIndex,
				bump: poolBump,
			})], `Create PrizePool · bundle ${bundleNumber}`);
			state = await generated.fetchMaybePrizePoolState(this.rpc, pool, {
				commitment,
			});
		}
		if (!state.exists) throw new Error("PrizePool creation did not persist");
		if (
			state.data.authority !== this.payer.address ||
			state.data.bundle !== bundle || state.data.tree !== asset.tree ||
			state.data.quantity !== BigInt(asset.items.length) ||
			state.data.assetIndex !== assetIndex || state.data.depositCursor < 0 ||
			state.data.depositCursor > asset.items.length || state.data.status > 1
		) throw new Error("saved PrizePool differs from this funding plan");

		const plannedAccumulator = await prizePoolManifestAccumulator(
			pool,
			asset.items,
		);
		if (state.data.status === 1) {
			if (
				state.data.depositCursor !== asset.items.length ||
				!bytesEqual(state.data.manifestAccumulator, plannedAccumulator)
			) throw new Error("sealed PrizePool differs from this funding plan");
			const parent = await generated.fetchBundleState(this.rpc, bundle, {
				commitment,
			});
			const expectedCommitment = await prizePoolCommitment({
				pool,
				tree: asset.tree,
				manifestAccumulator: plannedAccumulator,
				quantity: BigInt(asset.items.length),
				assetIndex,
				version: state.data.version,
			});
			if (
				!bytesEqual(
					parent.data.commitments.slice(assetIndex * 32, (assetIndex + 1) * 32),
					expectedCommitment,
				)
			) throw new Error("bundle does not commit to this sealed PrizePool");
			return signature;
		}

		for (let poolIndex = 0; poolIndex < state.data.depositCursor; poolIndex++) {
			const planned = asset.items[poolIndex];
			if (!planned) throw new Error("saved PrizePool exceeds the funding plan");
			const [itemAddress] = await this.prizePoolItemAddress(pool, poolIndex);
			const item = await generated.fetchPrizePoolItemState(
				this.rpc,
				itemAddress,
				{ commitment },
			);
			const expectedAsset = await compressedAssetAddress(
				asset.tree,
				planned.proof.nonce,
			);
			if (
				item.data.pool !== pool || item.data.poolIndex !== poolIndex ||
				item.data.status !== 1 ||
				item.data.asset !== planned.asset ||
				item.data.asset !== expectedAsset ||
				item.data.nonce !== planned.proof.nonce ||
				item.data.treeIndex !== planned.proof.leafIndex ||
				!bytesEqual(item.data.dataHash, planned.proof.dataHash) ||
				!bytesEqual(item.data.creatorHash, planned.proof.creatorHash)
			) {
				throw new Error(
					`PrizePool item ${poolIndex + 1} differs from the saved plan`,
				);
			}
		}

		for (
			let poolIndex = state.data.depositCursor;
			poolIndex < asset.items.length;
			poolIndex++
		) {
			const planned = asset.items[poolIndex];
			if (!planned) {
				throw new Error("PrizePool funding plan has a missing item");
			}
			let resolved = await options.resolvePrizePoolProof(planned, {
				pool,
				poolIndex,
				bundle,
				assetIndex,
			});
			let proof = resolved.proof;
			await validateCompressedNftIdentity(resolved.asset, proof);
			if (
				resolved.asset !== planned.asset ||
				!bytesEqual(resolved.metadata, planned.metadata) ||
				proof.tree !== asset.tree || proof.root.length !== 32 ||
				proof.dataHash.length !== 32 || proof.creatorHash.length !== 32 ||
				proof.proof.length > MAX_PRIZE_POOL_PROOF_NODES ||
				!bytesEqual(proof.dataHash, planned.proof.dataHash) ||
				!bytesEqual(proof.creatorHash, planned.proof.creatorHash) ||
				proof.nonce !== planned.proof.nonce ||
				proof.leafIndex !== planned.proof.leafIndex ||
				await compressedAssetAddress(proof.tree, proof.nonce) !== planned.asset
			) {
				throw new Error(
					`fresh proof for PrizePool item ${
						poolIndex + 1
					} changed its identity`,
				);
			}
			const [itemAddress, itemBump] = await this.prizePoolItemAddress(
				pool,
				poolIndex,
			);
			if (state.data.hasPreparedItem) {
				const prepared = await generated.fetchPrizePoolItemState(
					this.rpc,
					itemAddress,
					{ commitment },
				);
				if (
					prepared.data.pool !== pool ||
					prepared.data.poolIndex !== poolIndex ||
					prepared.data.status !== 0 ||
					prepared.data.asset !== planned.asset ||
					prepared.data.nonce !== proof.nonce ||
					prepared.data.treeIndex !== proof.leafIndex ||
					!bytesEqual(prepared.data.dataHash, proof.dataHash) ||
					!bytesEqual(prepared.data.creatorHash, proof.creatorHash)
				) {
					throw new Error(
						`prepared PrizePool item ${
							poolIndex + 1
						} differs from the saved plan`,
					);
				}
			} else {
				signature = await this.send([
					generated.getPreparePrizePoolItemInstruction({
						authority: this.payer,
						template,
						bundle,
						prizePool: pool,
						prizePoolItem: itemAddress,
						itemBump,
						dataHash: proof.dataHash,
						creatorHash: proof.creatorHash,
						nonce: proof.nonce,
						index: proof.leafIndex,
						metadata: Array.from(resolved.metadata),
					}),
				], `Verify PrizePool item ${poolIndex + 1}/${asset.items.length}`);
				state = await generated.fetchMaybePrizePoolState(this.rpc, pool, {
					commitment,
				});
				if (!state.exists || !state.data.hasPreparedItem) {
					throw new Error(
						"PrizePool metadata verification confirmed without reserving the item",
					);
				}
				resolved = await options.resolvePrizePoolProof(planned, {
					pool,
					poolIndex,
					bundle,
					assetIndex,
				});
				proof = resolved.proof;
				await validateCompressedNftIdentity(resolved.asset, proof);
				if (
					resolved.asset !== planned.asset ||
					!bytesEqual(resolved.metadata, planned.metadata) ||
					proof.tree !== asset.tree || proof.root.length !== 32 ||
					proof.proof.length > MAX_PRIZE_POOL_PROOF_NODES ||
					!bytesEqual(proof.dataHash, planned.proof.dataHash) ||
					!bytesEqual(proof.creatorHash, planned.proof.creatorHash) ||
					proof.nonce !== planned.proof.nonce ||
					proof.leafIndex !== planned.proof.leafIndex
				) {
					throw new Error(
						`fresh proof for prepared PrizePool item ${
							poolIndex + 1
						} changed its identity`,
					);
				}
			}
			const deposit = generated.getDepositPrizePoolItemInstruction({
				authority: this.payer,
				template,
				bundle,
				prizePool: pool,
				prizePoolItem: itemAddress,
				treeConfig: proof.treeConfig,
				merkleTree: proof.tree,
				bubblegumProgram: BUBBLEGUM_PROGRAM,
				logWrapper: NOOP_PROGRAM,
				compressionProgram: ACCOUNT_COMPRESSION_PROGRAM,
				proofAccounts: BUBBLEGUM_PROGRAM,
				root: proof.root,
				dataHash: proof.dataHash,
				creatorHash: proof.creatorHash,
				nonce: proof.nonce,
				index: proof.leafIndex,
			});
			signature = await this.send([
				replaceGeneratedTail(
					deposit,
					proof.proof.map((node) => accountMeta(node)),
				),
			], `Deposit PrizePool item ${poolIndex + 1}/${asset.items.length}`);
			state = await generated.fetchMaybePrizePoolState(this.rpc, pool, {
				commitment,
			});
			if (
				!state.exists || state.data.hasPreparedItem ||
				state.data.depositCursor !== poolIndex + 1
			) {
				throw new Error(
					"PrizePool deposit confirmed without recording progress",
				);
			}
		}

		if (state.data.status === 0) {
			signature = await this.send([generated.getSealPrizePoolInstruction({
				authority: this.payer,
				template,
				bundle,
				prizePool: pool,
			})], `Seal PrizePool · bundle ${bundleNumber}`);
		}
		return signature;
	}

	private async fundAsset(
		asset: PrizeAsset,
		template: Address,
		bundle: Address,
		bundleNumber: number,
		assetIndex: number,
		options: TemplateFundingOptions,
	) {
		const authority = this.payer.address;
		if (asset.kind === "prizePool") {
			return this.fundPrizePool(
				asset,
				template,
				bundle,
				bundleNumber,
				assetIndex,
				options,
			);
		}
		if (asset.kind === "sol") {
			return this.send([generated.getFundSolPrizeInstruction({
				authority: this.payer,
				template,
				bundle,
				lamportsPerWin: asset.lamports,
			})], `Escrow SOL · bundle ${bundleNumber}`);
		}
		if (asset.kind === "quoteSol") {
			return this.send([generated.getFundQuoteSolPrizeInstruction({
				authority: this.payer,
				template,
				bundle,
				lamportsPerWin: asset.lamports,
			})], `Escrow winner-routed SOL quote · bundle ${bundleNumber}`);
		}
		if (asset.kind === "quoteToken") {
			const tokenProgram = asset.tokenProgram ?? CLASSIC_TOKEN_PROGRAM;
			return this.send([
				await this.createAta(bundle, asset.mint, tokenProgram),
				generated.getFundQuoteTokenPrizeInstruction({
					authority: this.payer,
					template,
					bundle,
					mint: asset.mint,
					source: await this.ata(authority, asset.mint, tokenProgram),
					escrow: await this.ata(bundle, asset.mint, tokenProgram),
					tokenProgram,
					amountPerWin: asset.amount,
				}),
			], `Escrow winner-routed token quote · bundle ${bundleNumber}`);
		}
		if (asset.kind === "mintBadge") {
			return this.send([generated.getFundMintPrizeInstruction({
				authority: this.payer,
				template,
				bundle,
				mint: asset.mint,
				tokenProgram: asset.tokenProgram ?? CLASSIC_TOKEN_PROGRAM,
			})], `Escrow badge mint authority · bundle ${bundleNumber}`);
		}
		if (asset.kind === "token" || (asset.kind === "nft" && !asset.metadata)) {
			const tokenProgram = asset.kind === "token"
				? asset.tokenProgram ?? CLASSIC_TOKEN_PROGRAM
				: CLASSIC_TOKEN_PROGRAM;
			return this.send([
				await this.createAta(bundle, asset.mint, tokenProgram),
				generated.getFundTokenPrizeInstruction({
					authority: this.payer,
					template,
					bundle,
					mint: asset.mint,
					source: await this.ata(authority, asset.mint, tokenProgram),
					escrow: await this.ata(bundle, asset.mint, tokenProgram),
					tokenProgram,
					amountPerWin: asset.kind === "nft" ? 1n : asset.amount,
					isNft: asset.kind === "nft",
				}),
			], `Escrow ${asset.kind} · bundle ${bundleNumber}`);
		}
		if (asset.kind === "nft") {
			const metadata = asset.metadata;
			if (!metadata) {
				throw new Error("metadata NFT is missing its metadata PDA");
			}
			const source = await this.ata(
				authority,
				asset.mint,
				CLASSIC_TOKEN_PROGRAM,
			);
			const escrow = await this.ata(bundle, asset.mint, CLASSIC_TOKEN_PROGRAM);
			const optional = [
				accountMeta(asset.edition ?? await this.editionPda(asset.mint)),
				accountMeta(
					asset.tokenRecord ?? TOKEN_METADATA_PROGRAM,
					asset.tokenRecord ? AccountRole.WRITABLE : AccountRole.READONLY,
				),
				accountMeta(
					asset.destinationTokenRecord ?? TOKEN_METADATA_PROGRAM,
					asset.destinationTokenRecord
						? AccountRole.WRITABLE
						: AccountRole.READONLY,
				),
				accountMeta(asset.authorizationRulesProgram ?? TOKEN_METADATA_PROGRAM),
				accountMeta(asset.authorizationRules ?? TOKEN_METADATA_PROGRAM),
			];
			const funding = generated.getFundMetadataNftPrizeInstruction({
				authority: this.payer,
				template,
				bundle,
				mint: asset.mint,
				source,
				escrow,
				metadata,
				tokenMetadataProgram: TOKEN_METADATA_PROGRAM,
				systemProgram: SYSTEM_PROGRAM,
				instructionsSysvar: INSTRUCTIONS_SYSVAR,
				tokenProgram: CLASSIC_TOKEN_PROGRAM,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
				optionalAccounts: TOKEN_METADATA_PROGRAM,
			});
			return this.send([
				await this.createAta(bundle, asset.mint, CLASSIC_TOKEN_PROGRAM),
				replaceGeneratedTail(funding, optional),
			], `Escrow NFT · bundle ${bundleNumber}`);
		}
		if (asset.kind === "core") {
			const funding = generated.getFundCoreAssetPrizeInstruction({
				authority: this.payer,
				template,
				bundle,
				asset: asset.asset,
				collection: asset.collection ?? CORE_PROGRAM,
				coreProgram: CORE_PROGRAM,
				systemProgram: SYSTEM_PROGRAM,
				logWrapper: NOOP_PROGRAM,
				pluginAccounts: CORE_PROGRAM,
			});
			return this.send([
				replaceGeneratedTail(funding, asset.pluginAccounts ?? []),
			], `Escrow Core asset · bundle ${bundleNumber}`);
		}

		let compressed = asset;
		if (options.resolveCompressedNftProof) {
			const resolved = await options.resolveCompressedNftProof(asset, {
				template,
				bundle,
				bundleNumber,
				assetIndex,
			});
			if (
				resolved.asset !== asset.asset ||
				resolved.proof.tree !== asset.proof.tree ||
				resolved.proof.nonce !== asset.proof.nonce ||
				resolved.proof.leafIndex !== asset.proof.leafIndex
			) {
				throw new Error(
					"fresh compressed NFT proof changed the planned identity",
				);
			}
			compressed = { ...asset, proof: resolved.proof };
		}
		await validateCompressedNftIdentity(compressed.asset, compressed.proof);
		const funding = generated.getFundCompressedNftPrizeInstruction({
			authority: this.payer,
			template,
			bundle,
			treeConfig: compressed.proof.treeConfig,
			merkleTree: compressed.proof.tree,
			bubblegumProgram: BUBBLEGUM_PROGRAM,
			logWrapper: NOOP_PROGRAM,
			compressionProgram: ACCOUNT_COMPRESSION_PROGRAM,
			systemProgram: SYSTEM_PROGRAM,
			proofAccounts: BUBBLEGUM_PROGRAM,
			root: compressed.proof.root,
			dataHash: compressed.proof.dataHash,
			creatorHash: compressed.proof.creatorHash,
			nonce: compressed.proof.nonce,
			index: compressed.proof.leafIndex,
		});
		return this.send([
			replaceGeneratedTail(
				funding,
				compressed.proof.proof.map((proof) => accountMeta(proof)),
			),
		], `Escrow compressed NFT · bundle ${bundleNumber}`);
	}

	/** A stable id and mint signer allow re-entry after interrupted creation.
	 * Completed funding steps are read from chain, never repeated blindly.
	 */
	async createTemplate(
		plan: TemplatePlan,
		id: bigint,
		mint: TransactionSigner,
		oracleProgram: Address,
		queue: Address,
		options: TemplateFundingOptions = {},
	) {
		plan = createTemplatePlan(plan);
		await validatePrizePoolPlanIdentities(plan);
		if (planContainsPrizePool(plan) && !options.resolvePrizePoolProof) {
			throw new Error("PrizePool creation requires a fresh-proof resolver");
		}
		const [template, bump] = await this.templateAddress(id);
		const authority = this.payer.address;
		const exists = await this.rpc.getAccountInfo(mint.address, {
			encoding: "base64",
			commitment,
		}).send();
		if (!exists.value) {
			// 234 = base mint + account type/padding + MetadataPointer TLV.
			// TokenMetadata grows the allocation; prepay its exact encoded size.
			const finalSize = 234 + 4 + 64 + 16 + utf8.encode(plan.name).length + 4 +
				utf8.encode(plan.uri).length;
			const rent = await this.rpc.getMinimumBalanceForRentExemption(
				BigInt(finalSize),
			).send();
			await this.send([
				getCreateAccountInstruction({
					payer: this.payer,
					newAccount: mint,
					lamports: rent,
					space: 234n,
					programAddress: BOX_TOKEN_PROGRAM,
				}),
				token.getInitializeMetadataPointerInstruction({
					mint: mint.address,
					authority: null,
					metadataAddress: mint.address,
				}),
				token.getInitializeMint2Instruction({
					mint: mint.address,
					decimals: 0,
					mintAuthority: authority,
					freezeAuthority: null,
				}),
				token.getInitializeTokenMetadataInstruction({
					metadata: mint.address,
					updateAuthority: authority,
					mint: mint.address,
					mintAuthority: this.payer,
					name: plan.name,
					symbol: "LOOT",
					uri: plan.uri,
				}),
				token.getUpdateTokenMetadataUpdateAuthorityInstruction({
					metadata: mint.address,
					updateAuthority: this.payer,
					newUpdateAuthority: null,
				}),
				token.getSetAuthorityInstruction({
					owned: mint.address,
					owner: this.payer,
					authorityType: token.AuthorityType.MintTokens,
					newAuthority: template,
				}),
			], "Create immutable box mint");
		}
		const account = await generated.fetchMaybeTemplateState(
			this.rpc,
			template,
			{ commitment },
		);
		if (!account.exists) {
			await this.send([generated.getCreateTemplateInstruction({
				authority: this.payer,
				template,
				boxMint: mint.address,
				id,
				opensAt: plan.opensAt,
				oracleProgram,
				oracleQueue: queue,
				name: encodeTemplateText(plan.name, 32),
				uri: encodeTemplateText(plan.uri, 200),
				settlementBountyLamports: plan.settlementBountyLamports,
				resultReceiptsEnabled: plan.resultReceiptsEnabled,
				bump,
			})], "Create treasury template");
		}
		let state = await this.template(template);
		if (
			state.data.boxMint !== mint.address ||
			state.data.opensAt !== plan.opensAt ||
			state.data.oracleProgram !== oracleProgram ||
			state.data.oracleQueue !== queue ||
			state.data.settlementBountyLamports !==
				plan.settlementBountyLamports ||
			state.data.resultReceiptsEnabled !== plan.resultReceiptsEnabled ||
			state.data.bundleCount > plan.bundles.length ||
			Array.from(state.data.name).join() !==
				Array.from(encodeTemplateText(plan.name, 32)).join() ||
			Array.from(state.data.uri).join() !==
				Array.from(encodeTemplateText(plan.uri, 200)).join()
		) throw new Error("saved draft does not match the on-chain template");
		if (state.data.status === 2) throw new Error("template is retired");
		for (const [index, prize] of plan.bundles.entries()) {
			const [bundle, bundleBump] = await this.bundleAddress(template, index);
			if (index > state.data.bundleCount) {
				throw new Error("treasury bundle history is not contiguous");
			}
			let funded = await generated.fetchMaybeBundleState(this.rpc, bundle, {
				commitment,
			});
			if (!funded.exists) {
				if (index < state.data.bundleCount) {
					throw new Error("an activated bundle account is missing");
				}
				await this.send([generated.getAddBundleInstruction({
					authority: this.payer,
					template,
					bundle,
					quantity: prize.quantity,
					assetCount: prize.assets.length,
					bump: bundleBump,
				})], `Add prize bundle ${index + 1}`);
				funded = await generated.fetchMaybeBundleState(this.rpc, bundle, {
					commitment,
				});
			}
			if (!funded.exists) throw new Error("bundle creation did not persist");
			if (
				funded.data.quantity !== prize.quantity ||
				funded.data.assetCount !== prize.assets.length
			) throw new Error("saved bundle differs from chain");
			for (const [assetIndex, asset] of prize.assets.entries()) {
				if (assetIndex < funded.data.fundedAssets) {
					const expectedIdentifier = asset.kind === "prizePool"
						? (await this.prizePoolAddress(bundle, assetIndex))[0]
						: prizeIdentifier(asset);
					assertFundedPrizeMatches(
						funded.data,
						assetIndex,
						asset,
						expectedIdentifier,
					);
					if (asset.kind === "prizePool") {
						await this.fundPrizePool(
							asset,
							template,
							bundle,
							index + 1,
							assetIndex,
							options,
						);
					}
					continue;
				}
				await this.fundAsset(
					asset,
					template,
					bundle,
					index + 1,
					assetIndex,
					options,
				);
				funded = await generated.fetchMaybeBundleState(this.rpc, bundle, {
					commitment,
				});
				if (!funded.exists) throw new Error("funded bundle disappeared");
			}
			if (funded.data.status === 0) {
				await this.send([generated.getActivateBundleInstruction({
					authority: this.payer,
					template,
					bundle,
				})], `Activate prize bundle ${index + 1}`);
				state = await this.template(template);
			}
		}
		if (state.data.status === 0) {
			await this.send([
				generated.getSealTemplateInstruction({
					authority: this.payer,
					template,
				}),
			], "Publish treasury template");
		}
		return this.template(template);
	}

	async mint(template: ChainTemplate, recipient: Address, amount: bigint) {
		const current = await this.template(template.address);
		if (current.data.lockedAt !== 0n) {
			throw new Error("the fixed-supply treasury cannot mint more boxes");
		}

		return this.send([
			await this.createAta(recipient, current.data.boxMint),
			generated.getMintTemplateBoxesInstruction({
				authority: this.payer,
				template: current.address,
				boxMint: current.data.boxMint,
				recipientBoxAccount: await this.ata(recipient, current.data.boxMint),
				boxTokenProgram: BOX_TOKEN_PROGRAM,
				amount,
			}),
		], "Mint gift to recipient");
	}
	/** Mint every outstanding bundle claim and atomically revoke mint authority.
	 * The on-chain instruction rechecks exact supply, pristine inventory, the
	 * unused tail PDA, and the future reveal date before recording the lock.
	 */
	async lockTreasury(
		template: ChainTemplate,
		recipient: Address = this.payer.address,
	): Promise<ChainTemplate> {
		const current = await this.template(template.address);
		if (current.data.authority !== this.payer.address) {
			throw new Error("only the treasury creator can lock this series");
		}
		if (current.data.lockedAt !== 0n) return current;

		const [supply, slot, serviceFunding, creatorBalance] = await Promise.all([
			this.mintSupply(current.data.boxMint),
			this.rpc.getSlot({ commitment }).send(),
			this.serviceFundingQuote(current),
			this.rpc.getBalance(this.payer.address, { commitment }).send(),
		]);
		if (creatorBalance.value < serviceFunding.totalCreatorDebit) {
			throw new Error(
				`Treasury creator needs at least ${serviceFunding.totalCreatorDebit} lamports for configured result and settlement services`,
			);
		}
		const chainTime = await this.rpc.getBlockTime(slot).send() ?? 0n;
		const readiness = marketLockReadiness(current.data, supply, chainTime);
		if (!readiness.canLock) {
			throw new Error(`Treasury cannot lock: ${readiness.reasons.join("; ")}`);
		}

		const [nextBundle] = await this.bundleAddress(
			current.address,
			current.data.bundleCount,
		);
		const [serviceVault, serviceVaultBump] = await this.serviceVaultAddress(
			current.address,
		);
		const instructions: Instruction[] = [];
		if (readiness.mintRequired > 0n) {
			instructions.push(
				await this.createAta(recipient, current.data.boxMint),
				generated.getMintTemplateBoxesInstruction({
					authority: this.payer,
					template: current.address,
					boxMint: current.data.boxMint,
					recipientBoxAccount: await this.ata(
						recipient,
						current.data.boxMint,
					),
					boxTokenProgram: BOX_TOKEN_PROGRAM,
					amount: readiness.mintRequired,
				}),
			);
		}
		instructions.push(generated.getLockTreasuryInstruction({
			authority: this.payer,
			template: current.address,
			boxMint: current.data.boxMint,
			bundle: nextBundle,
			serviceVault,
			serviceVaultBump,
		}));

		await this.send(instructions, "Mint exact supply & lock treasury");
		return this.template(current.address);
	}
	/** Quote the exact creator-funded service reserve before market lock. */
	async serviceFundingQuote(
		template: ChainTemplate,
	): Promise<ServiceFundingQuote> {
		const servicesEnabled = template.data.resultReceiptsEnabled ||
			template.data.settlementBountyLamports > 0n;
		const [resultReceiptRent, serviceVaultRent] = await Promise.all([
			template.data.resultReceiptsEnabled
				? this.rpc.getMinimumBalanceForRentExemption(
					BigInt(generated.getResultReceiptStateEncoder().fixedSize),
				).send()
				: Promise.resolve(0n),
			servicesEnabled
				? this.rpc.getMinimumBalanceForRentExemption(0n).send()
				: Promise.resolve(0n),
		]);
		const reservedForResultsAndBounties = requiredServiceBudget(
			{
				totalBundles: template.data.totalBundles,
				settlementBountyLamports: template.data.settlementBountyLamports,
				resultReceiptsEnabled: template.data.resultReceiptsEnabled,
			},
			resultReceiptRent,
			0n,
		);
		return Object.freeze({
			resultReceiptRent,
			serviceVaultRent,
			reservedForResultsAndBounties,
			totalCreatorDebit: requiredServiceBudget(
				{
					totalBundles: template.data.totalBundles,
					settlementBountyLamports: template.data.settlementBountyLamports,
					resultReceiptsEnabled: template.data.resultReceiptsEnabled,
				},
				resultReceiptRent,
				serviceVaultRent,
			),
		});
	}
	/** Permanently stop creator mutations. Issued, unlocked series may use this
	 * only after a missed reveal deadline, preserving holder opening rights.
	 */
	async retireTemplate(template: ChainTemplate): Promise<ChainTemplate> {
		const current = await this.template(template.address);
		if (current.data.authority !== this.payer.address) {
			throw new Error("only the treasury creator can retire this series");
		}
		if (current.data.status === 2) return current;

		await this.send([generated.getRetireTemplateInstruction({
			authority: this.payer,
			template: current.address,
		})], "Retire treasury");
		return this.template(current.address);
	}
	/** Return unused creator-funded receipt rent and crank bounties after every
	 * box and pending opening has left circulation. Existing result receipts stay
	 * immutable and funded in their own accounts.
	 */
	async closeServiceVault(
		template: ChainTemplate,
	): Promise<string | undefined> {
		const current = await this.template(template.address);
		if (
			!current.data.resultReceiptsEnabled &&
			current.data.settlementBountyLamports === 0n
		) return undefined;

		return this.send([generated.getCloseServiceVaultInstruction({
			authority: this.payer,
			template: current.address,
			boxMint: current.data.boxMint,
			serviceVault: (await this.serviceVaultAddress(current.address))[0],
		})], "Recover unused service funding");
	}
	async appendBundles(
		template: ChainTemplate,
		bundles: readonly PrizeBundleInput[],
		startBundleCount = template.data.bundleCount,
		options: TemplateFundingOptions = {},
	): Promise<ChainTemplate> {
		const plan = createTemplatePlan({ name: "Treasury append", bundles });
		await validatePrizePoolPlanIdentities(plan);
		if (planContainsPrizePool(plan) && !options.resolvePrizePoolProof) {
			throw new Error("PrizePool append requires a fresh-proof resolver");
		}
		let current = await this.template(template.address);
		if (
			current.data.authority !== this.payer.address ||
			current.data.status === 2 ||
			current.data.lockedAt !== 0n
		) {
			throw new Error(
				"only the creator of an unlocked live treasury can append prize bundles",
			);
		}
		if (
			!Number.isInteger(startBundleCount) || startBundleCount < 0 ||
			startBundleCount > current.data.bundleCount ||
			current.data.bundleCount > startBundleCount + plan.bundles.length
		) throw new Error("saved treasury addition does not match append history");
		if (
			plan.bundles.length > remainingTemplateBundleCapacity(startBundleCount)
		) {
			throw new RangeError(
				`treasury additions cannot exceed ${MAX_TEMPLATE_BUNDLES} total bundles`,
			);
		}
		for (const [offset, prize] of plan.bundles.entries()) {
			const index = startBundleCount + offset;
			const [bundle, bump] = await this.bundleAddress(current.address, index);
			const existing = await generated.fetchMaybeBundleState(this.rpc, bundle, {
				commitment,
			});
			if (!existing.exists) {
				await this.send([generated.getAddBundleInstruction({
					authority: this.payer,
					template: current.address,
					bundle,
					quantity: prize.quantity,
					assetCount: prize.assets.length,
					bump,
				})], `Stage treasury addition ${index + 1}`);
			}
			let draft = await generated.fetchBundleState(this.rpc, bundle, {
				commitment,
			});
			if (
				draft.data.quantity !== prize.quantity ||
				draft.data.assetCount !== prize.assets.length
			) throw new Error("the staged append differs from this bundle");
			for (const [assetIndex, asset] of prize.assets.entries()) {
				if (assetIndex < draft.data.fundedAssets) {
					const expectedIdentifier = asset.kind === "prizePool"
						? (await this.prizePoolAddress(bundle, assetIndex))[0]
						: prizeIdentifier(asset);
					assertFundedPrizeMatches(
						draft.data,
						assetIndex,
						asset,
						expectedIdentifier,
					);
					if (asset.kind === "prizePool") {
						await this.fundPrizePool(
							asset,
							current.address,
							bundle,
							index + 1,
							assetIndex,
							options,
						);
					}
					continue;
				}
				await this.fundAsset(
					asset,
					current.address,
					bundle,
					index + 1,
					assetIndex,
					options,
				);
				draft = await generated.fetchBundleState(this.rpc, bundle, {
					commitment,
				});
			}
			if (draft.data.status === 0) {
				await this.send([generated.getActivateBundleInstruction({
					authority: this.payer,
					template: current.address,
					bundle,
				})], `Publish treasury addition ${index + 1}`);
			}
			current = await this.template(current.address);
		}
		return current;
	}
	async publishTemplate(template: ChainTemplate): Promise<ChainTemplate> {
		const current = await this.template(template.address);
		if (current.data.authority !== this.payer.address) {
			throw new Error("only the treasury creator can publish this template");
		}
		if (current.data.status === 1) return current;
		if (current.data.status !== 0 || current.data.bundleCount === 0) {
			throw new Error("only a funded draft treasury can be published");
		}
		await this.send([generated.getSealTemplateInstruction({
			authority: this.payer,
			template: current.address,
		})], "Publish funded treasury");
		return this.template(current.address);
	}
	/** Reclaim every funded asset in the one unpublished bundle at the end of
	 * the append-only log, then close that staging account. Published bundles
	 * are deliberately unreachable through this method.
	 */
	async cancelFundingBundle(
		template: ChainTemplate,
		resolvedAssets: readonly PrizeAsset[] = [],
		options: TemplateFundingOptions = {},
	): Promise<ChainTemplate> {
		const current = await this.template(template.address);
		if (
			current.data.authority !== this.payer.address ||
			current.data.lockedAt !== 0n
		) {
			throw new Error("only the treasury creator can cancel a staged bundle");
		}
		const [bundle] = await this.bundleAddress(
			current.address,
			current.data.bundleCount,
		);
		const staged = await generated.fetchMaybeBundleState(this.rpc, bundle, {
			commitment,
		});
		if (!staged.exists) {
			// A retry after CancelBundle landed but confirmation failed is already
			// complete. The caller can now discard its local recovery manifest.
			return current;
		}
		if (staged.data.status !== 0) {
			throw new Error("this treasury has no staged bundle to cancel");
		}
		const partialAssetIndex = staged.data.fundedAssets;
		if (partialAssetIndex < staged.data.assetCount) {
			const [partialPool] = await this.prizePoolAddress(
				bundle,
				partialAssetIndex,
			);
			let state = await generated.fetchMaybePrizePoolState(
				this.rpc,
				partialPool,
				{ commitment },
			);
			if (state.exists) {
				if (state.data.status === 0 && state.data.hasPreparedItem) {
					const [preparedItem] = await this.prizePoolItemAddress(
						partialPool,
						state.data.depositCursor,
					);
					await this.send([generated.getCancelPrizePoolItemInstruction({
						authority: this.payer,
						template: current.address,
						bundle,
						prizePool: partialPool,
						prizePoolItem: preparedItem,
					})], "Cancel untransferred PrizePool item");
					state = await generated.fetchMaybePrizePoolState(
						this.rpc,
						partialPool,
						{ commitment },
					);
					if (!state.exists || state.data.hasPreparedItem) {
						throw new Error("prepared PrizePool item was not cancelled");
					}
				}
				if (state.data.status === 0 && state.data.depositCursor === 0) {
					await this.send([generated.getClosePrizePoolInstruction({
						authority: this.payer,
						template: current.address,
						bundle,
						prizePool: partialPool,
					})], "Close empty PrizePool reservation");
				} else {
					const resolved = resolvedAssets[partialAssetIndex];
					if (!resolved || resolved.kind !== "prizePool") {
						throw new Error(
							"the unfinished PrizePool needs its saved item list before it can be reclaimed",
						);
					}
					await this.reclaimPrizePool(
						current,
						bundle,
						partialPool,
						resolved,
						options,
					);
				}
			}
		}

		for (
			const asset of bundleAssets(staged.data).filter((asset) =>
				asset.index < staged.data.fundedAssets
			)
		) {
			if (asset.kind === "prizePool") {
				const resolved = resolvedAssets[asset.index];
				if (!resolved || resolved.kind !== "prizePool") {
					throw new Error(
						"the staged PrizePool needs its saved item list before it can be reclaimed",
					);
				}
				await this.reclaimPrizePool(
					current,
					bundle,
					asset.mint,
					resolved,
					options,
				);
				continue;
			}
			if ((staged.data.reclaimedMask & (1 << asset.index)) !== 0) continue;
			const input = {
				template: current.address,
				boxMint: current.data.boxMint,
				bundle,
				assetIndex: asset.index,
			};
			let instructions: readonly Instruction[];
			if (asset.kind === "sol" || asset.kind === "quoteSol") {
				instructions = [generated.getReclaimSolPrizeInstruction({
					authority: this.payer,
					...input,
				})];
			} else if (asset.kind === "mintBadge") {
				instructions = [generated.getReclaimMintPrizeInstruction({
					authority: this.payer,
					...input,
					mint: asset.mint,
					tokenProgram: await this.tokenProgramForMint(asset.mint),
				})];
			} else if (
				["token", "token2022", "nft", "quoteToken"].includes(
					asset.kind ?? "",
				)
			) {
				const tokenProgram = asset.kind === "token2022"
					? BOX_TOKEN_PROGRAM
					: asset.kind === "quoteToken"
					? await this.tokenProgramForMint(asset.mint)
					: CLASSIC_TOKEN_PROGRAM;
				const destination = await this.ata(
					this.payer.address,
					asset.mint,
					tokenProgram,
				);
				instructions = [
					await this.createAta(this.payer.address, asset.mint, tokenProgram),
					generated.getReclaimTokenPrizeInstruction({
						authority: this.payer,
						...input,
						mint: asset.mint,
						escrow: await this.ata(bundle, asset.mint, tokenProgram),
						destination,
						tokenProgram,
					}),
				];
			} else {
				const resolved = resolvedAssets[asset.index];
				if (!resolved || prizeIdentifier(resolved) !== asset.mint) {
					throw new Error(
						`Staged asset ${
							asset.index + 1
						} needs fresh transfer data before it can be reclaimed`,
					);
				}
				if (asset.kind === "metadataNft" && resolved.kind === "nft") {
					const escrow = await this.ata(
						bundle,
						resolved.mint,
						CLASSIC_TOKEN_PROGRAM,
					);
					const destination = await this.ata(
						this.payer.address,
						resolved.mint,
						CLASSIC_TOKEN_PROGRAM,
					);
					const reclaim = generated.getReclaimMetadataNftPrizeInstruction({
						authority: this.payer,
						...input,
						mint: resolved.mint,
						escrow,
						destination,
						metadata: resolved.metadata ??
							await this.metadataPda(resolved.mint),
						tokenMetadataProgram: TOKEN_METADATA_PROGRAM,
						systemProgram: SYSTEM_PROGRAM,
						instructionsSysvar: INSTRUCTIONS_SYSVAR,
						tokenProgram: CLASSIC_TOKEN_PROGRAM,
						associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
						optionalAccounts: TOKEN_METADATA_PROGRAM,
					});
					instructions = [
						await this.createAta(
							this.payer.address,
							resolved.mint,
							CLASSIC_TOKEN_PROGRAM,
						),
						replaceGeneratedTail(reclaim, [
							accountMeta(
								resolved.edition ?? await this.editionPda(resolved.mint),
							),
							accountMeta(
								resolved.tokenRecord ?? TOKEN_METADATA_PROGRAM,
								resolved.tokenRecord
									? AccountRole.WRITABLE
									: AccountRole.READONLY,
							),
							accountMeta(
								resolved.destinationTokenRecord ?? TOKEN_METADATA_PROGRAM,
								resolved.destinationTokenRecord
									? AccountRole.WRITABLE
									: AccountRole.READONLY,
							),
							accountMeta(
								resolved.authorizationRulesProgram ?? TOKEN_METADATA_PROGRAM,
							),
							accountMeta(
								resolved.authorizationRules ?? TOKEN_METADATA_PROGRAM,
							),
						]),
					];
				} else if (asset.kind === "core" && resolved.kind === "core") {
					const reclaim = generated.getReclaimCoreAssetPrizeInstruction({
						authority: this.payer,
						...input,
						asset: resolved.asset,
						collection: resolved.collection ?? CORE_PROGRAM,
						coreProgram: CORE_PROGRAM,
						systemProgram: SYSTEM_PROGRAM,
						logWrapper: NOOP_PROGRAM,
						pluginAccounts: CORE_PROGRAM,
					});
					instructions = [replaceGeneratedTail(
						reclaim,
						resolved.pluginAccounts ?? [],
					)];
				} else if (
					asset.kind === "compressedNft" &&
					resolved.kind === "compressedNft"
				) {
					await validateCompressedNftIdentity(resolved.asset, resolved.proof);
					const reclaim = generated.getReclaimCompressedNftPrizeInstruction({
						authority: this.payer,
						...input,
						treeConfig: resolved.proof.treeConfig,
						merkleTree: resolved.proof.tree,
						bubblegumProgram: BUBBLEGUM_PROGRAM,
						logWrapper: NOOP_PROGRAM,
						compressionProgram: ACCOUNT_COMPRESSION_PROGRAM,
						systemProgram: SYSTEM_PROGRAM,
						proofAccounts: BUBBLEGUM_PROGRAM,
						root: resolved.proof.root,
						dataHash: resolved.proof.dataHash,
						creatorHash: resolved.proof.creatorHash,
						nonce: resolved.proof.nonce,
						index: resolved.proof.leafIndex,
					});
					instructions = [replaceGeneratedTail(
						reclaim,
						resolved.proof.proof.map((proof) => accountMeta(proof)),
					)];
				} else {
					throw new Error(
						"resolved reclaim adapter does not match staged asset kind",
					);
				}
			}
			await this.send(instructions, `Reclaim staged asset ${asset.index + 1}`);
		}

		await this.send([generated.getCancelBundleInstruction({
			authority: this.payer,
			template: current.address,
			bundle,
		})], "Cancel staged bundle & recover rent");
		return this.template(current.address);
	}

	private async reclaimPrizePool(
		template: ChainTemplate,
		bundle: Address,
		poolAddress: Address,
		resolved: Extract<PrizeAsset, { kind: "prizePool" }>,
		options: TemplateFundingOptions,
	): Promise<void> {
		let maybePool = await generated.fetchMaybePrizePoolState(
			this.rpc,
			poolAddress,
			{
				commitment,
			},
		);
		if (!maybePool.exists) return;
		let pool: Awaited<ReturnType<typeof generated.fetchPrizePoolState>> =
			maybePool;
		if (
			pool.data.authority !== this.payer.address ||
			pool.data.bundle !== bundle || pool.data.tree !== resolved.tree ||
			pool.data.quantity !== BigInt(resolved.items.length)
		) throw new Error("saved PrizePool reclaim plan differs from chain");
		if (pool.data.hasPreparedItem) {
			const [preparedItem] = await this.prizePoolItemAddress(
				poolAddress,
				pool.data.depositCursor,
			);
			await this.send([generated.getCancelPrizePoolItemInstruction({
				authority: this.payer,
				template: template.address,
				bundle,
				prizePool: poolAddress,
				prizePoolItem: preparedItem,
			})], "Cancel untransferred PrizePool item");
			pool = await generated.fetchPrizePoolState(this.rpc, poolAddress, {
				commitment,
			});
			if (pool.data.hasPreparedItem) {
				throw new Error("prepared PrizePool item was not cancelled");
			}
		}
		const pendingPoolIndexes = Array.from(
			{ length: pool.data.depositCursor },
			(_, index) => index,
		).filter((index) =>
			((pool.data.unavailable[Math.floor(index / 8)] ?? 0) &
				(1 << (index % 8))) === 0
		);
		if (pendingPoolIndexes.length > 0 && !options.resolvePrizePoolProof) {
			throw new Error(
				"PrizePool recovery requires a fresh-proof resolver for every sequential tree write",
			);
		}

		// Validate the saved reverse-order tail before the first irreversible tree
		// write. Proofs are still fetched one-by-one because each transfer changes
		// the root used by the next item.
		for (const poolIndex of pendingPoolIndexes) {
			const planned = resolved.items[poolIndex];
			if (!planned) {
				throw new Error("PrizePool reclaim plan has a missing item");
			}
			const [itemAddress] = await this.prizePoolItemAddress(
				poolAddress,
				poolIndex,
			);
			const item = await generated.fetchPrizePoolItemState(
				this.rpc,
				itemAddress,
				{ commitment },
			);
			if (
				item.data.status !== 1 || item.data.pool !== poolAddress ||
				item.data.poolIndex !== poolIndex ||
				item.data.asset !== planned.asset ||
				item.data.nonce !== planned.proof.nonce ||
				item.data.treeIndex !== planned.proof.leafIndex
			) {
				throw new Error(
					`PrizePool item ${poolIndex + 1} differs from the reclaim plan`,
				);
			}
		}

		for (
			let poolIndex = pool.data.depositCursor - 1;
			poolIndex >= 0;
			poolIndex--
		) {
			const unavailable =
				((pool.data.unavailable[Math.floor(poolIndex / 8)] ?? 0) &
					(1 << (poolIndex % 8))) !== 0;
			if (unavailable) continue;
			const planned = resolved.items[poolIndex];
			if (!planned) {
				throw new Error("PrizePool reclaim plan has a missing item");
			}
			const current = await options.resolvePrizePoolProof!(planned, {
				pool: poolAddress,
				poolIndex,
				bundle,
				assetIndex: pool.data.assetIndex,
			});
			const proof = current.proof;
			const [itemAddress] = await this.prizePoolItemAddress(
				poolAddress,
				poolIndex,
			);
			const item = await generated.fetchPrizePoolItemState(
				this.rpc,
				itemAddress,
				{ commitment },
			);
			if (
				current.asset !== planned.asset ||
				current.metadata.length === 0 ||
				current.metadata.length > MAX_PRIZE_POOL_METADATA_BYTES ||
				proof.tree !== pool.data.tree || proof.root.length !== 32 ||
				proof.proof.length > MAX_PRIZE_POOL_PROOF_NODES ||
				item.data.pool !== poolAddress || item.data.poolIndex !== poolIndex ||
				item.data.asset !== planned.asset ||
				item.data.nonce !== proof.nonce ||
				item.data.treeIndex !== proof.leafIndex ||
				await compressedAssetAddress(proof.tree, proof.nonce) !== planned.asset
			) {
				throw new Error(
					`fresh reclaim proof for PrizePool item ${
						poolIndex + 1
					} changed its identity`,
				);
			}
			const reclaim = generated.getReclaimPrizePoolItemInstruction({
				authority: this.payer,
				template: template.address,
				boxMint: template.data.boxMint,
				bundle,
				prizePool: poolAddress,
				prizePoolItem: itemAddress,
				treeConfig: proof.treeConfig,
				merkleTree: proof.tree,
				bubblegumProgram: BUBBLEGUM_PROGRAM,
				logWrapper: NOOP_PROGRAM,
				compressionProgram: ACCOUNT_COMPRESSION_PROGRAM,
				proofAccounts: BUBBLEGUM_PROGRAM,
				poolIndex,
				root: proof.root,
				dataHash: proof.dataHash,
				creatorHash: proof.creatorHash,
				nonce: proof.nonce,
				index: proof.leafIndex,
				metadata: Array.from(current.metadata),
			});
			await this.send([replaceGeneratedTail(
				reclaim,
				proof.proof.map((node) => accountMeta(node)),
			)], `Reclaim PrizePool item ${poolIndex + 1}`);
			pool = await generated.fetchPrizePoolState(this.rpc, poolAddress, {
				commitment,
			});
		}
		await this.send([generated.getClosePrizePoolInstruction({
			authority: this.payer,
			template: template.address,
			bundle,
			prizePool: poolAddress,
		})], "Close empty PrizePool & recover rent");
	}
	/** Create an empty classic badge mint. Funding transfers its mint authority
	 * to the bundle PDA; pass that address when resuming a funded draft.
	 */
	async createBadgeMint(
		mint: TransactionSigner,
		fundedBundle?: Address,
	): Promise<Address> {
		const existing = await this.rpc.getAccountInfo(mint.address, {
			encoding: "base64",
			commitment,
		}).send();
		if (existing.value) {
			if (existing.value.owner !== CLASSIC_TOKEN_PROGRAM) {
				throw new Error("badge mint has unexpected owner");
			}
			const data = token.getMintDecoder().decode(
				getBase64Encoder().encode(existing.value.data[0]),
			);
			const mintAuthority = data.mintAuthority;
			const authorityMatches = mintAuthority.__option === "Some" &&
				(mintAuthority.value === this.payer.address ||
					mintAuthority.value === fundedBundle);
			const unfundedSupplyMatches = mintAuthority.__option === "Some" &&
				(mintAuthority.value !== this.payer.address || data.supply === 0n);
			if (
				data.decimals !== 0 || !authorityMatches || !unfundedSupplyMatches ||
				data.freezeAuthority.__option !== "None"
			) throw new Error("badge mint differs from saved draft");
			return mint.address;
		}
		await this.send([
			getCreateAccountInstruction({
				payer: this.payer,
				newAccount: mint,
				lamports: await this.rpc.getMinimumBalanceForRentExemption(82n).send(),
				space: 82n,
				programAddress: CLASSIC_TOKEN_PROGRAM,
			}),
			token.getInitializeMint2Instruction({
				mint: mint.address,
				decimals: 0,
				mintAuthority: this.payer.address,
				freezeAuthority: null,
			}, { programAddress: CLASSIC_TOKEN_PROGRAM }),
		], "Create empty badge mint");
		return mint.address;
	}
	/** Create a fixed-supply classic token, including a basic one-of-one NFT.
	 * Existing mints are validated so a saved creation workflow can resume.
	 */
	async createFixedSupplyMint(
		mint: TransactionSigner,
		amount: bigint,
		decimals = 0,
	) {
		const existing = await this.rpc.getAccountInfo(mint.address, {
			encoding: "base64",
			commitment,
		}).send();
		if (existing.value) {
			if (existing.value.owner !== CLASSIC_TOKEN_PROGRAM) {
				throw new Error("reward mint has unexpected owner");
			}
			const data = token.getMintDecoder().decode(
				getBase64Encoder().encode(existing.value.data[0]),
			);
			if (
				data.supply !== amount || data.decimals !== decimals ||
				data.mintAuthority.__option !== "None" ||
				data.freezeAuthority.__option !== "None"
			) throw new Error("reward mint differs from saved draft");
			return mint.address;
		}
		const program = { programAddress: CLASSIC_TOKEN_PROGRAM };
		await this.send([
			getCreateAccountInstruction({
				payer: this.payer,
				newAccount: mint,
				lamports: await this.rpc.getMinimumBalanceForRentExemption(82n).send(),
				space: 82n,
				programAddress: CLASSIC_TOKEN_PROGRAM,
			}),
			token.getInitializeMint2Instruction({
				mint: mint.address,
				decimals,
				mintAuthority: this.payer.address,
				freezeAuthority: null,
			}, program),
			await this.createAta(
				this.payer.address,
				mint.address,
				CLASSIC_TOKEN_PROGRAM,
			),
			token.getMintToInstruction({
				mint: mint.address,
				token: await this.ata(
					this.payer.address,
					mint.address,
					CLASSIC_TOKEN_PROGRAM,
				),
				mintAuthority: this.payer,
				amount,
			}, program),
			token.getSetAuthorityInstruction({
				owned: mint.address,
				owner: this.payer,
				authorityType: token.AuthorityType.MintTokens,
				newAuthority: null,
			}, program),
		], "Create fixed-supply test prize");
		return mint.address;
	}
	async transfer(template: ChainTemplate, recipient: Address, amount: bigint) {
		return this.send([
			await this.createAta(recipient, template.data.boxMint),
			token.getTransferCheckedInstruction({
				source: await this.ata(this.payer.address, template.data.boxMint),
				mint: template.data.boxMint,
				destination: await this.ata(recipient, template.data.boxMint),
				authority: this.payer,
				amount,
				decimals: 0,
			}),
		], "Transfer sealed gift");
	}
	async requestOpen(
		template: ChainTemplate,
		oracle: OracleAccounts,
		request: OpenRequest = {},
	) {
		const randomness = await generateKeyPairSigner();
		const consumerContext = request.consumerContext ?? new Uint8Array(32);
		if (consumerContext.length !== 32) {
			throw new RangeError("consumer context must contain exactly 32 bytes");
		}
		const [opening, bump] = await getProgramDerivedAddress({
			programAddress: generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
			seeds: [
				utf8.encode("template-opening"),
				addressBytes.encode(template.address),
				addressBytes.encode(randomness.address),
			],
		});
		await this.send([generated.getRequestTemplateOpenInstruction({
			payer: this.payer,
			boxAuthority: this.payer,
			template: template.address,
			boxMint: template.data.boxMint,
			boxAccount: await this.ata(
				this.payer.address,
				template.data.boxMint,
			),
			opening,
			randomness,
			rewardEscrow: oracle.rewardEscrow,
			oracleQueue: template.data.oracleQueue,
			oracle: oracle.oracle,
			recentSlotHashes: SLOT_HASHES,
			oracleProgram: template.data.oracleProgram,
			oracleProgramState: oracle.programState,
			oracleLutSigner: oracle.lutSigner,
			oracleLut: oracle.lut,
			wrappedSolMint: WRAPPED_SOL,
			addressLookupTableProgram: LOOKUP_TABLE,
			recentSlot: await this.rpc.getSlot({ commitment }).send(),
			beneficiary: request.beneficiary ?? this.payer.address,
			consumerProgram: request.consumerProgram ?? SYSTEM_PROGRAM,
			consumerContext,
			bump,
		})], "Burn box & commit randomness");
		return generated.fetchTemplateOpeningState(this.rpc, opening, {
			commitment,
		});
	}
	/** Forfeit the head receipt after the on-chain oracle timeout. This
	 * permissionless liveness path never changes the bound recipient and does
	 * not return a box or consume prize inventory.
	 */
	async forfeitTemplateOpen(template: ChainTemplate, opening: ChainOpening) {
		if (opening.data.status !== 0) {
			throw new Error("only a pending opening can be forfeited");
		}
		return this.send([generated.getForfeitTemplateOpenInstruction({
			caller: this.payer,
			template: template.address,
			serviceVault: (await this.serviceVaultAddress(template.address))[0],
			opening: opening.address,
			randomness: opening.data.randomness,
		})], "Forfeit expired opening & unblock queue");
	}
	/** Close a delivered or forfeited receipt and return its account rent. */
	async closeTemplateOpening(
		template: ChainTemplate,
		opening: ChainOpening,
		oracle: OracleAccounts,
	) {
		if (![3, 4].includes(opening.data.status)) {
			throw new Error("only a completed opening can be closed");
		}
		return this.send([generated.getCloseTemplateOpeningInstruction({
			rentRefund: opening.data.rentRefund,
			template: template.address,
			opening: opening.address,
			randomness: opening.data.randomness,
			rewardEscrow: oracle.rewardEscrow,
			oracleProgram: template.data.oracleProgram,
			oracleProgramState: oracle.programState,
			oracleLut: oracle.lut,
			oracleLutSigner: oracle.lutSigner,
			wrappedSolMint: WRAPPED_SOL,
			addressLookupTableProgram: LOOKUP_TABLE,
		})], "Close receipt & recover rent");
	}
	async fulfill(
		template: ChainTemplate,
		opening: ChainOpening,
		oracle: OracleAccounts,
		proof: OracleProof,
	) {
		return this.send([generated.getFulfillTemplateOpenInstruction({
			payer: this.payer,
			template: template.address,
			serviceVault: (await this.serviceVaultAddress(template.address))[0],
			opening: opening.address,
			randomness: opening.data.randomness,
			oracleQueue: template.data.oracleQueue,
			oracle: oracle.oracle,
			oracleStats: oracle.stats,
			recentSlotHashes: SLOT_HASHES,
			oracleProgram: template.data.oracleProgram,
			rewardEscrow: oracle.rewardEscrow,
			oracleProgramState: oracle.programState,
			wrappedSolMint: WRAPPED_SOL,
			...proof,
		})], "Verify randomness proof");
	}
	private async allocationInstruction(
		input: Readonly<{
			template: Address;
			opening: Address;
			bundle: Address;
			serviceVault: Address;
			resultReceipt: Address;
			resultReceiptBump: number;
		}>,
	): Promise<Instruction> {
		const bundle = await generated.fetchBundleState(this.rpc, input.bundle, {
			commitment,
		});
		const pools = bundleAssets(bundle.data).filter((asset) =>
			asset.kind === "prizePool"
		);
		if (pools.length > 1) {
			throw new Error("bundle contains multiple PrizePools");
		}
		const pool = pools[0];
		if (!pool) return generated.getAllocateTemplateOpenInstruction(input);
		return generated.getAllocatePrizePoolOpenInstruction({
			...input,
			prizePool: pool.mint,
		});
	}
	/** Verify oracle entropy and allocate the selected bundle atomically.
	 * The predicted bundle is derived from the proof value with the exact
	 * on-chain sampler, so no outcome is exposed between transactions.
	 */
	async settle(
		template: ChainTemplate,
		opening: ChainOpening,
		oracle: OracleAccounts,
		proof: OracleProof,
	) {
		if (proof.value.length !== 32) {
			throw new RangeError("oracle value must contain exactly 32 bytes");
		}
		const serviceVault = (await this.serviceVaultAddress(template.address))[0];
		const revealed: ChainOpening = {
			address: opening.address,
			data: { ...opening.data, status: 1, entropy: proof.value },
		};
		const index = await selectTemplateBundle(template, revealed);
		const [resultReceipt, resultReceiptBump] = await this.resultReceiptAddress(
			opening.address,
			opening.data.sequence,
		);
		const bundle = (await this.bundleAddress(template.address, index))[0];
		return this.send([
			generated.getFulfillTemplateOpenInstruction({
				payer: this.payer,
				template: template.address,
				serviceVault,
				opening: opening.address,
				randomness: opening.data.randomness,
				oracleQueue: template.data.oracleQueue,
				oracle: oracle.oracle,
				oracleStats: oracle.stats,
				recentSlotHashes: SLOT_HASHES,
				oracleProgram: template.data.oracleProgram,
				rewardEscrow: oracle.rewardEscrow,
				oracleProgramState: oracle.programState,
				wrappedSolMint: WRAPPED_SOL,
				...proof,
			}),
			await this.allocationInstruction({
				template: template.address,
				opening: opening.address,
				bundle,
				serviceVault,
				resultReceipt,
				resultReceiptBump,
			}),
		], "Verify randomness & record prize");
	}
	async allocate(template: ChainTemplate, opening: ChainOpening) {
		const index = await selectTemplateBundle(template, opening);
		const [serviceVault] = await this.serviceVaultAddress(template.address);
		const [resultReceipt, resultReceiptBump] = await this.resultReceiptAddress(
			opening.address,
			opening.data.sequence,
		);
		const bundle = (await this.bundleAddress(template.address, index))[0];
		return this.send([
			await this.allocationInstruction({
				template: template.address,
				opening: opening.address,
				bundle,
				serviceVault,
				resultReceipt,
				resultReceiptBump,
			}),
		], "Record prize allocation");
	}
	async claim(
		openingAddress: Address,
		resolution: PrizeClaimResolution = {},
	) {
		const resolvedAssets = resolution.assets ?? [];
		let opening = await generated.fetchTemplateOpeningState(
			this.rpc,
			openingAddress,
			{ commitment },
		);
		if (opening.data.status === 3) return;
		if (opening.data.status !== 2) {
			throw new Error("opening is not allocated yet");
		}
		const template = opening.data.template;
		const bundle =
			(await this.bundleAddress(template, opening.data.selectedBundle))[0];
		const data = await generated.fetchBundleState(this.rpc, bundle, {
			commitment,
		});
		for (let attempt = 0; attempt < data.data.assetCount; attempt++) {
			if (opening.data.status === 3) return;
			if (opening.data.status !== 2) {
				throw new Error("opening left the allocated state during delivery");
			}
			const deliveryGroups: (readonly Instruction[])[] = [];
			for (const asset of bundleAssets(data.data)) {
				if ((opening.data.claimedMask & (1 << asset.index)) !== 0) continue;
				const input = {
					template,
					opening: openingAddress,
					bundle,
					recipient: opening.data.beneficiary,
					assetIndex: asset.index,
				};
				let instructions: readonly Instruction[];
				if (asset.kind === "sol" || asset.kind === "quoteSol") {
					instructions = [generated.getClaimSolPrizeInstruction(input)];
				} else if (asset.kind === "prizePool") {
					if (
						!opening.data.hasPoolAssignment ||
						opening.data.selectedPoolAsset !== asset.index
					) throw new Error("opening has no valid PrizePool assignment");
					const resolved = resolution.prizePoolItem;
					if (!resolved) {
						throw new Error(
							"PrizePool delivery needs fresh DAS proof data for the selected item",
						);
					}
					const pool = await generated.fetchPrizePoolState(
						this.rpc,
						asset.mint,
						{ commitment },
					);
					const [itemAddress] = await this.prizePoolItemAddress(
						asset.mint,
						opening.data.selectedPoolItem,
					);
					const item = await generated.fetchMaybePrizePoolItemState(
						this.rpc,
						itemAddress,
						{ commitment },
					);
					if (!item.exists) {
						const current = await generated.fetchTemplateOpeningState(
							this.rpc,
							openingAddress,
							{ commitment },
						);
						if (
							current.data.status === 3 ||
							(current.data.claimedMask & (1 << asset.index)) !== 0
						) {
							opening = current;
							continue;
						}
						throw new Error("selected PrizePool item account is missing");
					}
					const proof = resolved.proof;
					if (
						pool.data.bundle !== bundle || pool.data.tree !== proof.tree ||
						pool.data.assetIndex !== asset.index ||
						resolved.metadata.length === 0 ||
						resolved.metadata.length > MAX_PRIZE_POOL_METADATA_BYTES ||
						item.data.pool !== asset.mint ||
						item.data.poolIndex !== opening.data.selectedPoolItem ||
						item.data.asset !== resolved.asset ||
						item.data.nonce !== proof.nonce ||
						item.data.treeIndex !== proof.leafIndex ||
						proof.root.length !== 32 ||
						proof.proof.length > MAX_PRIZE_POOL_PROOF_NODES ||
						await compressedAssetAddress(proof.tree, proof.nonce) !==
							resolved.asset
					) {
						throw new Error(
							"fresh DAS proof differs from the selected PrizePool item",
						);
					}
					const claim = generated.getClaimPrizePoolItemInstruction({
						...input,
						prizePool: asset.mint,
						prizePoolItem: itemAddress,
						rentRefund: pool.data.authority,
						treeConfig: proof.treeConfig,
						merkleTree: proof.tree,
						bubblegumProgram: BUBBLEGUM_PROGRAM,
						logWrapper: NOOP_PROGRAM,
						compressionProgram: ACCOUNT_COMPRESSION_PROGRAM,
						proofAccounts: BUBBLEGUM_PROGRAM,
						root: proof.root,
						dataHash: proof.dataHash,
						creatorHash: proof.creatorHash,
						nonce: proof.nonce,
						index: proof.leafIndex,
						metadata: Array.from(resolved.metadata),
					});
					instructions = [replaceGeneratedTail(
						claim,
						proof.proof.map((node) => accountMeta(node)),
					)];
				} else if (asset.kind === "mintBadge") {
					const tokenProgram = await this.tokenProgramForMint(asset.mint);
					instructions = [
						await this.createAta(input.recipient, asset.mint, tokenProgram),
						generated.getClaimMintPrizeInstruction({
							...input,
							mint: asset.mint,
							destination: await this.ata(
								input.recipient,
								asset.mint,
								tokenProgram,
							),
							tokenProgram,
						}),
					];
				} else if (
					["token", "token2022", "nft", "quoteToken"].includes(
						asset.kind ?? "",
					)
				) {
					const tokenProgram = asset.kind === "token2022"
						? BOX_TOKEN_PROGRAM
						: asset.kind === "quoteToken"
						? await this.tokenProgramForMint(asset.mint)
						: CLASSIC_TOKEN_PROGRAM;
					instructions = [
						await this.createAta(input.recipient, asset.mint, tokenProgram),
						generated.getClaimTokenPrizeInstruction({
							...input,
							mint: asset.mint,
							escrow: await this.ata(bundle, asset.mint, tokenProgram),
							destination: await this.ata(
								input.recipient,
								asset.mint,
								tokenProgram,
							),
							tokenProgram,
						}),
					];
				} else {
					const resolved = resolvedAssets[asset.index];
					if (!resolved || prizeIdentifier(resolved) !== asset.mint) {
						throw new Error(
							`Prize ${
								asset.index + 1
							} needs fresh DAS transfer data before it can be delivered`,
						);
					}
					if (asset.kind === "metadataNft" && resolved.kind === "nft") {
						const escrow = await this.ata(
							bundle,
							resolved.mint,
							CLASSIC_TOKEN_PROGRAM,
						);
						const destination = await this.ata(
							input.recipient,
							resolved.mint,
							CLASSIC_TOKEN_PROGRAM,
						);
						const optional = [
							accountMeta(
								resolved.edition ?? await this.editionPda(resolved.mint),
							),
							accountMeta(
								resolved.tokenRecord ?? TOKEN_METADATA_PROGRAM,
								resolved.tokenRecord
									? AccountRole.WRITABLE
									: AccountRole.READONLY,
							),
							accountMeta(
								resolved.destinationTokenRecord ?? TOKEN_METADATA_PROGRAM,
								resolved.destinationTokenRecord
									? AccountRole.WRITABLE
									: AccountRole.READONLY,
							),
							accountMeta(
								resolved.authorizationRulesProgram ?? TOKEN_METADATA_PROGRAM,
							),
							accountMeta(
								resolved.authorizationRules ?? TOKEN_METADATA_PROGRAM,
							),
						];
						const claim = generated.getClaimMetadataNftPrizeInstruction({
							payer: this.payer,
							...input,
							mint: resolved.mint,
							escrow,
							destination,
							metadata: resolved.metadata ??
								await this.metadataPda(resolved.mint),
							tokenMetadataProgram: TOKEN_METADATA_PROGRAM,
							systemProgram: SYSTEM_PROGRAM,
							instructionsSysvar: INSTRUCTIONS_SYSVAR,
							tokenProgram: CLASSIC_TOKEN_PROGRAM,
							associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
							optionalAccounts: TOKEN_METADATA_PROGRAM,
						});
						instructions = [
							await this.createAta(
								input.recipient,
								resolved.mint,
								CLASSIC_TOKEN_PROGRAM,
							),
							replaceGeneratedTail(claim, optional),
						];
					} else if (asset.kind === "core" && resolved.kind === "core") {
						const claim = generated.getClaimCoreAssetPrizeInstruction({
							payer: this.payer,
							...input,
							asset: resolved.asset,
							collection: resolved.collection ?? CORE_PROGRAM,
							coreProgram: CORE_PROGRAM,
							systemProgram: SYSTEM_PROGRAM,
							logWrapper: NOOP_PROGRAM,
							pluginAccounts: CORE_PROGRAM,
						});
						instructions = [replaceGeneratedTail(
							claim,
							resolved.pluginAccounts ?? [],
						)];
					} else if (
						asset.kind === "compressedNft" &&
						resolved.kind === "compressedNft"
					) {
						await validateCompressedNftIdentity(resolved.asset, resolved.proof);
						const claim = generated.getClaimCompressedNftPrizeInstruction({
							...input,
							treeConfig: resolved.proof.treeConfig,
							merkleTree: resolved.proof.tree,
							bubblegumProgram: BUBBLEGUM_PROGRAM,
							logWrapper: NOOP_PROGRAM,
							compressionProgram: ACCOUNT_COMPRESSION_PROGRAM,
							systemProgram: SYSTEM_PROGRAM,
							proofAccounts: BUBBLEGUM_PROGRAM,
							root: resolved.proof.root,
							dataHash: resolved.proof.dataHash,
							creatorHash: resolved.proof.creatorHash,
							nonce: resolved.proof.nonce,
							index: resolved.proof.leafIndex,
						});
						instructions = [replaceGeneratedTail(
							claim,
							resolved.proof.proof.map((proof) => accountMeta(proof)),
						)];
					} else {
						throw new Error(
							"resolved prize adapter does not match on-chain asset kind",
						);
					}
				}
				deliveryGroups.push(instructions);
			}
			const batch = partitionPrizeDeliveryInstructions(
				this.payer.address,
				deliveryGroups,
			)[0];
			if (!batch) {
				throw new Error("allocated opening has no unclaimed prize assets");
			}
			const previousClaimedMask = opening.data.claimedMask;
			try {
				await this.send(batch, "Deliver prize bundle batch");
			} catch (reason) {
				const current = await generated.fetchTemplateOpeningState(
					this.rpc,
					openingAddress,
					{ commitment },
				);
				if (
					current.data.status !== 3 &&
					current.data.claimedMask === previousClaimedMask
				) throw reason;
				opening = current;
				continue;
			}
			opening = await generated.fetchTemplateOpeningState(
				this.rpc,
				openingAddress,
				{ commitment },
			);
			if (
				opening.data.status !== 3 &&
				opening.data.claimedMask === previousClaimedMask
			) {
				throw new Error("prize delivery confirmed without recording progress");
			}
		}
		if (opening.data.status === 3) return;
		throw new Error("prize delivery exceeded the bundle asset limit");
	}
}
