/**
 * `GET /api/tokens?category=coin|stock&q=`: prize search. Upstream keys stay
 * in the Worker; responses are cached at the edge.
 */
import { searchCatalog } from "../lib/.server/catalog.js";
import { jsonResponse, services } from "../lib/.server/context.js";
import type { Route } from "./+types/api.tokens";

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
	const category = url.searchParams.get("category") === "stock"
		? "stock"
		: "coin";

	return jsonResponse(await searchCatalog(services(context), category, query), {
		headers: { "Cache-Control": "public, max-age=60" },
	});
}
