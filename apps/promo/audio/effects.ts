/**
 * Buffer-level effects: Freeverb-style stereo reverb, tempo-synced ping-pong
 * delay, tanh saturation, kick-keyed sidechain ducking and tape wow/flutter.
 * Reverb and delay return wet-only buffers; the mixer decides return levels.
 */

import { createStereo, SAMPLE_RATE, type Stereo, toSamples } from "./buffer.ts";
import { Biquad, TAU } from "./dsp.ts";

// ---------------------------------------------------------------------------
// Reverb (Jezar's Freeverb topology, tunings rescaled from 44.1 to 48 kHz)
// ---------------------------------------------------------------------------

const COMB_TUNINGS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNINGS = [556, 441, 341, 225];
const STEREO_SPREAD = 23;
const TUNING_SCALE = SAMPLE_RATE / 44_100;

class Comb {
	readonly #buffer: Float32Array;
	#index = 0;
	#store = 0;
	readonly #feedback: number;
	readonly #damping: number;

	constructor(length: number, feedback: number, damping: number) {
		this.#buffer = new Float32Array(length);
		this.#feedback = feedback;
		this.#damping = damping;
	}

	process(input: number): number {
		const output = this.#buffer[this.#index];
		this.#store = output * (1 - this.#damping) + this.#store * this.#damping;
		this.#buffer[this.#index] = input + this.#store * this.#feedback;
		this.#index = (this.#index + 1) % this.#buffer.length;
		return output;
	}
}

class Allpass {
	readonly #buffer: Float32Array;
	#index = 0;

	constructor(length: number) {
		this.#buffer = new Float32Array(length);
	}

	process(input: number): number {
		const delayed = this.#buffer[this.#index];
		this.#buffer[this.#index] = input + delayed * 0.5;
		this.#index = (this.#index + 1) % this.#buffer.length;
		return delayed - input;
	}
}

export interface ReverbSettings {
	/** 0..1, maps to comb feedback 0.7..0.98. */
	readonly roomSize: number;
	/** 0..1, high-frequency absorption inside the tank. */
	readonly damping: number;
	/** 0..1 stereo width of the wet signal. */
	readonly width: number;
	readonly preDelayMs: number;
	/** Input filtering keeps the tail from muddying bass or hissing. */
	readonly lowCutHz: number;
	readonly highCutHz: number;
}

export function reverb(input: Stereo, settings: ReverbSettings): Stereo {
	const length = input.left.length;
	const feedback = 0.7 + settings.roomSize * 0.28;
	const damping = settings.damping * 0.4;
	const channelTank = (
		spread: number,
	): { combs: Comb[]; allpasses: Allpass[] } => ({
		combs: COMB_TUNINGS.map((tuning) =>
			new Comb(Math.round((tuning + spread) * TUNING_SCALE), feedback, damping)
		),
		allpasses: ALLPASS_TUNINGS.map((tuning) =>
			new Allpass(Math.round((tuning + spread) * TUNING_SCALE))
		),
	});
	const tanks = [channelTank(0), channelTank(STEREO_SPREAD)];
	const lowCut = new Biquad({ kind: "highpass", frequency: settings.lowCutHz });
	const highCut = new Biquad({
		kind: "lowpass",
		frequency: settings.highCutHz,
	});
	const preDelay = Math.max(1, toSamples(settings.preDelayMs / 1000));
	const delayLine = new Float32Array(preDelay);
	const wet1 = settings.width / 2 + 0.5;
	const wet2 = (1 - settings.width) / 2;
	const out = createStereo(length);

	for (let index = 0; index < length; index += 1) {
		const slot = index % preDelay;
		const delayed = delayLine[slot];
		delayLine[slot] = highCut.process(
			lowCut.process((input.left[index] + input.right[index]) * 0.5),
		);
		const excitation = delayed * 0.03;
		const channelOut = [0, 0];
		for (let channel = 0; channel < 2; channel += 1) {
			const tank = tanks[channel];
			let sum = 0;
			for (const comb of tank.combs) {
				sum += comb.process(excitation);
			}
			for (const allpass of tank.allpasses) {
				sum = allpass.process(sum);
			}
			channelOut[channel] = sum;
		}
		out.left[index] = channelOut[0] * wet1 + channelOut[1] * wet2;
		out.right[index] = channelOut[1] * wet1 + channelOut[0] * wet2;
	}
	return out;
}

// ---------------------------------------------------------------------------
// Tempo-synced delay
// ---------------------------------------------------------------------------

export interface DelaySettings {
	readonly bpm: number;
	readonly leftBeats: number;
	readonly rightBeats: number;
	readonly feedback: number;
	readonly lowCutHz: number;
	readonly highCutHz: number;
}

/** Cross-fed stereo delay: each repeat bounces to the other side, darker each time. */
export function tempoDelay(input: Stereo, settings: DelaySettings): Stereo {
	const beat = (60 / settings.bpm) * SAMPLE_RATE;
	const leftLength = Math.round(beat * settings.leftBeats);
	const rightLength = Math.round(beat * settings.rightBeats);
	const leftLine = new Float32Array(leftLength);
	const rightLine = new Float32Array(rightLength);
	const tone = [0, 1].map(() => ({
		low: new Biquad({ kind: "highpass", frequency: settings.lowCutHz }),
		high: new Biquad({ kind: "lowpass", frequency: settings.highCutHz }),
	}));
	const out = createStereo(input.left.length);
	for (let index = 0; index < input.left.length; index += 1) {
		const leftSlot = index % leftLength;
		const rightSlot = index % rightLength;
		const leftOut = leftLine[leftSlot];
		const rightOut = rightLine[rightSlot];
		const mono = (input.left[index] + input.right[index]) * 0.5;
		leftLine[leftSlot] = tone[0].high.process(
			tone[0].low.process(mono + rightOut * settings.feedback),
		);
		rightLine[rightSlot] = tone[1].high.process(
			tone[1].low.process(leftOut * settings.feedback),
		);
		out.left[index] = leftOut;
		out.right[index] = rightOut;
	}
	return out;
}

// ---------------------------------------------------------------------------
// Saturation, sidechain, wow
// ---------------------------------------------------------------------------

/** tanh soft clipping with unity small-signal gain, so it only rounds peaks. */
export function saturate(buffer: Float32Array, drive: number): Float32Array {
	for (let index = 0; index < buffer.length; index += 1) {
		buffer[index] = Math.tanh(buffer[index] * drive) / drive;
	}
	return buffer;
}

/**
 * Peak envelope follower normalised to [0, 1], used as a sidechain key.
 * Attack is fast but not instant so ducked sustains never click.
 */
export function sidechainKey(
	source: Stereo,
	attackMs: number,
	releaseMs: number,
): Float32Array {
	const attack = Math.exp(-1 / (SAMPLE_RATE * attackMs * 0.001));
	const release = Math.exp(-1 / (SAMPLE_RATE * releaseMs * 0.001));
	const key = new Float32Array(source.left.length);
	let level = 0;
	let peak = 0;
	for (let index = 0; index < key.length; index += 1) {
		const rectified = Math.max(
			Math.abs(source.left[index]),
			Math.abs(source.right[index]),
		);
		const coefficient = rectified > level ? attack : release;
		level = rectified + (level - rectified) * coefficient;
		key[index] = level;
		peak = Math.max(peak, level);
	}
	if (peak > 0) {
		for (let index = 0; index < key.length; index += 1) {
			key[index] = Math.min(1, key[index] / (peak * 0.6));
		}
	}
	return key;
}

/** Applies `1 - depth * key` gain: the classic kick-driven "pump". */
export function duck(buffer: Stereo, key: Float32Array, depth: number): void {
	for (let index = 0; index < buffer.left.length; index += 1) {
		const gain = 1 - depth * key[index];
		buffer.left[index] *= gain;
		buffer.right[index] *= gain;
	}
}

export interface WowSettings {
	/** Slow wow cycle (Hz) and depth (ms of delay modulation). */
	readonly wowHz: number;
	readonly wowMs: number;
	readonly flutterHz: number;
	readonly flutterMs: number;
}

/** Cubic (Catmull–Rom) read from a buffer at a fractional position. */
function readFractional(buffer: Float32Array, position: number): number {
	const base = Math.floor(position);
	const fraction = position - base;
	const at = (offset: number): number =>
		buffer[Math.min(buffer.length - 1, Math.max(0, base + offset))];
	const p0 = at(-1);
	const p1 = at(0);
	const p2 = at(1);
	const p3 = at(2);
	return p1 +
		0.5 * fraction *
			(p2 - p0 +
				fraction *
					(2 * p0 - 5 * p1 + 4 * p2 - p3 +
						fraction * (3 * (p1 - p2) + p3 - p0)));
}

/**
 * Tape wow and flutter as a modulated read position. Rendering is offline, so
 * the modulation swings around zero delay and the bus stays on the grid.
 * Rates are passed in so songs can lock them to the bar, which keeps a looped
 * section seamless.
 */
export function tapeWow(buffer: Stereo, settings: WowSettings): Stereo {
	const out = createStereo(buffer.left.length);
	const msToSamples = 0.001 * SAMPLE_RATE;
	for (let index = 0; index < buffer.left.length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const wow = settings.wowMs * Math.sin(TAU * settings.wowHz * seconds);
		const flutter = settings.flutterMs *
			Math.sin(TAU * settings.flutterHz * seconds + 1.3);
		const skew = settings.flutterMs *
			Math.sin(TAU * settings.flutterHz * seconds + 2.9);
		out.left[index] = readFractional(
			buffer.left,
			index + (wow + flutter) * msToSamples,
		);
		out.right[index] = readFractional(
			buffer.right,
			index + (wow + skew) * msToSamples,
		);
	}
	return out;
}
