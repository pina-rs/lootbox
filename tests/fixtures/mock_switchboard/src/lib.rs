//! Test-only Switchboard ABI emulator for offline Surfpool integration tests.
//!
//! This program is never linked into or deployed with the lootbox program. It
//! owns a realistic 408-byte randomness account and models initialization,
//! PDA-authorized commit, then reveal in a later slot.

#![allow(clippy::inline_always)]
#![no_std]

#[cfg(feature = "bpf-entrypoint")]
pub mod entrypoint;

use pina::sysvars::Sysvar;
use pina::*;

declare_id!("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");

const RANDOMNESS_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
const RANDOMNESS_INIT_DISCRIMINATOR: [u8; 8] = [9, 9, 204, 33, 50, 116, 113, 15];
const RANDOMNESS_COMMIT_DISCRIMINATOR: [u8; 8] = [52, 170, 152, 201, 179, 133, 242, 141];
const RANDOMNESS_REVEAL_DISCRIMINATOR: [u8; 8] = [197, 181, 187, 10, 30, 58, 20, 73];
const RANDOMNESS_CLOSE_DISCRIMINATOR: [u8; 8] = [146, 101, 14, 74, 225, 246, 0, 156];
const RANDOMNESS_ACCOUNT_SIZE: usize = 408;

fn write_address(data: &mut [u8], offset: usize, value: &Address) -> ProgramResult {
	data.get_mut(offset..offset + 32)
		.ok_or(ProgramError::InvalidAccountData)?
		.copy_from_slice(value.as_ref());

	Ok(())
}

fn process_initialize(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
	let [
		randomness,
		_reward_escrow,
		authority,
		queue,
		payer,
		system_program,
		_token_program,
		_associated_token_program,
		_wrapped_sol_mint,
		_program_state,
		_lut_signer,
		_lut,
		_address_lookup_table_program,
	] = accounts
	else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};

	if data.len() != 8 {
		return Err(ProgramError::InvalidInstructionData);
	}

	randomness
		.assert_signer()?
		.assert_empty()?
		.assert_writable()?;
	authority.assert_signer()?;
	queue.assert_writable()?;
	payer.assert_signer()?.assert_writable()?;
	system_program.assert_address(&system::ID)?;
	CreateAccount {
		from: payer,
		to: randomness,
		space: RANDOMNESS_ACCOUNT_SIZE as u64,
		owner: &ID,
	}
	.invoke()?;
	let mut bytes = randomness.try_borrow_mut()?;

	if bytes.len() != RANDOMNESS_ACCOUNT_SIZE {
		return Err(ProgramError::InvalidAccountData);
	}

	bytes.fill(0);
	bytes[..8].copy_from_slice(&RANDOMNESS_DISCRIMINATOR);
	bytes[8..40].copy_from_slice(authority.address().as_ref());
	bytes[40..72].copy_from_slice(queue.address().as_ref());

	Ok(())
}

fn process_commit(accounts: &mut [AccountView]) -> ProgramResult {
	let [randomness, queue, oracle, _recent_slot_hashes, authority] = accounts else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};
	authority.assert_signer()?;
	randomness.assert_owner(&ID)?.assert_writable()?;
	let seed_slot = sysvars::clock::Clock::get()?.slot;
	let mut bytes = randomness.try_borrow_mut()?;

	if bytes.len() != RANDOMNESS_ACCOUNT_SIZE
		|| bytes.get(..8) != Some(RANDOMNESS_DISCRIMINATOR.as_slice())
		|| bytes.get(8..40) != Some(authority.address().as_ref())
		|| bytes.get(40..72) != Some(queue.address().as_ref())
	{
		return Err(ProgramError::InvalidAccountData);
	}

	bytes[72..104].fill(0);
	bytes[104..112].copy_from_slice(&seed_slot.to_le_bytes());
	write_address(&mut bytes, 112, oracle.address())?;
	bytes[144..184].fill(0);

	Ok(())
}

fn process_reveal(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
	let [
		randomness,
		oracle,
		queue,
		_stats,
		authority,
		payer,
		_recent_slot_hashes,
		_system_program,
		_reward_escrow,
		_token_program,
		_wrapped_sol_mint,
		_program_state,
	] = accounts
	else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};

	if data.len() != 97 {
		return Err(ProgramError::InvalidInstructionData);
	}

	authority.assert_signer()?;
	payer.assert_signer()?;
	randomness.assert_owner(&ID)?.assert_writable()?;
	let reveal_slot = sysvars::clock::Clock::get()?.slot;
	let value = data
		.get(65..97)
		.ok_or(ProgramError::InvalidInstructionData)?;
	let mut bytes = randomness.try_borrow_mut()?;

	if bytes.len() != RANDOMNESS_ACCOUNT_SIZE
		|| bytes.get(..8) != Some(RANDOMNESS_DISCRIMINATOR.as_slice())
		|| bytes.get(8..40) != Some(authority.address().as_ref())
		|| bytes.get(40..72) != Some(queue.address().as_ref())
		|| bytes.get(112..144) != Some(oracle.address().as_ref())
	{
		return Err(ProgramError::InvalidAccountData);
	}

	let seed_slot = u64::from_le_bytes(
		bytes[104..112]
			.try_into()
			.map_err(|_| ProgramError::InvalidAccountData)?,
	);

	if reveal_slot <= seed_slot || bytes[144..152] != [0u8; 8] {
		return Err(ProgramError::InvalidArgument);
	}

	bytes[144..152].copy_from_slice(&reveal_slot.to_le_bytes());
	bytes[152..184].copy_from_slice(value);

	Ok(())
}

fn process_close(accounts: &mut [AccountView]) -> ProgramResult {
	let [
		randomness,
		_reward_escrow,
		authority,
		_program_state,
		_system_program,
		_token_program,
		_wrapped_sol_mint,
		_lut,
		_lut_signer,
		_address_lookup_table_program,
	] = accounts
	else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};
	authority.assert_signer()?.assert_writable()?;
	randomness.assert_owner(&ID)?.assert_writable()?;
	let bytes = randomness.try_borrow()?;

	if bytes.len() != RANDOMNESS_ACCOUNT_SIZE
		|| bytes.get(..8) != Some(RANDOMNESS_DISCRIMINATOR.as_slice())
		|| bytes.get(8..40) != Some(authority.address().as_ref())
	{
		return Err(ProgramError::InvalidAccountData);
	}
	drop(bytes);

	randomness.close_account_zeroed(authority)
}

/// Process a test-oracle instruction.
pub fn process_instruction(
	program_id: &Address,
	accounts: &mut [AccountView],
	data: &[u8],
) -> ProgramResult {
	if program_id != &ID {
		return Err(ProgramError::IncorrectProgramId);
	}

	if let Some(params) = data.strip_prefix(&RANDOMNESS_INIT_DISCRIMINATOR) {
		return process_initialize(accounts, params);
	}

	if data == RANDOMNESS_COMMIT_DISCRIMINATOR {
		return process_commit(accounts);
	}

	if let Some(params) = data.strip_prefix(&RANDOMNESS_REVEAL_DISCRIMINATOR) {
		return process_reveal(accounts, params);
	}

	if data == RANDOMNESS_CLOSE_DISCRIMINATOR {
		return process_close(accounts);
	}

	Err(ProgramError::InvalidInstructionData)
}
