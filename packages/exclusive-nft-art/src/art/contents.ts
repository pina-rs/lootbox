import { lettering } from "./lettering.ts";
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
	star,
	withAlpha,
} from "./model.ts";
import { motion, type MotionUse, use } from "./motion.ts";

// Idle motions. Each loops seamlessly inside the shared eight-second loop.
const flap = motion("moth-flap", .5, { scaleX: [[0, 1], [.5, .3], [1, 1]] });
const rock = motion("contents-rock", 4, {
	rotation: [[0, 0], [.25, .05], [.75, -.05], [1, 0]],
});
const swing = motion("contents-swing", 4, {
	rotation: [[0, 0], [.25, .16], [.75, -.16], [1, 0]],
});
const wiggle = motion("contents-wiggle", 2, {
	rotation: [[0, 0], [.25, .22], [.5, -.05], [.75, .18], [1, 0]],
});
const bob = motion("contents-bob", 2, { y: [[0, 0], [.5, 10], [1, 0]] });
const blink = motion("contents-blink", 4, {
	scaleY: [[0, 1], [.46, 1], [.5, .1], [.54, 1], [1, 1]],
});
const breathe = motion("contents-breathe", 4, {
	scaleX: [[0, 1], [.5, 1.04], [1, 1]],
	scaleY: [[0, 1], [.5, .97], [1, 1]],
});
const haunt = motion("contents-haunt", 4, {
	y: [[0, 0], [.5, -10], [1, 0]],
	opacity: [[0, 1], [.5, .7], [1, 1]],
});
const echoPulse = motion("contents-echo", 2, {
	opacity: [[0, .2], [.5, 1], [1, .2]],
});
const snap = motion("contents-snap", 2, {
	rotation: [[0, 0], [.1, -.35], [.2, 0], [.3, -.35], [.4, 0], [1, 0]],
});
const flip = motion("contents-flip", 4, {
	scaleX: [[0, 1], [.4, 1], [.5, .12], [.6, 1], [1, 1]],
});
const glowPulse = motion("contents-glow", 2, {
	opacity: [[0, .4], [.5, 1], [1, .4]],
});

/**
 * The things inside the chest. Indices match the `contents` URI field and the
 * `CONTENTS` catalog in `traits.ts`.
 *
 * The first thirteen are the Empty Chest things, redrawn from the same paths.
 * Each drawing sits in its own art space with y = 0 at its base, scaled by
 * `scale`, and is posed at `peek` (relative to the chest's contents line) for
 * the poster.
 */
export type ContentsArt = Readonly<{
	scale: number;
	/** Whole-item idle motion around its base, if any. */
	idle?: MotionUse;
	peek: Readonly<{ x: number; y: number; rotation: number }>;
	art: readonly Art[];
}>;

const PAPER = "FFFBF8EE";
const IVORY = "FFF3EDDA";
const GOLD = "FFF5C54E";
const CORAL = "FFEF7869";
const DEEP_CORAL = "FFD9534A";
const TEAL = "FF39AB9F";

function moth(): ContentsArt {
	const wing = (side: 1 | -1): Art[] => [
		shape(
			"Wing",
			poly(
				[[0, 0], [30 * side, -26], [48 * side, -14], [42 * side, 8], [
					18 * side,
					16,
				]],
				true,
				9,
			),
			"FFE8DAB6",
		),
		shape("Wing spot", ellipse(28 * side, -6, 11, 11), "FFB39B72", 2),
	];

	return {
		scale: 2,
		idle: use(bob, .5),
		peek: { x: 84, y: -292, rotation: -.3 },
		art: [
			group("Right wing", { y: -24, rotation: -.12 }, wing(1), {
				motion: use(flap),
			}),
			group("Left wing", { y: -24, rotation: .12 }, wing(-1), {
				motion: use(flap),
			}),
			shape("Body", ellipse(0, -22, 18, 38), "FFBFA67C"),
			line("Stripe", [[-6, -26], [6, -26]]),
			line("Stripe", [[-6, -16], [6, -16]]),
			shape("Head", ellipse(0, -44, 20, 18), "FFD9C59C"),
			shape("Eye", ellipse(-4, -45, 4, 4), INK, 0),
			shape("Eye", ellipse(4, -45, 4, 4), INK, 0),
			line("Antenna", [[-3, -52], [-9, -66], [-17, -68]]),
			line("Antenna", [[3, -52], [9, -66], [17, -68]]),
		],
	};
}

function sock(): ContentsArt {
	return {
		scale: 1.25,
		idle: use(rock),
		peek: { x: -6, y: -200, rotation: -.08 },
		art: [
			shape("Leg", rect(0, -36, 42, 74, 4), CORAL),
			line("Cuff ribs", [[-10, -4], [-10, -12]]),
			...[-18, -36, -54].map((y) =>
				line("Stripe", [[-19, y], [19, y]], TEAL, 6)
			),
			group("Foot", { y: -70, rotation: .7 }, [
				shape(
					"Foot",
					poly(
						[[-21, 4], [-21, -48], [-6, -63], [42, -63], [56, -50], [52, -32], [
							21,
							-28,
						], [21, 4]],
						true,
						10,
					),
					CORAL,
				),
				line("Foot stripe", [[-19, -16], [19, -16]], TEAL, 6),
				shape(
					"Heel",
					poly(
						[[-21, -30], [-21, -50], [-8, -62], [2, -58], [-6, -32]],
						true,
						5,
					),
					GOLD,
					3,
				),
				shape(
					"Toe",
					poly(
						[[30, -62], [44, -62], [56, -50], [52, -34], [36, -30]],
						true,
						6,
					),
					GOLD,
					3,
				),
			], { motion: use(wiggle) }),
		],
	};
}

function iou(): ContentsArt {
	return {
		scale: 1.45,
		idle: use(rock),
		peek: { x: 0, y: -200, rotation: -.06 },
		art: [
			shape("Slip", rect(0, -52, 156, 96, 6), PAPER),
			shape("Perforation", rect(0, -52, 138, 80, 4), undefined, 1.5, TEAL),
			lettering("IOU", "IOU", 0, -86, 30, INK, 4.5),
			lettering("Zero shares", "0 SHARES", -8, -46, 13, DEEP_CORAL, 2.6),
			line("Signature", [
				[18, -18],
				[26, -26],
				[30, -16],
				[38, -26],
				[46, -18],
				[
					58,
					-20,
				],
			]),
		],
	};
}

function cobweb(): ContentsArt {
	const angle = (i: number) => i * Math.PI / 4 + .2;
	const spokes = Array.from({ length: 8 }, (_, i) => {
		const [x, y] = polar(58, angle(i));

		return poly([[0, -70], [x, y - 70]], false);
	});
	const ring = (radius: number) =>
		poly(
			Array.from({ length: 8 }, (_, i): Point => {
				const sag = i % 2 ? .86 : 1;
				const [x, y] = polar(radius * sag, angle(i));

				return [x, y - 70];
			}),
			true,
		);
	const legs = [-1, 1].flatMap((side) =>
		[-6, 0, 6].map((y) =>
			line(
				"Leg",
				[[4 * side, y], [13 * side, y - 7], [18 * side, y + 4]],
				INK,
				2.2,
			)
		)
	);

	return {
		scale: 1.3,
		idle: use(rock, .5),
		peek: { x: 0, y: -236, rotation: 0 },
		art: [
			shape(
				"Web",
				[...spokes, ring(20), ring(38), ring(56)],
				undefined,
				2.4,
				"FF9FB2AC",
			),
			line("Silk", [[0, -70], [0, -30]], "FF8FA8A2", 1.6),
			group("Spider", { y: -24, rotation: .2 }, [
				...legs,
				shape("Body", ellipse(0, 0, 16, 16), INK, 0),
				shape("Eye", ellipse(-3, -3, 4, 4), PAPER, 0),
				shape("Eye", ellipse(3, -3, 4, 4), PAPER, 0),
			], { motion: use(bob) }),
		],
	};
}

function dustBunny(): ContentsArt {
	const fluff = "FFBDB5A4";

	return {
		scale: 1.4,
		idle: use(breathe),
		peek: { x: 10, y: -212, rotation: .06 },
		art: [
			shape(
				"Ear",
				poly([[10, -76], [22, -118], [36, -110], [22, -70]], true, 7),
				fluff,
			),
			shape(
				"Ear",
				poly([[-18, -70], [-30, -112], [-16, -116], [-8, -76]], true, 7),
				fluff,
			),
			shape("Fluff", star(0, -40, 96, 82, 22, .84), fluff),
			shape("Blush", ellipse(26, -34, 10, 5), "FFF2A89C", 0),
			shape("Blush", ellipse(-26, -34, 10, 5), "FFF2A89C", 0),
			group("Eyes", { y: -48 }, [
				shape("Eye", ellipse(13, 0, 14, 16), PAPER, 2.5),
				shape("Eye", ellipse(-13, 0, 14, 16), PAPER, 2.5),
				shape("Pupil", ellipse(14, 1, 6, 8), INK, 0),
				shape("Pupil", ellipse(-12, 1, 6, 8), INK, 0),
			], { motion: use(blink) }),
		],
	};
}

function duck(): ContentsArt {
	const yellow = "FFF7D046";

	return {
		scale: 1.5,
		idle: use(rock, .5),
		peek: { x: 0, y: -210, rotation: .04 },
		art: [
			shape(
				"Body",
				poly(
					[
						[-54, -54],
						[-40, -46],
						[-4, -48],
						[24, -50],
						[52, -40],
						[48, -10],
						[
							22,
							0,
						],
						[-30, 0],
						[-50, -16],
					],
					true,
					16,
				),
				yellow,
			),
			line("Belly shine", [[-30, -20], [-10, -14], [10, -14]], "FFFFF1BA", 3),
			shape("Head", ellipse(24, -72, 50, 48), yellow),
			shape(
				"Wing",
				poly([[-22, -44], [-4, -50], [10, -40], [-8, -30]], true, 8),
				"FFF2BF2E",
				3,
			),
			shape(
				"Beak",
				poly([[42, -76], [66, -74], [64, -62], [42, -60]], true, 5),
				"FFF08A3C",
			),
			shape("Eye", ellipse(28, -78, 8, 10), INK, 0),
			shape("Eye shine", ellipse(29, -80, 3, 3), PAPER, 0),
		],
	};
}

function soldOutTag(): ContentsArt {
	return {
		scale: 1.2,
		peek: { x: 0, y: -244, rotation: 0 },
		art: [
			group("Tag", { y: -140, rotation: .16 }, [
				line(
					"String",
					[[0, 50], [-12, 26], [-4, 0], [10, 20], [0, 50]],
					INK,
					2.2,
				),
				shape(
					"Tag",
					poly(
						[[-44, 135], [44, 135], [44, 60], [22, 38], [-22, 38], [-44, 60]],
						true,
						7,
					),
					"FFEBCB8E",
				),
				shape("Hole", ellipse(0, 50, 11, 11), IVORY, 2.5),
				lettering("Sold", "SOLD", 0, 76, 17, DEEP_CORAL, 3.4),
				lettering("Out", "OUT", 0, 100, 17, DEEP_CORAL, 3.4),
			], { motion: use(swing) }),
		],
	};
}

function button(): ContentsArt {
	return {
		scale: 1.5,
		peek: { x: 40, y: -214, rotation: .3 },
		art: [
			group("Button", { y: -36 }, [
				shape("Button", ellipse(0, 0, 72, 72), CORAL),
				line("Shine", [[-24, -12], [-18, -22], [-8, -28]], "FFFFC2B4", 3),
				shape("Rim", ellipse(0, 0, 52, 52), undefined, 3, "FFC24A40"),
				...[[-9, -9], [9, -9], [-9, 9], [9, 9]].map(([x = 0, y = 0]) =>
					shape("Hole", ellipse(x, y, 9, 9), "FF8E3530", 0)
				),
				line("Thread", [[9, -9], [-9, 9]], GOLD, 3.4),
				line("Thread", [[-9, -9], [9, 9]], GOLD, 3.4),
			], { motion: use(wiggle, .3) }),
		],
	};
}

function crown(): ContentsArt {
	const tips: readonly Point[] = [[-50, -44], [-18, -56], [18, -56], [50, -44]];

	return {
		scale: 1.5,
		idle: use(rock, .3),
		peek: { x: -40, y: -330, rotation: .14 },
		art: [
			shape(
				"Crown",
				poly(
					[
						[-50, 0],
						[-50, -44],
						[-34, -24],
						[-18, -56],
						[0, -28],
						[18, -56],
						[
							34,
							-24,
						],
						[50, -44],
						[50, 0],
					],
					true,
					3,
				),
				GOLD,
			),
			line("Band", [[-50, -24], [50, -24]], "FFD9A635", 2.5),
			line("Crease", [[28, -34], [24, -8]], "FFD9A635", 2),
			line("Crease", [[-30, -30], [-26, -6]], "FFD9A635", 2),
			...tips.map(([x, y]) => shape("Tip", ellipse(x, y, 10, 10), GOLD, 2.5)),
			shape("Jewel", ellipse(-20, -14, 11, 11), CORAL, 2.5),
			shape("Jewel", ellipse(0, -14, 11, 11), TEAL, 2.5),
			shape("Jewel", ellipse(20, -14, 11, 11), CORAL, 2.5),
		],
	};
}

function snail(): ContentsArt {
	const spiral: readonly Point[] = [
		[4, -44],
		[12, -46],
		[16, -38],
		[10, -30],
		[-2, -32],
		[-8, -44],
		[0, -58],
		[16, -60],
		[28, -48],
		[26, -30],
	];

	return {
		scale: 1.5,
		idle: use(breathe, .3),
		peek: { x: 14, y: -214, rotation: 0 },
		art: [
			shape(
				"Body",
				poly(
					[[-54, 0], [-50, -10], [24, -14], [34, -34], [52, -38], [64, -24], [
						62,
						0,
					]],
					true,
					9,
				),
				"FFB3CF92",
			),
			line("Smile", [[48, -14], [54, -10], [60, -14]]),
			group("Eye stalks", { x: 40, y: -30, rotation: .12 }, [
				line("Stalk", [[4, 0], [12, -38]], INK, 3),
				line("Stalk", [[-2, 0], [-6, -36]], INK, 3),
				shape("Eye", ellipse(12, -40, 10, 10), INK, 0),
				shape("Eye", ellipse(-6, -38, 10, 10), INK, 0),
			], { motion: use(rock, .2) }),
			shape("Shell", ellipse(4, -42, 64, 60), "FFE39A55"),
			shape("Spiral", poly(spiral, false, 6), undefined, 3),
		],
	};
}

function receipt(): ContentsArt {
	const zigzag: Point[] = [[-34, 0], [34, 0], [34, -130]];

	for (let x = 34; x > -34; x -= 8.5) {
		zigzag.push([x - 4.25, -136], [x - 8.5, -130]);
	}

	const rows = [-112, -100, -88, -76];

	return {
		scale: 1.25,
		idle: use(breathe),
		peek: { x: -4, y: -196, rotation: .06 },
		art: [
			shape("Receipt", poly(zigzag, true), PAPER),
			...rows.map((y) =>
				line("Price dots", [[16, y], [22, y]], "FF9DB5AE", 2.4)
			),
			...rows.map((y, i) =>
				line("Row", [[-22, y], [4 + (i % 2) * 8, y]], "FF9DB5AE", 2.4)
			),
			lettering("Total label", "TOTAL", 0, -62, 10, TEAL, 2),
			lettering("Total", "0.00", 0, -40, 16, INK, 2.8),
		],
	};
}

function ghostCertificate(): ContentsArt {
	const hem: Point[] = [];

	for (let i = 8; i >= 0; i--) {
		hem.push([-48 + i * 12, i % 2 ? -8 : 0]);
	}

	return {
		scale: 1.45,
		peek: { x: 0, y: -238, rotation: -.05 },
		art: [
			group("Ghost", { opacity: .9 }, [
				shape(
					"Certificate",
					poly([...hem, [-48, -112], [48, -112]], true, 6),
					"FFF7F1DE",
				),
				shape("Border", rect(0, -60, 80, 94, 4), undefined, 2, "FFD9B45A"),
				lettering("Share", "SHARE", 0, -100, 10, TEAL, 2),
				shape("Seal", star(30, -24, 22, 22, 8, .7), GOLD, 2),
				shape("Eye", ellipse(14, -62, 9, 14), INK, 0),
				shape("Eye", ellipse(-14, -62, 9, 14), INK, 0),
				shape("Mouth", ellipse(0, -44, 11, 13), INK, 0),
			], { motion: use(haunt) }),
		],
	};
}

function echo(): ContentsArt {
	const bubble = (name: string): Art[] => [
		shape(name, rect(0, -44, 148, 52, 22), PAPER),
		shape(
			`${name} tail`,
			poly([[-30, -20], [-40, 2], [-12, -20]], true, 3),
			PAPER,
		),
		lettering(`${name} words`, "...HELLO?", 2, -54, 17, INK, 3.2),
	];

	return {
		scale: 1.35,
		peek: { x: -10, y: -214, rotation: -.04 },
		art: [
			group(
				"Faint echo",
				{
					x: 70,
					y: -150,
					scaleX: .5,
					scaleY: .5,
					opacity: .3,
				},
				bubble("Faint"),
				{ motion: use(echoPulse) },
			),
			group(
				"Echo",
				{ x: 44, y: -90, scaleX: .72, scaleY: .72, opacity: .55 },
				bubble("Echo"),
				{ motion: use(echoPulse, .5) },
			),
			group("Hello", {}, bubble("Speech")),
		],
	};
}

// ---------------------------------------------------------------------------
// New for the exclusive series.

function crab(): ContentsArt {
	const shell = "FFE8664F";
	const claw = (side: 1 | -1): Art =>
		group("Claw", { x: 44 * side, y: -52, rotation: -.25 * side }, [
			line("Arm", [[-14 * side, 22], [-4 * side, 10], [0, 0]], INK, 5),
			shape(
				"Pincer",
				poly(
					[
						[0, 4],
						[-12 * side, -8],
						[-10 * side, -26],
						[2 * side, -34],
						[
							10 * side,
							-24,
						],
						[0, -18],
						[8 * side, -8],
					],
					true,
					5,
				),
				shell,
				3,
			),
		], { motion: use(snap, side > 0 ? .5 : 0) });

	return {
		scale: 1.35,
		idle: use(bob),
		peek: { x: 0, y: -206, rotation: 0 },
		art: [
			...[-1, 1].flatMap((side) =>
				[-6, 2, 10].map((y) =>
					line(
						"Leg",
						[[26 * side, -20 + y], [42 * side, -16 + y], [48 * side, -4 + y]],
						INK,
						3,
					)
				)
			),
			line("Eye stalk", [[-8, -40], [-12, -58]], INK, 3),
			line("Eye stalk", [[8, -40], [12, -58]], INK, 3),
			shape("Eye", ellipse(-12, -60, 12, 12), PAPER, 2.5),
			shape("Eye", ellipse(12, -60, 12, 12), PAPER, 2.5),
			shape("Pupil", ellipse(-10, -60, 5, 6), INK, 0),
			shape("Pupil", ellipse(14, -60, 5, 6), INK, 0),
			shape("Shell", ellipse(0, -26, 70, 44), shell),
			line("Shell shine", [[-22, -38], [-10, -44]], "FFFFB4A6", 3),
			line("Smile", [[-8, -20], [0, -15], [8, -20]], INK, 2.4),
			claw(-1),
			claw(1),
		],
	};
}

function bottle(): ContentsArt {
	const glass = "CCBFE6E0";

	return {
		scale: 1.35,
		idle: use(rock, .6),
		peek: { x: 6, y: -206, rotation: .42 },
		art: [
			shape("Neck", rect(0, -104, 22, 30, 5), glass),
			shape("Cork", rect(0, -122, 18, 16, 4), "FFB88339", 3),
			shape(
				"Glass",
				poly(
					[[-30, 0], [-32, -60], [-12, -90], [12, -90], [32, -60], [30, 0]],
					true,
					12,
				),
				glass,
			),
			group("Note", { y: -44, rotation: -.2 }, [
				shape("Scroll", rect(0, 0, 22, 54, 6), PAPER, 2.5),
				line("Ribbon", [[-11, 0], [11, 0]], DEEP_CORAL, 3),
				line("Writing", [[-5, -18], [5, -18]], "FF9DB5AE", 2),
				line("Writing", [[-5, 14], [5, 14]], "FF9DB5AE", 2),
			]),
			line("Glass shine", [[-20, -14], [-22, -52], [-12, -72]], "E6FFFFFF", 4),
			shape(
				"Sand",
				poly([[-28, -3], [-10, -12], [12, -8], [28, -3]], false, 6),
				undefined,
				2,
				"FFD9C29A",
			),
		],
	};
}

function goldenTicket(): ContentsArt {
	const outline: Point[] = [
		[-66, -8],
		[-66, -30],
		[-58, -38],
		[-66, -46],
		[
			-66,
			-68,
		],
		[54, -68],
		[58, -62],
		[52, -56],
		[60, -50],
		[54, -44],
		[60, -38],
		[
			52,
			-32,
		],
		[60, -26],
		[54, -20],
		[60, -14],
		[54, -8],
	];

	return {
		scale: 1.4,
		idle: use(rock, .1),
		peek: { x: 0, y: -206, rotation: -.1 },
		art: [
			shape("Ticket", poly(outline, true, 2), GOLD),
			line("Perforation", [[-36, -64], [-36, -12]], "FFB8862E", 2),
			shape("Border", rect(10, -38, 72, 44, 3), undefined, 1.8, "FFB8862E"),
			lettering("Admit one", "ADMIT ONE", 10, -56, 7, INK, 1.6),
			shape("Star", star(-51, -38, 16, 16, 5, .45), "FFFFF1BA", 2),
			group("Void stamp", { x: 12, y: -28, rotation: -.2 }, [
				shape(
					"Stamp",
					rect(0, 0, 76, 30, 4),
					undefined,
					3,
					withAlpha(DEEP_CORAL, .85),
				),
				lettering("Void", "VOID", 0, -9, 18, withAlpha(DEEP_CORAL, .85), 3.4),
			]),
		],
	};
}

function petRock(): ContentsArt {
	return {
		scale: 1.5,
		idle: use(breathe, .5),
		peek: { x: 0, y: -208, rotation: 0 },
		art: [
			shape(
				"Rock",
				poly(
					[[-50, 0], [-54, -26], [-36, -50], [-4, -58], [30, -52], [52, -30], [
						50,
						0,
					]],
					true,
					18,
				),
				"FF9A9A94",
			),
			shape(
				"Rock shade",
				poly([[20, -4], [46, -8], [48, -28], [34, -16]], true, 8),
				"33243D40",
				0,
			),
			line("Speckle", [[-30, -18], [-28, -16]], "FF6E6E68", 3),
			line("Speckle", [[18, -40], [20, -38]], "FF6E6E68", 3),
			line("Speckle", [[-8, -12], [-6, -10]], "FF6E6E68", 3),
			shape("Googly eye", ellipse(-14, -34, 20, 20), PAPER, 2.5),
			shape("Googly eye", ellipse(12, -36, 18, 18), PAPER, 2.5),
			shape("Pupil", ellipse(-10, -30, 9, 9), INK, 0),
			shape("Pupil", ellipse(10, -32, 8, 8), INK, 0),
			line("Mouth", [[-4, -18], [4, -18]], INK, 2.4),
			line("Sprout stem", [[4, -57], [6, -72]], "FF5DAA5B", 3),
			shape(
				"Leaf",
				poly([[6, -70], [18, -80], [22, -72], [8, -68]], true, 4),
				"FF7CC46E",
				2,
			),
			shape(
				"Leaf",
				poly([[5, -66], [-8, -76], [-12, -68], [3, -63]], true, 4),
				"FF7CC46E",
				2,
			),
		],
	};
}

function keyToNothing(): ContentsArt {
	return {
		scale: 1.4,
		idle: use(rock, .8),
		peek: { x: 0, y: -214, rotation: -.55 },
		art: [
			line("Tag string", [[-6, -104], [-30, -84]], INK, 2),
			group("Tag", { x: -40, y: -70, rotation: .3 }, [
				shape(
					"Tag",
					poly([[-14, -18], [14, -18], [14, 18], [0, 26], [-14, 18]], true, 3),
					PAPER,
					2.5,
				),
				lettering("Question", "?", 0, -10, 18, DEEP_CORAL, 3),
			], { motion: use(swing, .4) }),
			shape("Shaft", rect(0, -44, 12, 88, 3), GOLD, 3),
			shape(
				"Bit",
				poly(
					[[6, -12], [26, -12], [26, -4], [18, -4], [18, 2], [26, 2], [
						26,
						8,
					], [6, 8]],
					true,
					2,
				),
				GOLD,
				3,
			),
			shape("Bow", star(0, -104, 56, 56, 6, .72), GOLD),
			shape("Bow hole", ellipse(0, -104, 18, 18), IVORY, 3),
			line("Shine", [[-3, -72], [-3, -20]], "FFFFF1BA", 2.5),
		],
	};
}

function fireflies(): ContentsArt {
	const bugs: readonly Point[] = [[-14, -30], [12, -48], [-6, -66], [16, -22], [
		-18,
		-54,
	]];

	return {
		scale: 1.35,
		peek: { x: 0, y: -208, rotation: .05 },
		art: [
			shape("Jar", rect(0, -44, 70, 88, 16), "59203848"),
			shape("Glow", ellipse(0, -44, 64, 76), {
				kind: "radial",
				from: [0, -44],
				to: [0, 0],
				stops: [[0, "99FFE27A"], [1, "00FFE27A"]],
			}, 0),
			...bugs.map(([x, y], i) =>
				group("Firefly", { x, y }, [
					shape("Firefly glow", ellipse(0, 0, 16, 16), "66FFF1A0", 0),
					shape("Firefly", ellipse(0, 0, 6, 6), "FFFFF6C8", 0),
				], { motion: use(glowPulse, i / bugs.length) })
			),
			shape("Glass rim", rect(0, -44, 70, 88, 16), undefined, 3.5),
			line("Glass shine", [[-26, -16], [-26, -62]], "B3FFFFFF", 4),
			shape("Lid band", rect(0, -92, 60, 12, 3), "FFB8BEC4", 3),
			shape(
				"Cloth",
				poly([[-34, -96], [34, -96], [26, -112], [-26, -112]], true, 6),
				"FFE8664F",
				3,
			),
			line("Air hole", [[-8, -106], [-6, -104]], INK, 3),
			line("Air hole", [[6, -106], [8, -104]], INK, 3),
		],
	};
}

function luckyPenny(): ContentsArt {
	const copper = "FFD98A4E";

	return {
		scale: 1.5,
		idle: use(bob, .2),
		peek: { x: 0, y: -212, rotation: .18 },
		art: [
			group("Penny", { y: -38 }, [
				shape("Edge", ellipse(4, 3, 76, 76), "FFA85F30"),
				shape("Face", ellipse(0, 0, 76, 76), copper),
				shape("Rim", ellipse(0, 0, 62, 62), undefined, 2, "FFA85F30"),
				shape(
					"Clover",
					[
						ellipse(-7, -12, 13, 13),
						ellipse(7, -12, 13, 13),
						ellipse(-7, 2, 13, 13),
						ellipse(7, 2, 13, 13),
					],
					"FF7CC46E",
					2,
				),
				line("Stem", [[0, 6], [4, 18]], INK, 2),
				lettering("Tails", "TAILS", 0, 20, 7, INK, 1.6),
				line("Shine", [[-24, -14], [-16, -26]], "FFFFC9A0", 3),
			], { motion: use(flip) }),
		],
	};
}

/** Every contents drawing, indexed by the `contents` URI field. */
export const CONTENTS_ART: readonly ContentsArt[] = [
	moth(),
	sock(),
	iou(),
	cobweb(),
	dustBunny(),
	duck(),
	soldOutTag(),
	button(),
	crown(),
	snail(),
	receipt(),
	ghostCertificate(),
	echo(),
	crab(),
	bottle(),
	goldenTicket(),
	petRock(),
	keyToNothing(),
	fireflies(),
	luckyPenny(),
];

/** One contents drawing as a posed root, ready to sit in the chest. */
export function contentsRoot(
	index: number,
	options: Readonly<{ opacity?: number; key?: string }> = {},
): Art {
	const contents = CONTENTS_ART[index];

	if (!contents) {
		throw new RangeError(`No contents art at ${index}`);
	}

	const { peek, scale, art } = contents;

	return group(
		`Contents ${index}`,
		{
			...peek,
			...(options.opacity === undefined ? {} : { opacity: options.opacity }),
		},
		[
			group(
				"Art",
				{ scaleX: scale, scaleY: scale },
				art,
				contents.idle ? { motion: contents.idle } : {},
			),
		],
		options.key === undefined ? {} : { key: options.key },
	);
}
