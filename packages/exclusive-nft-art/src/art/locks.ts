import {
	type Art,
	ellipse,
	group,
	INK,
	line,
	type Point,
	polar,
	poly,
	rect,
	shape,
	slot,
	star,
} from "./model.ts";
import { motion, use } from "./motion.ts";

/**
 * Locks, drawn in lock-plate space: the origin is where the latch meets the
 * lid's edge and the lock hangs down to about y = 45. Indices match the
 * `lock` layer in `layers.ts`.
 */

const STEEL = "FFB8BEC4";
const STEEL_DARK = "FF7E878F";
const PAPER = "FFFBF8EE";
const GOLD = "FFF5C54E";

const KEYHOLE = poly(
	[[-5, 11], [5, 11], [3, 21], [6, 29], [-6, 29], [-3, 21]],
	true,
	2,
);

const sway = motion("lock-sway", 4, {
	rotation: [[0, 0], [.25, .06], [.75, -.06], [1, 0]],
});
const pulse = motion("lock-pulse", 1, {
	scaleX: [[0, 1], [.15, 1.12], [.3, .96], [.45, 1.06], [.7, 1], [1, 1]],
	scaleY: [[0, 1], [.15, 1.12], [.3, .96], [.45, 1.06], [.7, 1], [1, 1]],
});
const turn = motion("lock-turn", 2, {
	rotation: [[0, 0], [.5, Math.PI / 8], [1, 0]],
});
const dial = motion("lock-dial", 4, {
	rotation: [[0, 0], [.3, 1.2], [.55, -.6], [.8, .4], [1, 0]],
});
const blink = motion("lock-blink", 4, {
	scaleY: [[0, 1], [.46, 1], [.5, .08], [.54, 1], [1, 1]],
});
const look = motion("lock-look", 8, {
	x: [[0, 0], [.2, -5], [.45, -5], [.55, 5], [.8, 5], [1, 0]],
});
const chatter = motion("lock-chatter", 2, {
	y: [[0, 0], [.1, 3], [.2, 0], [.3, 3], [.4, 0], [1, 0]],
});
const shine = motion("lock-shine", 2, {
	opacity: [[0, .2], [.5, 1], [1, .2]],
});

function shieldLatch(): Art[] {
	return [
		shape(
			"Latch",
			poly([[-19, -8], [20, -7], [23, 31], [2, 45], [-22, 31]], true, 3),
			slot("lock"),
			4,
		),
		line("Latch glint", [[-11, 0], [12, 1]], slot("lockLight"), 3),
		shape("Keyhole", KEYHOLE, INK, 0),
	];
}

function padlock(): Art[] {
	return [
		group("Padlock", { rotation: 0 }, [
			shape(
				"Shackle",
				poly(
					[[-12, 8], [-12, -10], [-6, -20], [6, -20], [12, -10], [12, 8]],
					false,
					8,
				),
				undefined,
				6,
				STEEL_DARK,
			),
			shape("Body", rect(0, 20, 42, 34, 7), STEEL, 3.5),
			line("Shine", [[-14, 9], [-14, 28]], "E6FFFFFF", 3),
			shape("Keyhole", KEYHOLE, INK, 0),
		], { motion: use(sway) }),
	];
}

function combinationDial(): Art[] {
	const ticks = Array.from({ length: 12 }, (_, i) => {
		const [x1, y1] = polar(13, i * Math.PI / 6);
		const [x2, y2] = polar(16, i * Math.PI / 6);

		return poly([[x1, y1], [x2, y2]], false);
	});

	return [
		shape("Plate", rect(0, 18, 34, 50, 6), slot("trim"), 3),
		shape("Dial", ellipse(0, 20, 40, 40), "FF2B2F33", 3.5),
		group("Dial face", { y: 20 }, [
			shape("Ticks", ticks, undefined, 1.6, "CCFFFFFF"),
			shape("Knob", ellipse(0, 0, 12, 12), STEEL, 2),
			line("Marker", [[0, -12], [0, -6]], "FFEF7869", 2.4),
		], { motion: use(dial) }),
		shape(
			"Pointer",
			poly([[-4, -4], [4, -4], [0, 3]], true, 1),
			"FFEF7869",
			1.5,
		),
	];
}

function heartLock(): Art[] {
	return [
		shape(
			"Shackle",
			poly([[-8, 6], [-8, -6], [0, -12], [8, -6], [8, 6]], false, 5),
			undefined,
			4,
			GOLD,
		),
		group("Heart", { y: 20 }, [
			shape(
				"Heart",
				poly(
					[
						[0, 22],
						[-22, 0],
						[-22, -10],
						[-14, -18],
						[-4, -16],
						[0, -10],
						[4, -16],
						[
							14,
							-18,
						],
						[22, -10],
						[22, 0],
					],
					true,
					6,
				),
				"FFF27BA0",
				3.5,
			),
			line("Shine", [[-14, -8], [-9, -12]], "E6FFFFFF", 3),
			shape(
				"Keyhole",
				poly([[-3, -6], [3, -6], [2, 2], [4, 8], [-4, 8], [-2, 2]], true, 1.5),
				INK,
				0,
			),
		], { motion: use(pulse) }),
	];
}

function gearLock(): Art[] {
	return [
		group("Gear", { y: 18 }, [
			shape("Gear", star(0, 0, 50, 50, 8, .78), "FFD9A441", 3.5),
			shape("Hub", ellipse(0, 0, 22, 22), "FFB07A24", 2.5),
		], { motion: use(turn) }),
		shape(
			"Keyhole",
			poly(
				[[-3, 11], [3, 11], [2, 18], [4, 24], [-4, 24], [-2, 18]],
				true,
				1.5,
			),
			INK,
			0,
		),
	];
}

function starLock(): Art[] {
	return [
		shape("Ring", ellipse(0, -2, 10, 10), undefined, 3, GOLD),
		group("Star", { y: 22 }, [
			shape("Star", star(0, 0, 54, 54, 5, .5), GOLD, 3.5),
			line("Shine", [[-6, -12], [-2, -18]], "E6FFFFFF", 2.5),
			shape(
				"Keyhole",
				poly(
					[[-2.5, -4], [2.5, -4], [1.5, 2], [3, 7], [-3, 7], [-1.5, 2]],
					true,
					1,
				),
				INK,
				0,
			),
		], { motion: use(sway, .3) }),
	];
}

function skullLock(): Art[] {
	return [
		shape("Skull", ellipse(0, 12, 42, 36), "FFF2EAD8", 3.5),
		shape("Eye", ellipse(-9, 10, 11, 12), INK, 0),
		shape("Eye", ellipse(9, 10, 11, 12), INK, 0),
		shape("Nose keyhole", poly([[0, 17], [-3, 23], [3, 23]], true, 1), INK, 0),
		group("Jaw", {}, [
			shape("Jaw", rect(0, 33, 26, 14, 5), "FFF2EAD8", 3),
			line("Teeth", [[-6, 28], [-6, 38]], INK, 1.6),
			line("Teeth", [[0, 28], [0, 38]], INK, 1.6),
			line("Teeth", [[6, 28], [6, 38]], INK, 1.6),
		], { motion: use(chatter) }),
	];
}

function crystalLock(): Art[] {
	const gem: readonly Point[] = [[-16, 4], [16, 4], [20, 16], [0, 46], [
		-20,
		16,
	]];

	return [
		shape("Cap", rect(0, 0, 26, 10, 3), GOLD, 3),
		shape("Crystal", poly(gem, true, 2), "FF7FE3F0", 3.5),
		shape(
			"Facets",
			[
				poly([[-20, 16], [20, 16]], false),
				poly([[-8, 4], [-6, 16], [0, 46]], false),
				poly([[8, 4], [6, 16], [0, 46]], false),
			],
			undefined,
			1.6,
			"B3FFFFFF",
		),
		group("Sparkle", { x: 8, y: 10 }, [
			shape("Glint", star(0, 0, 14, 14, 4, .3), "FFFFFFFF", 0),
		], { motion: use(shine) }),
	];
}

function keyholeEye(): Art[] {
	const almond = poly(
		[[-24, 0], [-12, -12], [12, -12], [24, 0], [12, 12], [-12, 12]],
		true,
		10,
	);

	return [
		group("Eye", { y: 22 }, [
			shape("White", almond, PAPER, 3.5),
			group("Iris", {}, [
				shape("Iris", ellipse(0, 0, 20, 20), "FF4C7FD1", 2),
				shape(
					"Pupil keyhole",
					poly(
						[[-2.5, -6], [2.5, -6], [1.5, 0], [3.5, 6], [-3.5, 6], [-1.5, 0]],
						true,
						1,
					),
					INK,
					0,
				),
				shape("Catchlight", ellipse(4, -4, 4, 4), "FFFFFFFF", 0),
			], { motion: use(look) }),
			line("Lash", [[-12, -13], [-15, -19]], INK, 2.5),
			line("Lash", [[0, -14], [0, -21]], INK, 2.5),
			line("Lash", [[12, -13], [15, -19]], INK, 2.5),
		], { motion: use(blink) }),
	];
}

const DRAWINGS: readonly (() => Art[])[] = [
	shieldLatch,
	padlock,
	combinationDial,
	heartLock,
	gearLock,
	starLock,
	skullLock,
	crystalLock,
	keyholeEye,
	() => [],
];

export const LOCK_ART_COUNT = DRAWINGS.length;

/** The lock for `index`, in lock-plate space. */
export function lockArt(index: number): Art[] {
	const draw = DRAWINGS[index];

	if (!draw) {
		throw new RangeError(`No lock art at ${index}`);
	}

	return draw();
}
