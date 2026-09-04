//! Allocation-free planning for finite prize inventories.

use crate::MAX_OUTCOMES;
use crate::MAX_TOTAL_WEIGHT;

// So11111111111111111111111111111111111111112. Match the program's
// reward policy: use native SOL instead of a wrapped-SOL token prize.
const WRAPPED_SOL_MINT: [u8; 32] = [
	6, 155, 136, 87, 254, 171, 129, 132, 251, 104, 127, 99, 70, 24, 192, 53, 218, 196, 57, 220, 26,
	235, 59, 85, 152, 160, 240, 0, 0, 0, 0, 1,
];

/// A native SOL, classic SPL Token, or unique NFT prize.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PrizeAsset {
	Sol { lamports: u64 },
	Token { mint: [u8; 32], amount: u64 },
	Nft { mint: [u8; 32] },
}

impl PrizeAsset {
	/// None denotes native SOL, otherwise the token mint address.
	#[must_use]
	pub const fn mint(self) -> Option<[u8; 32]> {
		match self {
			Self::Sol { .. } => None,
			Self::Token { mint, .. } | Self::Nft { mint } => Some(mint),
		}
	}

	/// Base units delivered by one winning bundle.
	#[must_use]
	pub const fn amount(self) -> u64 {
		match self {
			Self::Sol { lamports } => lamports,
			Self::Token { amount, .. } => amount,
			Self::Nft { .. } => 1,
		}
	}
}

/// Complete discrete prize with a finite number of available copies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PrizeBundle<'a> {
	pub quantity: u64,
	/// Per-unit weight; selection weight is this multiplied by remaining copies.
	pub weight: u64,
	pub assets: &'a [PrizeAsset],
}

/// Invalid finite-pool configuration.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TemplatePlanError {
	InvalidBundleCount,
	InvalidAssetCount,
	ZeroQuantityOrWeight,
	InvalidAsset,
	DuplicateAsset,
	DuplicateNft,
	InvalidSupply,
	WeightLimitExceeded,
	ArithmeticOverflow,
}

/// Borrowed, checked prize manifest. Chain-side authority and mint validation
/// remain mandatory; a planner cannot prove that an NFT really is unique.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TemplatePlan<'a> {
	bundles: &'a [PrizeBundle<'a>],
	max_supply: u64,
	total_bundles: u64,
	total_weight: u64,
}

impl<'a> TemplatePlan<'a> {
	/// Validate quantities, weights, collateral products, and NFT uniqueness.
	///
	/// # Errors
	/// Returns [`TemplatePlanError`] for a malformed or overcommitted manifest.
	pub fn new(max_supply: u64, bundles: &'a [PrizeBundle<'a>]) -> Result<Self, TemplatePlanError> {
		if bundles.is_empty() || bundles.len() > MAX_OUTCOMES {
			return Err(TemplatePlanError::InvalidBundleCount);
		}

		let mut total_bundles = 0u64;
		let mut total_weight = 0u64;
		for (bundle_index, bundle) in bundles.iter().enumerate() {
			validate_bundle(bundle)?;
			total_bundles = total_bundles
				.checked_add(bundle.quantity)
				.ok_or(TemplatePlanError::ArithmeticOverflow)?;
			total_weight = bundle
				.weight
				.checked_mul(bundle.quantity)
				.and_then(|weight| total_weight.checked_add(weight))
				.ok_or(TemplatePlanError::ArithmeticOverflow)?;
			for asset in bundle.assets {
				if matches!(asset, PrizeAsset::Nft { .. })
					&& bundles[..bundle_index]
						.iter()
						.flat_map(|previous| previous.assets)
						.any(|previous| {
							matches!(previous, PrizeAsset::Nft { .. })
								&& previous.mint() == asset.mint()
						}) {
					return Err(TemplatePlanError::DuplicateNft);
				}
			}
		}

		if total_weight > MAX_TOTAL_WEIGHT {
			return Err(TemplatePlanError::WeightLimitExceeded);
		}

		if max_supply == 0 || max_supply > total_bundles {
			return Err(TemplatePlanError::InvalidSupply);
		}

		let plan = Self {
			bundles,
			max_supply,
			total_bundles,
			total_weight,
		};
		for asset in bundles.iter().flat_map(|bundle| bundle.assets) {
			plan.required_collateral(asset.mint())?;
		}

		Ok(plan)
	}

	#[must_use]
	pub const fn max_supply(&self) -> u64 {
		self.max_supply
	}

	#[must_use]
	pub const fn total_bundles(&self) -> u64 {
		self.total_bundles
	}

	#[must_use]
	pub const fn total_weight(&self) -> u64 {
		self.total_weight
	}

	#[must_use]
	pub const fn bundles(&self) -> &'a [PrizeBundle<'a>] {
		self.bundles
	}

	/// Exact initial probability as a numerator/denominator pair.
	#[must_use]
	pub fn odds(&self, index: usize) -> Option<(u64, u64)> {
		let bundle = self.bundles.get(index)?;
		Some((
			bundle.weight.checked_mul(bundle.quantity)?,
			self.total_weight,
		))
	}

	/// Sum of all escrow deposits for this asset. None selects native SOL.
	///
	/// # Errors
	/// Returns arithmetic overflow if a total cannot fit in an on-chain u64.
	pub fn required_collateral(&self, mint: Option<[u8; 32]>) -> Result<u64, TemplatePlanError> {
		self.bundles.iter().try_fold(0u64, |total, bundle| {
			bundle
				.assets
				.iter()
				.filter(|asset| asset.mint() == mint)
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
	if bundle.quantity == 0 || bundle.weight == 0 {
		return Err(TemplatePlanError::ZeroQuantityOrWeight);
	}

	if bundle.assets.is_empty() || bundle.assets.len() > 4 {
		return Err(TemplatePlanError::InvalidAssetCount);
	}

	for (index, asset) in bundle.assets.iter().enumerate() {
		if asset.amount() == 0
			|| asset.mint() == Some([0; 32])
			|| asset.mint() == Some(WRAPPED_SOL_MINT)
		{
			return Err(TemplatePlanError::InvalidAsset);
		}

		if matches!(asset, PrizeAsset::Nft { .. }) && bundle.quantity != 1 {
			return Err(TemplatePlanError::DuplicateNft);
		}

		if bundle.assets[..index]
			.iter()
			.any(|previous| previous.mint() == asset.mint())
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
		let assets = [PrizeAsset::Token {
			mint: WRAPPED_SOL_MINT,
			amount: 1,
		}];
		let bundle = PrizeBundle {
			quantity: 1,
			weight: 1,
			assets: &assets,
		};
		assert_eq!(
			TemplatePlan::new(1, &[bundle]),
			Err(TemplatePlanError::InvalidAsset)
		);
	}

	#[test]
	fn mixed_bundle_plan_totals_inventory_and_exact_odds() {
		let small = [PrizeAsset::Sol {
			lamports: 100_000_000,
		}];
		let jackpot = [
			PrizeAsset::Sol {
				lamports: 1_000_000_000,
			},
			PrizeAsset::Nft { mint: [7; 32] },
		];
		let bundles = [
			PrizeBundle {
				quantity: 99,
				weight: 1,
				assets: &small,
			},
			PrizeBundle {
				quantity: 1,
				weight: 1,
				assets: &jackpot,
			},
		];
		let plan = TemplatePlan::new(100, &bundles).expect("plan");
		assert_eq!(plan.odds(1), Some((1, 100)));
		assert_eq!(plan.required_collateral(None), Ok(10_900_000_000));
		assert_eq!(plan.required_collateral(Some([7; 32])), Ok(1));
	}

	#[test]
	fn rejects_duplicate_nfts_and_overissuance() {
		let nft = [PrizeAsset::Nft { mint: [7; 32] }];
		let bundle = PrizeBundle {
			quantity: 1,
			weight: 1,
			assets: &nft,
		};
		assert_eq!(
			TemplatePlan::new(2, &[bundle, bundle]),
			Err(TemplatePlanError::DuplicateNft)
		);
		assert_eq!(
			TemplatePlan::new(2, &[bundle]),
			Err(TemplatePlanError::InvalidSupply)
		);
	}
}
