//! Off-chain helpers for variable-length Bubblegum proof accounts.

use solana_instruction::AccountMeta;
use solana_instruction::Instruction;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

/// Largest proof tail accepted by the on-chain Bubblegum adapter.
pub const MAX_BUBBLEGUM_PROOF_ACCOUNTS: usize = 16;

/// Replaces the scalar placeholder emitted for a Pina `remaining` account with
/// the real Bubblegum proof. Empty proofs are valid for full-canopy trees.
pub fn with_bubblegum_proof_accounts(
	mut instruction: Instruction,
	proof_accounts: &[Pubkey],
) -> Result<Instruction, ProgramError> {
	if proof_accounts.len() > MAX_BUBBLEGUM_PROOF_ACCOUNTS {
		return Err(ProgramError::InvalidArgument);
	}
	instruction
		.accounts
		.pop()
		.ok_or(ProgramError::NotEnoughAccountKeys)?;
	instruction.accounts.extend(
		proof_accounts
			.iter()
			.map(|address| AccountMeta::new_readonly(*address, false)),
	);
	Ok(instruction)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn replaces_placeholder_with_zero_or_many_proof_nodes() {
		let program_id = Pubkey::new_unique();
		let fixed = Pubkey::new_unique();
		let placeholder = Pubkey::new_unique();
		let base = Instruction::new_with_bytes(
			program_id,
			&[1],
			vec![
				AccountMeta::new(fixed, true),
				AccountMeta::new_readonly(placeholder, false),
			],
		);
		let empty = with_bubblegum_proof_accounts(base.clone(), &[]).expect("empty proof");
		assert_eq!(empty.accounts, vec![AccountMeta::new(fixed, true)]);

		let proof = [Pubkey::new_unique(), Pubkey::new_unique()];
		let expanded = with_bubblegum_proof_accounts(base, &proof).expect("proof");
		assert_eq!(expanded.accounts.len(), 3);
		assert_eq!(expanded.accounts[1].pubkey, proof[0]);
		assert_eq!(expanded.accounts[2].pubkey, proof[1]);
	}

	#[test]
	fn rejects_missing_placeholders_and_oversized_proofs() {
		let program_id = Pubkey::new_unique();
		let no_accounts = Instruction::new_with_bytes(program_id, &[1], vec![]);
		assert_eq!(
			with_bubblegum_proof_accounts(no_accounts, &[]),
			Err(ProgramError::NotEnoughAccountKeys),
		);

		let placeholder = Instruction::new_with_bytes(
			program_id,
			&[1],
			vec![AccountMeta::new_readonly(Pubkey::new_unique(), false)],
		);
		let oversized = [Pubkey::new_unique(); MAX_BUBBLEGUM_PROOF_ACCOUNTS + 1];
		assert_eq!(
			with_bubblegum_proof_accounts(placeholder, &oversized),
			Err(ProgramError::InvalidArgument),
		);
	}
}
