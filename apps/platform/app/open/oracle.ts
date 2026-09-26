/**
 * The randomness oracle as the browser sees it: real Switchboard on devnet
 * and mainnet, the Surfpool emulator (through our loopback-only proxy) on
 * localnet. Both expose the SDK's `SwitchboardOracle` shape.
 */
import {
	createSwitchboardOracle,
	type OracleProof,
	type SwitchboardOracle,
} from "@pina-rs/lootbox";
import { type Address, address } from "@solana/kit";

import type { ClusterInfo } from "../lib/clusters.js";

/** How long to wait for a reveal proof before offering to resume. */
const PROOF_TIMEOUT_MS = {
	localnet: 10_000,
	devnet: 60_000,
	mainnet: 60_000,
} as const;

function bytes(value: unknown, length: number): Uint8Array {
	if (
		!Array.isArray(value) || value.length !== length ||
		!value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte < 256)
	) throw new Error("Malformed oracle proof");

	return Uint8Array.from(value as number[]);
}

async function localProof(randomness: Address): Promise<OracleProof> {
	const response = await fetch(`/api/local/proof?randomness=${randomness}`);
	const body: unknown = await response.json();

	if (!response.ok || typeof body !== "object" || body === null) {
		throw new Error("The local oracle has not revealed yet");
	}

	return {
		signature: bytes(Reflect.get(body, "signature"), 64),
		recoveryId: Number(Reflect.get(body, "recoveryId")),
		value: bytes(Reflect.get(body, "value"), 32),
	};
}

export function oracleTransport(cluster: ClusterInfo): SwitchboardOracle {
	if (cluster.cluster !== "localnet") {
		const oracle = createSwitchboardOracle({
			rpcUrl: cluster.rpcUrl,
			cluster: cluster.cluster,
		});
		const timeout = PROOF_TIMEOUT_MS[cluster.cluster];

		return {
			...oracle,
			fetchProof: (randomness, options) =>
				oracle.fetchProof(randomness, {
					...options,
					signal: options?.signal ?? AbortSignal.timeout(timeout),
				}),
		};
	}

	const local = cluster.localOracle;

	if (!local) throw new Error("The local oracle is not configured");

	const accounts = {
		queue: address(local.queue),
		oracle: address(local.oracle),
		programState: address(local.programState),
		lutSigner: address(local.lutSigner),
		lut: address(local.lut),
		stats: address(local.stats),
	};

	return {
		programId: address("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"),
		queue: accounts.queue,
		selectAccounts: () => Promise.resolve(accounts),
		accountsFor: () => Promise.resolve(accounts),
		fetchProof: localProof,
	};
}
