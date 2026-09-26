import { issueChallenge } from "../lib/.server/auth.js";
import {
	assertSameOrigin,
	jsonResponse,
	nowSeconds,
	services,
} from "../lib/.server/context.js";
import type { Route } from "./+types/api.auth.nonce";

export async function action({ request, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);

	return jsonResponse(
		await issueChallenge(app.db, new URL(request.url), nowSeconds()),
	);
}
