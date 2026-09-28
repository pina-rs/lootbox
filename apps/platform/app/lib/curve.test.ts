import { describe, expect, it } from "vitest";

import { solPrizePerBox } from "../distribute/CurveCard.js";
import type { LootboxChainView } from "./chain.js";
import {
	type BoxCurveView,
	canCloseCurve,
	curveLeft,
	curvePhase,
	withSlippage,
} from "./curve.js";
import { airdropCost } from "./distribution.js";

const curve: BoxCurveView = {
	address: "curve",
	authority: "creator",
	inventory: "20",
	sold: "3",
	startPrice: "10000000",
	priceStep: "2105263",
	reserve: "36315789",
	feeBps: 100,
	closesAt: 2_000,
	soldOutAt: 0,
};

describe("box curve views", () => {
	it("trades until sell-out or the reveal", () => {
		expect(curvePhase(curve, 1_999)).toBe("trading");
		expect(curvePhase(curve, 2_000)).toBe("closed");
		expect(curvePhase({ ...curve, soldOutAt: 1_500 }, 1_600)).toBe("soldOut");
		expect(curveLeft(curve)).toBe(17n);
	});

	it("lets the creator close only when the program would", () => {
		expect(canCloseCurve(curve, 1_999)).toBe(false);
		expect(canCloseCurve({ ...curve, sold: "0" }, 1_999)).toBe(true);
		expect(canCloseCurve(curve, 2_000)).toBe(true);
		expect(canCloseCurve({ ...curve, soldOutAt: 1_500 }, 1_600)).toBe(true);
	});

	it("pads buys up and sells down by the slippage allowance", () => {
		expect(withSlippage(1_000_000n, "buy")).toBe(1_010_000n);
		expect(withSlippage(1_000_001n, "buy")).toBe(1_010_002n);
		expect(withSlippage(1_000_000n, "sell")).toBe(990_000n);
	});
});

describe("curve pricing hints", () => {
	it("averages SOL prizes over the boxes left and ignores other assets", () => {
		const chain = {
			bundles: [
				{
					index: 0,
					quantity: "1",
					remaining: "1",
					status: 1,
					assets: [{
						kind: "sol",
						mint: "",
						amount: "1000000000",
						decimals: 9,
					}],
				},
				{
					index: 1,
					quantity: "9",
					remaining: "9",
					status: 1,
					assets: [{ kind: "token", mint: "bonk", amount: "5", decimals: 5 }],
				},
			],
		} satisfies Pick<LootboxChainView, "bundles">;

		expect(solPrizePerBox(chain)).toBe(100_000_000n);
	});
});

describe("airdrop cost", () => {
	it("charges rent only for new box accounts and one fee per batch", () => {
		expect(airdropCost(13, 4, 2_074_080n)).toEqual({
			transactions: 3,
			newAccounts: 4,
			accountRent: 8_296_320n,
			fees: 15_000n,
			total: 8_311_320n,
		});
		expect(airdropCost(0, 0, 2_074_080n).total).toBe(0n);
	});
});
