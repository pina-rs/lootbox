import { lettering, textWidth } from "./lettering.ts";
import {
	type Art,
	ellipse,
	group,
	INK,
	poly,
	rect,
	shape,
	slot,
} from "./model.ts";

/**
 * The plaque along the bottom edge: a gem in the finish's trim color, the
 * chest's name, a sixteen-pip rarity meter, the serial, and the odds.
 */
export type BadgeText = Readonly<{
	name: string;
	serial: number;
	/** Short odds, e.g. `1 in 3.1 billion`. */
	odds: string;
	/** Filled rarity pips, 1–16. */
	pips: number;
}>;

export const BADGE_PIPS = 16;
const PAPER = "FFFBF8EE";
const CENTER_X = 512;
const CENTER_Y = 952;
const WIDTH = 700;
const HEIGHT = 96;
const LEFT = CENTER_X - WIDTH / 2;
const RIGHT = CENTER_X + WIDTH / 2;
const NAME_SIZE = 24;
const PIP_GAP = 14;

/** `No. 0042`: at least four digits, so early serials still look collectible. */
export function formatSerial(serial: number): string {
	return `No. ${String(serial).padStart(4, "0")}`;
}

export function badgeArt(
	{ name, serial, odds, pips: filled }: BadgeText,
): Art[] {
	const serialText = formatSerial(serial);
	const serialSize = 22;
	const nameLeft = LEFT + 78;
	const serialRight = RIGHT - 36;
	const room = serialRight - textWidth(serialText, serialSize) - 28 - nameLeft;
	const nameSize = Math.min(NAME_SIZE, room / textWidth(name, 1));
	const pips = Array.from({ length: BADGE_PIPS }, (_, i) =>
		shape(
			"Pip",
			ellipse(nameLeft + 5 + i * PIP_GAP, CENTER_Y + 22, 9, 9),
			i < filled ? slot("trim") : undefined,
			i < filled ? 0 : 1.5,
			"66FBF8EE",
		));

	return [
		group("Plaque", {}, [
			shape(
				"Plaque shadow",
				rect(CENTER_X, CENTER_Y + 6, WIDTH, HEIGHT, 48),
				"33243D40",
				0,
			),
			shape(
				"Plaque",
				rect(CENTER_X, CENTER_Y, WIDTH, HEIGHT, 48),
				INK,
				3,
				slot("trim"),
			),
			shape(
				"Gem",
				poly(
					[[LEFT + 44, CENTER_Y - 24], [LEFT + 64, CENTER_Y - 4], [
						LEFT + 44,
						CENTER_Y + 24,
					], [
						LEFT + 24,
						CENTER_Y - 4,
					]],
					true,
					3,
				),
				slot("trim"),
				3,
				PAPER,
			),
			shape(
				"Gem facet",
				poly([[LEFT + 36, CENTER_Y - 10], [LEFT + 44, CENTER_Y - 18]], false),
				undefined,
				3,
				slot("trimLight"),
			),
			lettering(
				"Name",
				name,
				nameLeft,
				CENTER_Y - 32,
				nameSize,
				PAPER,
				3.4,
				"start",
			),
			...pips,
			lettering(
				"Serial",
				serialText,
				serialRight,
				CENTER_Y - 30,
				serialSize,
				PAPER,
				3.2,
				"end",
			),
			lettering(
				"Odds",
				odds,
				serialRight,
				CENTER_Y + 13,
				13,
				"B3FBF8EE",
				2,
				"end",
			),
		]),
	];
}
