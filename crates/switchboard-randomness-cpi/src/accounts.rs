//! Owned parser for the Switchboard randomness account payload.
//!
//! The payload layout mirrors `RandomnessAccountData` from
//! `switchboard-on-demand` 0.13.0: an 8-byte account discriminator followed by
//! the 400-byte struct, 408 bytes in total. Only the fields a caller can act
//! on are exposed.

use pinocchio::Address;

use crate::discriminators::RANDOMNESS_ACCOUNT_DISCRIMINATOR;
use crate::error::RandomnessError;
use crate::error::Result;

/// Length of a freshly initialized Switchboard randomness account.
pub const RANDOMNESS_ACCOUNT_LEN: usize = 408;

/// Copy of the randomness fields a caller can act on.
///
/// The snapshot is owned so it can outlive the account-data borrow; copying it
/// is cheaper than holding the borrow across later CPIs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RandomnessSnapshot {
	/// Authority authorized to commit and reveal this randomness.
	pub authority: Address,
	/// Switchboard queue this randomness account belongs to.
	pub queue: Address,
	/// Slot hash backing the committed seed.
	pub seed_slothash: [u8; 32],
	/// Slot the seed was committed at; zero while uninitialized.
	pub seed_slot: u64,
	/// Oracle that provided the revealed value.
	pub oracle: Address,
	/// Slot the value was revealed at; zero while still committed.
	pub reveal_slot: u64,
	/// Revealed random value; zeroed while still committed.
	pub value: [u8; 32],
}

/// Parses the randomness fields from a Switchboard-owned account payload.
pub fn parse_randomness_account(data: &[u8]) -> Result<RandomnessSnapshot> {
	if data.len() < RANDOMNESS_ACCOUNT_LEN {
		return Err(RandomnessError::AccountDataTooShort);
	}

	if data[..8] != RANDOMNESS_ACCOUNT_DISCRIMINATOR {
		return Err(RandomnessError::InvalidDiscriminator);
	}

	Ok(RandomnessSnapshot {
		authority: read_address(data, 8)?,
		queue: read_address(data, 40)?,
		seed_slothash: read_array(data, 72)?,
		seed_slot: read_u64(data, 104)?,
		oracle: read_address(data, 112)?,
		reveal_slot: read_u64(data, 144)?,
		value: read_array(data, 152)?,
	})
}

fn read_address(data: &[u8], offset: usize) -> Result<Address> {
	Ok(Address::new_from_array(read_array(data, offset)?))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
	Ok(u64::from_le_bytes(read_array(data, offset)?))
}

fn read_array<const N: usize>(data: &[u8], offset: usize) -> Result<[u8; N]> {
	let bytes = data
		.get(offset..offset + N)
		.ok_or(RandomnessError::AccountDataTooShort)?;
	bytes
		.try_into()
		.map_err(|_| RandomnessError::AccountDataTooShort)
}

#[cfg(test)]
mod tests {
	use super::*;

	/// Builds a payload that mirrors how the Switchboard program writes the
	/// account: discriminator first, then the struct fields in order.
	fn sample_payload() -> [u8; RANDOMNESS_ACCOUNT_LEN] {
		let mut data = [0u8; RANDOMNESS_ACCOUNT_LEN];
		data[..8].copy_from_slice(&RANDOMNESS_ACCOUNT_DISCRIMINATOR);
		data[8..40].copy_from_slice(&[1u8; 32]);
		data[40..72].copy_from_slice(&[2u8; 32]);
		data[72..104].copy_from_slice(&[3u8; 32]);
		data[104..112].copy_from_slice(&7u64.to_le_bytes());
		data[112..144].copy_from_slice(&[4u8; 32]);
		data[144..152].copy_from_slice(&9u64.to_le_bytes());
		data[152..184].copy_from_slice(&[5u8; 32]);
		data
	}

	#[test]
	fn parses_every_field_at_its_switchboard_offset() {
		let snapshot = parse_randomness_account(&sample_payload()).expect("parses");

		assert_eq!(snapshot.authority, Address::new_from_array([1u8; 32]));
		assert_eq!(snapshot.queue, Address::new_from_array([2u8; 32]));
		assert_eq!(snapshot.seed_slothash, [3u8; 32]);
		assert_eq!(snapshot.seed_slot, 7);
		assert_eq!(snapshot.oracle, Address::new_from_array([4u8; 32]));
		assert_eq!(snapshot.reveal_slot, 9);
		assert_eq!(snapshot.value, [5u8; 32]);
	}

	#[test]
	fn rejects_short_payloads() {
		let payload = sample_payload();
		assert_eq!(
			parse_randomness_account(&payload[..RANDOMNESS_ACCOUNT_LEN - 1]),
			Err(RandomnessError::AccountDataTooShort)
		);
		assert_eq!(
			parse_randomness_account(&[]),
			Err(RandomnessError::AccountDataTooShort)
		);
	}

	#[test]
	fn rejects_foreign_account_discriminators() {
		let mut data = sample_payload();
		data[7] ^= 0xff;
		assert_eq!(
			parse_randomness_account(&data),
			Err(RandomnessError::InvalidDiscriminator)
		);
	}
}
