/**
 * Box token metadata served at `GET /m/<boxMint>.json`.
 *
 * The box mint's on-chain URI is immutable, so it points at this route; the
 * JSON is rebuilt from the creator's current display copy on every request.
 * Wallets that refresh metadata therefore follow the creator's edits.
 */
export type BoxMetadataSource = Readonly<{
	slug: string;
	title: string;
	symbol: string;
	tagline: string;
	descriptionMd: string;
	coverUrl: string | null;
}>;

export type BoxMetadataJson = Readonly<{
	name: string;
	symbol: string;
	description: string;
	image: string;
	external_url: string;
	attributes: readonly Readonly<{ trait_type: string; value: string }>[];
	properties: Readonly<{
		category: "image";
		files: readonly Readonly<{ uri: string; type: string }>[];
	}>;
}>;

/** Strip Markdown syntax for plain-text wallet descriptions. */
export function plainText(markdown: string): string {
	return markdown
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[*_`#>]/g, "")
		.replace(/^\s*-\s+/gm, "• ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function boxMetadata(
	source: BoxMetadataSource,
	origin: string,
): BoxMetadataJson {
	const image = source.coverUrl ?? `${origin}/box.png`;
	const summary = [source.tagline, plainText(source.descriptionMd)]
		.filter(Boolean)
		.join("\n\n");

	return {
		name: source.title,
		symbol: source.symbol,
		description: summary ||
			`A sealed lootbox. Open it on ${origin.replace(/^https?:\/\//, "")}.`,
		image,
		external_url: `${origin}/l/${source.slug}`,
		attributes: [{ trait_type: "Type", value: "Sealed lootbox" }],
		properties: {
			category: "image",
			files: [{
				uri: image,
				type: image.endsWith(".png") ? "image/png" : "image/*",
			}],
		},
	};
}
