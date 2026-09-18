//! `no_std` planning for append-only, fully funded prize inventories.

use alloc::vec::Vec;

use crate::MAX_TEMPLATE_BUNDLES;

const MAX_TOTAL_TICKETS: u64 = u32::MAX as u64;
pub const MAX_PRIZE_POOL_ITEMS: u32 = 4_096;
pub const MAX_PRIZE_POOL_METADATA_BYTES: usize = 512;
pub const MAX_PRIZE_POOL_PROOF_NODES: usize = 16;
// So11111111111111111111111111111111111111112. Match the program's
// reward policy: use native SOL instead of a wrapped-SOL token prize.
const WRAPPED_SOL_MINT: [u8; 32] = [
	6, 155, 136, 87, 254, 171, 129, 132, 251, 104, 127, 99, 70, 24, 192, 53, 218, 196, 57, 220, 26,
	235, 59, 85, 152, 160, 240, 0, 0, 0, 0, 1,
];

/// A supported treasury asset. External ownership and transfer-rule validation
/// remains an on-chain concern; this type makes the intended adapter explicit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PrizePoolItem<'a> {
	pub asset: [u8; 32],
	/// Must be `false`; unknown mutability fails closed in checked planners.
	pub metadata_mutable: bool,
	/// Canonical Bubblegum V1 `MetadataArgs` Borsh preimage.
	pub metadata: &'a [u8],
	pub tree: [u8; 32],
	pub tree_config: [u8; 32],
	pub root: [u8; 32],
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub leaf_index: u32,
	pub proof: &'a [[u8; 32]],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PrizeAsset<'a> {
	Sol {
		lamports: u64,
	},
	QuoteSol {
		lamports: u64,
	},
	ClassicToken {
		mint: [u8; 32],
		amount: u64,
	},
	Token2022 {
		mint: [u8; 32],
		amount: u64,
	},
	QuoteToken {
		mint: [u8; 32],
		amount: u64,
	},
	MintBadge {
		mint: [u8; 32],
	},
	LegacyNft {
		mint: [u8; 32],
	},
	MetadataNft {
		mint: [u8; 32],
	},
	CoreAsset {
		asset: [u8; 32],
	},
	CompressedNft {
		asset: [u8; 32],
	},
	/// One entropy-selected Bubblegum leaf from a separately escrowed pool.
	PrizePool {
		tree: [u8; 32],
		items: &'a [PrizePoolItem<'a>],
	},
}

impl PrizeAsset<'_> {
	/// None denotes native SOL; every other value is the stored asset identifier.
	#[must_use]
	pub const fn identifier(self) -> Option<[u8; 32]> {
		match self {
			Self::Sol { .. } | Self::QuoteSol { .. } => None,
			Self::ClassicToken { mint, .. }
			| Self::Token2022 { mint, .. }
			| Self::QuoteToken { mint, .. }
			| Self::MintBadge { mint }
			| Self::LegacyNft { mint }
			| Self::MetadataNft { mint } => Some(mint),
			Self::CoreAsset { asset } | Self::CompressedNft { asset } => Some(asset),
			Self::PrizePool { tree, .. } => Some(tree),
		}
	}

	/// Base units delivered by one winning bundle.
	#[must_use]
	pub const fn amount(self) -> u64 {
		match self {
			Self::Sol { lamports } | Self::QuoteSol { lamports } => lamports,
			Self::ClassicToken { amount, .. }
			| Self::Token2022 { amount, .. }
			| Self::QuoteToken { amount, .. } => amount,
			Self::MintBadge { .. }
			| Self::LegacyNft { .. }
			| Self::MetadataNft { .. }
			| Self::CoreAsset { .. }
			| Self::CompressedNft { .. }
			| Self::PrizePool { .. } => 1,
		}
	}

	#[must_use]
	pub const fn is_unique(self) -> bool {
		matches!(
			self,
			Self::MintBadge { .. }
				| Self::LegacyNft { .. }
				| Self::MetadataNft { .. }
				| Self::CoreAsset { .. }
				| Self::CompressedNft { .. }
		)
	}

	#[must_use]
	pub const fn requires_single_copy(self) -> bool {
		self.is_unique() && !matches!(self, Self::MintBadge { .. })
	}
}

/// Complete discrete prize with a finite number of equal-probability copies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PrizeBundle<'a> {
	pub quantity: u64,
	pub assets: &'a [PrizeAsset<'a>],
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
	PlanningCapacityExceeded,
	TicketLimitExceeded,
	ArithmeticOverflow,
}

impl core::fmt::Display for TemplatePlanError {
	fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
		formatter.write_str(match self {
			Self::InvalidBundleCount => "a template needs between one and 1,024 bundles",
			Self::InvalidAssetCount => "bundles need between one and four assets",
			Self::ZeroQuantity => "bundle quantity must be greater than zero",
			Self::InvalidAsset => "prize asset is not supported",
			Self::DuplicateAsset => "a bundle cannot contain the same asset twice",
			Self::DuplicateUniqueAsset => "a unique asset can fund only one bundle copy",
			Self::PlanningCapacityExceeded => {
				"the planner could not reserve memory for unique-asset validation"
			}
			Self::TicketLimitExceeded => "total bundle copies exceed u32::MAX",
			Self::ArithmeticOverflow => "template plan exceeds the on-chain u64 range",
		})
	}
}

impl core::error::Error for TemplatePlanError {}

/// Creator-funded optional services attached to a locked treasury.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ServicePlan {
	pub settlement_bounty_lamports: u64,
	pub result_receipts_enabled: bool,
}

/// Borrowed, checked prize manifest. Its total tickets are the mint capacity.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TemplatePlan<'a> {
	bundles: &'a [PrizeBundle<'a>],
	total_bundles: u64,
	services: ServicePlan,
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
		for bundle in bundles {
			validate_bundle(bundle)?;
			total_bundles = total_bundles
				.checked_add(bundle.quantity)
				.ok_or(TemplatePlanError::ArithmeticOverflow)?;
			if total_bundles > MAX_TOTAL_TICKETS {
				return Err(TemplatePlanError::TicketLimitExceeded);
			}
		}
		let unique_identifier_count =
			bundles
				.iter()
				.flat_map(|bundle| bundle.assets)
				.try_fold(0usize, |count, asset| {
					let additional = match asset {
						PrizeAsset::PrizePool { items, .. } => items.len(),
						_ => usize::from(asset.is_unique()),
					};
					count
						.checked_add(additional)
						.ok_or(TemplatePlanError::ArithmeticOverflow)
				})?;
		let mut unique_identifiers = Vec::new();
		unique_identifiers
			.try_reserve_exact(unique_identifier_count)
			.map_err(|_| TemplatePlanError::PlanningCapacityExceeded)?;
		for asset in bundles.iter().flat_map(|bundle| bundle.assets) {
			match asset {
				PrizeAsset::PrizePool { items, .. } => {
					unique_identifiers.extend(items.iter().map(|item| item.asset));
				}
				_ if asset.is_unique() => {
					unique_identifiers
						.push(asset.identifier().ok_or(TemplatePlanError::InvalidAsset)?);
				}
				_ => {}
			}
		}
		unique_identifiers.sort_unstable();
		if unique_identifiers.windows(2).any(|pair| pair[0] == pair[1]) {
			return Err(TemplatePlanError::DuplicateUniqueAsset);
		}

		let plan = Self {
			bundles,
			total_bundles,
			services: ServicePlan::default(),
		};
		for asset in bundles.iter().flat_map(|bundle| bundle.assets) {
			plan.required_collateral(asset.identifier())?;
		}

		Ok(plan)
	}

	/// Attach creator-funded receipt and settlement options.
	#[must_use]
	pub const fn with_services(mut self, services: ServicePlan) -> Self {
		self.services = services;

		self
	}

	#[must_use]
	pub const fn total_bundles(&self) -> u64 {
		self.total_bundles
	}

	/// Exact zero-decimal box issuance after the treasury is market locked.
	#[must_use]
	pub const fn fixed_supply(&self) -> u64 {
		self.total_bundles
	}

	#[must_use]
	pub const fn bundles(&self) -> &'a [PrizeBundle<'a>] {
		self.bundles
	}

	#[must_use]
	pub const fn services(&self) -> ServicePlan {
		self.services
	}

	/// Calculate the service funding transferred at treasury lock.
	///
	/// `result_receipt_rent` and `service_vault_rent` must be the cluster's
	/// current rent-exempt minimums for one result receipt and a zero-data
	/// service vault, respectively.
	///
	/// # Errors
	/// Returns arithmetic overflow when the full creator budget does not fit in
	/// an on-chain `u64` balance.
	pub fn required_service_budget(
		&self,
		result_receipt_rent: u64,
		service_vault_rent: u64,
	) -> Result<u64, TemplatePlanError> {
		let receipt_budget = if self.services.result_receipts_enabled {
			result_receipt_rent
				.checked_mul(self.total_bundles)
				.ok_or(TemplatePlanError::ArithmeticOverflow)?
		} else {
			0
		};
		let bounty_budget = self
			.services
			.settlement_bounty_lamports
			.checked_mul(self.total_bundles)
			.ok_or(TemplatePlanError::ArithmeticOverflow)?;

		let reserve = receipt_budget
			.checked_add(bounty_budget)
			.ok_or(TemplatePlanError::ArithmeticOverflow)?;

		if reserve == 0 {
			Ok(0)
		} else {
			reserve
				.checked_add(service_vault_rent)
				.ok_or(TemplatePlanError::ArithmeticOverflow)
		}
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

	let mut prize_pool_count = 0;
	for (index, asset) in bundle.assets.iter().enumerate() {
		if let PrizeAsset::PrizePool { tree, items } = asset {
			prize_pool_count += 1;
			if prize_pool_count > 1
				|| items.is_empty()
				|| items.len() > MAX_PRIZE_POOL_ITEMS as usize
				|| u64::try_from(items.len()).map_err(|_| TemplatePlanError::InvalidAsset)?
					!= bundle.quantity
				|| items.iter().any(|item| {
					item.asset == [0; 32]
						|| item.metadata_mutable
						|| item.metadata.is_empty()
						|| item.metadata.len() > MAX_PRIZE_POOL_METADATA_BYTES
						|| item.tree != *tree
						|| item.tree_config == [0; 32]
						|| item.proof.len() > MAX_PRIZE_POOL_PROOF_NODES
				}) {
				return Err(TemplatePlanError::InvalidAsset);
			}
		}
		if asset.amount() == 0
			|| asset.identifier() == Some([0; 32])
			|| asset.identifier() == Some(WRAPPED_SOL_MINT)
		{
			return Err(TemplatePlanError::InvalidAsset);
		}
		if asset.requires_single_copy() && bundle.quantity != 1 {
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
	use std::vec;

	use super::*;

	#[derive(serde::Deserialize)]
	#[serde(rename_all = "camelCase")]
	struct ServiceBudgetVector {
		total_bundles: std::string::String,
		settlement_bounty_lamports: std::string::String,
		result_receipts_enabled: bool,
		result_receipt_rent_lamports: std::string::String,
		service_vault_rent_lamports: std::string::String,
		expected_budget_lamports: std::string::String,
	}

	#[derive(serde::Deserialize)]
	#[serde(rename_all = "camelCase")]
	struct PrizePoolVector {
		max_items: u32,
		valid_quantity: u64,
		valid_item_count: u32,
		mismatched_item_count: u32,
		mutable_item_count: u32,
		duplicate_item_count: u32,
		oversized_quantity: u64,
		valid_metadata_bytes: usize,
		oversized_metadata_bytes: usize,
		valid_proof_nodes: usize,
		oversized_proof_nodes: usize,
	}

	fn pool_item(asset: [u8; 32], tree: [u8; 32]) -> PrizePoolItem<'static> {
		static METADATA: [u8; 1] = [1];
		static PROOF: [[u8; 32]; 1] = [[7; 32]];
		PrizePoolItem {
			asset,
			metadata_mutable: false,
			metadata: &METADATA,
			tree,
			tree_config: [8; 32],
			root: [1; 32],
			data_hash: [2; 32],
			creator_hash: [3; 32],
			nonce: 0,
			leaf_index: 0,
			proof: &PROOF,
		}
	}

	fn service_budget_vector() -> ServiceBudgetVector {
		serde_json::from_str(include_str!("../../../tests/vectors/service-budget.json"))
			.expect("valid shared service budget vector")
	}

	fn prize_pool_vector() -> PrizePoolVector {
		serde_json::from_str(include_str!("../../../tests/vectors/prize-pool.json"))
			.expect("valid shared PrizePool vector")
	}

	#[test]
	fn prize_pool_capacity_matches_quantity_and_shared_limit() {
		let vector = prize_pool_vector();
		assert_eq!(MAX_PRIZE_POOL_ITEMS, vector.max_items);
		let tree = [9; 32];
		let valid_items = (1..=vector.valid_item_count)
			.map(|value| pool_item([u8::try_from(value).expect("small vector"); 32], tree))
			.collect::<Vec<_>>();
		let valid = [PrizeAsset::PrizePool {
			tree,
			items: &valid_items,
		}];
		let bundle = PrizeBundle {
			quantity: vector.valid_quantity,
			assets: &valid,
		};
		let bundles = [bundle];
		let plan = TemplatePlan::new(&bundles).expect("valid pool plan");
		assert_eq!(plan.fixed_supply(), vector.valid_quantity);
		assert_eq!(
			plan.required_collateral(Some(tree)),
			Ok(vector.valid_quantity)
		);

		let mismatched_items =
			&valid_items[..usize::try_from(vector.mismatched_item_count).expect("item count")];
		let mismatched = [PrizeAsset::PrizePool {
			tree,
			items: mismatched_items,
		}];
		assert_eq!(
			TemplatePlan::new(&[PrizeBundle {
				quantity: vector.valid_quantity,
				assets: &mismatched,
			}]),
			Err(TemplatePlanError::InvalidAsset)
		);
		let oversized_items = vec![
			pool_item([7; 32], tree);
			usize::try_from(vector.oversized_quantity).expect("usize vector")
		];
		let oversized = [PrizeAsset::PrizePool {
			tree,
			items: &oversized_items,
		}];
		assert_eq!(
			TemplatePlan::new(&[PrizeBundle {
				quantity: vector.oversized_quantity,
				assets: &oversized,
			}]),
			Err(TemplatePlanError::InvalidAsset)
		);

		let mutable_items = vec![
			PrizePoolItem {
				metadata_mutable: true,
				..pool_item([4; 32], tree)
			};
			usize::try_from(vector.mutable_item_count).expect("mutable count")
		];
		let mutable = [PrizeAsset::PrizePool {
			tree,
			items: &mutable_items,
		}];
		assert_eq!(
			TemplatePlan::new(&[PrizeBundle {
				quantity: u64::from(vector.mutable_item_count),
				assets: &mutable,
			}]),
			Err(TemplatePlanError::InvalidAsset),
		);

		let duplicate_items = vec![
			pool_item([5; 32], tree);
			usize::try_from(vector.duplicate_item_count)
				.expect("duplicate count")
		];
		let duplicate = [PrizeAsset::PrizePool {
			tree,
			items: &duplicate_items,
		}];
		assert_eq!(
			TemplatePlan::new(&[PrizeBundle {
				quantity: u64::from(vector.duplicate_item_count),
				assets: &duplicate,
			}]),
			Err(TemplatePlanError::DuplicateUniqueAsset),
		);

		assert_eq!(vector.valid_metadata_bytes, 1);
		assert_eq!(vector.valid_proof_nodes, 1);
		let oversized_metadata = vec![0; vector.oversized_metadata_bytes];
		let invalid_metadata_item = PrizePoolItem {
			metadata: &oversized_metadata,
			..pool_item([6; 32], tree)
		};
		let invalid_metadata = [PrizeAsset::PrizePool {
			tree,
			items: core::slice::from_ref(&invalid_metadata_item),
		}];
		assert_eq!(
			TemplatePlan::new(&[PrizeBundle {
				quantity: 1,
				assets: &invalid_metadata,
			}]),
			Err(TemplatePlanError::InvalidAsset),
		);
		let oversized_proof = vec![[0; 32]; vector.oversized_proof_nodes];
		let invalid_proof_item = PrizePoolItem {
			proof: &oversized_proof,
			..pool_item([6; 32], tree)
		};
		let invalid_proof = [PrizeAsset::PrizePool {
			tree,
			items: core::slice::from_ref(&invalid_proof_item),
		}];
		assert_eq!(
			TemplatePlan::new(&[PrizeBundle {
				quantity: 1,
				assets: &invalid_proof,
			}]),
			Err(TemplatePlanError::InvalidAsset),
		);
	}

	#[test]
	fn maximum_prize_pool_validates_unique_items_in_one_plan() {
		let tree = [9; 32];
		let items = (0..MAX_PRIZE_POOL_ITEMS)
			.map(|index| {
				let mut asset = [0; 32];
				asset[..4].copy_from_slice(&index.to_le_bytes());
				asset[31] = 1;
				pool_item(asset, tree)
			})
			.collect::<Vec<_>>();
		let assets = [PrizeAsset::PrizePool {
			tree,
			items: &items,
		}];
		let bundles = [PrizeBundle {
			quantity: u64::from(MAX_PRIZE_POOL_ITEMS),
			assets: &assets,
		}];

		assert!(TemplatePlan::new(&bundles).is_ok());
	}

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
		assert_eq!(plan.fixed_supply(), plan.total_bundles());
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

	#[test]
	fn creator_service_budget_is_exact_and_optional() {
		let vector = service_budget_vector();
		let total_bundles = vector.total_bundles.parse().expect("total bundles");
		let settlement_bounty_lamports = vector
			.settlement_bounty_lamports
			.parse()
			.expect("settlement bounty");
		let result_receipt_rent_lamports = vector
			.result_receipt_rent_lamports
			.parse()
			.expect("result receipt rent");
		let service_vault_rent_lamports = vector
			.service_vault_rent_lamports
			.parse()
			.expect("service vault rent");
		let expected_budget_lamports = vector
			.expected_budget_lamports
			.parse()
			.expect("expected budget");
		let sol = [PrizeAsset::Sol { lamports: 1 }];
		let bundles = [PrizeBundle {
			quantity: total_bundles,
			assets: &sol,
		}];
		let plan = TemplatePlan::new(&bundles).expect("plan");
		assert_eq!(
			plan.required_service_budget(result_receipt_rent_lamports, service_vault_rent_lamports),
			Ok(0)
		);

		let plan = plan.with_services(ServicePlan {
			settlement_bounty_lamports,
			result_receipts_enabled: vector.result_receipts_enabled,
		});
		assert_eq!(
			plan.required_service_budget(result_receipt_rent_lamports, service_vault_rent_lamports),
			Ok(expected_budget_lamports)
		);
		assert_eq!(
			plan.services().settlement_bounty_lamports,
			settlement_bounty_lamports
		);
		assert!(plan.services().result_receipts_enabled);
	}

	#[test]
	fn quote_and_badge_prizes_preserve_collateral_and_caps() {
		let assets = [
			PrizeAsset::QuoteSol { lamports: 100 },
			PrizeAsset::MintBadge { mint: [8; 32] },
		];
		let bundles = [PrizeBundle {
			quantity: 10,
			assets: &assets,
		}];
		let plan = TemplatePlan::new(&bundles).expect("dynamic prize plan");
		assert_eq!(plan.required_collateral(None), Ok(1_000));
		assert_eq!(plan.required_collateral(Some([8; 32])), Ok(10));
	}

	#[test]
	fn rejects_more_than_the_compact_inventory_capacity() {
		let assets = [PrizeAsset::Sol { lamports: 1 }];
		let bundle = PrizeBundle {
			quantity: 1,
			assets: &assets,
		};
		let bundles = std::vec![bundle; MAX_TEMPLATE_BUNDLES + 1];
		assert_eq!(
			TemplatePlan::new(&bundles),
			Err(TemplatePlanError::InvalidBundleCount)
		);
	}
}
