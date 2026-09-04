import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./lootbox/playground.js", async (original) => ({
	...await original<typeof import("./lootbox/playground.js")>(),
	connectPlayground: vi.fn().mockRejectedValue(
		new Error("Local Surfpool is not running"),
	),
}));
import App from "./App.js";

describe("lootbox playground", () => {
	it("does not pretend to be connected when the RPC is unavailable", async () => {
		render(<App />);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Local Surfpool is not running",
		);
		expect(screen.getByRole("button", { name: "Build your first drop" }))
			.toBeDisabled();
		expect(screen.getByRole("button", { name: "Retry connection" }))
			.toBeEnabled();
	});
	it("keeps probabilistic backing and production risks visible", async () => {
		render(<App />);
		await screen.findByRole("alert");
		fireEvent.click(screen.getByRole("button", { name: "How it works" }));
		expect(
			screen.getByRole("heading", {
				name: "Probabilistic backing stays in scope.",
			}),
		).toBeVisible();
		expect(screen.getByText(/A stalled first-in-line commitment/))
			.toBeVisible();
	});
});
