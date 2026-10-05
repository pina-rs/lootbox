/**
 * Shared scaffolding for the songs: a `Stage` that places humanised,
 * swung notes on the mixer, arrangement layout, and the `SongRender` shape the
 * render pipeline consumes.
 */
import type { Stereo, Voice } from "./buffer.ts";
import type { Note } from "./instruments.ts";
import { Session } from "./mixer.ts";
import { Random } from "./random.ts";
import { phrase, type PhraseNote } from "./theory.ts";
import {
	Humanizer,
	type Marker,
	type SectionSpan,
	type Timeline,
} from "./timeline.ts";

export interface SongRender {
	readonly title: string;
	readonly timeline: Timeline;
	readonly sections: readonly SectionSpan[];
	readonly markers: readonly Marker[];
	readonly mix: Stereo;
	readonly stemLoudness: Readonly<Record<string, number>>;
	/** For loops: the sample range kept after mastering, so tails wrap seamlessly. */
	readonly keep?: { readonly start: number; readonly end: number };
}

export interface Humanize {
	readonly timingMs: number;
	readonly velocitySpread: number;
}

export class Stage {
	readonly session: Session;
	readonly timeline: Timeline;
	readonly #humanize: Humanize;
	#random: Random;
	#humanizer: Humanizer;

	constructor(
		timeline: Timeline,
		durationSeconds: number,
		seed: string,
		humanize: Humanize,
	) {
		this.session = new Session(durationSeconds);
		this.timeline = timeline;
		this.#humanize = humanize;
		this.#random = Random.from(seed);
		this.#humanizer = new Humanizer(
			this.#random.fork("humanize"),
			humanize.timingMs,
			humanize.velocitySpread,
		);
	}

	get random(): Random {
		return this.#random;
	}

	/**
	 * Restarts every random stream from `label`. Rendering repeated sections
	 * with the same label makes them sample-identical, which is how the lo-fi
	 * loop wraps without a seam.
	 */
	reseed(label: string): void {
		this.#random = Random.from(label);
		this.#humanizer = new Humanizer(
			this.#random.fork("humanize"),
			this.#humanize.timingMs,
			this.#humanize.velocitySpread,
		);
	}

	/** Swung, humanised time of a grid position; `beat` may exceed the bar. */
	time(bar: number, beat: number, humanize = true): number {
		const bars = Math.floor(beat / this.timeline.beatsPerBar);
		const seconds = this.timeline.at(
			bar + bars,
			beat - bars * this.timeline.beatsPerBar,
		);

		return humanize ? this.#humanizer.time(seconds) : seconds;
	}

	velocity(velocity: number): number {
		return this.#humanizer.velocity(velocity);
	}

	beats(count: number): number {
		return this.timeline.beats(count);
	}

	add(
		bus: string,
		bar: number,
		beat: number,
		voice: Voice,
		gain = 1,
		pan = 0,
		humanize = true,
	): void {
		this.session.add(bus, this.time(bar, beat, humanize), voice, gain, pan);
	}

	/**
	 * Plays a phrase (see `theory.phrase`) from `bar`, handing each note to
	 * `render` with the previous note so instruments can slide legato.
	 */
	phrase(
		bus: string,
		bar: number,
		text: string,
		render: (note: Note, previous: PhraseNote | null) => Voice,
		options: PhraseOptions = {},
	): void {
		let previous: PhraseNote | null = null;

		for (const written of phrase(text)) {
			const note = {
				...written,
				midi: written.midi + (options.transpose ?? 0),
			};
			const gate = this.beats(note.length) * (options.legato ?? 0.9);
			const voice = render({
				midi: note.midi,
				velocity: this.velocity(note.velocity * (options.velocity ?? 1)),
				seconds: gate,
			}, previous);
			this.add(bus, bar, note.beat, voice, options.gain ?? 1, options.pan ?? 0);
			previous = note;
		}
	}
}

export interface PhraseOptions {
	readonly legato?: number;
	readonly transpose?: number;
	readonly velocity?: number;
	readonly gain?: number;
	readonly pan?: number;
}

/** Lays sections end to end and reports their bar spans. */
export function layout<
	T extends { readonly name: string; readonly bars: number },
>(sections: readonly T[]): { spans: SectionSpan[]; totalBars: number } {
	const spans: SectionSpan[] = [];
	let bar = 0;

	for (const section of sections) {
		spans.push({ name: section.name, startBar: bar, bars: section.bars });
		bar += section.bars;
	}

	return { spans, totalBars: bar };
}
