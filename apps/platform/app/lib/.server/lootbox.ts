/**
 * Loading a lootbox page and authorizing its creator.
 */
import { type LootboxChainView, readLootboxChain } from "../chain.js";
import { isSlug } from "../slug.js";
import { type AppServices, errorResponse, requireWallet } from "./context.js";
import { lootboxBySlug, type LootboxRecord } from "./db.js";
import { rpcUrlFor } from "./env.js";

export async function requireLootbox(
	app: AppServices,
	slug: string | undefined,
): Promise<LootboxRecord> {
	const record = slug && isSlug(slug)
		? await lootboxBySlug(app.db, slug)
		: null;

	if (!record) {
		throw new Response("This lootbox does not exist.", { status: 404 });
	}

	return record;
}

export type ChainRead =
	| Readonly<{ status: "ok"; view: LootboxChainView }>
	| Readonly<{ status: "missing" }>
	| Readonly<{ status: "unreachable"; message: string }>;

/** Read chain state, reporting an unreachable RPC instead of failing the page. */
export async function readChain(
	app: AppServices,
	record: LootboxRecord,
): Promise<ChainRead> {
	let rpcUrl: string;

	try {
		rpcUrl = await rpcUrlFor(app.config, record.cluster);
	} catch (error) {
		return {
			status: "unreachable",
			message: error instanceof Error ? error.message : "RPC unavailable",
		};
	}

	try {
		const view = await readLootboxChain(rpcUrl, record.template);

		return view ? { status: "ok", view } : { status: "missing" };
	} catch (error) {
		// The page still renders its display copy; the client retries the read.
		console.error("chain read failed", record.slug, error);

		return {
			status: "unreachable",
			message: "The Solana RPC did not answer. Retrying shortly.",
		};
	}
}

/**
 * The signed-in wallet, if and only if it is this lootbox's creator and still
 * the template authority on chain. Throws 401/403 responses otherwise.
 */
export async function requireCreator(
	app: AppServices,
	request: Request,
	record: LootboxRecord,
): Promise<{ wallet: string; chain: LootboxChainView }> {
	const wallet = await requireWallet(app, request);

	if (wallet !== record.creator) {
		throw errorResponse(403, "Only the creator can manage this lootbox");
	}

	const read = await readChain(app, record);

	if (read.status !== "ok") {
		throw errorResponse(503, "Could not confirm the creator on chain");
	}

	// Security: the chain, not D1, decides who controls the treasury.
	if (read.view.authority !== wallet) {
		throw errorResponse(403, "This wallet is not the treasury authority");
	}

	return { wallet, chain: read.view };
}
