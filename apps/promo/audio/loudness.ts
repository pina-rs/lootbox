/**
 * ITU-R BS.1770-4 metering: gated integrated loudness and a 4x-oversampled
 * true-peak envelope. The JS master bus uses these to land close to the
 * target before ffmpeg's two-pass loudnorm does the final, linear trim.
 */
import { SAMPLE_RATE, type Stereo } from "./buffer.ts";

/** K-weighting coefficients published in BS.1770 for 48 kHz. */
const PRE_FILTER = {
	b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
	a: [-1.69065929318241, 0.73248077421585],
};
const RLB_FILTER = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] };

function kWeightedSquares(channel: Float32Array): Float64Array {
	const out = new Float64Array(channel.length);
	let x1 = 0;
	let x2 = 0;
	let y1 = 0;
	let y2 = 0;
	let u1 = 0;
	let u2 = 0;
	let z1 = 0;

	let z2 = 0;

	for (let index = 0; index < channel.length; index += 1) {
		const x = channel[index];
		const y = PRE_FILTER.b[0] * x + PRE_FILTER.b[1] * x1 +
			PRE_FILTER.b[2] * x2 - PRE_FILTER.a[0] * y1 - PRE_FILTER.a[1] * y2;
		x2 = x1;
		x1 = x;
		y2 = y1;
		y1 = y;
		const z = RLB_FILTER.b[0] * y + RLB_FILTER.b[1] * u1 +
			RLB_FILTER.b[2] * u2 - RLB_FILTER.a[0] * z1 - RLB_FILTER.a[1] * z2;
		u2 = u1;
		u1 = y;
		z2 = z1;
		z1 = z;
		out[index] = z * z;
	}

	return out;
}

/** Gated integrated loudness in LUFS; -70 for signals too short or quiet to gate. */
export function integratedLoudness(buffer: Stereo): number {
	const hop = SAMPLE_RATE / 10;
	const left = kWeightedSquares(buffer.left);
	const right = kWeightedSquares(buffer.right);
	const hops = Math.floor(left.length / hop);
	const hopEnergy = new Float64Array(hops);

	for (let block = 0; block < hops; block += 1) {
		let sum = 0;

		for (let index = block * hop; index < (block + 1) * hop; index += 1) {
			sum += left[index] + right[index];
		}

		hopEnergy[block] = sum;
	}

	const blocks: number[] = [];

	for (let start = 0; start + 4 <= hops; start += 1) {
		blocks.push(
			(hopEnergy[start] + hopEnergy[start + 1] + hopEnergy[start + 2] +
				hopEnergy[start + 3]) / (4 * hop),
		);
	}

	const toLufs = (meanSquare: number): number =>
		-0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-20));
	const absolute = blocks.filter((energy) => toLufs(energy) > -70);

	if (absolute.length === 0) {
		return -70;
	}

	const relativeGate = toLufs(
		absolute.reduce((sum, energy) => sum + energy, 0) / absolute.length,
	) - 10;
	const gated = absolute.filter((energy) => toLufs(energy) > relativeGate);

	return toLufs(gated.reduce((sum, energy) => sum + energy, 0) / gated.length);
}

const OVERSAMPLE_PHASES = [0.25, 0.5, 0.75];
const INTERPOLATION_TAPS = 16;

/** Blackman-windowed sinc weights for reading between samples. */
const INTERPOLATION_WEIGHTS = OVERSAMPLE_PHASES.map((fraction) => {
	const weights: number[] = [];
	for (let tap = 0; tap < INTERPOLATION_TAPS; tap += 1) {
		const offset = tap - INTERPOLATION_TAPS / 2 + 1;
		const distance = fraction - offset;
		const sinc = Math.sin(Math.PI * distance) / (Math.PI * distance);
		const position = (distance + INTERPOLATION_TAPS / 2) / INTERPOLATION_TAPS;
		const window = 0.42 - 0.5 * Math.cos(2 * Math.PI * position) +
			0.08 * Math.cos(4 * Math.PI * position);
		weights.push(sinc * window);
	}

	const total = weights.reduce((sum, weight) => sum + weight, 0);
	return weights.map((weight) => weight / total);
});

/**
 * Per-sample true-peak estimate: the largest absolute value over both
 * channels at the sample itself and three interpolated points after it.
 */
export function truePeakEnvelope(buffer: Stereo): Float32Array {
	const length = buffer.left.length;
	const envelope = new Float32Array(length);
	const firstOffset = -INTERPOLATION_TAPS / 2 + 1;

	for (const channel of [buffer.left, buffer.right]) {
		for (let index = 0; index < length; index += 1) {
			let peak = Math.abs(channel[index]);

			for (const weights of INTERPOLATION_WEIGHTS) {
				let value = 0;

				for (let tap = 0; tap < INTERPOLATION_TAPS; tap += 1) {
					const source = index + firstOffset + tap;

					if (source >= 0 && source < length) {
						value += channel[source] * weights[tap];
					}
				}

				peak = Math.max(peak, Math.abs(value));
			}

			envelope[index] = Math.max(envelope[index], peak);
		}
	}

	return envelope;
}

export function truePeak(buffer: Stereo): number {
	return truePeakEnvelope(buffer).reduce(
		(peak, value) => Math.max(peak, value),
		0,
	);
}
