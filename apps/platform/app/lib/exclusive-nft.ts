/**
 * Exclusive Lootbox NFTs: the consolation prize for boxes without a bundle.
 *
 * There is one global, protocol-run collection, the Introductory collection,
 * shared by every lootbox. Each NFT stacks one trait from every layer
 * (background, chest colour, finish, lock, decoration, contents, aura), and
 * every trait has its own odds, so an NFT's rarity is the product of its
 * layers' odds: common combinations are everywhere, and a few are rarer than
 * one in a billion. Creators do not tune rarity; they can only attach the
 * collection to their lootbox while its attach window is open, with no cap on
 * copies.
 *
 * The program work that mints these on claim is still being finalised. This
 * module fixes the agreed display contract (layers, odds, and the metadata URI
 * `{base}{hex trait indices}-{serial}.json`) so the wizard, odds, and reveal
 * can be built now. `exclusiveNftAdapter` reports `unavailable` until the SDK
 * exposes the prize kind, and `FEATURE_EXCLUSIVE_NFTS` keeps the UI read-only.
 */

export type Trait = Readonly<{
	name: string;
	/** Relative weight within its layer. */
	weight: number;
	/** Primary colour used by the preview renderer. */
	color: string;
}>;

export type Layer = Readonly<{
	key: LayerKey;
	name: string;
	traits: readonly Trait[];
}>;

export type LayerKey =
	| "background"
	| "chest"
	| "finish"
	| "lock"
	| "decoration"
	| "contents"
	| "aura";

export const INTRODUCTORY_COLLECTION = {
	name: "Introductory",
	/** When creators can last attach it to a new lootbox (UTC). */
	attachUntil: Date.UTC(2026, 11, 31, 23, 59, 59) / 1000,
	layers: [
		{
			key: "background",
			name: "Background",
			traits: [
				{ name: "Ivory", weight: 3000, color: "#f3edda" },
				{ name: "Mint", weight: 2000, color: "#cfeee2" },
				{ name: "Sky", weight: 1500, color: "#cfe3f7" },
				{ name: "Peach", weight: 1200, color: "#f9d9c4" },
				{ name: "Lilac", weight: 1000, color: "#e2d6f5" },
				{ name: "Night", weight: 800, color: "#1f2440" },
				{ name: "Sunburst", weight: 400, color: "#f7c948" },
				{ name: "Starfield", weight: 100, color: "#0b0d1f" },
			],
		},
		{
			key: "chest",
			name: "Chest colour",
			traits: [
				{ name: "Teal", weight: 2500, color: "#16796d" },
				{ name: "Oak", weight: 2200, color: "#9a6a3a" },
				{ name: "Crimson", weight: 1600, color: "#b23a31" },
				{ name: "Cobalt", weight: 1400, color: "#2d57b8" },
				{ name: "Moss", weight: 1100, color: "#5d7a2f" },
				{ name: "Bone", weight: 700, color: "#e8e0c8" },
				{ name: "Obsidian", weight: 400, color: "#231f2b" },
				{ name: "Solid gold", weight: 100, color: "#e3a81b" },
			],
		},
		{
			key: "finish",
			name: "Finish",
			traits: [
				{ name: "Matte", weight: 4000, color: "#000000" },
				{ name: "Glossy", weight: 3000, color: "#ffffff" },
				{ name: "Weathered", weight: 1800, color: "#6b6250" },
				{ name: "Chrome", weight: 800, color: "#c9d1d9" },
				{ name: "Holographic", weight: 350, color: "#b388ff" },
				{ name: "Glitch", weight: 50, color: "#00e5ff" },
			],
		},
		{
			key: "lock",
			name: "Lock",
			traits: [
				{ name: "Brass padlock", weight: 3500, color: "#f0b429" },
				{ name: "Iron clasp", weight: 3000, color: "#7a7f86" },
				{ name: "Heart lock", weight: 1500, color: "#e5566b" },
				{ name: "Skull lock", weight: 1200, color: "#efe9dc" },
				{ name: "Crystal lock", weight: 700, color: "#8fe3ff" },
				{ name: "Laser lock", weight: 100, color: "#ff2e88" },
			],
		},
		{
			key: "decoration",
			name: "Decoration",
			traits: [
				{ name: "Plain", weight: 3000, color: "transparent" },
				{ name: "Rivets", weight: 2200, color: "#1d1a14" },
				{ name: "Stickers", weight: 1600, color: "#ff8a3d" },
				{ name: "Ribbon", weight: 1200, color: "#e5566b" },
				{ name: "Vines", weight: 1000, color: "#3f8f3a" },
				{ name: "Runes", weight: 600, color: "#7cf6ff" },
				{ name: "Crown", weight: 300, color: "#f0b429" },
				{ name: "Halo", weight: 100, color: "#fff3b8" },
			],
		},
		{
			key: "contents",
			name: "Contents",
			traits: [
				{ name: "Dust bunny", weight: 2000, color: "#b9b1a0" },
				{ name: "Odd sock", weight: 1800, color: "#e5566b" },
				{ name: "Rubber duck", weight: 1500, color: "#f7c948" },
				{ name: "IOU note", weight: 1300, color: "#fffdf7" },
				{ name: "Lucky coin", weight: 1100, color: "#f0b429" },
				{ name: "Tiny cactus", weight: 900, color: "#3f8f3a" },
				{ name: "Gummy worm", weight: 700, color: "#ff8a3d" },
				{ name: "Glowing egg", weight: 450, color: "#bff7a8" },
				{ name: "Pocket nebula", weight: 200, color: "#8b5cf6" },
				{ name: "Another chest", weight: 50, color: "#16796d" },
			],
		},
		{
			key: "aura",
			name: "Aura",
			traits: [
				{ name: "None", weight: 6000, color: "transparent" },
				{ name: "Sparkle", weight: 1800, color: "#fff3b8" },
				{ name: "Smoke", weight: 1000, color: "#9a9486" },
				{ name: "Hearts", weight: 700, color: "#e5566b" },
				{ name: "Lightning", weight: 450, color: "#7cf6ff" },
				{ name: "Rainbow", weight: 50, color: "#ff2e88" },
			],
		},
	],
} as const satisfies Readonly<{
	name: string;
	attachUntil: number;
	layers: readonly Layer[];
}>;

export type Collection = Readonly<{
	name: string;
	attachUntil: number;
	layers: readonly Layer[];
}>;

/** One trait index per layer, in layer order. */
export type TraitIndices = readonly number[];

export type LayerOdds = Readonly<{
	layer: Layer;
	traits: readonly Readonly<
		{ trait: Trait; index: number; probability: number }
	>[];
}>;

export function layerOdds(collection: Collection): LayerOdds[] {
	return collection.layers.map((layer) => {
		const total = layer.traits.reduce((sum, trait) => sum + trait.weight, 0);

		return {
			layer,
			traits: layer.traits.map((trait, index) => ({
				trait,
				index,
				probability: total === 0 ? 0 : trait.weight / total,
			})),
		};
	});
}

function validIndices(collection: Collection, indices: TraitIndices): boolean {
	return indices.length === collection.layers.length &&
		indices.every((index, layer) =>
			Number.isInteger(index) && index >= 0 &&
			index < (collection.layers[layer]?.traits.length ?? 0)
		);
}

function assertIndices(collection: Collection, indices: TraitIndices): void {
	if (!validIndices(collection, indices)) {
		throw new RangeError("trait indices do not match the collection layers");
	}
}

/** Probability of one exact combination: the product of its layers' odds. */
export function combinationProbability(
	collection: Collection,
	indices: TraitIndices,
): number {
	assertIndices(collection, indices);

	return layerOdds(collection).reduce(
		(product, layer, position) =>
			product * (layer.traits[indices[position] ?? 0]?.probability ?? 0),
		1,
	);
}

/** "1 in 4,812,337" for an exact combination. */
export function rarityLabel(probability: number): string {
	if (probability <= 0) return "Impossible";

	const oneIn = Math.round(1 / probability);

	return oneIn <= 1 ? "Common" : `1 in ${oneIn.toLocaleString("en-US")}`;
}

/** Odds of the rarest possible combination, for the explainer. */
export function rarestCombination(collection: Collection): number {
	return layerOdds(collection).reduce(
		(product, layer) =>
			product *
			layer.traits.reduce(
				(least, trait) => Math.min(least, trait.probability),
				1,
			),
		1,
	);
}

/** One hex digit per layer: every layer has at most sixteen traits. */
export function encodeTraits(
	collection: Collection,
	indices: TraitIndices,
): string {
	assertIndices(collection, indices);

	return indices.map((index) => index.toString(16)).join("");
}

export function decodeTraits(
	collection: Collection,
	hex: string,
): TraitIndices | null {
	if (!/^[0-9a-f]+$/.test(hex) || hex.length !== collection.layers.length) {
		return null;
	}

	const indices = Array.from(hex, (digit) => Number.parseInt(digit, 16));

	return validIndices(collection, indices) ? indices : null;
}

/** Metadata URI: `{base}{hex trait indices}-{serial}.json`. */
export function exclusiveNftUri(
	base: string,
	collection: Collection,
	indices: TraitIndices,
	serial: number,
): string {
	if (!Number.isSafeInteger(serial) || serial < 0) {
		throw new RangeError("serial must be a non-negative integer");
	}

	return `${base}${encodeTraits(collection, indices)}-${serial}.json`;
}

/** Read trait indices and serial back from a minted NFT's metadata URI. */
export function parseExclusiveUri(
	collection: Collection,
	uri: string,
): Readonly<{ indices: TraitIndices; serial: number }> | null {
	const match = /([0-9a-f]+)-(\d+)\.json$/.exec(uri);

	if (!match?.[1] || !match[2]) return null;

	const indices = decodeTraits(collection, match[1]);
	const serial = Number(match[2]);

	return indices && Number.isSafeInteger(serial) ? { indices, serial } : null;
}

/**
 * Deterministic example combinations for the gallery: a small xorshift
 * stream sampled by weight, so previews are stable across renders and SSR.
 */
export function sampleCombinations(
	collection: Collection,
	count: number,
	seed = 0x1ee7,
): TraitIndices[] {
	let state = seed >>> 0 || 1;
	const next = () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		state >>>= 0;

		return state / 0x1_0000_0000;
	};

	return Array.from({ length: count }, () =>
		collection.layers.map((layer) => {
			const total = layer.traits.reduce((sum, trait) => sum + trait.weight, 0);
			let roll = next() * total;

			for (const [index, trait] of layer.traits.entries()) {
				roll -= trait.weight;

				if (roll < 0) return index;
			}

			return layer.traits.length - 1;
		}));
}

/** The rarest trait of every layer: the collection's showpiece. */
export function rarestIndices(collection: Collection): TraitIndices {
	return collection.layers.map((layer) =>
		layer.traits.reduce(
			(best, trait, index) =>
				trait.weight < (layer.traits[best]?.weight ?? Infinity) ? index : best,
			0,
		)
	);
}

export type ExclusiveNftRequest = Readonly<{
	count: bigint;
	collection: string;
}>;

/**
 * The typed seam between the wizard and the SDK. Today it is always
 * unavailable; when the SDK ships the prize kind, `available` returns a
 * builder for its bundle input and the flag can be switched on.
 */
export type ExclusiveNftAdapter =
	| Readonly<{ status: "unavailable"; reason: string }>
	| Readonly<{
		status: "available";
		toBundle(request: ExclusiveNftRequest): unknown;
	}>;

export function exclusiveNftAdapter(
	sdk: Readonly<Record<string, unknown>>,
): ExclusiveNftAdapter {
	const builder = sdk["createExclusiveNftBundle"];

	if (typeof builder !== "function") {
		return {
			status: "unavailable",
			reason:
				"Exclusive Lootbox NFTs arrive with the next program release. You can preview them now; they are not included when you launch.",
		};
	}

	// The agreed SDK contract: one request in, one bundle input out. The return
	// stays `unknown` until the SDK's own type can be imported here.
	const build = builder as (request: ExclusiveNftRequest) => unknown;

	return {
		status: "available",
		toBundle: (request) => build(request),
	};
}
