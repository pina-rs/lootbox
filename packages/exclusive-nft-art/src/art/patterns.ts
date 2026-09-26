import {
	type Art,
	ellipse,
	type Geometry,
	group,
	type Point,
	poly,
	shape,
	slot,
} from "./model.ts";

/**
 * Engravings cut into the chest's wood panels. Indices match the `pattern` URI
 * field and the `PATTERNS` catalog in `traits.ts`.
 *
 * An engraving is two strokes: a translucent ink groove and, offset down and
 * right, a highlight in the finish's light color. Dark finishes show the
 * highlight, light finishes show the groove, so one drawing reads on all
 * sixteen tiers.
 */
export type Panel = Readonly<{
	left: number;
	right: number;
	top: number;
	bottom: number;
}>;

const GROOVE = "59243D40";
const GROOVE_WIDTH = 2.2;
const HIGHLIGHT_WIDTH = 1.5;

function engrave(
	name: string,
	geometry: readonly Geometry[],
	filled = false,
): Art[] {
	if (!geometry.length) {
		return [];
	}

	const highlight = filled
		? shape(`${name} light`, geometry, slot("woodLight", .6), 0)
		: shape(
			`${name} light`,
			geometry,
			undefined,
			HIGHLIGHT_WIDTH,
			slot("woodLight", .6),
		);
	const groove = filled
		? shape(name, geometry, GROOVE, 0)
		: shape(name, geometry, undefined, GROOVE_WIDTH, GROOVE);

	return [group(`${name} highlight`, { x: 1.2, y: 1.6 }, [highlight]), groove];
}

/** Clip the segment a→b to `panel` (Liang–Barsky); null when fully outside. */
function clipSegment(a: Point, b: Point, panel: Panel): Geometry | null {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const edges: readonly (readonly [number, number])[] = [
		[-dx, a[0] - panel.left],
		[dx, panel.right - a[0]],
		[-dy, a[1] - panel.top],
		[dy, panel.bottom - a[1]],
	];
	let enter = 0;
	let exit = 1;

	for (const [p, q] of edges) {
		if (p === 0) {
			if (q < 0) {
				return null;
			}

			continue;
		}

		const t = q / p;

		if (p < 0) {
			enter = Math.max(enter, t);
		} else {
			exit = Math.min(exit, t);
		}
	}

	if (enter >= exit) {
		return null;
	}

	return poly([
		[a[0] + dx * enter, a[1] + dy * enter],
		[a[0] + dx * exit, a[1] + dy * exit],
	], false);
}

function inset(panel: Panel, by: number): Panel {
	return {
		left: panel.left + by,
		right: panel.right - by,
		top: panel.top + by,
		bottom: panel.bottom - by,
	};
}

function rows(panel: Panel, step: number): number[] {
	const list: number[] = [];

	for (let y = panel.top + step / 2; y < panel.bottom; y += step) {
		list.push(y);
	}

	return list;
}

function woodgrain(panel: Panel): Geometry[] {
	const width = panel.right - panel.left;

	return rows(panel, 11).map((y, row) => {
		const points = Array.from({ length: 9 }, (_, i): Point => [
			panel.left + width * i / 8,
			y + Math.sin(i * 1.3 + row * 2.1) * 2.6,
		]);

		return poly(points, false, 10);
	});
}

function lattice(panel: Panel): Geometry[] {
	const area = inset(panel, 4);
	const height = area.bottom - area.top;
	const lines: Geometry[] = [];

	for (let x = area.left - height; x < area.right; x += 26) {
		const down = clipSegment([x, area.top], [x + height, area.bottom], area);
		const up = clipSegment([x, area.bottom], [x + height, area.top], area);

		if (down) lines.push(down);
		if (up) lines.push(up);
	}

	return lines;
}

function chevron(panel: Panel): Geometry[] {
	const area = inset(panel, 6);
	const step = 20;

	return rows(area, 24).map((y) => {
		const points: Point[] = [];

		for (let x = area.left, i = 0; x <= area.right + .1; x += step / 2, i++) {
			points.push([x, i % 2 ? y - 7 : y + 7]);
		}

		return poly(points, false);
	});
}

function rivets(panel: Panel): Geometry[] {
	const area = inset(panel, 12);
	const columns = 6;
	const dots: Geometry[] = [];

	for (const y of rows(area, (area.bottom - area.top) / 3)) {
		for (let i = 0; i <= columns; i++) {
			dots.push(
				ellipse(area.left + (area.right - area.left) * i / columns, y, 5, 5),
			);
		}
	}

	return dots;
}

function curl(
	cx: number,
	cy: number,
	radius: number,
	mirror: 1 | -1,
): Geometry {
	const points = Array.from({ length: 22 }, (_, i): Point => {
		const t = i / 21;
		const angle = t * Math.PI * 2.6;
		const r = radius * (1 - t * .78);

		return [cx + Math.cos(angle) * r * mirror, cy + Math.sin(angle) * r];
	});

	return poly(points, false, 4);
}

function scrollwork(panel: Panel): Geometry[] {
	const cx = (panel.left + panel.right) / 2;
	const cy = (panel.top + panel.bottom) / 2;
	const span = (panel.right - panel.left) / 2;
	const size = Math.min(22, (panel.bottom - panel.top) / 3.4);

	return [
		poly(
			[
				[cx - span + 10, cy],
				[cx - size, cy - size * .3],
				[cx, cy - size * .8],
				[
					cx + size,
					cy - size * .3,
				],
				[cx + span - 10, cy],
			],
			false,
			16,
		),
		curl(cx - span * .55, cy + size * .2, size, 1),
		curl(cx + span * .55, cy + size * .2, size, -1),
		curl(cx - span * .18, cy - size * .1, size * .6, -1),
		curl(cx + span * .18, cy - size * .1, size * .6, 1),
	];
}

function waves(panel: Panel): Geometry[] {
	const area = inset(panel, 4);
	const width = 22;

	return rows(area, 18).map((y, row) => {
		const points: Point[] = [];
		const shift = row % 2 ? width / 2 : 0;

		for (let x = area.left - shift; x < area.right; x += width) {
			for (let i = 0; i <= 6; i++) {
				const angle = Math.PI + i * Math.PI / 6;
				const px = x + width / 2 + Math.cos(angle) * width / 2;

				if (px >= area.left && px <= area.right) {
					points.push([px, y + Math.sin(angle) * 6]);
				}
			}
		}

		return poly(points, false);
	});
}

function tally(panel: Panel): Geometry[] {
	const area = inset(panel, 10);
	const marks: Geometry[] = [];
	const height = Math.min(22, (area.bottom - area.top) / 2.6);
	const groupWidth = 34;
	let row = 0;

	for (let y = area.top; y + height <= area.bottom; y += height + 12, row++) {
		for (
			let x = area.left + (row % 2) * 12;
			x + 24 <= area.right;
			x += groupWidth + 8
		) {
			for (let i = 0; i < 4; i++) {
				marks.push(poly([[x + i * 7, y], [x + i * 7 + 1, y + height]], false));
			}

			marks.push(
				poly([[x - 3, y + height * .8], [x + 25, y + height * .2]], false),
			);
		}
	}

	return marks;
}

type PatternDraw = Readonly<
	{ draw: (panel: Panel) => Geometry[]; filled: boolean }
>;

const DRAWINGS: readonly PatternDraw[] = [
	{ draw: () => [], filled: false },
	{ draw: woodgrain, filled: false },
	{ draw: lattice, filled: false },
	{ draw: chevron, filled: false },
	{ draw: rivets, filled: true },
	{ draw: scrollwork, filled: false },
	{ draw: waves, filled: false },
	{ draw: tally, filled: false },
];

export const PATTERN_ART_COUNT = DRAWINGS.length;

/** The engraving for pattern `index`, fitted to `panel`. */
export function patternArt(index: number, panel: Panel): Art[] {
	const drawing = DRAWINGS[index];

	if (!drawing) {
		throw new RangeError(`No pattern art at ${index}`);
	}

	return engrave(`Pattern ${index}`, drawing.draw(panel), drawing.filled);
}
