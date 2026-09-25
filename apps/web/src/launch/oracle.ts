import {
	createSwitchboardOracle,
	type OracleProof,
	type SwitchboardOracle,
} from "@pina-rs/lootbox";
import type { Address } from "@solana/kit";

/**
 * The randomness oracle as the open flow needs it: the SDK's Switchboard
 * gateway on devnet and mainnet, or the Surfpool mock oracle on localnet
 * (`localOracle` in `src/lootbox/playground.ts`), which has the same shape.
 */
export type OracleTransport = SwitchboardOracle;

/** Switchboard On-Demand for a public cluster. */
export function createPublicOracle(
	options: Readonly<{ rpcUrl: string; cluster: "devnet" | "mainnet" }>,
): OracleTransport {
	return createSwitchboardOracle(options);
}

/** How long to wait for the oracle's signed reveal before offering resume. */
export const PROOF_TIMEOUT_MS = {
	localnet: 5_000,
	devnet: 60_000,
	mainnet: 60_000,
} as const;

/**
 * Fetch the reveal proof. The Switchboard transport retries internally while
 * the commit is not yet visible; this bounds the total wait and turns every
 * failure into a recoverable, non-destructive message.
 */
export async function fetchRevealProof(
	oracle: OracleTransport,
	randomness: Address,
	timeoutMs: number,
): Promise<OracleProof> {
	try {
		return await oracle.fetchProof(randomness, {
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (reason) {
		throw new Error(
			`The oracle has not revealed yet. Your burned box is safe; resume to retry. ${
				reason instanceof Error ? reason.message : ""
			}`.trim(),
		);
	}
}
