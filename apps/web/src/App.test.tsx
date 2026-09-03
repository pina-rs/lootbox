import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App.js";

describe("lootbox playground", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("burns a box, reveals a deterministic reward, and redeems it", async () => {
		render(<App />);
		await act(async () => vi.advanceTimersByTimeAsync(900));

		fireEvent.click(screen.getByRole("button", { name: /crack the seal/i }));
		expect(screen.getByTestId("lootbox-machine")).toHaveAttribute(
			"data-phase",
			"commit",
		);

		await act(async () => vi.advanceTimersByTimeAsync(600));
		expect(screen.getByTestId("inventory-count")).toHaveTextContent("2");
		expect(screen.getByTestId("lootbox-machine")).toHaveAttribute(
			"data-phase",
			"burn",
		);

		await act(async () => vi.advanceTimersByTimeAsync(1_700));
		expect(screen.getByTestId("reward-card")).toHaveTextContent("Solar Crown");
		expect(screen.getByTestId("reward-card")).toHaveTextContent("0.050 SOL");

		fireEvent.click(screen.getByRole("button", { name: /redeem reward/i }));
		expect(screen.getByTestId("wallet-balance")).toHaveTextContent("0.050 SOL");
		expect(screen.getByText("REDEMPTION COMPLETE")).toBeVisible();
	});

	it("exposes the protocol guarantees and exact reward odds", async () => {
		render(<App />);
		await act(async () => vi.advanceTimersByTimeAsync(900));

		expect(screen.getByText("62%")).toBeVisible();
		expect(screen.getByText("28%")).toBeVisible();
		expect(screen.getByText("10%")).toBeVisible();
		expect(screen.getByText("Burn before reveal")).toBeVisible();
		expect(screen.getByText("Fully collateralized")).toBeVisible();
	});
});
