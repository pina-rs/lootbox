/**
 * Minimal RIFF/WAVE codec for 24-bit stereo PCM, written by hand so the render
 * has no dependencies. The reader exists to verify ffmpeg's mastered output
 * (alignment, DC, clipping) with the same code that wrote the pre-master.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SAMPLE_RATE, type Stereo } from "./buffer.ts";

const BYTES_PER_SAMPLE = 3;
const CHANNELS = 2;
const MAX_24 = 8_388_607;

/**
 * Encodes to 24-bit PCM. Samples outside [-1, 1] would wrap, so they are a
 * programming error upstream (the limiter guarantees headroom) and throw.
 */
export function encodeWav(buffer: Stereo): Buffer {
	const frames = buffer.left.length;
	const dataBytes = frames * CHANNELS * BYTES_PER_SAMPLE;
	const out = Buffer.alloc(44 + dataBytes);
	out.write("RIFF", 0, "ascii");
	out.writeUInt32LE(36 + dataBytes, 4);
	out.write("WAVE", 8, "ascii");
	out.write("fmt ", 12, "ascii");
	out.writeUInt32LE(16, 16);
	out.writeUInt16LE(1, 20);

	out.writeUInt16LE(CHANNELS, 22);
	out.writeUInt32LE(SAMPLE_RATE, 24);
	out.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28);
	out.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
	out.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34);
	out.write("data", 36, "ascii");
	out.writeUInt32LE(dataBytes, 40);

	let position = 44;

	for (let frame = 0; frame < frames; frame += 1) {
		for (const channel of [buffer.left, buffer.right]) {
			const sample = channel[frame];

			if (!(Math.abs(sample) <= 1)) {
				throw new Error(
					`Sample ${sample} at frame ${frame} is outside [-1, 1]`,
				);
			}

			out.writeIntLE(
				Math.max(-MAX_24 - 1, Math.min(MAX_24, Math.round(sample * MAX_24))),
				position,
				3,
			);
			position += BYTES_PER_SAMPLE;
		}
	}

	return out;
}

export function writeWav(path: string, buffer: Stereo): void {
	writeFileSync(path, encodeWav(buffer));
}

/** Reads a 24-bit stereo PCM WAV (the only format this project writes). */
export function readWav(path: string): Stereo {
	const bytes = readFileSync(path);
	if (
		bytes.toString("ascii", 0, 4) !== "RIFF" ||
		bytes.toString("ascii", 8, 12) !== "WAVE"
	) {
		throw new Error(`${path} is not a RIFF/WAVE file`);
	}
	let offset = 12;
	let format: { channels: number; bits: number; rate: number } | null = null;

	while (offset + 8 <= bytes.length) {
		const id = bytes.toString("ascii", offset, offset + 4);
		const size = bytes.readUInt32LE(offset + 4);
		const body = offset + 8;

		if (id === "fmt ") {
			format = {
				channels: bytes.readUInt16LE(body + 2),
				rate: bytes.readUInt32LE(body + 4),
				bits: bytes.readUInt16LE(body + 14),
			};
		}

		if (id === "data") {
			if (
				format === null || format.channels !== CHANNELS || format.bits !== 24 ||
				format.rate !== SAMPLE_RATE
			) {
				throw new Error(
					`${path}: expected 48 kHz 24-bit stereo, got ${
						JSON.stringify(format)
					}`,
				);
			}
			const frames = Math.floor(
				Math.min(size, bytes.length - body) / (CHANNELS * BYTES_PER_SAMPLE),
			);
			const left = new Float32Array(frames);
			const right = new Float32Array(frames);
			let position = body;

			for (let frame = 0; frame < frames; frame += 1) {
				left[frame] = bytes.readIntLE(position, 3) / (MAX_24 + 1);
				right[frame] = bytes.readIntLE(position + 3, 3) / (MAX_24 + 1);
				position += CHANNELS * BYTES_PER_SAMPLE;
			}

			return { left, right };
		}

		offset = body + size + (size % 2);
	}

	throw new Error(`${path} has no data chunk`);
}
