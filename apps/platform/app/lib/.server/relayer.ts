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
	releaseLease,
} from "./db.js";
import {
	localControlConfig,
	rpcUrlFor,
	type ServerConfig,
	type WorkerEnv,
} from "./env.js";

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
): Promise<OracleProof> {
	const response = await fetch(
		`${controlUrl}/proof?randomness=${encodeURIComponent(randomness)}`,
	);
	const body: unknown = await response.json();

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
): Promise<RelayerOracle> {
	if (cluster !== "localnet") {
		return createSwitchboardOracle({ rpcUrl, cluster });
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
		fetchProof: (randomness) => localProof(controlUrl, randomness),
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

	const holder = crypto.randomUUID();

	if (!(await acquireLease(env.DB, LEASE, holder, now(), LEASE_TTL_SECONDS))) {
		return { ran: false, lootboxes: 0, advanced: 0 };
	}

	try {
		const signer = await relayerSigner(secret);
		const lootboxes = await lootboxesOnClusters(
			env.DB,
			config.relayerClusters,
		);
		let advanced = 0;

		for (const lootbox of lootboxes) {
			const rpcUrl = await rpcUrlFor(config, lootbox.cluster);
			const client = new LootboxClient(rpcUrl, signer);
			const events: RelayerEvent[] = [];
			const result = await relayTemplateOpenings({
				client,
				oracle: await oracleFor(config, lootbox.cluster, rpcUrl),
				template: address(lootbox.template),
				claim: config.relayerClaim,
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

		return { ran: true, lootboxes: lootboxes.length, advanced };
	} finally {
		await releaseLease(env.DB, LEASE, holder);
	}
}
