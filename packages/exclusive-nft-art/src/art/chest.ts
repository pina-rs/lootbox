import {
	type Art,
	ellipse,
	type Geometry,
	type Group,
	group,
	INK,
	line,
	type Point,
	poly,
	shape,
	slot,
} from "./model.ts";
import { motion, use } from "./motion.ts";

// The chest's own idle: it breathes, the lid bobs on its hinge, and the
// contents float. These are the motions every NFT shares.
const breathe = motion("chest-breathe", 4, {
	scaleX: [[0, 1], [.5, .99], [1, 1]],
	scaleY: [[0, 1], [.5, 1.015], [1, 1]],
});
const lidBob = motion("lid-bob", 4, {
	y: [[0, 0], [.5, -8], [1, 0]],
	rotation: [[0, 0], [.5, -.02], [1, 0]],
});
const lockSway = motion("lock-bob", 4, {
	y: [[0, 0], [.5, -8], [1, 0]],
});
const float = motion("contents-float", 4, {
	y: [[0, 0], [.5, -10], [1, 0]],
});

/**
 * The cartoon chest, drawn in chest units with the origin at the middle of
 * its feet and y growing downward (the chest front spans y -183..-4).
 *
 * Geometry is the Empty Chest silhouette, so the two series read as one
 * family. Every finish-dependent color is a slot; outlines, cel shading, and
 * engraving use translucent ink so they sit well on any finish.
 */

/** Where the lid rests when closed. */
export const LID_Y = -183;
/** Where the lock plate rests when closed. */
export const LOCK_Y = -173;
/** The contents root sits on this line; negative y rises out of the chest. */
export const CONTENTS_Y = -7;

/** The painted front panel between the straps, for pattern engraving. */
export const BODY_PANEL = { left: -95, right: 89, top: -160, bottom: -27 };
/** The lid panel between the straps, in lid space. */
export const LID_PANEL = { left: -95, right: 89, top: -99, bottom: -2 };

const BODY_POINTS: readonly Point[] = [
	[-151, -182],
	[155, -179],
	[145, -8],
	[-139, -4],
];
const BODY_RADII = [5, 5, 4, 4];

const LID_POINTS: readonly Point[] = [
	[-151, 0],
	[-150, -89],
	[-143, -99],
	[143, -102],
	[155, -90],
	[154, 0],
];
const LID_RADII = [5, 8, 5, 6, 8, 5];

/** Polygon with per-vertex radii, approximated as the smallest radius. */
function rounded(points: readonly Point[], radii: readonly number[]): Geometry {
	return poly(points, true, Math.min(...radii));
}

export const BODY_SILHOUETTE: Geometry = rounded(BODY_POINTS, BODY_RADII);
export const LID_SILHOUETTE: Geometry = rounded(LID_POINTS, LID_RADII);

const shade = slot("inside", .22);
const scuff = "4D243D40";

function strap(name: string, points: readonly Point[]) {
	return shape(name, poly(points), slot("trim"), 3);
}

function rivet(x: number, y: number) {
	return shape("Rivet", ellipse(x, y, 7, 7), INK, 0);
}

function hatch(x: number, y: number, dx: number, dy: number, count: number) {
	return shape(
		"Ink hatch",
		Array.from(
			{ length: count },
			(_, i) => poly([[x + i * 4, y], [x + i * 4 + dx, y + dy]], false),
		),
		undefined,
		1.2,
	);
}

/** The front of the chest: wood, pattern, trim, cel shading, foil, and dressing. */
function bodyArt(
	pattern: readonly Art[],
	overlay: readonly Art[],
	decoration: readonly Art[],
): Art[] {
	return [
		shape("Painted chest body", BODY_SILHOUETTE, slot("wood"), 4.5),
		shape(
			"Cel shade",
			poly([[78, -180], [155, -179], [145, -8], [52, -6]], true, 4),
			shade,
			0,
		),
		...pattern,
		line("Wood seam upper", [[-145, -113], [-61, -116], [22, -112], [
			151,
			-115,
		]]),
		line("Wood seam lower", [[-143, -70], [-48, -73], [35, -68], [148, -72]]),
		line(
			"Paint edge glint",
			[[-83, -150], [-41, -152], [-30, -151]],
			slot(
				"woodLight",
			),
			3,
		),
		line(
			"Paint edge glint",
			[[31, -149], [65, -148], [82, -150]],
			slot(
				"woodLight",
			),
			3,
		),
		line(
			"Wood knot",
			[[31, -94], [44, -99], [60, -95], [45, -89], [31, -94]],
			scuff,
			1.8,
		),
		line("Paint scratch", [[-77, -91], [-63, -93], [-46, -91]], scuff, 1.8),
		line(
			"Dry brush",
			[[-86, -39], [-61, -40], [-32, -38], [-9, -40]],
			scuff,
			1.5,
		),
		hatch(65, -50, 6, 8, 7),
		shape(
			"Upper edge",
			poly([[-151, -183], [155, -180], [153, -160], [-151, -163]]),
			slot("trim"),
			3,
		),
		shape(
			"Lower edge",
			poly([[-140, -27], [144, -31], [144, -9], [-139, -5]]),
			slot("trim"),
			3,
		),
		strap("Left strap", [[-128, -175], [-95, -176], [-96, -17], [-126, -15]]),
		strap("Right strap", [[89, -175], [122, -176], [121, -17], [91, -15]]),
		line("Strap light", [[-119, -159], [-118, -33]], slot("trimLight"), 3),
		line("Strap light", [[98, -159], [99, -33]], slot("trimLight"), 3),
		rivet(-111, -151),
		rivet(-111, -37),
		rivet(106, -151),
		rivet(106, -37),
		...overlay,
		...decoration,
	];
}

/** The lid in its own space: y 0 is the hinge line, the top is about -102. */
function lidArt(
	pattern: readonly Art[],
	overlay: readonly Art[],
	decoration: readonly Art[],
): Art[] {
	return [
		shape("Curved lid", LID_SILHOUETTE, slot("wood"), 4.5),
		shape(
			"Lid cel shade",
			poly([[-150, -18], [154, -18], [154, 0], [-151, 0]], true, 4),
			shade,
			0,
		),
		...pattern,
		line("Lid plank seam", [[-148, -42], [-79, -44], [-1, -41], [86, -45], [
			153,
			-42,
		]]),
		line(
			"Lid timber scratch",
			[[-67, -59], [-43, -62], [-14, -61]],
			scuff,
			1.5,
		),
		hatch(43, -25, 7, 7, 6),
		line(
			"Lid top glint",
			[[-79, -86], [-40, -89], [29, -88], [81, -90]],
			slot(
				"woodLight",
			),
			3,
		),
		strap("Lid strap", [[-128, -100], [-95, -101], [-95, -1], [-127, 0]]),
		strap("Lid strap", [[89, -100], [122, -101], [122, -1], [90, 0]]),
		line("Lid strap light", [[-119, -87], [-118, -14]], slot("trimLight"), 3),
		line("Lid strap light", [[98, -87], [99, -14]], slot("trimLight"), 3),
		...overlay,
		...decoration,
	];
}

export type LidPose = Readonly<{ lift: number; tilt: number }>;

/** The poster pose: lid propped open, contents peeking out. */
export const POSTER_LID: LidPose = { lift: 56, tilt: -.06 };

export type ChestParts = Readonly<{
	lid: LidPose;
	bodyPattern: readonly Art[];
	lidPattern: readonly Art[];
	bodyOverlay: readonly Art[];
	lidOverlay: readonly Art[];
	bodyDecoration: readonly Art[];
	lidDecoration: readonly Art[];
	/** Lock art in lock-plate space. */
	lock: readonly Art[];
	/** Where a render rule nudges the lock, in chest units. */
	lockOffset: Readonly<{ x: number; y: number }>;
	contents: readonly Art[];
}>;

/**
 * The whole chest, keyed for the Rive generator.
 *
 * Keys: `wobble` (squash and tilt), `lid`, `lock`, and `contents` (the parent
 * of every contents root, animated to rise and bob).
 */
export function chest(parts: ChestParts): Group {
	return group("Chest", {}, [
		shape("Contact shadow", ellipse(0, 1, 345, 37), "33243D40", 0),
		group("Chest wobble", {}, [
			shape(
				"Left foot",
				poly([[-133, -15], [-96, -13], [-98, 9], [-135, 8]]),
				slot("feet"),
				4,
			),
			shape(
				"Right foot",
				poly([[99, -15], [136, -16], [135, 7], [101, 10]]),
				slot("feet"),
				4,
			),
			shape(
				"Dark inside",
				poly([[-143, -240], [143, -240], [143, -170], [-143, -170]], true, 6),
				slot("inside"),
				3,
			),
			group(
				"Lid",
				{ y: LID_Y - parts.lid.lift, rotation: parts.lid.tilt },
				[
					group(
						"Lid bob",
						{},
						lidArt(parts.lidPattern, parts.lidOverlay, parts.lidDecoration),
						{ motion: use(lidBob) },
					),
				],
				{ key: "lid" },
			),
			group("Contents", { y: CONTENTS_Y }, [
				group("Float", {}, parts.contents, { motion: use(float) }),
			], { key: "contents" }),
			group(
				"Body",
				{},
				bodyArt(parts.bodyPattern, parts.bodyOverlay, parts.bodyDecoration),
			),
			group("Lock plate", { y: LOCK_Y - parts.lid.lift }, [
				group("Lock bob", {}, [
					group("Lock offset", parts.lockOffset, parts.lock, {
						key: "lock-offset",
					}),
				], { motion: use(lockSway) }),
			], { key: "lock" }),
		], { key: "wobble", motion: use(breathe) }),
	]);
}
