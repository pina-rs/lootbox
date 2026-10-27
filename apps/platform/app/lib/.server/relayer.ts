/**
 * The cron settlement relayer.
 *
 * Every minute it walks the openings of each lootbox on a relayer-enabled
 * cluster and finishes the ones a holder abandoned after burning a box, so the
 * program's 300-slot timeout never forfeits them. It uses the SDK's
 * `relayTemplateOpenings`, which never forfeits, never redirects a prize, and
 * treats a race lost to the holder's browser as progress.
 *
 * Idempotency comes from the chain: every step re-reads the opening first. A
 * D1 lease additionally stops two overlapping cron runs from paying twice for
 * the same failed transaction.
 */
import {
	createSwitchboardOracle,
	fetchBoundedText,
	LootboxClient,
	type OracleProof,
	type RelayerEvent,
	type RelayerOracle,
	relayTemplateOpenings,
} from "@pina-rs/lootbox";
import {
	address,
	createKeyPairSignerFromBytes,
	getBase58Encoder,
	type KeyPairSigner,
} from "@solana/kit";

import type { Cluster } from "../clusters.js";
import {
	acquireLease,
	lootboxesOnClusters,
	recordRelayerEvent,
	relayerCursor,
	releaseLease,
	saveRelayerCursor,
} from "./db.js";
import {
	localControlConfig,
	rpcUrlFor,
	type ServerConfig,
	type WorkerEnv,
} from "./env.js";
import { RELAYER_RUN_LIMITS, relayerBudget } from "./relayer-budget.js";
import { relayerRpc } from "./relayer-rpc.js";

const LEASE = "relayer";
/** A run that has not finished in four minutes is assumed dead. */
const LEASE_TTL_SECONDS = 240;

/** Parse a base58 64-byte secret key or a JSON byte array. */
export async function relayerSigner(secret: string): Promise<KeyPairSigner> {
	const trimmed = secret.trim();
	const bytes = trimmed.startsWith("[")
		? Uint8Array.from(JSON.parse(trimmed) as number[])
		: new Uint8Array(getBase58Encoder().encode(trimmed));

	if (bytes.length !== 64) {
		throw new Error("RELAYER_SECRET_KEY must be a 64-byte Solana secret key");
	}

	return createKeyPairSignerFromBytes(bytes);
}

function proofBytes(value: unknown, length: number): Uint8Array {
	if (
		!Array.isArray(value) || value.length !== length ||
		!value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte < 256)
	) throw new Error("malformed emulator proof");

	return Uint8Array.from(value as number[]);
}

/** Proof from the loopback Surfpool emulator. Localnet only. */
export async function localProof(
	controlUrl: string,
	randomness: string,
	signal?: AbortSignal,
): Promise<OracleProof> {
	const { response, text } = await fetchBoundedText(
		`${controlUrl}/proof?randomness=${encodeURIComponent(randomness)}`,
		signal ? { signal } : {},
		{ maxBytes: 16 * 1024, timeoutMs: 8_000 },
	);
	const body: unknown = JSON.parse(text);

	if (
		!response.ok || typeof body !== "object" || body === null ||
		Reflect.get(body, "testOnly") !== true
	) throw new Error("the local oracle emulator refused the proof request");

	return {
		signature: proofBytes(Reflect.get(body, "signature"), 64),
		recoveryId: Number(Reflect.get(body, "recoveryId")),
		value: proofBytes(Reflect.get(body, "value"), 32),
	};
}

async function oracleFor(
	config: ServerConfig,
	cluster: Cluster,
	rpcUrl: string,
	signal: AbortSignal,
): Promise<RelayerOracle> {
	if (cluster !== "localnet") {
		const fetcher: typeof fetch = (input, init) =>
			fetch(input, {
				...init,
				signal: AbortSignal.any([
					signal,
					...(init?.signal ? [init.signal] : []),
				]),
			});
		const oracle = createSwitchboardOracle({ rpcUrl, cluster, fetch: fetcher });

		return {
			accountsFor: (randomness) => oracle.accountsFor(randomness, { signal }),
			fetchProof: (randomness) => oracle.fetchProof(randomness, { signal }),
		};
	}

	const local = await localControlConfig(config);
	const controlUrl = config.localnetControlUrl ?? "";
	const accounts = {
		queue: address(local.oracle.queue),
		oracle: address(local.oracle.oracle),
		programState: address(local.oracle.programState),
		lutSigner: address(local.oracle.lutSigner),
		lut: address(local.oracle.lut),
		stats: address(local.oracle.stats),
	};

	return {
		accountsFor: () => Promise.resolve(accounts),
		fetchProof: (randomness) => localProof(controlUrl, randomness, signal),
	};
}

function describe(event: RelayerEvent): string {
	if (event.kind === "failed") {
		return event.error instanceof Error ? event.error.message : "failed";
	}

	if (event.kind === "settledElsewhere") return `status ${event.status}`;

	return "";
}

export type RelayerRun = Readonly<{
	ran: boolean;
	lootboxes: number;
	advanced: number;
}>;

export async function runRelayer(
	env: WorkerEnv,
	config: ServerConfig,
	now: () => number,
): Promise<RelayerRun> {
	const secret = env.RELAYER_SECRET_KEY;

	if (!secret || config.relayerClusters.length === 0) {
		return { ran: false, lootboxes: 0, advanced: 0 };
	}

	// Permissionless claim callers pay beneficiary-account rent. Hosted runs
	// only settle/allocate until a claim can enforce an on-chain debit cap.
	if (config.relayerClaim) {
		throw new Error("Hosted relayers require RELAYER_CLAIM=false");
	}

	const holder = crypto.randomUUID();
	const signal = AbortSignal.timeout(
		RELAYER_RUN_LIMITS.durationSeconds * 1000,
	);
	const budget = relayerBudget(now, signal);

	if (!(await acquireLease(env.DB, LEASE, holder, now(), LEASE_TTL_SECONDS))) {
		return { ran: false, lootboxes: 0, advanced: 0 };
	}

	try {
		signal.throwIfAborted();
		const signer = await relayerSigner(secret);
		const cursor = await relayerCursor(env.DB);
		let lootboxes = await lootboxesOnClusters(
			env.DB,
			config.relayerClusters,
			cursor,
			RELAYER_RUN_LIMITS.lootboxes,
		);

		if (lootboxes.length === 0 && cursor !== 0) {
			lootboxes = await lootboxesOnClusters(
				env.DB,
				config.relayerClusters,
				0,
				RELAYER_RUN_LIMITS.lootboxes,
			);
		}

		let advanced = 0;
		let visited = 0;

		for (const lootbox of lootboxes) {
			if (budget.shouldStop()) break;

			await saveRelayerCursor(env.DB, lootbox.id);
			visited += 1;
			const localBudget = budget.forLootbox();
			const rpcUrl = await rpcUrlFor(config, lootbox.cluster);
			const lut = config.programLuts[lootbox.cluster];
			const rpc = relayerRpc(rpcUrl, signal);

			const client = new LootboxClient(rpcUrl, signer, undefined, {
				rpc,
				abortSignal: signal,
				beforeTransaction: localBudget.reserve,
				...(lut ? { lookupTableAddresses: [address(lut)] } : {}),
			});
			const events: RelayerEvent[] = [];
			const result = await relayTemplateOpenings({
				client,
				oracle: await oracleFor(config, lootbox.cluster, rpcUrl, signal),
				template: address(lootbox.template),
				claim: false,
				shouldStop: localBudget.shouldStop,
				onEvent: (event) => events.push(event),
			}).catch((error: unknown) => {
				console.error("relayer pass failed", lootbox.slug, error);

				return { advanced: 0, blocked: true };
			});

			advanced += result.advanced;

			for (const event of events) {
				if (event.kind === "waitingForSeedSlot") continue;

				await recordRelayerEvent(env.DB, {
					lootboxId: lootbox.id,
					opening: event.opening,
					kind: event.kind,
					message: describe(event),
				}, now());
			}
		}

		return { ran: true, lootboxes: visited, advanced };
	} finally {
		await releaseLease(env.DB, LEASE, holder);
	}
}
