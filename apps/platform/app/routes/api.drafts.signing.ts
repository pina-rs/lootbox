/**
 * Pin a draft's on-chain identity before its first transaction.
 *
 * After this, reloading the wizard resumes against the same template PDA and
 * box mint instead of starting a second treasury.
 */
import { LOOTBOX_PROGRAM_PROGRAM_ADDRESS } from "@pina-rs/lootbox";
import {
	address,
	getAddressEncoder,
	getProgramDerivedAddress,
	getU64Encoder,
} from "@solana/kit";
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
import { markDraftSigning } from "../lib/.server/db.js";
import { addressSchema, u64String } from "../lib/schemas.js";
import type { Route } from "./+types/api.drafts.signing";

const bodySchema = z.object({
	templateId: u64String,
	template: addressSchema,
	boxMint: addressSchema,
});

export async function action({ request, params, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);
	const wallet = await requireWallet(app, request);
	const body = bodySchema.safeParse(await readJson(request));

	if (!body.success) return errorResponse(400, "Malformed signing request");

	// Security: the template must be this wallet's PDA for this id, so a draft
	// can never be pointed at someone else's treasury.
	const [expected] = await getProgramDerivedAddress({
		programAddress: LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
		seeds: [
			new TextEncoder().encode("template"),
			getAddressEncoder().encode(address(wallet)),
			getU64Encoder().encode(BigInt(body.data.templateId)),
		],
	});

	if (expected !== body.data.template) {
		return errorResponse(400, "Template address does not match this wallet");
	}

	const pinned = await markDraftSigning(app.db, {
		id: params.id,
		creator: wallet,
		...body.data,
	}, nowSeconds());

	if (!pinned) {
		return errorResponse(409, "This draft is already being launched");
	}

	return jsonResponse({ ok: true });
}
