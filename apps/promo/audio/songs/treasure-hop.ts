/**
 * "Treasure Hop" — the lootbox.pina.rs brand theme. 116 BPM, C major, a light
 * 16th-note bounce. The marimba owns the hook, the square lead sings the B
 * tune, and every edit is built by re-arranging sections, never by cutting
 * audio, so each version ends on a real, ringing final chord.
 */
import {
	clap,
	crash,
	hat,
	kick,
	reverseCymbal,
	riser,
	shaker,
	tambourine,
	tom,
} from "../drums.ts";
import { marimba, pad, squareLead, triangleBass } from "../instruments.ts";
import { layout, type SongRender, Stage } from "../song.ts";
import { chord, type ChordBar, pitchAtOrAbove, voiceLead } from "../theory.ts";
import { type Marker, Timeline } from "../timeline.ts";

const TIMELINE = new Timeline(116, 4, { unit: 0.25, ratio: 0.56 });

type SectionKind = "intro" | "a" | "b" | "breakdown" | "outro" | "hit";

interface Section {
	readonly name: string;
	readonly kind: SectionKind;
	readonly bars: number;
	/** One entry per bar; a bar may split into two chords. */
	readonly chords: readonly ChordBar[];
	/** Marimba hook, one two-bar phrase per entry ("a" sections). */
	readonly hook?: readonly string[];
	/** Lead melody, one bar per entry ("b" sections). */
	readonly tune?: readonly string[];
	/** 1 = groove, 2 = four-on-the-floor with tambourine. */
	readonly energy?: 1 | 2;
	/** Square lead doubles the marimba hook. */
	readonly leadDoubles?: boolean;
	/** Seconds the final chord rings after its downbeat ("hit"/"outro"). */
	readonly tail?: number;
}

// --- Harmony ----------------------------------------------------------------
const A_CHORDS: readonly ChordBar[] = [
	["C"],
	["G/B"],
	["Am"],
	["Em/G"],
	["F"],
	["C/E"],
	["Dm7", "G7"],
	["C"],
];
const B_CHORDS: readonly ChordBar[] = [
	["F"],
	["G"],
	["Em7"],
	["Am"],
	["Dm7"],
	["G7"],
	["C"],
	["E7"],
];
const B_CHORDS_TO_HIT: readonly ChordBar[] = [...B_CHORDS.slice(0, 7), ["G7"]];
const BREAKDOWN_CHORDS: readonly ChordBar[] = [["Am"], ["F"], ["Dm7"], [
	"G7sus4",
	"G7",
]];

// --- Melody -----------------------------------------------------------------
/** The hook: a bouncing call (bar 1) and a stepwise answer (bar 2), sequenced through the progression. */
const HOOK = [
	"G4/.75 C5/.75 E5/.5 G5/.5 E5/.5 D5/.5 C5/.5 D5/.5 B4/.5 G4/.5 A4/1 B4/1.5",
	"A4/.75 C5/.75 E5/.5 A5/.5 E5/.5 D5/.5 C5/.5 B4/.5 A4/.5 G4/.5 E4/1 G4/1.5",
	"A4/.75 C5/.75 F5/.5 A5/.5 F5/.5 E5/.5 D5/.5 E5/.5 C5/.5 G4/.5 A4/1 C5/1.5",
	"D5/.75 F5/.75 A5/.5 G5/.5 F5/.5 D5/.5 B4/.5 C5/.5 E5/.5 G5/.5 E5/1 C6/1.5",
];
/** Phrase 2 re-answered over F–G7 so a four-bar hook can cadence into the button. */
const HOOK_TURNAROUND =
	"A4/.75 C5/.75 E5/.5 A5/.5 E5/.5 D5/.5 C5/.5 A4/.5 C5/.5 F5/.5 D5/1 B4/1.5";

/** The B tune: a two-bar motif stated, sequenced up a step, developed, then resolved. */
const TUNE = [
	"C5/.5 A4/.5 C5/.75 F5/1.25 E5/.5 C5/.5",
	"D5/.5 B4/.5 D5/.75 G5/1.25 F5/.5 D5/.5",
	"E5/.5 B4/.5 E5/.75 B5/1.25 A5/.5 G5/.5",
	"A5/1.5 G5/.5 E5/1 r/1",
	"D5/.5 A4/.5 D5/.75 F5/1.25 E5/.5 D5/.5",
	"D5/.5 B4/.5 D5/.75 G5/1.25 F5/.5 D5/.5",
	"E5/.5 G5/.5 C6/1.5 B5/.5 G5/1",
	"G#5/1 E5/.5 D5/.5 B4/1 G#4/1",
];
const TUNE_TO_HIT = [...TUNE.slice(0, 7), "G5/1 F5/.5 D5/.5 B4/1 G4/1"];

// --- Arrangements -------------------------------------------------------------
export const TREASURE_HOP: readonly Section[] = [
	{
		name: "intro",
		kind: "intro",
		bars: 4,
		chords: [["C"], ["Am"], ["F"], ["G7"]],
	},
	{ name: "A", kind: "a", bars: 8, chords: A_CHORDS, hook: HOOK, energy: 1 },
	{ name: "B", kind: "b", bars: 8, chords: B_CHORDS, tune: TUNE },
	{ name: "breakdown", kind: "breakdown", bars: 4, chords: BREAKDOWN_CHORDS },
	{
		name: "final A",
		kind: "a",
		bars: 8,
		chords: A_CHORDS,
		hook: HOOK,
		energy: 2,
		leadDoubles: true,
	},
	{
		name: "outro",
		kind: "outro",
		bars: 2,
		chords: [["F", "G7"], ["C"]],
		tail: 2.6,
	},
];

export const TREASURE_HOP_30: readonly Section[] = [
	{ name: "intro", kind: "intro", bars: 2, chords: [["C"], ["Am"]] },
	{ name: "B", kind: "b", bars: 8, chords: B_CHORDS_TO_HIT, tune: TUNE_TO_HIT },
	{ name: "final hit", kind: "hit", bars: 1, chords: [["C"]], tail: 2.4 },
];

export const TREASURE_HOP_15: readonly Section[] = [
	{ name: "intro", kind: "intro", bars: 2, chords: [["C"], ["G7"]] },
	{
		name: "A",
		kind: "a",
		bars: 4,
		chords: [["C"], ["G/B"], ["Am"], ["F", "G7"]],
		hook: [HOOK[0], HOOK_TURNAROUND],
		energy: 2,
		leadDoubles: true,
	},
	{ name: "button", kind: "hit", bars: 1, chords: [["C"]], tail: 1.7 },
];

// --- Parts ------------------------------------------------------------------
/** The chord sounding at `beat` of a bar. */
function chordAt(bar: ChordBar, beat: number): string {
	return bar.length === 1 || beat < 2 ? bar[0] : bar[1];
}

/** Keeps each harmonic part's previous voicing so changes voice-lead smoothly. */
class Voicings {
	readonly #previous = new Map<string, number[]>();

	voice(part: string, symbol: string, low: number, high: number): number[] {
		const voicing = voiceLead(this.#previous.get(part) ?? null, chord(symbol), {
			low,
			high,
		});
		this.#previous.set(part, voicing);

		return voicing;
	}
}

function bassNote(symbol: string): number {
	return pitchAtOrAbove(chord(symbol).bass, 38);
}

/**
 * The bass pickup into the next chord: a chromatic neighbour of `target` on
 * the side the line arrives from, or the current fifth when the change is
 * already a step away (so the walk never stalls on a repeated note).
 */
function approach(from: number, target: number): number {
	if (Math.abs(target - from) <= 2) {
		return from + 7 <= 50 ? from + 7 : from - 5;
	}

	return target > from ? target - 1 : target + 1;
}

class Band {
	readonly stage: Stage;
	readonly voicings = new Voicings();

	constructor(stage: Stage) {
		this.stage = stage;
	}

	marimbaArpeggio(bar: number, chords: ChordBar, velocity: number): void {
		const pattern = [0, 1, 2, 3, 1, 2, 3, 2];

		for (let step = 0; step < 8; step += 1) {
			const beat = step / 2;
			const voicing = this.voicings.voice("arp", chordAt(chords, beat), 55, 72);
			const tones = voicing.length >= 4
				? voicing
				: [...voicing, voicing[0] + 12];
			const accent = step % 4 === 0 ? 1 : step % 2 === 0 ? 0.8 : 0.66;
			const note = {
				midi: tones[pattern[step]],
				velocity: this.stage.velocity(velocity * accent),
				seconds: 0.5,
			};
			this.stage.add(
				"marimba",
				bar,
				beat,
				marimba(note),
				1,
				(pattern[step] - 1.5) * 0.2,
			);
		}
	}

	marimbaHook(bar: number, text: string, gain = 1): void {
		this.stage.phrase("marimba", bar, text, (note) => marimba(note), {
			gain,
			legato: 1,
		});
	}

	marimbaComp(bar: number, chords: ChordBar): void {
		for (const beat of [0.5, 1.5, 2.5, 3.5]) {
			const voicing = this.voicings.voice(
				"comp",
				chordAt(chords, beat),
				60,
				76,
			);
			voicing.forEach((midi, index) => {
				const note = {
					midi,
					velocity: this.stage.velocity(0.5 + index * 0.05),
					seconds: 0.11,
				};
				this.stage.add(
					"marimba",
					bar,
					beat + index * 0.012,
					marimba(note),
					0.8,
					(index - 1) * 0.35,
				);
			});
		}
	}

	lead(bar: number, text: string, gain = 1): void {
		this.stage.phrase("lead", bar, text, (note, previous) => {
			const slide = previous !== null &&
				Math.abs(previous.midi - note.midi) <= 5 && previous.length >= 0.75;
			return squareLead(note, { glideFrom: slide ? previous.midi : undefined });
		}, { gain, legato: 0.92 });
	}

	bass(bar: number, chords: ChordBar, next: string, held: boolean): void {
		const halves = chords.length === 1
			? [{ symbol: chords[0], start: 0, beats: 4 }]
			: chords.map((symbol, index) => ({ symbol, start: index * 2, beats: 2 }));
		halves.forEach((half, index) => {
			const root = bassNote(half.symbol);
			const following = index + 1 < halves.length
				? bassNote(halves[index + 1].symbol)
				: bassNote(next);
			const play = (
				beat: number,
				midi: number,
				beats: number,
				velocity: number,
			): void => {
				const note = {
					midi,
					velocity: this.stage.velocity(velocity),
					seconds: this.stage.beats(beats),
				};
				this.stage.add("bass", bar, half.start + beat, triangleBass(note));
			};
			if (held) {
				play(0, root, half.beats * 0.95, 0.5);
				return;
			}
			if (half.beats === 4) {
				play(0, root, 0.7, 0.95);
				play(0.75, root, 0.2, 0.55);
				play(1.5, root + 12, 0.4, 0.7);
				play(2, root, 0.7, 0.9);
				play(2.75, root + 12, 0.2, 0.6);
				play(3.5, approach(root, following), 0.45, 0.75);
			} else {
				play(0, root, 0.7, 0.95);
				play(0.75, root + 12, 0.2, 0.6);
				play(1.5, approach(root, following), 0.45, 0.75);
			}
		});
	}

	pad(bar: number, chords: ChordBar): void {
		const halves = chords.length === 1 ? [0] : [0, 2];

		for (const start of halves) {
			const beats = chords.length === 1 ? 4 : 2;
			for (
				const midi of this.voicings.voice(
					"pad",
					chords[start === 0 ? 0 : 1],
					52,
					67,
				)
			) {
				const note = {
					midi,
					velocity: 0.55,
					seconds: this.stage.beats(beats) * 0.98,
				};
				this.stage.add(
					"pad",
					bar,
					start,
					pad(note, this.stage.random.fork(`pad-${bar}-${start}-${midi}`)),
					1,
					0,
					false,
				);
			}
		}
	}

	// --- Drums --------------------------------------------------------------
	kick(bar: number, beat: number, velocity = 0.95): void {
		this.stage.add(
			"kick",
			bar,
			beat,
			kick(this.stage.random, this.stage.velocity(velocity), {
				startHz: 170,
				endHz: 52,
				decay: 0.24,
			}),
			1,
			0,
			false,
		);
	}

	clap(bar: number, beat: number, velocity = 0.9): void {
		this.stage.add(
			"clap",
			bar,
			beat,
			clap(this.stage.random, this.stage.velocity(velocity)),
		);
	}

	shakers(bar: number, level: number): void {
		for (let step = 0; step < 16; step += 1) {
			const accent = step % 4 === 2 ? 1 : step % 2 === 0 ? 0.55 : 0.7;
			this.stage.add(
				"shaker",
				bar,
				step / 4,
				shaker(this.stage.random, this.stage.velocity(accent * level)),
				1,
				0.35,
			);
		}
	}

	tambourine(bar: number): void {
		for (const beat of [0.5, 1.5, 2.5, 3.5]) {
			this.stage.add(
				"tambourine",
				bar,
				beat,
				tambourine(this.stage.random, this.stage.velocity(0.8)),
				1,
				-0.4,
			);
		}
	}

	crash(bar: number, velocity = 0.9): void {
		this.stage.add(
			"crash",
			bar,
			0,
			crash(this.stage.random, velocity),
			1,
			0,
			false,
		);
	}

	tomFill(bar: number, fromBeat: number): void {
		const pitches = [220, 196, 165, 147, 131, 110, 98, 87];
		const steps = (4 - fromBeat) * 4;

		for (let step = 0; step < steps; step += 1) {
			const hz = pitches[Math.floor((step / steps) * pitches.length)];
			this.stage.add(
				"toms",
				bar,
				fromBeat + step / 4,
				tom(
					this.stage.random,
					hz,
					this.stage.velocity(0.7 + 0.3 * (step / steps)),
				),
				1,
				0.5 - step / steps,
			);
		}
	}

	groove(bar: number, barInSection: number, bars: number, energy: 1 | 2): void {
		const phraseEnd = barInSection % 4 === 3;
		const sectionEnd = barInSection === bars - 1;
		const kicks = energy === 2
			? [0, 1, 2, 3]
			: barInSection % 2 === 0
			? [0, 1.5, 2]
			: [0, 2, 2.75];

		for (const beat of kicks) {
			if (!(sectionEnd && beat >= 3)) {
				this.kick(bar, beat);
			}
		}

		this.clap(bar, 1);
		this.clap(bar, 3);
		this.shakers(bar, energy === 2 ? 1 : 0.8);

		if (energy === 2) {
			this.tambourine(bar);
			this.stage.add(
				"hats",
				bar,
				3.75,
				hat(this.stage.random, 0.5, true),
				1,
				0.3,
			);
		}

		if (phraseEnd && !sectionEnd) {
			this.kick(bar, 3.5, 0.7);
			this.clap(bar, 3.75, 0.55);
		}

		if (sectionEnd) {
			this.tomFill(bar, 3);
		}
	}

	/** The last chord: everything lands together and rings out. */
	finalHit(bar: number): void {
		const voicing = [48, 52, 55, 60, 64, 67, 72];
		voicing.forEach((midi, index) => {
			this.stage.add(
				"marimba",
				bar,
				index * 0.01,
				marimba({ midi, velocity: 0.95, seconds: 3 }),
				0.8,
				(index / (voicing.length - 1) - 0.5) * 0.8,
				false,
			);
		});
		this.stage.add(
			"lead",
			bar,
			0,
			squareLead({ midi: 72, velocity: 0.85, seconds: 1.1 }),
			0.9,
			0,
			false,
		);
		this.stage.add(
			"bass",
			bar,
			0,
			triangleBass({ midi: 48, velocity: 1, seconds: 1.3 }),
			1,
			0,
			false,
		);

		for (const midi of [55, 60, 64, 67]) {
			this.stage.add(
				"pad",
				bar,
				0,
				pad(
					{ midi, velocity: 0.6, seconds: 1.4 },
					this.stage.random.fork(`hit-pad-${midi}`),
				),
				1,
				0,
				false,
			);
		}

		this.kick(bar, 0, 1);
		this.clap(bar, 0, 0.8);
		this.crash(bar, 1);
		this.stage.add(
			"hats",
			bar,
			0,
			hat(this.stage.random, 0.6, true),
			1,
			0.3,
			false,
		);
	}
}

// --- Sections -------------------------------------------------------------
function nextChord(
	sections: readonly Section[],
	sectionIndex: number,
	barInSection: number,
): string {
	const section = sections[sectionIndex];

	if (barInSection + 1 < section.chords.length) {
		return section.chords[barInSection + 1][0];
	}

	return sections[sectionIndex + 1]?.chords[0][0] ?? "C";
}

function renderSection(
	band: Band,
	sections: readonly Section[],
	sectionIndex: number,
	startBar: number,
	markers: Marker[],
): void {
	const section = sections[sectionIndex];
	const stage = band.stage;
	const drumsEnter = section.kind === "a" || section.kind === "b" ||
		section.kind === "outro";

	if (sectionIndex > 0 && drumsEnter) {
		band.crash(startBar);
	}

	for (let offset = 0; offset < section.bars; offset += 1) {
		const bar = startBar + offset;
		const chords = section.chords[offset];
		const next = nextChord(sections, sectionIndex, offset);
		switch (section.kind) {
			case "intro":
				band.marimbaArpeggio(bar, chords, 0.55 + 0.1 * (offset / section.bars));
				break;
			case "a": {
				const energy = section.energy ?? 1;

				if (offset % 2 === 0 && section.hook !== undefined) {
					const text = section.hook[(offset / 2) % section.hook.length];
					band.marimbaHook(bar, text);

					if (section.leadDoubles === true) {
						band.lead(bar, text, 0.75);
					}
				}

				band.bass(bar, chords, next, false);
				band.groove(bar, offset, section.bars, energy);

				if (energy === 2) {
					band.pad(bar, chords);
				}

				break;
			}
			case "b":
				band.lead(bar, section.tune?.[offset] ?? "r/4");
				band.marimbaComp(bar, chords);
				band.bass(bar, chords, next, false);
				band.pad(bar, chords);
				band.groove(bar, offset, section.bars, 2);
				break;
			case "breakdown":
				band.marimbaArpeggio(bar, chords, 0.6);
				band.bass(bar, chords, next, true);
				band.pad(bar, chords);

				if (offset === section.bars - 2) {
					stage.add(
						"fx",
						bar,
						0,
						riser(stage.random, 0.8, stage.timeline.barSeconds * 2),
						1,
						0,
						false,
					);
				}

				if (offset === section.bars - 1) {
					for (let step = 0; step < 12; step += 1) {
						const beat = step < 4 ? step * 0.5 : 2 + (step - 4) * 0.25;
						band.clap(bar, beat, 0.35 + 0.6 * (step / 11));
					}

					stage.add(
						"fx",
						bar,
						2,
						reverseCymbal(stage.random, 0.8, stage.beats(2)),
						1,
						0,
						false,
					);
				}

				break;
			case "outro":
				if (offset === 0) {
					band.marimbaHook(
						bar,
						"C6/.5 A5/.5 F5/.5 A5/.5 B5/.5 G5/.5 D5/.5 B4/.5",
					);
					band.bass(bar, chords, "C", false);
					band.groove(bar, 3, 4, 2);
				} else {
					band.finalHit(bar);
					markers.push({
						name: "final hit",
						seconds: stage.timeline.straight(bar, 0),
					});
				}

				break;
			case "hit":
				band.finalHit(bar);
				markers.push({
					name: section.name,
					seconds: stage.timeline.straight(bar, 0),
				});
				break;
		}
	}
}

export function renderTreasureHop(
	title: string,
	sections: readonly Section[],
): SongRender {
	const { spans, totalBars } = layout(sections);
	const tail = sections[sections.length - 1].tail ?? 2;
	const endOfLastDownbeat = TIMELINE.straight(totalBars - 1, 0);
	const stage = new Stage(
		TIMELINE,
		endOfLastDownbeat + tail,
		`treasure-hop/${title}`,
		{ timingMs: 5, velocitySpread: 0.07 },
	);
	const band = new Band(stage);
	const markers: Marker[] = [];
	spans.forEach((span, index) =>
		renderSection(band, sections, index, span.startBar, markers)
	);

	const breakdown = spans.find((span) => span.name === "breakdown");
	const sweep = breakdown === undefined
		? undefined
		: (seconds: number): number => {
			const start = TIMELINE.straight(breakdown.startBar, 0);
			const end = TIMELINE.straight(breakdown.startBar + breakdown.bars, 0);
			if (seconds < start || seconds >= end) {
				return 20_000;
			}
			return 350 * (14_000 / 350) ** ((seconds - start) / (end - start)) ** 1.6;
		};

	const { mix, stemLoudness } = stage.session.mixdown({
		buses: {
			kick: { gainDb: -8, highpassHz: 28 },
			clap: { gainDb: 1.5, reverb: 0.3, highpassHz: 250 },
			shaker: { gainDb: -13.5 },
			tambourine: { gainDb: -7.5 },
			hats: { gainDb: -11 },
			toms: { gainDb: -12, reverb: 0.2 },
			crash: { gainDb: -11.5 },
			fx: { gainDb: -9.5, highpassHz: 200 },
			marimba: {
				gainDb: -3,
				reverb: 0.22,
				delay: 0.1,
				lowpassSweep: sweep,
				eq: [{ kind: "peaking", frequency: 320, q: 1, gainDb: -2 }],
				duck: 0.08,
			},
			lead: { gainDb: 0, reverb: 0.28, delay: 0.2, highpassHz: 180 },
			bass: { gainDb: 0.5, duck: 0.35 },
			pad: { gainDb: -9, reverb: 0.4, highpassHz: 180, duck: 0.35 },
		},
		sidechain: { source: "kick", attackMs: 2, releaseMs: 140 },
		delay: {
			bpm: TIMELINE.bpm,
			leftBeats: 0.75,
			rightBeats: 0.5,
			feedback: 0.3,
			lowCutHz: 400,
			highCutHz: 5000,
			returnDb: -8,
			toReverb: 0.25,
		},
		reverb: {
			roomSize: 0.72,
			damping: 0.45,
			width: 1,
			preDelayMs: 18,
			lowCutHz: 280,
			highCutHz: 7500,
			returnDb: -3,
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
