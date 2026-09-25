/**
 * Settlement relayer: finishes openings a holder started but did not settle,
 * for example because they closed the tab after burning their box.
 *
 *   pnpm --dir sdks/typescript relayer -- --treasury <template> \
 *     --cluster <devnet|mainnet> --keypair <path> [--rpc <url>] \
 *     [--once] [--claim] [--interval-ms 2000]
 *
 * Every poll walks the treasury's pending openings in FIFO order. A committed
 * opening whose seed slot has passed is revealed with the bound oracle's
 * proof and allocated in one transaction; a revealed one is allocated. With
 * `--claim`, allocated prizes are also delivered to the opening's bound
 * beneficiary: claims are permissionless and cannot be redirected, but the
 * relayer then pays the beneficiary's token-account rent. The relayer never
 * forfeits, and it is safe to run next to a browser: when another party
 * settles first, the relayer re-reads the opening and moves on.
 *
 * The keypair pays transaction fees only (plus beneficiary token-account rent
 * with `--claim`). Logs are one JSON object per line.
 */
import {
	type Address,
	address,
	type Base58EncodedBytes,
	getAddressEncoder,
	getBase58Decoder,
	getBase64Encoder,
} from "@solana/kit";
import {
	type ChainOpening,
	type ChainTemplate,
	createSwitchboardOracle,
	getTemplateOpeningStateDecoder,
	LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
	LootboxClient,
	SwitchboardError,
	TEMPLATE_OPENING_STATE_DISCRIMINATOR,
} from "../src/index.js";
import {
	installPatientFetch,
	loadKeypair,
	parseArgs,
	parseCluster,
	verifiedRpcUrl,
} from "./cli.js";

/** `TemplateOpeningState.template` follows the discriminator and version. */
const OPENING_TEMPLATE_OFFSET = 2n;
const STATUS = {
	committed: 0,
	revealed: 1,
	allocated: 2,
} as const;

/** Base58-encode filter bytes. `Base58EncodedBytes` is a nominal brand with
 * no runtime constructor; Kit documents tagging an encoder's output this way.
 */
function base58Bytes(bytes: Uint8Array): Base58EncodedBytes {
	return getBase58Decoder().decode(bytes) as Base58EncodedBytes;
}

type LogFields = Readonly<Record<string, string | number | bigint | boolean>>;

function log(
	level: "info" | "warn" | "error",
	event: string,
	fields: LogFields = {},
) {
	const entry = Object.fromEntries(
		Object.entries(fields).map(([key, value]) => [
			key,
			typeof value === "bigint" ? value.toString() : value,
		]),
	);

	console.log(
		JSON.stringify({ time: new Date().toISOString(), level, event, ...entry }),
	);
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

installPatientFetch();

const args = parseArgs(process.argv.slice(2));
const cluster = parseCluster(args.required("cluster"));
const treasury = address(args.required("treasury"));
const once = args.flag("once");
const claim = args.flag("claim");
const intervalMs = Number(args.optional("interval-ms") ?? "2000");
const rpcUrl = await verifiedRpcUrl(cluster, args.optional("rpc"));
const payer = await loadKeypair(args.required("keypair"));
const client = new LootboxClient(rpcUrl, payer, (message, signature) => {
	if (signature) log("info", "transaction", { step: message, signature });
});
const oracle = createSwitchboardOracle({ rpcUrl, cluster });
const base64 = getBase64Encoder();
let stopping = false;

/** Openings of this treasury that still need settlement, oldest first. */
async function pendingOpenings(): Promise<ChainOpening[]> {
	const accounts = await client.rpc.getProgramAccounts(
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
							new Uint8Array(getAddressEncoder().encode(treasury)),
						),
						encoding: "base58",
					},
				},
			],
		},
	).send();
	const decoder = getTemplateOpeningStateDecoder();

	return accounts
		.map((account) => ({
			address: account.pubkey,
			data: decoder.decode(
				base64.encode(account.account.data[0]),
			),
		}))
		.filter((opening) =>
			opening.data.status < STATUS.allocated ||
			(claim && opening.data.status === STATUS.allocated)
		)
		.sort((left, right) => left.data.sequence < right.data.sequence ? -1 : 1);
}

async function currentStatus(opening: Address) {
	const account = await client.rpc.getAccountInfo(opening, {
		commitment: "processed",
		encoding: "base64",
	}).send();

	if (!account.value) return undefined;

	return getTemplateOpeningStateDecoder().decode(
		base64.encode(account.value.data[0]),
	).status;
}

/** Advance one opening by one lifecycle step. Returns false when the FIFO
 * head is not ready, so later openings wait their turn.
 */
async function advance(
	template: ChainTemplate,
	opening: ChainOpening,
	slot: bigint,
): Promise<boolean> {
	const fields = {
		opening: opening.address,
		sequence: opening.data.sequence,
		status: opening.data.status,
	};

	if (opening.data.status === STATUS.committed) {
		if (slot <= opening.data.seedSlot) {
			log("info", "waiting_for_seed_slot", {
				...fields,
				seedSlot: opening.data.seedSlot,
				slot,
			});
			return false;
		}

		const accounts = await oracle.accountsFor(opening.data.randomness);
		const proof = await oracle.fetchProof(opening.data.randomness);

		await client.settle(template, opening, accounts, proof);
		log("info", "settled", fields);
		return true;
	}

	if (opening.data.status === STATUS.revealed) {
		await client.allocate(template, opening);
		log("info", "allocated", fields);
		return true;
	}

	await client.claim(opening.address);
	log("info", "claimed", { ...fields, beneficiary: opening.data.beneficiary });
	return true;
}

async function poll() {
	const [template, openings, slot] = await Promise.all([
		client.template(treasury),
		pendingOpenings(),
		client.rpc.getSlot({ commitment: "confirmed" }).send(),
	]);

	for (const opening of openings) {
		if (stopping) return;

		try {
			if (!(await advance(template, opening, slot))) return;
		} catch (error) {
			// Another relayer or the holder's browser may have settled first;
			// that is success, not failure.
			const status = await currentStatus(opening.address);

			if (status === undefined || status > opening.data.status) {
				log("info", "settled_elsewhere", {
					opening: opening.address,
					status: status ?? "closed",
				});
				continue;
			}

			log(
				error instanceof SwitchboardError && error.retryable ? "warn" : "error",
				"advance_failed",
				{
					opening: opening.address,
					sequence: opening.data.sequence,
					...(error instanceof SwitchboardError ? { code: error.code } : {}),
					message: errorMessage(error),
				},
			);
			// Keep FIFO order: a stuck head blocks allocation of later openings.
			return;
		}
	}
}

process.on("SIGINT", () => {
	log("info", "stopping");
	stopping = true;
});
process.on("SIGTERM", () => {
	stopping = true;
});

log("info", "started", {
	cluster,
	treasury,
	relayer: payer.address,
	claim,
	once,
});

while (!stopping) {
	try {
		await poll();
	} catch (error) {
		log("error", "poll_failed", { message: errorMessage(error) });
	}

	if (once) break;

	await new Promise((done) => setTimeout(done, intervalMs));
}

log("info", "stopped");
