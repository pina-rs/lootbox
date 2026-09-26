import {
	type Art,
	type Color,
	type FinishSlot,
	type Geometry,
	type Gradient,
	type Group,
	isGradient,
	isSlot,
	type Paint,
	type Shape,
	type StopColor,
	type Transform,
	withAlpha,
} from "../../../../packages/exclusive-nft-art/src/art/model.ts";
import {
	type MotionProperty,
	type MotionUse,
	phasedKeys,
} from "../../../../packages/exclusive-nft-art/src/art/motion.ts";
import type { FinishPalette } from "../../../../packages/exclusive-nft-art/src/finishes.ts";

/**
 * Vector model → Rive RML, plus the keyframe and formula helpers the scene
 * generator needs. Rive draws the first sibling on top, so lists are reversed.
 */

export const FPS = 30;

export const PROPERTY_KEY: Readonly<Record<MotionProperty, number>> = {
	x: 13,
	y: 14,
	rotation: 15,
	scaleX: 16,
	scaleY: 17,
	opacity: 18,
};

const SOLID_COLOR = 37;
const STOP_COLOR = 38;

export const round = (value: number) => Number(value.toFixed(3));
export const ref = (id: number) => `0:${id}`;

export function raise(message: string): never {
	throw new Error(message);
}

// ---------------------------------------------------------------------------
// Keyframes.

export type Ease = "ease" | "out" | "in" | "linear" | "hold";
export type Key = readonly [frame: number, value: number, ease?: Ease];
export type Track = Readonly<
	{ id: number; property: number; keys: readonly Key[] }
>;
export type ColorTrack = Readonly<
	{ id: number; property: number; color: Color }
>;

const CURVES: Readonly<Record<"ease" | "out" | "in", string>> = {
	ease: 'x1="0.42" y1="0" x2="0.58" y2="1"',
	out: 'x1="0.16" y1="0.84" x2="0.3" y2="1"',
	in: 'x1="0.55" y1="0" x2="0.9" y2="0.4"',
};

export const track = (
	id: number,
	property: number,
	keys: readonly Key[],
): Track => ({ id, property, keys });
export const hold = (id: number, property: number, value: number): Track =>
	track(id, property, [[0, value, "hold"]]);

function keyframe([frame, value, ease = "ease"]: Key): string {
	if (ease === "hold" || ease === "linear") {
		return `<KeyFrameDouble frame="${frame}" value="${
			round(value)
		}" interpolationType="${ease}"/>`;
	}

	return `<KeyFrameDouble frame="${frame}" value="${
		round(value)
	}" interpolationType="cubic"><CubicEaseInterpolator ${
		CURVES[ease]
	}/></KeyFrameDouble>`;
}

function keyedObjects(
	tracks: readonly Track[],
	colors: readonly ColorTrack[],
): string {
	const byObject = new Map<number, string[]>();
	const seen = new Set<string>();
	const add = (id: number, property: number, body: string) => {
		const signature = `${id}/${property}`;

		if (seen.has(signature)) {
			throw new Error(`Duplicate track ${signature}`);
		}

		seen.add(signature);
		byObject.set(id, [
			...(byObject.get(id) ?? []),
			`<KeyedProperty propertyKey="${property}">${body}</KeyedProperty>`,
		]);
	};

	for (const item of tracks) {
		add(item.id, item.property, item.keys.map(keyframe).join(""));
	}

	for (const item of colors) {
		add(
			item.id,
			item.property,
			`<KeyFrameColor frame="0" value="${item.color}" interpolationType="hold"/>`,
		);
	}

	return [...byObject].map(([id, properties]) =>
		`<KeyedObject objectId="${ref(id)}">${properties.join("")}</KeyedObject>`
	)
		.join("");
}

export function animation(
	name: string,
	id: number,
	duration: number,
	loop: boolean,
	tracks: readonly Track[],
	colors: readonly ColorTrack[] = [],
): string {
	return `<LinearAnimation name="${name}" id="${
		ref(id)
	}" fps="${FPS}" duration="${duration}" loopValue="${
		loop ? "loop" : "oneShot"
	}">${keyedObjects(tracks, colors)}</LinearAnimation>`;
}

/** Frames in one cycle of a motion lasting `seconds`. */
export function cycleFrames(seconds: number): number {
	return Math.round(seconds * FPS);
}

/**
 * One cycle of a model motion as tracks on `id`, for a looping animation as
 * long as the motion. Motions of equal duration share one such animation.
 *
 * Keys are floored to frames so a wrap-around snap just before the end (a
 * symmetric fan turning one wedge) stays on the frame before the end.
 */
export function motionTracks(
	id: number,
	{ motion, phase }: MotionUse,
): Track[] {
	const frames = cycleFrames(motion.duration);
	const ease: Ease = motion.linear ? "linear" : "ease";

	return Object.entries(motion.tracks).map(([property, keys]) => {
		const out: Key[] = [];

		for (const [t, value] of phasedKeys(keys, phase, motion.linear)) {
			const frame = t === 1 ? frames : Math.floor(t * frames);
			const previous = out.at(-1);

			if (previous && frame <= previous[0]) {
				continue;
			}

			out.push([frame, value, ease]);
		}

		return track(id, PROPERTY_KEY[property as MotionProperty], out);
	});
}

// ---------------------------------------------------------------------------
// Formulas for data-binding converters.

export type Expr =
	| Readonly<{ kind: "number"; value: number }>
	| Readonly<{ kind: "input" }>
	| Readonly<{ kind: "property"; id: number }>
	| Readonly<{ kind: "binary"; op: "+" | "-" | "*"; left: Expr; right: Expr }>
	| Readonly<{ kind: "call"; fn: "min" | "max"; args: readonly Expr[] }>;

const OPERATION = { "+": 0, "-": 1, "*": 2 } as const;
const FUNCTION = { min: 0, max: 1 } as const;

export const num = (value: number): Expr => ({ kind: "number", value });
export const input: Expr = { kind: "input" };
export const property = (id: number): Expr => ({ kind: "property", id });
export const add = (left: Expr, right: Expr): Expr => ({
	kind: "binary",
	op: "+",
	left,
	right,
});
export const sub = (left: Expr, right: Expr): Expr => ({
	kind: "binary",
	op: "-",
	left,
	right,
});
export const mul = (left: Expr, right: Expr): Expr => ({
	kind: "binary",
	op: "*",
	left,
	right,
});
export const min = (...args: Expr[]): Expr => ({
	kind: "call",
	fn: "min",
	args,
});
export const max = (...args: Expr[]): Expr => ({
	kind: "call",
	fn: "max",
	args,
});

/** 1 when an integer-valued `value` equals `target`, else 0. */
export function equals(value: Expr, target: number): Expr {
	const delta = sub(value, num(target));

	return max(num(0), sub(num(1), min(num(1), mul(delta, delta))));
}

export function tokens(expr: Expr, viewModel: number): string {
	switch (expr.kind) {
		case "number":
			return `<FormulaTokenValue operationValue="${round(expr.value)}"/>`;

		case "input":
			return "<FormulaTokenInput/>";

		case "property":
			return `<FormulaTokenValue><DataBindContext sourcePathIds="${
				ref(viewModel)
			}-${ref(expr.id)}" propertyKey="777"/></FormulaTokenValue>`;

		case "binary":
			return `<FormulaTokenParenthesisOpen/>${
				tokens(expr.left, viewModel)
			}<FormulaTokenOperation operationType="${OPERATION[expr.op]}"/>${
				tokens(expr.right, viewModel)
			}<FormulaTokenParenthesisClose/>`;

		case "call":
			return `<FormulaTokenFunction functionType="${FUNCTION[expr.fn]}"/>${
				expr.args.map((arg) => tokens(arg, viewModel)).join(
					"<FormulaTokenArgumentSeparator/>",
				)
			}<FormulaTokenParenthesisClose/>`;
	}
}

// ---------------------------------------------------------------------------
// Model → RML.

export type SlotPaint = Readonly<
	{ id: number; slot: FinishSlot; alpha: number | undefined; property: number }
>;

/** A data bind to write as a group's first child, keyed by the group's key. */
export type Binding = Readonly<
	{ source: number; propertyKey: number; converter: number }
>;

export class RmlWriter {
	#next = 1000;
	readonly keys = new Map<string, number>();
	readonly slots: SlotPaint[] = [];
	/** Motion wrappers written so far, for the ambient loop. */
	readonly motions: { id: number; use: MotionUse }[] = [];
	readonly bindings = new Map<string, Binding[]>();
	readonly #fallback: FinishPalette;
	readonly #viewModel: number;

	constructor(fallback: FinishPalette, viewModel: number) {
		this.#fallback = fallback;
		this.#viewModel = viewModel;
	}

	id(): number {
		return this.#next++;
	}

	/** The id of a keyed group; throws if the art never declared the key. */
	key(name: string): number {
		return this.keys.get(name) ?? raise(`No keyed group "${name}"`);
	}

	bind(key: string, binding: Binding): void {
		this.bindings.set(key, [...(this.bindings.get(key) ?? []), binding]);
	}

	write(art: readonly Art[]): string {
		return [...art].reverse().map((
			item,
		) => (item.kind === "shape" ? this.#shape(item) : this.#group(item))).join(
			"",
		);
	}

	#group(item: Group): string {
		let id: number | null = null;
		let binds = "";

		if (item.key !== undefined) {
			if (this.keys.has(item.key)) {
				throw new Error(`Duplicate key "${item.key}"`);
			}

			id = this.id();
			this.keys.set(item.key, id);
			binds = (this.bindings.get(item.key) ?? []).map((binding) =>
				`<DataBindContext sourcePathIds="${ref(this.#viewModel)}-${
					ref(binding.source)
				}" propertyKey="${binding.propertyKey}" converterId="${
					ref(binding.converter)
				}"/>`
			).join("");
		}

		let clip = "";

		if (item.clip) {
			const source = this.id();

			clip = `<ClippingShape sourceId="${
				ref(source)
			}"/><Shape name="Clip source" id="${ref(source)}">${
				item.clip.map(geometry).join("")
			}</Shape>`;
		}

		let body = this.write(item.children);

		if (item.motion) {
			const wrapper = this.id();

			this.motions.push({ id: wrapper, use: item.motion });
			body = `<Node name="Motion" id="${ref(wrapper)}">${body}</Node>`;
		}

		return `<Node name="${item.name}"${id === null ? "" : ` id="${ref(id)}"`}${
			transform(item)
		}>${binds}${clip}${body}</Node>`;
	}

	#shape(item: Shape): string {
		const paths = item.geometry.map(geometry).join("");
		const fill = item.fill === undefined
			? ""
			: `<Fill>${this.#paint(item.fill)}</Fill>`;
		const stroke = item.stroke
			? `<Stroke thickness="${
				round(item.stroke.width)
			}" cap="round" join="round">${this.#paint(item.stroke.paint)}</Stroke>`
			: "";
		const opacity = item.opacity === undefined
			? ""
			: ` opacity="${round(item.opacity)}"`;

		return `<Shape name="${item.name}"${opacity}>${paths}${fill}${stroke}</Shape>`;
	}

	#paint(paint: Paint): string {
		return isGradient(paint)
			? this.#gradient(paint)
			: `<SolidColor${this.#color(paint, SOLID_COLOR)}/>`;
	}

	#color(color: StopColor, property: number): string {
		if (!isSlot(color)) {
			return ` colorValue="${color}"`;
		}

		const id = this.id();

		this.slots.push({ id, slot: color.slot, alpha: color.alpha, property });

		return ` id="${ref(id)}" colorValue="${
			slotColor(this.#fallback, color.slot, color.alpha)
		}"`;
	}

	#gradient(gradient: Gradient): string {
		const tag = gradient.kind === "radial"
			? "RadialGradient"
			: "LinearGradient";
		const [startX, startY] = gradient.from;
		const [endX, endY] = gradient.to;
		const stops = gradient.stops.map(([position, color]) =>
			`<GradientStop${this.#color(color, STOP_COLOR)} position="${
				round(position)
			}"/>`
		).join("");

		return `<${tag} startX="${round(startX)}" startY="${round(startY)}" endX="${
			round(endX)
		}" endY="${round(endY)}">${stops}</${tag}>`;
	}
}

export function slotColor(
	palette: FinishPalette,
	name: FinishSlot,
	alpha: number | undefined,
): Color {
	const base = palette[name];

	return alpha === undefined ? base : withAlpha(base, alpha);
}

function transform(item: Transform): string {
	const attrs: [string, number | undefined][] = [
		["x", item.x],
		["y", item.y],
		["rotation", item.rotation],
		["scaleX", item.scaleX],
		["scaleY", item.scaleY],
		["opacity", item.opacity],
	];

	return attrs
		.filter(([, value]) => value !== undefined)
		.map(([name, value]) => ` ${name}="${round(value ?? 0)}"`)
		.join("");
}

function geometry(item: Geometry): string {
	switch (item.kind) {
		case "poly":
			return `<PointsPath isClosed="${item.closed}">${
				item.points.map(([x, y]) =>
					`<StraightVertex x="${round(x)}" y="${round(y)}"${
						item.radius ? ` radius="${round(item.radius)}"` : ""
					}/>`
				).join("")
			}</PointsPath>`;

		case "ellipse":
			return `<Ellipse x="${round(item.x)}" y="${round(item.y)}" width="${
				round(item.width)
			}" height="${round(item.height)}"/>`;

		case "rect":
			return `<Rectangle x="${round(item.x)}" y="${round(item.y)}" width="${
				round(item.width)
			}" height="${round(item.height)}" cornerRadiusTL="${
				round(item.radius)
			}"/>`;

		case "star":
			return `<Star x="${round(item.x)}" y="${round(item.y)}" width="${
				round(item.width)
			}" height="${round(item.height)}" points="${item.points}" innerRadius="${
				round(item.innerRadius)
			}"/>`;
	}
}
