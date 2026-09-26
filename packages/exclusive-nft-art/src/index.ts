/**
 * Art, layer tables, rarity, and metadata for Exclusive Lootbox NFTs:
 * layered cartoon chests for lootbox openers who did not win a main prize.
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
export { LOOP_SECONDS, type Motion, type MotionUse } from "./art/motion.ts";
export {
	type Finish,
	finishAt,
	FINISHES,
	type FinishPalette,
	REVEAL_DRAMA_ORDER,
	type RevealDrama,
} from "./finishes.ts";
export {
	LAYER,
	type Layer,
	LAYER_COUNT,
	layerAt,
	type LayerId,
	LAYERS,
	MAX_LAYERS,
	MAX_TRAITS_PER_LAYER,
	parseVersionedTraits,
	resolveTraits,
	type Trait,
	TRAIT_VECTOR_VERSION,
	traitCode,
	traitOf,
	type TraitVector,
	type VersionedTraits,
	versionedTraits,
} from "./layers.ts";
export {
	article,
	EXCLUSIVE_NFT_DISCLOSURE,
	EXCLUSIVE_NFT_SYMBOL,
	type ExclusiveNftMetadata,
	exclusiveNftName,
	exclusiveNftStem,
	exclusiveNftUri,
	type MetadataAttribute,
	metadataFor,
	type MetadataOptions,
	type ParsedStem,
	parseExclusiveNftStem,
	traitHex,
} from "./metadata.ts";
export { playerHtml, RIVE_RUNTIME } from "./player.ts";
export {
	commonestTraits,
	compactOneIn,
	formatOneIn,
	rarestTraits,
	type Rarity,
	rarityOf,
} from "./rarity.ts";
export {
	exclusiveNftArt,
	posterTitle,
	rarityPips,
	renderAnimatedExclusiveNft,
	renderExclusiveNft,
	STAGE,
} from "./render.ts";
export {
	RENDER_RULES,
	type RenderPlan,
	renderPlan,
	type RenderRule,
	ruleApplies,
} from "./rules.ts";
