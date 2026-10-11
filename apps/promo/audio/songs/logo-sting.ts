/**
 * "Logo Sting" — four seconds for the lootbox.pina.rs logo: an upward sparkle
 * arpeggio, the chest's "thunk" as the lid lands on beat two, then a bright
 * C major (add9) bloom with a twinkling shimmer tail (render.ts fades the
 * last 0.6 s so it closes exactly at 4.0 s).
 */
import {
	bell,
	electricPiano,
	marimba,
	type Note,
	supersaw,
	triangleBass,
} from "../instruments.ts";
import { Session } from "../mixer.ts";
import { Random } from "../random.ts";
import { chestThud } from "../sfx.ts";
import type { SongRender } from "../song.ts";
import { midi } from "../theory.ts";
import { type Marker, Timeline } from "../timeline.ts";

const TIMELINE = new Timeline(120, 4, null);
const LENGTH_SECONDS = 4;
const SPARKLE = ["G5", "C6", "E6", "G6", "C7", "E7"];
const THUNK_BEAT = 1;
const BLOOM = ["C4", "E4", "G4", "D5", "E5", "G5"];
const SHIMMER = ["C6", "D6", "E6", "G6", "A6", "C7", "D7", "E7", "G7"];

export function renderLogoSting(title: string): SongRender {
	const session = new Session(LENGTH_SECONDS);
	const random = Random.from("logo-sting/shimmer");
	const thunk = TIMELINE.straight(0, THUNK_BEAT);

	SPARKLE.forEach((name, index) => {
		const note: Note = {
			midi: midi(name),
			velocity: 0.5 + 0.07 * index,
			seconds: 0.5,
		};
		const seconds = index * 0.075;
		const pan = -0.6 + (1.2 * index) / (SPARKLE.length - 1);
		session.add("sparkle", seconds, bell(note), 1, pan);
		session.add("sparkle", seconds, marimba(note), 0.8, pan);
	});

	session.add("thunk", thunk, chestThud());

	const bloomStart = thunk + 0.02;

	for (const name of BLOOM) {
		const note: Note = { midi: midi(name), velocity: 0.85, seconds: 1.9 };
		session.add(
			"bloom",
			bloomStart,
			supersaw(note, random, {
				envelope: { attack: 0.12, decay: 0.9, sustain: 0.55, release: 1.2 },
				cutoffHz: 2600,
				filterBoost: 1.3,
				filterDecay: 0.35,
				spreadCents: 18,
			}),
		);
		session.add(
			"keys",
			bloomStart,
			electricPiano({ ...note, velocity: 0.7, seconds: 2.2 }),
		);
	}

	for (const name of ["C5", "E5", "G5", "C6"]) {
		session.add(
			"sparkle",
			bloomStart,
			marimba({ midi: midi(name), velocity: 0.9, seconds: 2 }),
			0.7,
			(midi(name) - 76) / 20,
		);
	}

	session.add(
		"bass",
		bloomStart,
		triangleBass({ midi: midi("C2"), velocity: 1, seconds: 1.8 }),
	);

	let time = bloomStart + 0.15;

	while (time < LENGTH_SECONDS - 0.7) {
		const progress = (time - bloomStart) / (LENGTH_SECONDS - bloomStart);
		const name = SHIMMER[random.integer(0, SHIMMER.length - 1)];
		session.add(
			"shimmer",
			time,
			bell({
				midi: midi(name),
				velocity: 0.55 * (1 - progress) + 0.1,
				seconds: 1,
			}),
			1,
			random.range(-0.8, 0.8),
		);
		time += 0.07 + 0.25 * progress * random.next();
	}

	const { mix, stemLoudness } = session.mixdown({
		buses: {
			sparkle: { gainDb: -11.5, reverb: 0.35, delay: 0.2 },
			thunk: { gainDb: 3, reverb: 0.1 },
			bloom: { gainDb: 0, highpassHz: 150, reverb: 0.35 },
			keys: { gainDb: -9, reverb: 0.3 },
			bass: { gainDb: -1.5 },
			shimmer: { gainDb: -13.5, highpassHz: 800, reverb: 0.6, delay: 0.3 },
		},
		delay: {
			bpm: TIMELINE.bpm,
			leftBeats: 0.75,
			rightBeats: 0.5,
			feedback: 0.35,
			lowCutHz: 800,
			highCutHz: 9000,
			returnDb: -8,
			toReverb: 0.4,
		},
		reverb: {
			roomSize: 0.88,
			damping: 0.3,
			width: 1,
			preDelayMs: 20,
			lowCutHz: 400,
			highCutHz: 10_000,
			returnDb: -3,
		},
	});
	const markers: Marker[] = [
		{ name: "sparkle", seconds: 0 },
		{ name: "thunk", seconds: thunk },
		{ name: "bloom", seconds: bloomStart },
	];

	return {
		title,
		timeline: TIMELINE,
		sections: [{ name: "sting", startBar: 0, bars: 2 }],
		markers,
		mix,
		stemLoudness,
	};
}
