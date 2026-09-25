//! Admission of Token-2022 fungible prizes, including issuer-controlled
//! tokenized stocks.
//!
//! Ordinary Token-2022 prizes stay under the strict policy: only on-mint
//! metadata extensions and no freeze authority. Tokenized stocks cannot meet
//! that policy because their issuers keep regulatory powers over every holder.
//! A mint is admitted as an issuer-controlled stock only when its
//! `PermanentDelegate` is one of [`ISSUER_STOCK_AUTHORITIES`]. The program
//! cannot restrain those powers; `docs/security-templates.md` discloses them.

use token_2022::state::ExtensionType;
use token_2022::state::StateWithExtensions;

use crate::*;

/// The `PreStocks` issuer. It is the permanent delegate and the freeze
/// authority of every `PreStocks` pre-IPO mint.
pub const PRESTOCKS_ISSUER: Address = address!("WV9PJN7XTmTLVwbutCLFxp8TyePee6Xq5mRq6Fti5Wc");
/// Backed xStocks issuer. It is the permanent delegate and the transfer-hook
/// authority of every xStocks mint, such as `TSLAx`, `AAPLx`, `NVDAx`, and `SPYx`.
pub const XSTOCKS_ISSUER: Address = address!("5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq");
/// Permanent delegates that mark a Token-2022 mint as an issuer-controlled
/// tokenized stock. Every other mint keeps the strict Token-2022 policy.
pub const ISSUER_STOCK_AUTHORITIES: [Address; 2] = [PRESTOCKS_ISSUER, XSTOCKS_ISSUER];

/// Extensions every Token-2022 prize may carry.
const STRICT_EXTENSIONS: [ExtensionType; 2] =
	[ExtensionType::MetadataPointer, ExtensionType::TokenMetadata];
/// Every extension a Token-2022 fungible prize can carry: the strict set plus
/// the extensions only an issuer-controlled stock may add.
pub(super) const ISSUER_STOCK_EXTENSIONS: [ExtensionType; 10] = [
	ExtensionType::MetadataPointer,
	ExtensionType::TokenMetadata,
	ExtensionType::PermanentDelegate,
	ExtensionType::DefaultAccountState,
	ExtensionType::ScaledUiAmount,
	ExtensionType::Pausable,
	ExtensionType::ConfidentialTransferMint,
	ExtensionType::ConfidentialTransferFeeConfig,
	ExtensionType::TransferHook,
	ExtensionType::TransferFeeConfig,
];
/// Token-2022 extended mints start their TLV entries after the padded base
/// and the account-type byte.
const MINT_TLV_START: usize = 166;
/// Serialized `TransferFeeConfig`: two authorities, the withheld amount, then
/// the older and newer `(epoch, maximum_fee, basis_points)` schedules.
const TRANSFER_FEE_CONFIG_LEN: usize = 108;
const ONE_IN_BASIS_POINTS: u128 = 10_000;

/// One Token-2022 transfer-fee schedule.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct TransferFee {
	pub(super) basis_points: u16,
	pub(super) maximum_fee: u64,
}

impl TransferFee {
	/// The fee Token-2022 withholds from a transfer of `amount`: the ceiling of
	/// `amount * basis_points / 10_000`, capped at `maximum_fee`.
	pub(super) fn fee(self, amount: u64) -> Option<u64> {
		if self.basis_points == 0 || amount == 0 {
			return Some(0);
		}
		let raw = u128::from(amount)
			.checked_mul(u128::from(self.basis_points))?
			.div_ceil(ONE_IN_BASIS_POINTS);

		Some(u64::try_from(raw).ok()?.min(self.maximum_fee))
	}

	/// The smallest gross transfer whose recipient is credited exactly `net`.
	///
	/// Mirrors Token-2022's inverse fee calculation: the lesser of the uncapped
	/// inverse and `net + maximum_fee`. Credited amounts never skip a value as
	/// the gross grows, so that minimum is exact; the forward check below still
	/// fails closed on any disagreement. Returns `None` when no `u64` gross can
	/// credit `net`.
	pub(super) fn gross_for_net(self, net: u64) -> Option<u64> {
		let basis_points = u128::from(self.basis_points);
		let gross = if basis_points == 0 || net == 0 {
			net
		} else if basis_points >= ONE_IN_BASIS_POINTS {
			net.checked_add(self.maximum_fee)?
		} else {
			let raw = u128::from(net)
				.checked_mul(ONE_IN_BASIS_POINTS)?
				.div_ceil(ONE_IN_BASIS_POINTS - basis_points);
			if raw - u128::from(net) >= u128::from(self.maximum_fee) {
				net.checked_add(self.maximum_fee)?
			} else {
				u64::try_from(raw).ok()?
			}
		};

		(gross.checked_sub(self.fee(gross)?)? == net).then_some(gross)
	}
}

/// A mint's `TransferFeeConfig`, reduced to the schedules that set fees.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct TransferFeeConfig {
	older: TransferFee,
	newer: TransferFee,
	newer_epoch: u64,
}

impl TransferFeeConfig {
	fn from_bytes(value: &[u8]) -> Result<Self, ProgramError> {
		if value.len() != TRANSFER_FEE_CONFIG_LEN {
			return Err(ProgramError::InvalidAccountData);
		}
		let u64_at = |offset: usize| -> Result<u64, ProgramError> {
			value
				.get(offset..offset + 8)
				.and_then(|bytes| bytes.try_into().ok())
				.map(u64::from_le_bytes)
				.ok_or(ProgramError::InvalidAccountData)
		};
		let schedule = |offset: usize| -> Result<TransferFee, ProgramError> {
			Ok(TransferFee {
				maximum_fee: u64_at(offset + 8)?,
				basis_points: u16::from_le_bytes([value[offset + 16], value[offset + 17]]),
			})
		};

		Ok(Self {
			older: schedule(72)?,
			newer: schedule(90)?,
			newer_epoch: u64_at(90)?,
		})
	}

	/// The schedule Token-2022 applies during `epoch`.
	pub(super) fn epoch_fee(self, epoch: u64) -> TransferFee {
		if epoch >= self.newer_epoch {
			self.newer
		} else {
			self.older
		}
	}
}

/// Admit a Token-2022 fungible prize mint from its raw account data.
///
/// The caller must already have checked that Token-2022 owns the account.
/// Returns the mint's transfer-fee configuration, which only an
/// issuer-controlled stock may carry.
///
/// # Errors
///
/// Returns [`LootboxError::InvalidPrize`] when the mint is outside both
/// policies, when an issuer-controlled stock is paused, defaults new accounts
/// to frozen, or names a transfer-hook program, and propagates malformed
/// extension data.
pub(super) fn admit_token_2022_prize(
	data: &[u8],
) -> Result<Option<TransferFeeConfig>, ProgramError> {
	let mint = StateWithExtensions::<token_2022::state::Mint>::from_bytes(data)?;
	let mut extensions = [ExtensionType::Uninitialized; token_2022::state::MAX_EXTENSIONS];
	let count = mint.write_extension_types(&mut extensions)?;
	let extensions = &extensions[..count];

	if !is_issuer_stock(mint, extensions)? {
		if mint.base.freeze_authority().is_some()
			|| !extensions
				.iter()
				.all(|extension| STRICT_EXTENSIONS.contains(extension))
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		return Ok(None);
	}

	if !extensions
		.iter()
		.all(|extension| ISSUER_STOCK_EXTENSIONS.contains(extension))
	{
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	if extensions.contains(&ExtensionType::DefaultAccountState)
		&& mint
			.get_extension::<token_2022::state::DefaultAccountStateExtension>()?
			.state()? != token_2022::state::AccountState::Initialized
	{
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	// Fail closed on hook programs: the escrow never forwards extra accounts,
	// and an arbitrary hook could veto claims.
	if extensions.contains(&ExtensionType::TransferHook)
		&& mint
			.get_extension::<token_2022::state::TransferHookExtension>()?
			.program_id
			.as_ref()
			.is_some()
	{
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	if extensions.contains(&ExtensionType::Pausable)
		&& bool::from(
			&mint
				.get_extension::<token_2022::state::PausableExtension>()?
				.paused,
		) {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	if !extensions.contains(&ExtensionType::TransferFeeConfig) {
		return Ok(None);
	}

	let value = mint_extension_bytes(data, ExtensionType::TransferFeeConfig)?
		.ok_or(ProgramError::InvalidAccountData)?;
	TransferFeeConfig::from_bytes(value).map(Some)
}

fn is_issuer_stock(
	mint: &StateWithExtensions<token_2022::state::Mint>,
	extensions: &[ExtensionType],
) -> Result<bool, ProgramError> {
	if !extensions.contains(&ExtensionType::PermanentDelegate) {
		return Ok(false);
	}
	let delegate = mint.get_extension::<token_2022::state::PermanentDelegateExtension>()?;

	Ok(delegate
		.delegate
		.as_ref()
		.is_some_and(|delegate| ISSUER_STOCK_AUTHORITIES.contains(delegate)))
}

/// Return the value bytes of the first `kind` TLV entry on an extended mint.
fn mint_extension_bytes(data: &[u8], kind: ExtensionType) -> Result<Option<&[u8]>, ProgramError> {
	let mut entries = data.get(MINT_TLV_START..).unwrap_or_default();
	while entries.len() >= 4 {
		let entry = u16::from_le_bytes([entries[0], entries[1]]);
		if entry == ExtensionType::Uninitialized as u16 {
			break;
		}
		let length = usize::from(u16::from_le_bytes([entries[2], entries[3]]));
		let value = entries
			.get(4..4 + length)
			.ok_or(ProgramError::InvalidAccountData)?;
		if entry == kind as u16 {
			return Ok(Some(value));
		}
		entries = &entries[4 + length..];
	}

	Ok(None)
}

#[cfg(test)]
mod tests {
	use alloc::vec::Vec as AllocVec;

	use proptest::prelude::*;

	use super::*;

	const UNKNOWN_ISSUER: Address = Address::new_from_array([7; 32]);
	const HOOK_PROGRAM: Address = Address::new_from_array([9; 32]);

	fn tlv(bytes: &mut AllocVec<u8>, kind: ExtensionType, value: &[u8]) {
		bytes.extend_from_slice(&(kind as u16).to_le_bytes());
		bytes.extend_from_slice(&u16::try_from(value.len()).unwrap().to_le_bytes());
		bytes.extend_from_slice(value);
	}

	fn optional(address: Option<Address>) -> [u8; 32] {
		address.map_or([0; 32], |address| address.to_bytes())
	}

	fn fee_config(older: (u64, u64, u16), newer: (u64, u64, u16)) -> [u8; 108] {
		let mut value = [0u8; 108];
		for (offset, (epoch, maximum_fee, basis_points)) in [(72, older), (90, newer)] {
			value[offset..offset + 8].copy_from_slice(&epoch.to_le_bytes());
			value[offset + 8..offset + 16].copy_from_slice(&maximum_fee.to_le_bytes());
			value[offset + 16..offset + 18].copy_from_slice(&basis_points.to_le_bytes());
		}
		value
	}

	struct StockMint {
		freeze_authority: Option<Address>,
		delegate: Address,
		default_state: u8,
		hook_program: Option<Address>,
		paused: bool,
		fee: Option<[u8; 108]>,
		extra: Option<ExtensionType>,
	}

	impl StockMint {
		/// The mainnet `PreStocks` extension set: permanent delegate, frozen-free
		/// default state, 1% fee, confidential config, null hook, scaled UI,
		/// metadata pointer, pausable config, and on-mint metadata.
		fn prestocks() -> Self {
			Self {
				freeze_authority: Some(PRESTOCKS_ISSUER),
				delegate: PRESTOCKS_ISSUER,
				default_state: 1,
				hook_program: None,
				paused: false,
				fee: Some(fee_config((0, u64::MAX, 50), (1, u64::MAX, 100))),
				extra: None,
			}
		}

		fn bytes(&self) -> AllocVec<u8> {
			let mut bytes = AllocVec::with_capacity(512);
			bytes.extend_from_slice(&1u32.to_le_bytes());
			bytes.extend_from_slice(&[3; 32]);
			bytes.extend_from_slice(&1_000u64.to_le_bytes());
			bytes.push(9);
			bytes.push(1);
			bytes.extend_from_slice(&u32::from(self.freeze_authority.is_some()).to_le_bytes());
			bytes.extend_from_slice(&optional(self.freeze_authority));
			bytes.resize(165, 0);
			bytes.push(1);
			tlv(
				&mut bytes,
				ExtensionType::PermanentDelegate,
				&self.delegate.to_bytes(),
			);
			tlv(
				&mut bytes,
				ExtensionType::DefaultAccountState,
				&[self.default_state],
			);
			if let Some(fee) = self.fee {
				tlv(&mut bytes, ExtensionType::TransferFeeConfig, &fee);
			}
			tlv(
				&mut bytes,
				ExtensionType::ConfidentialTransferMint,
				&[0; 65],
			);
			tlv(
				&mut bytes,
				ExtensionType::ConfidentialTransferFeeConfig,
				&[0; 129],
			);
			let mut hook = [0u8; 64];
			hook[..32].copy_from_slice(&self.delegate.to_bytes());
			hook[32..].copy_from_slice(&optional(self.hook_program));
			tlv(&mut bytes, ExtensionType::TransferHook, &hook);
			tlv(&mut bytes, ExtensionType::ScaledUiAmount, &[0; 56]);
			tlv(&mut bytes, ExtensionType::MetadataPointer, &[0; 64]);
			let mut pausable = [0u8; 33];
			pausable[..32].copy_from_slice(&self.delegate.to_bytes());
			pausable[32] = u8::from(self.paused);
			tlv(&mut bytes, ExtensionType::Pausable, &pausable);
			if let Some(extra) = self.extra {
				tlv(&mut bytes, extra, &[0; 8]);
			}
			tlv(&mut bytes, ExtensionType::TokenMetadata, &[0; 16]);
			bytes
		}
	}

	fn invalid_prize() -> ProgramError {
		lootbox_error(LootboxError::InvalidPrize)
	}

	#[test]
	fn allowlisted_issuers_admit_their_stock_extension_sets() {
		let config = admit_token_2022_prize(&StockMint::prestocks().bytes())
			.expect("PreStocks mint")
			.expect("transfer fee config");
		assert_eq!(
			config.epoch_fee(0),
			TransferFee {
				basis_points: 50,
				maximum_fee: u64::MAX
			}
		);
		assert_eq!(config.epoch_fee(1).basis_points, 100);
		assert_eq!(config.epoch_fee(900).basis_points, 100);

		let xstock = StockMint {
			freeze_authority: Some(Address::new_from_array([5; 32])),
			delegate: XSTOCKS_ISSUER,
			fee: None,
			..StockMint::prestocks()
		};
		assert_eq!(admit_token_2022_prize(&xstock.bytes()), Ok(None));
	}

	#[test]
	fn unknown_delegate_with_the_stock_extension_set_is_rejected() {
		let mint = StockMint {
			delegate: UNKNOWN_ISSUER,
			..StockMint::prestocks()
		};
		assert_eq!(admit_token_2022_prize(&mint.bytes()), Err(invalid_prize()));
		let unfrozen = StockMint {
			freeze_authority: None,
			fee: None,
			..mint
		};
		assert_eq!(
			admit_token_2022_prize(&unfrozen.bytes()),
			Err(invalid_prize())
		);
	}

	#[test]
	fn issuer_stock_rejects_hooks_pauses_frozen_defaults_and_other_extensions() {
		for mint in [
			StockMint {
				hook_program: Some(HOOK_PROGRAM),
				..StockMint::prestocks()
			},
			StockMint {
				paused: true,
				..StockMint::prestocks()
			},
			StockMint {
				default_state: 2,
				..StockMint::prestocks()
			},
			StockMint {
				extra: Some(ExtensionType::NonTransferable),
				..StockMint::prestocks()
			},
			StockMint {
				extra: Some(ExtensionType::InterestBearingConfig),
				..StockMint::prestocks()
			},
		] {
			assert_eq!(admit_token_2022_prize(&mint.bytes()), Err(invalid_prize()));
		}
	}

	#[test]
	fn ordinary_mints_keep_the_strict_policy() {
		let mut plain = AllocVec::new();
		plain.extend_from_slice(&[0; 4 + 32 + 8]);
		plain.push(6);
		plain.push(1);
		plain.extend_from_slice(&[0; 36]);
		assert_eq!(admit_token_2022_prize(&plain), Ok(None));

		let mut frozen = plain.clone();
		frozen[46..50].copy_from_slice(&1u32.to_le_bytes());
		frozen[50..82].copy_from_slice(&PRESTOCKS_ISSUER.to_bytes());
		assert_eq!(admit_token_2022_prize(&frozen), Err(invalid_prize()));

		let mut fee_only = plain;
		fee_only.resize(165, 0);
		fee_only.push(1);
		tlv(
			&mut fee_only,
			ExtensionType::TransferFeeConfig,
			&fee_config((0, 0, 0), (0, 0, 0)),
		);
		assert_eq!(admit_token_2022_prize(&fee_only), Err(invalid_prize()));
	}

	#[test]
	fn gross_up_matches_token_2022_edge_cases() {
		let one_percent = TransferFee {
			basis_points: 100,
			maximum_fee: u64::MAX,
		};
		assert_eq!(one_percent.gross_for_net(99), Some(100));
		assert_eq!(one_percent.gross_for_net(1), Some(2));
		assert_eq!(one_percent.gross_for_net(0), Some(0));
		let capped = TransferFee {
			basis_points: 100,
			maximum_fee: 3,
		};
		assert_eq!(capped.gross_for_net(1_000_000), Some(1_000_003));
		let free = TransferFee {
			basis_points: 0,
			maximum_fee: 0,
		};
		assert_eq!(free.gross_for_net(u64::MAX), Some(u64::MAX));
		let everything = TransferFee {
			basis_points: 10_000,
			maximum_fee: 5,
		};
		assert_eq!(everything.gross_for_net(10), Some(15));
		assert_eq!(one_percent.gross_for_net(u64::MAX), None);
	}

	proptest! {
		#[test]
		fn gross_up_credits_exactly_the_requested_net(
			net in prop_oneof![0u64..1_000_000_000, any::<u64>()],
			basis_points in 0u16..=10_000,
			maximum_fee in prop_oneof![Just(u64::MAX), Just(0u64), 0u64..1_000_000],
		) {
			let schedule = TransferFee { basis_points, maximum_fee };
			if let Some(gross) = schedule.gross_for_net(net) {
				prop_assert_eq!(gross - schedule.fee(gross).unwrap(), net);
				// The gross is minimal: one unit less can never credit `net`.
				if gross > net {
					let short = gross - 1;
					prop_assert!(short - schedule.fee(short).unwrap() < net);
				}
			} else {
				// No fee-paying gross fits in a u64: both the uncapped and the
				// capped minimum overflow.
				let capped = u128::from(net) + u128::from(maximum_fee);
				let uncapped = (basis_points < 10_000).then(|| {
					(u128::from(net) * 10_000).div_ceil(10_000 - u128::from(basis_points))
				});
				let minimum = uncapped.map_or(capped, |uncapped| uncapped.min(capped));
				prop_assert!(minimum > u128::from(u64::MAX));
			}
		}
	}
}
