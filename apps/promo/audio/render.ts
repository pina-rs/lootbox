/**
 * Entry point: `node render.ts` regenerates every deliverable into `out/`.
 * Pass track or SFX names to render a subset (the report then covers only
 * those): `node render.ts treasure-hop ui-pop`.
 *
 *   synthesis (JS) -> JS master bus -> 24-bit pre-master (.work/)
 *   -> ffmpeg two-pass loudnorm -> out/music/*.wav -> AAC .m4a
 *   -> cue sheet JSON, waveform PNG, analysis, checks, out/report.md
 */

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	fadeStereoEdges,
	gainToDb,
	SAMPLE_RATE,
	sliceStereo,
} from "./buffer.ts";
import {
	alignmentLag,
	type Check,
	loopSeamError,
	musicChecks,
	SFX_PEAK_DBTP,
	sfxChecks,
} from "./checks.ts";
import {
	analyze,
	encodeAac,
	type LoudnormTarget,
	loudnormTwoPass,
	waveform,
} from "./ffmpeg.ts";
import { master, MUSIC_MASTER, normalizeTruePeak } from "./mastering.ts";
import { buildReport, type MusicSummary, type SfxSummary } from "./report.ts";
import { SOUND_EFFECTS, type SoundEffect } from "./sfx.ts";
import type { SongRender } from "./song.ts";
import { renderBigReveal } from "./songs/big-reveal.ts";
import { renderLogoSting } from "./songs/logo-sting.ts";
import {
	renderTreasureHop,
	TREASURE_HOP,
	TREASURE_HOP_15,
	TREASURE_HOP_30,
} from "./songs/treasure-hop.ts";
import { renderVaultLofi, renderVaultLofiLoop } from "./songs/vault-lofi.ts";
import { cueSheet } from "./timeline.ts";
import { readWav, writeWav } from "./wav.ts";

const ROOT = import.meta.dirname;
const OUT = join(ROOT, "out");
const WORK = join(ROOT, ".work");
const DIRECTORIES = {
	music: join(OUT, "music"),
	sfx: join(OUT, "sfx"),
	waveforms: join(OUT, "waveforms"),
};
/** Where Remotion reads audio: the AAC copies and cue sheets, not the WAV masters. */
const PUBLIC = join(ROOT, "..", "public", "audio");

/** loudnorm's TP target sits 0.5 dB under the delivery limit, leaving room for AAC overshoot. */
const LOUDNORM: LoudnormTarget = {
	integratedLufs: MUSIC_MASTER.targetLufs,
	truePeakDbtp: -1.5,
	loudnessRange: 20,
};
/** Final fade on non-looping music so reverb tails never stop abruptly. */
const END_FADE_SECONDS = 0.6;

interface MusicJob {
	readonly name: string;
	readonly render: () => SongRender;
}

const MUSIC: readonly MusicJob[] = [
	{
		name: "treasure-hop",
		render: () => renderTreasureHop("treasure-hop", TREASURE_HOP),
	},
	{
		name: "treasure-hop-30",
		render: () => renderTreasureHop("treasure-hop-30", TREASURE_HOP_30),
	},
	{
		name: "treasure-hop-15",
		render: () => renderTreasureHop("treasure-hop-15", TREASURE_HOP_15),
	},
	{ name: "vault-lofi", render: () => renderVaultLofi("vault-lofi") },
	{
		name: "vault-lofi-loop",
		render: () => renderVaultLofiLoop("vault-lofi-loop"),
	},
	{ name: "big-reveal", render: () => renderBigReveal("big-reveal") },
	{ name: "logo-sting", render: () => renderLogoSting("logo-sting") },
];

function renderMusic(job: MusicJob, checks: Check[]): MusicSummary {
	const song = job.render();
	if (song.keep === undefined) {
		fadeStereoEdges(song.mix, 0, END_FADE_SECONDS);
	}
	const mastered = master(song.mix, MUSIC_MASTER);
	const { buffer: masteredBuffer, ...masterStats } = mastered;
	const delivered = song.keep === undefined
		? masteredBuffer
		: sliceStereo(masteredBuffer, song.keep.start, song.keep.end);
	const loopSeamDb = song.keep === undefined
		? undefined
		: gainToDb(loopSeamError(masteredBuffer, song.keep.start, song.keep.end));

	const premaster = join(WORK, `${job.name}.premaster.wav`);
	const wav = join(DIRECTORIES.music, `${job.name}.wav`);
	writeWav(premaster, delivered);
	const loudnorm = loudnormTwoPass(
		premaster,
		wav,
		delivered.left.length,
		LOUDNORM,
	);
	// A loop starts mid-signal, which AAC can neither loop sample-accurately nor
	// start cleanly (the native encoder overshot to -0.3 dBTP), so loops ship as WAV only.
	const m4a = song.keep === undefined
		? join(DIRECTORIES.music, `${job.name}.m4a`)
		: null;
	if (m4a !== null) {
		encodeAac(wav, m4a);
	}
	waveform(wav, join(DIRECTORIES.waveforms, `${job.name}.png`));

	const final = readWav(wav);
	const lag = alignmentLag(delivered, final);
	const cue = cueSheet(
		song.title,
		song.timeline,
		song.sections,
		song.markers,
		final.left.length / SAMPLE_RATE,
	);
	writeFileSync(
		join(DIRECTORIES.music, `${job.name}.json`),
		`${JSON.stringify(cue, null, 2)}\n`,
	);

	const summary: MusicSummary = {
		name: job.name,
		wav: analyze(wav),
		m4a: m4a === null ? null : analyze(m4a),
		master: masterStats,
		loudnorm: loudnorm.second,
		alignmentLag: lag,
		stems: song.stemLoudness,
		loopSeamDb,
	};
	checks.push(
		...musicChecks(`music/${job.name}.wav`, summary.wav),
		...(summary.m4a === null
			? []
			: musicChecks(`music/${job.name}.m4a`, summary.m4a)),
		{
			file: `music/${job.name}.wav`,
			name: "loudnorm linear",
			passed: loudnorm.second.normalization_type === "linear",
			detail: loudnorm.second.normalization_type,
		},
		{
			file: `music/${job.name}.wav`,
			name: "bar grid kept",
			passed: lag === 0,
			detail: `${lag} samples`,
		},
		{
			file: `music/${job.name}.wav`,
			name: "length kept",
			passed: final.left.length === delivered.left.length,
			detail: `${final.left.length} of ${delivered.left.length} frames`,
		},
		{
			file: `music/${job.name}.json`,
			name: "cue duration",
			passed:
				Math.abs(cue.durationSeconds - summary.wav.durationSeconds) < 0.01,
			detail: `${cue.durationSeconds} s vs ${
				summary.wav.durationSeconds.toFixed(4)
			} s`,
		},
	);
	if (loopSeamDb !== undefined) {
		checks.push({
			file: `music/${job.name}.wav`,
			name: "seamless loop",
			passed: loopSeamDb < -60,
			detail: `${loopSeamDb.toFixed(1)} dBFS max seam difference`,
		});
	}
	return summary;
}

function renderSfx(effect: SoundEffect, checks: Check[]): SfxSummary {
	const name = effect.name;
	const buffer = fadeStereoEdges(
		normalizeTruePeak(effect.render(), SFX_PEAK_DBTP),
		0,
		0.005,
	);
	const wav = join(DIRECTORIES.sfx, `${name}.wav`);
	const m4a = join(DIRECTORIES.sfx, `${name}.m4a`);
	writeWav(wav, buffer);
	encodeAac(wav, m4a);
	const summary: SfxSummary = { name, wav: analyze(wav), m4a: analyze(m4a) };
	checks.push(
		...sfxChecks(`sfx/${name}.wav`, summary.wav, true),
		...sfxChecks(`sfx/${name}.m4a`, summary.m4a, false),
	);
	return summary;
}

function main(): void {
	const only = new Set(process.argv.slice(2));
	const selected = (name: string): boolean => only.size === 0 || only.has(name);
	const known = new Set([
		...MUSIC.map((job) => job.name),
		...SOUND_EFFECTS.map((effect) => effect.name),
	]);
	for (const name of only) {
		if (!known.has(name)) {
			throw new Error(
				`Unknown track or effect "${name}". Known: ${[...known].join(", ")}`,
			);
		}
	}
	if (only.size === 0) {
		rmSync(OUT, { recursive: true, force: true });
	}
	for (const directory of [WORK, ...Object.values(DIRECTORIES)]) {
		mkdirSync(directory, { recursive: true });
	}

	const checks: Check[] = [];
	const music: MusicSummary[] = [];
	for (const job of MUSIC.filter((item) => selected(item.name))) {
		const started = performance.now();
		music.push(renderMusic(job, checks));
		const item = music[music.length - 1];
		console.log(
			`music  ${job.name.padEnd(16)} ${
				item.wav.durationSeconds.toFixed(2).padStart(6)
			} s  ${item.wav.integratedLufs?.toFixed(1)} LUFS  ${
				item.wav.truePeakDbtp.toFixed(1)
			} dBTP  (${((performance.now() - started) / 1000).toFixed(1)} s)`,
		);
	}
	const sfx: SfxSummary[] = [];
	for (const effect of SOUND_EFFECTS.filter((item) => selected(item.name))) {
		sfx.push(renderSfx(effect, checks));
		const item = sfx[sfx.length - 1];
		console.log(
			`sfx    ${effect.name.padEnd(16)} ${
				item.wav.durationSeconds.toFixed(2).padStart(6)
			} s  peak ${item.wav.truePeakDbtp.toFixed(1)} dBTP`,
		);
	}

	writeFileSync(join(OUT, "report.md"), buildReport(music, sfx, checks));
	const failures = checks.filter((item) => !item.passed);
	if (failures.length === 0) {
		publish(music.map((item) => item.name), sfx.map((item) => item.name));
	}
	console.log(
		`\n${
			checks.length - failures.length
		}/${checks.length} checks passed. Report: ${join(OUT, "report.md")}`,
	);
	for (const failure of failures) {
		console.error(`FAIL ${failure.file}: ${failure.name} — ${failure.detail}`);
	}
	process.exitCode = failures.length === 0 ? 0 : 1;
}

/** Copy passing deliverables into the Remotion app's public folder. */
function publish(
	musicNames: readonly string[],
	sfxNames: readonly string[],
): void {
	for (const kind of ["music", "sfx"] as const) {
		mkdirSync(join(PUBLIC, kind), { recursive: true });
	}
	for (const name of musicNames) {
		for (const extension of [".m4a", ".json"]) {
			const source = join(DIRECTORIES.music, name + extension);
			// The seamless loop ships as WAV only; Remotion uses the full bed instead.
			if (existsSync(source) && name !== "vault-lofi-loop") {
				copyFileSync(source, join(PUBLIC, "music", name + extension));
			}
		}
	}
	for (const name of sfxNames) {
		copyFileSync(
			join(DIRECTORIES.sfx, `${name}.m4a`),
			join(PUBLIC, "sfx", `${name}.m4a`),
		);
	}
	console.log(`Published to ${PUBLIC}`);
}

main();
