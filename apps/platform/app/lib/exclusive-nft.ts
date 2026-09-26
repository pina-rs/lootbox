/**
 * Exclusive Lootbox NFTs: the consolation prize for boxes without a bundle.
 *
 * The program work that mints these on claim is in progress on a separate
 * branch. This module fixes the agreed contract so the wizard, odds, and cost
 * review can be built now:
 *
 * - sixteen rarity tiers, `0` (most common) to `15` (rarest);
 * - default weight of tier `k` is `2^(15 - k)`, so each tier is half as likely
 *   as the one before it;
 * - metadata URI `{base}{tier}-{contents}-{background}-{pattern}-{serial}.json`.
 *
 * `exclusiveNftAdapter` reports `unavailable` until the SDK exposes the prize
 * kind, and the `FEATURE_EXCLUSIVE_NFTS` flag keeps the UI read-only until then.
 */
export const EXCLUSIVE_TIER_COUNT = 16;

/** Friendly tier names, common to rare. */
export const EXCLUSIVE_TIER_NAMES: readonly string[] = [
	"Dust",
	"Pebble",
	"Twig",
	"Button",
	"Marble",
	"Feather",
	"Seashell",
	"Brass Key",
	"Old Coin",
	"Lantern",
	"Compass",
	"Crown",
	"Comet",
	"Nebula",
	"Supernova",
	"Singularity",
];

/** Default weights: `2^(15 - k)` for tier `k`. */
export function defaultExclusiveWeights(): number[] {
	return Array.from(
		{ length: EXCLUSIVE_TIER_COUNT },
		(_, tier) => 2 ** (EXCLUSIVE_TIER_COUNT - 1 - tier),
	);
}

export type TierOdds = Readonly<{
	tier: number;
	name: string;
	weight: number;
	/** Chance that one consolation box lands on this tier, 0 to 100. */
	percent: number;
}>;

/** Per-tier chance for one consolation box. All-zero weights give 0%. */
export function exclusiveTierOdds(weights: readonly number[]): TierOdds[] {
	if (weights.length !== EXCLUSIVE_TIER_COUNT) {
		throw new RangeError(`expected ${EXCLUSIVE_TIER_COUNT} tier weights`);
	}

	const total = weights.reduce((sum, weight) => sum + weight, 0);

	return weights.map((weight, tier) => ({
		tier,
		name: EXCLUSIVE_TIER_NAMES[tier] ?? `Tier ${tier}`,
		weight,
		percent: total === 0 ? 0 : (weight / total) * 100,
	}));
}

export type ExclusiveNftTraits = Readonly<{
	tier: number;
	contents: number;
	background: number;
	pattern: number;
	serial: number;
}>;

/** Metadata URI for one minted Exclusive Lootbox NFT. */
export function exclusiveNftUri(
	base: string,
	traits: ExclusiveNftTraits,
): string {
	const parts = [
		traits.tier,
		traits.contents,
		traits.background,
		traits.pattern,
		traits.serial,
	];

	if (
		!parts.every((part) => Number.isSafeInteger(part) && part >= 0) ||
		traits.tier >= EXCLUSIVE_TIER_COUNT
	) throw new RangeError("invalid Exclusive Lootbox NFT traits");

	return `${base}${parts.join("-")}.json`;
}

export type ExclusiveNftRequest = Readonly<{
	count: bigint;
	weights: readonly number[];
	baseUri: string;
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
				"Exclusive Lootbox NFTs arrive with the next program release. You can plan them now; they are not included when you launch.",
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
