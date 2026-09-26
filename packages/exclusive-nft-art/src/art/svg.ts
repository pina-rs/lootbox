import type { TierPalette } from "../tiers.ts";
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

/**
 * Serialises the vector model to compact SVG markup.
 *
 * Output is a pure function of the input: gradient and clip ids come from a
 * per-document counter, and numbers are rounded to one decimal place (a tenth
 * of a unit is well under a pixel at the 1024² poster size), which keeps each
 * poster small and byte-for-byte reproducible.
 */
export class SvgWriter {
	readonly #palette: TierPalette;
	readonly #defs: string[] = [];
	#nextId = 0;

	constructor(palette: TierPalette) {
		this.#palette = palette;
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
		const body = this.write(item.children);

		if (!attrs && !clip) {
			return body;
		}

		return `<g${attrs}${clip}>${body}</g>`;
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
