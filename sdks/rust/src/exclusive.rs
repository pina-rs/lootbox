//! `no_std` mirror of the program's Exclusive Lootbox NFT derivation.
//!
//! Every function here matches `ClaimExclusiveNft` byte for byte and is pinned
//! by `tests/vectors/exclusive-nft.json`, which the TypeScript and Dart SDKs
//! share.

use alloc::format;
use alloc::string::String;

use solana_sha256_hasher::hashv;

/// Rarity tiers: index 0 is the most common and 15 the rarest.
pub const EXCLUSIVE_TIER_COUNT: usize = 16;
/// Largest variant count for each visual trait.
pub const MAX_EXCLUSIVE_TRAIT_VARIANTS: u8 = 64;
/// Bubblegum caps names at 32 bytes; minted names are `{prefix} #{serial}`.
pub const MAX_EXCLUSIVE_NAME_BYTES: usize = 32;
pub const MAX_EXCLUSIVE_SYMBOL_BYTES: usize = 10;
pub const MAX_EXCLUSIVE_BASE_URI_BYTES: usize = 96;
/// Lamports Bubblegum `mint_v2` charges per mint, escrowed at series creation.
pub const BUBBLEGUM_MINT_V2_FEE_LAMPORTS: u64 = 90_000;
/// Default tier weights `2^(15 - k)`: tier 15 is drawn about once in 65,535.
pub const DEFAULT_EXCLUSIVE_TIER_WEIGHTS: [u32; EXCLUSIVE_TIER_COUNT] = [
	32_768, 16_384, 8_192, 4_096, 2_048, 1_024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1,
];

const SEED_DOMAIN: &[u8] = b"lootbox:exclusive-nft";
const RESAMPLE_DOMAIN: &[u8] = b"lootbox:exclusive-nft:resample";
const MAX_TOTAL_WEIGHT: u64 = u32::MAX as u64;
const ROUNDS: u8 = 8;

/// Variant counts for the three visual traits (each 1..=64).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExclusiveTraitCounts {
	pub contents: u8,
	pub background: u8,
	pub pattern: u8,
}

/// Rarity tier and visual trait indices of one Exclusive Lootbox NFT.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExclusiveTraits {
	pub tier: u8,
	pub contents: u8,
	pub background: u8,
	pub pattern: u8,
}

/// Lamports paid with a tier while its escrowed count lasts.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ExclusiveTierBonus {
	pub lamports: u64,
	pub count: u32,
}

/// Invalid series configuration or derivation input.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExclusiveNftError {
	InvalidWeights,
	InvalidTraitCounts,
	InvalidText,
	InvalidBonus,
	InvalidQuantity,
	EntropyRejectionExhausted,
	ArithmeticOverflow,
}

impl core::fmt::Display for ExclusiveNftError {
	fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
		formatter.write_str(match self {
			Self::InvalidWeights => "weights need a nonzero total no greater than u32::MAX",
			Self::InvalidTraitCounts => "trait counts must be between 1 and 64",
			Self::InvalidText => {
				"name, symbol, or https base URI does not fit its on-chain capacity"
			}
			Self::InvalidBonus => {
				"a tier bonus needs positive lamports, a drawable tier, and a count within the \
				 bundle quantity"
			}
			Self::InvalidQuantity => "series quantity must be in 1..=u32::MAX",
			Self::EntropyRejectionExhausted => "entropy rejection exhausted after 8 rounds",
			Self::ArithmeticOverflow => "exclusive series totals exceed the u64 range",
		})
	}
}

impl core::error::Error for ExclusiveNftError {}

/// Series seed `S = sha256("lootbox:exclusive-nft" || template || opening || R)`.
#[must_use]
pub fn exclusive_nft_seed(template: &[u8; 32], opening: &[u8; 32], entropy: &[u8; 32]) -> [u8; 32] {
	hashv(&[SEED_DOMAIN, template, opening, entropy]).to_bytes()
}

fn candidate(bytes: &[u8]) -> u64 {
	let mut value = [0u8; 8];
	value.copy_from_slice(&bytes[..8]);
	u64::from_le_bytes(value)
}

/// Unbiased draw in `0..bound` from lane `lane` of `S`, with the program's
/// bounded resampling on rejection.
fn lane_draw(seed: &[u8; 32], lane: u8, bound: u64) -> Result<u64, ExclusiveNftError> {
	if bound == 0 || bound > MAX_TOTAL_WEIGHT {
		return Err(ExclusiveNftError::InvalidWeights);
	}

	let threshold = bound.wrapping_neg() % bound;
	let start = usize::from(lane) * 8;
	for round in 0..ROUNDS {
		let value = if round == 0 {
			candidate(&seed[start..start + 8])
		} else {
			candidate(hashv(&[RESAMPLE_DOMAIN, seed, &[lane], &[round]]).as_ref())
		};

		if value >= threshold {
			return Ok(value % bound);
		}
	}

	Err(ExclusiveNftError::EntropyRejectionExhausted)
}

/// Validate sixteen weights and return their total.
pub fn exclusive_weight_total(
	weights: &[u32; EXCLUSIVE_TIER_COUNT],
) -> Result<u64, ExclusiveNftError> {
	let total = weights.iter().map(|weight| u64::from(*weight)).sum::<u64>();

	if total == 0 || total > MAX_TOTAL_WEIGHT {
		return Err(ExclusiveNftError::InvalidWeights);
	}

	Ok(total)
}

fn validate_trait_counts(counts: ExclusiveTraitCounts) -> Result<(), ExclusiveNftError> {
	let in_range = |count: u8| (1..=MAX_EXCLUSIVE_TRAIT_VARIANTS).contains(&count);

	if !in_range(counts.contents) || !in_range(counts.background) || !in_range(counts.pattern) {
		return Err(ExclusiveNftError::InvalidTraitCounts);
	}

	Ok(())
}

/// Derive the tier and traits from `S`, exactly as `ClaimExclusiveNft` does.
pub fn exclusive_traits(
	seed: &[u8; 32],
	weights: &[u32; EXCLUSIVE_TIER_COUNT],
	counts: ExclusiveTraitCounts,
) -> Result<ExclusiveTraits, ExclusiveNftError> {
	validate_trait_counts(counts)?;
	let target = lane_draw(seed, 0, exclusive_weight_total(weights)?)?;
	let mut cumulative = 0u64;
	let mut tier = None;
	for (index, weight) in weights.iter().enumerate() {
		cumulative += u64::from(*weight);
		if target < cumulative {
			tier = Some(index as u8);
			break;
		}
	}
	let trait_index =
		|lane, count: u8| lane_draw(seed, lane, u64::from(count)).map(|index| index as u8);

	Ok(ExclusiveTraits {
		tier: tier.ok_or(ExclusiveNftError::InvalidWeights)?,
		contents: trait_index(1, counts.contents)?,
		background: trait_index(2, counts.background)?,
		pattern: trait_index(3, counts.pattern)?,
	})
}

/// On-chain leaf name `{name_prefix} #{serial}`.
pub fn exclusive_nft_name(name_prefix: &str, serial: u64) -> Result<String, ExclusiveNftError> {
	let name = format!("{name_prefix} #{serial}");

	if name.len() > MAX_EXCLUSIVE_NAME_BYTES {
		return Err(ExclusiveNftError::InvalidText);
	}

	Ok(name)
}

/// On-chain leaf URI `{base_uri}{tier}-{contents}-{background}-{pattern}-{serial}.json`.
#[must_use]
pub fn exclusive_nft_uri(base_uri: &str, traits: ExclusiveTraits, serial: u64) -> String {
	format!(
		"{base_uri}{}-{}-{}-{}-{serial}.json",
		traits.tier, traits.contents, traits.background, traits.pattern
	)
}

/// Creator terms of a template's Exclusive Lootbox NFT series.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExclusiveSeries<'a> {
	pub name_prefix: &'a str,
	pub symbol: &'a str,
	/// Must start with `https://`.
	pub base_uri: &'a str,
	pub weights: [u32; EXCLUSIVE_TIER_COUNT],
	pub trait_counts: ExclusiveTraitCounts,
	pub bonuses: [ExclusiveTierBonus; EXCLUSIVE_TIER_COUNT],
}

fn has_control_characters(value: &str) -> bool {
	value.chars().any(char::is_control)
}

impl ExclusiveSeries<'_> {
	/// Validate the series against its bundle quantity, mirroring
	/// `CreateExclusiveSeries`, and return the bonus lamports it escrows.
	///
	/// # Errors
	/// Returns [`ExclusiveNftError`] for any term the program would reject.
	pub fn bonus_reserve_lamports(&self, quantity: u64) -> Result<u64, ExclusiveNftError> {
		if quantity == 0 || quantity > MAX_TOTAL_WEIGHT {
			return Err(ExclusiveNftError::InvalidQuantity);
		}
		exclusive_weight_total(&self.weights)?;
		validate_trait_counts(self.trait_counts)?;

		if self.name_prefix.trim().is_empty()
			|| self.name_prefix.len() + 2 + decimal_digits(quantity) > MAX_EXCLUSIVE_NAME_BYTES
			|| self.symbol.len() > MAX_EXCLUSIVE_SYMBOL_BYTES
			|| self.base_uri.len() > MAX_EXCLUSIVE_BASE_URI_BYTES
			|| !self.base_uri.starts_with("https://")
			|| self.base_uri.len() == "https://".len()
			|| self.base_uri.contains(' ')
			|| has_control_characters(self.name_prefix)
			|| has_control_characters(self.symbol)
			|| has_control_characters(self.base_uri)
		{
			return Err(ExclusiveNftError::InvalidText);
		}

		self.weights
			.iter()
			.zip(self.bonuses)
			.try_fold(0u64, |total, (weight, bonus)| {
				let count = u64::from(bonus.count);
				if (bonus.lamports == 0) != (count == 0)
					|| (count != 0 && (*weight == 0 || count > quantity))
				{
					return Err(ExclusiveNftError::InvalidBonus);
				}
				bonus
					.lamports
					.checked_mul(count)
					.and_then(|reserve| total.checked_add(reserve))
					.ok_or(ExclusiveNftError::ArithmeticOverflow)
			})
	}

	/// Bubblegum fees the series fee vault escrows for `quantity` mints,
	/// excluding the vault's rent-exempt minimum.
	///
	/// # Errors
	/// Returns arithmetic overflow when the escrow exceeds `u64`.
	pub fn mint_fee_escrow_lamports(quantity: u64) -> Result<u64, ExclusiveNftError> {
		quantity
			.checked_mul(BUBBLEGUM_MINT_V2_FEE_LAMPORTS)
			.ok_or(ExclusiveNftError::ArithmeticOverflow)
	}
}

/// Number of base-ten digits in `value`.
const fn decimal_digits(mut value: u64) -> usize {
	let mut digits = 1;
	while value >= 10 {
		value /= 10;
		digits += 1;
	}

	digits
}

#[cfg(test)]
mod tests {
	use std::string::ToString;

	use super::*;
	use crate::PrizeAsset;
	use crate::PrizeBundle;
	use crate::TemplatePlan;
	use crate::TemplatePlanError;

	fn vectors() -> serde_json::Value {
		serde_json::from_str(include_str!("../../../tests/vectors/exclusive-nft.json"))
			.expect("exclusive NFT vectors")
	}

	fn bytes<const N: usize>(value: &serde_json::Value) -> [u8; N] {
		let text = value.as_str().expect("hex string");
		let mut bytes = [0u8; N];
		for (index, byte) in bytes.iter_mut().enumerate() {
			*byte = u8::from_str_radix(&text[index * 2..index * 2 + 2], 16).expect("hex byte");
		}
		bytes
	}

	fn small(value: &serde_json::Value) -> u8 {
		u8::try_from(value.as_u64().expect("integer")).expect("u8")
	}

	fn number(value: &serde_json::Value) -> u64 {
		value
			.as_str()
			.expect("decimal string")
			.parse()
			.expect("u64")
	}

	fn traits_of(value: &serde_json::Value) -> ExclusiveTraits {
		ExclusiveTraits {
			tier: small(&value["tier"]),
			contents: small(&value["contents"]),
			background: small(&value["background"]),
			pattern: small(&value["pattern"]),
		}
	}

	fn series(bonuses: [ExclusiveTierBonus; EXCLUSIVE_TIER_COUNT]) -> ExclusiveSeries<'static> {
		ExclusiveSeries {
			name_prefix: "Lootbox Exclusive",
			symbol: "LBX",
			base_uri: "https://example.com/nft/",
			weights: DEFAULT_EXCLUSIVE_TIER_WEIGHTS,
			trait_counts: ExclusiveTraitCounts {
				contents: 12,
				background: 8,
				pattern: 5,
			},
			bonuses,
		}
	}

	#[test]
	fn seeds_traits_and_metadata_match_the_shared_vectors() {
		let vectors = vectors();
		for seed in vectors["seeds"].as_array().expect("seeds") {
			assert_eq!(
				exclusive_nft_seed(
					&bytes(&seed["templateHex"]),
					&bytes(&seed["openingHex"]),
					&bytes(&seed["entropyHex"]),
				),
				bytes::<32>(&seed["seedHex"]),
			);
		}
		for draw in vectors["draws"].as_array().expect("draws") {
			let mut weights = [0u32; EXCLUSIVE_TIER_COUNT];
			for (weight, value) in weights
				.iter_mut()
				.zip(draw["weights"].as_array().expect("weights"))
			{
				*weight = u32::try_from(value.as_u64().expect("weight")).expect("u32");
			}
			let counts = &draw["traitCounts"];
			assert_eq!(
				exclusive_traits(
					&bytes(&draw["seedHex"]),
					&weights,
					ExclusiveTraitCounts {
						contents: small(&counts["contents"]),
						background: small(&counts["background"]),
						pattern: small(&counts["pattern"]),
					},
				),
				Ok(traits_of(&draw["expected"])),
				"{}",
				draw["name"],
			);
		}
		for metadata in vectors["metadata"].as_array().expect("metadata") {
			let serial = number(&metadata["serial"]);
			assert_eq!(
				exclusive_nft_name(metadata["namePrefix"].as_str().expect("prefix"), serial),
				Ok(metadata["name"].as_str().expect("name").to_string()),
			);
			assert_eq!(
				exclusive_nft_uri(
					metadata["baseUri"].as_str().expect("base"),
					traits_of(&metadata["traits"]),
					serial,
				),
				metadata["uri"].as_str().expect("uri"),
			);
		}
	}

	#[test]
	fn planner_counts_bonus_reserves_as_sol_collateral() {
		let planner = &vectors()["planner"];
		let quantity = number(&planner["quantity"]);
		let mut bonuses = [ExclusiveTierBonus::default(); EXCLUSIVE_TIER_COUNT];
		for bonus in planner["bonuses"].as_array().expect("bonuses") {
			bonuses[usize::from(small(&bonus["tier"]))] = ExclusiveTierBonus {
				lamports: number(&bonus["lamports"]),
				count: u32::from(small(&bonus["count"])),
			};
		}
		let series = series(bonuses);
		let reserve = number(&planner["expectedBonusReserveLamports"]);
		assert_eq!(series.bonus_reserve_lamports(quantity), Ok(reserve));
		assert_eq!(
			ExclusiveSeries::mint_fee_escrow_lamports(quantity),
			Ok(number(&planner["expectedMintFeeEscrowLamports"])),
		);

		let assets = [
			PrizeAsset::ExclusiveNft { series: &series },
			PrizeAsset::Sol { lamports: 1_000 },
		];
		let bundles = [PrizeBundle {
			quantity,
			assets: &assets,
		}];
		let plan = TemplatePlan::new(&bundles).expect("exclusive consolation plan");
		assert_eq!(
			plan.required_collateral(None),
			Ok(reserve + 1_000 * quantity)
		);

		for invalid in planner["invalid"].as_array().expect("invalid") {
			let mut bonuses = [ExclusiveTierBonus::default(); EXCLUSIVE_TIER_COUNT];
			bonuses[usize::from(small(&invalid["tier"]))] = ExclusiveTierBonus {
				lamports: number(&invalid["lamports"]),
				count: u32::try_from(invalid["count"].as_u64().expect("count")).expect("u32"),
			};
			let series = self::series(bonuses);
			assert_eq!(
				series.bonus_reserve_lamports(quantity),
				Err(ExclusiveNftError::InvalidBonus),
				"{}",
				invalid["reason"],
			);
		}
	}

	#[test]
	fn planner_rejects_unrenderable_or_duplicate_series() {
		let planner = &vectors()["planner"];
		let max_quantity = number(&planner["maxQuantity"]);
		let longest = usize::try_from(planner["longestValidNamePrefixBytes"].as_u64().expect("n"))
			.expect("usize");
		let fits = "A".repeat(longest);
		let too_long = "A".repeat(longest + 1);
		let mut valid = series([ExclusiveTierBonus::default(); EXCLUSIVE_TIER_COUNT]);
		valid.name_prefix = &fits;
		assert_eq!(valid.bonus_reserve_lamports(max_quantity), Ok(0));
		let mut invalid = valid;
		invalid.name_prefix = &too_long;
		assert_eq!(
			invalid.bonus_reserve_lamports(max_quantity),
			Err(ExclusiveNftError::InvalidText)
		);
		let mut insecure = valid;
		insecure.base_uri = "http://example.com/";
		assert_eq!(
			insecure.bonus_reserve_lamports(1),
			Err(ExclusiveNftError::InvalidText)
		);
		let mut undrawable = valid;
		undrawable.weights = [0; EXCLUSIVE_TIER_COUNT];
		assert_eq!(
			undrawable.bonus_reserve_lamports(1),
			Err(ExclusiveNftError::InvalidWeights)
		);

		let first = [PrizeAsset::ExclusiveNft { series: &valid }];
		let second = [PrizeAsset::ExclusiveNft { series: &valid }];
		let bundles = [
			PrizeBundle {
				quantity: 2,
				assets: &first,
			},
			PrizeBundle {
				quantity: 1,
				assets: &second,
			},
		];
		assert_eq!(
			TemplatePlan::new(&bundles),
			Err(TemplatePlanError::DuplicateUniqueAsset),
			"one series per template"
		);
		let doubled = [
			PrizeAsset::ExclusiveNft { series: &valid },
			PrizeAsset::ExclusiveNft { series: &valid },
		];
		let bundles = [PrizeBundle {
			quantity: 1,
			assets: &doubled,
		}];
		assert!(TemplatePlan::new(&bundles).is_err());
	}
}
