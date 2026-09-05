//! Transaction submission: signing, blockhash handling, and RPC transport.

use solana_instruction::Instruction;

use crate::error::CliError;

/// Result of a submitted transaction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubmitOutcome {
	/// Transaction signature, base58 encoded.
	pub signature: String,
}

/// Submits a signed instruction to the network.
///
/// The CLI builds and signs the transaction itself; the transport only moves
/// bytes to the chain. Production wiring lives in the binary entrypoint, and
/// tests inject in-memory doubles.
pub trait Submit {
	fn submit(&self, instruction: &Instruction) -> Result<SubmitOutcome, CliError>;
}

/// Submits the instruction with the payer from `payer`, returning the outcome.
pub fn submit(
	submitter: &dyn Submit,
	instruction: &Instruction,
) -> Result<SubmitOutcome, CliError> {
	submitter.submit(instruction)
}
