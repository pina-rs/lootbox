/**
 * "Big Reveal" — hype for the fast social cut. 124 BPM in C major: a filtered,
 * pulsing intro, a four-bar build (accelerating snare roll, riser, opening
 * filter), one big impact, an eight-bar drop with pumping saw chords, rolling
 * bass and a marimba-doubled lead hook, then a ringing sting.
 */
import {
	clap,
	crash,
	hat,
	impact,
	kick,
	reverseCymbal,
	riser,
	snare,
	tom,
} from "../drums.ts";
import {
	marimba,
	type Note,
	pluckBass,
	squareLead,
	supersaw,
} from "../instruments.ts";
import { layout, type SongRender, Stage } from "../song.ts";
import { chord, type ChordBar, pitchAtOrAbove, voiceLead } from "../theory.ts";
import { type Marker, type SectionSpan, Timeline } from "../timeline.ts";

const TIMELINE = new Timeline(124, 4, null);

type SectionKind = "intro" | "build" | "drop" | "sting";

interface Section {
	readonly name: string;
	readonly kind: SectionKind;
	readonly bars: number;
	readonly chords: readonly ChordBar[];
}

const DROP_CHORDS: readonly ChordBar[] = [
	["C"],
	["E7"],
	["Am"],
	["F"],
	["C"],
	["E7"],
	["F"],
	["G"],
];

/** Two-bar hook (C → E7 lifts through G#), answered over Am → F, then climbing to the dominant. */
const HOOK = [
	"E5/.75 G5/.75 C6/.5 B5/.5 C6/.5 E6/.5 D6/.5",
	"B5/.75 G#5/.75 E5/.5 G#5/.5 B5/.5 D6/1",
	"C6/.75 A5/.75 E5/.5 A5/.5 C6/.5 E6/.5 D6/.5",
	"C6/.75 A5/.75 F5/.5 A5/.5 C6/1.5",
	"E5/.75 G5/.75 C6/.5 B5/.5 C6/.5 E6/.5 D6/.5",
	"B5/.75 G#5/.75 E5/.5 G#5/.5 B5/.5 D6/1",
	"A5/.75 C6/.75 F6/.5 E6/.5 C6/.5 A5/.5 C6/.5",
	"B5/.75 D6/.75 G6/.5 F6/.5 D6/.5 B5/.5 G5/.5",
];

const BIG_REVEAL: readonly Section[] = [
	{ name: "intro", kind: "intro", bars: 4, chords: DROP_CHORDS.slice(0, 4) },
	{
		name: "build",
		kind: "build",
		bars: 4,
		chords: [["F"], ["Dm7"], ["G7sus4"], ["G"]],
	},
	{ name: "drop", kind: "drop", bars: 8, chords: DROP_CHORDS },
	{ name: "sting", kind: "sting", bars: 1, chords: [["C"]] },
];

const STING_TAIL_SECONDS = 2.5;
const SAW_OPTIONS = {
	envelope: { attack: 0.004, decay: 0.25, sustain: 0.75, release: 0.12 },
	cutoffHz: 5200,
	filterBoost: 0.6,
	filterDecay: 0.15,
	spreadCents: 24,
};
const STAB_OPTIONS = {
	...SAW_OPTIONS,
	envelope: { attack: 0.002, decay: 0.08, sustain: 0.4, release: 0.05 },
};

class Crew {
	readonly stage: Stage;
	#voicing: number[] | null = null;

	constructor(stage: Stage) {
		this.stage = stage;
	}

	#chordNotes(symbol: string): number[] {
		this.#voicing = voiceLead(this.#voicing, chord(symbol), {
			low: 55,
			high: 74,
		});

		return this.#voicing;
	}

	/** Short saw-chord pulses on a grid of `step` beats. */
	pulses(bar: number, symbol: string, step: number, velocity: number): void {
		const notes = this.#chordNotes(symbol);

		for (let beat = 0; beat < 4; beat += step) {
			for (const midi of notes) {
				const note: Note = {
					midi,
					velocity: this.stage.velocity(velocity * (beat % 1 === 0 ? 1 : 0.8)),
					seconds: this.stage.beats(step * 0.55),
				};
				this.stage.add(
					"saws",
					bar,
					beat,
					supersaw(note, this.stage.random, STAB_OPTIONS),
					0.5,
					0,
					false,
				);
			}
		}
	}

	/** Sustained saw chord for the drop; the sidechain turns it into a pump. */
	chord(bar: number, symbol: string, beats: number): void {
		for (const midi of this.#chordNotes(symbol)) {
			const note: Note = {
				midi,
				velocity: 0.8,
				seconds: this.stage.beats(beats) * 0.97,
			};
			this.stage.add(
				"saws",
				bar,
				0,
				supersaw(note, this.stage.random, SAW_OPTIONS),
				0.5,
				0,
				false,
			);
			this.stage.add(
				"saws",
				bar,
				0,
				supersaw(
					{ ...note, midi: midi + 12, velocity: 0.35 },
					this.stage.random,
					SAW_OPTIONS,
				),
				0.5,
				0,
				false,
			);
		}
	}

	bassPulse(bar: number, symbol: string, rolling: boolean, next: string): void {
		const root = pitchAtOrAbove(chord(symbol).bass, 33);
		const steps = rolling ? [0.25, 0.5, 0.75] : [0.5];

		for (let beat = 0; beat < 4; beat += 1) {
			for (const offset of steps) {
				const lastStep = rolling && beat === 3 && offset === 0.75;
				const target = pitchAtOrAbove(chord(next).bass, 33);
				const midi = lastStep && target !== root
					? (target > root ? target - 1 : target + 1)
					: offset === 0.5 && rolling
					? root + 12
					: root;
				const note: Note = {
					midi,
					velocity: this.stage.velocity(offset === 0.5 ? 0.95 : 0.75),
					seconds: this.stage.beats(rolling ? 0.2 : 0.35),
				};
				this.stage.add(
					"bass",
					bar,
					beat + offset,
					pluckBass(note),
					1,
					0,
					false,
				);
			}
		}
	}

	hook(bar: number, text: string): void {
		this.stage.phrase(
			"lead",
			bar,
			text,
			(note) => squareLead(note, { vibratoCents: 10 }),
			{ legato: 0.85 },
		);
		this.stage.phrase("marimba", bar, text, (note) => marimba(note), {
			transpose: -12,
			legato: 1,
			velocity: 1.1,
		});
	}

	kick(bar: number, beat: number, velocity = 1): void {
		this.stage.add(
			"kick",
			bar,
			beat,
			kick(this.stage.random, velocity, {
				startHz: 185,
				endHz: 50,
				decay: 0.2,
				click: 0.35,
				drive: 2,
			}),
			1,
			0,
			false,
		);
	}

	snare(bar: number, beat: number, velocity: number, tuneHz = 200): void {
		this.stage.add(
			"snare",
			bar,
			beat,
			snare(this.stage.random, this.stage.velocity(velocity), {
				tuneHz,
				decay: 0.12,
				snappy: 0.9,
			}),
			1,
			0,
			false,
		);
	}

	hats(bar: number): void {
		for (let step = 0; step < 16; step += 1) {
			const offbeat = step % 4 === 2;
			this.stage.add(
				"hats",
				bar,
				step / 4,
				hat(
					this.stage.random,
					this.stage.velocity(offbeat ? 0.8 : step % 2 === 0 ? 0.5 : 0.35),
					offbeat,
				),
				1,
				offbeat ? 0.25 : -0.25,
			);
		}
	}

	groove(bar: number): void {
		for (let beat = 0; beat < 4; beat += 1) {
			this.kick(bar, beat);
		}

		for (const beat of [1, 3]) {
			this.stage.add(
				"clap",
				bar,
				beat,
				clap(this.stage.random, this.stage.velocity(0.9)),
			);
			this.snare(bar, beat, 0.6);
		}

		this.hats(bar);
	}

	sting(bar: number): void {
		for (const midi of [55, 60, 64, 67, 72]) {
			const note: Note = { midi, velocity: 0.9, seconds: 1.6 };
			this.stage.add(
				"saws",
				bar,
				0,
				supersaw(note, this.stage.random, {
					...SAW_OPTIONS,
					envelope: { attack: 0.003, decay: 0.6, sustain: 0.5, release: 0.8 },
				}),
				0.5,
				0,
				false,
			);
			this.stage.add(
				"marimba",
				bar,
				0,
				marimba({ midi: midi + 12, velocity: 0.95, seconds: 2 }),
				0.7,
				(midi - 64) / 20,
				false,
			);
		}

		this.stage.add(
			"lead",
			bar,
			0,
			squareLead({ midi: 84, velocity: 0.8, seconds: 1.2 }),
			0.8,
			0,
			false,
		);
		this.stage.add(
			"bass",
			bar,
			0,
			pluckBass({ midi: 36, velocity: 1, seconds: 1.4 }),
			1,
			0,
			false,
		);
		this.stage.add("fx", bar, 0, impact(this.stage.random, 1), 1, 0, false);
		this.kick(bar, 0);
	}
}

function renderSection(
	crew: Crew,
	sections: readonly Section[],
	index: number,
	startBar: number,
	markers: Marker[],
): void {
	const section = sections[index];
	const stage = crew.stage;
	const next = (
		offset: number,
	): string => (offset + 1 < section.bars
		? section.chords[offset + 1][0]
		: sections[index + 1]?.chords[0][0] ?? "C");

	for (let offset = 0; offset < section.bars; offset += 1) {
		const bar = startBar + offset;
		const symbol = section.chords[offset][0];
		switch (section.kind) {
			case "intro":
				crew.pulses(bar, symbol, 0.5, 0.7);
				crew.bassPulse(bar, symbol, false, next(offset));

				for (let beat = 0; beat < 4; beat += 1) {
					crew.kick(bar, beat, 0.75);
				}

				if (offset >= 2) {
					crew.hats(bar);
				}

				break;
			case "build": {
				const stepByBar = [1, 0.5, 0.25, 0.125];
				const step = stepByBar[offset];
				crew.pulses(bar, symbol, offset < 2 ? 0.5 : 0.25, 0.75);
				const rollEnd = offset === section.bars - 1 ? 3.5 : 4;

				for (let beat = 0; beat < rollEnd; beat += step) {
					const progress = (offset * 4 + beat) / (section.bars * 4);
					crew.snare(bar, beat, 0.3 + 0.65 * progress, 190 + 150 * progress);
				}

				if (offset < 2) {
					for (let beat = 0; beat < 4; beat += 1) {
						crew.kick(bar, beat, 0.85);
					}
				} else if (offset === 2) {
					for (let beat = 0; beat < 4; beat += 0.5) {
						crew.kick(bar, beat, 0.6 + beat * 0.08);
					}
				}

				if (offset === 0) {
					stage.add(
						"fx",
						bar,
						0,
						riser(stage.random, 0.9, stage.timeline.barSeconds * section.bars),
						1,
						0,
						false,
					);
					markers.push({
						name: "build",
						seconds: stage.timeline.straight(bar, 0),
					});
				}

				if (offset === section.bars - 1) {
					stage.add(
						"fx",
						bar,
						2,
						reverseCymbal(stage.random, 0.9, stage.beats(2)),
						1,
						0,
						false,
					);
				}

				break;
			}
			case "drop":
				if (offset === 0) {
					stage.add("fx", bar, 0, impact(stage.random, 1), 1, 0, false);
					markers.push({
						name: "impact",
						seconds: stage.timeline.straight(bar, 0),
					});
				}

				if (offset === 4) {
					stage.add("crash", bar, 0, crash(stage.random, 0.8), 1, 0, false);
				}

				crew.chord(bar, symbol, 4);
				crew.bassPulse(bar, symbol, true, next(offset));
				crew.hook(bar, HOOK[offset]);
				crew.groove(bar);

				if (offset === 3) {
					for (let beat = 3; beat < 4; beat += 0.25) {
						crew.snare(bar, beat, 0.5 + (beat - 3) * 0.4);
					}
				}

				if (offset === section.bars - 1) {
					[196, 165, 131, 110].forEach((hz, step) => {
						stage.add(
							"toms",
							bar,
							3 + step * 0.25,
							tom(stage.random, hz, 0.9),
							1,
							0.4 - step * 0.25,
						);
					});
				}

				break;
			case "sting":
				crew.sting(bar);
				markers.push({
					name: "sting",
					seconds: stage.timeline.straight(bar, 0),
				});
				break;
		}
	}
}

function sawCutoff(spans: readonly SectionSpan[]): (seconds: number) => number {
	const intro = spans[0];
	const build = spans[1];
	const introEnd = TIMELINE.straight(intro.startBar + intro.bars, 0);
	const buildEnd = TIMELINE.straight(build.startBar + build.bars, 0);

	return (seconds) => {
		if (seconds < introEnd) {
			return 450 * (1800 / 450) ** (seconds / introEnd);
		}
		if (seconds < buildEnd) {
			return 1800 *
				(18_000 / 1800) **
					(((seconds - introEnd) / (buildEnd - introEnd)) ** 2);
		}
		return 20_000;
	};
}

export function renderBigReveal(title: string): SongRender {
	const { spans, totalBars } = layout(BIG_REVEAL);
	const stage = new Stage(
		TIMELINE,
		TIMELINE.straight(totalBars - 1, 0) + STING_TAIL_SECONDS,
		title,
		{ timingMs: 3, velocitySpread: 0.06 },
	);
	const crew = new Crew(stage);
	const markers: Marker[] = [];
	spans.forEach((span, index) =>
		renderSection(crew, BIG_REVEAL, index, span.startBar, markers)
	);
	const { mix, stemLoudness } = stage.session.mixdown({
		buses: {
			kick: { gainDb: -6, highpassHz: 28 },
			clap: { gainDb: 2.5, highpassHz: 300, reverb: 0.25 },
			snare: { gainDb: -8, highpassHz: 150, reverb: 0.2 },
			hats: { gainDb: -12.5 },
			toms: { gainDb: -15, reverb: 0.2 },
			crash: { gainDb: -9 },
			fx: { gainDb: -5.5 },
			saws: {
				gainDb: 10,
				highpassHz: 160,
				lowpassSweep: sawCutoff(spans),
				duck: 0.7,
				reverb: 0.2,
			},
			bass: { gainDb: 6.5, duck: 0.85 },
			lead: {
				gainDb: -3,
				highpassHz: 200,
				duck: 0.15,
				reverb: 0.2,
				delay: 0.25,
			},
			marimba: { gainDb: -13, duck: 0.15, reverb: 0.15 },
		},
		sidechain: { source: "kick", attackMs: 2, releaseMs: 150 },
		delay: {
			bpm: TIMELINE.bpm,
			leftBeats: 0.75,
			rightBeats: 0.5,
			feedback: 0.3,
			lowCutHz: 500,
			highCutHz: 6000,
			returnDb: -9,
			toReverb: 0.2,
		},
		reverb: {
			roomSize: 0.8,
			damping: 0.4,
			width: 1,
			preDelayMs: 15,
			lowCutHz: 350,
			highCutHz: 8000,
			returnDb: -5,
			duck: 0.4,
		},
	});

	return {
		title,
		timeline: TIMELINE,
		sections: spans,
		markers,
		mix,
		stemLoudness,
	};
}
