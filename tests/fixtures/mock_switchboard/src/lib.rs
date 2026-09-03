//! Test-only Switchboard ABI emulator for offline Surfpool integration tests.
//!
//! This program is never linked into or deployed with the lootbox program. It
//! owns a realistic 408-byte randomness account and models the two oracle
//! transitions the integration test needs: commit, then reveal in a later slot.

#![allow(clippy::inline_always)]
#![no_std]

#[cfg(feature = "bpf-entrypoint")]
pub mod entrypoint;

use pina::*;

declare_id!("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");

const CLOCK_SYSVAR_ID: Address = address!("SysvarC1ock11111111111111111111111111111111");
const RANDOMNESS_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
const RANDOMNESS_ACCOUNT_SIZE: usize = 408;

fn slot(clock: &AccountView) -> Result<u64, ProgramError> {
	clock.assert_sysvar(&CLOCK_SYSVAR_ID)?;
	let data = clock.try_borrow()?;
	let bytes: [u8; 8] = data
		.get(..8)
		.ok_or(ProgramError::InvalidAccountData)?
		.try_into()
		.map_err(|_| ProgramError::InvalidAccountData)?;

	Ok(u64::from_le_bytes(bytes))
}

fn write_address(data: &mut [u8], offset: usize, value: &Address) -> ProgramResult {
	data.get_mut(offset..offset + 32)
		.ok_or(ProgramError::InvalidAccountData)?
		.copy_from_slice(value.as_ref());

	Ok(())
}

fn process_commit(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
	let [authority, randomness, clock] = accounts else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};
	authority.assert_signer()?;
	randomness.assert_owner(&ID)?.assert_writable()?;
	let seed_slot = slot(clock)?;
	let queue = data.get(..32).ok_or(ProgramError::InvalidInstructionData)?;
	let mut bytes = randomness.try_borrow_mut()?;

	if bytes.len() != RANDOMNESS_ACCOUNT_SIZE {
		return Err(ProgramError::InvalidAccountData);
	}

	bytes.fill(0);
	bytes[..8].copy_from_slice(&RANDOMNESS_DISCRIMINATOR);
	write_address(&mut bytes, 8, authority.address())?;
	bytes[40..72].copy_from_slice(queue);
	bytes[104..112].copy_from_slice(&seed_slot.to_le_bytes());

	Ok(())
}

fn process_reveal(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
	let [authority, randomness, clock] = accounts else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};
	authority.assert_signer()?;
	randomness.assert_owner(&ID)?.assert_writable()?;
	let reveal_slot = slot(clock)?;
	let value = data.get(..32).ok_or(ProgramError::InvalidInstructionData)?;
	let mut bytes = randomness.try_borrow_mut()?;

	if bytes.len() != RANDOMNESS_ACCOUNT_SIZE
		|| bytes.get(..8) != Some(RANDOMNESS_DISCRIMINATOR.as_slice())
		|| bytes.get(8..40) != Some(authority.address().as_ref())
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

/// Process a test-oracle instruction.
pub fn process_instruction(
	program_id: &Address,
	accounts: &mut [AccountView],
	data: &[u8],
) -> ProgramResult {
	if program_id != &ID {
		return Err(ProgramError::IncorrectProgramId);
	}

	let (discriminator, payload) = data
		.split_first()
		.ok_or(ProgramError::InvalidInstructionData)?;

	match discriminator {
		0 => process_commit(accounts, payload),
		1 => process_reveal(accounts, payload),
		_ => Err(ProgramError::InvalidInstructionData),
	}
}
