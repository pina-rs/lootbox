/**
 * Settlement relaying: finish template openings in FIFO order.
 *
 * A holder who closes the tab after `requestOpen` has burned their box but not
 * revealed it. Anyone may reveal, allocate, and deliver that opening, and the
 * program pins the recipient, so a relayer can never redirect a prize. This
 * module is the shared core of the `relayer` script, hosted cron relayers, and
 * browsers that must settle earlier openings before their own.
 *
 * The relayer never forfeits. It is safe to run beside other relayers: when a
 * step fails because someone else advanced the opening first, it re-reads the
 * opening and reports `settledElsewhere` instead of an error.
 */
import {
	getTemplateOpeningStateDecoder,
	LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
	TEMPLATE_OPENING_STATE_DISCRIMINATOR,
} from "@pina-rs/lootbox-program-client";
import {
	type Address,
	type Base58EncodedBytes,
	getAddressEncoder,
	getBase58Decoder,
	getBase64Encoder,
} from "@solana/kit";
import type {
	ChainOpening,
	ChainTemplate,
	LootboxClient,
	OracleAccounts,
	OracleProof,
} from "./client.js";

/** `TemplateOpeningState.template` follows the discriminator and version. */
const OPENING_TEMPLATE_OFFSET = 2n;

/** Opening lifecycle values recorded by the program. */
export const OPENING_STATUS = {
	committed: 0,
	revealed: 1,
	allocated: 2,
	delivered: 3,
	forfeited: 4,
} as const;

/** The part of an oracle transport a relayer needs. */
export type RelayerOracle = Readonly<{
	accountsFor(randomness: Address): Promise<OracleAccounts>;
	fetchProof(randomness: Address): Promise<OracleProof>;
}>;

export type RelayerEvent =
	| Readonly<
		{
			kind: "waitingForSeedSlot";
			opening: Address;
			sequence: bigint;
			seedSlot: bigint;
			slot: bigint;
		}
	>
	| Readonly<
		{
			kind: "settled" | "allocated" | "claimed";
			opening: Address;
			sequence: bigint;
		}
	>
	| Readonly<
		{ kind: "settledElsewhere"; opening: Address; status: number | "closed" }
	>
	| Readonly<
		{ kind: "failed"; opening: Address; sequence: bigint; error: unknown }
	>;

export type RelayOptions = Readonly<{
	client: LootboxClient;
	oracle: RelayerOracle;
	template: Address;
	/** Also deliver allocated prizes to their bound beneficiary. */
	claim?: boolean;
	/** Stop after this opening has advanced past allocation. */
	until?: Address;
	onEvent?: (event: RelayerEvent) => void;
	shouldStop?: () => boolean;
}>;

export type RelayResult = Readonly<{
	/** Openings this pass advanced by at least one step. */
	advanced: number;
	/** True when a FIFO head could not advance (seed slot or failure). */
	blocked: boolean;
}>;

/** Base58-encode filter bytes. `Base58EncodedBytes` is a nominal brand with
 * no runtime constructor; Kit documents tagging an encoder's output this way.
 */
function base58Bytes(bytes: Uint8Array): Base58EncodedBytes {
	return getBase58Decoder().decode(bytes) as Base58EncodedBytes;
}

/** Every opening of `template` still on chain, oldest request first. */
export async function listTemplateOpenings(
	rpc: LootboxClient["rpc"],
	template: Address,
): Promise<ChainOpening[]> {
	const accounts = await rpc.getProgramAccounts(
		LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
		{
			commitment: "confirmed",
			encoding: "base64",
			filters: [
				{
					memcmp: {
						offset: 0n,
						bytes: base58Bytes(
							new Uint8Array([TEMPLATE_OPENING_STATE_DISCRIMINATOR]),
						),
						encoding: "base58",
					},
				},
				{
					memcmp: {
						offset: OPENING_TEMPLATE_OFFSET,
						bytes: base58Bytes(
							new Uint8Array(getAddressEncoder().encode(template)),
						),
						encoding: "base58",
					},
				},
			],
		},
	).send();
	const decoder = getTemplateOpeningStateDecoder();
	const base64 = getBase64Encoder();

	return accounts
		.map((account) => ({
			address: account.pubkey,
			data: decoder.decode(base64.encode(account.account.data[0])),
		}))
		.sort((left, right) => left.data.sequence < right.data.sequence ? -1 : 1);
}

async function readOpening(
	client: LootboxClient,
	opening: Address,
): Promise<ChainOpening | null> {
	const account = await client.rpc.getAccountInfo(opening, {
		commitment: "processed",
		encoding: "base64",
	}).send();

	if (!account.value) return null;

	return {
		address: opening,
		data: getTemplateOpeningStateDecoder().decode(
			getBase64Encoder().encode(account.value.data[0]),
		),
	};
}

/** Advance one opening by one lifecycle step. Returns false when the FIFO
 * head is not ready, so later openings wait their turn.
 */
async function advance(
	options: RelayOptions,
	template: ChainTemplate,
	opening: ChainOpening,
	slot: bigint,
): Promise<boolean> {
	const { client, oracle, onEvent } = options;
	const base = { opening: opening.address, sequence: opening.data.sequence };

	if (opening.data.status === OPENING_STATUS.committed) {
		if (slot <= opening.data.seedSlot) {
			onEvent?.({
				kind: "waitingForSeedSlot",
				...base,
				seedSlot: opening.data.seedSlot,
				slot,
			});
			return false;
		}

		const accounts = await oracle.accountsFor(opening.data.randomness);
		const proof = await oracle.fetchProof(opening.data.randomness);

		await client.settle(template, opening, accounts, proof);
		onEvent?.({ kind: "settled", ...base });
		return true;
	}

	if (opening.data.status === OPENING_STATUS.revealed) {
		await client.allocate(template, opening);
		onEvent?.({ kind: "allocated", ...base });
		return true;
	}

	await client.claim(opening.address);
	onEvent?.({ kind: "claimed", ...base });
	return true;
}

function needsWork(opening: ChainOpening, claim: boolean): boolean {
	return opening.data.status < OPENING_STATUS.allocated ||
		(claim && opening.data.status === OPENING_STATUS.allocated);
}

/**
 * Walk one template's openings in FIFO order and advance each until the queue
 * is settled, a head is not ready, or `until` has been allocated.
 */
export async function relayTemplateOpenings(
	options: RelayOptions,
): Promise<RelayResult> {
	const { client, claim = false, until, onEvent, shouldStop } = options;
	let template = await client.template(options.template);
	let advanced = 0;

	// Performance: most treasuries are idle; skip the account scan for them.
	if (!claim && template.data.pendingOpenings === 0n) {
		return { advanced, blocked: false };
	}

	const [openings, slot] = await Promise.all([
		listTemplateOpenings(client.rpc, options.template),
		client.rpc.getSlot({ commitment: "confirmed" }).send(),
	]);

	for (const snapshot of openings) {
		if (shouldStop?.()) return { advanced, blocked: false };

		let opening: ChainOpening | null = snapshot;

		while (opening && needsWork(opening, claim)) {
			try {
				if (!(await advance(options, template, opening, slot))) {
					return { advanced, blocked: true };
				}

				advanced += 1;
			} catch (error) {
				// Another relayer or the holder's browser may have advanced it
				// first; that is progress, not failure.
				const current = await readOpening(client, opening.address);

				if (!current || current.data.status > opening.data.status) {
					onEvent?.({
						kind: "settledElsewhere",
						opening: opening.address,
						status: current?.data.status ?? "closed",
					});
				} else {
					onEvent?.({
						kind: "failed",
						opening: opening.address,
						sequence: opening.data.sequence,
						error,
					});
					// Keep FIFO order: a stuck head blocks later allocations.
					return { advanced, blocked: true };
				}
			}

			opening = await readOpening(client, opening.address);
			template = await client.template(options.template);
		}

		if (until === snapshot.address) return { advanced, blocked: false };
	}

	return { advanced, blocked: false };
}
