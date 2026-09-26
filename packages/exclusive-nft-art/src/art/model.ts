/**
 * A tiny retained vector model shared by the SVG renderer and the Rive
 * generator.
 *
 * Every drawing in this package is written once in this model and emitted
 * twice: as an SVG poster (`svg.ts`) and as Rive RML
 * (`assets/lootbox-reveals/rive/exclusive-nft/generate.ts`). Keeping one source
 * means the still image a wallet shows and the animation a marketplace plays
 * cannot drift apart.
 *
 * Conventions:
 *
 * - Children are listed in painter's order: the first child draws at the back.
 *   (Rive draws its first sibling on top, so the Rive emitter reverses lists.)
 * - Colors are 8-digit `AARRGGBB` hex strings, Rive's native format.
 * - Rotation is in radians. A group applies translate, then rotate, then scale.
 * - Ellipses, rectangles, and stars are positioned by their centre.
 */

/** An `AARRGGBB` color, e.g. `FF243D40`. */
export type Color = string;

export type Point = readonly [x: number, y: number];

/**
 * A color that changes with the tier's chest finish.
 *
 * The SVG renderer resolves slots from the tier palette. The Rive generator
 * gives each slotted paint an id and keys its color per tier, so one chest
 * drawing serves all sixteen finishes.
 */
export type FinishSlot =
	| "wood"
	| "woodLight"
	| "trim"
	| "trimLight"
	| "lock"
	| "lockLight"
	| "feet"
	| "inside"
	| "glow";

export type SlotColor = Readonly<{ slot: FinishSlot; alpha?: number }>;

export type StopColor = Color | SlotColor;

export type GradientStop = readonly [offset: number, color: StopColor];

export type Gradient = Readonly<{
	kind: "linear" | "radial";
	/** Linear: the start point. Radial: the centre. */
	from: Point;
	/** Linear: the end point. Radial: any point on the outer radius. */
	to: Point;
	stops: readonly GradientStop[];
}>;

export type Paint = Color | SlotColor | Gradient;

export type Geometry =
	| Readonly<{
		kind: "poly";
		points: readonly Point[];
		closed: boolean;
		/** Corner rounding distance along each edge, as Rive's vertex radius. */
		radius: number;
	}>
	| Readonly<{
		kind: "ellipse";
		x: number;
		y: number;
		width: number;
		height: number;
	}>
	| Readonly<{
		kind: "rect";
		x: number;
		y: number;
		width: number;
		height: number;
		radius: number;
	}>
	| Readonly<{
		kind: "star";
		x: number;
		y: number;
		width: number;
		height: number;
		points: number;
		/** Inner radius as a fraction of the outer radius. */
		innerRadius: number;
	}>;

export type Stroke = Readonly<{ paint: Paint; width: number }>;

export type Shape = Readonly<{
	kind: "shape";
	name: string;
	geometry: readonly Geometry[];
	fill?: Paint;
	stroke?: Stroke;
	opacity?: number;
}>;

export type Transform = Readonly<{
	x?: number;
	y?: number;
	rotation?: number;
	scaleX?: number;
	scaleY?: number;
	opacity?: number;
}>;

export type Group = Readonly<
	Transform & {
		kind: "group";
		name: string;
		/**
		 * A stable handle for the Rive generator: groups with a key get an id so
		 * state machine animations can target them. The SVG renderer ignores it.
		 */
		key?: string;
		/** Clip every child to this geometry, in the group's local space. */
		clip?: readonly Geometry[];
		children: readonly Art[];
	}
>;

export type Art = Shape | Group;

/** The outline color shared by every drawing: a deep teal ink. */
export const INK: Color = "FF243D40";

// ---------------------------------------------------------------------------
// Geometry builders.

export function poly(
	points: readonly Point[],
	closed = true,
	radius = 0,
): Geometry {
	return { kind: "poly", points, closed, radius };
}

export function ellipse(
	x: number,
	y: number,
	width: number,
	height: number,
): Geometry {
	return { kind: "ellipse", x, y, width, height };
}

export function rect(
	x: number,
	y: number,
	width: number,
	height: number,
	radius = 0,
): Geometry {
	return { kind: "rect", x, y, width, height, radius };
}

export function star(
	x: number,
	y: number,
	width: number,
	height: number,
	points: number,
	innerRadius: number,
): Geometry {
	return { kind: "star", x, y, width, height, points, innerRadius };
}

// ---------------------------------------------------------------------------
// Art builders.

/**
 * A filled shape with the house ink outline.
 *
 * Pass `strokeWidth = 0` for a borderless fill, or `fill = undefined` for an
 * outline only.
 */
export function shape(
	name: string,
	geometry: Geometry | readonly Geometry[],
	fill?: Paint,
	strokeWidth = 3.5,
	strokeColor: Paint = INK,
): Shape {
	const list = Array.isArray(geometry) ? geometry : [geometry as Geometry];

	return {
		kind: "shape",
		name,
		geometry: list,
		...(fill === undefined ? {} : { fill }),
		...(strokeWidth > 0
			? { stroke: { paint: strokeColor, width: strokeWidth } }
			: {}),
	};
}

/** An open stroked polyline. */
export function line(
	name: string,
	points: readonly Point[],
	color: Paint = INK,
	width = 2,
	radius = 0,
): Shape {
	return shape(name, poly(points, false, radius), undefined, width, color);
}

export function group(
	name: string,
	transform: Transform,
	children: readonly Art[],
	extra: Readonly<{ key?: string; clip?: readonly Geometry[] }> = {},
): Group {
	return { kind: "group", name, ...transform, ...extra, children };
}

export function slot(name: FinishSlot, alpha?: number): SlotColor {
	return alpha === undefined ? { slot: name } : { slot: name, alpha };
}

/** Replace the alpha byte of an `AARRGGBB` color; `alpha` is 0–1. */
export function withAlpha(color: Color, alpha: number): Color {
	const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);

	return `${byte.toString(16).padStart(2, "0").toUpperCase()}${color.slice(2)}`;
}

export function isSlot(value: Paint | StopColor): value is SlotColor {
	return typeof value === "object" && "slot" in value;
}

export function isGradient(value: Paint): value is Gradient {
	return typeof value === "object" && "kind" in value;
}

/** Rotate a point about the origin; handy for radial arrangements. */
export function polar(radius: number, angle: number): Point {
	return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}
