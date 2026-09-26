/**
 * Art, tiers, and metadata for Exclusive Lootbox NFTs: rarity-tiered cartoon
 * chests for lootbox openers who did not win a main prize.
 *
 * Everything here is pure TypeScript with no DOM or Node dependency, so it
 * runs in Cloudflare Workers, browsers, and build scripts alike.
 */
export { formatSerial } from "./art/badge.ts";
export type {
	Art,
	Color,
	FinishSlot,
	Geometry,
	Gradient,
	Group,
	Paint,
	Point,
	Shape,
} from "./art/model.ts";
export {
	EXCLUSIVE_NFT_DISCLOSURE,
	EXCLUSIVE_NFT_SYMBOL,
	type ExclusiveNftMetadata,
	exclusiveNftStem,
	exclusiveNftUri,
	type MetadataAttribute,
	metadataFor,
	type MetadataOptions,
	parseExclusiveNftStem,
} from "./metadata.ts";
export {
	exclusiveNftArt,
	type ExclusiveNftTraits,
	renderExclusiveNft,
	type ResolvedTraits,
	resolveTraits,
	STAGE,
} from "./render.ts";
export {
	formatOdds,
	REVEAL_DRAMA_ORDER,
	type RevealDrama,
	type Tier,
	TIER_COUNT,
	tierAt,
	type TierEffects,
	type TierPalette,
	TIERS,
	tierWeight,
	TOTAL_TIER_WEIGHT,
} from "./tiers.ts";
export {
	BACKGROUNDS,
	CONTENTS,
	MAX_CONTENTS,
	PATTERNS,
	type Trait,
	traitAt,
} from "./traits.ts";
