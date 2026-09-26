/**
 * Looping idle motion, shared by the animated SVG (CSS keyframes) and the
 * Rive reveal (keyframes in its ambient loop).
 *
 * A motion never moves a drawing's resting pose: renderers wrap the moving
 * group's children in an extra layer and animate only that layer, so the
 * static poster is exactly the motion's identity pose and reduced motion falls
 * back to it for free.
 */

/** Every loop fits a whole number of times into this many seconds. */
export const LOOP_SECONDS = 8;

export type MotionProperty =
	| "x"
	| "y"
	| "rotation"
	| "scaleX"
	| "scaleY"
	| "opacity";

/** A keyframe: `t` in 0–1 through the loop, and the value at that time. */
export type MotionKey = readonly [t: number, value: number];

export type Motion = Readonly<{
	/** Unique across the package; becomes the CSS keyframes name. */
	name: string;
	/** Seconds per cycle. Must divide `LOOP_SECONDS` evenly. */
	duration: number;
	/**
	 * Offsets are relative: `x`, `y` in local units and `rotation` in radians
	 * are added to the rest pose; `scaleX`, `scaleY`, `opacity` multiply it.
	 */
	tracks: Readonly<Partial<Record<MotionProperty, readonly MotionKey[]>>>;
	/** Constant speed between keys (spins, drifts); otherwise eased. */
	linear: boolean;
}>;

/** A motion attached to a group, started `phase` (0–1) of a cycle early. */
export type MotionUse = Readonly<{ motion: Motion; phase: number }>;

export const IDENTITY: Readonly<Record<MotionProperty, number>> = {
	x: 0,
	y: 0,
	rotation: 0,
	scaleX: 1,
	scaleY: 1,
	opacity: 1,
};

export const MOTION_PROPERTIES: readonly MotionProperty[] = [
	"x",
	"y",
	"rotation",
	"scaleX",
	"scaleY",
	"opacity",
];

/**
 * Build a motion, checking that it loops seamlessly and fits the shared loop.
 */
export function motion(
	name: string,
	duration: number,
	tracks: Motion["tracks"],
	linear = false,
): Motion {
	const cycles = LOOP_SECONDS / duration;

	if (!Number.isInteger(cycles)) {
		throw new RangeError(
			`${name}: ${duration}s does not divide ${LOOP_SECONDS}s`,
		);
	}

	for (const [property, keys] of Object.entries(tracks)) {
		const first = keys[0];
		const last = keys.at(-1);

		if (!first || !last || first[0] !== 0 || last[0] !== 1) {
			throw new RangeError(`${name}.${property} must span t = 0..1`);
		}

		if (first[1] !== last[1]) {
			throw new RangeError(`${name}.${property} must end where it starts`);
		}
	}

	return { name, duration, tracks, linear };
}

export function use(value: Motion, phase = 0): MotionUse {
	return { motion: value, phase: ((phase % 1) + 1) % 1 };
}

function smooth(t: number): number {
	return t * t * (3 - 2 * t);
}

/** The value of `keys` at time `t` (0–1), eased between keys. */
export function sample(
	keys: readonly MotionKey[],
	t: number,
	linear = false,
): number {
	const after = keys.findIndex(([time]) => time >= t);

	if (after <= 0) {
		return keys[0]?.[1] ?? 0;
	}

	const [t0, v0] = keys[after - 1] ?? [0, 0];
	const [t1, v1] = keys[after] ?? [1, v0];
	const span = t1 - t0;

	const progress = span <= 0 ? 1 : (t - t0) / span;

	return v0 + (v1 - v0) * (linear ? progress : smooth(progress));
}

/**
 * Keys for one cycle started `phase` early: the same curve, rotated so the
 * loop still begins at t = 0 and ends at t = 1.
 */
export function phasedKeys(
	keys: readonly MotionKey[],
	phase: number,
	linear = false,
): MotionKey[] {
	if (phase === 0) {
		return [...keys];
	}

	const times = new Set<number>([0, 1]);

	for (const [t] of keys) {
		times.add(Number((((t - phase) % 1 + 1) % 1).toFixed(4)));
	}

	return [...times].sort((a, b) => a - b).map((t): MotionKey => [
		t,
		sample(keys, (t + phase) % 1, linear),
	]);
}
