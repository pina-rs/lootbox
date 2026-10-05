/**
 * Wizard drafts: one per creator at a time, saved as they type.
 *
 * GET returns the creator's latest unfinished draft (or `?id=`); POST saves;
 * DELETE discards an unsigned draft.
 */
import { z } from "zod";

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
	deleteDraft,
	draftById,
	latestDraft,
	upsertDraft,
} from "../lib/.server/db.js";
import { draftWriteSchema, firstIssue } from "../lib/schemas.js";
import type { Route } from "./+types/api.drafts";

const idSchema = z.string().regex(/^[a-z0-9-]{8,40}$/);

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const wallet = await requireWallet(app, request);
	const id = new URL(request.url).searchParams.get("id");
	const draft = id && idSchema.safeParse(id).success
		? await draftById(app.db, id, wallet)
		: await latestDraft(app.db, wallet);

	return jsonResponse({ draft });
}

export async function action({ request, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);
	const wallet = await requireWallet(app, request);
	const body = await readJson(request);

	if (request.method === "DELETE") {
		const id = idSchema.safeParse(
			typeof body === "object" && body !== null
				? Reflect.get(body, "id")
				: null,
		);

		if (!id.success) return errorResponse(400, "Unknown draft");

		await deleteDraft(app.db, id.data, wallet);

		return jsonResponse({ ok: true });
	}

	const parsed = draftWriteSchema.extend({ id: idSchema.optional() })
		.safeParse(body);

	if (!parsed.success) return errorResponse(400, firstIssue(parsed.error));

	if (!app.config.enabledClusters.includes(parsed.data.cluster)) {
		return errorResponse(400, "That network is not available here");
	}

	const id = parsed.data.id ?? crypto.randomUUID();

	await upsertDraft(app.db, {
		id,
		creator: wallet,
		cluster: parsed.data.cluster,
		step: parsed.data.step,
		data: parsed.data.data,
	}, nowSeconds());

	return jsonResponse({ id });
}
