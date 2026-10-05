import { z } from "zod";

import { verifySignIn } from "../lib/.server/auth.js";
import {
	assertSameOrigin,
	errorResponse,
	jsonResponse,
	nowSeconds,
	readJson,
	services,
} from "../lib/.server/context.js";
import { fromBase64 } from "../lib/bytes.js";
import { addressSchema } from "../lib/schemas.js";
import type { Route } from "./+types/api.auth.verify";

const bodySchema = z.object({
	address: addressSchema,
	message: z.string().min(1).max(4_000),
	signature: z.string().min(1).max(200),
});

export async function action({ request, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);
	const body = bodySchema.safeParse(await readJson(request));

	if (!body.success) return errorResponse(400, "Malformed sign-in");

	const result = await verifySignIn(app.db, {
		requestUrl: new URL(request.url),
		address: body.data.address,
		message: fromBase64(body.data.message),
		signature: fromBase64(body.data.signature),
		now: nowSeconds(),
	});

	if ("error" in result) {
		return errorResponse(401, `Sign-in refused: ${result.error}`);
	}

	return jsonResponse(
		{ address: result.address },
		{ headers: { "Set-Cookie": result.cookie } },
	);
}
