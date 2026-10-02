/** `GET /api/prices?ids=<mint>,<mint>`: USD prices and a USD→GBP rate. */
import { prices } from "../lib/.server/catalog.js";
import { jsonResponse, services } from "../lib/.server/context.js";
import type { Route } from "./+types/api.prices";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function loader({ request, context }: Route.LoaderArgs) {
	const ids = (new URL(request.url).searchParams.get("ids") ?? "")
		.split(",")
		.filter((id) => BASE58.test(id))
		.slice(0, 50);

	return jsonResponse(await prices(services(context), ids), {
		headers: { "Cache-Control": "public, max-age=60" },
	});
}
