import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuyWithSol } from "./BuyWithSol.js";

describe("buying prize tokens", () => {
	it("opens the selected token on Jupiter without a wallet signing flow", () => {
		const html = renderToStaticMarkup(createElement(BuyWithSol, {
			mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			symbol: "USDC",
			onBought: () => {},
		}));

		expect(html).toContain(
			"https://jup.ag/swap/SOL-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		);
		expect(html).toContain('rel="noopener noreferrer"');
		expect(html).toContain("Refresh balance");
		expect(html).not.toContain("Confirm swap");
	});

	it("keeps malformed token data inside the fixed Jupiter URL path", () => {
		const html = renderToStaticMarkup(createElement(BuyWithSol, {
			mint: "../../?redirect=https://example.invalid#swap",
			symbol: "Token",
			onBought: () => {},
		}));

		expect(html).toContain(
			"https://jup.ag/swap/SOL-..%2F..%2F%3Fredirect%3Dhttps%3A%2F%2Fexample.invalid%23swap",
		);
	});
});
