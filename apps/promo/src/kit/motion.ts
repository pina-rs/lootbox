/**
 * Timing and motion shared by every video: frame maths, the springs that
 * give lootbox its bounce, and helpers that turn a frame into a value.
 * Everything is a pure function of the frame, so any frame renders alone.
 */
import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;

export const seconds = (value: number) => Math.round(value * FPS);

/** Frames per beat and bar for a tempo, as read from the music cue sheets. */
export function beat(bpm: number, beats = 1): number {
	return (60 / bpm) * FPS * beats;
}

/** A lively pop with a small overshoot: cards, chips, buttons. */
export const POP = { damping: 11, mass: 0.7, stiffness: 170 } as const;
/** A heavier landing with a visible bounce: the chest, big type. */
export const BOUNCE = { damping: 8, mass: 0.9, stiffness: 140 } as const;
/** Quick and settled: cursors, UI state changes. */
export const SNAP = { damping: 20, mass: 0.6, stiffness: 220 } as const;

type SpringConfig = Readonly<
	{ damping: number; mass: number; stiffness: number }
>;

/** 0 → 1 (with overshoot) starting at `start`. */
export function enter(
	frame: number,
	start: number,
	config: SpringConfig = POP,
): number {
	return spring({ frame: frame - start, fps: FPS, config });
}

/** A clamped linear 0 → 1 over `[start, start + length]`, eased. */
export function progress(
	frame: number,
	start: number,
	length: number,
	easing: (t: number) => number = Easing.inOut(Easing.cubic),
): number {
	return interpolate(frame, [start, start + length], [0, 1], {
		easing,
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
}

/** Map `t` in [0, 1] onto [from, to]. */
export const mix = (from: number, to: number, t: number) =>
	from + (to - from) * t;

/**
 * A squash-and-stretch pulse for an impact at `at`: wide and short on
 * contact, springing back through tall and thin.
 */
export function squash(frame: number, at: number, strength = 0.22): {
	x: number;
	y: number;
} {
	if (frame < at) return { x: 1, y: 1 };

	const t = frame - at;
	const wobble = Math.exp(-t / 5) * Math.cos(t / 2.2);

	return { x: 1 + strength * wobble, y: 1 - strength * wobble };
}

/** A one-frame blink that lasts `length` frames starting at `at`. */
export function blinkAt(frame: number, at: number, length = 5): number {
	const t = frame - at;

	if (t < 0 || t > length) return 0;

	return Math.sin((t / length) * Math.PI);
}

/** Several blinks. */
export function blinks(frame: number, times: readonly number[]): number {
	return Math.max(0, ...times.map((at) => blinkAt(frame, at)));
}

/** A slow sine float for idle life, in pixels. */
export function float(frame: number, amplitude = 6, period = 90): number {
	return Math.sin((frame / period) * Math.PI * 2) * amplitude;
}
