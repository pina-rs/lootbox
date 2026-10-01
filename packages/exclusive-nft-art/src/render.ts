import { backgroundArt, CANVAS } from "./art/backgrounds.ts";
import { BADGE_PIPS, badgeArt, formatSerial } from "./art/badge.ts";
import {
	BODY_PANEL,
	BODY_SILHOUETTE,
	chest,
	LID_PANEL,
	LID_SILHOUETTE,
	POSTER_LID,
} from "./art/chest.ts";
import { contentsRoot } from "./art/contents.ts";
import { decorationArt } from "./art/decorations.ts";
import { type Bounds, effectArt, haloArt, holoArt } from "./art/effects.ts";
import { lockArt } from "./art/locks.ts";
import { type Art, type Geometry, group, rect } from "./art/model.ts";
import { patternArt } from "./art/patterns.ts";
import { SvgWriter } from "./art/svg.ts";
import { finishAt } from "./finishes.ts";
import { LAYER, resolveTraits, type TraitVector } from "./layers.ts";
import { rarestTraits, rarityOf } from "./rarity.ts";
import { renderPlan } from "./rules.ts";

/** Where the chest stands on the 1024² canvas, in chest units. */
export const STAGE = { x: 512, y: 846, scale: 1.6 } as const;

/** Chest-space bounds of the body and lid, for the holographic foil. */
export const BODY_BOUNDS: Bounds = {
	left: -152,
	right: 156,
	top: -184,
	bottom: -3,
};
export const LID_BOUNDS: Bounds = {
	left: -152,
	right: 156,
	top: -103,
	bottom: 1,
};

/** Throw unless `serial` is a non-negative safe integer. */
export function assertSerial(serial: number): void {
	if (!Number.isSafeInteger(serial) || serial < 0) {
		throw new RangeError(
			`serial must be a non-negative safe integer, got ${serial}`,
		);
	}
}

function foil(strength: number, silhouette: Geometry, bounds: Bounds): Art[] {
	if (strength <= 0) {
		return [];
	}

	return [
		group("Holofoil", { opacity: strength }, holoArt(bounds), {
			clip: [silhouette],
		}),
	];
}

/** Filled rarity pips: the rarest possible vector fills all sixteen. */
export function rarityPips(traits: TraitVector): number {
	const max = rarityOf(rarestTraits()).score;
	const score = rarityOf(traits).score;

	return Math.min(
		BADGE_PIPS,
		Math.max(1, Math.round(score / max * BADGE_PIPS)),
	);
}

/**
 * The whole poster as vector art, back to front, with each layer drawn
 * independently and the render rules applied.
 */
export function exclusiveNftArt(traits: TraitVector, serial: number): Art[] {
	const chosen = resolveTraits(traits);
	assertSerial(serial);

	const at = (id: keyof typeof LAYER) => traits[LAYER[id]] ?? 0;
	const finish = finishAt(at("finish"));
	const plan = renderPlan(traits);
	const decoration = plan.hidden.has("decoration")
		? { body: [], lid: [] }
		: decorationArt(at("decoration"));
	const effect = plan.hidden.has("effect")
		? { back: [], front: [] }
		: effectArt(at("effect"), `glints-${serial}`);
	const stage = group("Stage", {
		x: STAGE.x,
		y: STAGE.y,
		scaleX: STAGE.scale,
		scaleY: STAGE.scale,
	}, [
		chest({
			lid: POSTER_LID,
			bodyPattern: patternArt(at("pattern"), BODY_PANEL),
			lidPattern: patternArt(at("pattern"), LID_PANEL),
			bodyOverlay: foil(finish.holo, BODY_SILHOUETTE, BODY_BOUNDS),
			lidOverlay: foil(finish.holo, LID_SILHOUETTE, LID_BOUNDS),
			bodyDecoration: decoration.body,
			lidDecoration: decoration.lid,
			lock: plan.hidden.has("lock") ? [] : lockArt(at("lock")),
			lockOffset: plan.offsets.lock ?? { x: 0, y: 0 },
			contents: plan.hidden.has("contents")
				? []
				: [contentsRoot(at("contents"))],
		}),
	]);
	const name = chosen[LAYER.finish]?.name ?? "";

	return [
		...backgroundArt(at("background")),
		...(finish.halo > 0
			? [group("Finish glow", { opacity: finish.halo }, [haloArt()])]
			: []),
		...effect.back,
		stage,
		...effect.front,
		...badgeArt({
			name,
			serial,
			odds: rarityOf(traits).compact,
			pips: rarityPips(traits),
		}),
	];
}

function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/** The accessible title, e.g. `Solid Gold Chest No. 0042: A Rubber Duck`. */
export function posterTitle(traits: TraitVector, serial: number): string {
	const chosen = resolveTraits(traits);

	return `${chosen[LAYER.finish]?.name} Chest ${formatSerial(serial)}: ${
		chosen[LAYER.contents]?.name
	}`;
}

function render(
	traits: TraitVector,
	serial: number,
	animated: boolean,
): string {
	const finish = finishAt(traits[LAYER.finish] ?? -1);
	const writer = new SvgWriter(finish.palette, animated);
	// Rays and rings overflow the canvas by design; clip them so hosts that
	// ignore the viewport (nested images, some wallets) still see a square.
	const body = writer.write([
		group("Canvas", {}, exclusiveNftArt(traits, serial), {
			clip: [rect(CANVAS / 2, CANVAS / 2, CANVAS, CANVAS)],
		}),
	]);

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img"><title>${
		escapeXml(posterTitle(traits, serial))
	}</title>${writer.style}${writer.defs}<g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

/**
 * Render one Exclusive Lootbox NFT as a standalone, still 1024² SVG.
 *
 * Pure and deterministic: the same traits and serial always produce the same
 * bytes. It uses no DOM, Node, or platform API, so it runs unchanged in a
 * Cloudflare Worker, a browser, or a build script. Throws `RangeError` for an
 * invalid vector or serial.
 */
export function renderExclusiveNft(
	traits: TraitVector,
	serial: number,
): string {
	return render(traits, serial, false);
}

/**
 * The same poster with every layer's idle motion as CSS keyframes: the chest
 * breathes, the contents perform, and the effect layer loops. Viewers who
 * prefer reduced motion see the still poster.
 */
export function renderAnimatedExclusiveNft(
	traits: TraitVector,
	serial: number,
): string {
	return render(traits, serial, true);
}
