import type { OracleAccounts, OracleProof } from "@pina-rs/lootbox";
import type { Address } from "@solana/kit";

import type { Cluster } from "./config.js";

/** The fresh randomness account and `recent_slot` an opening commits to. */
export type RandomnessBinding = Readonly<{
	randomness: Address;
	recentSlot: bigint;
}>;

/** Retry policy for proof fetching, mirroring the gateway's options. */
export type FetchProofOptions = Readonly<{
	retry?: Readonly<{
		attempts: number;
		initialDelayMs: number;
		maxDelayMs: number;
	}>;
	signal?: AbortSignal;
}>;

/**
 * The randomness oracle as the open flow needs it.
 *
 * This mirrors the `SwitchboardOracle` shape being added to
 * `sdks/typescript/src/switchboard.ts` on `feat/switchboard-gateway`, so the
 * real gateway drops in without adapters. Localnet injects the Surfpool mock
 * oracle from `src/lootbox/playground.ts` instead.
 */
export type OracleTransport = Readonly<{
	programId: Address;
	queue: Address;
	/** Pick an oracle and derive the accounts for a new randomness account. */
	selectAccounts(binding: RandomnessBinding): Promise<OracleAccounts>;
	/** Recover the oracle accounts bound to an existing randomness account. */
	accountsFor(randomness: Address): Promise<OracleAccounts>;
	/** Fetch the signed reveal. Rejects until the oracle has revealed. */
	fetchProof(
		randomness: Address,
		options?: FetchProofOptions,
	): Promise<OracleProof>;
}>;

export class OracleUnavailableError extends Error {
	constructor(cluster: Cluster) {
		super(
			`Switchboard randomness is not wired for ${cluster} in this build yet. Boxes stay safe in your wallet.`,
		);
		this.name = "OracleUnavailableError";
	}
}

/**
 * ORACLE WIRING POINT (1 of 2; see `commitOpen` in series.ts for 2 of 2).
 * After `feat/switchboard-gateway` merges, replace this body with:
 *
 * ```ts
 * import { createSwitchboardOracle } from "@pina-rs/lootbox";
 * return createSwitchboardOracle({ rpcUrl, cluster });
 * ```
 *
 * Until then public clusters report an explicit, non-destructive error before
 * any box is burned.
 */
export function createPublicOracle(
	_options: Readonly<{ rpcUrl: string; cluster: "devnet" | "mainnet" }>,
): OracleTransport | null {
	return null;
}

/** Retry `fetchProof` until the oracle reveals or the attempts run out. */
export async function waitForProof(
	oracle: OracleTransport,
	randomness: Address,
	options: Readonly<{ attempts?: number; delayMs?: number }> = {},
): Promise<OracleProof> {
	const attempts = options.attempts ?? 40;
	const delayMs = options.delayMs ?? 750;
	let lastError: unknown = null;

	for (let attempt = 0; attempt < attempts; attempt++) {
		try {
			return await oracle.fetchProof(randomness);
		} catch (reason) {
			lastError = reason;
		}

		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	throw new Error(
		`The oracle has not revealed yet. Your burned box is safe; resume to retry. ${
			lastError instanceof Error ? lastError.message : ""
		}`.trim(),
	);
}
