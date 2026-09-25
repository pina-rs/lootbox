import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fallbackVariant } from "./emptyChests.js";
import EmptyChestShowcase from "./EmptyChestShowcase.js";

const OPENING = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const ASSET = "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY";

function serveManifest(status: number, body: unknown = {}) {
	const fetch = vi.fn(async () =>
		new Response(JSON.stringify(body), { status })
	);

	vi.stubGlobal("fetch", fetch);

	return fetch;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("empty chest showcase", () => {
	it("shows the minted chest's poster and name under reduced motion", async () => {
		const fetch = serveManifest(200, {
			cluster: "devnet",
			tree: "Tree111111111111111111111111111111111111111",
			assets: { [ASSET]: { variant: 5, leafIndex: 0 } },
		});

		render(
			<EmptyChestShowcase
				opening={OPENING}
				reducedMotion
				resolveAsset={async () => ASSET}
			/>,
		);

		expect(await screen.findByText("Empty Chest #6 — A Rubber Duck"))
			.toBeInTheDocument();
		expect(screen.getByTestId("empty-chest-poster"))
			.toHaveAttribute("src", "/nft/empty-chest/5.png");
		expect(screen.queryByTestId("empty-chest-canvas")).toBeNull();
		expect(screen.getByTestId("empty-chest"))
			.toHaveAttribute("data-playback", "poster");
		expect(fetch).toHaveBeenCalledWith("/nft/empty-chest/assets.json");
	});

	it("falls back to the opening's stand-in without a manifest or pool asset", async () => {
		serveManifest(404);

		render(
			<EmptyChestShowcase
				opening={OPENING}
				reducedMotion
				resolveAsset={null}
			/>,
		);

		const variant = fallbackVariant(OPENING);

		expect(await screen.findByTestId("empty-chest-poster"))
			.toHaveAttribute("src", `/nft/empty-chest/${variant}.png`);
		expect(screen.getByTestId("empty-chest"))
			.toHaveAttribute("data-variant", String(variant));
	});

	it("keeps the stand-in when the pool lookup fails", async () => {
		serveManifest(404);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		render(
			<EmptyChestShowcase
				opening={OPENING}
				reducedMotion
				resolveAsset={async () => {
					throw new Error("rpc down");
				}}
			/>,
		);

		expect(await screen.findByTestId("empty-chest-poster")).toBeInTheDocument();
		expect(warn).toHaveBeenCalledWith(
			"Empty Chest asset lookup failed",
			expect.any(Error),
		);
		warn.mockRestore();
	});
});
