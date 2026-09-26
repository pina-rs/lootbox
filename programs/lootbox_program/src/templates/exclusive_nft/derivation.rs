//! Oracle-derived rarity, traits, and metadata text for Exclusive Lootbox NFTs.
//!
//! Everything here is a pure function of on-chain data: the template and
//! opening addresses plus the verified Switchboard value the opening already
//! used for allocation. Anyone can recompute a minted NFT's tier and traits, so
//! neither the creator nor a metadata server can fake rarity.

use super::*;

/// Domain separator for the per-opening series seed `S`.
pub const EXCLUSIVE_NFT_SEED_DOMAIN: &[u8] = b"lootbox:exclusive-nft";
/// Domain separator for the negligible-probability rejection resample.
pub const EXCLUSIVE_NFT_RESAMPLE_DOMAIN: &[u8] = b"lootbox:exclusive-nft:resample";
/// Rarity tiers: index 0 is the most common and 15 the rarest.
pub const EXCLUSIVE_TIER_COUNT: usize = 16;
/// Largest variant count for each visual trait.
pub const MAX_EXCLUSIVE_TRAIT_VARIANTS: u8 = 64;
/// Bubblegum's on-chain name cap, which bounds `{prefix} #{serial}`.
pub const MAX_EXCLUSIVE_NAME_BYTES: usize = 32;
/// Bubblegum's on-chain symbol cap.
pub const MAX_EXCLUSIVE_SYMBOL_BYTES: usize = 10;
/// Base URI capacity; the longest generated suffix still fits Bubblegum's cap.
pub const MAX_EXCLUSIVE_BASE_URI_BYTES: usize = 96;
/// Bubblegum's on-chain URI cap.
pub const MAX_EXCLUSIVE_URI_BYTES: usize = 200;
/// Default tier weights `2^(15 - k)`: tier 15 is drawn about once in 65,535.
pub const DEFAULT_EXCLUSIVE_TIER_WEIGHTS: [u32; EXCLUSIVE_TIER_COUNT] = [
	32_768, 16_384, 8_192, 4_096, 2_048, 1_024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1,
];

const HTTPS_PREFIX: &[u8] = b"https://";
const URI_SUFFIX: &[u8] = b".json";
const NAME_SERIAL_SEPARATOR: &[u8] = b" #";
const ROUNDS: u8 = 8;

/// The four independently sampled 8-byte lanes of the series seed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
enum SampleLane {
	Tier = 0,
	Contents = 1,
	Background = 2,
	Pattern = 3,
}

/// Variant counts for the three visual traits.
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

/// Derive the series seed `S` for one allocated opening.
///
/// `S = sha256("lootbox:exclusive-nft" || template || opening || R)` where `R`
/// is the opening's verified Switchboard value. The domain separates `S` from
/// the allocation draw that consumed the same value.
pub fn exclusive_nft_seed(template: &Address, opening: &Address, entropy: &[u8; 32]) -> [u8; 32] {
	hashv(&[
		EXCLUSIVE_NFT_SEED_DOMAIN,
		template.as_ref(),
		opening.as_ref(),
		entropy,
	])
	.to_bytes()
}

/// Draw one unbiased index in `0..bound` from a seed lane.
///
/// Round zero uses the lane's own eight bytes of `S`. The probability that it
/// lands in the rejected band is below `bound / 2^64`; only then does a round
/// draw `sha256("lootbox:exclusive-nft:resample" || S || lane || round)[0..8]`.
fn lane_draw(seed: &[u8; 32], lane: SampleLane, bound: u64) -> Result<u64, ProgramError> {
	if bound == 0 || bound > MAX_TOTAL_WEIGHT {
		return Err(lootbox_error(LootboxError::InvalidWeight));
	}

	let start = usize::from(lane as u8) * 8;
	for round in 0..ROUNDS {
		let candidate = if round == 0 {
			digest_candidate(&seed[start..start + 8])
		} else {
			let digest = hashv(&[EXCLUSIVE_NFT_RESAMPLE_DOMAIN, seed, &[lane as u8], &[round]]);
			digest_candidate(digest.as_ref())
		};

		if let Some(index) = accept_uniform_candidate(candidate, bound) {
			return Ok(index);
		}
	}

	Err(lootbox_error(LootboxError::EntropyRejectionExhausted))
}

/// Decode sixteen little-endian `u32` tier weights.
pub fn exclusive_weights(bytes: &[u8; 64]) -> [u32; EXCLUSIVE_TIER_COUNT] {
	let mut weights = [0u32; EXCLUSIVE_TIER_COUNT];
	let (chunks, _) = bytes.as_chunks::<4>();
	for (weight, chunk) in weights.iter_mut().zip(chunks) {
		*weight = u32::from_le_bytes(*chunk);
	}

	weights
}

/// Validate creator weights and return their total.
///
/// At least one tier must be drawable and the total must stay within the
/// program's rejection-sampling bound so a claim can never exhaust its rounds
/// with non-negligible probability.
pub fn exclusive_weight_total(weights: &[u32; EXCLUSIVE_TIER_COUNT]) -> Result<u64, ProgramError> {
	let total = weights
		.iter()
		.try_fold(0u64, |sum, weight| sum.checked_add(u64::from(*weight)))
		.ok_or(ProgramError::ArithmeticOverflow)?;

	if total == 0 || total > MAX_TOTAL_WEIGHT {
		return Err(lootbox_error(LootboxError::InvalidWeight));
	}

	Ok(total)
}

/// Require every trait to have between one and 64 variants.
pub fn validate_exclusive_trait_counts(counts: ExclusiveTraitCounts) -> ProgramResult {
	let in_range = |count: u8| (1..=MAX_EXCLUSIVE_TRAIT_VARIANTS).contains(&count);

	if !in_range(counts.contents) || !in_range(counts.background) || !in_range(counts.pattern) {
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	Ok(())
}

/// Select a tier with probability `weight / total`; zero-weight tiers never win.
pub fn exclusive_tier(
	seed: &[u8; 32],
	weights: &[u32; EXCLUSIVE_TIER_COUNT],
) -> Result<u8, ProgramError> {
	let total = exclusive_weight_total(weights)?;
	let target = lane_draw(seed, SampleLane::Tier, total)?;
	let mut cumulative = 0u64;

	for (tier, weight) in weights.iter().enumerate() {
		cumulative = cumulative
			.checked_add(u64::from(*weight))
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if target < cumulative {
			return u8::try_from(tier).map_err(|_| ProgramError::InvalidAccountData);
		}
	}

	Err(lootbox_error(LootboxError::InvalidOutcome))
}

/// Derive the tier and every visual trait from the series seed.
pub fn exclusive_traits(
	seed: &[u8; 32],
	weights: &[u32; EXCLUSIVE_TIER_COUNT],
	counts: ExclusiveTraitCounts,
) -> Result<ExclusiveTraits, ProgramError> {
	validate_exclusive_trait_counts(counts)?;
	let tier = exclusive_tier(seed, weights)?;
	let trait_index = |lane, count: u8| -> Result<u8, ProgramError> {
		let index = lane_draw(seed, lane, u64::from(count))?;
		u8::try_from(index).map_err(|_| ProgramError::InvalidAccountData)
	};

	Ok(ExclusiveTraits {
		tier,
		contents: trait_index(SampleLane::Contents, counts.contents)?,
		background: trait_index(SampleLane::Background, counts.background)?,
		pattern: trait_index(SampleLane::Pattern, counts.pattern)?,
	})
}

/// Bounded, allocation-free UTF-8 text built for a Bubblegum CPI.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoundedText<const N: usize> {
	bytes: [u8; N],
	len: usize,
}

impl<const N: usize> Default for BoundedText<N> {
	fn default() -> Self {
		Self {
			bytes: [0; N],
			len: 0,
		}
	}
}

impl<const N: usize> BoundedText<N> {
	/// Append raw bytes, failing closed when the capacity would be exceeded.
	pub fn push_text(&mut self, value: &[u8]) -> ProgramResult {
		let end = self
			.len
			.checked_add(value.len())
			.filter(|end| *end <= N)
			.ok_or_else(|| lootbox_error(LootboxError::InvalidExclusiveSeries))?;
		self.bytes[self.len..end].copy_from_slice(value);
		self.len = end;

		Ok(())
	}

	fn push_decimal(&mut self, value: u64) -> ProgramResult {
		let mut digits = [0u8; 20];
		let count = write_decimal(value, &mut digits);

		self.push_text(&digits[..count])
	}

	/// The encoded bytes.
	pub fn as_bytes(&self) -> &[u8] {
		&self.bytes[..self.len]
	}
}

/// Write `value` in base ten and return the number of digits written.
fn write_decimal(mut value: u64, digits: &mut [u8; 20]) -> usize {
	let count = decimal_digits(value);
	for slot in digits[..count].iter_mut().rev() {
		*slot = b'0' + (value % 10) as u8;
		value /= 10;
	}

	count
}

/// Number of base-ten digits in `value`.
pub const fn decimal_digits(mut value: u64) -> usize {
	let mut digits = 1;
	while value >= 10 {
		value /= 10;
		digits += 1;
	}

	digits
}

/// Length of the null-padded prefix of a fixed text field.
pub fn text_len(text: &[u8]) -> usize {
	text.iter()
		.position(|byte| *byte == 0)
		.unwrap_or(text.len())
}

/// Name `{name_prefix} #{serial}`, at most 32 bytes.
pub fn exclusive_nft_name(
	name_prefix: &[u8],
	serial: u64,
) -> Result<BoundedText<MAX_EXCLUSIVE_NAME_BYTES>, ProgramError> {
	let mut name = BoundedText::default();
	name.push_text(name_prefix)?;
	name.push_text(NAME_SERIAL_SEPARATOR)?;
	name.push_decimal(serial)?;

	Ok(name)
}

/// URI `{base_uri}{tier}-{contents}-{background}-{pattern}-{serial}.json`.
pub fn exclusive_nft_uri(
	base_uri: &[u8],
	traits: ExclusiveTraits,
	serial: u64,
) -> Result<BoundedText<MAX_EXCLUSIVE_URI_BYTES>, ProgramError> {
	let mut uri = BoundedText::default();
	uri.push_text(base_uri)?;
	for (index, value) in [
		traits.tier,
		traits.contents,
		traits.background,
		traits.pattern,
	]
	.into_iter()
	.enumerate()
	{
		if index != 0 {
			uri.push_text(b"-")?;
		}
		uri.push_decimal(u64::from(value))?;
	}
	uri.push_text(b"-")?;
	uri.push_decimal(serial)?;
	uri.push_text(URI_SUFFIX)?;

	Ok(uri)
}

/// Validate the creator's null-padded metadata text at series creation.
///
/// The name prefix must leave room for ` #{serial}` up to the bundle quantity,
/// so no claim can ever fail on the 32-byte Bubblegum name cap.
pub fn validate_exclusive_text(
	name_prefix: &[u8; MAX_EXCLUSIVE_NAME_BYTES],
	symbol: &[u8; MAX_EXCLUSIVE_SYMBOL_BYTES],
	base_uri: &[u8; MAX_EXCLUSIVE_BASE_URI_BYTES],
	quantity: u64,
) -> ProgramResult {
	validate_text(name_prefix, true)?;
	validate_text(symbol, false)?;
	validate_text(base_uri, true)?;
	let prefix_len = text_len(name_prefix);
	let uri_len = text_len(base_uri);
	let longest_name = prefix_len
		.checked_add(NAME_SERIAL_SEPARATOR.len())
		.and_then(|len| len.checked_add(decimal_digits(quantity)))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let base_uri = &base_uri[..uri_len];

	if quantity == 0
		|| longest_name > MAX_EXCLUSIVE_NAME_BYTES
		|| !base_uri.starts_with(HTTPS_PREFIX)
		|| base_uri.len() == HTTPS_PREFIX.len()
		|| base_uri.iter().any(u8::is_ascii_whitespace)
	{
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	Ok(())
}

#[cfg(test)]
mod tests {
	use proptest::prelude::*;

	use super::*;

	const COUNTS: ExclusiveTraitCounts = ExclusiveTraitCounts {
		contents: 12,
		background: 8,
		pattern: 5,
	};

	fn seed_with_lanes(lanes: [u64; 4]) -> [u8; 32] {
		let mut seed = [0u8; 32];
		for (index, lane) in lanes.iter().enumerate() {
			seed[index * 8..index * 8 + 8].copy_from_slice(&lane.to_le_bytes());
		}
		seed
	}

	#[test]
	fn default_weights_are_powers_of_two_summing_below_the_bound() {
		for (tier, weight) in DEFAULT_EXCLUSIVE_TIER_WEIGHTS.iter().enumerate() {
			assert_eq!(*weight, 1 << (15 - tier));
		}
		assert_eq!(
			exclusive_weight_total(&DEFAULT_EXCLUSIVE_TIER_WEIGHTS),
			Ok(65_535)
		);
	}

	#[test]
	fn weights_reject_zero_and_oversized_totals() {
		assert_eq!(
			exclusive_weight_total(&[0; 16]),
			Err(lootbox_error(LootboxError::InvalidWeight))
		);
		let mut max = [0u32; 16];
		max[0] = u32::MAX;
		assert_eq!(exclusive_weight_total(&max), Ok(MAX_TOTAL_WEIGHT));
		max[15] = 1;
		assert_eq!(
			exclusive_weight_total(&max),
			Err(lootbox_error(LootboxError::InvalidWeight))
		);
		assert_eq!(
			exclusive_weight_total(&[u32::MAX; 16]),
			Err(lootbox_error(LootboxError::InvalidWeight))
		);
	}

	#[test]
	fn tier_boundaries_follow_cumulative_weights() {
		let weights = DEFAULT_EXCLUSIVE_TIER_WEIGHTS;
		// 65,535 divides 2^64 - 1, so only the candidate zero is rejected.
		assert_eq!(
			exclusive_tier(&seed_with_lanes([1, 0, 0, 0]), &weights),
			Ok(0)
		);
		assert_eq!(
			exclusive_tier(&seed_with_lanes([32_767, 0, 0, 0]), &weights),
			Ok(0)
		);
		assert_eq!(
			exclusive_tier(&seed_with_lanes([32_768, 0, 0, 0]), &weights),
			Ok(1)
		);
		assert_eq!(
			exclusive_tier(&seed_with_lanes([65_534, 0, 0, 0]), &weights),
			Ok(15)
		);
		assert_eq!(
			exclusive_tier(&seed_with_lanes([65_535 + 65_534, 0, 0, 0]), &weights),
			Ok(15)
		);
	}

	#[test]
	fn a_single_nonzero_weight_always_wins() {
		let mut weights = [0u32; 16];
		weights[9] = 3;
		for lane in [1, 2, 3, u64::MAX, u64::MAX / 3] {
			assert_eq!(
				exclusive_tier(&seed_with_lanes([lane, 0, 0, 0]), &weights),
				Ok(9)
			);
		}
		assert_eq!(exclusive_tier(&[0; 32], &weights), Ok(9));
	}

	#[test]
	fn zero_weight_tiers_are_never_selected() {
		let mut weights = [0u32; 16];
		weights[0] = 5;
		weights[15] = 5;
		for lane in 1..200u64 {
			let tier = exclusive_tier(&seed_with_lanes([lane, 0, 0, 0]), &weights).unwrap();
			assert!(tier == 0 || tier == 15);
		}
	}

	#[test]
	fn rejected_lanes_resample_deterministically() {
		// Zero is below every threshold 2^64 mod n for n = 3, 12, and 65,535.
		let seed = [0u8; 32];
		let traits = exclusive_traits(&seed, &DEFAULT_EXCLUSIVE_TIER_WEIGHTS, COUNTS).unwrap();
		assert_eq!(
			traits,
			exclusive_traits(&seed, &DEFAULT_EXCLUSIVE_TIER_WEIGHTS, COUNTS).unwrap()
		);
		let resampled = hashv(&[EXCLUSIVE_NFT_RESAMPLE_DOMAIN, &seed, &[0], &[1]]);
		let candidate = digest_candidate(resampled.as_ref());
		let expected = exclusive_tier(
			&seed_with_lanes([candidate, 0, 0, 0]),
			&DEFAULT_EXCLUSIVE_TIER_WEIGHTS,
		)
		.unwrap();
		assert_eq!(traits.tier, expected);
	}

	#[test]
	fn trait_counts_are_bounded() {
		assert!(
			validate_exclusive_trait_counts(ExclusiveTraitCounts {
				contents: 0,
				background: 1,
				pattern: 1,
			})
			.is_err()
		);
		assert!(
			validate_exclusive_trait_counts(ExclusiveTraitCounts {
				contents: 1,
				background: 65,
				pattern: 1,
			})
			.is_err()
		);
		assert_eq!(
			validate_exclusive_trait_counts(ExclusiveTraitCounts {
				contents: 64,
				background: 1,
				pattern: 64,
			}),
			Ok(())
		);
	}

	#[test]
	fn names_and_uris_follow_the_shared_contract() {
		let name = exclusive_nft_name(b"Lootbox Exclusive", 42).unwrap();
		assert_eq!(name.as_bytes(), b"Lootbox Exclusive #42");
		let traits = ExclusiveTraits {
			tier: 15,
			contents: 63,
			background: 0,
			pattern: 7,
		};
		let uri = exclusive_nft_uri(b"https://example.com/nft/", traits, 4_294_967_295).unwrap();
		assert_eq!(
			uri.as_bytes(),
			b"https://example.com/nft/15-63-0-7-4294967295.json"
		);
		assert_eq!(
			exclusive_nft_name(&[b'a'; 23], 1_000_000_000),
			Err(lootbox_error(LootboxError::InvalidExclusiveSeries))
		);
	}

	#[test]
	fn the_longest_uri_fits_the_bubblegum_cap() {
		let base = [b'a'; MAX_EXCLUSIVE_BASE_URI_BYTES];
		let traits = ExclusiveTraits {
			tier: 15,
			contents: 63,
			background: 63,
			pattern: 63,
		};
		let uri = exclusive_nft_uri(&base, traits, u64::MAX).unwrap();
		assert!(uri.as_bytes().len() <= MAX_EXCLUSIVE_URI_BYTES);
	}

	#[test]
	fn creation_text_reserves_room_for_the_largest_serial() {
		let mut prefix = [0u8; 32];
		prefix[..20].copy_from_slice(&[b'A'; 20]);
		let mut symbol = [0u8; 10];
		symbol[..3].copy_from_slice(b"LBX");
		let mut base = [0u8; 96];
		base[..20].copy_from_slice(b"https://example.com/");
		assert_eq!(
			validate_exclusive_text(&prefix, &symbol, &base, u64::from(u32::MAX)),
			Ok(())
		);
		prefix[20] = b'A';
		assert!(validate_exclusive_text(&prefix, &symbol, &base, u64::from(u32::MAX)).is_err());
		assert_eq!(
			validate_exclusive_text(&prefix, &symbol, &base, 999_999_999),
			Ok(())
		);

		let mut insecure = [0u8; 96];
		insecure[..19].copy_from_slice(b"http://example.com/");
		assert!(validate_exclusive_text(&prefix, &symbol, &insecure, 1).is_err());
		let mut scheme_only = [0u8; 96];
		scheme_only[..8].copy_from_slice(b"https://");
		assert!(validate_exclusive_text(&prefix, &symbol, &scheme_only, 1).is_err());
		let mut spaced = [0u8; 96];
		spaced[..21].copy_from_slice(b"https://example.com/ ");
		assert!(validate_exclusive_text(&prefix, &symbol, &spaced, 1).is_err());
	}

	#[test]
	fn seed_binds_template_opening_and_entropy() {
		let template = Address::new_from_array([1; 32]);
		let opening = Address::new_from_array([2; 32]);
		let seed = exclusive_nft_seed(&template, &opening, &[3; 32]);
		assert_ne!(seed, exclusive_nft_seed(&opening, &template, &[3; 32]));
		assert_ne!(seed, exclusive_nft_seed(&template, &opening, &[4; 32]));
		let manual = hashv(&[
			b"lootbox:exclusive-nft".as_slice(),
			&[1; 32],
			&[2; 32],
			&[3; 32],
		]);
		assert_eq!(seed, manual.to_bytes());
	}

	fn vector_bytes<const N: usize>(value: &serde_json::Value) -> [u8; N] {
		let text = value.as_str().expect("hex string");
		let mut bytes = [0u8; N];
		for (index, byte) in bytes.iter_mut().enumerate() {
			*byte = u8::from_str_radix(&text[index * 2..index * 2 + 2], 16).expect("hex byte");
		}
		bytes
	}

	fn vector_u8(value: &serde_json::Value) -> u8 {
		u8::try_from(value.as_u64().expect("integer")).expect("u8")
	}

	/// The program is the canonical implementation of the shared vectors that
	/// the Rust, TypeScript, and Dart SDKs replay.
	#[test]
	fn shared_vectors_match_the_program_derivation() {
		let vectors: serde_json::Value = serde_json::from_str(include_str!(
			"../../../../../tests/vectors/exclusive-nft.json"
		))
		.expect("exclusive NFT vectors");
		for seed in vectors["seeds"].as_array().expect("seeds") {
			assert_eq!(
				exclusive_nft_seed(
					&Address::new_from_array(vector_bytes(&seed["templateHex"])),
					&Address::new_from_array(vector_bytes(&seed["openingHex"])),
					&vector_bytes(&seed["entropyHex"]),
				),
				vector_bytes::<32>(&seed["seedHex"]),
			);
		}
		for draw in vectors["draws"].as_array().expect("draws") {
			let mut weights = [0u32; 16];
			for (weight, value) in weights
				.iter_mut()
				.zip(draw["weights"].as_array().expect("weights"))
			{
				*weight = u32::try_from(value.as_u64().expect("weight")).expect("u32 weight");
			}
			let counts = &draw["traitCounts"];
			let expected = &draw["expected"];
			assert_eq!(
				exclusive_traits(
					&vector_bytes(&draw["seedHex"]),
					&weights,
					ExclusiveTraitCounts {
						contents: vector_u8(&counts["contents"]),
						background: vector_u8(&counts["background"]),
						pattern: vector_u8(&counts["pattern"]),
					},
				),
				Ok(ExclusiveTraits {
					tier: vector_u8(&expected["tier"]),
					contents: vector_u8(&expected["contents"]),
					background: vector_u8(&expected["background"]),
					pattern: vector_u8(&expected["pattern"]),
				}),
				"{}",
				draw["name"],
			);
		}
		for metadata in vectors["metadata"].as_array().expect("metadata") {
			let serial = metadata["serial"]
				.as_str()
				.and_then(|value| value.parse::<u64>().ok())
				.expect("serial");
			let traits = &metadata["traits"];
			let traits = ExclusiveTraits {
				tier: vector_u8(&traits["tier"]),
				contents: vector_u8(&traits["contents"]),
				background: vector_u8(&traits["background"]),
				pattern: vector_u8(&traits["pattern"]),
			};
			let prefix = metadata["namePrefix"].as_str().expect("prefix");
			let base = metadata["baseUri"].as_str().expect("base URI");
			assert_eq!(
				exclusive_nft_name(prefix.as_bytes(), serial)
					.expect("name")
					.as_bytes(),
				metadata["name"].as_str().expect("name").as_bytes(),
			);
			assert_eq!(
				exclusive_nft_uri(base.as_bytes(), traits, serial)
					.expect("uri")
					.as_bytes(),
				metadata["uri"].as_str().expect("uri").as_bytes(),
			);
		}
	}

	proptest! {
		#[test]
		fn traits_stay_inside_their_domains(
			seed in any::<[u8; 32]>(),
			weights in any::<[u16; 16]>(),
			contents in 1u8..=64,
			background in 1u8..=64,
			pattern in 1u8..=64,
		) {
			let weights = weights.map(u32::from);
			prop_assume!(weights.iter().any(|weight| *weight != 0));
			let counts = ExclusiveTraitCounts { contents, background, pattern };
			let traits = exclusive_traits(&seed, &weights, counts).unwrap();

			prop_assert!(weights[usize::from(traits.tier)] != 0);
			prop_assert!(traits.contents < contents);
			prop_assert!(traits.background < background);
			prop_assert!(traits.pattern < pattern);
		}

		#[test]
		fn every_accepted_candidate_maps_to_a_unique_residue_class(
			candidate in any::<u64>(),
			bound in 1u64..=MAX_TOTAL_WEIGHT,
		) {
			let threshold = bound.wrapping_neg() % bound;
			match accept_uniform_candidate(candidate, bound) {
				Some(index) => {
					prop_assert!(candidate >= threshold);
					prop_assert!(index < bound);
					prop_assert_eq!(index, candidate % bound);
				}
				None => prop_assert!(candidate < threshold),
			}
			// The accepted band has exactly `bound * floor(2^64 / bound)`
			// candidates, so every residue has the same number of preimages.
			let accepted = u128::from(u64::MAX) + 1 - u128::from(threshold);
			prop_assert_eq!(accepted % u128::from(bound), 0);
		}

		#[test]
		fn tier_frequencies_are_exact_over_one_full_weight_cycle(
			weights in any::<[u8; 16]>(),
			offset in any::<u32>(),
		) {
			let weights = weights.map(u32::from);
			let total = exclusive_weight_total(&weights);
			prop_assume!(total.is_ok());
			let total = total.unwrap();
			let threshold = total.wrapping_neg() % total;
			// Every block of `total` consecutive accepted candidates hits each
			// tier exactly `weight` times: the draw is exactly proportional.
			let start = threshold + u64::from(offset) * total;
			let mut hits = [0u64; 16];
			for candidate in start..start + total {
				let tier = exclusive_tier(&seed_with_lanes([candidate, 0, 0, 0]), &weights).unwrap();
				hits[usize::from(tier)] += 1;
			}
			prop_assert_eq!(hits, weights.map(u64::from));
		}
	}
}
