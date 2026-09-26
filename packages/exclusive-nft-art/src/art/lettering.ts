import {
	INK,
	type Paint,
	type Point,
	poly,
	type Shape,
	shape,
} from "./model.ts";

/**
 * A hand-inked stroke font, so lettering needs no embedded font asset.
 *
 * Wallets, resvg, and the Rive runtime all lack a shared font, and embedding
 * one would blow the size budget. Glyphs are open polylines in a box one unit
 * tall with y growing downward; the shape's rounded stroke gives the ink look.
 */
type Glyph = Readonly<
	{ width: number; strokes: readonly (readonly Point[])[] }
>;

const OVAL: readonly Point[] = [
	[.2, 0],
	[.42, 0],
	[.62, .25],
	[.62, .75],
	[.42, 1],
	[.2, 1],
	[0, .75],
	[0, .25],
	[.2, 0],
];

const GLYPHS: Readonly<Record<string, Glyph>> = {
	A: {
		width: .62,
		strokes: [[[0, 1], [.31, 0], [.62, 1]], [[.13, .64], [.49, .64]]],
	},
	B: {
		width: .56,
		strokes: [
			[
				[0, .5],
				[0, 0],
				[.36, 0],
				[.5, .12],
				[.5, .36],
				[.36, .5],
				[0, .5],
				[0, 1],
				[.4, 1],
				[.56, .86],
				[.56, .64],
				[.4, .5],
			],
		],
	},
	C: {
		width: .56,
		strokes: [[[.56, .14], [.4, 0], [.18, 0], [0, .22], [0, .78], [.18, 1], [
			.4,
			1,
		], [.56, .86]]],
	},
	D: {
		width: .6,
		strokes: [[[0, 0], [0, 1], [.32, 1], [.6, .72], [.6, .28], [.32, 0], [
			0,
			0,
		]]],
	},
	E: {
		width: .52,
		strokes: [[[.52, 0], [0, 0], [0, 1], [.52, 1]], [[0, .5], [.4, .5]]],
	},
	F: { width: .5, strokes: [[[.5, 0], [0, 0], [0, 1]], [[0, .5], [.38, .5]]] },
	G: {
		width: .6,
		strokes: [[
			[.58, .14],
			[.42, 0],
			[.18, 0],
			[0, .22],
			[0, .78],
			[.18, 1],
			[.42, 1],
			[.6, .8],
			[.6, .56],
			[.34, .56],
		]],
	},
	H: {
		width: .6,
		strokes: [[[0, 0], [0, 1]], [[.6, 0], [.6, 1]], [[0, .5], [.6, .5]]],
	},
	I: {
		width: .44,
		strokes: [[[.22, 0], [.22, 1]], [[0, 0], [.44, 0]], [[0, 1], [.44, 1]]],
	},
	J: {
		width: .5,
		strokes: [[[.1, 0], [.5, 0]], [[.36, 0], [.36, .8], [.2, 1], [.06, .96], [
			0,
			.84,
		]]],
	},
	K: {
		width: .56,
		strokes: [[[0, 0], [0, 1]], [[.56, 0], [0, .58]], [[.18, .42], [.56, 1]]],
	},
	L: { width: .5, strokes: [[[0, 0], [0, 1], [.5, 1]]] },
	M: { width: .72, strokes: [[[0, 1], [0, 0], [.36, .6], [.72, 0], [.72, 1]]] },
	N: { width: .6, strokes: [[[0, 1], [0, 0], [.6, 1], [.6, 0]]] },
	O: { width: .62, strokes: [OVAL] },
	P: {
		width: .56,
		strokes: [[[0, 1], [0, 0], [.4, 0], [.56, .14], [.56, .36], [.4, .5], [
			0,
			.5,
		]]],
	},
	Q: { width: .64, strokes: [OVAL, [[.36, .7], [.64, 1.02]]] },
	R: {
		width: .6,
		strokes: [[[0, 1], [0, 0], [.42, 0], [.6, .16], [.6, .34], [.42, .5], [
			0,
			.5,
		]], [[.28, .5], [.6, 1]]],
	},
	S: {
		width: .58,
		strokes: [[
			[.56, .12],
			[.42, 0],
			[.14, 0],
			[0, .14],
			[0, .34],
			[.14, .47],
			[.44, .53],
			[.58, .66],
			[.58, .86],
			[.44, 1],
			[.14, 1],
			[0, .88],
		]],
	},
	T: { width: .6, strokes: [[[0, 0], [.6, 0]], [[.3, 0], [.3, 1]]] },
	U: {
		width: .6,
		strokes: [[[0, 0], [0, .76], [.2, 1], [.4, 1], [.6, .76], [.6, 0]]],
	},
	V: { width: .62, strokes: [[[0, 0], [.31, 1], [.62, 0]]] },
	W: {
		width: .86,
		strokes: [[[0, 0], [.2, 1], [.43, .36], [.66, 1], [.86, 0]]],
	},
	X: { width: .6, strokes: [[[0, 0], [.6, 1]], [[.6, 0], [0, 1]]] },
	Y: { width: .6, strokes: [[[0, 0], [.3, .5], [.6, 0]], [[.3, .5], [.3, 1]]] },
	Z: { width: .56, strokes: [[[0, 0], [.56, 0], [0, 1], [.56, 1]]] },
	"0": {
		width: .54,
		strokes: [OVAL.map(([x, y]): Point => [x * .87, y]), [[.12, .8], [
			.42,
			.2,
		]]],
	},
	"1": {
		width: .4,
		strokes: [[[0, .2], [.22, 0], [.22, 1]], [[0, 1], [.4, 1]]],
	},
	"2": {
		width: .54,
		strokes: [[[0, .2], [.14, .02], [.38, 0], [.54, .16], [.54, .34], [0, 1], [
			.54,
			1,
		]]],
	},
	"3": {
		width: .54,
		strokes: [[
			[0, .08],
			[.14, 0],
			[.4, 0],
			[.54, .14],
			[.54, .34],
			[.36, .48],
			[.14, .48],
		], [[.36, .48], [.54, .62], [.54, .86], [.4, 1], [.14, 1], [0, .92]]],
	},
	"4": { width: .56, strokes: [[[.4, 1], [.4, 0], [0, .68], [.56, .68]]] },
	"5": {
		width: .54,
		strokes: [[
			[.52, 0],
			[.06, 0],
			[0, .46],
			[.36, .42],
			[.54, .58],
			[.54, .84],
			[.38, 1],
			[.12, 1],
			[0, .9],
		]],
	},
	"6": {
		width: .54,
		strokes: [[
			[.5, .06],
			[.36, 0],
			[.18, 0],
			[0, .24],
			[0, .8],
			[.18, 1],
			[.38, 1],
			[.54, .84],
			[.54, .62],
			[.38, .46],
			[.16, .46],
			[0, .6],
		]],
	},
	"7": { width: .52, strokes: [[[0, 0], [.52, 0], [.2, 1]]] },
	"8": {
		width: .54,
		strokes: [
			[
				[.27, .46],
				[.08, .36],
				[.04, .14],
				[.18, 0],
				[.36, 0],
				[.5, .14],
				[.46, .36],
				[.27, .46],
				[.04, .62],
				[0, .84],
				[.16, 1],
				[.38, 1],
				[.54, .84],
				[.5, .62],
				[.27, .46],
			],
		],
	},
	"9": {
		width: .54,
		strokes: [[
			[.54, .4],
			[.38, .54],
			[.16, .54],
			[0, .38],
			[0, .16],
			[.16, 0],
			[.38, 0],
			[.54, .16],
			[.54, .76],
			[.36, 1],
			[.16, 1],
			[.04, .94],
		]],
	},
	"#": {
		width: .6,
		strokes: [[[.2, .1], [.14, .9]], [[.46, .1], [.4, .9]], [[.04, .34], [
			.58,
			.34,
		]], [[.02, .66], [.56, .66]]],
	},
	"-": { width: .4, strokes: [[[.04, .55], [.36, .55]]] },
	",": { width: .16, strokes: [[[.1, .88], [.04, 1.08]]] },
	".": { width: .16, strokes: [[[.08, .93], [.08, .96]]] },
	"?": {
		width: .52,
		strokes: [[
			[0, .2],
			[.12, .03],
			[.38, 0],
			[.52, .15],
			[.52, .32],
			[.26, .5],
			[.26, .68],
		], [[.26, .92], [.26, .95]]],
	},
	"'": { width: .14, strokes: [[[.07, 0], [.07, .26]]] },
	" ": { width: .3, strokes: [] },
};

const GAP = .2;

function glyphFor(character: string): Glyph {
	const glyph = GLYPHS[character.toUpperCase()];

	if (!glyph) {
		throw new RangeError(`No stroke glyph for "${character}"`);
	}

	return glyph;
}

/** The advance width of `text` at cap height `size`. */
export function textWidth(text: string, size: number): number {
	const units = [...text].reduce(
		(sum, character) => sum + glyphFor(character).width + GAP,
		-GAP,
	);

	return Math.max(0, units) * size;
}

export type Align = "start" | "center" | "end";

/**
 * One shape holding every stroke of `text`, with cap height `size` and its top
 * edge at `top`. `x` is the left edge, centre, or right edge per `align`.
 */
export function lettering(
	name: string,
	text: string,
	x: number,
	top: number,
	size: number,
	color: Paint = INK,
	width = 3,
	align: Align = "center",
): Shape {
	const total = textWidth(text, size);
	const offsets: Readonly<Record<Align, number>> = {
		start: 0,
		center: total / 2,
		end: total,
	};
	let cursor = x - offsets[align];
	const paths = [];

	for (const character of text) {
		const glyph = glyphFor(character);

		for (const stroke of glyph.strokes) {
			const points = stroke.map(([gx, gy]): Point => [
				cursor + gx * size,
				top + gy * size,
			]);
			paths.push(poly(points, false, size * .12));
		}

		cursor += (glyph.width + GAP) * size;
	}

	return shape(name, paths, undefined, width, color);
}
