// Auto-generated. Do not edit.
// ignore_for_file: type=lint, constant_identifier_names

/// Error codes for the LootboxProgram program.

/// The signer is not authorized to perform this action.
/// Message: "The signer is not authorized to perform this action."
const int lootboxProgramErrorUnauthorized = 0x0; // 0

/// The account or lootbox is not in the required state.
/// Message: "The account or lootbox is not in the required state."
const int lootboxProgramErrorInvalidState = 0x1; // 1

/// The configured outcome does not exist or is out of range.
/// Message: "The configured outcome does not exist or is out of range."
const int lootboxProgramErrorInvalidOutcome = 0x2; // 2

/// An outcome weight must be non-zero and keep total weight within the v1 bound.
/// Message: "An outcome weight must be non-zero and keep total weight within the v1 bound."
const int lootboxProgramErrorInvalidWeight = 0x3; // 3

/// The lootbox cannot be sealed until at least one outcome exists.
/// Message: "The lootbox cannot be sealed until at least one outcome exists."
const int lootboxProgramErrorIncompleteConfiguration = 0x4; // 4

/// The vault cannot cover the worst-case outstanding liability.
/// Message: "The vault cannot cover the worst-case outstanding liability."
const int lootboxProgramErrorInsolvent = 0x5; // 5

/// The box mint or token account does not match the lootbox.
/// Message: "The box mint or token account does not match the lootbox."
const int lootboxProgramErrorInvalidMint = 0x6; // 6

/// The randomness account, owner, queue, authority, or commitment is invalid.
/// Message: "The randomness account, owner, queue, authority, or commitment is invalid."
const int lootboxProgramErrorInvalidRandomness = 0x7; // 7

/// The committed randomness is not ready for the requested transition.
/// Message: "The committed randomness is not ready for the requested transition."
const int lootboxProgramErrorRandomnessNotReady = 0x8; // 8

/// The randomness is already revealed and cannot take this path.
/// Message: "The randomness is already revealed and cannot take this path."
const int lootboxProgramErrorRandomnessExpired = 0x9; // 9

/// The pending opening has not reached its refund timeout.
/// Message: "The pending opening has not reached its refund timeout."
const int lootboxProgramErrorOpeningNotExpired = 0xa; // 10

/// The opening receipt has already been settled or refunded.
/// Message: "The opening receipt has already been settled or refunded."
const int lootboxProgramErrorOpeningAlreadyFinalized = 0xb; // 11

/// The supplied recipient does not match the receipt-bound recipient.
/// Message: "The supplied recipient does not match the receipt-bound recipient."
const int lootboxProgramErrorInvalidRecipient = 0xc; // 12

/// Minting would exceed the configured maximum supply.
/// Message: "Minting would exceed the configured maximum supply."
const int lootboxProgramErrorSupplyExceeded = 0xd; // 13

/// The template's earliest opening timestamp has not arrived.
/// Message: "The template's earliest opening timestamp has not arrived."
const int lootboxProgramErrorClaimLocked = 0xe; // 14

/// An earlier opening must be allocated first.
/// Message: "An earlier opening must be allocated first."
const int lootboxProgramErrorAllocationOutOfOrder = 0xf; // 15

/// At least one advertised prize has been exhausted.
/// Message: "At least one advertised prize has been exhausted."
const int lootboxProgramErrorPrizeExhausted = 0x10; // 16

/// The asset, quantity, or escrow does not match the immutable prize.
/// Message: "The asset, quantity, or escrow does not match the immutable prize."
const int lootboxProgramErrorInvalidPrize = 0x11; // 17

/// This asset has already been delivered for this opening.
/// Message: "This asset has already been delivered for this opening."
const int lootboxProgramErrorPrizeAlreadyClaimed = 0x12; // 18

/// The treasury is permanently locked and cannot accept more bundles.
/// Message: "The treasury is permanently locked and cannot accept more bundles."
const int lootboxProgramErrorTreasuryLocked = 0x13; // 19

/// The treasury must be locked before any box can be opened.
/// Message: "The treasury must be locked before any box can be opened."
const int lootboxProgramErrorTreasuryUnlocked = 0x14; // 20

/// Fixed box supply does not exactly match the funded bundle inventory.
/// Message: "Fixed box supply does not exactly match the funded bundle inventory."
const int lootboxProgramErrorSupplyMismatch = 0x15; // 21

/// A market treasury must be locked before its earliest reveal date.
/// Message: "A market treasury must be locked before its earliest reveal date."
const int lootboxProgramErrorRevealDatePassed = 0x16; // 22

/// Map of error codes to human-readable messages.
const Map<int, String> _lootboxProgramErrorMessages = {
  lootboxProgramErrorUnauthorized:
      'The signer is not authorized to perform this action.',
  lootboxProgramErrorInvalidState:
      'The account or lootbox is not in the required state.',
  lootboxProgramErrorInvalidOutcome:
      'The configured outcome does not exist or is out of range.',
  lootboxProgramErrorInvalidWeight: 'An outcome weight must be non-zero and keep total weight within the v1 bound.',
  lootboxProgramErrorIncompleteConfiguration:
      'The lootbox cannot be sealed until at least one outcome exists.',
  lootboxProgramErrorInsolvent:
      'The vault cannot cover the worst-case outstanding liability.',
  lootboxProgramErrorInvalidMint:
      'The box mint or token account does not match the lootbox.',
  lootboxProgramErrorInvalidRandomness: 'The randomness account, owner, queue, authority, or commitment is invalid.',
  lootboxProgramErrorRandomnessNotReady:
      'The committed randomness is not ready for the requested transition.',
  lootboxProgramErrorRandomnessExpired:
      'The randomness is already revealed and cannot take this path.',
  lootboxProgramErrorOpeningNotExpired:
      'The pending opening has not reached its refund timeout.',
  lootboxProgramErrorOpeningAlreadyFinalized:
      'The opening receipt has already been settled or refunded.',
  lootboxProgramErrorInvalidRecipient:
      'The supplied recipient does not match the receipt-bound recipient.',
  lootboxProgramErrorSupplyExceeded:
      'Minting would exceed the configured maximum supply.',
  lootboxProgramErrorClaimLocked:
      'The template\'s earliest opening timestamp has not arrived.',
  lootboxProgramErrorAllocationOutOfOrder:
      'An earlier opening must be allocated first.',
  lootboxProgramErrorPrizeExhausted:
      'At least one advertised prize has been exhausted.',
  lootboxProgramErrorInvalidPrize:
      'The asset, quantity, or escrow does not match the immutable prize.',
  lootboxProgramErrorPrizeAlreadyClaimed:
      'This asset has already been delivered for this opening.',
  lootboxProgramErrorTreasuryLocked:
      'The treasury is permanently locked and cannot accept more bundles.',
  lootboxProgramErrorTreasuryUnlocked:
      'The treasury must be locked before any box can be opened.',
  lootboxProgramErrorSupplyMismatch:
      'Fixed box supply does not exactly match the funded bundle inventory.',
  lootboxProgramErrorRevealDatePassed:
      'A market treasury must be locked before its earliest reveal date.',
};

/// Get the error message for a LootboxProgram program error code.
String? getLootboxProgramErrorMessage(int code) {
  return _lootboxProgramErrorMessages[code];
}

/// Check if an error code belongs to the LootboxProgram program.
bool isLootboxProgramError(int code) {
  return _lootboxProgramErrorMessages.containsKey(code);
}
