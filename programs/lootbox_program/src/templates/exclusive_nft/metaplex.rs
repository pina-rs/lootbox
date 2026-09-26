//! Pinned Bubblegum V2 and Metaplex Core CPIs for Exclusive Lootbox NFTs.
//!
//! Instruction layouts are pinned to `mpl-bubblegum` release `bubblegum@2.0.0`
//! (`79e1a1954bddb7fe5dcd52a5570a66a9f7d465e4`, the OtterSec-verified mainnet
//! build) and `mpl-core` `e72d63e4118a0a95ac9b40221e81b19d49e1e102`.

use alloc::vec::Vec;

use super::*;

/// Metaplex Core program.
pub const MPL_CORE_ID: Address = address!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
/// Metaplex Account Compression, used by Bubblegum V2 trees.
pub const MPL_ACCOUNT_COMPRESSION_ID: Address =
	address!("mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW");
/// Metaplex Noop log wrapper, used by Bubblegum V2 trees.
pub const MPL_NOOP_ID: Address = address!("mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3");
/// Bubblegum's fixed `["mpl_core_cpi_signer"]` PDA that Core trusts to update
/// collection counters.
pub const MPL_CORE_CPI_SIGNER_ID: Address =
	address!("CbNY3JiXdXNE9tPNEk1aRZVEkWdj2v7kfJLNQwZZgpXk");
/// Lamports `mint_v2` moves from its payer into the tree config per mint.
pub const BUBBLEGUM_MINT_V2_FEE_LAMPORTS: u64 = 90_000;

const MINT_V2_DISCRIMINATOR: [u8; 8] = [120, 121, 23, 146, 173, 110, 199, 205];
const CREATE_TREE_V2_DISCRIMINATOR: [u8; 8] = [55, 99, 95, 215, 142, 203, 227, 205];
const TREE_CONFIG_DISCRIMINATOR: [u8; 8] = [122, 245, 175, 248, 171, 34, 0, 207];
const TREE_CONFIG_SIZE: usize = 96;
const TREE_VERSION_V2: u8 = 1;
const CORE_CREATE_COLLECTION_V2: u8 = 21;
const CORE_COLLECTION_V1_KEY: u8 = 5;
const CORE_PLUGIN_BUBBLEGUM_V2: u8 = 15;
/// `TokenStandard::NonFungible`, the only standard `mint_v2` accepts.
const TOKEN_STANDARD_NON_FUNGIBLE: u8 = 0;

/// The subset of a Bubblegum `TreeConfig` the series relies on.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TreeConfigSnapshot {
	pub tree_creator: Address,
	pub tree_delegate: Address,
	pub total_mint_capacity: u64,
	pub num_minted: u64,
	pub is_public: bool,
}

/// Require the canonical Bubblegum tree config PDA of `merkle_tree`.
pub fn assert_tree_config_address(
	tree_config: &AccountView,
	merkle_tree: &Address,
) -> ProgramResult {
	let (expected, _) = try_find_program_address(&[merkle_tree.as_ref()], &MPL_BUBBLEGUM_ID)
		.ok_or(ProgramError::InvalidSeeds)?;

	if *tree_config.address() != expected {
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	Ok(())
}

fn read_u64_at(data: &[u8], offset: usize) -> Result<u64, ProgramError> {
	let bytes = data
		.get(offset..offset + 8)
		.ok_or(ProgramError::InvalidAccountData)?;

	Ok(u64::from_le_bytes([
		bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
	]))
}

/// Parse a Bubblegum-owned V2 `TreeConfig`.
pub fn read_tree_config(tree_config: &AccountView) -> Result<TreeConfigSnapshot, ProgramError> {
	tree_config.assert_owner(&MPL_BUBBLEGUM_ID)?;
	let data = tree_config.try_borrow()?;
	parse_tree_config(&data)
}

fn parse_tree_config(data: &[u8]) -> Result<TreeConfigSnapshot, ProgramError> {
	if data.len() != TREE_CONFIG_SIZE
		|| data[..8] != TREE_CONFIG_DISCRIMINATOR
		|| data[88] > 1
		|| data[90] != TREE_VERSION_V2
	{
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	Ok(TreeConfigSnapshot {
		tree_creator: parse_address(data, 8)?,
		tree_delegate: parse_address(data, 40)?,
		total_mint_capacity: read_u64_at(data, 72)?,
		num_minted: read_u64_at(data, 80)?,
		is_public: data[88] == 1,
	})
}

/// Require a Core `CollectionV1` whose update authority is the series PDA.
///
/// The series itself created the collection with exactly the `BubblegumV2`
/// plugin, and only the series can sign collection updates afterwards.
pub fn assert_core_collection(collection: &AccountView, series: &Address) -> ProgramResult {
	collection.assert_owner(&MPL_CORE_ID)?;
	let data = collection.try_borrow()?;

	if data.first() != Some(&CORE_COLLECTION_V1_KEY) || parse_address(&data, 1)? != *series {
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	Ok(())
}

fn push_borsh_string(data: &mut Vec<u8>, value: &[u8]) -> ProgramResult {
	let length = u32::try_from(value.len()).map_err(|_| ProgramError::InvalidArgument)?;
	data.extend_from_slice(&length.to_le_bytes());
	data.extend_from_slice(value);

	Ok(())
}

/// Core `CreateCollectionV2` with the series PDA as update authority and the
/// permanent `BubblegumV2` plugin, which Bubblegum V2 requires to mint into it.
pub struct CreateCoreCollection<'a, 'b> {
	pub collection: &'b AccountView,
	pub update_authority: &'b AccountView,
	pub payer: &'b AccountView,
	pub system_program: &'b AccountView,
	pub core_program: &'b AccountView,
	pub name: &'a [u8],
	pub uri: &'a [u8],
}

impl CreateCoreCollection<'_, '_> {
	pub fn invoke_signed(&self, signers: &[Signer<'_, '_>]) -> ProgramResult {
		self.core_program.assert_program(&MPL_CORE_ID)?;
		let metas = [
			InstructionAccount::writable_signer(self.collection.address()),
			InstructionAccount::readonly(self.update_authority.address()),
			InstructionAccount::writable_signer(self.payer.address()),
			InstructionAccount::readonly(self.system_program.address()),
		];
		let mut data = Vec::with_capacity(16 + self.name.len() + self.uri.len());
		data.push(CORE_CREATE_COLLECTION_V2);
		push_borsh_string(&mut data, self.name)?;
		push_borsh_string(&mut data, self.uri)?;
		// plugins: Some([PluginAuthorityPair { BubblegumV2, authority: None }])
		data.extend_from_slice(&[1, 1, 0, 0, 0, CORE_PLUGIN_BUBBLEGUM_V2, 0]);
		// external_plugin_adapters: None
		data.push(0);
		let instruction = InstructionView {
			program_id: &MPL_CORE_ID,
			accounts: &metas,
			data: &data,
		};

		pinocchio::cpi::invoke_signed(
			&instruction,
			&[
				self.collection,
				self.update_authority,
				self.payer,
				self.system_program,
			],
			signers,
		)
	}
}

/// Bubblegum `create_tree_v2` with the series PDA as the private tree creator.
///
/// Bubblegum never changes `tree_creator`, and a private tree accepts mints
/// only from its creator or delegate, so the series PDA is the sole minter.
pub struct CreateBubblegumTree<'b> {
	pub tree_config: &'b AccountView,
	pub merkle_tree: &'b AccountView,
	pub payer: &'b AccountView,
	pub tree_creator: &'b AccountView,
	pub log_wrapper: &'b AccountView,
	pub compression_program: &'b AccountView,
	pub system_program: &'b AccountView,
	pub bubblegum_program: &'b AccountView,
	pub max_depth: u32,
	pub max_buffer_size: u32,
}

impl CreateBubblegumTree<'_> {
	pub fn invoke_signed(&self, signers: &[Signer<'_, '_>]) -> ProgramResult {
		self.bubblegum_program.assert_program(&MPL_BUBBLEGUM_ID)?;
		self.log_wrapper.assert_address(&MPL_NOOP_ID)?;
		self.compression_program
			.assert_program(&MPL_ACCOUNT_COMPRESSION_ID)?;
		let metas = [
			InstructionAccount::writable(self.tree_config.address()),
			InstructionAccount::writable(self.merkle_tree.address()),
			InstructionAccount::writable_signer(self.payer.address()),
			InstructionAccount::readonly_signer(self.tree_creator.address()),
			InstructionAccount::readonly(self.log_wrapper.address()),
			InstructionAccount::readonly(self.compression_program.address()),
			InstructionAccount::readonly(self.system_program.address()),
		];
		let mut data = [0u8; 17];
		data[..8].copy_from_slice(&CREATE_TREE_V2_DISCRIMINATOR);
		data[8..12].copy_from_slice(&self.max_depth.to_le_bytes());
		data[12..16].copy_from_slice(&self.max_buffer_size.to_le_bytes());
		// public: None, which Bubblegum records as a private tree.
		data[16] = 0;
		let instruction = InstructionView {
			program_id: &MPL_BUBBLEGUM_ID,
			accounts: &metas,
			data: &data,
		};

		pinocchio::cpi::invoke_signed(
			&instruction,
			&[
				self.tree_config,
				self.merkle_tree,
				self.payer,
				self.tree_creator,
				self.log_wrapper,
				self.compression_program,
				self.system_program,
			],
			signers,
		)
	}
}

/// Immutable `MetadataArgsV2` fields of one Exclusive Lootbox NFT.
pub struct LeafMetadata<'a> {
	pub name: &'a [u8],
	pub symbol: &'a [u8],
	pub uri: &'a [u8],
	pub collection: &'a Address,
}

/// Canonical Borsh `MetadataArgsV2` followed by the absent asset-data options.
///
/// Royalties are zero, the leaf is immutable, the standard is `NonFungible`,
/// there are no creators, and the Core collection is verified by Bubblegum.
pub fn encode_mint_v2_data(metadata: &LeafMetadata<'_>) -> Result<Vec<u8>, ProgramError> {
	let mut data =
		Vec::with_capacity(64 + metadata.name.len() + metadata.symbol.len() + metadata.uri.len());
	data.extend_from_slice(&MINT_V2_DISCRIMINATOR);
	push_borsh_string(&mut data, metadata.name)?;
	push_borsh_string(&mut data, metadata.symbol)?;
	push_borsh_string(&mut data, metadata.uri)?;
	// seller_fee_basis_points = 0, primary_sale_happened = false,
	// is_mutable = false, token_standard = Some(NonFungible).
	data.extend_from_slice(&[0, 0, 0, 0, 1, TOKEN_STANDARD_NON_FUNGIBLE]);
	// creators: empty Vec<Creator>.
	data.extend_from_slice(&0u32.to_le_bytes());
	// collection: Some(collection).
	data.push(1);
	data.extend_from_slice(metadata.collection.as_ref());
	// asset_data: None, asset_data_schema: None.
	data.extend_from_slice(&[0, 0]);

	Ok(data)
}

/// Bubblegum `mint_v2` into the series' private tree and Core collection.
///
/// The series PDA signs as both tree creator and collection authority. The
/// zero-data fee vault PDA signs as payer for Bubblegum's per-mint fee.
pub struct MintBubblegumLeaf<'a, 'b> {
	pub tree_config: &'b AccountView,
	pub payer: &'b AccountView,
	pub tree_authority: &'b AccountView,
	pub collection_authority: &'b AccountView,
	pub leaf_owner: &'b AccountView,
	pub merkle_tree: &'b AccountView,
	pub collection: &'b AccountView,
	pub core_cpi_signer: &'b AccountView,
	pub log_wrapper: &'b AccountView,
	pub compression_program: &'b AccountView,
	pub core_program: &'b AccountView,
	pub system_program: &'b AccountView,
	pub bubblegum_program: &'b AccountView,
	pub metadata: LeafMetadata<'a>,
}

impl MintBubblegumLeaf<'_, '_> {
	pub fn invoke_signed(&self, signers: &[Signer<'_, '_>]) -> ProgramResult {
		self.bubblegum_program.assert_program(&MPL_BUBBLEGUM_ID)?;
		self.core_program.assert_program(&MPL_CORE_ID)?;
		self.log_wrapper.assert_address(&MPL_NOOP_ID)?;
		self.compression_program
			.assert_program(&MPL_ACCOUNT_COMPRESSION_ID)?;
		self.core_cpi_signer
			.assert_address(&MPL_CORE_CPI_SIGNER_ID)?;
		self.system_program.assert_address(&system::ID)?;
		let metas = [
			InstructionAccount::writable(self.tree_config.address()),
			InstructionAccount::writable_signer(self.payer.address()),
			InstructionAccount::readonly_signer(self.tree_authority.address()),
			InstructionAccount::readonly_signer(self.collection_authority.address()),
			InstructionAccount::readonly(self.leaf_owner.address()),
			// leaf_delegate: absent, so Bubblegum uses the leaf owner.
			InstructionAccount::readonly(&MPL_BUBBLEGUM_ID),
			InstructionAccount::writable(self.merkle_tree.address()),
			InstructionAccount::writable(self.collection.address()),
			InstructionAccount::readonly(self.core_cpi_signer.address()),
			InstructionAccount::readonly(self.log_wrapper.address()),
			InstructionAccount::readonly(self.compression_program.address()),
			InstructionAccount::readonly(self.core_program.address()),
			InstructionAccount::readonly(self.system_program.address()),
		];
		let data = encode_mint_v2_data(&self.metadata)?;
		let instruction = InstructionView {
			program_id: &MPL_BUBBLEGUM_ID,
			accounts: &metas,
			data: &data,
		};

		pinocchio::cpi::invoke_signed(
			&instruction,
			&[
				self.tree_config,
				self.payer,
				self.tree_authority,
				self.collection_authority,
				self.leaf_owner,
				self.bubblegum_program,
				self.merkle_tree,
				self.collection,
				self.core_cpi_signer,
				self.log_wrapper,
				self.compression_program,
				self.core_program,
				self.system_program,
			],
			signers,
		)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn mint_v2_data_matches_the_official_client_layout() {
		// The official `@metaplex-foundation/mpl-bubblegum@6.0.0` encoding of
		// name "A", symbol "B", uri "C", fee 500, mutable, NonFungible, no
		// creators, and the Core program as a placeholder collection is:
		// 78791792ad6ec7cd 01000000 41 01000000 42 01000000 43 f401 00 01
		// 0100 00000000 01 <core id> 00 00. The lootbox encoding differs only
		// in its fixed royalty and mutability bytes.
		let data = encode_mint_v2_data(&LeafMetadata {
			name: b"A",
			symbol: b"B",
			uri: b"C",
			collection: &MPL_CORE_ID,
		})
		.expect("metadata");
		let mut expected = alloc::vec![120, 121, 23, 146, 173, 110, 199, 205];
		expected.extend_from_slice(&[1, 0, 0, 0, b'A', 1, 0, 0, 0, b'B', 1, 0, 0, 0, b'C']);
		expected.extend_from_slice(&[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
		expected.extend_from_slice(MPL_CORE_ID.as_ref());
		expected.extend_from_slice(&[0, 0]);
		assert_eq!(data, expected);
	}

	#[test]
	fn tree_config_parser_requires_a_v2_bubblegum_layout() {
		let creator = [3u8; 32];
		let mut data = [0u8; TREE_CONFIG_SIZE];
		data[..8].copy_from_slice(&TREE_CONFIG_DISCRIMINATOR);
		data[8..40].copy_from_slice(&creator);
		data[40..72].copy_from_slice(&creator);
		data[72..80].copy_from_slice(&16_384u64.to_le_bytes());
		data[80..88].copy_from_slice(&7u64.to_le_bytes());
		data[89] = 1;
		data[90] = TREE_VERSION_V2;
		let parsed = parse_tree_config(&data).expect("tree config");
		assert_eq!(parsed.tree_creator, Address::new_from_array(creator));
		assert_eq!(parsed.total_mint_capacity, 16_384);
		assert_eq!(parsed.num_minted, 7);
		assert!(!parsed.is_public);

		data[90] = 0;
		assert!(parse_tree_config(&data).is_err(), "V1 trees are rejected");
		data[90] = TREE_VERSION_V2;
		data[0] ^= 1;
		assert!(parse_tree_config(&data).is_err(), "foreign discriminator");
		assert!(parse_tree_config(&data[..95]).is_err(), "short account");
	}

	#[test]
	fn pinned_core_cpi_signer_is_bubblegums_pda() {
		let (signer, bump) =
			try_find_program_address(&[b"mpl_core_cpi_signer"], &MPL_BUBBLEGUM_ID).expect("pda");
		assert_eq!(signer, MPL_CORE_CPI_SIGNER_ID);
		assert_eq!(bump, 252);
	}
}
