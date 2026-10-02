/**
 * Publish a launched draft as a lootbox page.
 *
 * The chain decides whether there is anything to publish: the template must
 * exist, be live, belong to the signed-in wallet, and use the draft's box
 * mint. Publishing twice returns the existing page.
 */
import {
	assertSameOrigin,
	errorResponse,
	jsonResponse,
	nowSeconds,
	readJson,
	requireWallet,
	services,
} from "../lib/.server/context.js";
import {
	draftById,
	insertLootbox,
	lootboxByTemplate,
	markDraftPublished,
} from "../lib/.server/db.js";
import { rpcUrlFor } from "../lib/.server/env.js";
import { readLootboxChain } from "../lib/chain.js";
import { publishSchema } from "../lib/schemas.js";
import { createSlug } from "../lib/slug.js";
import type { Route } from "./+types/api.lootboxes";

export async function action({ request, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);
	const wallet = await requireWallet(app, request);
	const body = publishSchema.safeParse(await readJson(request));

	if (!body.success) return errorResponse(400, "Malformed publish request");

	const draft = await draftById(app.db, body.data.draftId, wallet);

	if (!draft || draft.template !== body.data.template || !draft.boxMint) {
		return errorResponse(404, "No launched draft matches that treasury");
	}

	const existing = await lootboxByTemplate(
		app.db,
		draft.cluster,
		draft.template,
	);

	if (existing) return jsonResponse({ slug: existing.slug });

	const chain = await readLootboxChain(
		await rpcUrlFor(app.config, draft.cluster),
		draft.template,
	);

	if (
		!chain || chain.authority !== wallet || chain.boxMint !== draft.boxMint ||
		chain.status !== "live"
	) {
		return errorResponse(409, "The treasury is not live on chain yet");
	}

	const now = nowSeconds();
	const slug = createSlug(draft.data.details.name);

	await insertLootbox(app.db, {
		slug,
		cluster: draft.cluster,
		template: draft.template,
		boxMint: draft.boxMint,
		creator: wallet,
		title: draft.data.details.name.trim(),
		symbol: draft.data.details.symbol.trim(),
		descriptionMd: draft.data.details.description,
		coverKey: draft.data.details.coverKey,
		bundles: draft.data.bundles.map((bundle, index) => ({
			index,
			label: bundle.label,
			assets: bundle.assets,
		})),
	}, now);
	await markDraftPublished(app.db, draft.id, slug, now);

	return jsonResponse({ slug });
}
