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
import { address } from "@solana/kit";
import {
	createSwitchboardOracle,
	LootboxClient,
	relayTemplateOpenings,
	SwitchboardError,
} from "../src/index.js";
import {
	installPatientFetch,
	loadKeypair,
	parseArgs,
	parseCluster,
	verifiedRpcUrl,
} from "./cli.js";

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
let stopping = false;

async function poll() {
	await relayTemplateOpenings({
		client,
		oracle,
		template: treasury,
		claim,
		shouldStop: () => stopping,
		onEvent(event) {
			switch (event.kind) {
				case "waitingForSeedSlot":
					log("info", "waiting_for_seed_slot", {
						opening: event.opening,
						sequence: event.sequence,
						seedSlot: event.seedSlot,
						slot: event.slot,
					});
					return;
				case "settledElsewhere":
					log("info", "settled_elsewhere", {
						opening: event.opening,
						status: event.status,
					});
					return;
				case "failed":
					log(
						event.error instanceof SwitchboardError && event.error.retryable
							? "warn"
							: "error",
						"advance_failed",
						{
							opening: event.opening,
							sequence: event.sequence,
							...(event.error instanceof SwitchboardError
								? { code: event.error.code }
								: {}),
							message: errorMessage(event.error),
						},
					);
					return;
				default:
					log("info", event.kind, {
						opening: event.opening,
						sequence: event.sequence,
					});
			}
		},
	});
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
