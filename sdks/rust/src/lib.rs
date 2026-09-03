//! Ergonomic planning helpers over the generated lootbox program client.

#![no_std]

pub use lootbox_program_client as generated;

/// Maximum number of outcomes supported by the v1 on-chain account.
pub const MAX_OUTCOMES: usize = 8;

/// One weighted SOL payout.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Outcome {
	/// Relative selection weight. Weights need not sum to 100.
	pub weight: u64,
	/// SOL payout in lamports.
	pub reward_lamports: u64,
}

/// A checked, fixed-capacity lootbox definition.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LootboxPlan {
	max_supply: u64,
	outcomes: [Outcome; MAX_OUTCOMES],
	len: u8,
}

/// Invalid developer configuration rejected before transaction construction.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PlanError {
	ZeroSupply,
	NoOutcomes,
	ZeroWeight,
	TooManyOutcomes,
	ArithmeticOverflow,
}

impl LootboxPlan {
	/// Start a plan with a non-zero maximum supply.
	///
	/// # Errors
	///
	/// Returns [`PlanError::ZeroSupply`] when `max_supply` is zero.
	pub const fn new(max_supply: u64) -> Result<Self, PlanError> {
		if max_supply == 0 {
			return Err(PlanError::ZeroSupply);
		}

		Ok(Self {
			max_supply,
			outcomes: [Outcome {
				weight: 0,
				reward_lamports: 0,
			}; MAX_OUTCOMES],
			len: 0,
		})
	}

	/// Append one weighted payout.
	///
	/// # Errors
	///
	/// Returns [`PlanError::ZeroWeight`] for a zero weight or
	/// [`PlanError::TooManyOutcomes`] after the eighth outcome.
	pub const fn with_outcome(
		mut self,
		weight: u64,
		reward_lamports: u64,
	) -> Result<Self, PlanError> {
		if weight == 0 {
			return Err(PlanError::ZeroWeight);
		}

		let index = self.len as usize;

		if index == MAX_OUTCOMES {
			return Err(PlanError::TooManyOutcomes);
		}

		self.outcomes[index] = Outcome {
			weight,
			reward_lamports,
		};
		self.len += 1;

		Ok(self)
	}

	/// Configured outcomes in insertion order.
	#[must_use]
	pub fn outcomes(&self) -> &[Outcome] {
		&self.outcomes[..usize::from(self.len)]
	}

	/// Maximum box supply.
	#[must_use]
	pub const fn max_supply(&self) -> u64 {
		self.max_supply
	}

	/// Sum of all relative weights.
	///
	/// # Errors
	///
	/// Returns [`PlanError::NoOutcomes`] for an incomplete plan or
	/// [`PlanError::ArithmeticOverflow`] when the sum exceeds `u64`.
	pub fn total_weight(&self) -> Result<u64, PlanError> {
		if self.outcomes().is_empty() {
			return Err(PlanError::NoOutcomes);
		}

		self.outcomes().iter().try_fold(0u64, |total, outcome| {
			total
				.checked_add(outcome.weight)
				.ok_or(PlanError::ArithmeticOverflow)
		})
	}

	/// Worst-case collateral required before minting the full supply.
	///
	/// # Errors
	///
	/// Returns [`PlanError::NoOutcomes`] for an incomplete plan or
	/// [`PlanError::ArithmeticOverflow`] when the product exceeds `u64`.
	pub fn required_collateral_lamports(&self) -> Result<u64, PlanError> {
		if self.outcomes().is_empty() {
			return Err(PlanError::NoOutcomes);
		}

		let max_reward = self
			.outcomes()
			.iter()
			.map(|outcome| outcome.reward_lamports)
			.max()
			.unwrap_or(0);

		max_reward
			.checked_mul(self.max_supply)
			.ok_or(PlanError::ArithmeticOverflow)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn plan_calculates_worst_case_collateral() {
		let plan = LootboxPlan::new(100)
			.and_then(|plan| plan.with_outcome(70, 10_000))
			.and_then(|plan| plan.with_outcome(30, 50_000))
			.expect("valid plan");

		assert_eq!(plan.total_weight(), Ok(100));
		assert_eq!(plan.required_collateral_lamports(), Ok(5_000_000));
	}

	#[test]
	fn plan_rejects_zero_weights() {
		let result = LootboxPlan::new(1).and_then(|plan| plan.with_outcome(0, 10));

		assert_eq!(result, Err(PlanError::ZeroWeight));
	}

	#[test]
	fn plan_requires_an_outcome_before_use() {
		let plan = LootboxPlan::new(1).expect("valid supply");

		assert_eq!(plan.total_weight(), Err(PlanError::NoOutcomes));
		assert_eq!(
			plan.required_collateral_lamports(),
			Err(PlanError::NoOutcomes)
		);
	}
}
