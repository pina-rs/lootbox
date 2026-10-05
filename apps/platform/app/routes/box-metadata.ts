/**
 * `GET /m/<boxMint>.json`: live box token metadata.
 *
 * The box mint's immutable on-chain URI points here, so wallets show the
 * creator's current title, description, and art. A mint that is launched but
 * not yet published falls back to its draft.
 */
import { jsonResponse, mediaUrl, services } from "../lib/.server/context.js";
import { draftByBoxMint, lootboxByBoxMint } from "../lib/.server/db.js";
import { originFor } from "../lib/.server/env.js";
import { boxMetadata } from "../lib/metadata.js";
import type { Route } from "./+types/box-metadata";

const FILE = /^([1-9A-HJ-NP-Za-km-z]{32,44})\.json$/;

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const mint = FILE.exec(params.file)?.[1];

	if (!mint) throw new Response("Not found", { status: 404 });

	const app = services(context);
	const origin = originFor(app.config, request);
	const lootbox = await lootboxByBoxMint(app.db, mint);
	const headers = {
		"Cache-Control": "public, max-age=60",
		"Access-Control-Allow-Origin": "*",
	};

	if (lootbox) {
		return jsonResponse(
			boxMetadata({
				slug: lootbox.slug,
				title: lootbox.title,
				symbol: lootbox.symbol,
				tagline: lootbox.tagline,
				descriptionMd: lootbox.descriptionMd,
				coverUrl: mediaUrl(origin, lootbox.coverKey),
			}, origin),
			{ headers },
		);
	}

	const draft = await draftByBoxMint(app.db, mint);

	if (!draft) throw new Response("Not found", { status: 404 });

	return jsonResponse(
		boxMetadata({
			slug: draft.slug ?? "",
			title: draft.data.details.name,
			symbol: draft.data.details.symbol,
			tagline: "",
			descriptionMd: draft.data.details.description,
			coverUrl: mediaUrl(origin, draft.data.details.coverKey),
		}, origin),
		{ headers },
	);
}
