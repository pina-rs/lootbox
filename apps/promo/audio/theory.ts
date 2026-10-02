/**
 * Music theory helpers: note names, chord symbols, automatic voice leading and
 * a compact phrase notation so melodies read like sheet music in the song files.
 */

const LETTERS: Readonly<Record<string, number>> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
};

/** "C4" -> 60, "Bb3" -> 58, "F#5" -> 78. */
export function midi(name: string): number {
	const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
	if (match === null) {
		throw new Error(`Bad note name: ${name}`);
	}
	const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
	return 12 * (Number(match[3]) + 1) + LETTERS[match[1]] + accidental;
}

function pitchClass(name: string): number {
	return (midi(`${name}4`) % 12 + 12) % 12;
}

/** Upper-structure intervals per chord quality (rootless where jazz would be). */
const QUALITIES: Readonly<Record<string, readonly number[]>> = {
	"": [0, 4, 7],
	m: [0, 3, 7],
	"7": [0, 4, 7, 10],
	maj7: [0, 4, 7, 11],
	m7: [0, 3, 7, 10],
	sus4: [0, 5, 7],
	"7sus4": [0, 5, 7, 10],
	add9: [0, 4, 7, 14],
	"6add9": [4, 7, 9, 14],
	maj9: [4, 7, 11, 14],
	m9: [3, 7, 10, 14],
	"9": [4, 7, 10, 14],
	"13": [4, 10, 14, 21],
	"7b9": [4, 7, 10, 13],
};

export interface Chord {
	readonly symbol: string;
	/** Pitch class of the chord root. */
	readonly root: number;
	/** Pitch class the bass should play (differs for slash chords). */
	readonly bass: number;
	/** Pitch classes of the upper structure, in the quality's order. */
	readonly tones: readonly number[];
}

/** Parses "Am", "G/B", "Fmaj9", "D7b9", "G7sus4". */
export function chord(symbol: string): Chord {
	const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol);
	const intervals = match === null ? undefined : QUALITIES[match[2]];
	if (match === null || intervals === undefined) {
		throw new Error(`Unknown chord symbol: ${symbol}`);
	}
	const root = pitchClass(match[1]);
	const bass = match[3] === undefined ? root : pitchClass(match[3]);
	const tones = [
		...new Set(intervals.map((interval) => (root + interval) % 12)),
	];
	return { symbol, root, bass, tones };
}

/** The MIDI note of pitch class `pc` nearest to `near`. */
export function nearestPitch(pc: number, near: number): number {
	const base = near - (((near % 12) - pc + 12) % 12);
	return near - base > 6 ? base + 12 : base;
}

/** Lowest MIDI note of pitch class `pc` that is >= `floor`. */
export function pitchAtOrAbove(pc: number, floor: number): number {
	return floor + ((pc - (floor % 12) + 12) % 12);
}

export interface VoicingRange {
	readonly low: number;
	readonly high: number;
}

/**
 * Chooses the voicing of `target` (one note per chord tone, inside `range`)
 * that moves the least from `previous`, the way a keyboard player's hands
 * would. Close semitone clusters in the low register are penalised as mud.
 */
export function voiceLead(
	previous: readonly number[] | null,
	target: Chord,
	range: VoicingRange,
): number[] {
	const options = target.tones.map((pc) => {
		const notes: number[] = [];
		for (
			let note = pitchAtOrAbove(pc, range.low);
			note <= range.high;
			note += 12
		) {
			notes.push(note);
		}
		return notes;
	});
	let best: number[] = [];
	let bestCost = Number.POSITIVE_INFINITY;
	const centre = (range.low + range.high) / 2;
	const visit = (depth: number, picked: number[]): void => {
		if (depth === options.length) {
			const voicing = [...picked].sort((a, b) => a - b);
			let cost = 0;
			for (let index = 1; index < voicing.length; index += 1) {
				const gap = voicing[index] - voicing[index - 1];
				if (gap === 0) {
					return;
				}
				if (gap <= 2 && voicing[index - 1] < 55) {
					cost += 6;
				} else if (gap === 1 && voicing[index - 1] < 60) {
					cost += 4;
				}
			}
			if (voicing[voicing.length - 1] - voicing[0] > 16) {
				cost += 3;
			}
			if (previous === null || previous.length === 0) {
				cost += Math.abs(
					voicing.reduce((sum, note) => sum + note, 0) / voicing.length -
						centre,
				);
			} else if (previous.length === voicing.length) {
				cost += voicing.reduce(
					(sum, note, index) => sum + Math.abs(note - previous[index]),
					0,
				);
			} else {
				const mean = (notes: readonly number[]): number =>
					notes.reduce((sum, note) => sum + note, 0) / notes.length;
				cost += Math.abs(mean(voicing) - mean(previous)) * voicing.length;
			}
			if (cost < bestCost) {
				bestCost = cost;
				best = voicing;
			}
			return;
		}
		for (const note of options[depth]) {
			picked.push(note);
			visit(depth + 1, picked);
			picked.pop();
		}
	};
	visit(0, []);
	if (best.length === 0) {
		throw new Error(
			`No voicing for ${target.symbol} in ${range.low}..${range.high}`,
		);
	}
	return best;
}

/** One bar of harmony: one or two chords splitting the bar evenly. */
export type ChordBar = readonly string[];

export interface PhraseNote {
	/** Beat offset from the phrase start. */
	readonly beat: number;
	/** Length in beats. */
	readonly length: number;
	readonly midi: number;
	readonly velocity: number;
}

/**
 * Parses "E5/.5 G5/.25 r/1 C6/1.5@0.9": pitch/length-in-beats[@velocity],
 * with `r` for rests. Keeps melodies legible and diffable in the song files.
 */
export function phrase(text: string, defaultVelocity = 0.8): PhraseNote[] {
	const notes: PhraseNote[] = [];
	let beat = 0;
	for (const token of text.trim().split(/\s+/)) {
		const match = /^([A-Gr][#b]?-?\d?)\/([\d.]+)(?:@([\d.]+))?$/.exec(token);
		if (match === null) {
			throw new Error(`Bad phrase token: ${token}`);
		}
		const length = Number(match[2]);
		if (match[1] !== "r") {
			notes.push({
				beat,
				length,
				midi: midi(match[1]),
				velocity: match[3] === undefined ? defaultVelocity : Number(match[3]),
			});
		}
		beat += length;
	}
	return notes;
}
