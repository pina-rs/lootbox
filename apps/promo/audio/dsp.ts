/**
 * Signal-generation primitives: band-limited oscillators, a two-operator FM
 * voice, exponential envelopes, and filters (RBJ biquads for static EQ, a
 * topology-preserving state-variable filter for anything that sweeps).
 */
import { SAMPLE_RATE } from "./buffer.ts";
import type { Random } from "./random.ts";

export const TAU = Math.PI * 2;
const NYQUIST = SAMPLE_RATE / 2;

export function midiToHz(midi: number): number {
	return 440 * 2 ** ((midi - 69) / 12);
}

export function centsToRatio(cents: number): number {
	return 2 ** (cents / 1200);
}

// ---------------------------------------------------------------------------
// Oscillators. Each takes a phase in [0, 1) and the per-sample phase increment
// `dt` (frequency / sample rate) so callers can modulate pitch freely.
// ---------------------------------------------------------------------------
/** Polynomial band-limited step residual (Välimäki & Huovilainen). */
export function polyBlep(phase: number, dt: number): number {
	if (phase < dt) {
		const t = phase / dt;

		return t + t - t * t - 1;
	}

	if (phase > 1 - dt) {
		const t = (phase - 1) / dt;

		return t * t + t + t + 1;
	}

	return 0;
}

export function sawWave(phase: number, dt: number): number {
	return 2 * phase - 1 - polyBlep(phase, dt);
}

/** Band-limited pulse with DC removed, so narrow widths stay centred. */
export function pulseWave(phase: number, dt: number, width: number): number {
	let value = phase < width ? 1 : -1;
	value += polyBlep(phase, dt);
	value -= polyBlep((phase - width + 1) % 1, dt);

	return value - (2 * width - 1);
}

/**
 * Triangle. Its harmonics fall at 12 dB/octave, so the naive form's aliasing
 * sits below -55 dBFS for every pitch this project plays; no correction needed.
 */
export function triangleWave(phase: number): number {
	return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
}

/** Advances a phase accumulator, wrapping into [0, 1). */
export function advance(phase: number, dt: number): number {
	const next = phase + dt;

	return next >= 1 ? next - Math.floor(next) : next;
}

/**
 * Highest FM index that keeps the strongest sidebands below Nyquist:
 * carrier + (index + 1) * modulator <= ~20 kHz (Carson's rule, conservative).
 */
export function bandLimitedIndex(
	index: number,
	carrierHz: number,
	modulatorHz: number,
): number {
	const ceiling = (NYQUIST - 4000 - carrierHz) / modulatorHz - 1;

	return Math.max(0, Math.min(index, ceiling));
}

export interface FmOperatorPair {
	readonly carrierHz: number;
	/** Modulator frequency as a multiple of the carrier. */
	readonly ratio: number;
	/** Modulation index over time (seconds -> radians of phase deviation). */
	readonly index: (seconds: number) => number;
	/** Amplitude over time. */
	readonly amplitude: (seconds: number) => number;
	/** Optional pitch multiplier over time (vibrato, pitch drops). */
	readonly pitch?: (seconds: number) => number;
	readonly startPhase?: number;
}

/** Two-operator phase-modulation voice (the DX-style "FM" sound). */
export function renderFm(
	pair: FmOperatorPair,
	length: number,
	out: Float32Array,
	gain: number,
): void {
	let carrierPhase = pair.startPhase ?? 0;
	let modulatorPhase = 0;
	const modulatorHz = pair.carrierHz * pair.ratio;

	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const pitch = pair.pitch === undefined ? 1 : pair.pitch(seconds);
		const modIndex = bandLimitedIndex(
			pair.index(seconds),
			pair.carrierHz * pitch,
			modulatorHz * pitch,
		);
		const modulation = modIndex * Math.sin(TAU * modulatorPhase);
		out[index] += gain * pair.amplitude(seconds) *
			Math.sin(TAU * carrierPhase + modulation);
		carrierPhase = advance(
			carrierPhase,
			(pair.carrierHz * pitch) / SAMPLE_RATE,
		);
		modulatorPhase = advance(
			modulatorPhase,
			(modulatorHz * pitch) / SAMPLE_RATE,
		);
	}
}

export function whiteNoise(random: Random, length: number): Float32Array {
	const out = new Float32Array(length);

	for (let index = 0; index < length; index += 1) {
		out[index] = random.bipolar();
	}

	return out;
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------
export interface Adsr {
	/** Seconds. */
	readonly attack: number;
	readonly decay: number;
	/** Level in [0, 1]. */
	readonly sustain: number;
	readonly release: number;
}

/** Normalised exponential segment: 1 at x = 0, exactly 0 at x = 1. */
function expFall(x: number, curve: number): number {
	return (Math.exp(-curve * x) - Math.exp(-curve)) / (1 - Math.exp(-curve));
}

/**
 * ADSR with analogue-style exponential segments. The returned envelope lasts
 * `gate + release`; if the gate closes early the release starts from wherever
 * the attack or decay had reached, so short notes never jump.
 */
export function adsr(shape: Adsr, gateSeconds: number): Float32Array {
	const gate = Math.max(1, Math.round(gateSeconds * SAMPLE_RATE));
	const attack = Math.max(1, Math.round(shape.attack * SAMPLE_RATE));
	const decay = Math.max(1, Math.round(shape.decay * SAMPLE_RATE));
	const release = Math.max(1, Math.round(shape.release * SAMPLE_RATE));
	const out = new Float32Array(gate + release);
	let level = 0;

	for (let index = 0; index < gate; index += 1) {
		if (index < attack) {
			level = 1 - expFall(index / attack, 2.5);
		} else if (index < attack + decay) {
			level = shape.sustain +
				(1 - shape.sustain) * expFall((index - attack) / decay, 4.5);
		} else {
			level = shape.sustain;
		}

		out[index] = level;
	}

	for (let index = 0; index < release; index += 1) {
		out[gate + index] = level * expFall(index / release, 5);
	}

	return out;
}

/** Exponential decay with a short linear attack; handy for percussion. */
export function percussive(
	attackSeconds: number,
	tauSeconds: number,
	seconds: number,
): number {
	if (seconds < attackSeconds) {
		return seconds / attackSeconds;
	}

	return Math.exp(-(seconds - attackSeconds) / tauSeconds);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
export type BiquadKind =
	| "lowpass"
	| "highpass"
	| "bandpass"
	| "peaking"
	| "lowshelf"
	| "highshelf";

export interface BiquadSpec {
	readonly kind: BiquadKind;
	readonly frequency: number;
	readonly q?: number;
	readonly gainDb?: number;
}

/** RBJ-cookbook biquad in transposed direct form II. */
export class Biquad {
	#b0 = 1;
	#b1 = 0;
	#b2 = 0;
	#a1 = 0;
	#a2 = 0;
	#z1 = 0;
	#z2 = 0;

	constructor(spec: BiquadSpec) {
		const frequency = Math.min(spec.frequency, NYQUIST * 0.98);
		const q = spec.q ?? Math.SQRT1_2;
		const omega = (TAU * frequency) / SAMPLE_RATE;
		const cos = Math.cos(omega);
		const alpha = Math.sin(omega) / (2 * q);
		const amplitude = 10 ** ((spec.gainDb ?? 0) / 40);
		let b0: number;
		let b1: number;

		let b2: number;
		let a0: number;
		let a1: number;
		let a2: number;
		switch (spec.kind) {
			case "lowpass":
				[b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
				[a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
				break;
			case "highpass":
				[b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
				[a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
				break;
			case "bandpass":
				[b0, b1, b2] = [alpha, 0, -alpha];
				[a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
				break;
			case "peaking":
				[b0, b1, b2] = [1 + alpha * amplitude, -2 * cos, 1 - alpha * amplitude];
				[a0, a1, a2] = [1 + alpha / amplitude, -2 * cos, 1 - alpha / amplitude];
				break;
			case "lowshelf": {
				const shelf = 2 * Math.sqrt(amplitude) * alpha;
				b0 = amplitude * (amplitude + 1 - (amplitude - 1) * cos + shelf);
				b1 = 2 * amplitude * (amplitude - 1 - (amplitude + 1) * cos);
				b2 = amplitude * (amplitude + 1 - (amplitude - 1) * cos - shelf);
				a0 = amplitude + 1 + (amplitude - 1) * cos + shelf;
				a1 = -2 * (amplitude - 1 + (amplitude + 1) * cos);
				a2 = amplitude + 1 + (amplitude - 1) * cos - shelf;
				break;
			}
			case "highshelf": {
				const shelf = 2 * Math.sqrt(amplitude) * alpha;
				b0 = amplitude * (amplitude + 1 + (amplitude - 1) * cos + shelf);
				b1 = -2 * amplitude * (amplitude - 1 + (amplitude + 1) * cos);
				b2 = amplitude * (amplitude + 1 + (amplitude - 1) * cos - shelf);
				a0 = amplitude + 1 - (amplitude - 1) * cos + shelf;
				a1 = 2 * (amplitude - 1 - (amplitude + 1) * cos);
				a2 = amplitude + 1 - (amplitude - 1) * cos - shelf;
				break;
			}
		}
		this.#b0 = b0 / a0;
		this.#b1 = b1 / a0;
		this.#b2 = b2 / a0;
		this.#a1 = a1 / a0;
		this.#a2 = a2 / a0;
	}

	process(input: number): number {
		const output = this.#b0 * input + this.#z1;
		this.#z1 = this.#b1 * input - this.#a1 * output + this.#z2;
		this.#z2 = this.#b2 * input - this.#a2 * output;

		return output;
	}

	processInPlace(buffer: Float32Array): Float32Array {
		for (let index = 0; index < buffer.length; index += 1) {
			buffer[index] = this.process(buffer[index]);
		}

		return buffer;
	}
}

export function filterInPlace(
	buffer: Float32Array,
	...specs: readonly BiquadSpec[]
): Float32Array {
	for (const spec of specs) {
		new Biquad(spec).processInPlace(buffer);
	}

	return buffer;
}

export type SvfMode = "lowpass" | "bandpass" | "highpass";

/**
 * Zero-delay-feedback state-variable filter (Simper/Cytomic). Unlike a biquad
 * it stays stable and zipper-free when the cutoff moves every sample, which is
 * what synth filter envelopes and sweeps need.
 */
export class Svf {
	#ic1 = 0;
	#ic2 = 0;
	readonly #mode: SvfMode;

	constructor(mode: SvfMode) {
		this.#mode = mode;
	}

	process(input: number, cutoffHz: number, q: number): number {
		const g = Math.tan(
			(Math.PI * Math.min(Math.max(cutoffHz, 10), NYQUIST * 0.95)) /
				SAMPLE_RATE,
		);
		const k = 1 / q;
		const a1 = 1 / (1 + g * (g + k));
		const a2 = g * a1;
		const a3 = g * a2;
		const v3 = input - this.#ic2;
		const v1 = a1 * this.#ic1 + a2 * v3;
		const v2 = this.#ic2 + a2 * this.#ic1 + a3 * v3;
		this.#ic1 = 2 * v1 - this.#ic1;
		this.#ic2 = 2 * v2 - this.#ic2;
		switch (this.#mode) {
			case "lowpass":
				return v2;
			case "bandpass":
				return v1;
			case "highpass":
				return input - k * v1 - v2;
		}
	}
}

/** Runs an SVF over a buffer with a time-varying cutoff (seconds -> Hz). */
export function sweepInPlace(
	buffer: Float32Array,
	mode: SvfMode,
	cutoff: (seconds: number) => number,
	q: number,
): Float32Array {
	const filter = new Svf(mode);

	for (let index = 0; index < buffer.length; index += 1) {
		buffer[index] = filter.process(
			buffer[index],
			cutoff(index / SAMPLE_RATE),
			q,
		);
	}

	return buffer;
}
