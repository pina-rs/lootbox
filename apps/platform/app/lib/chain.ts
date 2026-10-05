/**
 * Read a lootbox's on-chain state into a JSON-safe view.
 *
 * Loaders call this on the server so the first paint already shows live odds;
 * the browser calls the same function to refresh. Bigints travel as decimal
 * strings because loader data is serialized.
 */
import {
	bundleAssets,
	type ChainOpening,
	fetchAllMaybeTemplateState,
	fetchMaybeTemplateState,
	listTemplateOpenings,
	LootboxClient,
} from "@pina-rs/lootbox";
import {
	type Address,
	address,
	createNoopSigner,
	isAddress,
} from "@solana/kit";

import { clusterTime } from "./clock.js";

/** The fee payer is never used for reads, so any address works. */
const READ_ONLY_PAYER = address("11111111111111111111111111111111");

export type TemplateStatus = "draft" | "live" | "retired";

export type ChainAssetView = Readonly<{
	kind: string;
	mint: string;
	amount: string;
	decimals: number;
}>;

export type ChainBundleView = Readonly<{
	index: number;
	quantity: string;
	remaining: string;
	/** 0 staging, 1 active, 2 cancelled. */
	status: number;
	assets: readonly ChainAssetView[];
}>;

export type LootboxChainView = Readonly<{
	template: string;
	authority: string;
	boxMint: string;
	status: TemplateStatus;
	/** Unix seconds; 0 while the treasury is still editable. */
	lockedAt: number;
	/** Reveal time, Unix seconds. */
	opensAt: number;
	/** Cluster clock, Unix seconds (Surfpool can time-travel). */
	chainTime: number;
	totalBundles: string;
	totalMinted: string;
	remainingBundles: string;
	pendingOpenings: string;
	supply: string;
	revision: string;
	bundles: readonly ChainBundleView[];
}>;

export function readClient(rpcUrl: string): LootboxClient {
	return new LootboxClient(rpcUrl, createNoopSigner(READ_ONLY_PAYER));
}

function templateStatus(status: number): TemplateStatus {
	if (status === 0) return "draft";

	return status === 1 ? "live" : "retired";
}

function chainTime(client: LootboxClient): Promise<number> {
	return clusterTime(client.rpc);
}

/** `null` when the account does not exist or is not a lootbox template. */
export async function readLootboxChain(
	rpcUrl: string,
	template: string,
): Promise<LootboxChainView | null> {
	if (!isAddress(template)) return null;

	const client = readClient(rpcUrl);
	const account = await fetchMaybeTemplateState(client.rpc, address(template), {
		commitment: "processed",
	});

	if (!account.exists) return null;

	const state = { address: account.address, data: account.data };

	const [bundles, supply, time] = await Promise.all([
		client.bundles(state),
		client.mintSupply(state.data.boxMint),
		chainTime(client),
	]);

	return {
		template: state.address,
		authority: state.data.authority,
		boxMint: state.data.boxMint,
		status: templateStatus(state.data.status),
		lockedAt: Number(state.data.lockedAt),
		opensAt: Number(state.data.opensAt),
		chainTime: time,
		totalBundles: state.data.totalBundles.toString(),
		totalMinted: state.data.totalMinted.toString(),
		remainingBundles: state.data.remainingBundles.toString(),
		pendingOpenings: state.data.pendingOpenings.toString(),
		supply: supply.toString(),
		revision: state.data.revision.toString(),
		bundles: bundles.map((bundle, index) => ({
			index,
			quantity: bundle.data.quantity.toString(),
			remaining: (state.data.remaining[index] ?? 0n).toString(),
			status: bundle.data.status,
			assets: bundleAssets(bundle.data).map((asset) => ({
				kind: asset.kind ?? "unknown",
				mint: asset.mint,
				amount: asset.amount.toString(),
				decimals: asset.decimals,
			})),
		})),
	};
}

/** Openings of `template` whose prize is bound to `beneficiary`. */
export async function openingsFor(
	rpcUrl: string,
	template: Address,
	beneficiary: Address,
): Promise<ChainOpening[]> {
	const openings = await listTemplateOpenings(
		readClient(rpcUrl).rpc,
		template,
	);

	return openings.filter((opening) => opening.data.beneficiary === beneficiary);
}

/** Can a holder open a box right now? */
export function revealState(
	view: Pick<LootboxChainView, "lockedAt" | "opensAt" | "chainTime" | "status">,
): "unlocked" | "sealed" | "open" | "retired" {
	if (view.lockedAt === 0) {
		return view.status === "retired" ? "retired" : "unlocked";
	}

	return view.chainTime >= view.opensAt ? "open" : "sealed";
}

export type TemplateSummary = Readonly<{
	template: string;
	status: TemplateStatus;
	lockedAt: number;
	opensAt: number;
	chainTime: number;
	/** Unopened prize copies left: the number of boxes that can still win. */
	remaining: string;
	totalBundles: string;
}>;

/** One batched read for many cards (Explore, Home). Missing accounts are skipped. */
export async function readTemplateSummaries(
	rpcUrl: string,
	templates: readonly string[],
): Promise<TemplateSummary[]> {
	const valid = templates.filter((template) => isAddress(template));

	if (valid.length === 0) return [];

	const client = readClient(rpcUrl);
	const [accounts, time] = await Promise.all([
		fetchAllMaybeTemplateState(
			client.rpc,
			valid.map((template) => address(template)),
			{ commitment: "processed" },
		),
		chainTime(client),
	]);

	return accounts.flatMap((account) =>
		account.exists
			? [{
				template: account.address,
				status: templateStatus(account.data.status),
				lockedAt: Number(account.data.lockedAt),
				opensAt: Number(account.data.opensAt),
				chainTime: time,
				remaining: account.data.remainingBundles.toString(),
				totalBundles: account.data.totalBundles.toString(),
			}]
			: []
	);
}
