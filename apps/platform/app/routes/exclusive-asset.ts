/**
 * `/x/<collection>/<file>`: metadata, art, and player for Exclusive Lootbox
 * NFTs, derived from the URI stem alone. Every response is immutable: a stem
 * names one trait vector and serial forever.
 */
import {
	playerHtml,
	renderAnimatedExclusiveNft,
	renderExclusiveNft,
} from "@pina-rs/exclusive-nft-art";

import { services } from "../lib/.server/context.js";
import { originFor } from "../lib/.server/env.js";
import {
	exclusiveCollectionMetadata,
	exclusiveMetadata,
	IMMUTABLE,
	parseExclusiveAsset,
} from "../lib/exclusive-assets.js";
import type { Route } from "./+types/exclusive-asset";

function immutable(body: BodyInit, type: string): Response {
	return new Response(body, {
		headers: {
			"Content-Type": type,
			"Cache-Control": IMMUTABLE,
			"Access-Control-Allow-Origin": "*",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const app = services(context);
	const known = Object.values(app.config.exclusiveCollections);
	const asset = parseExclusiveAsset(params.file);

	// Only collections this deployment serves; anything else is a 404.
	if (!known.includes(params.collection) || !asset) {
		throw new Response("Not found", { status: 404 });
	}

	const origin = originFor(app.config, request);
	const collection = params.collection;

	switch (asset.kind) {
		case "player":
			return immutable(playerHtml(), "text/html; charset=utf-8");
		case "rive":
			return new Response(null, {
				status: 301,
				headers: { Location: "/exclusive-nft.riv", "Cache-Control": IMMUTABLE },
			});
		case "collection":
			return immutable(
				JSON.stringify(exclusiveCollectionMetadata({ origin })),
				"application/json",
			);
		case "json":
			return immutable(
				JSON.stringify(exclusiveMetadata(asset.stem, { origin, collection })),
				"application/json",
			);
		case "svg":
			return immutable(
				renderExclusiveNft(asset.stem.traits, asset.stem.serial),
				"image/svg+xml",
			);
		case "animated":
			return immutable(
				renderAnimatedExclusiveNft(asset.stem.traits, asset.stem.serial),
				"image/svg+xml",
			);
		case "png": {
			const svg = renderExclusiveNft(asset.stem.traits, asset.stem.serial);
			// Performance: the resvg WebAssembly loads only for PNG requests.
			const { Resvg } = await import("@cf-wasm/resvg/workerd");
			const rendered = await Resvg.async(svg, {
				fitTo: { mode: "width", value: 1024 },
			});

			return immutable(new Uint8Array(rendered.render().asPng()), "image/png");
		}
	}
}
