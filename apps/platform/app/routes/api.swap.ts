/**
 * Buy a prize token with SOL through Jupiter Swap v2.
 *
 * GET quotes an order the signed-in creator's wallet would sign; POST submits
 * the wallet-signed transaction for managed landing. The server builds and
 * relays, but only the creator's wallet can sign, and only after they confirm
 * the quote. Mainnet only (Jupiter routes live liquidity).
 */
import { z } from "zod";

import {
	swapExecute,
	swapOrder,
	usingFixtures,
} from "../lib/.server/catalog.js";
import {
	assertSameOrigin,
	errorResponse,
	jsonResponse,
	readJson,
	requireWallet,
	services,
} from "../lib/.server/context.js";
import { addressSchema, u64String } from "../lib/schemas.js";
import type { Route } from "./+types/api.swap";

function swapsEnabled(app: ReturnType<typeof services>): boolean {
	return usingFixtures(app) || app.config.enabledClusters.includes("mainnet");
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const wallet = await requireWallet(app, request);
	const url = new URL(request.url);
	const outputMint = addressSchema.safeParse(
		url.searchParams.get("outputMint"),
	);
	const lamports = u64String.safeParse(url.searchParams.get("lamports"));

	if (!swapsEnabled(app)) {
		return errorResponse(404, "Swaps are available on mainnet");
	}

	if (
		!outputMint.success || !lamports.success || BigInt(lamports.data) === 0n
	) {
		return errorResponse(400, "Bad swap request");
	}

	try {
		return jsonResponse(
			await swapOrder(app, {
				outputMint: outputMint.data,
				lamports: BigInt(lamports.data),
				taker: wallet,
			}),
		);
	} catch (error) {
		return errorResponse(
			502,
			error instanceof Error ? error.message : "No quote",
		);
	}
}

const executeSchema = z.object({
	signedTransaction: z.string().min(1).max(4_000),
	requestId: z.string().min(1).max(200),
});

export async function action({ request, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);

	await requireWallet(app, request);

	if (!swapsEnabled(app)) {
		return errorResponse(404, "Swaps are available on mainnet");
	}

	const body = executeSchema.safeParse(await readJson(request));

	if (!body.success) return errorResponse(400, "Bad swap submission");

	return jsonResponse(await swapExecute(app, body.data));
}
