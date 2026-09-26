import { between, randomFrom, seedFrom } from "../random.ts";
import {
	type Art,
	ellipse,
	type Gradient,
	group,
	INK,
	type Point,
	polar,
	poly,
	shape,
	slot,
	star,
} from "./model.ts";

/**
 * Tier effects on the 1024² canvas: halo, gold rays, sparkles, holographic
 * foil, and cosmic rings. Each drawing is at full strength; callers set the
 * strength with a group opacity, which the Rive generator keys per tier.
 */

/** The optical centre of the chest and its contents on the canvas. */
export const AURA_CENTER: Point = [512, 540];

const [CX, CY] = AURA_CENTER;

export function haloArt(): Art[] {
	return [
		shape("Halo", ellipse(CX, CY, 940, 940), {
			kind: "radial",
			from: AURA_CENTER,
			to: [CX + 470, CY],
			stops: [
				[0, slot("glow", .9)],
				[.45, slot("glow", .45)],
				[1, slot("glow", 0)],
			],
		}, 0),
	];
}

/** A fan of `count` wedges radiating from the aura centre. */
export function raysArt(count: number, reach = 620): Art[] {
	if (count <= 0) {
		return [];
	}

	const half = Math.PI / count / 2;
	const wedges = Array.from({ length: count }, (_, i) => {
		const angle = i * Math.PI * 2 / count;
		const [x1, y1] = polar(reach, angle - half);
		const [x2, y2] = polar(reach, angle + half);

		return poly([[0, 0], [x1, y1], [x2, y2]]);
	});
	const fade: Gradient = {
		kind: "radial",
		from: [0, 0],
		to: [reach, 0],
		stops: [[0, slot("glow", .75)], [.35, slot("glow", .5)], [
			1,
			slot("glow", 0),
		]],
	};

	return [
		group("Rays", { x: CX, y: CY }, [shape("Rays", wedges, fade, 0)], {
			key: "rays-spin",
		}),
	];
}

/** One cel-shaded four-point glint, centred on (x, y). */
export function sparkleArt(
	x: number,
	y: number,
	size: number,
	rotation = 0,
): Art {
	return group("Sparkle", { x, y, rotation }, [
		shape("Glint", star(0, 0, size, size, 4, .3), slot("glow"), 2.5, INK),
		shape(
			"Glint core",
			star(0, 0, size * .45, size * .45, 4, .35),
			"FFFFFFFF",
			0,
		),
	]);
}

export type SparklePlacement = Readonly<{
	x: number;
	y: number;
	size: number;
	rotation: number;
}>;

/**
 * `count` sparkle positions on a loose ellipse around the chest, clear of the
 * chest itself and the tier plaque. The same seed always gives the same field.
 */
export function sparklePlacements(
	count: number,
	seed: string,
): SparklePlacement[] {
	const random = randomFrom(seedFrom(seed));
	const placements: SparklePlacement[] = [];

	for (let i = 0; i < count; i++) {
		// Spread evenly around the ring, jittered, so sparkles never clump.
		const angle = (i + between(random, .15, .85)) / count * Math.PI * 2;
		const [dx, dy] = polar(1, angle);
		const x = CX + dx * between(random, 330, 440);
		const y = Math.min(CY + dy * between(random, 300, 400), 800);

		placements.push({
			x,
			y,
			size: between(random, 22, 50),
			rotation: between(random, -.3, .3),
		});
	}

	return placements;
}

export type Bounds = Readonly<
	{ left: number; right: number; top: number; bottom: number }
>;

/** Rainbow foil across `bounds`, for clipping to a chest silhouette. */
export function holoArt(bounds: Bounds): Art[] {
	const { left, right, top, bottom } = bounds;
	const rainbow: Gradient = {
		kind: "linear",
		from: [left, top],
		to: [right, bottom],
		stops: [
			[0, "99FF8AD8"],
			[.18, "99FFE27A"],
			[.36, "998AFFC1"],
			[.54, "997FD8FF"],
			[.72, "99C39BFF"],
			[.9, "99FF8AD8"],
			[1, "99FFE27A"],
		],
	};
	const width = right - left;

	return [
		shape(
			"Foil",
			poly([[left, top], [right, top], [right, bottom], [left, bottom]]),
			rainbow,
			0,
		),
		shape(
			"Foil sheen",
			poly([
				[left + width * .28, top],
				[left + width * .42, top],
				[left + width * .3, bottom],
				[left + width * .16, bottom],
			]),
			"8CFFFFFF",
			0,
		),
	];
}

function ellipsePoints(
	width: number,
	height: number,
	from: number,
	to: number,
	steps = 32,
): Point[] {
	return Array.from({ length: steps + 1 }, (_, i): Point => {
		const angle = from + (to - from) * i / steps;

		return [Math.cos(angle) * width / 2, Math.sin(angle) * height / 2];
	});
}

type OrbitSpec = Readonly<{ width: number; height: number; tilt: number }>;

const ORBIT: OrbitSpec = { width: 780, height: 200, tilt: -.16 };
const DISK: OrbitSpec = { width: 860, height: 150, tilt: .1 };

/** Particles on the orbit: angles in radians, 0 at the right, clockwise. */
const PARTICLES = [.2, .9, 1.5, 2.3, 2.9, 3.6, 4.2, 4.8, 5.5, 6];

function onOrbit(angle: number, spec: OrbitSpec): Point {
	return [Math.cos(angle) * spec.width / 2, Math.sin(angle) * spec.height / 2];
}

/** The half of an orbit behind (`back`) or in front of the chest. */
function orbitArt(level: 2 | 3, half: "back" | "front"): Art[] {
	const spec = level === 3 ? DISK : ORBIT;
	const [from, to] = half === "back" ? [Math.PI, Math.PI * 2] : [0, Math.PI];
	const arc = poly(ellipsePoints(spec.width, spec.height, from, to), false, 20);
	const particles = PARTICLES
		.filter((angle) => (angle % (Math.PI * 2) < Math.PI) === (half === "front"))
		.map((angle) => {
			const [x, y] = onOrbit(angle, spec);
			const size = half === "front" ? 12 : 8;

			return ellipse(x, y, size, size);
		});
	const ring = level === 3
		? [
			shape("Accretion glow", arc, undefined, 30, slot("glow", .35)),
			shape("Accretion disk", arc, undefined, 12, slot("glow", .95)),
			shape("Photon edge", arc, undefined, 3, "E6FFFFFF"),
		]
		: [shape("Orbit", arc, undefined, 3, slot("glow", .7))];

	return [
		group(`Orbit ${half}`, { x: CX, y: CY + 20, rotation: spec.tilt }, [
			...ring,
			shape("Particles", particles, "FFFFFFFF", 2, slot("glow")),
		]),
	];
}

/** Everything cosmic that sits behind the chest, for `level` 1–3. */
export function cosmosBackArt(level: number): Art[] {
	const art: Art[] = [];

	if (level >= 1) {
		art.push(group("Corona", {}, [
			shape(
				"Corona glow",
				ellipse(CX, CY, 700, 700),
				undefined,
				26,
				slot("glow", .3),
			),
			shape(
				"Corona ring",
				ellipse(CX, CY, 700, 700),
				undefined,
				6,
				slot("glow", .85),
			),
			shape(
				"Corona inner",
				ellipse(CX, CY, 640, 640),
				undefined,
				2,
				"80FFFFFF",
			),
		], { key: "cosmos-1" }));
	}

	if (level === 2) {
		art.push(group("Orbit", {}, orbitArt(2, "back"), { key: "cosmos-2-back" }));
	}

	if (level >= 3) {
		art.push(group("Disk", {}, orbitArt(3, "back"), { key: "cosmos-3-back" }));
	}

	return art;
}

/** Everything cosmic that passes in front of the chest, for `level` 1–3. */
export function cosmosFrontArt(level: number): Art[] {
	const art: Art[] = [];

	if (level === 2) {
		art.push(
			group("Orbit", {}, orbitArt(2, "front"), { key: "cosmos-2-front" }),
		);
	}

	if (level >= 3) {
		art.push(
			group("Disk", {}, orbitArt(3, "front"), { key: "cosmos-3-front" }),
		);
	}

	return art;
}
