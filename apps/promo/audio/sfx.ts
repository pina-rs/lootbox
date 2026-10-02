/**
 * UI and story sound effects. Each generator renders a short, mostly dry
 * stereo sound from oscillators and seeded noise; `render.ts` peak-normalises
 * them. They share the music's timbres (marimba, FM bells, brass) so a video
 * that mixes both still sounds like one brand.
 */

import {
	addVoice,
	createStereo,
	fadeEdges,
	fadeStereoEdges,
	mixInto,
	panGains,
	SAMPLE_RATE,
	type Stereo,
	toSamples,
	type Voice,
} from "./buffer.ts";
import { crash, kick, snare, tom } from "./drums.ts";
import {
	advance,
	centsToRatio,
	filterInPlace,
	midiToHz,
	percussive,
	pulseWave,
	sawWave,
	Svf,
	TAU,
	triangleWave,
	whiteNoise,
} from "./dsp.ts";
import { reverb } from "./effects.ts";
import { bell, brass, fmPing, marimba } from "./instruments.ts";
import { Random } from "./random.ts";
import { midi } from "./theory.ts";

export interface SoundEffect {
	readonly name: string;
	readonly render: () => Stereo;
}

// --- Helpers ----------------------------------------------------------------

function stereoOf(mono: Float32Array, pan = 0): Stereo {
	const [left, right] = panGains(pan);
	return {
		left: mono.map((sample) => sample * left),
		right: mono.map((sample) => sample * right),
	};
}

/** Adds `voice` into `target` at `seconds`. */
function place(
	target: Stereo,
	voice: Voice,
	seconds: number,
	gain = 1,
	pan = 0,
): void {
	addVoice(target, voice, toSamples(seconds), gain, pan);
}

/** Adds a small room so dry sounds don't feel pasted on. */
function withRoom(dry: Stereo, wet: number, roomSize = 0.5): Stereo {
	const tail = reverb(dry, {
		roomSize,
		damping: 0.5,
		width: 1,
		preDelayMs: 8,
		lowCutHz: 300,
		highCutHz: 9000,
	});
	mixInto(dry, tail, wet);
	return dry;
}

/** Renders `seconds` of mono audio from a per-sample function of time. */
function synth(
	seconds: number,
	sample: (time: number, index: number) => number,
): Float32Array {
	const out = new Float32Array(toSamples(seconds));
	for (let index = 0; index < out.length; index += 1) {
		out[index] = sample(index / SAMPLE_RATE, index);
	}
	return out;
}

// --- UI ---------------------------------------------------------------------

function uiClick(): Stereo {
	const random = Random.from("sfx/ui-click");
	const noise = filterInPlace(whiteNoise(random, toSamples(0.06)), {
		kind: "highpass",
		frequency: 3000,
	});
	const out = synth(0.06, (time, index) => {
		const tone = Math.sin(TAU * 2300 * time) * Math.exp(-time / 0.004) +
			0.4 * Math.sin(TAU * 1150 * time) * Math.exp(-time / 0.006);
		return tone + noise[index] * 0.5 * Math.exp(-time / 0.0008);
	});
	return stereoOf(fadeEdges(out, 0.0002, 0.01));
}

/** A rising bubble "bloop" followed by a smaller, higher one. */
function bubble(
	seconds: number,
	fromHz: number,
	toHz: number,
	sweep: number,
	tau: number,
): Float32Array {
	let phase = 0;
	return synth(seconds, (time) => {
		const hz = fromHz * (toHz / fromHz) ** Math.min(1, time / sweep);
		phase = advance(phase, hz / SAMPLE_RATE);
		return (Math.sin(TAU * phase) + 0.15 * Math.sin(2 * TAU * phase)) *
			percussive(0.002, tau, time);
	});
}

function uiPop(): Stereo {
	const out = createStereo(toSamples(0.28));
	place(out, bubble(0.22, 380, 1150, 0.05, 0.04), 0, 1, -0.1);
	place(out, bubble(0.16, 700, 1700, 0.035, 0.03), 0.045, 0.35, 0.2);
	return withRoom(out, 0.12, 0.3);
}

function blip(fromHz: number, toHz: number): () => Stereo {
	return () => {
		const filter = new Svf("lowpass");
		let phase = 0;
		const out = synth(0.12, (time) => {
			const hz = toHz + (fromHz - toHz) * Math.exp(-time / 0.012);
			const dt = hz / SAMPLE_RATE;
			const raw = pulseWave(phase, dt, 0.5) * 0.5 + triangleWave(phase) * 0.5;
			phase = advance(phase, dt);
			return filter.process(raw, 3500, 0.7) * percussive(0.0015, 0.045, time);
		});
		return stereoOf(fadeEdges(out, 0.0005, 0.02));
	};
}

function typeTick(): Stereo {
	const random = Random.from("sfx/type-tick");
	const noise = filterInPlace(whiteNoise(random, toSamples(0.05)), {
		kind: "bandpass",
		frequency: 3500,
		q: 1.5,
	});
	const out = synth(0.05, (time, index) => {
		return noise[index] * 1.5 * Math.exp(-time / 0.0015) +
			0.5 * Math.sin(TAU * 170 * time) * Math.exp(-time / 0.008) +
			0.25 * Math.sin(TAU * 1100 * time) * Math.exp(-time / 0.004);
	});
	return stereoOf(fadeEdges(out, 0.0002, 0.01));
}

// --- Motion -----------------------------------------------------------------

/** Air rushing past: band-passed noise whose centre and level follow a swell, panning across. */
function whoosh(reverse: boolean): () => Stereo {
	return () => {
		const random = Random.from(reverse ? "sfx/whoosh-reverse" : "sfx/whoosh");
		const seconds = 0.75;
		const length = toSamples(seconds);
		const noise = filterInPlace(whiteNoise(random, length), {
			kind: "lowpass",
			frequency: 6000,
		});
		const out = createStereo(length);
		const band = new Svf("bandpass");
		const body = new Svf("lowpass");
		for (let index = 0; index < length; index += 1) {
			const progress = index / length;
			const swell = reverse
				? progress ** 3
				: Math.sin(Math.PI * Math.min(1, progress / 0.9)) ** 2;
			const centre = reverse
				? 300 * (4500 / 300) ** progress
				: 350 + 2800 * swell;
			const air = band.process(noise[index], centre, 1.4) * 0.8 +
				body.process(noise[index], 500, 0.7) * 0.35;
			const [left, right] = panGains(
				reverse ? 0.7 - 1.4 * progress : -0.8 + 1.6 * progress,
			);
			out.left[index] = air * swell * left;
			out.right[index] = air * swell * right;
		}
		return fadeStereoEdges(out, 0.01, reverse ? 0.012 : 0.05);
	};
}

// --- Treasure ---------------------------------------------------------------

/** One struck coin: plate-like inharmonic partials plus a contact click. */
function coinStrike(random: Random, hz: number): Float32Array {
	const partials = [
		[1, 1, 0.28],
		[2.76, 0.6, 0.14],
		[5.4, 0.35, 0.07],
		[8.93, 0.2, 0.035],
	].filter(([ratio]) => ratio * hz < 18_000);
	const click = filterInPlace(whiteNoise(random, toSamples(0.01)), {
		kind: "highpass",
		frequency: 4000,
	});
	const out = synth(0.6, (time, index) => {
		let ring = 0;
		for (const [ratio, amplitude, tau] of partials) {
			ring += Math.sin(TAU * hz * ratio * time) * amplitude *
				percussive(0.0005, tau, time);
		}
		return ring * 0.5 +
			(index < click.length ? click[index] * Math.exp(-time / 0.001) * 0.4 : 0);
	});
	return fadeEdges(out, 0.0002, 0.05);
}

function coinClink(): Stereo {
	const random = Random.from("sfx/coin-clink");
	const out = createStereo(toSamples(0.7));
	place(out, coinStrike(random, 2050), 0, 1, -0.1);
	place(out, coinStrike(random, 2130), 0.085, 0.6, 0.15);
	return withRoom(out, 0.1, 0.35);
}

function coinsCascade(): Stereo {
	const random = Random.from("sfx/coins-cascade");
	const out = createStereo(toSamples(1.9));
	const times = Array.from({ length: 28 }, () => 1.3 * random.next() ** 1.7)
		.sort((a, b) => a - b);
	for (const time of times) {
		place(
			out,
			coinStrike(random, random.range(1700, 2700)),
			time,
			random.range(0.25, 0.8) * (1 - 0.5 * (time / 1.3)),
			random.range(-0.8, 0.8),
		);
	}
	return fadeStereoEdges(withRoom(out, 0.18, 0.45), 0.001, 0.1);
}

function sparkle(): Stereo {
	const out = createStereo(toSamples(1.5));
	const notes = ["C6", "D6", "E6", "G6", "A6", "C7", "D7", "E7", "G7"];
	notes.forEach((name, index) => {
		const velocity = 0.45 + (0.35 * index) / (notes.length - 1);
		place(
			out,
			bell({ midi: midi(name), velocity, seconds: 1 }),
			index * 0.045,
			1,
			(index % 2 === 0 ? -1 : 1) * (0.2 + (0.6 * index) / notes.length),
		);
	});
	place(
		out,
		bell({ midi: midi("C8"), velocity: 0.35, seconds: 1 }),
		notes.length * 0.045 + 0.05,
		0.5,
		0,
	);
	return fadeStereoEdges(withRoom(out, 0.3, 0.6), 0.0005, 0.15);
}

// --- Chest ------------------------------------------------------------------

/**
 * Cartoon hinge: stick-slip impulses whose rate climbs (32 → 95 per second)
 * ring three wooden resonances, so the creak rises like a curious "hmm?".
 */
function chestCreak(): Stereo {
	const random = Random.from("sfx/chest-creak");
	const seconds = 0.9;
	const length = toSamples(seconds);
	const excitation = new Float32Array(length);
	let time = 0.02;
	while (time < seconds - 0.15) {
		const progress = time / seconds;
		excitation[toSamples(time)] = random.range(0.8, 1.2);
		time += (1 / (32 + 63 * progress ** 1.2)) * random.range(0.88, 1.12);
	}
	const resonators = [
		{ filter: new Svf("bandpass"), hz: 820, q: 9, gain: 1 },
		{ filter: new Svf("bandpass"), hz: 1640, q: 7, gain: 0.5 },
		{ filter: new Svf("bandpass"), hz: 460, q: 5, gain: 0.7 },
	];
	const out = new Float32Array(length);
	for (let index = 0; index < length; index += 1) {
		const progress = index / length;
		let sum = 0;
		for (const resonator of resonators) {
			sum += resonator.filter.process(
				excitation[index],
				resonator.hz * (1 + 0.12 * progress),
				resonator.q,
			) * resonator.gain;
		}
		const envelope = Math.min(1, index / toSamples(0.05)) *
			Math.min(1, (length - index) / toSamples(0.15));
		out[index] = sum * envelope;
	}
	const stereo = stereoOf(fadeEdges(out, 0.005, 0.02), -0.1);
	place(stereo, tom(random, 380, 0.35), 0.78, 0.4, 0.1);
	return withRoom(stereo, 0.1, 0.4);
}

/** The chest landing: low thump, a boxy wooden body, hinge rattle and a puff of dust. */
export function chestThud(): Stereo {
	const random = Random.from("sfx/chest-thud");
	const seconds = 0.8;
	const length = toSamples(seconds);
	const wood = filterInPlace(whiteNoise(random, length), {
		kind: "bandpass",
		frequency: 260,
		q: 2.2,
	});
	const dust = filterInPlace(whiteNoise(random, length), {
		kind: "lowpass",
		frequency: 900,
	});
	let phase = 0;
	const body = synth(seconds, (time, index) => {
		const hz = 42 + 73 * Math.exp(-time / 0.04);
		phase = advance(phase, hz / SAMPLE_RATE);
		const thump = Math.sin(TAU * phase) * percussive(0.001, 0.16, time);
		const box = wood[index] * 2.2 * Math.exp(-time / 0.05) +
			0.3 * Math.sin(TAU * 190 * time) * Math.exp(-time / 0.07);
		return Math.tanh(
			(thump + box + dust[index] * 0.08 * Math.exp(-time / 0.2)) * 1.8,
		) / 1.8;
	});
	const out = stereoOf(fadeEdges(body, 0.0005, 0.05));
	for (const [time, hz] of [[0.03, 3200], [0.055, 3650], [0.07, 2900]]) {
		place(
			out,
			fmPing(hz, 1.41, 1.2, 0.02, 0.1),
			time,
			0.08,
			random.range(-0.5, 0.5),
		);
	}
	return withRoom(out, 0.08, 0.35);
}

function lockClick(): Stereo {
	const random = Random.from("sfx/lock-click");
	const click = (size: number): Float32Array => {
		const noise = filterInPlace(whiteNoise(random, toSamples(0.12)), {
			kind: "highpass",
			frequency: 2500,
		});
		const pingA = fmPing(3100, 1.53, 1.2, 0.018, 0.12);
		const pingB = fmPing(4700, 1.21, 0.8, 0.012, 0.12);
		return fadeEdges(
			synth(
				0.12,
				(time, index) =>
					(noise[index] * Math.exp(-time / 0.0012) + pingA[index] * 0.5 +
						pingB[index] * 0.3 +
						Math.sin(TAU * 320 * time) * Math.exp(-time / 0.01) * 0.6) * size,
			),
			0.0002,
			0.02,
		);
	};
	const out = createStereo(toSamples(0.3));
	place(out, click(0.6), 0, 1, 0.1);
	place(out, click(1), 0.075, 1, -0.05);
	return withRoom(out, 0.06, 0.3);
}

// --- Moments ----------------------------------------------------------------

function drumroll(): Stereo {
	const random = Random.from("sfx/drumroll");
	const out = createStereo(toSamples(3.6));
	let time = 0;
	let stroke = 0;
	while (time < 2) {
		const progress = time / 2;
		const velocity = (0.2 + 0.8 * progress ** 1.5) *
			(stroke % 2 === 0 ? 1 : 0.82) * random.range(0.92, 1.05);
		place(
			out,
			snare(random, Math.min(1, velocity), {
				tuneHz: 205,
				decay: 0.09,
				snappy: 0.95,
			}),
			time,
			1,
			stroke % 2 === 0 ? -0.15 : 0.15,
		);
		time += 0.058 - 0.018 * progress;
		stroke += 1;
	}
	place(out, crash(random, 1), 2, 0.75);
	place(out, kick(random, 1, { startHz: 150, endHz: 48, decay: 0.3 }), 2, 0.9);
	place(out, snare(random, 1, { tuneHz: 205, decay: 0.14 }), 2, 0.7);
	return fadeStereoEdges(withRoom(out, 0.15, 0.55), 0.001, 0.4);
}

function fanfareShort(): Stereo {
	const random = Random.from("sfx/fanfare-short");
	const out = createStereo(toSamples(1.5));
	const pickup = ["G3", "B3", "D4", "G4"];
	for (const start of [0, 0.1, 0.2]) {
		for (const name of pickup) {
			place(
				out,
				brass({ midi: midi(name), velocity: 0.75, seconds: 0.075 }),
				start,
				0.5,
				(midi(name) - 60) / 30,
			);
		}
	}
	const final = ["C3", "C4", "E4", "G4", "C5", "E5"];
	for (const name of final) {
		place(
			out,
			brass({ midi: midi(name), velocity: 0.95, seconds: 0.95 }),
			0.32,
			0.5,
			(midi(name) - 62) / 30,
		);
	}
	place(out, tom(random, 98, 0.9), 0.32, 0.8);
	place(out, crash(random, 0.5), 0.32, 0.35);
	return fadeStereoEdges(withRoom(out, 0.2, 0.55), 0.001, 0.25);
}

/** Comic "wah-wah-wah-waaah": a muted, filter-wahed brass line sliding down by semitones. */
function aww(): Stereo {
	const notes = [
		{ name: "D4", start: 0, length: 0.32 },
		{ name: "C#4", start: 0.36, length: 0.32 },
		{ name: "C4", start: 0.72, length: 0.32 },
		{ name: "B3", start: 1.08, length: 0.62 },
	];
	const out = createStereo(toSamples(1.85));
	notes.forEach((note, noteIndex) => {
		const last = noteIndex === notes.length - 1;
		const hz = midiToHz(midi(note.name));
		const filter = new Svf("lowpass");
		const phases = [0, 0.4];
		const voice = synth(note.length + 0.1, (time) => {
			const wobble = last
				? centsToRatio(
					45 * Math.sin(TAU * 6.5 * time) * Math.min(1, time / 0.15) -
						40 * (time / note.length),
				)
				: 1;
			const dt = (hz * wobble) / SAMPLE_RATE;
			const raw = sawWave(phases[0], dt) * 0.6 +
				pulseWave(phases[1], dt, 0.3) * 0.4;
			phases[0] = advance(phases[0], dt);
			phases[1] = advance(phases[1], dt);
			const wah = last
				? 0.5 + 0.5 * Math.sin(TAU * 6.5 * time - Math.PI / 2)
				: Math.sin(Math.PI * Math.min(1, time / (note.length * 0.8)));
			const amplitude = Math.min(1, time / 0.03) *
				(time < note.length ? 1 : Math.exp(-(time - note.length) / 0.03));
			return filter.process(raw, 350 + 1300 * wah, 2.2) * amplitude;
		});
		place(out, fadeEdges(voice, 0.001, 0.02), note.start, 0.9, 0);
	});
	return withRoom(out, 0.1, 0.4);
}

function cashRegister(): Stereo {
	const random = Random.from("sfx/cash-register");
	const out = createStereo(toSamples(1.4));
	const clack = filterInPlace(whiteNoise(random, toSamples(0.2)), {
		kind: "bandpass",
		frequency: 1800,
		q: 1.2,
	});
	place(
		out,
		synth(0.2, (time, index) =>
			clack[index] * 2 * Math.exp(-time / 0.006) +
			0.5 * Math.sin(TAU * 150 * time) * Math.exp(-time / 0.02)),
		0,
		0.9,
		-0.1,
	);
	for (let click = 0; click < 4; click += 1) {
		const rattle = filterInPlace(whiteNoise(random, toSamples(0.02)), {
			kind: "highpass",
			frequency: 3000,
		});
		place(
			out,
			synth(0.02, (time, index) => rattle[index] * Math.exp(-time / 0.0015)),
			0.012 + click * 0.011,
			0.5 * 0.75 ** click,
			0.2,
		);
	}
	const drawer = filterInPlace(whiteNoise(random, toSamples(0.12)), {
		kind: "lowpass",
		frequency: 1500,
	});
	place(
		out,
		synth(
			0.12,
			(time, index) => drawer[index] * Math.sin((Math.PI * time) / 0.12) * 0.25,
		),
		0.03,
		1,
		0,
	);
	const shimmer = (time: number): number => 1 + 0.15 * Math.sin(TAU * 9 * time);
	for (
		const [name, gain, pan] of [["A6", 0.8, -0.2], ["E7", 0.6, 0.25]] as const
	) {
		const ring = bell({ midi: midi(name), velocity: 0.9, seconds: 1.2 });
		place(
			out,
			ring.map((sample, index) => sample * shimmer(index / SAMPLE_RATE)),
			0.1,
			gain,
			pan,
		);
	}
	place(out, fmPing(5274, 1.41, 1.5, 0.25, 1.2), 0.1, 0.15, 0);
	return fadeStereoEdges(withRoom(out, 0.2, 0.5), 0.0005, 0.2);
}

function notification(): Stereo {
	const out = createStereo(toSamples(0.95));
	for (
		const [name, start, velocity] of [["G5", 0, 0.7], [
			"C6",
			0.12,
			0.85,
		]] as const
	) {
		const note = { midi: midi(name), velocity, seconds: 0.6 };
		place(out, marimba(note), start, 1, start === 0 ? -0.15 : 0.15);
		place(out, bell(note), start, 0.35, start === 0 ? -0.15 : 0.15);
	}
	return fadeStereoEdges(withRoom(out, 0.15, 0.45), 0.0005, 0.15);
}

/** Every effect, in the order they appear in the report. */
export const SOUND_EFFECTS: readonly SoundEffect[] = [
	{ name: "ui-click", render: uiClick },
	{ name: "ui-pop", render: uiPop },
	{ name: "blip-up", render: blip(880, 1320) },
	{ name: "blip-down", render: blip(1320, 880) },
	{ name: "type-tick", render: typeTick },
	{ name: "whoosh", render: whoosh(false) },
	{ name: "whoosh-reverse", render: whoosh(true) },
	{ name: "coin-clink", render: coinClink },
	{ name: "coins-cascade", render: coinsCascade },
	{ name: "sparkle", render: sparkle },
	{ name: "chest-creak", render: chestCreak },
	{ name: "chest-thud", render: chestThud },
	{ name: "lock-click", render: lockClick },
	{ name: "drumroll", render: drumroll },
	{ name: "fanfare-short", render: fanfareShort },
	{ name: "aww", render: aww },
	{ name: "cash-register", render: cashRegister },
	{ name: "notification", render: notification },
];
