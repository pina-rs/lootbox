/**
 * A lootbox's box curve as loader data, and the questions pages ask of it:
 * is it trading, what does the next box cost, can the creator close it.
 * Pricing itself comes from the SDK so the page quotes exactly what the
 * program charges.
 */
import type { BoxCurve, BoxCurveState } from "@pina-rs/lootbox";

export type BoxCurveView = Readonly<{
	address: string;
	authority: string;
	inventory: string;
	sold: string;
	startPrice: string;
	priceStep: string;
	reserve: string;
	feeBps: number;
	/** Unix seconds: trading closes at the lootbox's reveal. */
	closesAt: number;
	/** Unix seconds; 0 until the last box sells. */
	soldOutAt: number;
}>;

export type CurvePhase = "trading" | "soldOut" | "closed";

export function toCurveView(
	address: string,
	state: BoxCurveState,
): BoxCurveView {
	return {
		address,
		authority: state.authority,
		inventory: state.inventory.toString(),
		sold: state.sold.toString(),
		startPrice: state.startPrice.toString(),
		priceStep: state.priceStep.toString(),
		reserve: state.reserve.toString(),
		feeBps: state.feeBps,
		closesAt: Number(state.closesAt),
		soldOutAt: Number(state.soldOutAt),
	};
}

/** The SDK's pricing input. */
export function curveTerms(view: BoxCurveView): BoxCurve {
	return {
		inventory: BigInt(view.inventory),
		sold: BigInt(view.sold),
		startPrice: BigInt(view.startPrice),
		priceStep: BigInt(view.priceStep),
		feeBps: view.feeBps,
	};
}

export function curvePhase(view: BoxCurveView, now: number): CurvePhase {
	if (view.soldOutAt !== 0) return "soldOut";

	return now >= view.closesAt ? "closed" : "trading";
}

/** Boxes still for sale. */
export function curveLeft(view: BoxCurveView): bigint {
	return BigInt(view.inventory) - BigInt(view.sold);
}

/**
 * Whether the creator may close: after sell-out, after trading closes, or
 * while nothing is sold. Mirrors `closeBoxCurve`.
 */
export function canCloseCurve(view: BoxCurveView, now: number): boolean {
	return curvePhase(view, now) !== "trading" || BigInt(view.sold) === 0n;
}

/**
 * The most a buyer signs for: the quote plus a small allowance, so a trade
 * that lands just after someone else's still goes through. Anything worse
 * fails on chain instead of overpaying.
 */
export function withSlippage(
	lamports: bigint,
	side: "buy" | "sell",
	bps = 100n,
): bigint {
	return side === "buy"
		? lamports + (lamports * bps + 9_999n) / 10_000n
		: lamports - (lamports * bps) / 10_000n;
}
