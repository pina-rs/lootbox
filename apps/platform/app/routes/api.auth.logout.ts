import { signOut } from "../lib/.server/auth.js";
import {
	assertSameOrigin,
	jsonResponse,
	services,
} from "../lib/.server/context.js";
import type { Route } from "./+types/api.auth.logout";

export async function action({ request, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const cookie = await signOut(services(context).db, request);

	return jsonResponse({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
