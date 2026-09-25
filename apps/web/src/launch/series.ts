import {
	bundleAssets,
	type ChainOpening,
	type ChainTemplate,
	decodeTemplateText,
	fetchTemplateOpeningState,
	isTreasuryLocked,
	LootboxClient,
} from "@pina-rs/lootbox";
import { fetchMaybeMint } from "@solana-program/token-2022";
import { type Address, createNoopSigner } from "@solana/kit";

import { type RecordedResult } from "./openingMachine.js";
import { fetchRevealProof, type OracleTransport } from "./oracle.js";
import {
	type BundleSummary,
	type PrizeTier,
	type TokenLabel,
} from "./prizes.js";

/** Everything the recipient page reads about one locked series. */
export type SeriesSnapshot = Readonly<{
	template: ChainTemplate;
	name: string;
	/** Reveal time in unix milliseconds, from the template's `opensAt`. */
	revealAt: number;
	/** Chain clock minus wall clock, so countdowns follow the chain. */
	clockSkewMs: number;
	locked: boolean;
	bundles: readonly BundleSummary[];
	remaining: readonly bigint[];
	/** On-mint metadata for prize tokens, keyed by mint. */
	labels: ReadonlyMap<string, TokenLabel>;
}>;

/** A read-only client: reads never need the viewer's wallet. */
export function readClient(rpcUrl: string, treasury: Address): LootboxClient {
	return new LootboxClient(rpcUrl, createNoopSigner(treasury));
}

export async function loadSeries(
	client: LootboxClient,
	treasury: Address,
): Promise<SeriesSnapshot> {
	const template = await client.template(treasury);
	const [bundles, slot] = await Promise.all([
		client.bundles(template),
		client.rpc.getSlot({ commitment: "processed" }).send(),
	]);
	const chainTime = await client.rpc.getBlockTime(slot).send();
	const summaries = bundles.map((bundle) => ({
		index: bundle.data.index,
		quantity: bundle.data.quantity,
		assets: bundleAssets(bundle.data).map((asset) => ({
			kind: asset.kind ?? "unknown",
			mint: asset.mint,
			amount: asset.amount,
			decimals: asset.decimals,
		})),
	}));
	const tokenMints = new Set(
		summaries.flatMap((bundle) =>
			bundle.assets.filter((asset) =>
				asset.kind === "token" || asset.kind === "token2022"
			).map((asset) => asset.mint)
		),
	);
	const labels = await loadTokenLabels(client, [...tokenMints]);

	return Object.freeze({
		template,
		name: decodeTemplateText(template.data.name),
		revealAt: Number(template.data.opensAt) * 1000,
		clockSkewMs: chainTime === null ? 0 : Number(chainTime) * 1000 - Date.now(),
		locked: isTreasuryLocked(template.data),
		bundles: summaries,
		remaining: template.data.remaining,
		labels,
	});
}

/** Openings bound to `owner` that still need a reveal or a claim. */
export async function unfinishedOpenings(
	client: LootboxClient,
	treasury: Address,
	owner: Address,
): Promise<ChainOpening[]> {
	const { openings } = await client.inventory();

	return openings.filter((opening) =>
		opening.data.template === treasury &&
		opening.data.beneficiary === owner && opening.data.status < 3
	).sort((left, right) => left.data.sequence < right.data.sequence ? -1 : 1);
}

async function readOpening(client: LootboxClient, opening: Address) {
	return fetchTemplateOpeningState(client.rpc, opening, {
		commitment: "processed",
	});
}

/**
 * Settle one pending opening: verify the oracle proof and allocate its prize.
 *
 * Settlement is permissionless. If another relayer wins the race, the opening
 * has still progressed, so a failed transaction is re-read before surfacing.
 */
async function settleOne(
	client: LootboxClient,
	oracle: OracleTransport,
	opening: ChainOpening,
	proofTimeoutMs: number,
): Promise<void> {
	const template = await client.template(opening.data.template);

	try {
		if (opening.data.status === 1) {
			await client.allocate(template, opening);
			return;
		}

		const accounts = await oracle.accountsFor(opening.data.randomness);
		const proof = await fetchRevealProof(
			oracle,
			opening.data.randomness,
			proofTimeoutMs,
		);

		await client.settle(template, opening, accounts, proof);
	} catch (reason) {
		const current = await readOpening(client, opening.address);

		if (current.data.status >= 2) return;

		throw reason;
	}
}

/**
 * Drive the FIFO queue until `target` is allocated.
 *
 * Allocation is first-in, first-out, so earlier pending openings (anyone's)
 * are cranked first. Each step re-reads chain state; nothing is resubmitted
 * blindly and no box is burned here.
 */
export async function settleThrough(
	client: LootboxClient,
	oracle: OracleTransport,
	target: Address,
	proofTimeoutMs: number,
): Promise<ChainOpening> {
	for (let step = 0; step < 64; step++) {
		const current = await readOpening(client, target);

		if (current.data.status >= 2) return current;

		const template = await client.template(current.data.template);
		const head = current.data.sequence === template.data.nextAllocation
			? current
			: (await client.inventory()).openings.find((opening) =>
				opening.data.template === template.address &&
				opening.data.sequence === template.data.nextAllocation
			);

		if (!head) throw new Error("The opening queue head is missing");

		await settleOne(client, oracle, head, proofTimeoutMs);
	}

	throw new Error("The opening queue did not advance. Try resuming shortly.");
}

export function recordedResult(
	opening: ChainOpening,
	tierOf: (bundleIndex: number) => PrizeTier,
	signature: string | null,
): RecordedResult {
	return Object.freeze({
		opening: opening.address,
		bundleIndex: opening.data.selectedBundle,
		tier: tierOf(opening.data.selectedBundle),
		signature,
	});
}

/**
 * Burn one box and commit oracle randomness. Returns the new opening.
 *
 * The oracle derives its accounts from the fresh randomness account and the
 * `recent_slot` the SDK picks, so it is passed as a resolver.
 */
export async function commitOpen(
	client: LootboxClient,
	oracle: OracleTransport,
	template: ChainTemplate,
): Promise<ChainOpening> {
	return client.requestOpen(
		template,
		(binding) => oracle.selectAccounts(binding),
	);
}

/**
 * Read on-mint Token-2022 metadata for prize mints the price book does not
 * know, so test and unlisted tokens still show a readable name. Mints without
 * metadata (or classic SPL mints) are simply absent from the result.
 */
export async function loadTokenLabels(
	client: LootboxClient,
	mints: readonly Address[],
): Promise<ReadonlyMap<string, TokenLabel>> {
	const labels = new Map<string, TokenLabel>();

	if (mints.length === 0) return labels;

	// One mint with an extension this decoder cannot read must not hide the
	// labels of the others, so each mint is fetched and decoded on its own.
	const settled = await Promise.allSettled(
		mints.map((mint) =>
			fetchMaybeMint(client.rpc, mint, { commitment: "processed" })
		),
	);
	const accounts = settled.flatMap((result) =>
		result.status === "fulfilled" ? [result.value] : []
	);

	for (const account of accounts) {
		if (!account.exists || account.data.extensions.__option !== "Some") {
			continue;
		}

		for (const extension of account.data.extensions.value) {
			if (extension.__kind !== "TokenMetadata") continue;

			labels.set(account.address, {
				name: extension.name,
				symbol: extension.symbol,
			});
		}
	}

	return labels;
}
