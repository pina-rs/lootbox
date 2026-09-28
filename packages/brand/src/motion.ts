/**
 * How the chest moves, as pure functions of time in seconds. The site plays
 * them with requestAnimationFrame and the promo videos with Remotion frames,
 * so both show the same performance.
 *
 * Each function returns a `ChestFrame`: the mark's own pose (`open`, `look`,
 * `blink`, `sparkles`) plus the body's squash, tilt, and hop, which
 * `ChestFigure` applies about the feet.
 */
import type { Gaze } from "./ChestMark.tsx";
import { clamp } from "./geometry.ts";

export type ChestFrame = Readonly<{
	/** Lid opening, as `ChestMark`'s `open`: 0 shut, 1 the peek, up to 2. */
	open: number;
	look: Gaze;
	/** 0 is wide open, 1 is shut. */
	blink: number;
	/** Horizontal and vertical scale about the feet. */
	squash: Readonly<{ x: number; y: number }>;
	/** Tilt about the feet, in degrees. */
	rotate: number;
	/** Feet above the floor, in chest heights. */
	lift: number;
	/** Sideways nudge, in chest widths. */
	shift: number;
	sparkles: boolean;
}>;

/** How the chest takes the prize it was dealt. */
export type ChestReaction = "big-prize" | "small-prize" | "disappointed";

type Ease = (t: number) => number;

const linear: Ease = (t) => t;
const easeIn: Ease = (t) => t * t * t;
const easeOut: Ease = (t) => 1 - (1 - t) ** 3;
const easeInOut: Ease = (t) =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
/** Overshoots a little before settling: lids that pop. */
const easeBack: Ease = (t) =>
	1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

/** A keyframe: at `time`, reach `value`, arriving along `ease`. */
type Key = readonly [time: number, value: number, ease?: Ease];

function track(keys: readonly Key[], t: number): number {
	const first = keys[0];

	if (!first) return 0;
	if (t <= first[0]) return first[1];

	for (let index = 1; index < keys.length; index++) {
		const from = keys[index - 1];
		const to = keys[index];

		if (!from || !to) break;
		if (t <= to[0]) {
			const span = to[0] - from[0];
			const progress = span <= 0 ? 1 : (t - from[0]) / span;

			return from[1] + (to[1] - from[1]) * (to[2] ?? easeInOut)(progress);
		}
	}

	return keys[keys.length - 1]?.[1] ?? first[1];
}

/** Quick, symmetric blinks centred on each of `times`. */
function blinks(t: number, times: readonly number[], length = 0.16): number {
	let shut = 0;

	for (const at of times) {
		const distance = Math.abs(t - at) / (length / 2);

		if (distance < 1) shut = Math.max(shut, 1 - distance);
	}

	return shut;
}

/** Squash keeps the volume: a chest squashed down bulges sideways. */
const squashed = (y: number) => ({ x: 1 + (1 - y) * 0.7, y });

const wave = (t: number, seconds: number, phase = 0) =>
	Math.sin((t / seconds) * Math.PI * 2 + phase);

/** The logo pose, looking at you. */
export const REST_FRAME: ChestFrame = {
	open: 1,
	look: { x: 0, y: 0.05 },
	blink: 0,
	squash: { x: 1, y: 1 },
	rotate: 0,
	lift: 0,
	shift: 0,
	sparkles: false,
};

const IDLE_PERIOD = 6.4;

/**
 * Waiting to be picked up: it breathes, the lid bobs, it blinks, glances
 * left and right, and now and then does a little hop. Loops every 6.4 s.
 */
export function idleFrame(seconds: number): ChestFrame {
	const t = ((seconds % IDLE_PERIOD) + IDLE_PERIOD) % IDLE_PERIOD;
	const breath = wave(seconds, 2.4);
	const hopSquash = track([
		[0, 1],
		[5.7, 1],
		[5.85, 0.93, easeOut],
		[5.97, 1.05, easeOut],
		[6.12, 1, easeInOut],
		[6.2, 0.95, easeOut],
		[6.4, 1, easeOut],
	], t);

	return {
		...REST_FRAME,
		open: 1 + 0.06 * wave(seconds, 2.4, -0.8),
		look: {
			x: track([
				[0, 0],
				[2.6, 0],
				[2.85, -0.85, easeOut],
				[3.6, -0.85],
				[3.85, 0.85, easeOut],
				[4.6, 0.85],
				[4.9, 0, easeOut],
				[6.4, 0],
			], t),
			y: track([[0, 0.05], [2.6, 0.05], [2.85, -0.1], [4.6, -0.1], [
				4.9,
				0.05,
			]], t),
		},
		blink: blinks(t, [1.2, 5.25, 5.5]),
		squash: squashed(hopSquash * (1 + 0.014 * breath)),
		lift: track(
			[[0, 0], [5.9, 0], [6.02, 0.07, easeOut], [6.18, 0, easeIn]],
			t,
		),
	};
}

/**
 * Held down: the lid is pressed shut and rattles, the body squashes like a
 * spring, and it squints with the effort. `level` runs from 0 to 1.
 */
export function chargeFrame(level: number, seconds: number): ChestFrame {
	const charge = clamp(level, 0, 1);
	const strain = charge * charge;
	const idle = idleFrame(seconds);
	const strained: ChestFrame = {
		...REST_FRAME,
		open: Math.max(0.15, 1 - 0.85 * charge) +
			0.12 * charge * Math.abs(wave(seconds, 0.12)),
		look: { x: 0, y: -0.25 },
		blink: 0.6 * charge,
		squash: squashed(1 - 0.12 * charge),
		rotate: wave(seconds, 0.09) * 3 * strain,
		shift: wave(seconds, 0.067) * 0.012 * strain,
	};

	return mixFrames(idle, strained, easeOut(Math.min(1, charge * 4)));
}

/**
 * Waiting on the chain: the chest rumbles, the lid chatters, and the eyes
 * dart about while the randomness is drawn.
 */
export function waitFrame(seconds: number): ChestFrame {
	const beat = wave(seconds, 0.45);

	return {
		...REST_FRAME,
		open: 0.75 + 0.3 * Math.abs(wave(seconds, 0.6)),
		look: { x: clamp(wave(seconds, 1.4) * 3, -1, 1) * 0.9, y: -0.15 },
		blink: blinks(seconds % 3, [2.2]),
		squash: squashed(1 - 0.03 * Math.abs(beat)),
		rotate: beat * 3.5,
		shift: beat * 0.01,
		lift: Math.max(0, wave(seconds, 0.225)) * 0.015,
	};
}

/** A "not yet" head shake, for a hold that cannot open anything. */
export function nopeFrame(base: ChestFrame, seconds: number): ChestFrame {
	if (seconds < 0 || seconds > NOPE_SECONDS) return base;

	return {
		...base,
		look: {
			x: track([[0, base.look.x], [0.1, -0.8], [0.25, 0.8], [
				0.45,
				base.look.x,
			]], seconds),
			y: base.look.y,
		},
		rotate: base.rotate +
			track(
				[[0, 0], [0.08, -6], [0.18, 6], [0.28, -4], [0.38, 2], [0.45, 0]],
				seconds,
			),
	};
}

export const NOPE_SECONDS = 0.45;

type Reveal = Readonly<{
	seconds: number;
	/** Where the reveal lands, and the pose the chest keeps afterwards. */
	rest: ChestFrame;
	frame(t: number): ChestFrame;
}>;

const BIG_REST: ChestFrame = {
	...REST_FRAME,
	open: 1.75,
	sparkles: true,
};

const SMALL_REST: ChestFrame = {
	...REST_FRAME,
	open: 1.45,
	look: { x: 0.15, y: 0 },
	sparkles: true,
};

const SAD_REST: ChestFrame = {
	...REST_FRAME,
	open: 0.55,
	look: { x: -0.3, y: 0.85 },
	blink: 0.35,
	squash: squashed(0.95),
	rotate: -3,
};

const REVEALS: Record<ChestReaction, Reveal> = {
	// Crouch, launch with the lid flung open, hang in the air looking up at
	// the prize, land, and bounce twice for joy.
	"big-prize": {
		seconds: 2.8,
		rest: BIG_REST,
		frame: (t) => ({
			open: track([
				[0, 1],
				[0.3, 0.25, easeOut],
				[0.42, 0.25],
				// The pop overshoots by a tenth, peaking at the lid's limit of 2.
				[0.62, 1.83, easeBack],
				[1.6, 1.9],
				[2.2, BIG_REST.open],
			], t),
			look: {
				x: track([[0, 0], [1.6, 0], [1.75, -0.5], [1.95, 0.5], [2.15, 0]], t),
				y: track([
					[0, 0.05],
					[0.3, 0.05],
					[0.55, -1, easeOut],
					[1.25, -1],
					[1.5, BIG_REST.look.y],
				], t),
			},
			blink: Math.max(
				track([[0, 0], [0.3, 0.9, easeOut], [0.45, 0, easeOut]], t),
				blinks(t, [2.45]),
			),
			squash: squashed(track([
				[0, 1],
				[0.42, 0.8, easeOut],
				[0.52, 1.18, easeOut],
				[0.8, 1],
				[1.16, 1.08],
				[1.24, 0.8, easeOut],
				[1.4, 1.04, easeOut],
				[1.52, 1],
				[1.6, 0.92, easeOut],
				[1.68, 1.05, easeOut],
				[1.8, 0.94, easeOut],
				[1.95, 1.02, easeOut],
				[2.1, 1],
			], t)),
			rotate: track([
				[0, 0],
				[0.62, 0],
				[0.75, -6, easeOut],
				[0.9, 6],
				[1.05, -3],
				[1.2, 0],
			], t),
			lift: track([
				[0, 0],
				[0.42, 0],
				[0.72, 0.34, easeOut],
				[0.92, 0.36, linear],
				[1.2, 0, easeIn],
				[1.6, 0],
				[1.7, 0.1, easeOut],
				[1.8, 0, easeIn],
				[1.9, 0],
				[1.98, 0.04, easeOut],
				[2.06, 0, easeIn],
			], t),
			shift: 0,
			sparkles: t >= 0.62,
		}),
	},
	// A quick crouch, a hop that pops the lid, a happy wiggle, then a smile
	// back at you.
	"small-prize": {
		seconds: 2.2,
		rest: SMALL_REST,
		frame: (t) => ({
			open: track([
				[0, 1],
				[0.22, 0.45, easeOut],
				[0.3, 0.45],
				[0.5, 1.55, easeBack],
				[1.4, SMALL_REST.open],
			], t),
			look: {
				x: track([[0, 0], [1.2, 0], [1.5, SMALL_REST.look.x]], t),
				y: track([
					[0, 0.05],
					[0.4, -0.9, easeOut],
					[1, -0.9],
					[1.5, SMALL_REST.look.y],
				], t),
			},
			blink: Math.max(
				track([[0, 0], [0.25, 0.5, easeOut], [0.4, 0, easeOut]], t),
				blinks(t, [1.85]),
			),
			squash: squashed(track([
				[0, 1],
				[0.3, 0.88, easeOut],
				[0.4, 1.08, easeOut],
				[0.62, 1],
				[0.74, 0.9, easeOut],
				[0.9, 1.03, easeOut],
				[1, 1],
			], t)),
			rotate: track([
				[0, 0],
				[1, 0],
				[1.15, 5, easeOut],
				[1.35, -5],
				[1.55, 3],
				[1.7, 0],
			], t),
			lift: track(
				[[0, 0], [0.3, 0], [0.52, 0.18, easeOut], [0.72, 0, easeIn]],
				t,
			),
			shift: 0,
			sparkles: t >= 0.5,
		}),
	},
	// Hopeful: the lid lifts and the eyes look up. Then a peek inside, a
	// sigh, and the lid sinks back down.
	disappointed: {
		seconds: 2.6,
		rest: SAD_REST,
		frame: (t) => ({
			open: track([
				[0, 1],
				[0.25, 0.5, easeOut],
				[0.4, 0.5],
				[0.9, 1.15],
				[1.3, 1.15],
				[1.7, SAD_REST.open],
			], t),
			look: {
				x: track([[0, 0], [1.6, 0], [2, SAD_REST.look.x]], t),
				y: track([
					[0, 0.05],
					[0.5, -0.9, easeOut],
					[1, -0.9],
					[1.25, 0.9],
					[2.6, SAD_REST.look.y],
				], t),
			},
			blink: Math.max(
				track([[0, 0], [1.4, 0], [1.9, SAD_REST.blink]], t),
				blinks(t, [2.3], 0.24),
			),
			squash: squashed(track([
				[0, 1],
				[0.3, 0.94, easeOut],
				[0.45, 1.03, easeOut],
				[0.62, 0.97],
				[0.75, 1],
				[1.35, 1],
				[1.8, SAD_REST.squash.y],
			], t)),
			rotate: track([[0, 0], [1.4, 0], [1.9, SAD_REST.rotate]], t),
			lift: track(
				[[0, 0], [0.3, 0], [0.45, 0.06, easeOut], [0.6, 0, easeIn]],
				t,
			),
			shift: 0,
			sparkles: false,
		}),
	},
};

/** How long each reveal plays, in seconds. */
export function revealSeconds(reaction: ChestReaction): number {
	return REVEALS[reaction].seconds;
}

/** The reveal at `seconds` in; it holds its last pose once it has played. */
export function revealFrame(
	reaction: ChestReaction,
	seconds: number,
): ChestFrame {
	const reveal = REVEALS[reaction];

	return reveal.frame(clamp(seconds, 0, reveal.seconds));
}

/**
 * After the reveal: the reaction's pose, still breathing and blinking. At
 * `seconds = 0` it matches the reveal's last frame.
 */
export function restFrame(
	reaction: ChestReaction,
	seconds: number,
): ChestFrame {
	const rest = REVEALS[reaction].rest;
	const sad = reaction === "disappointed";
	const breath = wave(seconds, sad ? 3.6 : 2.4);
	const t = seconds % 5;

	return {
		...rest,
		open: rest.open + (sad ? 0.03 : 0.05) * wave(seconds, 2.4, Math.PI) *
				Math.min(1, seconds),
		blink: Math.max(rest.blink, blinks(t, [3.4])),
		squash: squashed(rest.squash.y * (1 + 0.012 * breath)),
	};
}

/** Blend two frames; `amount` 0 is `from`, 1 is `to`. */
export function mixFrames(
	from: ChestFrame,
	to: ChestFrame,
	amount: number,
): ChestFrame {
	const k = clamp(amount, 0, 1);
	const mix = (a: number, b: number) => a + (b - a) * k;

	return {
		open: mix(from.open, to.open),
		look: { x: mix(from.look.x, to.look.x), y: mix(from.look.y, to.look.y) },
		blink: mix(from.blink, to.blink),
		squash: {
			x: mix(from.squash.x, to.squash.x),
			y: mix(from.squash.y, to.squash.y),
		},
		rotate: mix(from.rotate, to.rotate),
		lift: mix(from.lift, to.lift),
		shift: mix(from.shift, to.shift),
		sparkles: k < 0.5 ? from.sparkles : to.sparkles,
	};
}
