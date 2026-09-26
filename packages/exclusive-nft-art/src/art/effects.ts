import { between, randomFrom, seedFrom } from "../random.ts";
import {
	type Art,
	type Color,
	ellipse,
	type Gradient,
	group,
	INK,
	type Point,
	polar,
	poly,
	rect,
	shape,
	slot,
	star,
	type StopColor,
	withAlpha,
} from "./model.ts";
import { type Motion, motion, type MotionKey, use } from "./motion.ts";

/**
 * Effects on the 1024² canvas: the finish's own glow and foil, and the
 * animated `effect` layer. Every effect group sits at its pivot, so motions
 * scale and spin around the right point in both SVG and Rive.
 */

/** The optical centre of the chest and its contents on the canvas. */
export const AURA_CENTER: Point = [512, 540];

const [CX, CY] = AURA_CENTER;

/**
 * An effect's color: `"glow"` follows the finish (for the finish's own
 * material glow); any `AARRGGBB` is fixed, which keeps the effect layer
 * independent of the finish.
 */
export type Tint = "glow" | Color;

function tone(tint: Tint, alpha = 1): StopColor {
	return tint === "glow" ? slot("glow", alpha) : withAlpha(tint, alpha);
}

const GOLD = "FFFFC94A";
const ORBIT_TINT = "FF7FD8FF";
const COSMIC_TINT = "FFC39BFF";
const SINGULARITY_TINT = "FFFF9F43";

// ---------------------------------------------------------------------------
// Finish material: glow and holographic foil.

export function haloArt(tint: Tint = "glow"): Art {
	return group("Halo", { x: CX, y: CY }, [
		shape("Halo", ellipse(0, 0, 940, 940), {
			kind: "radial",
			from: [0, 0],
			to: [470, 0],
			stops: [
				[0, tone(tint, .9)],
				[.45, tone(tint, .45)],
				[1, tone(tint, 0)],
			],
		}, 0),
	]);
}

export type Bounds = Readonly<
	{ left: number; right: number; top: number; bottom: number }
>;

const RAINBOW: Gradient["stops"] = [
	[0, "99FF8AD8"],
	[.18, "99FFE27A"],
	[.36, "998AFFC1"],
	[.54, "997FD8FF"],
	[.72, "99C39BFF"],
	[.9, "99FF8AD8"],
	[1, "99FFE27A"],
];

const sheen = motion("holo-sheen", 8, {
	x: [[0, -120], [.5, 160], [1, -120]],
});

/** Rainbow foil across `bounds`, for clipping to a chest silhouette. */
export function holoArt(bounds: Bounds): Art[] {
	const { left, right, top, bottom } = bounds;
	const width = right - left;

	return [
		shape(
			"Foil",
			poly([[left, top], [right, top], [right, bottom], [left, bottom]]),
			{
				kind: "linear",
				from: [left, top],
				to: [right, bottom],
				stops: RAINBOW,
			},
			0,
		),
		group("Sheen", {}, [
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
		], { motion: use(sheen) }),
	];
}

// ---------------------------------------------------------------------------
// Shared pieces.

const twinkle = motion("twinkle", 2, {
	scaleX: [[0, 1], [.35, .45], [.7, 1.12], [1, 1]],
	scaleY: [[0, 1], [.35, .45], [.7, 1.12], [1, 1]],
});

/** One cel-shaded four-point glint, centred on (x, y). */
export function sparkleArt(
	x: number,
	y: number,
	size: number,
	rotation = 0,
	twinkling?: number,
	tint: Tint = GOLD,
): Art {
	return group("Sparkle", { x, y, rotation }, [
		shape("Glint", star(0, 0, size, size, 4, .3), tone(tint), 2.5, INK),
		shape(
			"Glint core",
			star(0, 0, size * .45, size * .45, 4, .35),
			"FFFFFFFF",
			0,
		),
	], twinkling === undefined ? {} : { motion: use(twinkle, twinkling) });
}

export type SparklePlacement = Readonly<
	{ x: number; y: number; size: number; rotation: number }
>;

/** The van der Corput sequence in base 2: 0, ½, ¼, ¾, ⅛, … */
export function vanDerCorput(index: number): number {
	let value = 0;
	let denominator = 1;
	let n = index;

	while (n > 0) {
		denominator *= 2;
		value += (n % 2) / denominator;
		n = Math.floor(n / 2);
	}

	return value;
}

/**
 * `count` sparkle positions on a loose ellipse around the chest.
 *
 * Angles follow the bit-reversal (van der Corput) order, so every prefix of
 * the list is evenly spread around the ring: a host that shows only the first
 * `n` sparkles never gets a lopsided cluster.
 */
export function sparklePlacements(
	count: number,
	seed: string,
): SparklePlacement[] {
	const random = randomFrom(seedFrom(seed));

	return Array.from({ length: count }, (_, i) => {
		const angle = (vanDerCorput(i) + between(random, -.02, .02)) * Math.PI * 2;
		const [dx, dy] = polar(1, angle);

		return {
			x: CX + dx * between(random, 330, 440),
			y: Math.min(CY + dy * between(random, 300, 400), 800),
			size: between(random, 22, 50),
			rotation: between(random, -.3, .3),
		};
	});
}

/** A fan of `count` wedges radiating from the aura centre, fading outward. */
export function raysArt(count: number, tint: Tint = GOLD, reach = 620): Art[] {
	const half = Math.PI / count / 2;
	const wedges = Array.from({ length: count }, (_, i) => {
		const angle = i * Math.PI * 2 / count;
		const [x1, y1] = polar(reach, angle - half);
		const [x2, y2] = polar(reach, angle + half);

		return poly([[0, 0], [x1, y1], [x2, y2]]);
	});

	return [
		shape("Rays", wedges, {
			kind: "radial",
			from: [0, 0],
			to: [reach, 0],
			stops: [[0, tone(tint, .75)], [.35, tone(tint, .5)], [1, tone(tint, 0)]],
		}, 0),
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

type Ring = Readonly<{ width: number; height: number; tilt: number }>;

const ORBIT: Ring = { width: 780, height: 200, tilt: -.16 };
const DISK: Ring = { width: 860, height: 150, tilt: .1 };

/**
 * A particle travelling along half of `ring`, fading in and out at the ends.
 * Its group sits at the arc's start; the motion carries it to the other end.
 */
function arcTraveller(
	name: string,
	ring: Ring,
	half: "back" | "front",
	size: number,
	phase: number,
	tint: Color,
): Art {
	const [from, to] = half === "front" ? [Math.PI, 0] : [0, -Math.PI];
	const points = ellipsePoints(ring.width, ring.height, from, to, 8);
	const [startX, startY] = points[0] ?? [0, 0];
	const keys = (axis: 0 | 1): MotionKey[] => [
		...points.map((
			point,
			i,
		): MotionKey => [i / 10, point[axis] - (axis ? startY : startX)]),
		[1, 0],
	];
	const travel = motion(`${name}-${half}`, 4, {
		x: keys(0),
		y: keys(1),
		opacity: [[0, 0], [.1, 1], [.7, 1], [.8, 0], [1, 0]],
	}, true);

	return group("Particle", { x: startX, y: startY }, [
		shape("Particle", ellipse(0, 0, size, size), "FFFFFFFF", 2, tint),
	], { motion: use(travel, phase) });
}

function ringArt(ring: Ring, half: "back" | "front", disk: boolean): Art {
	const tint = disk ? SINGULARITY_TINT : ORBIT_TINT;

	const [from, to] = half === "back" ? [Math.PI, Math.PI * 2] : [0, Math.PI];
	const arc = poly(ellipsePoints(ring.width, ring.height, from, to), false, 20);
	const stroke = disk
		? [
			shape("Accretion glow", arc, undefined, 30, tone(tint, .35)),
			shape("Accretion disk", arc, undefined, 12, tone(tint, .95)),
			shape("Photon edge", arc, undefined, 3, "E6FFFFFF"),
		]
		: [
			shape("Orbit glow", arc, undefined, 10, tone(tint, .3)),
			shape("Orbit", arc, undefined, 3.5, tint),
		];
	const name = disk ? "disk" : "orbit";

	return group(`${disk ? "Disk" : "Orbit"} ${half}`, {
		x: CX,
		y: CY + 20,
		rotation: ring.tilt,
	}, [
		...stroke,
		...[0, .25, .5, .75].map((phase) =>
			arcTraveller(name, ring, half, half === "front" ? 12 : 8, phase, tint)
		),
	]);
}

const breathe = motion("corona-breathe", 4, {
	scaleX: [[0, 1], [.5, 1.03], [1, 1]],
	scaleY: [[0, 1], [.5, 1.03], [1, 1]],
});

function corona(tint: Color): Art {
	return group("Corona", { x: CX, y: CY }, [
		shape(
			"Corona glow",
			ellipse(0, 0, 700, 700),
			undefined,
			26,
			tone(tint, .3),
		),
		shape(
			"Corona ring",
			ellipse(0, 0, 700, 700),
			undefined,
			6,
			tone(tint, .85),
		),
		shape("Corona inner", ellipse(0, 0, 640, 640), undefined, 2, "80FFFFFF"),
	], { motion: use(breathe) });
}

/** Particles scattered with a fixed seed across the upper canvas. */
function scatter(label: string, count: number, area: Bounds): Point[] {
	const random = randomFrom(seedFrom(label));

	return Array.from({ length: count }, (): Point => [
		between(random, area.left, area.right),
		between(random, area.top, area.bottom),
	]);
}

function drifting(
	name: string,
	points: readonly Point[],
	motionValue: Motion,
	draw: (i: number) => Art[],
): Art[] {
	return points.map(([x, y], i) =>
		group(name, { x, y }, draw(i), {
			motion: use(motionValue, (i * 0.618) % 1),
		})
	);
}

// ---------------------------------------------------------------------------
// The effect layer.

export type EffectArt = Readonly<
	{ back: readonly Art[]; front: readonly Art[] }
>;

const NONE: EffectArt = { back: [], front: [] };

const moteDrift = motion("mote-drift", 4, {
	y: [[0, 0], [.5, -26], [1, 0]],
	x: [[0, 0], [.25, 8], [.75, -8], [1, 0]],
	opacity: [[0, .35], [.5, 1], [1, .35]],
});

function dustMotes(): EffectArt {
	return {
		back: [],
		front: drifting(
			"Mote",
			scatter("motes", 16, { left: 200, right: 824, top: 180, bottom: 820 }),
			moteDrift,
			(i) => [
				shape(
					"Mote",
					ellipse(0, 0, 7 + (i % 3) * 3, 7 + (i % 3) * 3),
					"F2FFF4DC",
					2,
					"CCB8AC8A",
				),
			],
		),
	};
}

function glints(seed: string): EffectArt {
	return {
		back: [],
		front: sparklePlacements(12, seed).map(({ x, y, size, rotation }, i) =>
			sparkleArt(x, y, size, rotation, (i * .37) % 1)
		),
	};
}

const flap = motion("wing-flap", .5, {
	scaleX: [[0, 1], [.5, .25], [1, 1]],
});

const flight = motion("butterfly-flight", 8, {
	x: [[0, 0], [.25, 60], [.5, 0], [.75, -60], [1, 0]],
	y: [
		[0, 0],
		[.125, -30],
		[.25, 0],
		[.375, 30],
		[.5, 0],
		[.625, -30],
		[.75, 0],
		[.875, 30],
		[1, 0],
	],
}, true);

function butterfly(color: string, spot: string): Art[] {
	const wing = (side: 1 | -1): Art =>
		group("Wing", {}, [
			shape(
				"Wing",
				poly(
					[[0, 0], [16 * side, -16], [26 * side, -8], [22 * side, 4], [
						10 * side,
						12,
					]],
					true,
					6,
				),
				color,
				2.5,
			),
			shape("Spot", ellipse(15 * side, -5, 7, 7), spot, 0),
		], { motion: use(flap) });

	return [
		wing(-1),
		wing(1),
		shape("Body", ellipse(0, 0, 6, 22), INK, 0),
		shape(
			"Antennae",
			[poly([[-1, -10], [-5, -18]], false), poly([[1, -10], [5, -18]], false)],
			undefined,
			1.5,
		),
	];
}

function butterflies(): EffectArt {
	const colors: readonly (readonly [string, string])[] = [
		["FF7FD8FF", "FF2F5D7C"],
		["FFFF9F43", "FF7A1F1A"],
		["FFFF8AD8", "FFFFF1A0"],
		["FFFFD35A", "FFEF7869"],
	];
	const spots: readonly Point[] = [[230, 300], [800, 260], [170, 620], [
		860,
		580,
	]];

	return {
		back: [],
		front: spots.map(([x, y], i) =>
			group("Butterfly", { x, y }, [
				group(
					"Tilt",
					{ rotation: i % 2 ? .3 : -.3 },
					butterfly(...(colors[i] ?? ["FFFFFFFF", INK])),
				),
			], { motion: use(flight, i / 4) })
		),
	};
}

const wander = motion("firefly-wander", 4, {
	x: [[0, 0], [.25, 14], [.5, 4], [.75, -12], [1, 0]],
	y: [[0, 0], [.25, -10], [.5, -18], [.75, -6], [1, 0]],
});
const glowPulse = motion("firefly-pulse", 2, {
	opacity: [[0, .2], [.4, 1], [.6, 1], [1, .2]],
});

function fireflies(): EffectArt {
	return {
		back: [],
		front: drifting(
			"Firefly",
			scatter("fireflies", 14, {
				left: 150,
				right: 874,
				top: 160,
				bottom: 800,
			}),
			wander,
			(i) => [
				group("Glow", {}, [
					shape("Halo", ellipse(0, 0, 26, 26), "66FFF1A0", 0),
					shape("Core", ellipse(0, 0, 8, 8), "FFFFF6C8", 1.5, "FFB8A040"),
				], { motion: use(glowPulse, (i * .29) % 1) }),
			],
		),
	};
}

const fall = motion("confetti-fall", 4, {
	y: [[0, -60], [.85, 260], [.86, -60], [1, -60]],
	rotation: [[0, 0], [.85, 5], [.86, 0], [1, 0]],
	opacity: [[0, 0], [.08, 1], [.75, 1], [.85, 0], [1, 0]],
}, true);

function confetti(): EffectArt {
	const colors = [
		"FFEF7869",
		"FFFFD35A",
		"FF39AB9F",
		"FFFF8AD8",
		"FF7FD8FF",
		"FFC39BFF",
	];

	return {
		back: [],
		front: drifting(
			"Confetti",
			scatter("confetti", 20, { left: 60, right: 964, top: 60, bottom: 560 }),
			fall,
			(i) => [
				shape(
					"Piece",
					rect(0, 0, i % 3 ? 10 : 14, i % 3 ? 18 : 8, 1.5),
					colors[i % colors.length] ?? "FFEF7869",
					1.5,
				),
			],
		),
	};
}

const rise = motion("bubble-rise", 4, {
	y: [[0, 60], [.85, -240], [.86, 60], [1, 60]],
	x: [[0, 0], [.25, 10], [.5, -8], [.75, 8], [.85, 0], [1, 0]],
	opacity: [[0, 0], [.1, 1], [.75, 1], [.85, 0], [1, 0]],
}, true);

function bubbles(): EffectArt {
	return {
		back: [],
		front: drifting(
			"Bubble",
			scatter("bubbles", 14, { left: 120, right: 904, top: 300, bottom: 820 }),
			rise,
			(i) => {
				const size = 14 + (i % 4) * 6;

				return [
					shape(
						"Bubble",
						ellipse(0, 0, size, size),
						"26BFF4FF",
						2.5,
						"CCFFFFFF",
					),
					shape(
						"Shine",
						ellipse(-size * .2, -size * .2, size * .25, size * .25),
						"E6FFFFFF",
						0,
					),
				];
			},
		),
	};
}

const snow = motion("snow-fall", 8, {
	y: [[0, -80], [.9, 420], [.91, -80], [1, -80]],
	x: [[0, 0], [.2, 16], [.45, -12], [.7, 14], [.9, 0], [1, 0]],
	opacity: [[0, 0], [.06, 1], [.8, 1], [.9, 0], [1, 0]],
}, true);

function snowfall(): EffectArt {
	return {
		back: [],
		front: drifting(
			"Flake",
			scatter("snow", 24, { left: 40, right: 984, top: 40, bottom: 460 }),
			snow,
			(i) => [
				i % 3
					? shape(
						"Flake",
						ellipse(0, 0, 8 + (i % 2) * 4, 8 + (i % 2) * 4),
						"F2FFFFFF",
						2,
						"B38FA6C4",
					)
					: shape(
						"Flake",
						star(0, 0, 18, 18, 6, .35),
						"F2FFFFFF",
						2,
						"B38FA6C4",
					),
			],
		),
	};
}

const RAY_COUNT = 20;

// The rays turn exactly one wedge per loop and snap back on the last frame,
// which is invisible because the fan is symmetric: it reads as endless spin.
const turn = motion("rays-turn", 8, {
	rotation: [[0, 0], [.999, Math.PI * 2 / RAY_COUNT], [1, 0]],
}, true);

function goldBurst(): EffectArt {
	return {
		back: [
			group("Gold glow", { opacity: .6 }, [haloArt(GOLD)]),
			group(
				"Gold burst",
				{ x: CX, y: CY, opacity: .9 },
				raysArt(RAY_COUNT, GOLD),
				{ motion: use(turn) },
			),
		],
		front: [],
	};
}

const sweep = motion("holo-sweep", 4, {
	x: [[0, -700], [.7, 700], [.71, -700], [1, -700]],
	opacity: [[0, 0], [.1, 1], [.6, 1], [.7, 0], [1, 0]],
}, true);

function holoShimmer(): EffectArt {
	return {
		back: [],
		front: [
			group("Holo band", { x: CX - 250, y: CY, rotation: .35 }, [
				shape("Band", rect(0, 0, 320, 1600), {
					kind: "linear",
					from: [-160, 0],
					to: [160, 0],
					stops: [
						[0, "00FF8AD8"],
						[.2, "99FF8AD8"],
						[.4, "99FFE27A"],
						[.6, "998AFFC1"],
						[.8, "997FD8FF"],
						[1, "00C39BFF"],
					],
				}, 0),
			], { motion: use(sweep) }),
		],
	};
}

const strike = motion("lightning-strike", 2, {
	opacity: [[0, .15], [.55, .15], [.58, 1], [.62, .3], [.66, 1], [.8, .15], [
		1,
		.15,
	]],
});

function bolt(x: number, y: number, scale: number, phase: number): Art {
	const points: readonly Point[] = [
		[0, 0],
		[-18, 60],
		[4, 60],
		[-14, 130],
		[26, 44],
		[4, 44],
		[20, 0],
	];

	return group("Bolt", { x, y, scaleX: scale, scaleY: scale }, [
		shape("Bolt glow", poly(points, true, 2), undefined, 18, "4DFFF6C8"),
		shape("Bolt", poly(points, true, 2), "FFFFF1A0", 3),
	], { motion: use(strike, phase) });
}

function lightning(): EffectArt {
	return {
		back: [
			bolt(170, 110, 1.3, 0),
			bolt(820, 150, 1, .5),
			bolt(900, 420, .8, .25),
		],
		front: [],
	};
}

function orbitRing(): EffectArt {
	return {
		back: [ringArt(ORBIT, "back", false)],
		front: [ringArt(ORBIT, "front", false)],
	};
}

function starBurst(distance: number): Motion {
	return motion(`star-burst-${distance}`, 4, {
		x: [[0, 0], [.8, distance], [1, 0]],
		opacity: [[0, 0], [.15, 1], [.6, 1], [.8, 0], [1, 0]],
		scaleX: [[0, .3], [.3, 1.2], [.8, .4], [1, .3]],
		scaleY: [[0, .3], [.3, 1.2], [.8, .4], [1, .3]],
	}, true);
}

function cosmicParticles(): EffectArt {
	// Each particle rides a spoke that is rotated into place, so one outward
	// motion along local x serves every direction.
	const spokes = Array.from({ length: 14 }, (_, i) => i / 14 * Math.PI * 2);

	return {
		back: [corona(COSMIC_TINT)],
		front: spokes.map((angle, i) =>
			group("Spoke", { x: CX, y: CY, rotation: angle }, [
				group("Star", { x: 150 }, [
					shape("Star", star(0, 0, 18, 18, 4, .35), "FFFFFFFF", 2, COSMIC_TINT),
				], { motion: use(starBurst(200 + (i % 3) * 60), (i * .37) % 1) }),
			])
		),
	};
}

function singularity(): EffectArt {
	return {
		back: [
			group("Singularity glow", { opacity: .7 }, [haloArt(SINGULARITY_TINT)]),
			corona(SINGULARITY_TINT),
			ringArt(DISK, "back", true),
		],
		front: [ringArt(DISK, "front", true)],
	};
}

const DRAWINGS: readonly ((seed: string) => EffectArt)[] = [
	() => NONE,
	dustMotes,
	glints,
	butterflies,
	fireflies,
	confetti,
	bubbles,
	snowfall,
	goldBurst,
	holoShimmer,
	lightning,
	orbitRing,
	cosmicParticles,
	singularity,
];

export const EFFECT_ART_COUNT = DRAWINGS.length;
export const GOLD_BURST_RAYS = RAY_COUNT;

/**
 * Effect `index`, split into what draws behind the chest and in front of it.
 * `seed` varies decorative scatter where an effect has any (glints).
 */
export function effectArt(index: number, seed = "effect"): EffectArt {
	const draw = DRAWINGS[index];

	if (!draw) {
		throw new RangeError(`No effect art at ${index}`);
	}

	return draw(seed);
}
