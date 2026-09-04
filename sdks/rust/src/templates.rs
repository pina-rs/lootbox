//! Allocation-free planning for append-only, fully funded prize inventories.

use crate::MAX_TEMPLATE_BUNDLES;

const MAX_TOTAL_TICKETS: u64 = u32::MAX as u64;
// So11111111111111111111111111111111111111112. Match the program's
// reward policy: use native SOL instead of a wrapped-SOL token prize.
const WRAPPED_SOL_MINT: [u8; 32] = [
	6, 155, 136, 87, 254, 171, 129, 132, 251, 104, 127, 99, 70, 24, 192, 53, 218, 196, 57, 220, 26,
	235, 59, 85, 152, 160, 240, 0, 0, 0, 0, 1,
];

/// A supported treasury asset. External ownership and transfer-rule validation
/// remains an on-chain concern; this type makes the intended adapter explicit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PrizeAsset {
	Sol { lamports: u64 },
	ClassicToken { mint: [u8; 32], amount: u64 },
	Token2022 { mint: [u8; 32], amount: u64 },
	LegacyNft { mint: [u8; 32] },
	MetadataNft { mint: [u8; 32] },
	CoreAsset { asset: [u8; 32] },
	CompressedNft { asset: [u8; 32] },
}

impl PrizeAsset {
	/// None denotes native SOL; every other value is the stored asset identifier.
	#[must_use]
	pub const fn identifier(self) -> Option<[u8; 32]> {
		match self {
			Self::Sol { .. } => None,
			Self::ClassicToken { mint, .. }
			| Self::Token2022 { mint, .. }
			| Self::LegacyNft { mint }
			| Self::MetadataNft { mint } => Some(mint),
			Self::CoreAsset { asset } | Self::CompressedNft { asset } => Some(asset),
		}
	}

	/// Base units delivered by one winning bundle.
	#[must_use]
	pub const fn amount(self) -> u64 {
		match self {
			Self::Sol { lamports } => lamports,
			Self::ClassicToken { amount, .. } | Self::Token2022 { amount, .. } => amount,
			Self::LegacyNft { .. }
			| Self::MetadataNft { .. }
			| Self::CoreAsset { .. }
			| Self::CompressedNft { .. } => 1,
		}
	}

	#[must_use]
	pub const fn is_unique(self) -> bool {
		matches!(
			self,
			Self::LegacyNft { .. }
				| Self::MetadataNft { .. }
				| Self::CoreAsset { .. }
				| Self::CompressedNft { .. }
		)
	}
}

/// Complete discrete prize with a finite number of equal-probability copies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PrizeBundle<'a> {
	pub quantity: u64,
	pub assets: &'a [PrizeAsset],
}

/// Invalid finite-pool configuration.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TemplatePlanError {
	InvalidBundleCount,
	InvalidAssetCount,
	ZeroQuantity,
	InvalidAsset,
	DuplicateAsset,
	DuplicateUniqueAsset,
	TicketLimitExceeded,
	ArithmeticOverflow,
}

/// Borrowed, checked prize manifest. Its total tickets are the mint capacity.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TemplatePlan<'a> {
	bundles: &'a [PrizeBundle<'a>],
	total_bundles: u64,
}

impl<'a> TemplatePlan<'a> {
	/// Validate quantities, collateral products, and unique-asset ownership.
	///
	/// # Errors
	/// Returns [`TemplatePlanError`] for a malformed or overcommitted manifest.
	pub fn new(bundles: &'a [PrizeBundle<'a>]) -> Result<Self, TemplatePlanError> {
		if bundles.is_empty() || bundles.len() > MAX_TEMPLATE_BUNDLES {
			return Err(TemplatePlanError::InvalidBundleCount);
		}

		let mut total_bundles = 0u64;
		for (bundle_index, bundle) in bundles.iter().enumerate() {
			validate_bundle(bundle)?;
			total_bundles = total_bundles
				.checked_add(bundle.quantity)
				.ok_or(TemplatePlanError::ArithmeticOverflow)?;
			if total_bundles > MAX_TOTAL_TICKETS {
				return Err(TemplatePlanError::TicketLimitExceeded);
			}
			for asset in bundle.assets {
				if asset.is_unique()
					&& bundles[..bundle_index]
						.iter()
						.flat_map(|previous| previous.assets)
						.any(|previous| {
							previous.is_unique() && previous.identifier() == asset.identifier()
						}) {
					return Err(TemplatePlanError::DuplicateUniqueAsset);
				}
			}
		}

		let plan = Self {
			bundles,
			total_bundles,
		};
		for asset in bundles.iter().flat_map(|bundle| bundle.assets) {
			plan.required_collateral(asset.identifier())?;
		}

		Ok(plan)
	}

	#[must_use]
	pub const fn total_bundles(&self) -> u64 {
		self.total_bundles
	}

	#[must_use]
	pub const fn bundles(&self) -> &'a [PrizeBundle<'a>] {
		self.bundles
	}

	/// Exact initial probability as a numerator/denominator pair.
	#[must_use]
	pub fn odds(&self, index: usize) -> Option<(u64, u64)> {
		Some((self.bundles.get(index)?.quantity, self.total_bundles))
	}

	/// Sum all escrow deposits for an identifier. None selects native SOL.
	///
	/// # Errors
	/// Returns arithmetic overflow if a total cannot fit in an on-chain u64.
	pub fn required_collateral(
		&self,
		identifier: Option<[u8; 32]>,
	) -> Result<u64, TemplatePlanError> {
		self.bundles.iter().try_fold(0u64, |total, bundle| {
			bundle
				.assets
				.iter()
				.filter(|asset| asset.identifier() == identifier)
				.try_fold(total, |sum, asset| {
					asset
						.amount()
						.checked_mul(bundle.quantity)
						.and_then(|amount| sum.checked_add(amount))
						.ok_or(TemplatePlanError::ArithmeticOverflow)
				})
		})
	}
}

fn validate_bundle(bundle: &PrizeBundle<'_>) -> Result<(), TemplatePlanError> {
	if bundle.quantity == 0 {
		return Err(TemplatePlanError::ZeroQuantity);
	}
	if bundle.assets.is_empty() || bundle.assets.len() > 4 {
		return Err(TemplatePlanError::InvalidAssetCount);
	}

	for (index, asset) in bundle.assets.iter().enumerate() {
		if asset.amount() == 0
			|| asset.identifier() == Some([0; 32])
			|| asset.identifier() == Some(WRAPPED_SOL_MINT)
		{
			return Err(TemplatePlanError::InvalidAsset);
		}
		if asset.is_unique() && bundle.quantity != 1 {
			return Err(TemplatePlanError::DuplicateUniqueAsset);
		}
		if bundle.assets[..index]
			.iter()
			.any(|previous| previous.identifier() == asset.identifier())
		{
			return Err(TemplatePlanError::DuplicateAsset);
		}
	}

	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn rejects_wrapped_sol_rewards_like_the_program() {
		let assets = [PrizeAsset::ClassicToken {
			mint: WRAPPED_SOL_MINT,
			amount: 1,
		}];
		let bundle = PrizeBundle {
			quantity: 1,
			assets: &assets,
		};
		assert_eq!(
			TemplatePlan::new(&[bundle]),
			Err(TemplatePlanError::InvalidAsset)
		);
	}

	#[test]
	fn mixed_bundle_plan_totals_inventory_and_uniform_odds() {
		let small = [PrizeAsset::Sol {
			lamports: 100_000_000,
		}];
		let jackpot = [
			PrizeAsset::Sol {
				lamports: 1_000_000_000,
			},
			PrizeAsset::CoreAsset { asset: [7; 32] },
		];
		let bundles = [
			PrizeBundle {
				quantity: 99,
				assets: &small,
			},
			PrizeBundle {
				quantity: 1,
				assets: &jackpot,
			},
		];
		let plan = TemplatePlan::new(&bundles).expect("plan");
		assert_eq!(plan.odds(1), Some((1, 100)));
		assert_eq!(plan.required_collateral(None), Ok(10_900_000_000));
		assert_eq!(plan.required_collateral(Some([7; 32])), Ok(1));
	}

	#[test]
	fn rejects_duplicate_unique_assets_and_ticket_overflow() {
		let nft = [PrizeAsset::CompressedNft { asset: [7; 32] }];
		let bundle = PrizeBundle {
			quantity: 1,
			assets: &nft,
		};
		assert_eq!(
			TemplatePlan::new(&[bundle, bundle]),
			Err(TemplatePlanError::DuplicateUniqueAsset)
		);
		let sol = [PrizeAsset::Sol { lamports: 1 }];
		let too_many = [PrizeBundle {
			quantity: MAX_TOTAL_TICKETS + 1,
			assets: &sol,
		}];
		assert_eq!(
			TemplatePlan::new(&too_many),
			Err(TemplatePlanError::TicketLimitExceeded)
		);
	}
}
