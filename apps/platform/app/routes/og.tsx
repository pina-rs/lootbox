/**
 * `GET /og/<slug>.png`: the 1200×630 social card for a lootbox, rendered in
 * the Worker with Satori and resvg (WebAssembly). It shows the current title,
 * tagline, and status, so shared links follow the creator's edits.
 */
import { cache, GoogleFont, ImageResponse } from "@cf-wasm/og/workerd";

import { SocialCard } from "../components/SocialCard.js";

import { cachedTemplateSummaries } from "../lib/.server/chain-cache.js";
import { services } from "../lib/.server/context.js";
import { rpcUrlFor } from "../lib/.server/env.js";
import { requireLootbox } from "../lib/.server/lootbox.js";
import { lootboxStatus } from "../lib/status.js";
import type { Route } from "./+types/og";

async function statusLabel(
	app: ReturnType<typeof services>,
	record: Awaited<ReturnType<typeof requireLootbox>>,
): Promise<string | null> {
	try {
		const [summary] = await cachedTemplateSummaries(
			await rpcUrlFor(app.config, record.cluster),
			record.cluster,
			[record.template],
		);

		return summary ? lootboxStatus(summary).label : null;
	} catch (error) {
		// A card without a status chip beats no card at all.
		console.error("og status read failed", error);

		return null;
	}
}

export async function loader({ params, context }: Route.LoaderArgs) {
	const slug = /^(.+)\.png$/.exec(params.file)?.[1];
	const app = services(context);
	const record = await requireLootbox(app, slug);
	const status = await statusLabel(app, record);

	cache.setExecutionContext(context.cloudflare.ctx);

	return ImageResponse.async(
		<SocialCard record={record} status={status} />,
		{
			width: 1200,
			height: 630,
			fonts: [new GoogleFont("Bungee", { name: "Bungee" })],
			headers: { "Cache-Control": "public, max-age=600" },
		},
	);
}
