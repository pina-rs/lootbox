/**
 * "Vault Lo-Fi" — a chill bed for talking-head voice-over. 84 BPM with a
 * heavy 16th swing, FM keys on ii–V–I–vi colours in F major, a round sub,
 * dusty drums, vinyl crackle and tape wow. The keys and snare are carved out
 * around 2–3 kHz so a voice sits on top without fighting for presence.
 */

import { SAMPLE_RATE, toSamples } from "../buffer.ts";
import { hat, kick, rim, snare, vinylCrackle } from "../drums.ts";
import type { BiquadSpec } from "../dsp.ts";
import { tapeWow } from "../effects.ts";
import { bell, electricPiano, subBass } from "../instruments.ts";
import type { MixResult } from "../mixer.ts";
import { layout, type SongRender, Stage } from "../song.ts";
import {
	chord,
	type ChordBar,
	nearestPitch,
	pitchAtOrAbove,
	voiceLead,
} from "../theory.ts";
import { type Marker, type SectionSpan, Timeline } from "../timeline.ts";

const TIMELINE = new Timeline(84, 4, { unit: 0.25, ratio: 0.64 });

type SectionKind = "intro" | "core" | "breakdown" | "ending";

interface Section {
	readonly name: string;
	readonly kind: SectionKind;
	readonly bars: number;
	readonly chords: readonly ChordBar[];
	/** Keys melody, one bar per entry. */
	readonly melody?: readonly string[];
	/** Random-stream label; equal labels render sample-identical sections. */
	readonly seed: string;
}

/** ii–V–I–vi, IV–V–iii–VI7 (the D7b9 pulls straight back to Gm9, so it loops). */
const CORE_CHORDS: readonly ChordBar[] = [
	["Gm9"],
	["C13"],
	["Fmaj9"],
	["Dm9"],
	["Bbmaj9"],
	["C13"],
	["Am7"],
	["D7b9"],
];

/** A lazy, behind-the-beat line that leans on each chord's colour tone (9ths, 13ths, the b9). */
const MELODY = [
	"r/1.5 D5/.25 F5/.25 A5/1 G5/.5 F5/.5",
	"E5/1.5 D5/.5 r/2",
	"r/.5 A4/.5 C5/.5 E5/.5 G5/1.5 r/.5",
	"F5/.75 E5/.25 D5/1 r/2",
	"r/1.5 C5/.25 D5/.25 F5/1 A5/1",
	"G5/1.5 E5/.5 r/2",
	"r/.5 E5/.5 G5/.5 A5/.5 C6/1 B5/.5 G5/.5",
	"A5/1 F#5/.5 Eb5/.5 D5/1 r/1",
];

export const VAULT_LOFI: readonly Section[] = [
	{
		name: "intro",
		kind: "intro",
		bars: 4,
		chords: CORE_CHORDS.slice(4),
		seed: "intro",
	},
	{ name: "core", kind: "core", bars: 8, chords: CORE_CHORDS, seed: "core" },
	{
		name: "core + melody",
		kind: "core",
		bars: 8,
		chords: CORE_CHORDS,
		melody: MELODY,
		seed: "core-melody",
	},
	{
		name: "breakdown",
		kind: "breakdown",
		bars: 4,
		chords: CORE_CHORDS.slice(0, 4),
		seed: "breakdown",
	},
	{
		name: "ending",
		kind: "ending",
		bars: 2,
		chords: [["Gm9", "C13"], ["F6add9"]],
		seed: "ending",
	},
];

/** Three identical cores; only the middle one is kept, so reverb and delay tails wrap around. */
const LOOP_SECTIONS: readonly Section[] = [0, 1, 2].map((index) => ({
	name: `core ${index + 1}`,
	kind: "core",
	bars: 8,
	chords: CORE_CHORDS,
	seed: "loop",
}));

const ENDING_TAIL_SECONDS = 3.2;

class Combo {
	readonly stage: Stage;
	#voicing: number[] | null = null;

	constructor(stage: Stage) {
		this.stage = stage;
	}

	/** Strummed keys: two hits per bar, bottom-to-top roll, pattern alternating by bar. */
	keys(
		bar: number,
		chords: ChordBar,
		barInSection: number,
		velocity: number,
	): void {
		const hits = chords.length === 2
			? [[0, 1.8], [2, 1.8]]
			: barInSection % 2 === 0
			? [[0, 1.6], [2.5, 1.3]]
			: [[0, 2.3], [3.25, 0.6]];
		for (const [beat, length] of hits) {
			const symbol = chords.length === 2 ? chords[beat < 2 ? 0 : 1] : chords[0];
			this.#voicing = voiceLead(this.#voicing, chord(symbol), {
				low: 53,
				high: 70,
			});
			this.#voicing.forEach((midi, index) => {
				const note = {
					midi,
					velocity: this.stage.velocity(velocity * (0.82 + index * 0.06)),
					seconds: this.stage.beats(length),
				};
				this.stage.add(
					"keys",
					bar,
					beat + index * 0.03,
					electricPiano(note, 0.75),
				);
			});
		}
	}

	melody(bar: number, text: string): void {
		this.stage.phrase("melody", bar, text, (note) => electricPiano(note, 0.6), {
			legato: 0.95,
			velocity: 0.85,
		});
	}

	bass(bar: number, chords: ChordBar, next: string, sparse: boolean): void {
		const rootOf = (symbol: string): number =>
			pitchAtOrAbove(chord(symbol).bass, 31);
		const play = (
			beat: number,
			midi: number,
			beats: number,
			velocity: number,
			glideFrom?: number,
		): void => {
			const note = {
				midi,
				velocity: this.stage.velocity(velocity),
				seconds: this.stage.beats(beats),
			};
			this.stage.add("bass", bar, beat, subBass(note, glideFrom));
		};
		if (chords.length === 2) {
			play(0, rootOf(chords[0]), 1.8, 0.9);
			play(2, rootOf(chords[1]), 1.8, 0.9);
			return;
		}
		const root = rootOf(chords[0]);
		const target = rootOf(next);
		if (sparse) {
			play(0, root, 3.6, 0.85);
			return;
		}
		play(0, root, 1.4, 0.95);
		play(2.5, root + 12, 0.45, 0.6);
		const fifth = nearestPitch((chord(chords[0]).root + 7) % 12, target);
		play(3.25, fifth, 0.6, 0.7, root + 12);
	}

	drums(bar: number, barInSection: number, bars: number, busy: boolean): void {
		const random = this.stage.random;
		const kicks = barInSection % 2 === 0
			? [[0, 0.95], [1.75, 0.5], [2.5, 0.85]]
			: [[0, 0.95], [0.75, 0.45], [2.5, 0.8], [3.25, 0.55]];
		for (const [beat, velocity] of kicks) {
			this.stage.add(
				"kick",
				bar,
				beat,
				kick(random, this.stage.velocity(velocity), {
					startHz: 120,
					endHz: 47,
					decay: 0.3,
					click: 0.08,
					drive: 1.3,
				}),
			);
		}
		for (const beat of [1, 3]) {
			this.stage.add(
				"snare",
				bar,
				beat + 0.02,
				snare(random, this.stage.velocity(0.85), {
					tuneHz: 178,
					decay: 0.16,
					snappy: 0.55,
				}),
			);
		}
		if (barInSection % 4 === 3 || random.chance(0.3)) {
			this.stage.add(
				"snare",
				bar,
				3.75,
				snare(random, this.stage.velocity(0.22), {
					tuneHz: 178,
					decay: 0.1,
					snappy: 0.5,
				}),
			);
		}
		for (let step = 0; step < 8; step += 1) {
			const velocity = step % 2 === 1 ? 0.62 : 0.4;
			this.stage.add(
				"hats",
				bar,
				step / 2,
				hat(random, this.stage.velocity(velocity), false),
				1,
				0.25,
			);
			if (busy && step % 2 === 1 && random.chance(0.35)) {
				this.stage.add(
					"hats",
					bar,
					step / 2 + 0.25,
					hat(random, this.stage.velocity(0.28), false),
					1,
					0.25,
				);
			}
		}
		if (busy && barInSection % 2 === 1) {
			this.stage.add(
				"hats",
				bar,
				3.5,
				hat(random, this.stage.velocity(0.4), true),
				1,
				0.25,
			);
		}
		if (barInSection === bars - 1) {
			this.stage.add(
				"snare",
				bar,
				3.5,
				snare(random, this.stage.velocity(0.35), {
					tuneHz: 178,
					decay: 0.1,
					snappy: 0.5,
				}),
			);
		}
	}

	rims(bar: number): void {
		for (const beat of [1, 3]) {
			this.stage.add(
				"rim",
				bar,
				beat + 0.02,
				rim(this.stage.random, this.stage.velocity(0.7)),
				1,
				-0.15,
			);
		}
		for (let step = 0; step < 8; step += 1) {
			this.stage.add(
				"hats",
				bar,
				step / 2,
				hat(
					this.stage.random,
					this.stage.velocity(step % 2 === 1 ? 0.45 : 0.28),
					false,
				),
				1,
				0.25,
			);
		}
	}

	crackle(bar: number, bars: number, extraSeconds = 0): void {
		const seconds = this.stage.timeline.barSeconds * bars + extraSeconds;
		this.stage.session.add(
			"vinyl",
			this.stage.timeline.straight(bar, 0),
			vinylCrackle(this.stage.random.fork("crackle"), seconds, 7),
		);
	}

	finalChord(bar: number, symbol: string): void {
		this.#voicing = voiceLead(this.#voicing, chord(symbol), {
			low: 53,
			high: 70,
		});
		this.#voicing.forEach((midi, index) => {
			this.stage.add(
				"keys",
				bar,
				index * 0.04,
				electricPiano(
					{ midi, velocity: 0.6 + index * 0.04, seconds: 2.6 },
					0.75,
				),
			);
		});
		this.stage.add(
			"melody",
			bar,
			0.3,
			bell({ midi: 77, velocity: 0.35, seconds: 2 }),
			0.6,
			0.3,
		);
		this.stage.add(
			"bass",
			bar,
			0,
			subBass({
				midi: pitchAtOrAbove(chord(symbol).bass, 31),
				velocity: 0.9,
				seconds: 2.4,
			}),
		);
		this.stage.add(
			"kick",
			bar,
			0,
			kick(this.stage.random, 0.8, {
				startHz: 120,
				endHz: 47,
				decay: 0.3,
				click: 0.08,
				drive: 1.3,
			}),
		);
	}
}

function renderSection(
	combo: Combo,
	section: Section,
	next: Section | undefined,
	startBar: number,
	markers: Marker[],
): void {
	combo.stage.reseed(`vault-lofi/${section.seed}`);
	const nextChordAt = (
		offset: number,
	): string => (offset + 1 < section.bars
		? section.chords[offset + 1][0]
		: next?.chords[0][0] ?? "F6add9");
	const tail = section.kind === "ending" ? ENDING_TAIL_SECONDS : 0;
	combo.crackle(startBar, section.bars, tail);
	for (let offset = 0; offset < section.bars; offset += 1) {
		const bar = startBar + offset;
		const chords = section.chords[offset];
		switch (section.kind) {
			case "intro":
				combo.keys(bar, chords, offset, 0.55);
				if (offset >= 2) {
					combo.bass(bar, chords, nextChordAt(offset), true);
				}
				if (offset === section.bars - 1) {
					combo.stage.add(
						"snare",
						bar,
						3.75,
						snare(combo.stage.random, 0.3, {
							tuneHz: 178,
							decay: 0.1,
							snappy: 0.5,
						}),
					);
				}
				break;
			case "core":
				combo.keys(
					bar,
					chords,
					offset,
					section.melody === undefined ? 0.62 : 0.55,
				);
				combo.bass(bar, chords, nextChordAt(offset), false);
				combo.drums(bar, offset, section.bars, section.melody !== undefined);
				if (section.melody !== undefined) {
					combo.melody(bar, section.melody[offset]);
				}
				break;
			case "breakdown":
				combo.keys(bar, chords, offset, 0.5);
				combo.bass(bar, chords, nextChordAt(offset), true);
				if (offset < section.bars - 1) {
					combo.rims(bar);
				} else {
					combo.drums(bar, offset, section.bars, false);
				}
				break;
			case "ending":
				if (offset === 0) {
					combo.keys(bar, chords, offset, 0.55);
					combo.bass(bar, chords, "F", false);
					combo.drums(bar, 3, 4, false);
				} else {
					combo.finalChord(bar, chords[0]);
					markers.push({
						name: "final chord",
						seconds: combo.stage.timeline.straight(bar, 0),
					});
				}
				break;
		}
	}
}

/** Keys filter: dark "next room" intro that opens up, and a duller breakdown. */
function keysCutoff(
	spans: readonly SectionSpan[],
): (seconds: number) => number {
	const intro = spans.find((span) => span.name === "intro");
	const breakdown = spans.find((span) => span.name === "breakdown");
	return (seconds) => {
		if (intro !== undefined) {
			const end = TIMELINE.straight(intro.startBar + intro.bars, 0);
			if (seconds < end) {
				return 700 * (20_000 / 700) ** (seconds / end) ** 3;
			}
		}
		if (breakdown !== undefined) {
			const start = TIMELINE.straight(breakdown.startBar, 0);
			const end = TIMELINE.straight(breakdown.startBar + breakdown.bars, 0);
			if (seconds >= start && seconds < end) {
				const reopen = Math.max(
					0,
					(seconds - (end - TIMELINE.barSeconds)) / TIMELINE.barSeconds,
				);
				return 1800 * (20_000 / 1800) ** (reopen ** 2);
			}
		}
		return 20_000;
	};
}

function mix(
	stage: Stage,
	spans: readonly SectionSpan[],
	automateKeys: boolean,
): MixResult {
	const timeline = stage.timeline;
	const wow = {
		wowHz: 1 / timeline.barSeconds,
		wowMs: 1.3,
		flutterHz: 16 / timeline.barSeconds,
		flutterMs: 0.05,
	};
	const vocalPocket: BiquadSpec = {
		kind: "peaking",
		frequency: 2400,
		q: 0.8,
		gainDb: -4,
	};
	return stage.session.mixdown({
		buses: {
			kick: { gainDb: -3, highpassHz: 30, lowpassHz: 5000, drive: 1.4 },
			snare: {
				gainDb: 2.5,
				lowpassHz: 7000,
				eq: [vocalPocket],
				drive: 1.5,
				reverb: 0.18,
			},
			rim: { gainDb: 6, lowpassHz: 6000, eq: [vocalPocket], reverb: 0.2 },
			hats: { gainDb: 0, lowpassHz: 9500 },
			keys: {
				gainDb: -3,
				highpassHz: 120,
				lowpassHz: 4500,
				eq: [vocalPocket, {
					kind: "peaking",
					frequency: 350,
					q: 0.9,
					gainDb: -1.5,
				}],
				lowpassSweep: automateKeys ? keysCutoff(spans) : undefined,
				insert: (buffer) => tapeWow(buffer, wow),
				duck: 0.15,
				reverb: 0.2,
				delay: 0.05,
			},
			melody: {
				gainDb: -5,
				highpassHz: 250,
				lowpassHz: 5000,
				eq: [vocalPocket],
				insert: (buffer) => tapeWow(buffer, wow),
				reverb: 0.3,
				delay: 0.2,
			},
			bass: { gainDb: -6.5, lowpassHz: 900, duck: 0.25 },
			vinyl: { gainDb: 15 },
		},
		sidechain: { source: "kick", attackMs: 4, releaseMs: 180 },
		delay: {
			bpm: timeline.bpm,
			leftBeats: 0.75,
			rightBeats: 1.5,
			feedback: 0.35,
			lowCutHz: 500,
			highCutHz: 3000,
			returnDb: -8,
			toReverb: 0.3,
		},
		reverb: {
			roomSize: 0.8,
			damping: 0.6,
			width: 0.9,
			preDelayMs: 25,
			lowCutHz: 300,
			highCutHz: 4500,
			returnDb: -4,
		},
	});
}

export function renderVaultLofi(title: string): SongRender {
	const { spans, totalBars } = layout(VAULT_LOFI);
	const stage = new Stage(
		TIMELINE,
		TIMELINE.straight(totalBars - 1, 0) + ENDING_TAIL_SECONDS,
		title,
		{ timingMs: 5, velocitySpread: 0.08 },
	);
	const combo = new Combo(stage);
	const markers: Marker[] = [];
	spans.forEach((span, index) =>
		renderSection(
			combo,
			VAULT_LOFI[index],
			VAULT_LOFI[index + 1],
			span.startBar,
			markers,
		)
	);
	const core = spans[1];
	markers.push({
		name: "loop start",
		seconds: TIMELINE.straight(core.startBar, 0),
	}, {
		name: "loop end",
		seconds: TIMELINE.straight(core.startBar + core.bars, 0),
	});
	const { mix: buffer, stemLoudness } = mix(stage, spans, true);
	return {
		title,
		timeline: TIMELINE,
		sections: spans,
		markers,
		mix: buffer,
		stemLoudness,
	};
}

/**
 * The 8-bar core as a seamless loop: render three identical passes and keep
 * the middle one, so reverb and delay tails wrap around. Eight bars at 84 BPM
 * are 1,097,142.86 samples; the loop is rendered at the tempo that makes them
 * exactly 1,097,143 (a 0.00005 BPM nudge) so every pass lands on the same
 * sample offsets and the copies are bit-identical.
 */
export function renderVaultLofiLoop(title: string): SongRender {
	const { spans, totalBars } = layout(LOOP_SECTIONS);
	const loopSamples = toSamples(TIMELINE.barSeconds * spans[1].bars);
	const loopTimeline = new Timeline(
		(60 * TIMELINE.beatsPerBar * spans[1].bars * SAMPLE_RATE) / loopSamples,
		TIMELINE.beatsPerBar,
		TIMELINE.swing,
	);
	const stage = new Stage(
		loopTimeline,
		loopTimeline.straight(totalBars, 0),
		title,
		{ timingMs: 5, velocitySpread: 0.08 },
	);
	const combo = new Combo(stage);
	spans.forEach((span, index) =>
		renderSection(
			combo,
			LOOP_SECTIONS[index],
			LOOP_SECTIONS[index + 1] ?? LOOP_SECTIONS[0],
			span.startBar,
			[],
		)
	);
	const { mix: buffer, stemLoudness } = mix(stage, spans, false);
	const kept = spans[1];
	return {
		title,
		timeline: TIMELINE,
		sections: [{ name: "core (loop)", startBar: 0, bars: kept.bars }],
		markers: [],
		mix: buffer,
		stemLoudness,
		keep: { start: loopSamples, end: loopSamples * 2 },
	};
}
