//! On-chain invocation and immutable result verification.

use solana_account_info::AccountInfo;
use solana_instruction::Instruction;
use solana_program_error::ProgramError;
use solana_program_error::ProgramResult;
use solana_pubkey::Pubkey;

use crate::generated::accounts::ResultReceiptState;
use crate::generated::programs::LOOTBOX_PROGRAM_ID;

/// Expected immutable bindings for a result consumed by another program.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ResultExpectation<'a> {
	pub template: &'a Pubkey,
	pub beneficiary: &'a Pubkey,
	pub consumer_program: &'a Pubkey,
	pub consumer_context: &'a [u8; 32],
	/// Omit only when the consumer deliberately accepts any locked manifest.
	pub manifest_hash: Option<&'a [u8; 32]>,
}

/// Copied allocation fields safe to retain after account data is released.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct VerifiedResult {
	pub opening: Pubkey,
	pub randomness: Pubkey,
	pub sequence: u64,
	pub selected_bundle: u32,
}

/// Invoke any generated Lootbox instruction from an on-chain program.
///
/// # Errors
/// Returns the runtime or Lootbox program error unchanged.
pub fn invoke_instruction(
	instruction: &Instruction,
	account_infos: &[AccountInfo<'_>],
) -> ProgramResult {
	solana_cpi::invoke(instruction, account_infos)
}

/// Invoke any generated Lootbox instruction with one or more caller PDAs.
///
/// # Errors
/// Returns the runtime or Lootbox program error unchanged.
pub fn invoke_instruction_signed(
	instruction: &Instruction,
	account_infos: &[AccountInfo<'_>],
	signer_seeds: &[&[&[u8]]],
) -> ProgramResult {
	solana_cpi::invoke_signed(instruction, account_infos, signer_seeds)
}

/// Verify a creator-funded immutable result before applying project state.
///
/// The consuming program should additionally store its own one-time marker for
/// `opening` or `consumer_context`. The Lootbox receipt is immutable, but it
/// cannot prevent a consumer from applying the same result twice.
///
/// # Errors
/// Returns an account, owner, seed, or binding error when the receipt is not the
/// canonical result committed to the expected project context.
pub fn verify_result_receipt(
	account: &AccountInfo<'_>,
	expected: ResultExpectation<'_>,
) -> Result<VerifiedResult, ProgramError> {
	if account.owner != &LOOTBOX_PROGRAM_ID {
		return Err(ProgramError::IncorrectProgramId);
	}

	let data = account.try_borrow_data()?;
	let receipt = ResultReceiptState::from_bytes(&data)?;
	let canonical = ResultReceiptState::create_pda(&receipt.opening, receipt.bump)
		.map_err(|_| ProgramError::InvalidSeeds)?;

	if canonical != *account.key {
		return Err(ProgramError::InvalidSeeds);
	}

	if receipt.template != *expected.template
		|| receipt.beneficiary != *expected.beneficiary
		|| receipt.consumer_program != *expected.consumer_program
		|| receipt.consumer_context != *expected.consumer_context
		|| expected
			.manifest_hash
			.is_some_and(|manifest_hash| receipt.manifest_hash != *manifest_hash)
	{
		return Err(ProgramError::InvalidAccountData);
	}

	Ok(VerifiedResult {
		opening: receipt.opening,
		randomness: receipt.randomness,
		sequence: receipt.sequence.get(),
		selected_bundle: receipt.selected_bundle.get(),
	})
}
