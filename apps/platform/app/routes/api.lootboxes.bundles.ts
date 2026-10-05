/** Save display labels for bundles the creator appended after launch. */
import {
	assertSameOrigin,
	errorResponse,
	jsonResponse,
	nowSeconds,
	readJson,
	services,
} from "../lib/.server/context.js";
import { mergeBundleLabels } from "../lib/.server/db.js";
import { requireCreator, requireLootbox } from "../lib/.server/lootbox.js";
import { appendLabelsSchema } from "../lib/schemas.js";
import type { Route } from "./+types/api.lootboxes.bundles";

export async function action({ request, params, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);
	const record = await requireLootbox(app, params.slug);
	const { chain } = await requireCreator(app, request, record);
	const body = appendLabelsSchema.safeParse(await readJson(request));

	if (!body.success) return errorResponse(400, "Malformed bundle labels");

	// Labels may describe only bundles that exist on chain.
	if (body.data.labels.some((label) => label.index >= chain.bundles.length)) {
		return errorResponse(409, "That bundle is not on chain yet");
	}

	await mergeBundleLabels(app.db, record, body.data.labels, nowSeconds());

	return jsonResponse({ ok: true });
}
