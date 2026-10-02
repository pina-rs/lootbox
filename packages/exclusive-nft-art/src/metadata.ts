import {
	LAYER,
	LAYER_COUNT,
	LAYERS,
	resolveTraits,
	type TraitVector,
} from "./layers.ts";
import { rarityOf } from "./rarity.ts";
import { assertSerial } from "./render.ts";

/**
 * Metaplex JSON and URI helpers for Exclusive Lootbox NFTs.
 *
 * The program writes each NFT's URI as `{base}{hex}-{serial}.json`, where
 * `hex` is one lowercase byte per layer, bottom to top (`00050203000d01`). A
 * host (for example a Cloudflare Worker) parses the stem back with
 * `parseExclusiveNftStem`, then serves `metadataFor`, `renderExclusiveNft`,
 * `renderAnimatedExclusiveNft`, and `playerHtml`.
 */

/** Matches the collection symbol the program writes on chain. */
export const EXCLUSIVE_NFT_SYMBOL = "LOOT";

export const EXCLUSIVE_NFT_DISCLOSURE =
	"An Exclusive Lootbox NFT from lootbox.so, for a box that opened without a main prize. Every layer is drawn independently on-chain from the opening's committed randomness.";

export type MetadataAttribute = Readonly<
	| { trait_type: string; value: string }
	| { trait_type: string; value: number; display_type: "number" }
>;

export type ExclusiveNftMetadata = Readonly<{
	name: string;
	symbol: string;
	description: string;
	image: string;
	animation_url: string;
	external_url: string;
	attributes: readonly MetadataAttribute[];
	properties: Readonly<{
		category: "html";
		files: readonly Readonly<{ uri: string; type: string }>[];
	}>;
}>;

export type MetadataOptions = Readonly<{
	/** The URI prefix the program writes, ending in `/`. Images live beside the JSON. */
	base: string;
	/** Where `external_url` points, e.g. the lootbox site. */
	externalUrl: string;
}>;

export type ParsedStem = Readonly<{ traits: TraitVector; serial: number }>;

/** One lowercase hex byte per layer, bottom to top. */
export function traitHex(traits: TraitVector): string {
	resolveTraits(traits);

	return traits.map((trait) => trait.toString(16).padStart(2, "0")).join("");
}

/** `{hex}-{serial}`, the stem shared by the JSON, SVG, and player URLs. */
export function exclusiveNftStem(traits: TraitVector, serial: number): string {
	assertSerial(serial);

	return `${traitHex(traits)}-${serial}`;
}

/** The metadata URI the program writes. */
export function exclusiveNftUri(
	base: string,
	traits: TraitVector,
	serial: number,
): string {
	return `${base}${exclusiveNftStem(traits, serial)}.json`;
}

const STEM = new RegExp(
	`^((?:[0-9a-f]{2}){${LAYER_COUNT}})-(0|[1-9]\\d{0,15})$`,
);

/**
 * Parse a stem (`00050203000d01-42`) back into traits and serial.
 *
 * Returns `null` for anything malformed or out of range, including uppercase
 * hex and padded serials that would give one NFT two URIs.
 */
export function parseExclusiveNftStem(stem: string): ParsedStem | null {
	const match = STEM.exec(stem);

	if (!match?.[1] || !match[2]) {
		return null;
	}

	const traits = match[1].match(/../g)?.map((byte) => parseInt(byte, 16)) ?? [];
	const serial = Number(match[2]);

	try {
		resolveTraits(traits);
		assertSerial(serial);
	} catch (error) {
		if (error instanceof RangeError) {
			return null;
		}

		throw error;
	}

	return { traits, serial };
}

/** `a` or `an`, by the first letter of `word`. */
export function article(word: string): "a" | "an" {
	return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** The collectible's name, e.g. `Solid Gold Chest #42`. */
export function exclusiveNftName(traits: TraitVector, serial: number): string {
	const finish = resolveTraits(traits)[LAYER.finish]?.name ?? "";

	return `${finish} Chest #${serial}`;
}

/** The Metaplex JSON for one Exclusive Lootbox NFT. */
export function metadataFor(
	traits: TraitVector,
	serial: number,
	options: MetadataOptions,
): ExclusiveNftMetadata {
	const chosen = resolveTraits(traits);
	const stem = exclusiveNftStem(traits, serial);
	const rarity = rarityOf(traits);
	const finish = chosen[LAYER.finish]?.name ?? "";
	const contents = chosen[LAYER.contents];
	const image = `${options.base}${stem}.svg`;
	const animated = `${options.base}${stem}.animated.svg`;
	const player = `${options.base}play.html?nft=${stem}`;

	return {
		name: exclusiveNftName(traits, serial),
		symbol: EXCLUSIVE_NFT_SYMBOL,
		description: `${contents?.name}, in ${
			article(finish)
		} ${finish} chest. ${contents?.description} ${rarity.label}. ${EXCLUSIVE_NFT_DISCLOSURE}`,
		image,
		animation_url: player,
		external_url: options.externalUrl,
		attributes: [
			...LAYERS.map((layer, index) => ({
				trait_type: layer.name,
				value: chosen[index]?.name ?? "",
			})),
			{ trait_type: "Serial", value: serial, display_type: "number" },
			{ trait_type: "Rarity", value: rarity.label },
			{
				trait_type: "Rarity score",
				value: rarity.score,
				display_type: "number",
			},
		],
		properties: {
			category: "html",
			files: [
				{ uri: image, type: "image/svg+xml" },
				{ uri: animated, type: "image/svg+xml" },
				{ uri: player, type: "text/html" },
			],
		},
	};
}
