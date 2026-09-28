export type Point = readonly [x: number, y: number];

const fixed = (value: number) => Number(value.toFixed(2));

/** A closed polygon path whose corners are rounded with quadratic curves. */
export function roundedPolygon(
	points: readonly Point[],
	radius: number,
): string {
	const count = points.length;
	let path = "";

	for (let index = 0; index < count; index++) {
		const previous = points[(index - 1 + count) % count];
		const corner = points[index];
		const next = points[(index + 1) % count];

		if (!previous || !corner || !next) continue;

		const inX = previous[0] - corner[0];
		const inY = previous[1] - corner[1];
		const outX = next[0] - corner[0];
		const outY = next[1] - corner[1];
		const inLength = Math.hypot(inX, inY);
		const outLength = Math.hypot(outX, outY);
		const r = Math.min(radius, inLength / 2, outLength / 2);
		const start = [
			fixed(corner[0] + (inX / inLength) * r),
			fixed(corner[1] + (inY / inLength) * r),
		];
		const end = [
			fixed(corner[0] + (outX / outLength) * r),
			fixed(corner[1] + (outY / outLength) * r),
		];

		path += `${index === 0 ? "M" : "L"}${start.join(",")}Q${corner.join(",")},${
			end.join(",")
		}`;
	}

	return `${path}Z`;
}

/** A four-point sparkle with concave sides, centred on (x, y). */
export function sparklePath(x: number, y: number, radius: number): string {
	const k = radius * 0.28;

	return [
		`M${x},${y - radius}`,
		`Q${x + k},${y - k} ${x + radius},${y}`,
		`Q${x + k},${y + k} ${x},${y + radius}`,
		`Q${x - k},${y + k} ${x - radius},${y}`,
		`Q${x - k},${y - k} ${x},${y - radius}Z`,
	].join("");
}

export const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/** A document-safe id prefix from React's `useId`, usable in `url(#…)`. */
export const svgId = (reactId: string) =>
	`lb${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
