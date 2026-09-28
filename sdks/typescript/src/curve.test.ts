import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
	affordableCurveBoxes,
	type BoxCurve,
	BoxCurveError,
	curveCost,
	MAX_CURVE_FEE_BPS,
	MIN_CURVE_INVENTORY,
	MIN_CURVE_START_PRICE,
	planBoxCurve,
	quoteCurveBuy,
	quoteCurveSell,
} from "./curve.js";

type Numeric = string | number;
type Expected =
	| Readonly<{ error: string }>
	| Readonly<{
		lamports: string;
		fee: string;
		total: string;
		soldAfter: string;
		nextPrice: string | null;
	}>;

const vectors = JSON.parse(readFileSync(
	new URL("../../../tests/vectors/box-curve.json", import.meta.url),
	"utf8",
)) as Readonly<{
	minInventory: number;
	minStartPrice: string;
	maxFeeBps: number;
	quotes: readonly Readonly<{
		name: string;
		curve: Readonly<Record<keyof BoxCurve, Numeric>>;
		side: "buy" | "sell";
		count: string;
		expected: Expected;
	}>[];
	plans: readonly Readonly<{
		name: string;
		input: Readonly<
			Record<"inventory" | "startPrice" | "endPrice" | "feeBps", Numeric>
		>;
		expected:
			| Readonly<{ error: string }>
			| Readonly<
				{ priceStep: string; endPrice: string; sellOutLamports: string }
			>;
	}>[];
}>;

const curve = (terms: Readonly<Record<keyof BoxCurve, Numeric>>): BoxCurve => ({
	inventory: BigInt(terms.inventory),
	sold: BigInt(terms.sold),
	startPrice: BigInt(terms.startPrice),
	priceStep: BigInt(terms.priceStep),
	feeBps: Number(terms.feeBps),
});

describe("box curve pricing", () => {
	it("publishes the program's bounds", () => {
		expect(MIN_CURVE_INVENTORY).toBe(BigInt(vectors.minInventory));
		expect(MIN_CURVE_START_PRICE).toBe(BigInt(vectors.minStartPrice));
		expect(MAX_CURVE_FEE_BPS).toBe(vectors.maxFeeBps);
	});

	for (const vector of vectors.quotes) {
		it(`quotes ${vector.name}`, () => {
			const terms = curve(vector.curve);
			const count = BigInt(vector.count);
			const quote = () =>
				vector.side === "buy"
					? quoteCurveBuy(terms, count)
					: quoteCurveSell(terms, count);

			if ("error" in vector.expected) {
				expect(quote).toThrow(BoxCurveError);
				return;
			}

			expect(quote()).toEqual({
				lamports: BigInt(vector.expected.lamports),
				fee: BigInt(vector.expected.fee),
				total: BigInt(vector.expected.total),
				soldAfter: BigInt(vector.expected.soldAfter),
				nextPrice: vector.expected.nextPrice === null
					? null
					: BigInt(vector.expected.nextPrice),
			});
		});
	}

	for (const vector of vectors.plans) {
		it(`plans ${vector.name}`, () => {
			const plan = () =>
				planBoxCurve({
					inventory: BigInt(vector.input.inventory),
					startPrice: BigInt(vector.input.startPrice),
					endPrice: BigInt(vector.input.endPrice),
					feeBps: Number(vector.input.feeBps),
				});

			if ("error" in vector.expected) {
				expect(plan).toThrow(BoxCurveError);
				return;
			}

			expect(plan()).toMatchObject({
				priceStep: BigInt(vector.expected.priceStep),
				endPrice: BigInt(vector.expected.endPrice),
				sellOutLamports: BigInt(vector.expected.sellOutLamports),
			});
		});
	}

	it("agrees with a position-by-position sum", () => {
		let looped = 0n;

		for (let position = 40n; position < 57n; position++) {
			looped += 123_457n + 9_871n * position;
		}

		expect(curveCost(123_457n, 9_871n, 40n, 17n)).toBe(looped);
	});

	it("finds the most boxes a budget buys, fee included", () => {
		const terms: BoxCurve = {
			inventory: 20n,
			sold: 0n,
			startPrice: 1_000_000n,
			priceStep: 50_000n,
			feeBps: 100,
		};

		// Three boxes cost 3,150,000 + 31,500.
		expect(affordableCurveBoxes(terms, 3_181_500n)).toBe(3n);
		expect(affordableCurveBoxes(terms, 3_181_499n)).toBe(2n);
		expect(affordableCurveBoxes(terms, 0n)).toBe(0n);
		expect(affordableCurveBoxes(terms, 10n ** 12n)).toBe(20n);
	});
});
