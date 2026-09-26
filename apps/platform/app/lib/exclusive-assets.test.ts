import { LAYERS } from "@pina-rs/exclusive-nft-art";
import { describe, expect, it } from "vitest";

import { loader } from "../routes/exclusive-asset.js";
import {
	exclusiveMetadata,
	IMMUTABLE,
	parseExclusiveAsset,
} from "./exclusive-assets.js";

const COLLECTION = "3SWqQpWP5AUyJA5c7kLQdgwP83BLL9p8EH1DkfLTZ3pj";
const STEM = "00050203000d01-42";

function call(file: string, collection = COLLECTION) {
	const request = new Request(`https://lootbox.so/x/${collection}/${file}`);
	const env = {
		EXCLUSIVE_COLLECTION_DEVNET: COLLECTION,
		PUBLIC_ORIGIN: "https://lootbox.so",
	};
	const context = {
		cloudflare: { env, ctx: { waitUntil: () => {} } },
	};

	// A minimal Worker context: the route reads only config.
	return loader(
		{
			request,
			params: { collection, file },
			context,
		} as unknown as Parameters<typeof loader>[0],
	).catch((thrown: unknown) => {
		if (thrown instanceof Response) return thrown;

		throw thrown;
	});
}

describe("parseExclusiveAsset", () => {
	it("accepts one stem per layer and in-range traits", () => {
		expect(parseExclusiveAsset(`${STEM}.json`)).toEqual({
			kind: "json",
			stem: { traits: [0, 5, 2, 3, 0, 13, 1], serial: 42 },
		});
		expect(parseExclusiveAsset(`${STEM}.animated.svg`)?.kind).toBe("animated");
		expect(parseExclusiveAsset(`${STEM}.png`)?.kind).toBe("png");
		expect(parseExclusiveAsset("play.html")?.kind).toBe("player");
	});

	it("rejects wrong lengths, out-of-range traits, uppercase, and padding", () => {
		const tooBig = LAYERS[0]?.traits.length.toString(16).padStart(2, "0");

		expect(parseExclusiveAsset("0005020300-42.json")).toBeNull();
		expect(parseExclusiveAsset(`${tooBig}050203000d01-42.json`)).toBeNull();
		expect(parseExclusiveAsset("00050203000D01-42.json")).toBeNull();
		expect(parseExclusiveAsset("00050203000d01-042.json")).toBeNull();
		expect(parseExclusiveAsset(`${STEM}.gif`)).toBeNull();
		expect(parseExclusiveAsset("../secrets")).toBeNull();
	});
});

describe("exclusiveMetadata", () => {
	it("is deterministic and points wallets at the PNG", () => {
		const stem = { traits: [0, 5, 2, 3, 0, 13, 1], serial: 42 };
		const first = exclusiveMetadata(stem, {
			origin: "https://lootbox.so",
			collection: COLLECTION,
		});

		expect(
			exclusiveMetadata(stem, {
				origin: "https://lootbox.so",
				collection: COLLECTION,
			}),
		)
			.toEqual(first);
		expect(first.image).toBe(`https://lootbox.so/x/${COLLECTION}/${STEM}.png`);
		expect(first.animation_url).toBe(
			`https://lootbox.so/x/${COLLECTION}/play.html?nft=${STEM}`,
		);
		expect(first.symbol).toBe("LOOT");
		expect(first.attributes.map((attribute) => attribute.trait_type)).toEqual([
			...LAYERS.map((layer) => layer.name),
			"Serial",
			"Rarity",
			"Rarity score",
		]);
	});
});

describe("/x/ route", () => {
	it("serves immutable metadata, art, and the player for a known collection", async () => {
		for (
			const [file, type] of [
				[`${STEM}.json`, "application/json"],
				[`${STEM}.svg`, "image/svg+xml"],
				[`${STEM}.animated.svg`, "image/svg+xml"],
				["play.html", "text/html; charset=utf-8"],
				["collection.json", "application/json"],
			] as const
		) {
			const response = await call(file);

			expect(response.status, file).toBe(200);
			expect(response.headers.get("Content-Type")).toBe(type);
			expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE);
		}

		const svg = await (await call(`${STEM}.svg`)).text();

		expect(await (await call(`${STEM}.svg`)).text()).toBe(svg);
	});

	it("404s unknown collections and malformed stems", async () => {
		expect(
			(await call(`${STEM}.json`, "11111111111111111111111111111111")).status,
		).toBe(404);
		expect((await call("00-1.json")).status).toBe(404);
	});

	it("redirects the Rive file to the static asset", async () => {
		const response = await call("exclusive-nft.riv");

		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe("/exclusive-nft.riv");
	});
});
