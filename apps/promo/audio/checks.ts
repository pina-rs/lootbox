/**
 * Delivery checks run on the finished files. Each returns a named pass/fail
 * with the measured value, so the report shows evidence rather than claims.
 */

import type { Stereo } from "./buffer.ts";
import type { LevelAnalysis } from "./ffmpeg.ts";

export interface Check {
	readonly file: string;
	readonly name: string;
	readonly passed: boolean;
	readonly detail: string;
}

export const MUSIC_TARGET_LUFS = -14;
export const MUSIC_TOLERANCE_LU = 0.5;
export const MUSIC_MAX_TRUE_PEAK = -1;
export const SFX_PEAK_DBTP = -3;
export const MAX_DC_OFFSET = 0.001;

function check(
	file: string,
	name: string,
	passed: boolean,
	detail: string,
): Check {
	return { file, name, passed, detail };
}

export function musicChecks(file: string, analysis: LevelAnalysis): Check[] {
	const loudness = analysis.integratedLufs;
	return [
		check(
			file,
			"loudness",
			loudness !== null &&
				Math.abs(loudness - MUSIC_TARGET_LUFS) <= MUSIC_TOLERANCE_LU,
			`${
				loudness?.toFixed(1) ?? "n/a"
			} LUFS (target ${MUSIC_TARGET_LUFS} ± ${MUSIC_TOLERANCE_LU})`,
		),
		check(
			file,
			"true peak",
			analysis.truePeakDbtp <= MUSIC_MAX_TRUE_PEAK,
			`${analysis.truePeakDbtp.toFixed(1)} dBTP (≤ ${MUSIC_MAX_TRUE_PEAK})`,
		),
		...commonChecks(file, analysis),
	];
}

export function sfxChecks(
	file: string,
	analysis: LevelAnalysis,
	isWav: boolean,
): Check[] {
	const peak = analysis.truePeakDbtp;
	const inWindow = isWav
		? Math.abs(peak - SFX_PEAK_DBTP) <= 0.5
		: peak <= MUSIC_MAX_TRUE_PEAK;
	return [
		check(
			file,
			"peak",
			inWindow,
			`${peak.toFixed(1)} dBTP (${
				isWav ? `${SFX_PEAK_DBTP} ± 0.5` : `≤ ${MUSIC_MAX_TRUE_PEAK}`
			})`,
		),
		...commonChecks(file, analysis),
	];
}

function commonChecks(file: string, analysis: LevelAnalysis): Check[] {
	return [
		check(
			file,
			"no clipping",
			analysis.maxVolumeDb < 0,
			`sample peak ${analysis.maxVolumeDb.toFixed(1)} dBFS`,
		),
		check(
			file,
			"DC offset",
			analysis.dcOffset < MAX_DC_OFFSET,
			analysis.dcOffset.toExponential(1),
		),
	];
}

/**
 * Lag (in samples) that best aligns `candidate` with `reference`, searched
 * around the first loud onset. Zero means ffmpeg kept the bar grid intact.
 */
export function alignmentLag(
	reference: Stereo,
	candidate: Stereo,
	searchSamples = 256,
): number {
	let peak = 0;
	for (const sample of reference.left) {
		peak = Math.max(peak, Math.abs(sample));
	}
	const onset = reference.left.findIndex((sample) =>
		Math.abs(sample) > peak * 0.1
	);
	const start = Math.max(searchSamples, onset - 2400);
	const end = Math.min(reference.left.length, candidate.left.length) -
		searchSamples;
	const stop = Math.min(end, start + 48_000);
	let bestLag = 0;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (let lag = -searchSamples; lag <= searchSamples; lag += 1) {
		let score = 0;
		for (let index = start; index < stop; index += 1) {
			score += reference.left[index] * candidate.left[index + lag];
		}
		if (score > bestScore) {
			bestScore = score;
			bestLag = lag;
		}
	}
	return bestLag;
}

/**
 * Largest difference between the audio that follows the loop's end and the
 * loop's own start: zero means playback wraps with no seam at all.
 */
export function loopSeamError(
	buffer: Stereo,
	start: number,
	end: number,
	windowSamples = 4800,
): number {
	let error = 0;
	for (
		let index = 0;
		index < windowSamples && end + index < buffer.left.length;
		index += 1
	) {
		error = Math.max(
			error,
			Math.abs(buffer.left[start + index] - buffer.left[end + index]),
			Math.abs(buffer.right[start + index] - buffer.right[end + index]),
		);
	}
	return error;
}
