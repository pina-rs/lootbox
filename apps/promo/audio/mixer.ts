/**
 * A tiny offline mixing desk. Songs drop rendered voices onto named buses;
 * `mixdown` then runs each bus's insert chain (filters, EQ, drive, automation,
 * custom inserts), applies kick-keyed ducking, feeds post-fader sends into a
 * shared delay and reverb, and sums everything to a stereo mix.
 */

import {
	addVoice,
	createStereo,
	dbToGain,
	mixInto,
	SAMPLE_RATE,
	type Stereo,
	toSamples,
	type Voice,
} from "./buffer.ts";
import { Biquad, type BiquadSpec, sweepInPlace } from "./dsp.ts";
import {
	type DelaySettings,
	duck,
	reverb,
	type ReverbSettings,
	saturate,
	sidechainKey,
	tempoDelay,
} from "./effects.ts";
import { integratedLoudness } from "./loudness.ts";

export interface BusSettings {
	readonly gainDb: number;
	readonly highpassHz?: number;
	readonly lowpassHz?: number;
	readonly eq?: readonly BiquadSpec[];
	/** tanh drive; 1 is clean, 2-3 is warm. */
	readonly drive?: number;
	/** Automated lowpass cutoff in Hz as a function of song time. */
	readonly lowpassSweep?: (seconds: number) => number;
	/** A custom insert (for example tape wow), run after the filters. */
	readonly insert?: (buffer: Stereo) => Stereo;
	/** Sidechain duck depth 0..1, keyed from `MixSettings.sidechain.source`. */
	readonly duck?: number;
	/** Post-fader send levels (linear). */
	readonly reverb?: number;
	readonly delay?: number;
}

export interface MixSettings {
	readonly buses: Readonly<Record<string, BusSettings>>;
	readonly sidechain?: {
		readonly source: string;
		readonly attackMs: number;
		readonly releaseMs: number;
	};
	readonly reverb?: ReverbSettings & {
		readonly returnDb: number;
		readonly duck?: number;
	};
	readonly delay?: DelaySettings & {
		readonly returnDb: number;
		readonly toReverb: number;
	};
}

export interface MixResult {
	readonly mix: Stereo;
	/** Integrated loudness of each processed bus, for checking the balance. */
	readonly stemLoudness: Readonly<Record<string, number>>;
}

function processBus(buffer: Stereo, settings: BusSettings): Stereo {
	const specs: BiquadSpec[] = [];
	if (settings.highpassHz !== undefined) {
		specs.push({ kind: "highpass", frequency: settings.highpassHz });
	}
	if (settings.lowpassHz !== undefined) {
		specs.push({ kind: "lowpass", frequency: settings.lowpassHz });
	}
	specs.push(...(settings.eq ?? []));
	for (const channel of [buffer.left, buffer.right]) {
		for (const spec of specs) {
			new Biquad(spec).processInPlace(channel);
		}
		if (settings.lowpassSweep !== undefined) {
			sweepInPlace(channel, "lowpass", settings.lowpassSweep, 0.9);
		}
		if (settings.drive !== undefined) {
			saturate(channel, settings.drive);
		}
	}
	const processed = settings.insert === undefined
		? buffer
		: settings.insert(buffer);
	const gain = dbToGain(settings.gainDb);
	for (let index = 0; index < processed.left.length; index += 1) {
		processed.left[index] *= gain;
		processed.right[index] *= gain;
	}
	return processed;
}

export class Session {
	readonly length: number;
	readonly #buses = new Map<string, Stereo>();

	constructor(durationSeconds: number) {
		this.length = toSamples(durationSeconds);
	}

	get durationSeconds(): number {
		return this.length / SAMPLE_RATE;
	}

	/** Places a voice on `bus` at `seconds`, creating the bus on first use. */
	add(bus: string, seconds: number, voice: Voice, gain = 1, pan = 0): void {
		let target = this.#buses.get(bus);
		if (target === undefined) {
			target = createStereo(this.length);
			this.#buses.set(bus, target);
		}
		addVoice(target, voice, toSamples(seconds), gain, pan);
	}

	mixdown(settings: MixSettings): MixResult {
		for (const name of this.#buses.keys()) {
			if (settings.buses[name] === undefined) {
				throw new Error(`Bus "${name}" has audio but no mix settings`);
			}
		}
		const processed = new Map<string, Stereo>();
		for (const [name, busSettings] of Object.entries(settings.buses)) {
			const buffer = this.#buses.get(name);
			if (buffer !== undefined) {
				processed.set(name, processBus(buffer, busSettings));
			}
		}

		const sidechainSource = settings.sidechain === undefined
			? undefined
			: processed.get(settings.sidechain.source);
		const key =
			settings.sidechain === undefined || sidechainSource === undefined
				? null
				: sidechainKey(
					sidechainSource,
					settings.sidechain.attackMs,
					settings.sidechain.releaseMs,
				);

		const mix = createStereo(this.length);
		const reverbSend = createStereo(this.length);
		const delaySend = createStereo(this.length);
		const stemLoudness: Record<string, number> = {};
		for (const [name, buffer] of processed) {
			const busSettings = settings.buses[name];
			if (key !== null && busSettings.duck !== undefined) {
				duck(buffer, key, busSettings.duck);
			}
			stemLoudness[name] = integratedLoudness(buffer);
			mixInto(mix, buffer, 1);
			mixInto(reverbSend, buffer, busSettings.reverb ?? 0);
			mixInto(delaySend, buffer, busSettings.delay ?? 0);
		}

		if (settings.delay !== undefined) {
			const echoes = tempoDelay(delaySend, settings.delay);
			mixInto(mix, echoes, dbToGain(settings.delay.returnDb));
			mixInto(reverbSend, echoes, settings.delay.toReverb);
		}
		if (settings.reverb !== undefined) {
			const tail = reverb(reverbSend, settings.reverb);
			if (key !== null && settings.reverb.duck !== undefined) {
				duck(tail, key, settings.reverb.duck);
			}
			mixInto(mix, tail, dbToGain(settings.reverb.returnDb));
		}
		return { mix, stemLoudness };
	}
}
