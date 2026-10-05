/**
 * Box-curve pricing, matching the program's `buyCurveBoxes` and
 * `sellCurveBoxes` to the lamport. The box at sold position `k` costs
 * `startPrice + priceStep * k`. Pinned by `tests/vectors/box-curve.json`,
 * which the program and the Rust and Dart SDKs share.
 */
const U64_MAX = (1n << 64n) - 1n;

/** Fewest boxes a curve may sell. */
export const MIN_CURVE_INVENTORY = 20n;
/** Cheapest allowed first box, in lamports. */
export const MIN_CURVE_START_PRICE = 100_000n;
/** Highest creator fee on each buy and sell, in basis points. */
export const MAX_CURVE_FEE_BPS = 500;

/** Terms the program would reject, or a trade outside the inventory. */
export class BoxCurveError extends Error {
	override readonly name = "BoxCurveError";
}

/** The terms and live position of a curve. */
export type BoxCurve = Readonly<{
	inventory: bigint;
	sold: bigint;
	startPrice: bigint;
	priceStep: bigint;
	feeBps: number;
}>;

/** A priced buy or sell. */
export type CurveQuote = Readonly<{
	/** The curve price of the boxes moved. */
	lamports: bigint;
	fee: bigint;
	/** What the buyer pays (`lamports + fee`) or the seller receives (`lamports - fee`). */
	total: bigint;
	soldAfter: bigint;
	/** The next box's price after the trade, or `null` once sold out. */
	nextPrice: bigint | null;
}>;

/** Terms for a new curve, derived from a first and last price. */
export type BoxCurvePlan = Readonly<{
	inventory: bigint;
	startPrice: bigint;
	/** Whole lamports per box; the end price floors to a whole step. */
	priceStep: bigint;
	/** The last box's price after flooring. */
	endPrice: bigint;
	feeBps: number;
	/** What the creator receives when every box sells, before fees. */
	sellOutLamports: bigint;
}>;

function checked(value: bigint): bigint {
	if (value < 0n || value > U64_MAX) {
		throw new BoxCurveError("curve amount is outside the u64 range");
	}

	return value;
}

/** Price of the box at sold position `position`. */
export function curvePrice(
	startPrice: bigint,
	priceStep: bigint,
	position: bigint,
): bigint {
	return checked(startPrice + priceStep * position);
}

/** Total price of `count` consecutive positions starting at `from`. */
export function curveCost(
	startPrice: bigint,
	priceStep: bigint,
	from: bigint,
	count: bigint,
): bigint {
	if (count === 0n) return 0n;

	return checked(
		count * startPrice + priceStep * (count * (2n * from + count - 1n) / 2n),
	);
}

/** Creator fee on a curve amount, rounded up to the next lamport. */
export function curveFee(lamports: bigint, feeBps: number): bigint {
	return (lamports * BigInt(feeBps) + 9_999n) / 10_000n;
}

function nextPrice(curve: BoxCurve, soldAfter: bigint): bigint | null {
	return soldAfter === curve.inventory
		? null
		: curvePrice(curve.startPrice, curve.priceStep, soldAfter);
}

/** Prices a buy of `count` boxes. */
export function quoteCurveBuy(curve: BoxCurve, count: bigint): CurveQuote {
	const soldAfter = curve.sold + count;

	if (count <= 0n || soldAfter > curve.inventory) {
		throw new BoxCurveError(
			`cannot buy ${count} of the ${curve.inventory - curve.sold} boxes left`,
		);
	}

	const lamports = curveCost(
		curve.startPrice,
		curve.priceStep,
		curve.sold,
		count,
	);
	const fee = curveFee(lamports, curve.feeBps);

	return {
		lamports,
		fee,
		total: checked(lamports + fee),
		soldAfter,
		nextPrice: nextPrice(curve, soldAfter),
	};
}

/** Prices a sale of `count` boxes back to the curve. */
export function quoteCurveSell(curve: BoxCurve, count: bigint): CurveQuote {
	const soldAfter = curve.sold - count;

	if (count <= 0n || soldAfter < 0n) {
		throw new BoxCurveError(
			`cannot sell ${count} boxes back when ${curve.sold} are sold`,
		);
	}

	const lamports = curveCost(
		curve.startPrice,
		curve.priceStep,
		soldAfter,
		count,
	);
	const fee = curveFee(lamports, curve.feeBps);

	return {
		lamports,
		fee,
		total: lamports - fee,
		soldAfter,
		nextPrice: nextPrice(curve, soldAfter),
	};
}

/**
 * Plans a curve from the first and last box prices, mirroring the checks in
 * `openBoxCurve`.
 */
export function planBoxCurve(
	input: Readonly<{
		inventory: bigint;
		startPrice: bigint;
		endPrice: bigint;
		feeBps: number;
	}>,
): BoxCurvePlan {
	const { inventory, startPrice, endPrice, feeBps } = input;

	if (inventory < MIN_CURVE_INVENTORY) {
		throw new BoxCurveError(
			`a curve needs at least ${MIN_CURVE_INVENTORY} boxes to find a price`,
		);
	}

	if (startPrice < MIN_CURVE_START_PRICE) {
		throw new BoxCurveError(
			`the first box must cost at least ${MIN_CURVE_START_PRICE} lamports`,
		);
	}

	if (endPrice < startPrice) {
		throw new BoxCurveError("the last box cannot cost less than the first");
	}

	if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_CURVE_FEE_BPS) {
		throw new BoxCurveError(
			`the fee must be 0 to ${MAX_CURVE_FEE_BPS} basis points`,
		);
	}

	const priceStep = (endPrice - startPrice) / (inventory - 1n);
	const sellOutLamports = curveCost(startPrice, priceStep, 0n, inventory);
	checked(sellOutLamports + curveFee(sellOutLamports, feeBps));

	return {
		inventory,
		startPrice,
		priceStep,
		endPrice: curvePrice(startPrice, priceStep, inventory - 1n),
		feeBps,
		sellOutLamports,
	};
}

/**
 * The most boxes `budget` lamports buys right now, fee included. Useful for a
 * "spend up to" input; it never exceeds the boxes left.
 */
export function affordableCurveBoxes(curve: BoxCurve, budget: bigint): bigint {
	let low = 0n;
	let high = curve.inventory - curve.sold;

	while (low < high) {
		const middle = (low + high + 1n) / 2n;

		if (quoteCurveBuy(curve, middle).total <= budget) {
			low = middle;
		} else {
			high = middle - 1n;
		}
	}

	return low;
}
