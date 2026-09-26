//! `no_std` mirror of the program's Exclusive Lootbox NFT derivation.
//!
//! Every function here matches `ClaimExclusiveNft` byte for byte and is pinned
//! by `tests/vectors/exclusive-nft.json`, which the TypeScript and Dart SDKs
//! share.

use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;
use core::fmt::Write as _;

use solana_sha256_hasher::hashv;

/// Largest number of stacked trait layers in one collection.
pub const MAX_EXCLUSIVE_LAYERS: usize = 12;
/// Largest number of traits in one layer.
pub const MAX_EXCLUSIVE_TRAITS: usize = 64;
/// Longest name prefix; it leaves room for ` #` and a ten-digit serial.
pub const MAX_EXCLUSIVE_NAME_PREFIX_BYTES: usize = 20;
/// Bubblegum caps names at 32 bytes; minted names are `{prefix} #{serial}`.
pub const MAX_EXCLUSIVE_NAME_BYTES: usize = 32;
/// Lamports Bubblegum `mint_v2` charges per mint, escrowed per attachment.
pub const BUBBLEGUM_MINT_V2_FEE_LAMPORTS: u64 = 90_000;

const SEED_DOMAIN: &[u8] = b"lootbox:exclusive-nft";
const LAYER_LABEL: &[u8] = b"layer";
const MAX_TOTAL_WEIGHT: u64 = u32::MAX as u64;
const ROUNDS: u8 = 8;

/// Invalid layer table or derivation input.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExclusiveNftError {
	InvalidLayers,
	InvalidName,
	EntropyRejectionExhausted,
	ArithmeticOverflow,
}

impl core::fmt::Display for ExclusiveNftError {
	fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
		formatter.write_str(match self {
			Self::InvalidLayers => {
				"a collection needs 1 to 12 layers of 1 to 64 traits with a nonzero total no \
				 greater than u32::MAX"
			}
			Self::InvalidName => "the name exceeds Bubblegum's 32-byte cap",
			Self::EntropyRejectionExhausted => "entropy rejection exhausted after 8 rounds",
			Self::ArithmeticOverflow => "the mint-fee escrow exceeds the u64 range",
		})
	}
}

impl core::error::Error for ExclusiveNftError {}

/// Seed `S = sha256("lootbox:exclusive-nft" || template || opening || R)`.
#[must_use]
pub fn exclusive_nft_seed(template: &[u8; 32], opening: &[u8; 32], entropy: &[u8; 32]) -> [u8; 32] {
	hashv(&[SEED_DOMAIN, template, opening, entropy]).to_bytes()
}

/// Validate layer tables, mirroring `SetExclusiveLayer` and publication.
///
/// # Errors
/// Returns [`ExclusiveNftError::InvalidLayers`] for any table the program
/// would reject.
pub fn validate_exclusive_layers(layers: &[&[u32]]) -> Result<(), ExclusiveNftError> {
	if layers.is_empty() || layers.len() > MAX_EXCLUSIVE_LAYERS {
		return Err(ExclusiveNftError::InvalidLayers);
	}

	for layer in layers {
		let total = layer.iter().map(|weight| u64::from(*weight)).sum::<u64>();
		if layer.is_empty()
			|| layer.len() > MAX_EXCLUSIVE_TRAITS
			|| total == 0
			|| total > MAX_TOTAL_WEIGHT
		{
			return Err(ExclusiveNftError::InvalidLayers);
		}
	}

	Ok(())
}

/// Unbiased draw in `0..bound` from `sha256(S || "layer" || layer [|| round])`.
fn layer_draw(seed: &[u8; 32], layer: u8, bound: u64) -> Result<u64, ExclusiveNftError> {
	let threshold = bound.wrapping_neg() % bound;
	for round in 0..ROUNDS {
		let digest = if round == 0 {
			hashv(&[seed, LAYER_LABEL, &[layer]])
		} else {
			hashv(&[seed, LAYER_LABEL, &[layer], &[round]])
		};
		let mut candidate = [0u8; 8];
		candidate.copy_from_slice(&digest.as_ref()[..8]);
		let candidate = u64::from_le_bytes(candidate);

		if candidate >= threshold {
			return Ok(candidate % bound);
		}
	}

	Err(ExclusiveNftError::EntropyRejectionExhausted)
}

/// Derive every layer's trait index from `S`, exactly as `ClaimExclusiveNft` does.
///
/// # Errors
/// Returns [`ExclusiveNftError`] for invalid layers or exhausted rejection.
pub fn exclusive_traits(seed: &[u8; 32], layers: &[&[u32]]) -> Result<Vec<u8>, ExclusiveNftError> {
	validate_exclusive_layers(layers)?;

	layers
		.iter()
		.enumerate()
		.map(|(layer, weights)| {
			let total = weights.iter().map(|weight| u64::from(*weight)).sum::<u64>();
			let target = layer_draw(seed, layer as u8, total)?;
			let mut cumulative = 0u64;
			weights
				.iter()
				.position(|weight| {
					cumulative += u64::from(*weight);
					target < cumulative
				})
				.map(|slot| slot as u8)
				.ok_or(ExclusiveNftError::InvalidLayers)
		})
		.collect()
}

/// On-chain leaf name `{name_prefix} #{serial}`.
///
/// # Errors
/// Returns [`ExclusiveNftError::InvalidName`] beyond Bubblegum's 32-byte cap.
pub fn exclusive_nft_name(name_prefix: &str, serial: u64) -> Result<String, ExclusiveNftError> {
	let name = format!("{name_prefix} #{serial}");

	if name.len() > MAX_EXCLUSIVE_NAME_BYTES {
		return Err(ExclusiveNftError::InvalidName);
	}

	Ok(name)
}

/// On-chain leaf URI `{base_uri}{lowercase hex, one byte per layer}-{serial}.json`.
#[must_use]
pub fn exclusive_nft_uri(base_uri: &str, traits: &[u8], serial: u64) -> String {
	let hex = traits.iter().fold(String::new(), |mut text, value| {
		let _ = write!(text, "{value:02x}");
		text
	});

	format!("{base_uri}{hex}-{serial}.json")
}

/// Bubblegum fees an attachment escrows for `quantity` mints, excluding the
/// fee vault's rent-exempt minimum.
///
/// # Errors
/// Returns arithmetic overflow when the escrow exceeds `u64`.
pub fn exclusive_mint_fee_escrow_lamports(quantity: u64) -> Result<u64, ExclusiveNftError> {
	quantity
		.checked_mul(BUBBLEGUM_MINT_V2_FEE_LAMPORTS)
		.ok_or(ExclusiveNftError::ArithmeticOverflow)
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::PrizeAsset;
	use crate::PrizeBundle;
	use crate::TemplatePlan;

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

	fn number(value: &serde_json::Value) -> u64 {
		value
			.as_str()
			.expect("decimal string")
			.parse()
			.expect("u64")
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
			let tables = draw["layers"]
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
			let layers = tables.iter().map(Vec::as_slice).collect::<Vec<_>>();
			let traits = exclusive_traits(&bytes(&draw["seedHex"]), &layers).expect("traits");
			let expected = draw["traits"]
				.as_array()
				.expect("traits")
				.iter()
				.map(|value| u8::try_from(value.as_u64().expect("trait")).expect("u8"))
				.collect::<Vec<_>>();
			assert_eq!(traits, expected, "{}", draw["label"]);
			let serial = number(&draw["serial"]);
			assert_eq!(
				exclusive_nft_uri(draw["baseUri"].as_str().expect("base"), &traits, serial),
				draw["uri"].as_str().expect("uri"),
			);
			assert_eq!(
				exclusive_nft_name(draw["namePrefix"].as_str().expect("prefix"), serial).as_deref(),
				Ok(draw["name"].as_str().expect("name")),
			);
		}
	}

	#[test]
	fn layer_tables_mirror_the_program_limits() {
		assert_eq!(validate_exclusive_layers(&[&[1, 0]]), Ok(()));
		assert!(validate_exclusive_layers(&[]).is_err());
		assert!(validate_exclusive_layers(&[&[]]).is_err());
		assert!(validate_exclusive_layers(&[&[0, 0]]).is_err());
		assert!(validate_exclusive_layers(&[&[u32::MAX, 1]]).is_err());
		assert!(validate_exclusive_layers(&[&[1; 65]]).is_err());
		let one: &[u32] = &[1];
		assert!(validate_exclusive_layers(&[one; 13]).is_err());
		assert!(exclusive_nft_name("AAAAAAAAAAAAAAAAAAAAA", 9_999_999_999).is_err());
	}

	#[test]
	fn attached_bundles_escrow_one_mint_fee_per_copy() {
		let planner = &vectors()["planner"];
		let quantity = number(&planner["quantity"]);
		assert_eq!(
			exclusive_mint_fee_escrow_lamports(quantity),
			Ok(number(&planner["expectedMintFeeEscrowLamports"])),
		);

		let collection = [9u8; 32];
		let assets = [
			PrizeAsset::ExclusiveNft { collection },
			PrizeAsset::Sol { lamports: 1_000 },
		];
		let other = [PrizeAsset::ExclusiveNft { collection }];
		let bundles = [
			PrizeBundle {
				quantity,
				assets: &assets,
			},
			PrizeBundle {
				quantity: 2,
				assets: &other,
			},
		];
		let plan = TemplatePlan::new(&bundles).expect("two bundles may attach one collection");
		assert_eq!(plan.required_collateral(None), Ok(1_000 * quantity));
		assert_eq!(plan.required_collateral(Some(collection)), Ok(quantity + 2));
	}
}
