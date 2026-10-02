/**
 * ffmpeg/ffprobe wrappers: two-pass loudnorm mastering, AAC export, loudness
 * and level analysis, and waveform pictures. Every call is synchronous and
 * throws with ffmpeg's own error output if the process fails.
 */

import { spawnSync } from "node:child_process";

function run(
	command: "ffmpeg" | "ffprobe",
	args: readonly string[],
): { stdout: string; stderr: string } {
	const result = spawnSync(
		command,
		command === "ffmpeg" ? ["-hide_banner", "-nostdin", ...args] : args,
		{
			encoding: "utf8",
			maxBuffer: 256 * 1024 * 1024,
		},
	);
	if (result.error !== undefined) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} exited with ${result.status}:\n${
				result.stderr.slice(-4000)
			}`,
		);
	}
	return { stdout: result.stdout, stderr: result.stderr };
}

export interface LoudnormTarget {
	readonly integratedLufs: number;
	readonly truePeakDbtp: number;
	/** Loudness-range ceiling; set high so loudnorm never refuses linear mode on LRA. */
	readonly loudnessRange: number;
}

/** The fields of loudnorm's JSON summary this project uses (ffmpeg prints them as strings). */
export interface LoudnormReport {
	readonly input_i: string;
	readonly input_tp: string;
	readonly input_lra: string;
	readonly input_thresh: string;
	readonly output_i: string;
	readonly output_tp: string;
	readonly normalization_type: string;
	readonly target_offset: string;
}

function parseLoudnorm(stderr: string): LoudnormReport {
	const start = stderr.lastIndexOf("{");
	const end = stderr.lastIndexOf("}");
	if (start < 0 || end < start) {
		throw new Error(`loudnorm printed no JSON:\n${stderr.slice(-2000)}`);
	}
	const parsed: unknown = JSON.parse(stderr.slice(start, end + 1));
	const field = (key: keyof LoudnormReport): string => {
		const value: unknown = typeof parsed === "object" && parsed !== null
			? Reflect.get(parsed, key)
			: undefined;
		if (typeof value !== "string") {
			throw new Error(`loudnorm JSON is missing "${key}"`);
		}
		return value;
	};
	return {
		input_i: field("input_i"),
		input_tp: field("input_tp"),
		input_lra: field("input_lra"),
		input_thresh: field("input_thresh"),
		output_i: field("output_i"),
		output_tp: field("output_tp"),
		normalization_type: field("normalization_type"),
		target_offset: field("target_offset"),
	};
}

function loudnormFilter(target: LoudnormTarget): string {
	return `loudnorm=I=${target.integratedLufs}:TP=${target.truePeakDbtp}:LRA=${target.loudnessRange}`;
}

/**
 * loudnorm does not flush its final analysis window, so on short files it
 * under-reads integrated loudness (a 4 s sting read 1.25 LU low against
 * ebur128). Three seconds of trailing silence sit below the -70 LUFS gate,
 * so they cost nothing in the measurement but let the whole file be counted.
 */
const MEASUREMENT_PAD = "apad=pad_dur=3";

/**
 * EBU R128 two-pass loudnorm: pass one measures, pass two applies the
 * measured values with `linear=true` and trims the padding back off.
 * Returns both reports; the second's `normalization_type` confirms whether
 * ffmpeg stayed linear (pure gain).
 */
export function loudnormTwoPass(
	input: string,
	output: string,
	frames: number,
	target: LoudnormTarget,
): { first: LoudnormReport; second: LoudnormReport } {
	const first = parseLoudnorm(
		run("ffmpeg", [
			"-i",
			input,
			"-af",
			`${MEASUREMENT_PAD},${loudnormFilter(target)}:print_format=json`,
			"-f",
			"null",
			"-",
		]).stderr,
	);
	const measured = [
		`measured_I=${first.input_i}`,
		`measured_TP=${first.input_tp}`,
		`measured_LRA=${first.input_lra}`,
		`measured_thresh=${first.input_thresh}`,
		`offset=${first.target_offset}`,
		"linear=true",
		"print_format=json",
	].join(":");
	const second = parseLoudnorm(
		run("ffmpeg", [
			"-y",
			"-i",
			input,
			"-af",
			`${MEASUREMENT_PAD},${
				loudnormFilter(target)
			}:${measured},aresample=48000,atrim=end_sample=${frames}`,
			"-ar",
			"48000",
			"-c:a",
			"pcm_s24le",
			output,
		]).stderr,
	);
	return { first, second };
}

export function encodeAac(input: string, output: string): void {
	run("ffmpeg", [
		"-y",
		"-i",
		input,
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		"-movflags",
		"+faststart",
		output,
	]);
}

export interface LevelAnalysis {
	readonly durationSeconds: number;
	/** Integrated loudness, or null when the file is too short to gate (< 400 ms). */
	readonly integratedLufs: number | null;
	readonly loudnessRange: number | null;
	readonly truePeakDbtp: number;
	readonly maxVolumeDb: number;
	readonly meanVolumeDb: number;
	/** Largest per-channel DC offset reported by astats (linear, full scale = 1). */
	readonly dcOffset: number;
}

function number(pattern: RegExp, text: string, label: string): number {
	const match = pattern.exec(text);
	if (match === null) {
		throw new Error(`Could not read ${label} from ffmpeg output`);
	}
	return match[1] === "-inf" ? Number.NEGATIVE_INFINITY : Number(match[1]);
}

export function analyze(path: string): LevelAnalysis {
	const duration = Number(
		run("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"csv=p=0",
			path,
		]).stdout.trim(),
	);
	const ebur =
		run("ffmpeg", ["-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"])
			.stderr;
	const summary = ebur.slice(ebur.lastIndexOf("Summary:"));
	const integrated = number(
		/I:\s+(-?[\d.]+|-inf) LUFS/,
		summary,
		"integrated loudness",
	);
	const volume =
		run("ffmpeg", ["-i", path, "-af", "volumedetect", "-f", "null", "-"])
			.stderr;
	const stats = run("ffmpeg", [
		"-i",
		path,
		"-af",
		"astats=measure_overall=none",
		"-f",
		"null",
		"-",
	]).stderr;
	const offsets = [...stats.matchAll(/DC offset:\s+(-?[\d.e+-]+)/g)].map((
		match,
	) => Math.abs(Number(match[1])));
	const gated = duration >= 0.4 && integrated > -70;
	return {
		durationSeconds: duration,
		integratedLufs: gated ? integrated : null,
		loudnessRange: gated
			? number(/LRA:\s+([\d.]+) LU/, summary, "loudness range")
			: null,
		truePeakDbtp: number(/Peak:\s+(-?[\d.]+|-inf) dBFS/, summary, "true peak"),
		maxVolumeDb: number(
			/max_volume:\s+(-?[\d.]+|-inf) dB/,
			volume,
			"max volume",
		),
		meanVolumeDb: number(
			/mean_volume:\s+(-?[\d.]+|-inf) dB/,
			volume,
			"mean volume",
		),
		dcOffset: offsets.length === 0 ? Number.NaN : Math.max(...offsets),
	};
}

/** Brand-coloured waveform (teal left, coral right) on warm ivory paper. */
export function waveform(input: string, output: string): void {
	const size = "1600x360";
	const graph = [
		`[0:a]showwavespic=s=${size}:split_channels=1:colors=0x17857D|0xE0604F:scale=sqrt[wave]`,
		`color=c=0xFBF4E6:s=${size}[paper]`,
		"[paper][wave]overlay=format=auto",
	].join(";");
	run("ffmpeg", [
		"-y",
		"-i",
		input,
		"-filter_complex",
		graph,
		"-frames:v",
		"1",
		output,
	]);
}
