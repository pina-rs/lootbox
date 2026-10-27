//! Transaction submission: signing, blockhash handling, and RPC transport.

use solana_instruction::Instruction;

use crate::error::CliError;

/// Result of a submitted transaction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubmitOutcome {
	/// Transaction signature, base58 encoded.
	pub signature: String,
}

/// Submits a signed transaction to the network.
///
/// The CLI builds and signs the transaction itself; the transport only moves
/// bytes to the chain. Production wiring lives in the binary entrypoint, and
/// tests inject in-memory doubles.
pub trait Submit {
	/// Sends `instructions` in a single transaction and returns its signature.
	///
	/// Implementations own payer signing and blockhash handling, and report
	/// transport failures as `CliError::Rpc`.
	fn submit(&self, instructions: &[Instruction]) -> Result<SubmitOutcome, CliError>;
}

/// Submits the instructions through `submitter`, returning the outcome.
pub fn submit(
	submitter: &dyn Submit,
	instructions: &[Instruction],
) -> Result<SubmitOutcome, CliError> {
	submitter.submit(instructions)
}

/// The compute budget program's `SetComputeUnitLimit` instruction for `units`.
///
/// The limit comes from `lootbox_sdk::lootbox_compute_unit_limit`; the
/// instruction is placed first so it applies to the whole transaction.
#[must_use]
pub fn set_compute_unit_limit_instruction(units: u32) -> Instruction {
	Instruction {
		program_id: lootbox_sdk::COMPUTE_BUDGET_PROGRAM_ID,
		accounts: Vec::new(),
		data: [vec![2], units.to_le_bytes().to_vec()].concat(),
	}
}
