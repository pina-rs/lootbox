//! Switchboard On-Demand randomness discriminators.
//!
//! Switchboard On-Demand is an Anchor-style program, so its instructions and
//! accounts are addressed by 8-byte discriminators rather than compact
//! ordinals. The values below are pinned to `switchboard-on-demand` 0.13.0
//! (`src/on_demand/instructions/randomness_commit.rs` and
//! `src/on_demand/accounts/randomness.rs`); unit tests cross-check each one
//! against the literal byte arrays from that source.
//!
//! Every discriminator is stored as a little-endian `u64` so it can be
//! written, matched, and compared with plain integer operations.

use crate::error::RandomnessError;
use crate::error::Result;

/// Discriminators for the Switchboard randomness instructions the lootbox
/// program drives across one box opening.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u64)]
pub enum RandomnessInstruction {
	/// `randomness_init` — creates and binds a fresh randomness account.
	Init = 0x0F71_7432_21CC_0909,
	/// `randomness_commit` — persists the seed-slot commitment.
	Commit = 0x8DF2_85B3_C998_AA34,
	/// `randomness_reveal` — verifies the enclave signature and stores the value.
	Reveal = 0x4914_3A1E_0ABB_B5C5,
	/// `randomness_close` — closes the randomness account.
	Close = 0x9C00_F6E1_4A0E_6592,
}

impl RandomnessInstruction {
	/// Byte width of a Switchboard discriminator.
	pub const BYTES: usize = 8;

	/// Little-endian discriminator bytes for this instruction.
	#[inline]
	pub const fn to_bytes(self) -> [u8; Self::BYTES] {
		(self as u64).to_le_bytes()
	}

	/// Copies the discriminator to the front of `bytes`.
	///
	/// # Panics
	///
	/// Panics when `bytes` is shorter than [`Self::BYTES`].
	#[inline]
	pub fn write_discriminator(self, bytes: &mut [u8]) {
		bytes[..Self::BYTES].copy_from_slice(&self.to_bytes());
	}

	/// Parses the instruction from the first [`Self::BYTES`] of `data`.
	pub fn try_from_bytes(data: &[u8]) -> Result<Self> {
		let front = data
			.get(..Self::BYTES)
			.ok_or(RandomnessError::InvalidDiscriminator)?;
		let raw = u64::from_le_bytes(
			front
				.try_into()
				.map_err(|_| RandomnessError::InvalidDiscriminator)?,
		);

		const INIT: u64 = RandomnessInstruction::Init as u64;
		const COMMIT: u64 = RandomnessInstruction::Commit as u64;
		const REVEAL: u64 = RandomnessInstruction::Reveal as u64;
		const CLOSE: u64 = RandomnessInstruction::Close as u64;

		match raw {
			INIT => Ok(Self::Init),
			COMMIT => Ok(Self::Commit),
			REVEAL => Ok(Self::Reveal),
			CLOSE => Ok(Self::Close),
			_ => Err(RandomnessError::InvalidDiscriminator),
		}
	}

	/// Whether the first [`Self::BYTES`] of `data` encode this instruction.
	#[inline]
	pub fn matches_discriminator(self, data: &[u8]) -> bool {
		data.get(..Self::BYTES)
			.is_some_and(|front| front == self.to_bytes())
	}
}

/// Discriminator of the Switchboard `RandomnessAccountData` account.
///
/// Source: `switchboard-on-demand` 0.13.0
/// `src/on_demand/accounts/randomness.rs`.
pub const RANDOMNESS_ACCOUNT_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn discriminators_match_switchboard_source() {
		assert_eq!(
			RandomnessInstruction::Init.to_bytes(),
			[9, 9, 204, 33, 50, 116, 113, 15]
		);
		assert_eq!(
			RandomnessInstruction::Commit.to_bytes(),
			[52, 170, 152, 201, 179, 133, 242, 141]
		);
		assert_eq!(
			RandomnessInstruction::Reveal.to_bytes(),
			[197, 181, 187, 10, 30, 58, 20, 73]
		);
		assert_eq!(
			RandomnessInstruction::Close.to_bytes(),
			[146, 101, 14, 74, 225, 246, 0, 156]
		);
	}

	#[test]
	fn writes_discriminator_to_buffer_front() {
		let mut buffer = [0u8; 16];
		RandomnessInstruction::Reveal.write_discriminator(&mut buffer);
		assert_eq!(buffer[..8], RandomnessInstruction::Reveal.to_bytes());
		assert!(buffer[8..].iter().all(|byte| *byte == 0));
	}

	#[test]
	fn parses_every_instruction_roundtrip() {
		for instruction in [
			RandomnessInstruction::Init,
			RandomnessInstruction::Commit,
			RandomnessInstruction::Reveal,
			RandomnessInstruction::Close,
		] {
			let bytes = instruction.to_bytes();
			assert_eq!(
				RandomnessInstruction::try_from_bytes(&bytes),
				Ok(instruction)
			);
			assert!(instruction.matches_discriminator(&bytes));
		}
	}

	#[test]
	fn parsing_rejects_unknown_or_short_data() {
		assert_eq!(
			RandomnessInstruction::try_from_bytes(&[0u8; 8]),
			Err(RandomnessError::InvalidDiscriminator)
		);
		assert_eq!(
			RandomnessInstruction::try_from_bytes(&[9, 9]),
			Err(RandomnessError::InvalidDiscriminator)
		);
		assert!(!RandomnessInstruction::Commit.matches_discriminator(&[0u8; 4]));
	}
}
