/**
 * Sample buffers and the handful of operations every other module needs:
 * allocation, placing a rendered voice onto a bus with constant-power panning,
 * click-free edge fades, and level conversions.
 */
export const SAMPLE_RATE = 48_000;

export interface Stereo {
	readonly left: Float32Array;
	readonly right: Float32Array;
}

/** A rendered voice is either mono (panned when placed) or already stereo. */
export type Voice = Float32Array | Stereo;

export function isStereo(voice: Voice): voice is Stereo {
	return !(voice instanceof Float32Array);
}

export function createStereo(length: number): Stereo {
	return { left: new Float32Array(length), right: new Float32Array(length) };
}

export function toSamples(seconds: number): number {
	return Math.round(seconds * SAMPLE_RATE);
}

export function dbToGain(db: number): number {
	return 10 ** (db / 20);
}

export function gainToDb(gain: number): number {
	return 20 * Math.log10(Math.max(gain, 1e-12));
}

/** Constant-power pan law; `pan` runs from -1 (left) to 1 (right). */
export function panGains(pan: number): readonly [number, number] {
	const angle = ((Math.min(1, Math.max(-1, pan)) + 1) * Math.PI) / 4;

	return [Math.cos(angle) * Math.SQRT2, Math.sin(angle) * Math.SQRT2];
}

/**
 * Adds `voice` into `target` starting at `offset` samples. Anything that would
 * land outside the target is dropped, so callers size the target with a tail.
 */
export function addVoice(
	target: Stereo,
	voice: Voice,
	offset: number,
	gain: number,
	pan: number,
): void {
	const start = Math.max(0, offset);

	if (isStereo(voice)) {
		const [panLeft, panRight] = pan === 0 ? [1, 1] : panGains(pan);
		const end = Math.min(target.left.length, offset + voice.left.length);

		for (let index = start; index < end; index += 1) {
			const source = index - offset;
			target.left[index] += voice.left[source] * gain * panLeft;
			target.right[index] += voice.right[source] * gain * panRight;
		}

		return;
	}

	const [panLeft, panRight] = panGains(pan);
	const end = Math.min(target.left.length, offset + voice.length);

	for (let index = start; index < end; index += 1) {
		const sample = voice[index - offset] * gain;

		target.left[index] += sample * panLeft;
		target.right[index] += sample * panRight;
	}
}

/** Adds `source` into `target` sample-for-sample, scaled by `gain`. */
export function mixInto(target: Stereo, source: Stereo, gain: number): void {
	const length = Math.min(target.left.length, source.left.length);

	for (let index = 0; index < length; index += 1) {
		target.left[index] += source.left[index] * gain;
		target.right[index] += source.right[index] * gain;
	}
}

/**
 * Raised-cosine fades on both ends of a mono buffer. Every voice passes
 * through this, which is what keeps note boundaries click-free.
 */
export function fadeEdges(
	buffer: Float32Array,
	fadeInSeconds: number,
	fadeOutSeconds: number,
): Float32Array {
	const fadeIn = Math.min(buffer.length, toSamples(fadeInSeconds));
	const fadeOut = Math.min(buffer.length, toSamples(fadeOutSeconds));

	for (let index = 0; index < fadeIn; index += 1) {
		buffer[index] *= 0.5 - 0.5 * Math.cos((Math.PI * index) / fadeIn);
	}

	for (let index = 0; index < fadeOut; index += 1) {
		buffer[buffer.length - 1 - index] *= 0.5 -
			0.5 * Math.cos((Math.PI * index) / fadeOut);
	}

	return buffer;
}

export function fadeStereoEdges(
	buffer: Stereo,
	fadeInSeconds: number,
	fadeOutSeconds: number,
): Stereo {
	fadeEdges(buffer.left, fadeInSeconds, fadeOutSeconds);
	fadeEdges(buffer.right, fadeInSeconds, fadeOutSeconds);

	return buffer;
}

export function sliceStereo(
	buffer: Stereo,
	start: number,
	end: number,
): Stereo {
	return {
		left: buffer.left.slice(start, end),
		right: buffer.right.slice(start, end),
	};
}

export function reverseStereo(buffer: Stereo): Stereo {
	return {
		left: buffer.left.slice().reverse(),
		right: buffer.right.slice().reverse(),
	};
}
