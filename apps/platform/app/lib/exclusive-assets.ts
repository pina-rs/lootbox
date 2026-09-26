/**
 * What `/x/<collection>/<file>` serves for an Exclusive Lootbox NFT.
 *
 * The program writes each leaf's URI as `{base}{hex traits}-{serial}.json`,
 * with the base `https://lootbox.so/x/<collection>/`. Everything beside the
 * JSON is derived from the same stem, so art is deterministic and immutable:
 *
 * - `<stem>.json`: Metaplex metadata (`metadataFor` from the art package);
 * - `<stem>.svg` and `<stem>.animated.svg`: the still and animated posters;
 * - `<stem>.png`: the still poster as PNG (rendered by the Worker);
 * - `play.html?nft=<stem>`: the Rive reveal, falling back to the animated SVG;
 * - `collection.json`: the Core collection's metadata;
 * - `exclusive-nft.riv`: the Rive file the player loads.
 *
 * Pure: parsing and JSON only, so the rules are unit tested.
 */
import {
	EXCLUSIVE_NFT_DISCLOSURE,
	EXCLUSIVE_NFT_SYMBOL,
	metadataFor,
	type ParsedStem,
	parseExclusiveNftStem,
} from "@pina-rs/exclusive-nft-art";

export const IMMUTABLE = "public, max-age=31536000, immutable";

export type ExclusiveAsset =
	| Readonly<{ kind: "json" | "svg" | "animated" | "png"; stem: ParsedStem }>
	| Readonly<{ kind: "player" | "collection" | "rive" }>;

const FILE =
	/^((?:[0-9a-f]{2})+-(?:0|[1-9]\d{0,15}))\.(json|svg|animated\.svg|png)$/;

/** Parse the file part of `/x/<collection>/<file>`; `null` means 404. */
export function parseExclusiveAsset(file: string): ExclusiveAsset | null {
	if (file === "play.html") return { kind: "player" };

	if (file === "collection.json") return { kind: "collection" };

	if (file === "exclusive-nft.riv") return { kind: "rive" };

	const match = FILE.exec(file);
	const stem = match?.[1] ? parseExclusiveNftStem(match[1]) : null;

	if (!match || !stem) return null;

	switch (match[2]) {
		case "json":
			return { kind: "json", stem };
		case "svg":
			return { kind: "svg", stem };
		case "animated.svg":
			return { kind: "animated", stem };
		default:
			return { kind: "png", stem };
	}
}

export function exclusiveBase(origin: string, collection: string): string {
	return `${origin}/x/${collection}/`;
}

/** Metaplex JSON for one minted NFT, with a PNG image wallets can show. */
export function exclusiveMetadata(
	stem: ParsedStem,
	options: Readonly<{ origin: string; collection: string }>,
) {
	const base = exclusiveBase(options.origin, options.collection);
	const metadata = metadataFor(stem.traits, stem.serial, {
		base,
		externalUrl: `${options.origin}/`,
	});
	const png = metadata.image.replace(/\.svg$/, ".png");

	return {
		...metadata,
		image: png,
		properties: {
			...metadata.properties,
			files: [{ uri: png, type: "image/png" }, ...metadata.properties.files],
		},
	};
}

/** Metadata for the Core collection itself (`{base}collection.json`). */
export function exclusiveCollectionMetadata(
	options: Readonly<{ origin: string }>,
) {
	return {
		name: "Exclusive Lootbox NFTs",
		symbol: EXCLUSIVE_NFT_SYMBOL,
		description: EXCLUSIVE_NFT_DISCLOSURE,
		image: `${options.origin}/box.png`,
		external_url: `${options.origin}/`,
		properties: {
			category: "image",
			files: [{ uri: `${options.origin}/box.png`, type: "image/png" }],
		},
	};
}
