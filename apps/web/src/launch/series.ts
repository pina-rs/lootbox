import {
	bundleAssets,
	type ChainOpening,
	type ChainTemplate,
	decodeTemplateText,
	fetchTemplateOpeningState,
	isTreasuryLocked,
	LootboxClient,
} from "@pina-rs/lootbox";
import { type Address, createNoopSigner } from "@solana/kit";

import { type RecordedResult } from "./openingMachine.js";
import { type OracleTransport, waitForProof } from "./oracle.js";
import { type BundleSummary, type PrizeTier } from "./prizes.js";

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

	return Object.freeze({
		template,
		name: decodeTemplateText(template.data.name),
		revealAt: Number(template.data.opensAt) * 1000,
		clockSkewMs: chainTime === null ? 0 : Number(chainTime) * 1000 - Date.now(),
		locked: isTreasuryLocked(template.data),
		bundles: bundles.map((bundle) => ({
			index: bundle.data.index,
			quantity: bundle.data.quantity,
			assets: bundleAssets(bundle.data).map((asset) => ({
				kind: asset.kind ?? "unknown",
				mint: asset.mint,
				amount: asset.amount,
				decimals: asset.decimals,
			})),
		})),
		remaining: template.data.remaining,
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
	proofAttempts: number,
): Promise<void> {
	const template = await client.template(opening.data.template);

	try {
		if (opening.data.status === 1) {
			await client.allocate(template, opening);
			return;
		}

		const proof = await waitForProof(oracle, opening.data.randomness, {
			attempts: proofAttempts,
		});
		const accounts = await oracle.accountsFor(opening.data.randomness);

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
	proofAttempts = 40,
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

		await settleOne(client, oracle, head, proofAttempts);
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
 * ORACLE WIRING POINT (2 of 2). The gateway branch lets `requestOpen` take a
 * resolver so the oracle derives per-randomness lookup-table accounts:
 *
 * ```ts
 * return client.requestOpen(template, (binding) => oracle.selectAccounts(binding));
 * ```
 *
 * The SDK on this branch only takes fixed accounts, which is correct for the
 * localnet mock (its accounts do not depend on the randomness account).
 */
export async function commitOpen(
	client: LootboxClient,
	oracle: OracleTransport,
	template: ChainTemplate,
): Promise<ChainOpening> {
	const recentSlot = await client.rpc.getSlot({ commitment: "finalized" })
		.send();
	// The SDK generates the randomness account inside `requestOpen`, so this
	// binding is a placeholder. Only the localnet mock is reachable here; a
	// real Switchboard oracle must go through the resolver form above.
	const accounts = await oracle.selectAccounts({
		randomness: template.address,
		recentSlot,
	});

	return client.requestOpen(template, accounts);
}
