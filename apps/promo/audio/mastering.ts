/**
 * The JS master bus: DC removal, gain to a loudness target and a look-ahead
 * true-peak limiter with smooth attack and exponential release. It gets each
 * mix within a few hundredths of a LU of the target so ffmpeg's loudnorm can
 * finish in linear mode (pure gain, no dynamic processing).
 */
import {
	createStereo,
	dbToGain,
	gainToDb,
	SAMPLE_RATE,
	type Stereo,
} from "./buffer.ts";
import { Biquad } from "./dsp.ts";
import { integratedLoudness, truePeak, truePeakEnvelope } from "./loudness.ts";

export interface MasterSettings {
	readonly targetLufs: number;
	readonly ceilingDbtp: number;
	readonly lookaheadMs: number;
	readonly releaseMs: number;
}

export interface MasterResult {
	readonly buffer: Stereo;
	readonly gainDb: number;
	readonly loudnessLufs: number;
	readonly truePeakDbtp: number;
	/** Deepest gain reduction the limiter applied. */
	readonly maxReductionDb: number;
	/** Share of the file where the limiter reduced gain by more than 1 dB. */
	readonly limitedShare: number;
}

export const MUSIC_MASTER: MasterSettings = {
	targetLufs: -14,
	ceilingDbtp: -2,
	lookaheadMs: 5,
	releaseMs: 120,
};

function removeDc(buffer: Stereo): Stereo {
	const out = createStereo(buffer.left.length);
	out.left.set(buffer.left);
	out.right.set(buffer.right);
	new Biquad({ kind: "highpass", frequency: 18, q: 0.6 }).processInPlace(
		out.left,
	);
	new Biquad({ kind: "highpass", frequency: 18, q: 0.6 }).processInPlace(
		out.right,
	);

	return out;
}

/** Sliding minimum over the next `window` samples (monotonic deque). */
function forwardMinimum(values: Float32Array, window: number): Float32Array {
	const out = new Float32Array(values.length);
	const deque = new Int32Array(values.length);
	let head = 0;
	let tail = 0;

	for (let index = values.length - 1; index >= 0; index -= 1) {
		while (tail > head && values[deque[tail - 1]] >= values[index]) {
			tail -= 1;
		}

		deque[tail] = index;

		tail += 1;

		while (deque[head] >= index + window) {
			head += 1;
		}

		out[index] = values[deque[head]];
	}

	return out;
}

/**
 * Gain curve that keeps `peaks * gain` under the ceiling. Averaging the
 * forward minimum over the look-ahead window turns every reduction into a
 * smooth ramp that is guaranteed to be complete by the time the peak arrives.
 */
function limiterGain(
	peaks: Float32Array,
	inputGain: number,
	ceiling: number,
	settings: MasterSettings,
): Float32Array {
	const window = Math.max(
		1,
		Math.round((settings.lookaheadMs / 1000) * SAMPLE_RATE),
	);
	const required = new Float32Array(peaks.length);

	for (let index = 0; index < peaks.length; index += 1) {
		const level = peaks[index] * inputGain;
		required[index] = level > ceiling ? ceiling / level : 1;
	}

	const minimum = forwardMinimum(required, window);
	const release = Math.exp(-1 / ((settings.releaseMs / 1000) * SAMPLE_RATE));
	const gain = new Float32Array(peaks.length);
	let running = 0;
	let current = 1;

	for (let index = 0; index < peaks.length; index += 1) {
		running += minimum[index] - (index >= window ? minimum[index - window] : 1);
		const smoothed = (running + window) / window;
		current = smoothed < current
			? smoothed
			: smoothed + (current - smoothed) * release;
		gain[index] = current;
	}

	return gain;
}

function applyGain(
	buffer: Stereo,
	inputGain: number,
	curve: Float32Array,
): Stereo {
	const out = createStereo(buffer.left.length);

	for (let index = 0; index < curve.length; index += 1) {
		const gain = inputGain * curve[index];
		out.left[index] = buffer.left[index] * gain;
		out.right[index] = buffer.right[index] * gain;
	}

	return out;
}

export function master(mix: Stereo, settings: MasterSettings): MasterResult {
	const clean = removeDc(mix);
	const peaks = truePeakEnvelope(clean);
	const ceiling = dbToGain(settings.ceilingDbtp) * 0.995;
	let inputGain = dbToGain(settings.targetLufs - integratedLoudness(clean));
	let curve = limiterGain(peaks, inputGain, ceiling, settings);
	let buffer = applyGain(clean, inputGain, curve);
	let loudness = integratedLoudness(buffer);
	for (
		let iteration = 0;
		iteration < 8 && Math.abs(loudness - settings.targetLufs) > 0.02;
		iteration += 1
	) {
		inputGain *= dbToGain(settings.targetLufs - loudness);

		curve = limiterGain(peaks, inputGain, ceiling, settings);
		buffer = applyGain(clean, inputGain, curve);
		loudness = integratedLoudness(buffer);
	}
	let deepest = 1;
	let limited = 0;

	for (const value of curve) {
		deepest = Math.min(deepest, value);
		limited += value < dbToGain(-1) ? 1 : 0;
	}

	return {
		buffer,
		gainDb: gainToDb(inputGain),
		loudnessLufs: loudness,
		truePeakDbtp: gainToDb(truePeak(buffer)),
		maxReductionDb: -gainToDb(deepest),
		limitedShare: limited / curve.length,
	};
}

/** SFX are mastered to a peak rather than a loudness: true peak lands on `ceilingDbtp`. */
export function normalizeTruePeak(buffer: Stereo, ceilingDbtp: number): Stereo {
	const clean = removeDc(buffer);
	const gain = dbToGain(ceilingDbtp) / Math.max(truePeak(clean), 1e-9);

	return applyGain(clean, gain, new Float32Array(clean.left.length).fill(1));
}
