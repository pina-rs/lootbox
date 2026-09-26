import { lettering } from "./lettering.ts";
import {
	type Art,
	ellipse,
	type Geometry,
	group,
	INK,
	line,
	type Point,
	poly,
	rect,
	shape,
	star,
} from "./model.ts";
import { motion, use } from "./motion.ts";

/**
 * Decorations the chest wears. Each has a body part (chest space: the front
 * spans x -151..155, y -183..-4) and a lid part (lid space: the hinge is
 * y = 0 and the top about y = -102), because the lid moves on its own.
 * Googly eyes sit on the body so tall contents never cover them.
 * Indices match the `decoration` layer in `layers.ts`.
 */
export type DecorationArt = Readonly<
	{ body: readonly Art[]; lid: readonly Art[] }
>;

const NONE: DecorationArt = { body: [], lid: [] };
const LEAF = "FF5DAA5B";
const LEAF_LIGHT = "FF7CC46E";
const TAPE = "FFC9CFD4";

const flutter = motion("deco-flutter", 2, {
	rotation: [[0, 0], [.25, .12], [.5, 0], [.75, -.1], [1, 0]],
});
const flicker = motion("deco-flicker", 1, {
	scaleX: [[0, 1], [.2, .85], [.4, 1.08], [.6, .92], [.8, 1.05], [1, 1]],
	scaleY: [[0, 1], [.2, 1.12], [.4, .9], [.6, 1.08], [.8, .95], [1, 1]],
});
const glow = motion("deco-glow", 2, {
	opacity: [[0, .45], [.5, 1], [1, .45]],
});
const buzz = motion("deco-buzz", 4, {
	opacity: [
		[0, 1],
		[.6, 1],
		[.62, .35],
		[.64, 1],
		[.7, 1],
		[.72, .5],
		[.74, 1],
		[1, 1],
	],
});
const jiggle = motion("deco-jiggle", 2, {
	x: [[0, 0], [.15, 3], [.3, -2], [.45, 2], [.6, 0], [1, 0]],
	y: [[0, 0], [.15, 2], [.3, 3], [.45, -1], [.6, 0], [1, 0]],
});

function stickers(): DecorationArt {
	return {
		body: [
			group("Smiley sticker", {
				x: -62,
				y: -136,
				rotation: -.2,
				scaleX: 1.5,
				scaleY: 1.5,
			}, [
				shape("Sticker", ellipse(0, 0, 30, 30), "FFFFD35A", 2.5),
				shape("Eyes", [ellipse(-5, -3, 3, 5), ellipse(5, -3, 3, 5)], INK, 0),
				line("Smile", [[-7, 4], [0, 8], [7, 4]], INK, 2, 3),
			]),
			group("Star sticker", {
				x: 52,
				y: -62,
				rotation: .25,
				scaleX: 1.4,
				scaleY: 1.4,
			}, [
				shape("Sticker", star(0, 0, 34, 34, 5, .5), "FFFF8AD8", 2.5),
			]),
			group("Fragile label", {
				x: -26,
				y: -48,
				rotation: .06,
				scaleX: 1.35,
				scaleY: 1.35,
			}, [
				shape("Label", rect(0, 0, 70, 20, 3), "FFFBF8EE", 2),
				lettering("Fragile", "FRAGILE", 0, -5, 10, "FFD9534A", 2),
			]),
		],
		lid: [
			group("Heart sticker", {
				x: 56,
				y: -64,
				rotation: -.15,
				scaleX: 1.5,
				scaleY: 1.5,
			}, [
				shape(
					"Sticker",
					poly(
						[
							[0, 10],
							[-11, 0],
							[-11, -5],
							[-6, -9],
							[0, -5],
							[6, -9],
							[11, -5],
							[11, 0],
						],
						true,
						3,
					),
					"FFEF7869",
					2.5,
				),
			]),
		],
	};
}

function tape(x: number, y: number, width: number, rotation: number): Art {
	return group("Tape", { x, y, rotation }, [
		shape("Tape", rect(0, 0, width, 16, 1), TAPE, 2),
		line(
			"Tape weave",
			[[-width / 2 + 6, -3], [width / 2 - 6, -3]],
			"80FFFFFF",
			1.5,
		),
		line(
			"Tape weave",
			[[-width / 2 + 6, 3], [width / 2 - 6, 3]],
			"33243D40",
			1.5,
		),
	]);
}

function ductTape(): DecorationArt {
	return {
		body: [
			tape(-118, -150, 90, .7),
			tape(-118, -150, 90, -.7),
			tape(108, -44, 64, .15),
		],
		lid: [tape(-40, -60, 110, -.12)],
	};
}

function leaf(x: number, y: number, rotation: number, phase: number): Art {
	return group("Leaf", { x, y, rotation }, [
		shape(
			"Leaf",
			poly([[0, 0], [8, -7], [16, -2], [8, 5]], true, 5),
			LEAF_LIGHT,
			2,
		),
	], { motion: use(flutter, phase) });
}

function vines(): DecorationArt {
	const stem: readonly Point[] = [
		[-150, -10],
		[-140, -60],
		[-150, -110],
		[-136, -160],
		[-110, -182],
		[-60, -178],
	];

	return {
		body: [
			shape("Vine", poly(stem, false, 20), undefined, 4, LEAF),
			...stem.slice(1).map(([x, y], i) =>
				leaf(x, y, i % 2 ? .4 : -2.4, i * .17)
			),
		],
		lid: [
			shape(
				"Vine",
				poly(
					[[150, -4], [140, -40], [150, -80], [110, -104], [60, -100]],
					false,
					18,
				),
				undefined,
				4,
				LEAF,
			),
			leaf(140, -40, -.3, .2),
			leaf(146, -80, 2.6, .5),
			leaf(90, -103, -1.9, .8),
		],
	};
}

function bunting(): DecorationArt {
	const colors = ["FFEF7869", "FFFFD35A", "FF39AB9F", "FFFF8AD8", "FF7FD8FF"];
	const flags: Art[] = [];
	const sag = (x: number) => -178 + 30 * (1 - ((x - 2) / 153) ** 2);

	for (let i = 0; i < 9; i++) {
		const x = -132 + i * 34;

		flags.push(group("Flag", { x, y: sag(x) }, [
			shape(
				"Flag",
				poly([[-14, 0], [14, 0], [0, 30]], true, 3),
				colors[i % colors.length] ?? "FFEF7869",
				2.5,
			),
		], { motion: use(flutter, i / 9) }));
	}

	return {
		body: [
			shape(
				"String",
				poly(
					Array.from({ length: 13 }, (_, i): Point => {
						const x = -150 + i * 25.5;

						return [x, sag(x)];
					}),
					false,
					20,
				),
				undefined,
				2,
				INK,
			),
			...flags,
		],
		lid: [],
	};
}

function barnacle(x: number, y: number, size: number): Geometry[] {
	return [
		poly(
			[[x - size, y], [x - size * .5, y - size * 1.1], [
				x + size * .5,
				y - size * 1.1,
			], [x + size, y]],
			true,
			size * .3,
		),
	];
}

function barnacles(): DecorationArt {
	return {
		body: [
			shape(
				"Barnacles",
				[
					...barnacle(-132, -8, 16),
					...barnacle(-106, -10, 11),
					...barnacle(-138, -40, 10),
					...barnacle(134, -166, 13),
					...barnacle(112, -168, 9),
				],
				"FFE3DCCB",
				2.5,
			),
			shape(
				"Openings",
				[
					ellipse(-132, -25, 10, 4),
					ellipse(-106, -21, 7, 3),
					ellipse(134, -180, 8, 4),
				],
				INK,
				0,
			),
			group("Starfish", { x: 64, y: -46, rotation: .3 }, [
				shape("Starfish", star(0, 0, 54, 54, 5, .45), "FFF08A3C", 3),
			]),
		],
		lid: [
			shape(
				"Barnacles",
				[...barnacle(-134, -6, 12), ...barnacle(-112, -4, 8)],
				"FFE3DCCB",
				2.5,
			),
		],
	};
}

function candle(x: number, phase: number): Art {
	return group("Candle", { x, y: -100 }, [
		shape("Wax", rect(0, -16, 16, 32, 2), "FFFFF4E0", 2.5),
		shape(
			"Drip",
			poly([[-8, -30], [-4, -30], [-4, -20], [-6, -18], [-8, -20]], true, 1.5),
			"FFFFF4E0",
			0,
		),
		line("Wick", [[0, -32], [0, -37]], INK, 2),
		group("Flame", { y: -38 }, [
			shape(
				"Flame",
				poly([[0, -22], [7, -8], [5, 0], [-5, 0], [-7, -8]], true, 4),
				"FFFF9F43",
				2,
			),
			shape(
				"Core",
				poly([[0, -12], [3, -5], [2, 0], [-2, 0], [-3, -5]], true, 2),
				"FFFFF1A0",
				0,
			),
		], { motion: use(flicker, phase) }),
	]);
}

function candles(): DecorationArt {
	return { body: [], lid: [candle(-112, 0), candle(104, .5)] };
}

function gem(x: number, y: number, color: string): Art {
	return group("Gem", { x, y, scaleX: 1.6, scaleY: 1.6 }, [
		shape("Gem", poly([[0, -9], [8, 0], [0, 9], [-8, 0]], true, 1), color, 2.5),
		line("Facet", [[-3, -3], [0, -6]], "CCFFFFFF", 2),
	]);
}

function gems(): DecorationArt {
	return {
		body: [
			gem(-111, -95, "FFD9534A"),
			gem(106, -95, "FF4C7FD1"),
			gem(0, -17, "FF2E9E6B"),
			gem(-60, -17, "FFC39BFF"),
			gem(60, -17, "FFC39BFF"),
		],
		lid: [gem(-111, -50, "FF4C7FD1"), gem(106, -50, "FFD9534A")],
	};
}

const RUNES: readonly (readonly Point[])[][] = [
	[[[0, 0], [0, 24]], [[0, 6], [10, 0]], [[0, 12], [10, 6]]],
	[[[0, 24], [6, 0], [12, 24]], [[3, 12], [9, 12]]],
	[[[0, 0], [10, 12], [0, 24]], [[10, 0], [10, 24]]],
	[[[0, 0], [12, 0], [0, 24], [12, 24]]],
	[[[6, 0], [6, 24]], [[0, 8], [12, 16]]],
];

function runeRow(y: number, xs: readonly number[], scale = 1.5): Geometry[] {
	return xs.flatMap((x, i) =>
		(RUNES[i % RUNES.length] ?? []).map((stroke) =>
			poly(
				stroke.map(([px, py]): Point => [x + px * scale, y + py * scale]),
				false,
			)
		)
	);
}

function runes(): DecorationArt {
	const body = runeRow(-112, [-80, -40, 0, 40]);
	const lid = runeRow(-76, [-56, -10, 36]);
	const glowing = (name: string, geometry: Geometry[]): Art =>
		group(name, {}, [
			shape("Rune glow", geometry, undefined, 9, "4D7FF0E0"),
			shape("Runes", geometry, undefined, 3, "FF7FF0E0"),
		], { motion: use(glow) });

	return {
		body: [glowing("Body runes", body)],
		lid: [glowing("Lid runes", lid)],
	};
}

function crownTrim(): DecorationArt {
	const points: Point[] = [[-146, -98]];

	for (let i = 0; i < 9; i++) {
		const x = -146 + i * 33;

		points.push([x + 16, -124], [x + 33, -99]);
	}

	return {
		body: [],
		lid: [
			shape("Crown trim", poly(points, true, 3), "FFF5C54E", 3),
			...Array.from(
				{ length: 9 },
				(_, i) =>
					shape(
						"Jewel",
						ellipse(-130 + i * 33, -116, 7, 7),
						i % 2 ? "FFD9534A" : "FF39AB9F",
						2,
					),
			),
		],
	};
}

function neonStrip(): DecorationArt {
	const body = poly(
		[[-140, -172], [144, -170], [136, -16], [-130, -14]],
		true,
		14,
	);
	const lid = poly([[-140, -8], [-138, -86], [140, -90], [143, -8]], true, 14);
	const tube = (name: string, geometry: Geometry): Art =>
		group(name, {}, [
			shape("Neon glow", geometry, undefined, 12, "59FF6FD8"),
			shape("Neon", geometry, undefined, 3.5, "FFFFB3EC"),
		], { motion: use(buzz) });

	return { body: [tube("Body neon", body)], lid: [tube("Lid neon", lid)] };
}

function googlyEye(x: number, phase: number): Art {
	return group("Googly eye", { x, y: -104 }, [
		shape("Eye", ellipse(0, 0, 38, 38), "FFFFFFFF", 3),
		group("Pupil", { y: 6 }, [shape("Pupil", ellipse(0, 0, 18, 18), INK, 0)], {
			motion: use(jiggle, phase),
		}),
	]);
}

function googlyEyes(): DecorationArt {
	return { body: [googlyEye(-50, 0), googlyEye(50, .4)], lid: [] };
}

const DRAWINGS: readonly (() => DecorationArt)[] = [
	() => NONE,
	stickers,
	ductTape,
	vines,
	bunting,
	barnacles,
	candles,
	gems,
	runes,
	crownTrim,
	neonStrip,
	googlyEyes,
];

export const DECORATION_ART_COUNT = DRAWINGS.length;

/** The decoration for `index`. */
export function decorationArt(index: number): DecorationArt {
	const draw = DRAWINGS[index];

	if (!draw) {
		throw new RangeError(`No decoration art at ${index}`);
	}

	return draw();
}
