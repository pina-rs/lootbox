//! Errors surfaced by the Switchboard randomness CPI helpers.

use core::fmt;
use core::result;

use pinocchio::error::ProgramError;

/// Failure modes of the Switchboard randomness CPI helpers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum RandomnessError {
	/// The discriminator does not match the Switchboard randomness ABI.
	InvalidDiscriminator = 0,
	/// The account payload is shorter than the Switchboard randomness layout.
	AccountDataTooShort,
}

impl From<RandomnessError> for ProgramError {
	#[inline]
	fn from(error: RandomnessError) -> Self {
		ProgramError::Custom(error as u32)
	}
}

impl fmt::Display for RandomnessError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		match self {
			Self::InvalidDiscriminator => {
				write!(f, "invalid Switchboard randomness discriminator")
			}
			Self::AccountDataTooShort => {
				write!(f, "Switchboard randomness account data too short")
			}
		}
	}
}

/// Result alias for the Switchboard randomness CPI helpers.
pub type Result<T> = result::Result<T, RandomnessError>;

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn converts_into_custom_program_error() {
		assert!(matches!(
			ProgramError::from(RandomnessError::AccountDataTooShort),
			ProgramError::Custom(1)
		));
		assert!(matches!(
			ProgramError::from(RandomnessError::InvalidDiscriminator),
			ProgramError::Custom(0)
		));
	}
}
