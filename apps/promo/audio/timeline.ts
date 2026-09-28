/**
 * Musical time: the bar/beat grid, swing, humanisation, and the cue sheet
 * that tells a video editor where every bar and section starts.
 */

import { SAMPLE_RATE } from "./buffer.ts";
import type { Random } from "./random.ts";

export interface Swing {
	/** The subdivision that swings, in beats: 0.25 swings 16ths, 0.5 swings 8ths. */
	readonly unit: number;
	/** Share of each pair taken by the first note: 0.5 is straight, ~0.67 is a triplet shuffle. */
	readonly ratio: number;
}

/**
 * Moves a straight beat position onto the swung grid. Positions between grid
 * lines are warped piecewise-linearly, so ornaments stay in proportion.
 */
export function swingBeat(beat: number, swing: Swing | null): number {
	if (swing === null) {
		return beat;
	}
	const pair = swing.unit * 2;
	const base = Math.floor(beat / pair) * pair;
	const within = beat - base;
	const split = pair * swing.ratio;
	const warped = within <= swing.unit
		? (within / swing.unit) * split
		: split + ((within - swing.unit) / swing.unit) * (pair - split);
	return base + warped;
}

export class Timeline {
	readonly bpm: number;
	readonly beatsPerBar: number;
	readonly swing: Swing | null;

	constructor(bpm: number, beatsPerBar: number, swing: Swing | null) {
		this.bpm = bpm;
		this.beatsPerBar = beatsPerBar;
		this.swing = swing;
	}

	get beatSeconds(): number {
		return 60 / this.bpm;
	}

	get barSeconds(): number {
		return this.beatSeconds * this.beatsPerBar;
	}

	/** Seconds at `bar` (0-based) plus `beat`, with swing applied within the bar. */
	at(bar: number, beat: number): number {
		return bar * this.barSeconds +
			swingBeat(beat, this.swing) * this.beatSeconds;
	}

	/** Same position without swing (for things that must sit dead on the grid). */
	straight(bar: number, beat: number): number {
		return (bar * this.beatsPerBar + beat) * this.beatSeconds;
	}

	beats(count: number): number {
		return count * this.beatSeconds;
	}
}

/** Small random timing and velocity deviations so parts breathe like players. */
export class Humanizer {
	readonly #random: Random;
	readonly #timingSeconds: number;
	readonly #velocitySpread: number;

	constructor(random: Random, timingMs: number, velocitySpread: number) {
		this.#random = random;
		this.#timingSeconds = timingMs / 1000;
		this.#velocitySpread = velocitySpread;
	}

	time(seconds: number): number {
		return Math.max(0, seconds + this.#random.bipolar() * this.#timingSeconds);
	}

	velocity(velocity: number): number {
		return Math.min(
			1,
			Math.max(
				0.05,
				velocity * (1 + this.#random.bipolar() * this.#velocitySpread),
			),
		);
	}
}

export interface SectionSpan {
	readonly name: string;
	readonly startBar: number;
	readonly bars: number;
}

export interface Marker {
	readonly name: string;
	readonly seconds: number;
}

export interface CueSheet {
	readonly title: string;
	readonly bpm: number;
	readonly beatsPerBar: number;
	readonly beatSeconds: number;
	readonly barSeconds: number;
	readonly sampleRate: number;
	readonly durationSeconds: number;
	readonly swing: Swing | null;
	readonly sections: readonly {
		name: string;
		startBar: number;
		bars: number;
		startSeconds: number;
		endSeconds: number;
	}[];
	readonly bars: readonly {
		bar: number;
		startSeconds: number;
		section: string;
	}[];
	readonly markers: readonly Marker[];
}

const round = (seconds: number): number =>
	Math.round(seconds * 10_000) / 10_000;

/** Bars in the cue sheet are 1-based, as a musician or editor would count them. */
export function cueSheet(
	title: string,
	timeline: Timeline,
	sections: readonly SectionSpan[],
	markers: readonly Marker[],
	durationSeconds: number,
): CueSheet {
	return {
		title,
		bpm: timeline.bpm,
		beatsPerBar: timeline.beatsPerBar,
		beatSeconds: round(timeline.beatSeconds),
		barSeconds: round(timeline.barSeconds),
		sampleRate: SAMPLE_RATE,
		durationSeconds: round(durationSeconds),
		swing: timeline.swing,
		sections: sections.map((section) => ({
			name: section.name,
			startBar: section.startBar + 1,
			bars: section.bars,
			startSeconds: round(timeline.straight(section.startBar, 0)),
			endSeconds: round(
				Math.min(
					durationSeconds,
					timeline.straight(section.startBar + section.bars, 0),
				),
			),
		})),
		bars: sections.flatMap((section) =>
			Array.from({ length: section.bars }, (_, offset) => ({
				bar: section.startBar + offset + 1,
				startSeconds: round(timeline.straight(section.startBar + offset, 0)),
				section: section.name,
			}))
		),
		markers: markers.map((marker) => ({
			name: marker.name,
			seconds: round(marker.seconds),
		})),
	};
}
