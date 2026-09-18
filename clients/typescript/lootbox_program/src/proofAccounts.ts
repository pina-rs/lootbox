import {
	AccountRole,
	type AccountMeta,
	type Address,
	type Instruction,
	type InstructionWithAccounts,
} from "@solana/kit";

type InstructionWithAccountList<TProgram extends string> = Instruction<TProgram> &
	InstructionWithAccounts<readonly AccountMeta[]>;

/** Largest proof tail accepted by the on-chain Bubblegum adapter. */
export const MAX_BUBBLEGUM_PROOF_ACCOUNTS = 16;

/**
 * Replace the scalar placeholder emitted for a Pina `remaining` account with
 * the real Bubblegum proof. Empty proofs are valid for full-canopy trees.
 */
export function withBubblegumProofAccounts<TProgram extends string>(
	instruction: InstructionWithAccountList<TProgram>,
	proofAccounts: readonly Address[],
): InstructionWithAccountList<TProgram> {
	if (proofAccounts.length > MAX_BUBBLEGUM_PROOF_ACCOUNTS) {
		throw new RangeError(
			`Bubblegum proofs may contain at most ${MAX_BUBBLEGUM_PROOF_ACCOUNTS} accounts`,
		);
	}
	if (instruction.accounts.length === 0) {
		throw new RangeError("instruction has no generated proof placeholder");
	}
	return Object.freeze({
		...instruction,
		accounts: Object.freeze([
			...instruction.accounts.slice(0, -1),
			...proofAccounts.map((address) =>
				Object.freeze({ address, role: AccountRole.READONLY })
			),
		]),
	});
}
