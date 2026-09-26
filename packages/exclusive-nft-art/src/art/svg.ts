import type { FinishPalette } from "../finishes.ts";
import {
	type Art,
	type Color,
	type Geometry,
	type Gradient,
	isGradient,
	isSlot,
	type Paint,
	type Point,
	type Shape,
	type StopColor,
	type Transform,
	withAlpha,
} from "./model.ts";
import {
	type Motion,
	MOTION_PROPERTIES,
	type MotionUse,
	sample,
} from "./motion.ts";

/**
 * Serialises the vector model to compact SVG markup.
 *
 * Output is a pure function of the input: gradient and clip ids come from a
 * per-document counter, and numbers are rounded to one decimal place (a tenth
 * of a unit is well under a pixel at the 1024² poster size), which keeps each
 * poster small and byte-for-byte reproducible.
 *
 * With `animated`, every group that carries a motion gains an inner `<g>`
 * animated by CSS keyframes; without it motions are ignored and the output is
 * the still poster.
 */
export class SvgWriter {
	readonly #palette: FinishPalette;
	readonly #animated: boolean;
	readonly #defs: string[] = [];
	readonly #keyframes = new Map<string, string>();
	readonly #classes = new Map<
		string,
		Readonly<{ name: string; rule: string }>
	>();
	#nextId = 0;

	constructor(palette: FinishPalette, animated = false) {
		this.#palette = palette;
		this.#animated = animated;
	}

	/**
	 * The `<style>` for every motion written so far, or `""` for a still.
	 * Reduced-motion viewers get the still pose.
	 */
	get style(): string {
		if (!this.#classes.size) {
			return "";
		}

		const rules = [...this.#classes.values()].map(({ rule }) => rule).join("");
		const frames = [...this.#keyframes.values()].join("");

		return `<style>${frames}${rules}@media (prefers-reduced-motion:reduce){.m{animation:none!important}}</style>`;
	}

	/** The `<defs>` accumulated while writing art. */
	get defs(): string {
		return this.#defs.length ? `<defs>${this.#defs.join("")}</defs>` : "";
	}

	write(art: readonly Art[]): string {
		return art.map((item) => this.#art(item)).join("");
	}

	#art(item: Art): string {
		if (item.kind === "shape") {
			return this.#shape(item);
		}

		const attrs = transformAttrs(item);
		const clip = item.clip ? this.#clip(item.clip) : "";
		const children = this.write(item.children);
		const body = this.#animated && item.motion
			? `<g class="m ${this.#motionClass(item.motion)}">${children}</g>`
			: children;

		if (!attrs && !clip) {
			return body;
		}

		return `<g${attrs}${clip}>${body}</g>`;
	}

	#motionClass({ motion, phase }: MotionUse): string {
		const frames = keyframesName(motion);
		const signature = `${frames}@${phase}`;
		const existing = this.#classes.get(signature);

		if (existing) {
			return existing.name;
		}

		if (!this.#keyframes.has(frames)) {
			this.#keyframes.set(frames, cssKeyframes(frames, motion));
		}

		const name = `a${this.#classes.size}`;
		const timing = motion.linear ? "linear" : "ease-in-out";
		const delay = phase ? ` ${num(-phase * motion.duration, 3)}s` : "";

		this.#classes.set(signature, {
			name,
			rule: `.${name}{animation:${frames} ${
				num(motion.duration, 3)
			}s ${timing} infinite${delay}}`,
		});

		return name;
	}

	#shape(item: Shape): string {
		const d = item.geometry.map(pathData).join("");

		if (!d) {
			return "";
		}

		const fill = item.fill === undefined
			? ' fill="none"'
			: this.#paint("fill", item.fill);
		const stroke = item.stroke
			? `${this.#paint("stroke", item.stroke.paint)} stroke-width="${
				num(item.stroke.width)
			}"`
			: "";
		const opacity = item.opacity === undefined || item.opacity === 1
			? ""
			: ` opacity="${num(item.opacity)}"`;

		return `<path d="${d}"${fill}${stroke}${opacity}/>`;
	}

	#paint(attribute: "fill" | "stroke", paint: Paint): string {
		if (isGradient(paint)) {
			return ` ${attribute}="url(#${this.#gradient(paint)})"`;
		}

		const color = this.#resolve(paint);
		const alpha = parseInt(color.slice(0, 2), 16) / 255;
		const opacity = alpha < 1 ? ` ${attribute}-opacity="${num(alpha, 2)}"` : "";

		return ` ${attribute}="#${color.slice(2)}"${opacity}`;
	}

	#resolve(color: StopColor): Color {
		if (!isSlot(color)) {
			return color;
		}

		const base = this.#palette[color.slot];

		return color.alpha === undefined ? base : withAlpha(base, color.alpha);
	}

	#gradient(gradient: Gradient): string {
		const id = `g${this.#nextId++}`;
		const stops = gradient.stops.map(([offset, stop]) => {
			const color = this.#resolve(stop);
			const alpha = parseInt(color.slice(0, 2), 16) / 255;
			const opacity = alpha < 1 ? ` stop-opacity="${num(alpha, 2)}"` : "";

			return `<stop offset="${num(offset, 3)}" stop-color="#${
				color.slice(2)
			}"${opacity}/>`;
		}).join("");
		const [x1, y1] = gradient.from;
		const [x2, y2] = gradient.to;

		if (gradient.kind === "radial") {
			const radius = Math.hypot(x2 - x1, y2 - y1);

			this.#defs.push(
				`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${
					num(x1)
				}" cy="${num(y1)}" r="${num(radius)}">${stops}</radialGradient>`,
			);

			return id;
		}

		this.#defs.push(
			`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${
				num(x1)
			}" y1="${num(y1)}" x2="${num(x2)}" y2="${
				num(y2)
			}">${stops}</linearGradient>`,
		);

		return id;
	}

	#clip(geometry: readonly Geometry[]): string {
		const id = `c${this.#nextId++}`;

		this.#defs.push(
			`<clipPath id="${id}"><path d="${
				geometry.map(pathData).join("")
			}"/></clipPath>`,
		);

		return ` clip-path="url(#${id})"`;
	}
}

function keyframesName(motion: Motion): string {
	return `k-${motion.name.replace(/[^A-Za-z0-9-]/g, "-")}`;
}

/** One CSS `@keyframes` rule sampling every track at every key time. */
function cssKeyframes(name: string, motion: Motion): string {
	const times = new Set<number>();

	for (const keys of Object.values(motion.tracks)) {
		for (const [t] of keys) {
			times.add(t);
		}
	}

	const steps = [...times].sort((a, b) => a - b).map((t) => {
		const at = (property: (typeof MOTION_PROPERTIES)[number], rest: number) => {
			const keys = motion.tracks[property];

			return keys ? sample(keys, t, motion.linear) : rest;
		};
		const hasTransform = MOTION_PROPERTIES.some((property) =>
			property !== "opacity" && motion.tracks[property]
		);
		const transform = hasTransform
			? `transform:translate(${num(at("x", 0))}px,${
				num(at("y", 0))
			}px) rotate(${num(at("rotation", 0) * 180 / Math.PI, 2)}deg) scale(${
				num(at("scaleX", 1), 3)
			},${num(at("scaleY", 1), 3)});`
			: "";
		const opacity = motion.tracks.opacity
			? `opacity:${num(at("opacity", 1), 3)}`
			: "";

		return `${num(t * 100, 2)}%{${transform}${opacity}}`;
	}).join("");

	return `@keyframes ${name}{${steps}}`;
}

/** Round to `digits` decimals and drop trailing zeros; `-0` becomes `0`. */
export function num(value: number, digits = 1): string {
	const rounded = Number(value.toFixed(digits));

	return Object.is(rounded, -0) ? "0" : String(rounded);
}

function transformAttrs(item: Transform): string {
	const parts: string[] = [];
	const { x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1 } = item;

	if (x !== 0 || y !== 0) {
		parts.push(`translate(${num(x)} ${num(y)})`);
	}

	if (rotation !== 0) {
		parts.push(`rotate(${num(rotation * 180 / Math.PI, 2)})`);
	}

	if (scaleX !== 1 || scaleY !== 1) {
		parts.push(
			scaleX === scaleY
				? `scale(${num(scaleX, 3)})`
				: `scale(${num(scaleX, 3)} ${num(scaleY, 3)})`,
		);
	}

	const transform = parts.length ? ` transform="${parts.join("")}"` : "";
	const opacity = item.opacity === undefined || item.opacity === 1
		? ""
		: ` opacity="${num(item.opacity, 2)}"`;

	return `${transform}${opacity}`;
}

function pathData(geometry: Geometry): string {
	switch (geometry.kind) {
		case "poly":
			return polyData(geometry.points, geometry.closed, geometry.radius);

		case "ellipse": {
			const rx = geometry.width / 2;
			const ry = geometry.height / 2;
			const { x, y } = geometry;

			return `M${num(x - rx)} ${num(y)}a${num(rx)} ${num(ry)} 0 1 0 ${
				num(rx * 2)
			} 0a${num(rx)} ${num(ry)} 0 1 0 ${num(-rx * 2)} 0Z`;
		}

		case "rect": {
			const { x, y, width, height, radius } = geometry;
			const left = x - width / 2;
			const top = y - height / 2;
			const corners: Point[] = [
				[left, top],
				[left + width, top],
				[left + width, top + height],
				[left, top + height],
			];

			return polyData(corners, true, radius);
		}

		case "star": {
			const { x, y, width, height, points, innerRadius } = geometry;
			const vertices = Array.from({ length: points * 2 }, (_, i): Point => {
				const angle = -Math.PI / 2 + i * Math.PI / points;
				const scale = i % 2 ? innerRadius : 1;

				return [
					x + Math.cos(angle) * width / 2 * scale,
					y + Math.sin(angle) * height / 2 * scale,
				];
			});

			return polyData(vertices, true, 0);
		}
	}
}

/**
 * A polyline with Rive-style rounded corners.
 *
 * Rive rounds a vertex by cutting `radius` along each adjoining edge (capped
 * at half the edge) and bridging the cut with a curve. A quadratic through the
 * vertex matches it closely at poster sizes.
 */
function polyData(
	points: readonly Point[],
	closed: boolean,
	radius: number,
): string {
	if (points.length < 2) {
		return "";
	}

	if (radius <= 0) {
		const [first, ...rest] = points;

		return `M${pt(first)}${rest.map((p) => `L${pt(p)}`).join("")}${
			closed ? "Z" : ""
		}`;
	}

	const count = points.length;
	const segments: string[] = [];

	for (let i = 0; i < count; i++) {
		const vertex = at(points, i);
		const isEnd = !closed && (i === 0 || i === count - 1);

		if (isEnd) {
			segments.push(`${segments.length ? "L" : "M"}${pt(vertex)}`);
			continue;
		}

		const before = at(points, (i - 1 + count) % count);
		const after = at(points, (i + 1) % count);
		const cut = Math.min(
			radius,
			distance(vertex, before) / 2,
			distance(vertex, after) / 2,
		);
		const start = toward(vertex, before, cut);
		const end = toward(vertex, after, cut);

		segments.push(
			`${segments.length ? "L" : "M"}${pt(start)}Q${pt(vertex)} ${pt(end)}`,
		);
	}

	return `${segments.join("")}${closed ? "Z" : ""}`;
}

function at(points: readonly Point[], index: number): Point {
	const point = points[index];

	if (!point) {
		throw new RangeError(`No point at ${index}`);
	}

	return point;
}

function pt(point: Point | undefined): string {
	if (!point) {
		throw new RangeError("Missing point");
	}

	return `${num(point[0])} ${num(point[1])}`;
}

function distance(a: Point, b: Point): number {
	return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function toward(from: Point, to: Point, length: number): Point {
	const total = distance(from, to);

	if (total === 0) {
		return from;
	}

	return [
		from[0] + (to[0] - from[0]) / total * length,
		from[1] + (to[1] - from[1]) / total * length,
	];
}
