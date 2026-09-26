//! Oracle-derived trait layers and metadata text for Exclusive Lootbox NFTs.
//!
//! Everything here is a pure function of on-chain data: the template and
//! opening addresses, the verified Switchboard value the opening already used
//! for allocation, and the collection's frozen layer tables. Anyone can
//! recompute a minted NFT's traits, so no metadata server can fake rarity.

use super::*;

/// Domain separator for the per-opening seed `S`.
pub const EXCLUSIVE_NFT_SEED_DOMAIN: &[u8] = b"lootbox:exclusive-nft";
/// Per-layer sample label: `sha256(S || "layer" || layer [|| round])`.
pub const EXCLUSIVE_NFT_LAYER_LABEL: &[u8] = b"layer";
/// Largest number of stacked trait layers in one collection.
pub const MAX_EXCLUSIVE_LAYERS: usize = 12;
/// Largest number of traits in one layer.
pub const MAX_EXCLUSIVE_TRAITS: usize = 64;
/// Bytes of one layer's little-endian `u32` weight table.
pub const EXCLUSIVE_LAYER_WEIGHT_BYTES: usize = MAX_EXCLUSIVE_TRAITS * 4;
/// Bytes of every layer's weight table.
pub const EXCLUSIVE_WEIGHT_TABLE_BYTES: usize = MAX_EXCLUSIVE_LAYERS * EXCLUSIVE_LAYER_WEIGHT_BYTES;
/// Bubblegum's on-chain name cap, which bounds `{prefix} #{serial}`.
pub const MAX_EXCLUSIVE_NAME_BYTES: usize = 32;
/// Longest name prefix; it leaves room for ` #` and a ten-digit serial.
pub const MAX_EXCLUSIVE_NAME_PREFIX_BYTES: usize = 20;
/// Bubblegum's on-chain symbol cap.
pub const MAX_EXCLUSIVE_SYMBOL_BYTES: usize = 10;
/// Base URI capacity; the longest generated suffix still fits Bubblegum's cap.
pub const MAX_EXCLUSIVE_BASE_URI_BYTES: usize = 128;
/// Bubblegum's on-chain URI cap.
pub const MAX_EXCLUSIVE_URI_BYTES: usize = 200;

const HTTPS_PREFIX: &[u8] = b"https://";
const URI_SUFFIX: &[u8] = b".json";
const NAME_SERIAL_SEPARATOR: &[u8] = b" #";
const HEX_DIGITS: &[u8; 16] = b"0123456789abcdef";
const ROUNDS: u8 = 8;

/// Trait index chosen in each layer, bottom to top.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExclusiveTraits {
	pub layer_count: u8,
	pub traits: [u8; MAX_EXCLUSIVE_LAYERS],
}

impl ExclusiveTraits {
	/// The chosen trait indices of the collection's layers.
	pub fn as_slice(&self) -> &[u8] {
		&self.traits[..usize::from(self.layer_count)]
	}
}

/// Derive the seed `S` for one allocated opening.
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

/// Draw one unbiased index in `0..bound` for a layer.
///
/// Round zero samples `sha256(S || "layer" || layer)[0..8]`. A candidate in
/// the rejected low band (probability below `bound / 2^64`) moves to round
/// `r`, which samples `sha256(S || "layer" || layer || r)[0..8]`.
fn layer_draw(seed: &[u8; 32], layer: u8, bound: u64) -> Result<u64, ProgramError> {
	if bound == 0 || bound > MAX_TOTAL_WEIGHT {
		return Err(lootbox_error(LootboxError::InvalidWeight));
	}

	for round in 0..ROUNDS {
		let digest = if round == 0 {
			hashv(&[seed, EXCLUSIVE_NFT_LAYER_LABEL, &[layer]])
		} else {
			hashv(&[seed, EXCLUSIVE_NFT_LAYER_LABEL, &[layer], &[round]])
		};

		if let Some(index) = accept_uniform_candidate(digest_candidate(digest.as_ref()), bound) {
			return Ok(index);
		}
	}

	Err(lootbox_error(LootboxError::EntropyRejectionExhausted))
}

fn weight_at(weights: &[u8], index: usize) -> u64 {
	let bytes = &weights[index * 4..index * 4 + 4];
	u64::from(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

/// Validate one layer table and return its total weight.
///
/// A layer has one to 64 traits, at least one drawable trait, a total within
/// the rejection-sampling bound, and zeroed bytes after its last trait so the
/// frozen table hash has exactly one encoding.
pub fn validate_exclusive_layer(
	weights: &[u8; EXCLUSIVE_LAYER_WEIGHT_BYTES],
	trait_count: u8,
) -> Result<u64, ProgramError> {
	let count = usize::from(trait_count);

	if count == 0
		|| count > MAX_EXCLUSIVE_TRAITS
		|| weights[count * 4..].iter().any(|byte| *byte != 0)
	{
		return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
	}

	let total = (0..count)
		.map(|index| weight_at(weights, index))
		.sum::<u64>();
	if total == 0 || total > MAX_TOTAL_WEIGHT {
		return Err(lootbox_error(LootboxError::InvalidWeight));
	}

	Ok(total)
}

/// Pick one trait per layer with probability `weight / layer total`.
///
/// Zero-weight traits are never chosen. `weights` holds every layer's
/// 64-slot table back to back.
pub fn exclusive_traits(
	seed: &[u8; 32],
	trait_counts: &[u8; MAX_EXCLUSIVE_LAYERS],
	weights: &[u8],
	layer_count: u8,
) -> Result<ExclusiveTraits, ProgramError> {
	if layer_count == 0 || usize::from(layer_count) > MAX_EXCLUSIVE_LAYERS {
		return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
	}

	let mut traits = [0u8; MAX_EXCLUSIVE_LAYERS];
	for layer in 0..layer_count {
		let index = usize::from(layer);
		let count = usize::from(trait_counts[index]);
		let start = index * EXCLUSIVE_LAYER_WEIGHT_BYTES;
		let table = weights
			.get(start..start + count * 4)
			.ok_or(ProgramError::InvalidAccountData)?;
		let total = (0..count).map(|slot| weight_at(table, slot)).sum::<u64>();
		let target = layer_draw(seed, layer, total)?;
		let mut cumulative = 0u64;
		let mut chosen = None;

		for slot in 0..count {
			cumulative += weight_at(table, slot);
			if target < cumulative {
				chosen = u8::try_from(slot).ok();
				break;
			}
		}

		traits[index] = chosen.ok_or_else(|| lootbox_error(LootboxError::InvalidOutcome))?;
	}

	Ok(ExclusiveTraits {
		layer_count,
		traits,
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
			.ok_or_else(|| lootbox_error(LootboxError::InvalidExclusiveCollection))?;
		self.bytes[self.len..end].copy_from_slice(value);
		self.len = end;

		Ok(())
	}

	fn push_decimal(&mut self, mut value: u64) -> ProgramResult {
		let mut digits = [0u8; 20];
		let mut start = digits.len();
		loop {
			start -= 1;
			digits[start] = b'0' + (value % 10) as u8;
			value /= 10;
			if value == 0 {
				break;
			}
		}

		self.push_text(&digits[start..])
	}

	/// The encoded bytes.
	pub fn as_bytes(&self) -> &[u8] {
		&self.bytes[..self.len]
	}
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

/// URI `{base_uri}{lowercase hex, one byte per layer}-{serial}.json`.
pub fn exclusive_nft_uri(
	base_uri: &[u8],
	traits: &ExclusiveTraits,
	serial: u64,
) -> Result<BoundedText<MAX_EXCLUSIVE_URI_BYTES>, ProgramError> {
	let mut uri = BoundedText::default();
	uri.push_text(base_uri)?;
	for value in traits.as_slice() {
		uri.push_text(&[
			HEX_DIGITS[usize::from(value >> 4)],
			HEX_DIGITS[usize::from(value & 0x0f)],
		])?;
	}
	uri.push_text(b"-")?;
	uri.push_decimal(serial)?;
	uri.push_text(URI_SUFFIX)?;

	Ok(uri)
}

/// Validate the admin's null-padded collection text at creation.
///
/// A 20-byte prefix leaves room for ` #` and any ten-digit serial within the
/// 32-byte name cap, and a 128-byte `https://` base leaves room for twelve
/// hex layers, a twenty-digit serial, and `.json` within the URI cap.
pub fn validate_exclusive_text(
	name_prefix: &[u8; MAX_EXCLUSIVE_NAME_BYTES],
	symbol: &[u8; MAX_EXCLUSIVE_SYMBOL_BYTES],
	base_uri: &[u8; MAX_EXCLUSIVE_BASE_URI_BYTES],
) -> ProgramResult {
	validate_text(name_prefix, true)?;
	validate_text(symbol, false)?;
	validate_text(base_uri, true)?;
	let base_uri = &base_uri[..text_len(base_uri)];

	if text_len(name_prefix) > MAX_EXCLUSIVE_NAME_PREFIX_BYTES
		|| !base_uri.starts_with(HTTPS_PREFIX)
		|| base_uri.len() == HTTPS_PREFIX.len()
		|| base_uri.contains(&b' ')
	{
		return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
	}

	Ok(())
}

#[cfg(test)]
mod tests {
	use alloc::vec::Vec;

	use proptest::prelude::*;

	use super::*;

	fn table(layers: &[&[u32]]) -> ([u8; MAX_EXCLUSIVE_LAYERS], Vec<u8>) {
		let mut counts = [0u8; MAX_EXCLUSIVE_LAYERS];
		let mut weights = alloc::vec![0u8; EXCLUSIVE_WEIGHT_TABLE_BYTES];
		for (layer, values) in layers.iter().enumerate() {
			counts[layer] = u8::try_from(values.len()).expect("trait count");
			for (slot, weight) in values.iter().enumerate() {
				let start = layer * EXCLUSIVE_LAYER_WEIGHT_BYTES + slot * 4;
				weights[start..start + 4].copy_from_slice(&weight.to_le_bytes());
			}
		}
		(counts, weights)
	}

	fn layer_bytes(values: &[u32]) -> [u8; EXCLUSIVE_LAYER_WEIGHT_BYTES] {
		let mut bytes = [0u8; EXCLUSIVE_LAYER_WEIGHT_BYTES];
		for (slot, weight) in values.iter().enumerate() {
			bytes[slot * 4..slot * 4 + 4].copy_from_slice(&weight.to_le_bytes());
		}
		bytes
	}

	#[test]
	fn layer_tables_reject_empty_oversized_and_padded_encodings() {
		assert_eq!(validate_exclusive_layer(&layer_bytes(&[1, 2, 3]), 3), Ok(6));
		assert!(validate_exclusive_layer(&layer_bytes(&[0, 0]), 2).is_err());
		assert!(validate_exclusive_layer(&layer_bytes(&[1]), 0).is_err());
		assert!(
			validate_exclusive_layer(&layer_bytes(&[1, 2, 3]), 2).is_err(),
			"a weight hidden after the last trait"
		);
		assert!(validate_exclusive_layer(&layer_bytes(&[1]), 65).is_err());
		assert_eq!(
			validate_exclusive_layer(&layer_bytes(&[u32::MAX]), 1),
			Ok(MAX_TOTAL_WEIGHT)
		);
		assert!(validate_exclusive_layer(&layer_bytes(&[u32::MAX, 1]), 2).is_err());
		assert!(validate_exclusive_layer(&layer_bytes(&[1; 64]), 64).is_ok());
	}

	#[test]
	fn a_single_drawable_trait_always_wins() {
		let (counts, weights) = table(&[&[0, 0, 9, 0], &[5, 0], &[1]]);
		for seed in [[0u8; 32], [7; 32], [255; 32]] {
			let traits = exclusive_traits(&seed, &counts, &weights, 3).expect("traits");
			assert_eq!(traits.as_slice(), &[2, 0, 0]);
		}
	}

	#[test]
	fn layers_sample_independent_domain_separated_hashes() {
		let seed = [42u8; 32];
		let (counts, weights) = table(&[&[1; 64], &[1; 64]]);
		let traits = exclusive_traits(&seed, &counts, &weights, 2).expect("traits");
		for layer in 0..2u8 {
			let digest = hashv(&[&seed, b"layer".as_slice(), &[layer]]);
			let expected =
				accept_uniform_candidate(digest_candidate(digest.as_ref()), 64).expect("accepted");
			assert_eq!(u64::from(traits.traits[usize::from(layer)]), expected);
		}
	}

	#[test]
	fn names_and_uris_follow_the_shared_contract() {
		let name = exclusive_nft_name(b"Introductory", 42).expect("name");
		assert_eq!(name.as_bytes(), b"Introductory #42");
		let mut traits = ExclusiveTraits {
			layer_count: 3,
			traits: [0; MAX_EXCLUSIVE_LAYERS],
		};
		traits.traits[..3].copy_from_slice(&[0, 15, 63]);
		let uri = exclusive_nft_uri(b"https://example.com/nft/", &traits, 7).expect("uri");
		assert_eq!(uri.as_bytes(), b"https://example.com/nft/000f3f-7.json");
		assert!(exclusive_nft_name(&[b'a'; 20], 9_999_999_999).is_ok());
		assert!(exclusive_nft_name(&[b'a'; 21], 9_999_999_999).is_err());
	}

	#[test]
	fn the_longest_uri_fits_the_bubblegum_cap() {
		let traits = ExclusiveTraits {
			layer_count: 12,
			traits: [63; MAX_EXCLUSIVE_LAYERS],
		};
		let uri = exclusive_nft_uri(&[b'a'; MAX_EXCLUSIVE_BASE_URI_BYTES], &traits, u64::MAX)
			.expect("uri");
		assert!(uri.as_bytes().len() <= MAX_EXCLUSIVE_URI_BYTES);
	}

	#[test]
	fn collection_text_is_bounded_and_https() {
		let mut prefix = [0u8; 32];
		prefix[..20].copy_from_slice(&[b'A'; 20]);
		let symbol = [0u8; 10];
		let mut base = [0u8; 128];
		base[..20].copy_from_slice(b"https://example.com/");
		assert_eq!(validate_exclusive_text(&prefix, &symbol, &base), Ok(()));
		prefix[20] = b'A';
		assert!(validate_exclusive_text(&prefix, &symbol, &base).is_err());
		prefix[20] = 0;
		let mut insecure = [0u8; 128];
		insecure[..19].copy_from_slice(b"http://example.com/");
		assert!(validate_exclusive_text(&prefix, &symbol, &insecure).is_err());
		let mut scheme_only = [0u8; 128];
		scheme_only[..8].copy_from_slice(b"https://");
		assert!(validate_exclusive_text(&prefix, &symbol, &scheme_only).is_err());
		let mut spaced = [0u8; 128];
		spaced[..21].copy_from_slice(b"https://example.com/ ");
		assert!(validate_exclusive_text(&prefix, &symbol, &spaced).is_err());
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

	fn vector_layers(value: &serde_json::Value) -> ([u8; MAX_EXCLUSIVE_LAYERS], Vec<u8>, u8) {
		let tables = value
			.as_array()
			.expect("layers")
			.iter()
			.map(|layer| {
				layer
					.as_array()
					.expect("weights")
					.iter()
					.map(|weight| u32::try_from(weight.as_u64().expect("weight")).expect("u32"))
					.collect::<Vec<_>>()
			})
			.collect::<Vec<_>>();
		let borrowed = tables.iter().map(Vec::as_slice).collect::<Vec<_>>();
		let (counts, weights) = table(&borrowed);
		(
			counts,
			weights,
			u8::try_from(tables.len()).expect("layer count"),
		)
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
			let (counts, weights, layer_count) = vector_layers(&draw["layers"]);
			let traits = exclusive_traits(
				&vector_bytes(&draw["seedHex"]),
				&counts,
				&weights,
				layer_count,
			)
			.expect("traits");
			let expected = draw["traits"]
				.as_array()
				.expect("traits")
				.iter()
				.map(|value| u8::try_from(value.as_u64().expect("trait")).expect("u8"))
				.collect::<Vec<_>>();
			assert_eq!(traits.as_slice(), expected.as_slice(), "{}", draw["label"]);
			let serial = draw["serial"]
				.as_str()
				.and_then(|value| value.parse().ok())
				.expect("serial");
			let uri = exclusive_nft_uri(
				draw["baseUri"].as_str().expect("base").as_bytes(),
				&traits,
				serial,
			)
			.expect("uri");
			assert_eq!(
				uri.as_bytes(),
				draw["uri"].as_str().expect("uri").as_bytes()
			);
			let name = exclusive_nft_name(
				draw["namePrefix"].as_str().expect("prefix").as_bytes(),
				serial,
			)
			.expect("name");
			assert_eq!(
				name.as_bytes(),
				draw["name"].as_str().expect("name").as_bytes()
			);
		}
	}

	proptest! {
		#[test]
		fn traits_stay_inside_drawable_slots(
			seed in any::<[u8; 32]>(),
			first in proptest::collection::vec(0u16..1_000, 1..=64),
			second in proptest::collection::vec(0u16..1_000, 1..=64),
		) {
			let first = first.into_iter().map(u32::from).collect::<Vec<_>>();
			let second = second.into_iter().map(u32::from).collect::<Vec<_>>();
			prop_assume!(first.iter().any(|weight| *weight != 0));
			prop_assume!(second.iter().any(|weight| *weight != 0));
			let (counts, weights) = table(&[&first, &second]);
			let traits = exclusive_traits(&seed, &counts, &weights, 2).unwrap();

			prop_assert!(first[usize::from(traits.traits[0])] != 0);
			prop_assert!(second[usize::from(traits.traits[1])] != 0);
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
		fn layer_frequencies_are_exact_over_one_full_weight_cycle(
			weights in proptest::collection::vec(0u8..=255, 1..=16),
			offset in any::<u32>(),
		) {
			let weights = weights.into_iter().map(u32::from).collect::<Vec<_>>();
			let total = weights.iter().map(|weight| u64::from(*weight)).sum::<u64>();
			prop_assume!(total != 0);
			let threshold = total.wrapping_neg() % total;
			// Every block of `total` consecutive accepted candidates maps each
			// trait's slots exactly `weight` times: the pick is proportional.
			let start = threshold + u64::from(offset) * total;
			let mut hits = alloc::vec![0u64; weights.len()];
			for candidate in start..start + total {
				let target = accept_uniform_candidate(candidate, total).unwrap();
				let mut cumulative = 0;
				let slot = weights
					.iter()
					.position(|weight| {
						cumulative += u64::from(*weight);
						target < cumulative
					})
					.unwrap();
				hits[slot] += 1;
			}
			prop_assert_eq!(hits, weights.iter().map(|weight| u64::from(*weight)).collect::<Vec<_>>());
		}
	}
}
