/**
 * The Empty Chest series: thirteen compressed NFTs, one per empty copy.
 *
 * An empty box is "empty, but not nothing": the PrizePool hands the opener one
 * of these chests, picked uniformly by the opening's committed randomness. The
 * `variant` is the Rive `variant` view-model value and the file stem of the
 * hosted poster and metadata (`nft/empty-chest/<variant>.png|json`).
 *
 * This module has no imports so the asset build scripts can load it directly.
 */

export type EmptyChest = Readonly<{
	variant: number;
	/** What is inside, used as the `Contents` trait. */
	thing: string;
	/** One witty line for the metadata description and the prize card. */
	line: string;
}>;

export const EMPTY_CHESTS: readonly EmptyChest[] = Object.freeze([
	{ variant: 0, thing: "A Moth", line: "Something lived in here once. It is leaving now." },
	{ variant: 1, thing: "One Odd Sock", line: "Its partner is in another chest. Probably." },
	{ variant: 2, thing: "An IOU for 0 Shares", line: "Legally cheerful. Financially zero." },
	{ variant: 3, thing: "A Cobweb, Tenant Included", line: "The spider pays no rent and considers this a win." },
	{ variant: 4, thing: "A Dust Bunny", line: "Rare breed. Sneezes on cue. Does not multiply. Yet." },
	{ variant: 5, thing: "A Rubber Duck", line: "Squeaks once per viewing. Debugs nothing." },
	{ variant: 6, thing: "A Sold Out Tag", line: "Proof you were early to something already gone." },
	{ variant: 7, thing: "A Lost Button", line: "From a coat nobody remembers owning." },
	{ variant: 8, thing: "A Paper Crown", line: "Ruler of one empty box. Long may you reign." },
	{ variant: 9, thing: "A Snail", line: "Got here before you. Will leave after you." },
	{ variant: 10, thing: "A Crumpled Receipt", line: "Total: 0.00. Keep for your records." },
	{ variant: 11, thing: "The Ghost of a Share Certificate", line: "Haunts portfolios. Harmless. Mostly." },
	{ variant: 12, thing: "An Echo", line: "…hello? …hello? …hello?" },
]);

export const EMPTY_CHEST_COUNT = EMPTY_CHESTS.length;

export const EMPTY_CHEST_DISCLOSURE =
	"An empty Unlisted box. Randomness by Switchboard; allocation recorded on-chain.";

/** The collectible's on-chain name, e.g. `Empty Chest #5 — A Dust Bunny`. */
export function emptyChestName(chest: EmptyChest): string {
	return `Empty Chest #${chest.variant + 1} — ${chest.thing}`;
}

/** One minted leaf, as written by `mint-empty-chests.ts`. */
export type EmptyChestLeaf = Readonly<{ variant: number; leafIndex: number }>;

/** `public/nft/empty-chest/assets.json`: minted asset id to variant. */
export type EmptyChestManifest = Readonly<{
	cluster: string;
	tree: string;
	assets: Readonly<Record<string, EmptyChestLeaf>>;
}>;

function chestAt(variant: number): EmptyChest | null {
	return Number.isInteger(variant) ? EMPTY_CHESTS[variant] ?? null : null;
}

/**
 * Deterministic stand-in for series without minted chests (the localnet badge
 * flow): the same opening always shows the same chest.
 *
 * FNV-1a over the opening address. It is presentation only and never implies
 * which leaf a PrizePool would have assigned.
 */
export function fallbackVariant(opening: string): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < opening.length; index++) {
		hash ^= opening.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}

	return hash % EMPTY_CHEST_COUNT;
}

/** Validate a fetched manifest; anything malformed is treated as absent. */
export function parseEmptyChestManifest(
	value: unknown,
): EmptyChestManifest | null {
	if (typeof value !== "object" || value === null) return null;

	const { cluster, tree, assets } = value as Record<string, unknown>;

	if (typeof cluster !== "string" || typeof tree !== "string") return null;

	if (typeof assets !== "object" || assets === null) return null;

	const entries = Object.entries(assets as Record<string, unknown>);
	const valid = entries.every(([, leaf]) => {
		if (typeof leaf !== "object" || leaf === null) return false;

		const { variant, leafIndex } = leaf as Record<string, unknown>;

		return typeof variant === "number" && chestAt(variant) !== null &&
			typeof leafIndex === "number" && Number.isInteger(leafIndex);
	});

	return valid
		? { cluster, tree, assets: assets as Record<string, EmptyChestLeaf> }
		: null;
}

/**
 * The chest to show for an empty opening.
 *
 * A PrizePool opening names its compressed asset; the minted manifest maps it
 * to a variant. Without a mapping (badge-based series, an unknown asset, or no
 * manifest) the opening address picks a stable stand-in.
 */
export function emptyChestFor(
	opening: string,
	assetId: string | null,
	manifest: EmptyChestManifest | null,
): EmptyChest {
	const leaf = assetId ? manifest?.assets[assetId] : undefined;
	const minted = leaf ? chestAt(leaf.variant) : null;

	if (minted) return minted;

	const standIn = chestAt(fallbackVariant(opening));

	if (!standIn) throw new Error("Empty Chest fallback is out of range");

	return standIn;
}
