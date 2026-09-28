/**
 * Pitched instruments. Each takes a `Note` and returns a freshly rendered,
 * edge-faded voice for the mixer to place. Timbres are shared across songs so
 * the brand has one recognisable palette: FM marimba, FM keys, FM bells,
 * a soft square lead, triangle/sub basses, supersaw chords and synth brass.
 */

import { fadeEdges, SAMPLE_RATE, type Stereo, toSamples } from "./buffer.ts";
import {
	type Adsr,
	adsr,
	advance,
	bandLimitedIndex,
	centsToRatio,
	midiToHz,
	percussive,
	pulseWave,
	renderFm,
	sawWave,
	Svf,
	TAU,
	triangleWave,
} from "./dsp.ts";
import type { Random } from "./random.ts";

export interface Note {
	readonly midi: number;
	/** 0..1; drives loudness and brightness together, as on a real instrument. */
	readonly velocity: number;
	/** Gate length in seconds (how long the key is held). */
	readonly seconds: number;
}

const clamp = (value: number, low: number, high: number): number =>
	Math.min(high, Math.max(low, value));

/** Wooden mallet pluck: FM 1:4 with a very fast index decay, plus the bar's 4x mode. */
export function marimba(note: Note): Float32Array {
	const hz = midiToHz(note.midi);
	const velocity = note.velocity;
	const tau = clamp(0.42 * Math.sqrt(523 / hz), 0.14, 0.7);
	const length = toSamples(Math.min(tau * 5.5, 2.6));
	const out = new Float32Array(length);
	const damp = (
		seconds: number,
	): number => (seconds > note.seconds
		? Math.exp(-(seconds - note.seconds) / 0.08)
		: 1);
	renderFm(
		{
			carrierHz: hz,
			ratio: 4,
			index: (seconds) =>
				(0.9 + 2.4 * velocity) * Math.exp(-seconds / 0.011) + 0.1,
			amplitude: (seconds) => percussive(0.0015, tau, seconds) * damp(seconds),
		},
		length,
		out,
		0.85 * velocity ** 1.3,
	);
	if (hz * 3.98 < 15_000) {
		renderFm(
			{
				carrierHz: hz * 3.98,
				ratio: 1,
				index: () => 0,
				amplitude: (seconds) =>
					percussive(0.001, tau * 0.16, seconds) * damp(seconds),
			},
			length,
			out,
			0.1 * velocity,
		);
	}
	return fadeEdges(out, 0.0005, 0.012);
}

/** Rhodes-flavoured keys: 1:1 body pair plus a 1:14 "tine" pair, chorused L/R. */
export function electricPiano(note: Note, brightness = 1): Stereo {
	const hz = midiToHz(note.midi);
	const velocity = note.velocity;
	const tau = clamp(1.8 * Math.sqrt(262 / hz), 0.7, 3.2);
	const release = 0.32;
	const length = toSamples(Math.min(note.seconds + release, tau * 4) + 0.02);
	const amplitude = (seconds: number): number => {
		const body = percussive(0.002, tau, seconds);
		return seconds > note.seconds
			? body * Math.exp(-(seconds - note.seconds) / (release / 4))
			: body;
	};
	const bodyIndex = (seconds: number): number =>
		brightness * ((0.4 + 1.5 * velocity) * Math.exp(-seconds / 0.4) + 0.25);
	const tineIndex = (seconds: number): number =>
		brightness * 1.1 * velocity * Math.exp(-seconds / 0.022);
	const channel = (cents: number): Float32Array => {
		const out = new Float32Array(length);
		const detuned = hz * centsToRatio(cents);
		renderFm(
			{ carrierHz: detuned, ratio: 1, index: bodyIndex, amplitude },
			length,
			out,
			0.6 * velocity ** 1.2,
		);
		renderFm(
			{
				carrierHz: detuned,
				ratio: 14,
				index: tineIndex,
				amplitude: (seconds) => amplitude(seconds) * Math.exp(-seconds / 0.35),
			},
			length,
			out,
			0.22 * velocity,
		);
		return fadeEdges(out, 0.001, 0.01);
	};
	return { left: channel(-3.5), right: channel(3.5) };
}

/** Glassy FM bell (1:3.5, inharmonic) for sparkles, chimes and shimmer. */
export function bell(note: Note): Float32Array {
	const hz = midiToHz(note.midi);
	const velocity = note.velocity;
	const tau = clamp(1.1 * Math.sqrt(1000 / hz), 0.25, 2.4);
	const length = toSamples(Math.min(tau * 4.5, 5));
	const out = new Float32Array(length);
	renderFm(
		{
			carrierHz: hz,
			ratio: 3.5,
			index: (seconds) =>
				(0.8 + 2.6 * velocity) * Math.exp(-seconds / 0.2) + 0.35,
			amplitude: (seconds) => percussive(0.0012, tau, seconds),
		},
		length,
		out,
		0.7 * velocity,
	);
	renderFm(
		{
			carrierHz: hz * 2,
			ratio: 1.41,
			index: (seconds) => 0.8 * Math.exp(-seconds / 0.1),
			amplitude: (seconds) => percussive(0.001, tau * 0.35, seconds),
		},
		length,
		out,
		0.18 * velocity,
	);
	return fadeEdges(out, 0.0005, 0.02);
}

export interface LeadOptions {
	/** Previous note for a legato slide into this one. */
	readonly glideFrom?: number;
	readonly vibratoCents?: number;
}

/** Gentle square lead: two slightly detuned pulses, delayed vibrato, soft filter. */
export function squareLead(
	note: Note,
	options: LeadOptions = {},
): Float32Array {
	const hz = midiToHz(note.midi);
	const envelope = adsr({
		attack: 0.006,
		decay: 0.16,
		sustain: 0.72,
		release: 0.09,
	}, note.seconds);
	const out = new Float32Array(envelope.length + toSamples(0.005));
	const filter = new Svf("lowpass");
	const vibratoDepth = options.vibratoCents ?? 16;
	let phaseA = 0;
	let phaseB = 0.37;
	for (let index = 0; index < out.length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const glide = options.glideFrom === undefined ? 1 : 2 **
			(((options.glideFrom - note.midi) / 12) * Math.exp(-seconds / 0.018));
		const vibratoRamp = clamp((seconds - 0.16) / 0.25, 0, 1);
		const vibrato = centsToRatio(
			vibratoDepth * vibratoRamp * Math.sin(TAU * 5.4 * seconds),
		);
		const frequency = hz * glide * vibrato;
		const dtA = frequency / SAMPLE_RATE;
		const dtB = (frequency * centsToRatio(7)) / SAMPLE_RATE;
		const raw = pulseWave(phaseA, dtA, 0.42) * 0.6 +
			pulseWave(phaseB, dtB, 0.5) * 0.4;
		phaseA = advance(phaseA, dtA);
		phaseB = advance(phaseB, dtB);
		const cutoff = Math.min(
			9000,
			frequency * (2.4 + 5 * Math.exp(-seconds / 0.12)),
		);
		const level = index < envelope.length ? envelope[index] : 0;
		out[index] = filter.process(raw, cutoff, 0.75) * level * 0.5 *
			note.velocity ** 1.1;
	}
	return fadeEdges(out, 0.001, 0.006);
}

/** Bouncy triangle bass with a sine sub an octave down and a touch of drive. */
export function triangleBass(note: Note): Float32Array {
	const hz = midiToHz(note.midi);
	const envelope = adsr({
		attack: 0.004,
		decay: 0.2,
		sustain: 0.62,
		release: 0.06,
	}, note.seconds);
	const out = new Float32Array(envelope.length);
	const filter = new Svf("lowpass");
	let phase = 0;
	let subPhase = 0;
	for (let index = 0; index < out.length; index += 1) {
		const raw = triangleWave(phase) * 0.75 + Math.sin(TAU * subPhase) * 0.55;
		phase = advance(phase, hz / SAMPLE_RATE);
		subPhase = advance(subPhase, hz / 2 / SAMPLE_RATE);
		const shaped = Math.tanh(raw * 1.6) / 1.6;
		out[index] = filter.process(shaped, Math.min(1800, hz * 7), 0.7) *
			envelope[index] * note.velocity;
	}
	return fadeEdges(out, 0.002, 0.008);
}

/** Round lo-fi sub: sine with gentle saturation so it still reads on phone speakers. */
export function subBass(note: Note, glideFrom?: number): Float32Array {
	const hz = midiToHz(note.midi);
	const envelope = adsr({
		attack: 0.012,
		decay: 0.45,
		sustain: 0.78,
		release: 0.12,
	}, note.seconds);
	const out = new Float32Array(envelope.length);
	let phase = 0;
	for (let index = 0; index < out.length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const glide = glideFrom === undefined
			? 1
			: 2 ** (((glideFrom - note.midi) / 12) * Math.exp(-seconds / 0.03));
		out[index] = (Math.tanh(Math.sin(TAU * phase) * 2.2) / 1.6) *
			envelope[index] * note.velocity;
		phase = advance(phase, (hz * glide) / SAMPLE_RATE);
	}
	return fadeEdges(out, 0.003, 0.01);
}

export interface SupersawOptions {
	readonly envelope: Adsr;
	readonly cutoffHz: number;
	/** Extra cutoff multiple at the attack, decaying over `filterDecay` seconds. */
	readonly filterBoost: number;
	readonly filterDecay: number;
	readonly spreadCents: number;
}

/** Seven detuned saws spread across the stereo field, through a resonant-free lowpass. */
export function supersaw(
	note: Note,
	random: Random,
	options: SupersawOptions,
): Stereo {
	const hz = midiToHz(note.midi);
	const envelope = adsr(options.envelope, note.seconds);
	const left = new Float32Array(envelope.length);
	const right = new Float32Array(envelope.length);
	const offsets = [-1, -0.62, -0.28, 0, 0.3, 0.64, 1];
	const voices = offsets.map((offset, index) => ({
		dt: (hz * centsToRatio(offset * options.spreadCents)) / SAMPLE_RATE,
		phase: random.next(),
		pan: offsets.length === 1
			? 0
			: ((index / (offsets.length - 1)) * 2 - 1) * 0.8,
		gain: offset === 0 ? 0.3 : 0.2,
	}));
	const filters = [new Svf("lowpass"), new Svf("lowpass")];
	for (let index = 0; index < envelope.length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		let sumLeft = 0;
		let sumRight = 0;
		for (const voice of voices) {
			const value = sawWave(voice.phase, voice.dt) * voice.gain;
			voice.phase = advance(voice.phase, voice.dt);
			sumLeft += value * (1 - voice.pan) * 0.5;
			sumRight += value * (1 + voice.pan) * 0.5;
		}
		const cutoff = options.cutoffHz *
			(1 + options.filterBoost * Math.exp(-seconds / options.filterDecay));
		const level = envelope[index] * note.velocity;
		left[index] = filters[0].process(sumLeft, cutoff, 0.8) * level;
		right[index] = filters[1].process(sumRight, cutoff, 0.8) * level;
	}
	return {
		left: fadeEdges(left, 0.001, 0.008),
		right: fadeEdges(right, 0.001, 0.008),
	};
}

/** Warm pad: detuned saw pair per side, dark lowpass, slow attack. */
export function pad(note: Note, random: Random, cutoffHz = 1600): Stereo {
	return supersaw(note, random, {
		envelope: { attack: 0.35, decay: 0.8, sustain: 0.8, release: 0.7 },
		cutoffHz,
		filterBoost: 0.3,
		filterDecay: 0.6,
		spreadCents: 9,
	});
}

/** Punchy pluck bass for the drop: saw plus sub square with a snappy filter envelope. */
export function pluckBass(note: Note): Float32Array {
	const hz = midiToHz(note.midi);
	const envelope = adsr({
		attack: 0.002,
		decay: 0.12,
		sustain: 0.6,
		release: 0.04,
	}, note.seconds);
	const out = new Float32Array(envelope.length);
	const filter = new Svf("lowpass");
	let phase = 0;
	let subPhase = 0;
	for (let index = 0; index < out.length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const dt = hz / SAMPLE_RATE;
		const raw = sawWave(phase, dt) * 0.55 +
			pulseWave(subPhase, dt / 2, 0.5) * 0.45;
		phase = advance(phase, dt);
		subPhase = advance(subPhase, dt / 2);
		const cutoff = 160 + 2400 * note.velocity * Math.exp(-seconds / 0.075);
		out[index] = (Math.tanh(filter.process(raw, cutoff, 1.1) * 1.8) / 1.8) *
			envelope[index] * note.velocity;
	}
	return fadeEdges(out, 0.001, 0.006);
}

/** Synth brass: detuned saws, a pitch scoop into the note and a swelling filter. */
export function brass(note: Note): Float32Array {
	const hz = midiToHz(note.midi);
	const envelope = adsr({
		attack: 0.028,
		decay: 0.14,
		sustain: 0.82,
		release: 0.16,
	}, note.seconds);
	const out = new Float32Array(envelope.length);
	const filter = new Svf("lowpass");
	const phases = [0, 0.31, 0.67];
	const detune = [-7, 0, 6];
	for (let index = 0; index < out.length; index += 1) {
		const seconds = index / SAMPLE_RATE;
		const scoop = centsToRatio(-45 * Math.exp(-seconds / 0.035));
		const vibrato = centsToRatio(
			10 * clamp((seconds - 0.25) / 0.2, 0, 1) * Math.sin(TAU * 5.6 * seconds),
		);
		let raw = 0;
		for (let voice = 0; voice < phases.length; voice += 1) {
			const dt = (hz * scoop * vibrato * centsToRatio(detune[voice])) /
				SAMPLE_RATE;
			raw += sawWave(phases[voice], dt) / phases.length;
			phases[voice] = advance(phases[voice], dt);
		}
		const swell = clamp(seconds / 0.06, 0, 1) *
			(0.55 + 0.45 * Math.exp(-Math.max(0, seconds - 0.06) / 0.25));
		const cutoff = Math.min(12_000, hz * (1.3 + 7 * swell * note.velocity));
		out[index] = filter.process(raw, cutoff, 0.9) * envelope[index] *
			note.velocity;
	}
	return fadeEdges(out, 0.001, 0.01);
}

/** Two-operator FM "bell tone" at a chosen ratio, used by SFX that need custom metals. */
export function fmPing(
	hz: number,
	ratio: number,
	index: number,
	tauSeconds: number,
	seconds: number,
): Float32Array {
	const length = toSamples(seconds);
	const out = new Float32Array(length);
	renderFm(
		{
			carrierHz: hz,
			ratio,
			index: (time) =>
				bandLimitedIndex(
					index * Math.exp(-time / (tauSeconds * 0.5)),
					hz,
					hz * ratio,
				),
			amplitude: (time) => percussive(0.0008, tauSeconds, time),
		},
		length,
		out,
		1,
	);
	return fadeEdges(out, 0.0004, Math.min(0.02, seconds / 4));
}
