/**
 * Builds `out/report.md`: measured loudness and levels for every delivered
 * file, the JS master bus and loudnorm decisions, per-bus balance, and the
 * pass/fail list from `checks.ts`.
 */

import type { Check } from "./checks.ts";
import type { LevelAnalysis, LoudnormReport } from "./ffmpeg.ts";
import type { MasterResult } from "./mastering.ts";

export interface MusicSummary {
	readonly name: string;
	readonly wav: LevelAnalysis;
	/** Null for loops, which ship as WAV only. */
	readonly m4a: LevelAnalysis | null;
	readonly master: Omit<MasterResult, "buffer">;
	readonly loudnorm: LoudnormReport;
	readonly alignmentLag: number;
	readonly stems: Readonly<Record<string, number>>;
	readonly loopSeamDb?: number;
}

export interface SfxSummary {
	readonly name: string;
	readonly wav: LevelAnalysis;
	readonly m4a: LevelAnalysis;
}

const fixed = (
	value: number | null,
	digits = 1,
): string => (value === null || !Number.isFinite(value)
	? "—"
	: value.toFixed(digits));

function levelRow(file: string, analysis: LevelAnalysis): string {
	return `| ${file} | ${fixed(analysis.durationSeconds, 2)} s | ${
		fixed(analysis.integratedLufs)
	} | ${fixed(analysis.truePeakDbtp)} | ${fixed(analysis.maxVolumeDb)} | ${
		fixed(analysis.loudnessRange)
	} | ${analysis.dcOffset.toExponential(1)} |`;
}

const LEVEL_HEADER = [
	"| File | Duration | Integrated (LUFS) | True peak (dBTP) | Sample peak (dBFS) | LRA (LU) | DC offset |",
	"|---|---|---|---|---|---|---|",
];

export function buildReport(
	music: readonly MusicSummary[],
	sfx: readonly SfxSummary[],
	checks: readonly Check[],
): string {
	const failures = checks.filter((item) => !item.passed);
	const lines: string[] = [
		"# lootbox.so promo audio — render report",
		"",
		"Measured by ffmpeg (`ebur128=peak=true`, `volumedetect`, `astats`) on the delivered files.",
		"Music is mastered to -14 LUFS integrated with true peak ≤ -1 dBTP; SFX are peak-normalised to -3 dBTP.",
		"",
		`**Checks: ${checks.length - failures.length}/${checks.length} passed.**`,
		"",
		"## Music",
		"",
		...LEVEL_HEADER,
		...music.flatMap((
			item,
		) => [
			levelRow(`music/${item.name}.wav`, item.wav),
			...(item.m4a === null
				? []
				: [levelRow(`music/${item.name}.m4a`, item.m4a)]),
		]),
		"",
		"## Sound effects",
		"",
		...LEVEL_HEADER,
		...sfx.flatMap((
			item,
		) => [
			levelRow(`sfx/${item.name}.wav`, item.wav),
			levelRow(`sfx/${item.name}.m4a`, item.m4a),
		]),
		"",
		"Integrated loudness is undefined (—) for files shorter than one 400 ms gating block.",
		"",
		"## Mastering chain",
		"",
		"The JS master bus (DC high-pass, gain, 5 ms look-ahead true-peak limiter at -2 dBTP) lands each mix on -14 LUFS;",
		"ffmpeg's two-pass `loudnorm` then applies the final trim. `linear` means loudnorm only changed gain.",
		"",
		"| Track | Bus gain (dB) | Deepest limiting (dB) | Time limited > 1 dB | loudnorm input I / TP | loudnorm mode | Grid offset (samples) | Loop seam |",
		"|---|---|---|---|---|---|---|---|",
		...music.map(
			(item) =>
				`| ${item.name} | ${fixed(item.master.gainDb)} | ${
					fixed(item.master.maxReductionDb)
				} | ${
					(item.master.limitedShare * 100).toFixed(1)
				} % | ${item.loudnorm.input_i} / ${item.loudnorm.input_tp} | ${item.loudnorm.normalization_type} | ${item.alignmentLag} | ${
					item.loopSeamDb === undefined ? "—" : `${fixed(item.loopSeamDb)} dBFS`
				} |`,
		),
		"",
		"## Mix balance",
		"",
		"Integrated loudness of each bus after its inserts and ducking (gated, so sparse parts read at their playing level).",
		"",
		...music.flatMap((item) => [
			`**${item.name}**: ${
				Object.entries(item.stems)
					.map(([bus, loudness]) => `${bus} ${fixed(loudness)}`)
					.join(" · ")
			}`,
			"",
		]),
		"## Checks",
		"",
		failures.length === 0 ? "All checks passed." : "Failures:",
		"",
		...(failures.length === 0
			? []
			: failures.map((item) =>
				`- ${item.file}: ${item.name} — ${item.detail}`
			)),
		"",
		"| File | Check | Result | Measured |",
		"|---|---|---|---|",
		...checks.map((item) =>
			`| ${item.file} | ${item.name} | ${
				item.passed ? "pass" : "FAIL"
			} | ${item.detail} |`
		),
		"",
	];
	return lines.join("\n");
}
