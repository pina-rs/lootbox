import {
	type Address,
	getAddressEncoder,
	type ReadonlyUint8Array,
} from "@solana/kit";

/** Largest number of stacked trait layers in one collection. */
export const MAX_EXCLUSIVE_LAYERS = 12;
/** Largest number of traits in one layer. */
export const MAX_EXCLUSIVE_TRAITS = 64;
/** Longest name prefix; it leaves room for ` #` and a ten-digit serial. */
export const MAX_EXCLUSIVE_NAME_PREFIX_BYTES = 20;
/** Bubblegum caps names at 32 bytes; minted names are `{prefix} #{serial}`. */
export const MAX_EXCLUSIVE_NAME_BYTES = 32;
export const MAX_EXCLUSIVE_SYMBOL_BYTES = 10;
export const MAX_EXCLUSIVE_BASE_URI_BYTES = 128;
/** Lamports Bubblegum `mint_v2` charges per mint, escrowed per attachment. */
export const BUBBLEGUM_MINT_V2_FEE_LAMPORTS = 90_000n;
/** Largest transfer proof a holder supplies; the canopy stores the rest. */
export const MAX_EXCLUSIVE_TRANSFER_PROOF_NODES = 10;

const SEED_DOMAIN = new TextEncoder().encode("lootbox:exclusive-nft");
const LAYER_LABEL = new TextEncoder().encode("layer");
const MAX_TOTAL_WEIGHT = 0xffff_ffffn;
const U64_MAX = (1n << 64n) - 1n;
const ROUNDS = 8;
const addressBytes = getAddressEncoder();
const utf8 = new TextEncoder();

/** One layer's trait weights, bottom to top; a zero weight is never drawn. */
export type ExclusiveLayer = readonly number[];

/** Invalid layer table or derivation input. */
export class ExclusiveNftError extends RangeError {
	constructor(message: string) {
		super(message);
		this.name = "ExclusiveNftError";
	}
}

async function sha256(
	parts: readonly ReadonlyUint8Array[],
): Promise<Uint8Array> {
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

/**
 * Seed `S = sha256("lootbox:exclusive-nft" || template || opening || R)`,
 * where `R` is the opening's verified Switchboard value (`opening.entropy`).
 */
export async function exclusiveNftSeed(
	template: Address,
	opening: Address,
	entropy: ReadonlyUint8Array,
): Promise<Uint8Array> {
	if (entropy.length !== 32) {
		throw new ExclusiveNftError("opening entropy must be 32 bytes");
	}
	return sha256([
		SEED_DOMAIN,
		addressBytes.encode(template),
		addressBytes.encode(opening),
		entropy,
	]);
}

/** Validate layer tables exactly as `SetExclusiveLayer` and publication do. */
export function validateExclusiveLayers(
	layers: readonly ExclusiveLayer[],
): void {
	if (layers.length < 1 || layers.length > MAX_EXCLUSIVE_LAYERS) {
		throw new ExclusiveNftError("a collection needs 1 to 12 layers");
	}
	for (const [index, layer] of layers.entries()) {
		const total = layer.reduce((sum, weight) => sum + BigInt(weight), 0n);
		if (
			layer.length < 1 || layer.length > MAX_EXCLUSIVE_TRAITS ||
			layer.some((weight) =>
				!Number.isInteger(weight) || weight < 0 || weight > 0xffff_ffff
			) || total === 0n || total > MAX_TOTAL_WEIGHT
		) {
			throw new ExclusiveNftError(
				`layer ${index} needs 1 to 64 u32 weights with a nonzero total no greater than u32::MAX`,
			);
		}
	}
}

/** Unbiased draw in `0..bound` from `sha256(S || "layer" || layer [|| round])`. */
async function layerDraw(
	seed: ReadonlyUint8Array,
	layer: number,
	bound: bigint,
): Promise<bigint> {
	const threshold = (U64_MAX + 1n - bound) % bound;
	for (let round = 0; round < ROUNDS; round++) {
		const parts = round === 0
			? [seed, LAYER_LABEL, Uint8Array.of(layer)]
			: [seed, LAYER_LABEL, Uint8Array.of(layer), Uint8Array.of(round)];
		const digest = await sha256(parts);
		const candidate = new DataView(digest.buffer).getBigUint64(0, true);
		if (candidate >= threshold) return candidate % bound;
	}
	throw new ExclusiveNftError("entropy rejection exhausted after 8 rounds");
}

/** Pick one trait per layer from `S`, exactly as `ClaimExclusiveNft` does. */
export async function exclusiveTraits(
	seed: ReadonlyUint8Array,
	layers: readonly ExclusiveLayer[],
): Promise<readonly number[]> {
	if (seed.length !== 32) {
		throw new ExclusiveNftError("the seed must be 32 bytes");
	}
	validateExclusiveLayers(layers);
	const traits: number[] = [];
	for (const [index, layer] of layers.entries()) {
		const total = layer.reduce((sum, weight) => sum + BigInt(weight), 0n);
		const target = await layerDraw(seed, index, total);
		let cumulative = 0n;
		const slot = layer.findIndex((weight) => {
			cumulative += BigInt(weight);
			return target < cumulative;
		});
		traits.push(slot);
	}
	return Object.freeze(traits);
}

/**
 * Recompute the traits an opening's claim mints from on-chain data alone:
 * the template, the opening, its verified Switchboard value, and the
 * collection's published layer tables.
 */
export async function deriveExclusiveTraits(
	template: Address,
	opening: Address,
	entropy: ReadonlyUint8Array,
	layers: readonly ExclusiveLayer[],
): Promise<Readonly<{ seed: Uint8Array; traits: readonly number[] }>> {
	const seed = await exclusiveNftSeed(template, opening, entropy);
	return Object.freeze({ seed, traits: await exclusiveTraits(seed, layers) });
}

/** On-chain leaf name `{namePrefix} #{serial}`. */
export function exclusiveName(namePrefix: string, serial: bigint): string {
	const name = `${namePrefix} #${serial}`;
	if (utf8.encode(name).length > MAX_EXCLUSIVE_NAME_BYTES) {
		throw new ExclusiveNftError("the name exceeds Bubblegum's 32-byte cap");
	}
	return name;
}

/** On-chain leaf URI `{baseUri}{lowercase hex, one byte per layer}-{serial}.json`. */
export function exclusiveUri(
	baseUri: string,
	traits: readonly number[],
	serial: bigint,
): string {
	const hex = traits.map((value) => value.toString(16).padStart(2, "0")).join(
		"",
	);
	return `${baseUri}${hex}-${serial}.json`;
}

/** Core collection URI the program creates next to the per-edition JSON. */
export function exclusiveCollectionUri(baseUri: string): string {
	return `${baseUri}collection.json`;
}

/** One layer as `SetExclusiveLayer` expects: 64 little-endian u32 slots. */
export function encodeExclusiveLayer(layer: ExclusiveLayer): Uint8Array {
	validateExclusiveLayers([layer]);
	const bytes = new Uint8Array(MAX_EXCLUSIVE_TRAITS * 4);
	const view = new DataView(bytes.buffer);
	for (const [slot, weight] of layer.entries()) {
		view.setUint32(slot * 4, weight, true);
	}
	return bytes;
}

/** Bubblegum V2 tree appended to a collection. */
export type ExclusiveTreeShape = Readonly<{
	maxDepth: number;
	maxBufferSize: number;
	/** Canopy levels; proofs are `maxDepth - canopyDepth` nodes. */
	canopyDepth: number;
	/** MPL Account Compression account size in bytes. */
	space: bigint;
}>;

/** MPL Account Compression account size for a tree and its canopy. */
export function exclusiveTreeSpace(
	maxDepth: number,
	maxBufferSize: number,
	canopyDepth: number,
): bigint {
	const depth = BigInt(maxDepth);
	const changeLog = 32n + 32n * depth + 8n;
	const rightmostPath = 32n * depth + 32n + 8n;
	const canopy = canopyDepth === 0
		? 0n
		: 32n * ((1n << BigInt(canopyDepth + 1)) - 2n);
	return 2n + 54n + 24n + BigInt(maxBufferSize) * changeLog + rightmostPath +
		canopy;
}

/**
 * The default tree: depth 20 holds 1,048,576 leaves, and a depth-10 canopy
 * keeps every transfer proof at ten nodes so wallets and marketplaces move
 * the collectibles without address lookup tables.
 */
export const EXCLUSIVE_TREE_SHAPE: ExclusiveTreeShape = Object.freeze({
	maxDepth: 20,
	maxBufferSize: 64,
	canopyDepth: 10,
	space: exclusiveTreeSpace(20, 64, 10),
});

/** Bubblegum fees an attachment escrows for `quantity` mints. */
export function exclusiveMintFeeEscrow(quantity: bigint): bigint {
	const escrow = quantity * BUBBLEGUM_MINT_V2_FEE_LAMPORTS;
	if (quantity < 0n || escrow > U64_MAX) {
		throw new ExclusiveNftError("the mint-fee escrow exceeds the u64 range");
	}
	return escrow;
}
