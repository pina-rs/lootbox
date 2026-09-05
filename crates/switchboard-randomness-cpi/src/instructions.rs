//! CPI builders for the Switchboard On-Demand randomness instructions.
//!
//! Each builder owns the instruction data layout and the account metadata
//! Switchboard expects, in Switchboard's own account order. Signers are driven
//! by the caller through `invoke_signed`; `randomness` and `payer` must have
//! signed the enclosing transaction because Switchboard requires their
//! signatures at the runtime level.
//!
//! The private `*_data` helpers are the wire-format core and are exercised
//! byte-for-byte by the unit tests below.

use pinocchio::AccountView;
use pinocchio::Address;
use pinocchio::cpi::Signer;
use pinocchio::cpi::invoke_signed;
use pinocchio::error::ProgramResult;
use pinocchio::instruction::InstructionAccount;
use pinocchio::instruction::InstructionView;

use crate::discriminators::RandomnessInstruction;

fn init_data(recent_slot: u64) -> [u8; 16] {
	let mut data = [0u8; 16];
	RandomnessInstruction::Init.write_discriminator(&mut data);
	data[8..].copy_from_slice(&recent_slot.to_le_bytes());
	data
}

fn reveal_data(signature: &[u8; 64], recovery_id: u8, value: &[u8; 32]) -> [u8; 105] {
	let mut data = [0u8; 105];
	RandomnessInstruction::Reveal.write_discriminator(&mut data);
	data[8..72].copy_from_slice(signature);
	data[72] = recovery_id;
	data[73..].copy_from_slice(value);
	data
}

/// CPI arguments for `randomness_init`.
///
/// Creates a fresh 408-byte randomness account owned by Switchboard and bound
/// to `authority` and `queue`.
#[derive(Clone, Copy, Debug)]
#[must_use = "the CPI has no effect until invoke_signed is called"]
pub struct RandomnessInit<'a> {
	/// Switchboard On-Demand program (mainnet or devnet).
	pub program_id: &'a Address,
	/// Fresh randomness account — writable, signed by the enclosing transaction.
	pub randomness: &'a AccountView,
	/// Reward escrow the oracle may fund — writable.
	pub escrow: &'a AccountView,
	/// PDA authorized to commit and reveal — read-only signer.
	pub authority: &'a AccountView,
	/// Switchboard queue — writable.
	pub queue: &'a AccountView,
	/// Rent payer — writable, signed by the enclosing transaction.
	pub payer: &'a AccountView,
	/// System program.
	pub system_program: &'a AccountView,
	/// Token program backing the escrow mint.
	pub token_program: &'a AccountView,
	/// Associated-token program for the escrow derivation.
	pub associated_token_program: &'a AccountView,
	/// Wrapped-SOL mint backing the escrow.
	pub wrapped_sol_mint: &'a AccountView,
	/// Switchboard program state.
	pub program_state: &'a AccountView,
	/// Lookup-table signer — read-only.
	pub lut_signer: &'a AccountView,
	/// Switchboard lookup table — writable.
	pub lut: &'a AccountView,
	/// Address-lookup-table program.
	pub address_lookup_table_program: &'a AccountView,
	/// Recent slot Switchboard uses to derive its per-randomness lookup table.
	pub recent_slot: u64,
}

impl RandomnessInit<'_> {
	/// Invokes `randomness_init` with no PDA seeds.
	///
	/// `authority` must still be covered — by the enclosing transaction or by
	/// seeds passed to [`Self::invoke_signed`].
	#[inline]
	pub fn invoke(&self) -> ProgramResult {
		self.invoke_signed(&[])
	}

	/// Invokes `randomness_init`, signing with the provided PDA seeds.
	pub fn invoke_signed(&self, signers: &[Signer]) -> ProgramResult {
		let data = init_data(self.recent_slot);
		let accounts = [
			InstructionAccount::writable_signer(self.randomness.address()),
			InstructionAccount::writable(self.escrow.address()),
			InstructionAccount::readonly_signer(self.authority.address()),
			InstructionAccount::writable(self.queue.address()),
			InstructionAccount::writable_signer(self.payer.address()),
			InstructionAccount::readonly(self.system_program.address()),
			InstructionAccount::readonly(self.token_program.address()),
			InstructionAccount::readonly(self.associated_token_program.address()),
			InstructionAccount::readonly(self.wrapped_sol_mint.address()),
			InstructionAccount::readonly(self.program_state.address()),
			InstructionAccount::readonly(self.lut_signer.address()),
			InstructionAccount::writable(self.lut.address()),
			InstructionAccount::readonly(self.address_lookup_table_program.address()),
		];
		let views: [&AccountView; 13] = [
			self.randomness,
			self.escrow,
			self.authority,
			self.queue,
			self.payer,
			self.system_program,
			self.token_program,
			self.associated_token_program,
			self.wrapped_sol_mint,
			self.program_state,
			self.lut_signer,
			self.lut,
			self.address_lookup_table_program,
		];
		let instruction = InstructionView {
			program_id: self.program_id,
			accounts: &accounts,
			data: &data,
		};

		invoke_signed(&instruction, &views, signers)
	}
}

/// CPI arguments for `randomness_commit`.
///
/// Stores the current slot as the seed-slot commitment; the reveal must come
/// from a later slot.
#[derive(Clone, Copy, Debug)]
#[must_use = "the CPI has no effect until invoke_signed is called"]
pub struct RandomnessCommit<'a> {
	/// Switchboard On-Demand program (mainnet or devnet).
	pub program_id: &'a Address,
	/// Committed randomness account — writable, owned by Switchboard.
	pub randomness: &'a AccountView,
	/// Switchboard queue — read-only.
	pub queue: &'a AccountView,
	/// Oracle answering the commitment — writable.
	pub oracle: &'a AccountView,
	/// Recent slot-hashes sysvar — read-only.
	pub recent_slot_hashes: &'a AccountView,
	/// PDA authorized to commit — read-only signer.
	pub authority: &'a AccountView,
}

impl RandomnessCommit<'_> {
	/// Invokes `randomness_commit` with no PDA seeds.
	///
	/// `authority` must still be covered — by the enclosing transaction or by
	/// seeds passed to [`Self::invoke_signed`].
	#[inline]
	pub fn invoke(&self) -> ProgramResult {
		self.invoke_signed(&[])
	}

	/// Invokes `randomness_commit`, signing with the provided PDA seeds.
	pub fn invoke_signed(&self, signers: &[Signer]) -> ProgramResult {
		let data = RandomnessInstruction::Commit.to_bytes();
		let accounts = [
			InstructionAccount::writable(self.randomness.address()),
			InstructionAccount::readonly(self.queue.address()),
			InstructionAccount::writable(self.oracle.address()),
			InstructionAccount::readonly(self.recent_slot_hashes.address()),
			InstructionAccount::readonly_signer(self.authority.address()),
		];
		let views: [&AccountView; 5] = [
			self.randomness,
			self.queue,
			self.oracle,
			self.recent_slot_hashes,
			self.authority,
		];
		let instruction = InstructionView {
			program_id: self.program_id,
			accounts: &accounts,
			data: &data,
		};

		invoke_signed(&instruction, &views, signers)
	}
}

/// CPI arguments for `randomness_reveal`.
///
/// Verifies the Switchboard gateway's enclave signature over `value` and
/// stores both the reveal slot and the value on the randomness account.
#[derive(Clone, Copy, Debug)]
#[must_use = "the CPI has no effect until invoke_signed is called"]
pub struct RandomnessReveal<'a, 'b> {
	/// Switchboard On-Demand program (mainnet or devnet).
	pub program_id: &'a Address,
	/// Committed randomness account — writable, owned by Switchboard.
	pub randomness: &'a AccountView,
	/// Oracle that produced the reveal — read-only.
	pub oracle: &'a AccountView,
	/// Switchboard queue — read-only.
	pub queue: &'a AccountView,
	/// Oracle stats tracker — writable.
	pub oracle_stats: &'a AccountView,
	/// PDA authorized to reveal — read-only signer.
	pub authority: &'a AccountView,
	/// Fee payer funding oracle bookkeeping — writable, signed by the
	/// enclosing transaction.
	pub payer: &'a AccountView,
	/// Recent slot-hashes sysvar — read-only.
	pub recent_slot_hashes: &'a AccountView,
	/// System program.
	pub system_program: &'a AccountView,
	/// Escrow receiving any oracle fee rebate — writable.
	pub escrow: &'a AccountView,
	/// Token program backing the escrow.
	pub token_program: &'a AccountView,
	/// Wrapped-SOL mint backing the escrow.
	pub wrapped_sol_mint: &'a AccountView,
	/// Switchboard program state — read-only.
	pub program_state: &'a AccountView,
	/// Enclave signature returned by the Switchboard gateway.
	pub signature: &'b [u8; 64],
	/// Secp256k1 recovery identifier returned by the gateway.
	pub recovery_id: u8,
	/// Revealed value covered by `signature`.
	pub value: &'b [u8; 32],
}

impl RandomnessReveal<'_, '_> {
	/// Invokes `randomness_reveal` with no PDA seeds.
	///
	/// `authority` must still be covered — by the enclosing transaction or by
	/// seeds passed to [`Self::invoke_signed`].
	#[inline]
	pub fn invoke(&self) -> ProgramResult {
		self.invoke_signed(&[])
	}

	/// Invokes `randomness_reveal`, signing with the provided PDA seeds.
	pub fn invoke_signed(&self, signers: &[Signer]) -> ProgramResult {
		let data = reveal_data(self.signature, self.recovery_id, self.value);
		let accounts = [
			InstructionAccount::writable(self.randomness.address()),
			InstructionAccount::readonly(self.oracle.address()),
			InstructionAccount::readonly(self.queue.address()),
			InstructionAccount::writable(self.oracle_stats.address()),
			InstructionAccount::readonly_signer(self.authority.address()),
			InstructionAccount::writable_signer(self.payer.address()),
			InstructionAccount::readonly(self.recent_slot_hashes.address()),
			InstructionAccount::readonly(self.system_program.address()),
			InstructionAccount::writable(self.escrow.address()),
			InstructionAccount::readonly(self.token_program.address()),
			InstructionAccount::readonly(self.wrapped_sol_mint.address()),
			InstructionAccount::readonly(self.program_state.address()),
		];
		let views: [&AccountView; 12] = [
			self.randomness,
			self.oracle,
			self.queue,
			self.oracle_stats,
			self.authority,
			self.payer,
			self.recent_slot_hashes,
			self.system_program,
			self.escrow,
			self.token_program,
			self.wrapped_sol_mint,
			self.program_state,
		];
		let instruction = InstructionView {
			program_id: self.program_id,
			accounts: &accounts,
			data: &data,
		};

		invoke_signed(&instruction, &views, signers)
	}
}

/// CPI arguments for `randomness_close`.
///
/// Closes the randomness account and forwards its rent to `escrow`.
#[derive(Clone, Copy, Debug)]
#[must_use = "the CPI has no effect until invoke_signed is called"]
pub struct RandomnessClose<'a> {
	/// Switchboard On-Demand program (mainnet or devnet).
	pub program_id: &'a Address,
	/// Randomness account to close — writable, owned by Switchboard.
	pub randomness: &'a AccountView,
	/// Recipient of the reclaimed rent — writable.
	pub escrow: &'a AccountView,
	/// PDA authorized to close — writable signer.
	pub authority: &'a AccountView,
	/// Switchboard program state — read-only.
	pub program_state: &'a AccountView,
	/// System program.
	pub system_program: &'a AccountView,
	/// Token program backing the escrow.
	pub token_program: &'a AccountView,
	/// Wrapped-SOL mint backing the escrow.
	pub wrapped_sol_mint: &'a AccountView,
	/// Switchboard lookup table — writable.
	pub lut: &'a AccountView,
	/// Lookup-table signer — read-only.
	pub lut_signer: &'a AccountView,
	/// Address-lookup-table program.
	pub address_lookup_table_program: &'a AccountView,
}

impl RandomnessClose<'_> {
	/// Invokes `randomness_close` with no PDA seeds.
	///
	/// `authority` must still be covered — by the enclosing transaction or by
	/// seeds passed to [`Self::invoke_signed`].
	#[inline]
	pub fn invoke(&self) -> ProgramResult {
		self.invoke_signed(&[])
	}

	/// Invokes `randomness_close`, signing with the provided PDA seeds.
	pub fn invoke_signed(&self, signers: &[Signer]) -> ProgramResult {
		let data = RandomnessInstruction::Close.to_bytes();
		let accounts = [
			InstructionAccount::writable(self.randomness.address()),
			InstructionAccount::writable(self.escrow.address()),
			InstructionAccount::writable_signer(self.authority.address()),
			InstructionAccount::readonly(self.program_state.address()),
			InstructionAccount::readonly(self.system_program.address()),
			InstructionAccount::readonly(self.token_program.address()),
			InstructionAccount::readonly(self.wrapped_sol_mint.address()),
			InstructionAccount::writable(self.lut.address()),
			InstructionAccount::readonly(self.lut_signer.address()),
			InstructionAccount::readonly(self.address_lookup_table_program.address()),
		];
		let views: [&AccountView; 10] = [
			self.randomness,
			self.escrow,
			self.authority,
			self.program_state,
			self.system_program,
			self.token_program,
			self.wrapped_sol_mint,
			self.lut,
			self.lut_signer,
			self.address_lookup_table_program,
		];
		let instruction = InstructionView {
			program_id: self.program_id,
			accounts: &accounts,
			data: &data,
		};

		invoke_signed(&instruction, &views, signers)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn init_data_carries_discriminator_then_recent_slot() {
		let data = init_data(0x0102_0304_0506_0708);

		assert_eq!(data.len(), 16);
		assert_eq!(data[..8], RandomnessInstruction::Init.to_bytes());
		assert_eq!(data[8..], 0x0102_0304_0506_0708u64.to_le_bytes());
	}

	#[test]
	fn reveal_data_matches_switchboard_wire_layout() {
		let signature = [0xaau8; 64];
		let value = [0x55u8; 32];
		let data = reveal_data(&signature, 27, &value);

		assert_eq!(data.len(), 105);
		assert_eq!(data[..8], RandomnessInstruction::Reveal.to_bytes());
		assert_eq!(data[8..72], signature);
		assert_eq!(data[72], 27);
		assert_eq!(data[73..], value);
	}

	#[test]
	fn commit_and_close_data_are_bare_discriminators() {
		assert_eq!(
			RandomnessInstruction::Commit.to_bytes(),
			[52, 170, 152, 201, 179, 133, 242, 141]
		);
		assert_eq!(
			RandomnessInstruction::Close.to_bytes(),
			[146, 101, 14, 74, 225, 246, 0, 156]
		);
	}
}
