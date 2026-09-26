/**
 * `GET /api/admission?cluster=&mint=`: can this token be a prize?
 *
 * The Worker reads the mint on the lootbox's cluster and applies the same
 * admission rules the program enforces, so creators see a clear reason
 * before they sign anything.
 */
import {
	errorResponse,
	jsonResponse,
	services,
} from "../lib/.server/context.js";
import { rpcUrlFor } from "../lib/.server/env.js";
import { parseCluster } from "../lib/clusters.js";
import { mintInfos } from "../lib/holdings.js";
import type { Route } from "./+types/api.admission";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const url = new URL(request.url);
	const cluster = parseCluster(url.searchParams.get("cluster"));
	const mint = url.searchParams.get("mint") ?? "";

	if (
		!cluster || !app.config.enabledClusters.includes(cluster) ||
		!BASE58.test(mint)
	) {
		return errorResponse(400, "Bad request");
	}

	const info = (await mintInfos(await rpcUrlFor(app.config, cluster), [mint]))
		.get(mint);

	if (!info) {
		return jsonResponse({
			ok: false,
			reason: "This address isn't a token on this network.",
			info: null,
		});
	}

	return jsonResponse({
		ok: info.ineligible === null,
		reason: info.ineligible,
		info: { ...info, supply: info.supply.toString() },
	});
}
