/**
 * Synthesised percussion and transitions: kick, snare, clap, hats, shaker,
 * tambourine, rim, toms, crash, reverse cymbal, riser, impact and vinyl
 * crackle. Everything is built from oscillators and seeded noise.
 */

import {
	fadeEdges,
	fadeStereoEdges,
	reverseStereo,
	SAMPLE_RATE,
	sliceStereo,
	type Stereo,
	toSamples,
} from "./buffer.ts";
import {
	advance,
	Biquad,
	filterInPlace,
	percussive,
	pulseWave,
	sawWave,
	Svf,
	TAU,
	whiteNoise,
} from "./dsp.ts";
import type { Random } from "./random.ts";

/** Six detuned square oscillators, the classic analogue cymbal "metal". */
const METAL_HZ = [205.3, 304.4, 369.6, 522.7, 540, 800];

function metal(length: number, tune: number, random: Random): Float32Array {
	const out = new Float32Array(length);
	const voices = METAL_HZ.map((hz) => ({
		dt: (hz * tune * (1 + random.bipolar() * 0.004)) / SAMPLE_RATE,
		phase: random.next(),
	}));
	for (let index = 0; index < length; index += 1) {
		let sum = 0;
		for (const voice of voices) {
			sum += pulseWave(voice.phase, voice.dt, 0.5);
			voice.phase = advance(voice.phase, voice.dt);
		}
		out[index] = sum / voices.length;
	}
	return out;
}

/** Scales a hit so its peak equals `velocity`: voices arrive level-matched and buses do the balancing. */
function atPeak(buffer: Float32Array, velocity: number): Float32Array {
	let peak = 0;
	for (const sample of buffer) {
		peak = Math.max(peak, Math.abs(sample));
	}
	if (peak > 0) {
		for (let index = 0; index < buffer.length; index += 1) {
			buffer[index] *= velocity / peak;
		}
	}
	return buffer;
}

function stereoAtPeak(buffer: Stereo, velocity: number): Stereo {
	let peak = 0;
	for (let index = 0; index < buffer.left.length; index += 1) {
		peak = Math.max(
			peak,
			Math.abs(buffer.left[index]),
			Math.abs(buffer.right[index]),
		);
	}
	const gain = peak > 0 ? velocity / peak : 0;
	for (let index = 0; index < buffer.left.length; index += 1) {
		buffer.left[index] *= gain;
		buffer.right[index] *= gain;
	}
	return buffer;
}

export interface KickOptions {
	readonly startHz?: number;
	readonly endHz?: number;
	/** Amplitude decay time constant after the hold, seconds. */
	readonly decay?: number;
	readonly click?: number;
	readonly drive?: number;
}

/** Sine kick with pitch and amplitude envelopes, a noise click and tanh weight. */
export function kick(
	random: Random,
	velocity: number,
	options: KickOptions = {},
): Float32Array {
	const startHz = options.startHz ?? 165;
	const endHz = options.endHz ?? 50;
	const decay = options.decay ?? 0.28;
	const click = options.click ?? 0.3;
	const drive = options.drive ?? 1.7;
	const length = toSamples(0.04 + decay * 4);
	const out = new Float32Array(length);
	const clickFilter = new Svf("highpass");
	let phase = 0;
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const hz = endHz + (startHz - endHz) * Math.exp(-seconds / 0.03);
		const amplitude = Math.min(1, seconds / 0.0008) *
			(seconds < 0.03 ? 1 : Math.exp(-(seconds - 0.03) / decay));
		const body = Math.sin(TAU * phase) * amplitude;
		phase = advance(phase, hz / SAMPLE_RATE);
		const transient = clickFilter.process(random.bipolar(), 1800, 0.7) *
			Math.exp(-seconds / 0.0025) * click;
		out[index] = (Math.tanh((body + transient) * drive) / Math.tanh(drive)) *
			velocity;
	}
	return fadeEdges(out, 0, 0.02);
}

export interface SnareOptions {
	readonly tuneHz?: number;
	readonly decay?: number;
	readonly snappy?: number;
}

/** Tuned two-mode drum body plus bright filtered noise for the wires. */
export function snare(
	random: Random,
	velocity: number,
	options: SnareOptions = {},
): Float32Array {
	const tune = options.tuneHz ?? 190;
	const decay = options.decay ?? 0.14;
	const snappy = options.snappy ?? 0.8;
	const length = toSamples(0.05 + decay * 4);
	const out = new Float32Array(length);
	const noise = filterInPlace(whiteNoise(random, length), {
		kind: "highpass",
		frequency: 1200,
	}, { kind: "peaking", frequency: 5200, q: 0.9, gainDb: 4 });
	let phaseA = 0;
	let phaseB = 0;
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const drop = 1 + 0.3 * Math.exp(-seconds / 0.012);
		const body =
			(Math.sin(TAU * phaseA) * 0.7 + Math.sin(TAU * phaseB) * 0.35) *
			percussive(0.0008, 0.055, seconds);
		phaseA = advance(phaseA, (tune * drop) / SAMPLE_RATE);
		phaseB = advance(phaseB, (tune * 1.72 * drop) / SAMPLE_RATE);
		const wires = noise[index] * percussive(0.001, decay, seconds) * snappy *
			0.75;
		out[index] = body * 0.65 + wires;
	}
	return atPeak(fadeEdges(out, 0, 0.02), velocity);
}

/** Four staggered noise bursts and a short room tail: a hand clap. */
export function clap(random: Random, velocity: number): Float32Array {
	const length = toSamples(0.45);
	const noise = filterInPlace(whiteNoise(random, length), {
		kind: "bandpass",
		frequency: 1150,
		q: 1.1,
	}, { kind: "highpass", frequency: 500 });
	const bursts = [0, 0.0095, 0.019, 0.0305];
	const out = new Float32Array(length);
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		let envelope = 0;
		for (const start of bursts) {
			if (seconds >= start) {
				envelope += Math.exp(-(seconds - start) / 0.0032);
			}
		}
		if (seconds >= 0.03) {
			envelope += 0.55 * Math.exp(-(seconds - 0.03) / 0.12);
		}
		out[index] = noise[index] * envelope;
	}
	return atPeak(fadeEdges(out, 0.0003, 0.02), velocity);
}

/** Closed (short) or open (ringing) hi-hat from metal plus noise. */
export function hat(
	random: Random,
	velocity: number,
	open: boolean,
): Float32Array {
	const length = toSamples(open ? 0.9 : 0.12);
	const tau = open ? 0.26 : 0.022;
	const tone = metal(length, 1, random);
	const noise = whiteNoise(random, length);
	const out = new Float32Array(length);
	for (let index = 0; index < length; index += 1) {
		out[index] = (tone[index] * 0.6 + noise[index] * 0.5) *
			percussive(0.0008, tau, index / SAMPLE_RATE);
	}
	filterInPlace(out, { kind: "bandpass", frequency: 9500, q: 0.8 }, {
		kind: "highpass",
		frequency: 6800,
	});
	return atPeak(fadeEdges(out, 0.0003, open ? 0.05 : 0.01), velocity);
}

/** Soft-attack band-passed noise grain. */
export function shaker(random: Random, velocity: number): Float32Array {
	const length = toSamples(0.13);
	const out = filterInPlace(whiteNoise(random, length), {
		kind: "bandpass",
		frequency: 6500,
		q: 1.2,
	}, { kind: "highpass", frequency: 3500 });
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const envelope = seconds < 0.012
			? (seconds / 0.012) ** 2
			: Math.exp(-(seconds - 0.012) / 0.035);
		out[index] *= envelope;
	}
	return atPeak(fadeEdges(out, 0, 0.01), velocity);
}

/** Jingles: bright partials and noise, re-struck a few times like shaken zils. */
export function tambourine(random: Random, velocity: number): Float32Array {
	const length = toSamples(0.32);
	const partials = [5200, 6900, 8300, 10_100, 12_400].map((hz) => ({
		hz: hz * (1 + random.bipolar() * 0.02),
		tau: random.range(0.05, 0.11),
	}));
	const noise = filterInPlace(whiteNoise(random, length), {
		kind: "highpass",
		frequency: 7000,
	});
	const out = new Float32Array(length);
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		let rattle = 0;
		for (let strike = 0; strike < 4; strike += 1) {
			const start = strike * 0.0065;
			if (seconds >= start) {
				rattle += Math.exp(-(seconds - start) / 0.012) * 0.7 ** strike;
			}
		}
		let ring = 0;
		for (const partial of partials) {
			ring += Math.sin(TAU * partial.hz * seconds) *
				Math.exp(-seconds / partial.tau);
		}
		out[index] = ring * 0.12 * (0.4 + rattle) + noise[index] * 0.5 * rattle;
	}
	return atPeak(fadeEdges(out, 0.0003, 0.02), velocity);
}

/** Short woody cross-stick for the lo-fi groove. */
export function rim(random: Random, velocity: number): Float32Array {
	const length = toSamples(0.08);
	const out = new Float32Array(length);
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const tone = Math.sin(TAU * 1650 * seconds) * 0.5 +
			Math.sin(TAU * 480 * seconds) * 0.6;
		out[index] = tone * Math.exp(-seconds / 0.011) +
			random.bipolar() * Math.exp(-seconds / 0.0015) * 0.4;
	}
	return atPeak(fadeEdges(out, 0.0002, 0.01), velocity);
}

/** Pitch-dropping sine tom with a little stick noise. */
export function tom(
	random: Random,
	hz: number,
	velocity: number,
): Float32Array {
	const length = toSamples(0.7);
	const stick = filterInPlace(whiteNoise(random, length), {
		kind: "lowpass",
		frequency: 1600,
	});
	const out = new Float32Array(length);
	let phase = 0;
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const body = Math.sin(TAU * phase) * percussive(0.001, 0.19, seconds);
		phase = advance(
			phase,
			(hz * (1 + 0.55 * Math.exp(-seconds / 0.03))) / SAMPLE_RATE,
		);
		out[index] = Math.tanh(
			(body + stick[index] * 0.25 * Math.exp(-seconds / 0.02)) * 1.3,
		) / 1.3;
	}
	return atPeak(fadeEdges(out, 0.0003, 0.03), velocity);
}

/** Wide crash: independent metal and noise per channel, long bright decay. */
export function crash(random: Random, velocity: number, seconds = 3.2): Stereo {
	const length = toSamples(seconds);
	const channel = (label: string): Float32Array => {
		const source = random.fork(label);
		const tone = metal(length, 1.7, source);
		const noise = whiteNoise(source, length);
		const out = new Float32Array(length);
		for (let index = 0; index < length; index += 1) {
			const time = index / SAMPLE_RATE;
			const envelope = percussive(0.001, 1.1, time) +
				0.5 * Math.exp(-time / 0.08);
			out[index] = (tone[index] * 0.45 + noise[index] * 0.6) * envelope;
		}
		filterInPlace(out, { kind: "highpass", frequency: 3400 }, {
			kind: "lowpass",
			frequency: 14_000,
		});
		return fadeEdges(out, 0.0003, 0.4);
	};
	return stereoAtPeak({
		left: channel("crash-left"),
		right: channel("crash-right"),
	}, velocity);
}

/** A crash played backwards: swells for `seconds` and stops dead on the downbeat. */
export function reverseCymbal(
	random: Random,
	velocity: number,
	seconds: number,
): Stereo {
	const reversed = reverseStereo(
		crash(random, velocity, Math.max(seconds, 1.5) + 0.2),
	);
	const start = reversed.left.length - toSamples(seconds);
	return fadeStereoEdges(
		sliceStereo(reversed, start, reversed.left.length),
		0.05,
		0.004,
	);
}

/** Noise riser: band-pass sweeping up, rising level, and a faint pitched climb. */
export function riser(
	random: Random,
	velocity: number,
	seconds: number,
): Stereo {
	const length = toSamples(seconds);
	const channel = (label: string, offset: number): Float32Array => {
		const source = random.fork(label);
		const filter = new Svf("bandpass");
		const out = new Float32Array(length);
		let phase = offset;
		for (let index = 0; index < length; index += 1) {
			const progress = index / length;
			const centre = 250 * (9000 / 250) ** progress ** 1.4;
			const dt = (110 * 2 ** (3 * progress)) / SAMPLE_RATE;
			const tone = sawWave(phase, dt) * 0.05;
			phase = advance(phase, dt);
			out[index] = (filter.process(source.bipolar(), centre, 1.6) * 1.6 +
				tone * progress) * progress ** 2;
		}
		return fadeEdges(out, 0.02, 0.006);
	};
	return stereoAtPeak({
		left: channel("riser-left", 0),
		right: channel("riser-right", 0.5),
	}, velocity);
}

/** Downbeat impact: sub boom, noise thump and a crash layer. */
export function impact(random: Random, velocity: number): Stereo {
	const length = toSamples(3.2);
	const boom = new Float32Array(length);
	let phase = 0;
	for (let index = 0; index < length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		boom[index] = (Math.tanh(
			Math.sin(TAU * phase) * percussive(0.001, 0.8, seconds) * 1.8,
		) / 1.8) * 0.9;
		phase = advance(phase, (32 + 70 * Math.exp(-seconds / 0.11)) / SAMPLE_RATE);
	}
	const cymbal = crash(random, 0.7, 3.2);
	const thump = (label: string): Float32Array => {
		const noise = filterInPlace(whiteNoise(random.fork(label), length), {
			kind: "lowpass",
			frequency: 1800,
		});
		for (let index = 0; index < length; index += 1) {
			noise[index] *= Math.exp(-index / SAMPLE_RATE / 0.09) * 0.5;
		}
		return noise;
	};
	const left = thump("impact-left");
	const right = thump("impact-right");
	for (let index = 0; index < length; index += 1) {
		left[index] += boom[index] + cymbal.left[index];
		right[index] += boom[index] + cymbal.right[index];
	}
	return stereoAtPeak(fadeStereoEdges({ left, right }, 0.0003, 0.3), velocity);
}

/**
 * Vinyl surface: sparse seeded pops and a whisper of hiss, high-passed at
 * 3.5 kHz so it stays out of the core speech band.
 */
export function vinylCrackle(
	random: Random,
	seconds: number,
	popsPerSecond: number,
): Stereo {
	const length = toSamples(seconds);
	const left = new Float32Array(length);
	const right = new Float32Array(length);
	let time = 0;
	while (true) {
		time += -Math.log(Math.max(random.next(), 1e-9)) / popsPerSecond;
		const start = toSamples(time);
		if (start >= length) {
			break;
		}
		const size = random.integer(8, 60);
		const amplitude = 0.12 * Math.exp(-random.next() * 3);
		const pan = random.next();
		for (
			let offset = 0;
			offset < size && start + offset < length;
			offset += 1
		) {
			const value = random.bipolar() * amplitude *
				Math.exp(-offset / (size / 3));
			left[start + offset] += value * (1 - pan);
			right[start + offset] += value * pan;
		}
	}
	for (const channel of [left, right]) {
		for (let index = 0; index < length; index += 1) {
			channel[index] += random.bipolar() * 0.004;
		}
		new Biquad({ kind: "highpass", frequency: 3500, q: 0.7 }).processInPlace(
			channel,
		);
		new Biquad({ kind: "lowpass", frequency: 11_000 }).processInPlace(channel);
	}
	return { left, right };
}
