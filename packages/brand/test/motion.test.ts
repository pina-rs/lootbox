import { describe, expect, it } from "vitest";

import {
	chargeFrame,
	type ChestFrame,
	type ChestReaction,
	idleFrame,
	mixFrames,
	NOPE_SECONDS,
	nopeFrame,
	REST_FRAME,
	restFrame,
	revealFrame,
	revealSeconds,
	waitFrame,
} from "../src/index.ts";

const REACTIONS: readonly ChestReaction[] = [
	"big-prize",
	"small-prize",
	"disappointed",
];

function numbers(frame: ChestFrame): number[] {
	return [
		frame.open,
		frame.look.x,
		frame.look.y,
		frame.blink,
		frame.squash.x,
		frame.squash.y,
		frame.rotate,
		frame.lift,
		frame.shift,
	];
}

/** Every value the mark and figure can draw without breaking. */
function expectDrawable(frame: ChestFrame): void {
	for (const value of numbers(frame)) expect(Number.isFinite(value)).toBe(true);

	expect(frame.open).toBeGreaterThanOrEqual(0);
	expect(frame.open).toBeLessThanOrEqual(2);
	expect(Math.abs(frame.look.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(frame.look.y)).toBeLessThanOrEqual(1);
	expect(frame.blink).toBeGreaterThanOrEqual(0);
	expect(frame.blink).toBeLessThanOrEqual(1);
	expect(frame.lift).toBeGreaterThanOrEqual(0);
	expect(frame.squash.y).toBeGreaterThan(0.7);
	expect(frame.squash.y).toBeLessThan(1.3);
}

function expectSameFrame(actual: ChestFrame, expected: ChestFrame): void {
	const pairs = numbers(actual).map((value, index) => [
		value,
		numbers(expected)[index] ?? Number.NaN,
	]);

	for (const [value, target] of pairs) {
		expect(value).toBeCloseTo(target ?? 0, 6);
	}

	expect(actual.sparkles).toBe(expected.sparkles);
}

const sample = (seconds: number, step = 1 / 30) =>
	Array.from({ length: Math.ceil(seconds / step) + 1 }, (_, i) => i * step);

describe("chest motion", () => {
	it("draws every frame of every phase", () => {
		for (const t of sample(20)) {
			expectDrawable(idleFrame(t));
			expectDrawable(waitFrame(t));
			expectDrawable(chargeFrame(t / 20, t));
		}

		for (const reaction of REACTIONS) {
			for (const t of sample(revealSeconds(reaction) + 1)) {
				expectDrawable(revealFrame(reaction, t));
				expectDrawable(restFrame(reaction, t));
			}
		}
	});

	it("lands every reveal exactly on the pose it keeps", () => {
		for (const reaction of REACTIONS) {
			expectSameFrame(
				revealFrame(reaction, revealSeconds(reaction)),
				restFrame(reaction, 0),
			);
		}
	});

	it("starts every reveal from the logo pose", () => {
		for (const reaction of REACTIONS) {
			const start = revealFrame(reaction, 0);

			expect(start.open).toBe(REST_FRAME.open);
			expect(start.lift).toBe(0);
			expect(start.rotate).toBe(0);
		}
	});

	it("holds the last reveal pose once it has played", () => {
		for (const reaction of REACTIONS) {
			expectSameFrame(
				revealFrame(reaction, revealSeconds(reaction) + 5),
				revealFrame(reaction, revealSeconds(reaction)),
			);
		}
	});

	it("tells the reactions apart at rest", () => {
		const big = restFrame("big-prize", 0);
		const sad = restFrame("disappointed", 0);

		expect(big.sparkles).toBe(true);
		expect(big.open).toBeGreaterThan(1.5);
		expect(sad.sparkles).toBe(false);
		expect(sad.open).toBeLessThan(0.7);
		expect(sad.look.y).toBeGreaterThan(0.5);
	});

	it("presses the lid shut and squashes as the hold charges", () => {
		const full = chargeFrame(1, 3);

		expect(full.open).toBeLessThan(0.45);
		expect(full.squash.y).toBeLessThan(0.9);
		expect(full.squash.x).toBeGreaterThan(1);
		expectSameFrame(chargeFrame(0, 3), idleFrame(3));
	});

	it("shakes its head only for the length of a nope", () => {
		const base = idleFrame(1);

		expect(nopeFrame(base, 0.15).rotate).not.toBe(base.rotate);
		expectSameFrame(nopeFrame(base, NOPE_SECONDS + 0.01), base);
	});

	it("blends between frames", () => {
		const from = idleFrame(0);
		const to = restFrame("big-prize", 0);

		expectSameFrame(mixFrames(from, to, 0), from);
		expectSameFrame(mixFrames(from, to, 1), to);
		expect(mixFrames(from, to, 0.5).open).toBeCloseTo(
			(from.open + to.open) / 2,
		);
	});
});
