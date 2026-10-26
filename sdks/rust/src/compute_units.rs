//! Compute-unit budgets for lootbox transactions.
//!
//! The measured figures come from the deterministic Surfpool journeys in
//! `docs/performance.md` and are pinned across the TypeScript, Dart, and Rust
//! planners by `tests/vectors/compute-units.json`. The journeys use fixture
//! keys whose canonical bumps sit near 255; real keys can land further down
//! the bump search and shift an instruction by thousands of units, so the
//! budget applies a generous margin. Priority fees are charged on the compute
//! units a transaction consumes, never on the requested limit, so the margin
//! only guards against limit exhaustion.

use lootbox_program_client::instructions as generated;
use solana_pubkey::Pubkey;
use solana_pubkey::pubkey;

/// Multiplier applied to the summed measured compute units.
pub const COMPUTE_UNIT_MARGIN_MULTIPLIER: u64 = 2;
/// Flat compute units added after the multiplier.
pub const COMPUTE_UNIT_MARGIN_ADDEND: u64 = 10_000;
/// Lowest compute-unit limit the policy ever requests.
pub const COMPUTE_UNIT_MINIMUM: u64 = 50_000;
/// Highest compute-unit limit the policy ever requests, under the 1.4M cap.
pub const COMPUTE_UNIT_MAXIMUM: u64 = 1_398_000;

/// The compute budget program, whose instructions never cost lootbox units.
pub const COMPUTE_BUDGET_PROGRAM_ID: Pubkey =
	pubkey!("ComputeBudget111111111111111111111111111111");

/// The measured instruction name and its compute units, if the discriminator
/// belongs to a measured lootbox instruction.
#[must_use]
pub const fn instruction_cost(discriminator: u8) -> Option<(&'static str, u64)> {
	match discriminator {
		generated::ACTIVATE_BUNDLE_DISCRIMINATOR => Some(("activateBundle", 6000)),
		generated::ADD_BUNDLE_DISCRIMINATOR => Some(("addBundle", 6590)),
		generated::ALLOCATE_PRIZE_POOL_OPEN_DISCRIMINATOR => {
			Some(("allocatePrizePoolOpen", 19_497))
		}
		generated::ALLOCATE_TEMPLATE_OPEN_DISCRIMINATOR => Some(("allocateTemplateOpen", 21_204)),
		generated::APPEND_EXCLUSIVE_TREE_DISCRIMINATOR => Some(("appendExclusiveTree", 115_407)),
		generated::ATTACH_EXCLUSIVE_NFT_DISCRIMINATOR => Some(("attachExclusiveNft", 13_663)),
		generated::BUY_CURVE_BOXES_DISCRIMINATOR => Some(("buyCurveBoxes", 11_369)),
		generated::CANCEL_BUNDLE_DISCRIMINATOR => Some(("cancelBundle", 3813)),
		generated::CANCEL_PRIZE_POOL_ITEM_DISCRIMINATOR => Some(("cancelPrizePoolItem", 7564)),
		generated::CLAIM_CORE_ASSET_PRIZE_DISCRIMINATOR => Some(("claimCoreAssetPrize", 12_135)),
		generated::CLAIM_EXCLUSIVE_NFT_DISCRIMINATOR => Some(("claimExclusiveNft", 125_489)),
		generated::CLAIM_MINT_PRIZE_DISCRIMINATOR => Some(("claimMintPrize", 13_525)),
		generated::CLAIM_PRIZE_POOL_ITEM_DISCRIMINATOR => Some(("claimPrizePoolItem", 15_249)),
		generated::CLAIM_SOL_PRIZE_DISCRIMINATOR => Some(("claimSolPrize", 5469)),
		generated::CLAIM_STRANDED_PRIZE_POOL_ITEM_DISCRIMINATOR => {
			Some(("claimStrandedPrizePoolItem", 20_434))
		}
		generated::CLAIM_TOKEN_PRIZE_DISCRIMINATOR => Some(("claimTokenPrize", 15_025)),
		generated::CLOSE_BOX_CURVE_DISCRIMINATOR => Some(("closeBoxCurve", 10_490)),
		generated::CLOSE_PRIZE_POOL_DISCRIMINATOR => Some(("closePrizePool", 5767)),
		generated::CLOSE_SERVICE_VAULT_DISCRIMINATOR => Some(("closeServiceVault", 5359)),
		generated::CLOSE_TEMPLATE_OPENING_DISCRIMINATOR => Some(("closeTemplateOpening", 7642)),
		generated::CREATE_EXCLUSIVE_COLLECTION_DISCRIMINATOR => {
			Some(("createExclusiveCollection", 23_905))
		}
		generated::CREATE_PRIZE_POOL_DISCRIMINATOR => Some(("createPrizePool", 15_002)),
		generated::CREATE_TEMPLATE_DISCRIMINATOR => Some(("createTemplate", 11_931)),
		generated::DEPOSIT_PRIZE_POOL_ITEM_DISCRIMINATOR => Some(("depositPrizePoolItem", 14_979)),
		generated::FORFEIT_TEMPLATE_OPEN_DISCRIMINATOR => Some(("forfeitTemplateOpen", 8997)),
		generated::FULFILL_TEMPLATE_OPEN_DISCRIMINATOR => Some(("fulfillTemplateOpen", 13_579)),
		generated::FUND_CORE_ASSET_PRIZE_DISCRIMINATOR => Some(("fundCoreAssetPrize", 10_246)),
		generated::FUND_MINT_PRIZE_DISCRIMINATOR => Some(("fundMintPrize", 5338)),
		generated::FUND_QUOTE_SOL_PRIZE_DISCRIMINATOR => Some(("fundQuoteSolPrize", 5097)),
		generated::FUND_QUOTE_TOKEN_PRIZE_DISCRIMINATOR => Some(("fundQuoteTokenPrize", 8559)),
		generated::FUND_SOL_PRIZE_DISCRIMINATOR => Some(("fundSolPrize", 5098)),
		generated::FUND_TOKEN_PRIZE_DISCRIMINATOR => Some(("fundTokenPrize", 8639)),
		generated::LOCK_TREASURY_DISCRIMINATOR => Some(("lockTreasury", 11_693)),
		generated::MINT_TEMPLATE_BOXES_DISCRIMINATOR => Some(("mintTemplateBoxes", 7379)),
		generated::OPEN_BOX_CURVE_DISCRIMINATOR => Some(("openBoxCurve", 11_654)),
		generated::PREPARE_PRIZE_POOL_ITEM_DISCRIMINATOR => Some(("preparePrizePoolItem", 14_874)),
		generated::PUBLISH_EXCLUSIVE_COLLECTION_DISCRIMINATOR => {
			Some(("publishExclusiveCollection", 21_409))
		}
		generated::RECLAIM_CORE_ASSET_PRIZE_DISCRIMINATOR => {
			Some(("reclaimCoreAssetPrize", 10_654))
		}
		generated::RECLAIM_EXCLUSIVE_FEES_DISCRIMINATOR => Some(("reclaimExclusiveFees", 9328)),
		generated::RECLAIM_MINT_PRIZE_DISCRIMINATOR => Some(("reclaimMintPrize", 5615)),
		generated::RECLAIM_PRIZE_POOL_ITEM_DISCRIMINATOR => Some(("reclaimPrizePoolItem", 15_504)),
		generated::RECLAIM_SOL_PRIZE_DISCRIMINATOR => Some(("reclaimSolPrize", 4297)),
		generated::RECLAIM_TOKEN_PRIZE_DISCRIMINATOR => Some(("reclaimTokenPrize", 13_422)),
		generated::REQUEST_TEMPLATE_OPEN_DISCRIMINATOR => Some(("requestTemplateOpen", 23_972)),
		generated::RETIRE_TEMPLATE_DISCRIMINATOR => Some(("retireTemplate", 2328)),
		generated::SEAL_PRIZE_POOL_DISCRIMINATOR => Some(("sealPrizePool", 6170)),
		generated::SEAL_TEMPLATE_DISCRIMINATOR => Some(("sealTemplate", 2172)),
		generated::SELL_CURVE_BOXES_DISCRIMINATOR => Some(("sellCurveBoxes", 9014)),
		generated::SET_EXCLUSIVE_LAYER_DISCRIMINATOR => Some(("setExclusiveLayer", 3231)),
		_ => None,
	}
}

/// The discriminator a measured lootbox instruction is known by, from its
/// planner name.
#[must_use]
pub fn discriminator_for_name(name: &str) -> Option<u8> {
	(0..=u8::MAX).find(|&discriminator| {
		instruction_cost(discriminator).is_some_and(|(known, _)| known == name)
	})
}

/// Measured compute units for one lootbox instruction discriminator.
#[must_use]
pub fn measured_compute_units(discriminator: u8) -> Option<u64> {
	instruction_cost(discriminator).map(|(_, units)| units)
}

/// Apply the shared margin policy to a summed measured budget.
#[must_use]
pub const fn compute_unit_limit_for_sum(summed_units: u64) -> u64 {
	let scaled = summed_units
		.saturating_mul(COMPUTE_UNIT_MARGIN_MULTIPLIER)
		.saturating_add(COMPUTE_UNIT_MARGIN_ADDEND);

	if scaled < COMPUTE_UNIT_MINIMUM {
		return COMPUTE_UNIT_MINIMUM;
	}

	if scaled > COMPUTE_UNIT_MAXIMUM {
		return COMPUTE_UNIT_MAXIMUM;
	}

	scaled
}

/// Budget by instruction names, for planners and tests.
#[must_use]
pub fn compute_unit_limit_by_names(names: &[&str]) -> Option<u64> {
	if names.is_empty() {
		return None;
	}

	let mut sum: u64 = 0;

	for name in names {
		let units = discriminator_for_name(name).and_then(measured_compute_units)?;

		sum = sum.saturating_add(units);
	}

	Some(compute_unit_limit_for_sum(sum))
}

/// Compute-unit limit for one transaction of lootbox instructions, or `None`
/// when the caller must not set a limit: the transaction is empty or contains
/// any instruction outside the measured lootbox tables, whose cost is unknown
/// here. Compute budget program instructions are skipped.
///
/// `program_id` is the lootbox program the tables describe.
#[must_use]
pub fn lootbox_compute_unit_limit<'a, I>(program_id: &Pubkey, instructions: I) -> Option<u64>
where
	I: IntoIterator<Item = (&'a Pubkey, &'a [u8])>,
{
	let mut sum: u64 = 0;
	let mut measured_any = false;

	for (owner, data) in instructions {
		if *owner == COMPUTE_BUDGET_PROGRAM_ID {
			continue;
		}

		if owner != program_id {
			return None;
		}

		let units = data
			.first()
			.and_then(|discriminator| instruction_cost(*discriminator).map(|(_, units)| units))?;

		sum = sum.saturating_add(units);
		measured_any = true;
	}

	measured_any.then(|| compute_unit_limit_for_sum(sum))
}

#[cfg(test)]
mod tests {
	use alloc::vec::Vec;

	use super::*;

	#[test]
	fn matches_the_shared_vector_table() {
		let vectors: serde_json::Value =
			serde_json::from_str(include_str!("../../../tests/vectors/compute-units.json"))
				.expect("compute unit vectors");

		let policy = &vectors["policy"];

		assert_eq!(
			COMPUTE_UNIT_MARGIN_MULTIPLIER,
			policy["multiplier"].as_u64().expect("multiplier")
		);
		assert_eq!(
			COMPUTE_UNIT_MARGIN_ADDEND,
			policy["addend"].as_u64().expect("addend")
		);
		assert_eq!(
			COMPUTE_UNIT_MINIMUM,
			policy["minimum"].as_u64().expect("minimum")
		);
		assert_eq!(
			COMPUTE_UNIT_MAXIMUM,
			policy["maximum"].as_u64().expect("maximum")
		);

		let instructions = vectors["instructions"]
			.as_object()
			.expect("instruction table");

		assert_eq!(instructions.len(), 49);

		for (name, units) in instructions {
			let expected = units.as_u64().expect("measured units");

			assert_eq!(
				measured_compute_units(
					discriminator_for_name(name).expect("known instruction name")
				),
				Some(expected),
				"{name}"
			);
		}
	}

	#[test]
	fn computes_the_vector_limits() {
		let vectors: serde_json::Value =
			serde_json::from_str(include_str!("../../../tests/vectors/compute-units.json"))
				.expect("compute unit vectors");

		for case in vectors["cases"].as_array().expect("cases") {
			let names: Vec<&str> = case["instructions"]
				.as_array()
				.expect("instruction names")
				.iter()
				.map(|value| value.as_str().expect("name"))
				.collect();
			let expected = case["expectedLimit"].as_u64();

			assert_eq!(compute_unit_limit_by_names(&names), expected);
		}
	}

	#[test]
	fn skips_compute_budget_and_rejects_foreign_instructions() {
		let program = lootbox_program_client::generated::programs::LOOTBOX_PROGRAM_ID;
		let data = [generated::REQUEST_TEMPLATE_OPEN_DISCRIMINATOR, 0];

		assert_eq!(
			lootbox_compute_unit_limit(&program, [(&COMPUTE_BUDGET_PROGRAM_ID, &[2u8][..])]),
			None,
			"a lone compute budget instruction has nothing to budget"
		);
		assert_eq!(
			lootbox_compute_unit_limit(&program, [(&program, &data[..])]),
			Some(compute_unit_limit_for_sum(23_972)),
			"a measured instruction budgets on its own"
		);
		assert_eq!(
			lootbox_compute_unit_limit(
				&program,
				[
					(&program, &data[..]),
					(&COMPUTE_BUDGET_PROGRAM_ID, &[2u8][..])
				]
			),
			Some(compute_unit_limit_for_sum(23_972)),
			"a compute budget instruction is skipped beside a measured one"
		);

		let foreign = pubkey!("11111111111111111111111111111111");

		assert_eq!(
			lootbox_compute_unit_limit(&program, [(&foreign, &[][..])]),
			None
		);

		let unused = (0..=u8::MAX)
			.find(|discriminator| instruction_cost(*discriminator).is_none())
			.expect("a discriminator outside the measured tables");
		let unknown = [unused, 0];

		assert_eq!(
			lootbox_compute_unit_limit(&program, [(&program, &unknown[..])]),
			None
		);
	}

	#[test]
	fn empty_transactions_have_no_budget() {
		let program = lootbox_program_client::generated::programs::LOOTBOX_PROGRAM_ID;
		let empty: [(&Pubkey, &[u8]); 0] = [];

		assert_eq!(lootbox_compute_unit_limit(&program, empty), None);
	}
}
