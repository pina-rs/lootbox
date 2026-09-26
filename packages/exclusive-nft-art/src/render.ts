import { backgroundArt, CANVAS } from "./art/backgrounds.ts";
import { badgeArt, formatSerial } from "./art/badge.ts";
import {
	BODY_PANEL,
	BODY_SILHOUETTE,
	chest,
	LID_PANEL,
	LID_SILHOUETTE,
	POSTER_LID,
} from "./art/chest.ts";
import { contentsRoot } from "./art/contents.ts";
import {
	cosmosBackArt,
	cosmosFrontArt,
	haloArt,
	holoArt,
	raysArt,
	sparkleArt,
	sparklePlacements,
} from "./art/effects.ts";
import { type Art, group, rect } from "./art/model.ts";
import { patternArt } from "./art/patterns.ts";
import { SvgWriter } from "./art/svg.ts";
import { type Tier, tierAt } from "./tiers.ts";
import {
	BACKGROUNDS,
	CONTENTS,
	PATTERNS,
	type Trait,
	traitAt,
} from "./traits.ts";

/** The five on-chain fields behind one Exclusive Lootbox NFT. */
export type ExclusiveNftTraits = Readonly<{
	tier: number;
	contents: number;
	background: number;
	pattern: number;
	serial: number;
}>;

/** The traits resolved against the tier table and catalogs. */
export type ResolvedTraits = Readonly<{
	tier: Tier;
	contents: Trait;
	background: Trait;
	pattern: Trait;
	serial: number;
}>;

/** Where the chest stands on the 1024² canvas, in chest units. */
export const STAGE = { x: 512, y: 846, scale: 1.6 } as const;

/** Chest-space bounds of the body and lid, for the holographic foil. */
const BODY_BOUNDS = { left: -152, right: 156, top: -184, bottom: -3 };
const LID_BOUNDS = { left: -152, right: 156, top: -103, bottom: 1 };

/**
 * Validate and resolve raw on-chain fields.
 *
 * Throws a `RangeError` naming the first out-of-range field, so a Worker can
 * turn a bad URI into a 404 instead of rendering a broken chest.
 */
export function resolveTraits(traits: ExclusiveNftTraits): ResolvedTraits {
	if (!Number.isSafeInteger(traits.serial) || traits.serial < 0) {
		throw new RangeError(
			`serial must be a non-negative safe integer, got ${traits.serial}`,
		);
	}

	return {
		tier: tierAt(traits.tier),
		contents: traitAt(CONTENTS, traits.contents, "contents"),
		background: traitAt(BACKGROUNDS, traits.background, "background"),
		pattern: traitAt(PATTERNS, traits.pattern, "pattern"),
		serial: traits.serial,
	};
}

function foil(
	strength: number,
	silhouette: typeof BODY_SILHOUETTE,
	bounds: typeof BODY_BOUNDS,
): Art[] {
	if (strength <= 0) {
		return [];
	}

	return [
		group("Holofoil", { opacity: strength }, holoArt(bounds), {
			clip: [silhouette],
		}),
	];
}

/** The whole poster as vector art, back to front. */
export function exclusiveNftArt(traits: ExclusiveNftTraits): Art[] {
	const { tier, serial } = resolveTraits(traits);
	const { effects } = tier;
	const stage = group("Stage", {
		x: STAGE.x,
		y: STAGE.y,
		scaleX: STAGE.scale,
		scaleY: STAGE.scale,
	}, [
		chest({
			lid: POSTER_LID,
			bodyPattern: patternArt(traits.pattern, BODY_PANEL),
			lidPattern: patternArt(traits.pattern, LID_PANEL),
			bodyOverlay: foil(effects.holo, BODY_SILHOUETTE, BODY_BOUNDS),
			lidOverlay: foil(effects.holo, LID_SILHOUETTE, LID_BOUNDS),
			contents: [contentsRoot(traits.contents)],
		}),
	]);
	// Serial seeds the sparkle scatter, so two chests of one tier never
	// sparkle identically.
	const sparkles = sparklePlacements(
		effects.sparkles,
		`sparkles-${tier.index}-${serial}`,
	)
		.map(({ x, y, size, rotation }) => sparkleArt(x, y, size, rotation));

	return [
		...backgroundArt(traits.background),
		...(effects.halo > 0
			? [group("Halo", { opacity: effects.halo }, haloArt())]
			: []),
		...cosmosBackArt(effects.cosmos),
		...(effects.rays > 0
			? [group("Gold burst", { opacity: .9 }, raysArt(effects.rays))]
			: []),
		stage,
		...cosmosFrontArt(effects.cosmos),
		...sparkles,
		...badgeArt(tier, serial),
	];
}

function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/**
 * Render one Exclusive Lootbox NFT as a standalone 1024² SVG.
 *
 * Pure and deterministic: the same traits always produce the same bytes. It
 * uses no DOM, Node, or platform API, so it runs unchanged in a Cloudflare
 * Worker, a browser, or a build script.
 */
export function renderExclusiveNft(traits: ExclusiveNftTraits): string {
	const resolved = resolveTraits(traits);
	const writer = new SvgWriter(resolved.tier.palette);
	// Rays and rings overflow the canvas by design; clip them so hosts that
	// ignore the viewport (nested images, some wallets) still see a square.
	const body = writer.write([
		group("Canvas", {}, exclusiveNftArt(traits), {
			clip: [rect(CANVAS / 2, CANVAS / 2, CANVAS, CANVAS)],
		}),
	]);
	const title = `${resolved.tier.name} Chest ${
		formatSerial(resolved.serial)
	}: ${resolved.contents.name}`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img"><title>${
		escapeXml(title)
	}</title>${writer.defs}<g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}
