import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
	CurveChart,
	curveSteps,
	describeShare,
	formatSolAmount,
	OddsStrip,
	Stepper,
} from "../src/index.ts";

describe("CurveChart", () => {
	it("draws one step per box up to the step budget, rising to the plot top", () => {
		const steps = curveSteps(20, 1_000_000, 50_000, 60);

		expect(steps).toHaveLength(20);
		expect(steps.every((step) => step.size === 1)).toBe(true);
		expect(steps[0]?.height).toBeLessThan(steps[19]?.height ?? 0);

		const grouped = curveSteps(1_000, 1_000_000, 50_000, 60);

		expect(grouped).toHaveLength(60);
		expect(grouped.reduce((sum, step) => sum + step.size, 0)).toBe(1_000);
	});

	it("keeps a flat curve at one height", () => {
		const heights = new Set(
			curveSteps(25, 500_000, 0, 60).map((step) => step.height),
		);

		expect(heights.size).toBe(1);
	});

	it("describes the next price and fills sold steps", () => {
		const markup = renderToStaticMarkup(
			<CurveChart
				inventory={20}
				sold={3}
				startPrice={1_000_000}
				priceStep={50_000}
			/>,
		);

		expect(markup).toContain(
			"3 of 20 boxes sold. The next box costs 0.00115 SOL",
		);
		expect(markup.match(/class="curve-chart-sold"/g)).toHaveLength(3);
	});

	it("lights a pending buy above the sold boxes", () => {
		const markup = renderToStaticMarkup(
			<CurveChart
				inventory={20}
				sold={3}
				startPrice={1_000_000}
				priceStep={50_000}
				preview={{ side: "buy", count: 2 }}
			/>,
		);

		expect(markup.match(/class="curve-chart-preview"/g)).toHaveLength(2);
	});

	it("says when it has sold out", () => {
		const markup = renderToStaticMarkup(
			<CurveChart
				inventory={20}
				sold={20}
				startPrice={1_000_000}
				priceStep={50_000}
			/>,
		);

		expect(markup).toContain("Sold out");
		expect(markup).not.toContain("curve-chart-marker");
	});
});

describe("OddsStrip", () => {
	it("phrases long shots as one-in-n and the rest as percentages", () => {
		expect(describeShare(1, 25)).toBe("1 in 25");
		expect(describeShare(10, 25)).toBe("40%");
		expect(describeShare(0, 25)).toBe("0%");
	});

	it("sizes segments by box count and lists every bundle", () => {
		const markup = renderToStaticMarkup(
			<OddsStrip
				segments={[
					{ key: "grand", label: "Grand prize", count: 1 },
					{ key: "common", label: "Bonk bag", count: 24 },
				]}
			/>,
		);

		expect(markup).toContain("flex-grow:1");
		expect(markup).toContain("flex-grow:24");
		expect(markup).toContain("Grand prize");
		expect(markup).toContain("1 in 25");
	});
});

describe("Stepper", () => {
	it("is read-only without a change handler", () => {
		const markup = renderToStaticMarkup(<Stepper label="Boxes" value={3} />);

		expect(markup).toContain("readOnly");
		expect(markup.match(/disabled=""/g)).toHaveLength(2);
	});
});

describe("formatSolAmount", () => {
	it("shows enough digits to tell neighbouring prices apart", () => {
		expect(formatSolAmount(1_500_000)).toBe("0.0015");
		expect(formatSolAmount(1_050_000_000)).toBe("1.05");
		expect(formatSolAmount(123_456_789_000)).toBe("123.5");
	});
});
