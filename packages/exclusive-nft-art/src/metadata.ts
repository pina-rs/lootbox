import { type ExclusiveNftTraits, resolveTraits } from "./render.ts";

/**
 * Metaplex JSON and URI helpers for Exclusive Lootbox NFTs.
 *
 * The program writes each NFT's URI as
 * `{base}{tier}-{contents}-{background}-{pattern}-{serial}.json`. A host (for
 * example a Cloudflare Worker) parses that path back into traits with
 * `parseExclusiveNftStem`, then serves `metadataFor` and `renderExclusiveNft`.
 */

export const EXCLUSIVE_NFT_SYMBOL = "EXCHEST";

export const EXCLUSIVE_NFT_DISCLOSURE =
	"An Exclusive Chest for an Unlisted opening without a main prize. Tier, contents, background, and pattern are drawn on-chain from the opening's committed randomness.";

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

/** `{tier}-{contents}-{background}-{pattern}-{serial}`, the shared file stem. */
export function exclusiveNftStem(traits: ExclusiveNftTraits): string {
	const { tier, contents, background, pattern, serial } = traits;

	return `${tier}-${contents}-${background}-${pattern}-${serial}`;
}

/** The metadata URI the program writes for `traits`. */
export function exclusiveNftUri(
	base: string,
	traits: ExclusiveNftTraits,
): string {
	return `${base}${exclusiveNftStem(traits)}.json`;
}

const STEM = /^(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,16})$/;

/**
 * Parse a file stem (`3-5-0-2-42`) back into traits.
 *
 * Returns `null` for anything malformed or out of range, including leading
 * zeros that would give one NFT two URIs.
 */
export function parseExclusiveNftStem(stem: string): ExclusiveNftTraits | null {
	const match = STEM.exec(stem);

	if (!match) {
		return null;
	}

	const fields = match.slice(1);

	if (fields.some((field) => field.length > 1 && field.startsWith("0"))) {
		return null;
	}

	const [tier, contents, background, pattern, serial] = fields.map(Number);

	if (
		tier === undefined || contents === undefined || background === undefined ||
		pattern === undefined || serial === undefined
	) {
		return null;
	}

	const traits = { tier, contents, background, pattern, serial };

	try {
		resolveTraits(traits);
	} catch (error) {
		if (error instanceof RangeError) {
			return null;
		}

		throw error;
	}

	return traits;
}

/** The Metaplex JSON for one Exclusive Lootbox NFT. */
export function metadataFor(
	traits: ExclusiveNftTraits,
	options: MetadataOptions,
): ExclusiveNftMetadata {
	const { tier, contents, background, pattern, serial } = resolveTraits(traits);
	const stem = exclusiveNftStem(traits);
	const image = `${options.base}${stem}.svg`;
	const player = `${options.base}play.html?nft=${stem}`;

	return {
		name: `${tier.name} Chest #${serial}`,
		symbol: EXCLUSIVE_NFT_SYMBOL,
		description:
			`${contents.name}, in a ${tier.name} chest. ${contents.line} ${tier.line} ${EXCLUSIVE_NFT_DISCLOSURE}`,
		image,
		animation_url: player,
		external_url: options.externalUrl,
		attributes: [
			{ trait_type: "Tier", value: tier.name },
			{ trait_type: "Finish", value: tier.finish },
			{ trait_type: "Contents", value: contents.name },
			{ trait_type: "Background", value: background.name },
			{ trait_type: "Pattern", value: pattern.name },
			{ trait_type: "Serial", value: serial, display_type: "number" },
			{ trait_type: "Odds", value: tier.odds },
		],
		properties: {
			category: "html",
			files: [
				{ uri: image, type: "image/svg+xml" },
				{ uri: player, type: "text/html" },
			],
		},
	};
}
