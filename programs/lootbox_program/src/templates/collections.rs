//! Prize adapters for Metaplex Core and Bubblegum assets.

use alloc::vec::Vec;

use super::*;

const MPL_CORE_ID: Address = address!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
pub(super) const MPL_BUBBLEGUM_ID: Address =
	address!("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");
pub(super) const SPL_ACCOUNT_COMPRESSION_ID: Address =
	address!("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
pub(super) const SPL_NOOP_ID: Address = address!("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

/// Metaplex Core `Key::AssetV1` discriminant at the pinned upstream commit.
const CORE_ASSET_V1_KEY: u8 = 1;
/// `UpdateAuthority::Address` discriminant inside a Core asset account.
const CORE_UPDATE_AUTHORITY_ADDRESS_TAG: u8 = 1;
/// Byte offset where the update authority enum begins in `AssetV1`.
const CORE_UPDATE_AUTHORITY_OFFSET: usize = 33;
/// `AssetV1::BASE_LENGTH` at the pinned upstream commit: key, owner, the
/// fixed-width update authority, two string length prefixes, and the seq tag.
const CORE_ASSET_BASE_LENGTH: usize = 75;

/// Escrows a plain Metaplex Core asset into a funding bundle.
///
/// The template authority signs as the asset's owner while the template is
/// unlocked and not retired. The bundle must be funding with a quantity of one.
/// The asset must be uncollected, carry no plugins, and already name the bundle
/// PDA as its update authority. Ownership moves to the bundle, and the asset
/// address is recorded in the bundle's next unfunded slot.
#[instruction(discriminator = LootboxInstruction::FundCoreAssetPrize, migrations)]
pub struct FundCoreAssetPrizeInstruction {}

/// Delivers an allocated Metaplex Core asset from bundle escrow to the
/// opening's beneficiary.
///
/// Any signer may submit it. The opening must be allocated to `bundle`, and the
/// slot must not be claimed yet. The asset is revalidated as plugin-free before
/// the bundle PDA signs the transfer. Sets the slot's claim bit on the opening
/// and marks the opening delivered once every slot is claimed.
#[instruction(discriminator = LootboxInstruction::ClaimCoreAssetPrize, migrations)]
pub struct ClaimCoreAssetPrizeInstruction {
	/// Bundle slot holding the asset. Must be below the bundle's `asset_count`
	/// and hold a Core asset whose address is `asset`.
	pub asset_index: u8,
}

/// Returns an undrawn Metaplex Core asset from bundle escrow to the template
/// authority.
///
/// The template authority signs. A funding bundle is always reclaimable; an
/// active bundle is reclaimable only after the template is retired, the box
/// supply is zero, no openings are pending, and its copy was never drawn. Sets
/// the slot's reclaimed bit so it cannot be reclaimed twice.
#[instruction(discriminator = LootboxInstruction::ReclaimCoreAssetPrize, migrations)]
pub struct ReclaimCoreAssetPrizeInstruction {
	/// Bundle slot holding the asset. Must be below the bundle's
	/// `funded_assets` and hold a Core asset whose address is `asset`.
	pub asset_index: u8,
}

/// Escrows a Bubblegum compressed NFT into a funding bundle.
///
/// The template authority signs as the leaf owner while the template is
/// unlocked and not retired. The bundle must be funding with a quantity of one.
/// Bubblegum transfers the leaf to the bundle PDA, and the asset ID derived
/// from `merkle_tree` and `nonce` is recorded in the bundle's next unfunded
/// slot.
#[instruction(discriminator = LootboxInstruction::FundCompressedNftPrize, migrations)]
pub struct FundCompressedNftPrizeInstruction {
	/// Merkle root the proof was built against; Bubblegum verifies the leaf
	/// against it.
	pub root: [u8; 32],
	/// Bubblegum hash of the leaf's metadata, forwarded to rebuild the leaf.
	pub data_hash: [u8; 32],
	/// Bubblegum hash of the leaf's creators, forwarded to rebuild the leaf.
	pub creator_hash: [u8; 32],
	/// Leaf nonce. With `merkle_tree` it derives the asset ID recorded in the
	/// bundle.
	pub nonce: u64,
	/// Leaf position in `merkle_tree`, forwarded to Bubblegum.
	pub index: u32,
}

/// Delivers an allocated Bubblegum compressed NFT from bundle escrow to the
/// opening's beneficiary.
///
/// Permissionless: no signer is required because the bundle PDA signs the
/// transfer and the recipient is fixed by the opening. The opening must be
/// allocated to `bundle`, and the slot must not be claimed yet. Sets the slot's
/// claim bit on the opening and marks the opening delivered once every slot is
/// claimed.
#[instruction(discriminator = LootboxInstruction::ClaimCompressedNftPrize, migrations)]
pub struct ClaimCompressedNftPrizeInstruction {
	/// Bundle slot holding the compressed NFT. Must be below the bundle's
	/// `asset_count` and hold the asset ID derived from `merkle_tree` and
	/// `nonce`.
	pub asset_index: u8,
	/// Merkle root the proof was built against; Bubblegum verifies the leaf
	/// against it.
	pub root: [u8; 32],
	/// Bubblegum hash of the leaf's metadata, forwarded to rebuild the leaf.
	pub data_hash: [u8; 32],
	/// Bubblegum hash of the leaf's creators, forwarded to rebuild the leaf.
	pub creator_hash: [u8; 32],
	/// Leaf nonce. With `merkle_tree` it derives the asset ID, which must match
	/// the slot's stored asset.
	pub nonce: u64,
	/// Leaf position in `merkle_tree`, forwarded to Bubblegum.
	pub index: u32,
}

/// Returns an undrawn Bubblegum compressed NFT from bundle escrow to the
/// template authority.
///
/// The template authority signs. A funding bundle is always reclaimable; an
/// active bundle is reclaimable only after the template is retired, the box
/// supply is zero, no openings are pending, and its copy was never drawn. Sets
/// the slot's reclaimed bit so it cannot be reclaimed twice.
#[instruction(discriminator = LootboxInstruction::ReclaimCompressedNftPrize, migrations)]
pub struct ReclaimCompressedNftPrizeInstruction {
	/// Bundle slot holding the compressed NFT. Must be below the bundle's
	/// `funded_assets` and hold the asset ID derived from `merkle_tree` and
	/// `nonce`.
	pub asset_index: u8,
	/// Merkle root the proof was built against; Bubblegum verifies the leaf
	/// against it.
	pub root: [u8; 32],
	/// Bubblegum hash of the leaf's metadata, forwarded to rebuild the leaf.
	pub data_hash: [u8; 32],
	/// Bubblegum hash of the leaf's creators, forwarded to rebuild the leaf.
	pub creator_hash: [u8; 32],
	/// Leaf nonce. With `merkle_tree` it derives the asset ID, which must match
	/// the slot's stored asset.
	pub nonce: u64,
	/// Leaf position in `merkle_tree`, forwarded to Bubblegum.
	pub index: u32,
}

/// Accounts for `fundCoreAssetPrize`.
#[derive(Accounts, Debug)]
pub struct FundCoreAssetPrizeAccounts<'a> {
	/// Template authority. Signs the Core transfer as the asset's owner and pays
	/// for it.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template PDA owned by this program; must be unlocked and not retired.
	pub template: &'a AccountView,
	/// Funding bundle PDA of `template` with a quantity of one. Records the
	/// asset and becomes its owner.
	pub bundle: &'a mut AccountView,
	/// Core asset owned by the Core program, serialized as a plugin-free
	/// `AssetV1` whose update authority is `bundle`.
	pub asset: &'a mut AccountView,
	/// Must be the Core program address, Core's placeholder for no collection;
	/// collection-bound assets are rejected.
	pub collection: &'a AccountView,
	/// Metaplex Core program, invoked to transfer the asset.
	pub core_program: &'a AccountView,
	/// System program, forwarded to Core.
	pub system_program: &'a AccountView,
	/// SPL Noop program, forwarded to Core as its log wrapper.
	pub log_wrapper: &'a AccountView,
	/// Core plugin and external-adapter accounts, forwarded with their client
	/// flags. Must be empty: any account here fails with `InvalidPrize`.
	#[pina(remaining)]
	pub plugin_accounts: &'a [AccountView],
}

/// Accounts for `claimCoreAssetPrize`.
#[derive(Accounts, Debug)]
pub struct ClaimCoreAssetPrizeAccounts<'a> {
	/// Any signer; pays for the Core transfer.
	#[pina(validate(signer))]
	pub payer: &'a mut AccountView,
	/// Template PDA owned by this program.
	pub template: &'a AccountView,
	/// Allocated template opening PDA of `template` whose selected bundle is
	/// `bundle`. Records the slot's claim bit.
	pub opening: &'a mut AccountView,
	/// Bundle PDA of `template` that owns the asset, signs the transfer, and
	/// counts the claim.
	pub bundle: &'a mut AccountView,
	/// The opening's beneficiary and new owner of the asset.
	pub recipient: &'a AccountView,
	/// Core asset stored in the claimed slot; revalidated as plugin-free with
	/// `bundle` as update authority.
	pub asset: &'a mut AccountView,
	/// Must be the Core program address, Core's placeholder for no collection.
	pub collection: &'a AccountView,
	/// Metaplex Core program, invoked to transfer the asset.
	pub core_program: &'a AccountView,
	/// System program, forwarded to Core.
	pub system_program: &'a AccountView,
	/// SPL Noop program, forwarded to Core as its log wrapper.
	pub log_wrapper: &'a AccountView,
	/// Core plugin and external-adapter accounts, forwarded with their client
	/// flags. Must be empty: any account here fails with `InvalidPrize`.
	#[pina(remaining)]
	pub plugin_accounts: &'a [AccountView],
}

/// Accounts for `reclaimCoreAssetPrize`.
#[derive(Accounts, Debug)]
pub struct ReclaimCoreAssetPrizeAccounts<'a> {
	/// Template authority. Receives the asset and pays for the Core transfer.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template PDA of this program.
	pub template: &'a AccountView,
	/// The template's Token-2022 box mint; its supply must be zero to reclaim
	/// from an active bundle.
	pub box_mint: &'a AccountView,
	/// Bundle PDA of `template` that owns the asset, signs the transfer, and
	/// records the reclaim.
	pub bundle: &'a mut AccountView,
	/// Core asset stored in the reclaimed slot; revalidated as plugin-free with
	/// `bundle` as update authority.
	pub asset: &'a mut AccountView,
	/// Must be the Core program address, Core's placeholder for no collection.
	pub collection: &'a AccountView,
	/// Metaplex Core program, invoked to transfer the asset.
	pub core_program: &'a AccountView,
	/// System program, forwarded to Core.
	pub system_program: &'a AccountView,
	/// SPL Noop program, forwarded to Core as its log wrapper.
	pub log_wrapper: &'a AccountView,
	/// Core plugin and external-adapter accounts, forwarded with their client
	/// flags. Must be empty: any account here fails with `InvalidPrize`.
	#[pina(remaining)]
	pub plugin_accounts: &'a [AccountView],
}

/// Accounts for `fundCompressedNftPrize`.
#[derive(Accounts, Debug)]
pub struct FundCompressedNftPrizeAccounts<'a> {
	/// Template authority. Signs the Bubblegum transfer as both leaf owner and
	/// leaf delegate.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Template PDA owned by this program; must be unlocked and not retired.
	pub template: &'a AccountView,
	/// Funding bundle PDA of `template` with a quantity of one. Records the
	/// asset ID and becomes the leaf owner.
	pub bundle: &'a mut AccountView,
	/// Bubblegum tree config of `merkle_tree`, validated by Bubblegum.
	pub tree_config: &'a AccountView,
	/// Concurrent Merkle tree holding the leaf; with `nonce` it derives the
	/// recorded asset ID.
	pub merkle_tree: &'a mut AccountView,
	/// Metaplex Bubblegum program, invoked to transfer the leaf.
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	/// SPL Noop program, forwarded to Bubblegum as its log wrapper.
	#[pina(validate(address = SPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	/// SPL Account Compression program, forwarded to Bubblegum.
	#[pina(validate(address = SPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	/// System program, forwarded to Bubblegum.
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in leaf-to-root order, at most 16; deeper trees need
	/// canopy.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

/// Accounts for `claimCompressedNftPrize`.
#[derive(Accounts, Debug)]
pub struct ClaimCompressedNftPrizeAccounts<'a> {
	/// Template PDA owned by this program.
	pub template: &'a AccountView,
	/// Allocated template opening PDA of `template` whose selected bundle is
	/// `bundle`. Records the slot's claim bit.
	pub opening: &'a mut AccountView,
	/// Bundle PDA of `template` that owns the leaf, signs the transfer, and
	/// counts the claim.
	pub bundle: &'a mut AccountView,
	/// The opening's beneficiary and new owner of the leaf.
	pub recipient: &'a AccountView,
	/// Bubblegum tree config of `merkle_tree`, validated by Bubblegum.
	pub tree_config: &'a AccountView,
	/// Concurrent Merkle tree holding the leaf; with `nonce` it must derive the
	/// slot's stored asset ID.
	pub merkle_tree: &'a mut AccountView,
	/// Metaplex Bubblegum program, invoked to transfer the leaf.
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	/// SPL Noop program, forwarded to Bubblegum as its log wrapper.
	#[pina(validate(address = SPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	/// SPL Account Compression program, forwarded to Bubblegum.
	#[pina(validate(address = SPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	/// System program, forwarded to Bubblegum.
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in leaf-to-root order, at most 16; deeper trees need
	/// canopy.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

/// Accounts for `reclaimCompressedNftPrize`.
#[derive(Accounts, Debug)]
pub struct ReclaimCompressedNftPrizeAccounts<'a> {
	/// Template authority; receives the leaf.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Template PDA of this program.
	pub template: &'a AccountView,
	/// The template's Token-2022 box mint; its supply must be zero to reclaim
	/// from an active bundle.
	pub box_mint: &'a AccountView,
	/// Bundle PDA of `template` that owns the leaf, signs the transfer, and
	/// records the reclaim.
	pub bundle: &'a mut AccountView,
	/// Bubblegum tree config of `merkle_tree`, validated by Bubblegum.
	pub tree_config: &'a AccountView,
	/// Concurrent Merkle tree holding the leaf; with `nonce` it must derive the
	/// slot's stored asset ID.
	pub merkle_tree: &'a mut AccountView,
	/// Metaplex Bubblegum program, invoked to transfer the leaf.
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	/// SPL Noop program, forwarded to Bubblegum as its log wrapper.
	#[pina(validate(address = SPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	/// SPL Account Compression program, forwarded to Bubblegum.
	#[pina(validate(address = SPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	/// System program, forwarded to Bubblegum.
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in leaf-to-root order, at most 16; deeper trees need
	/// canopy.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

/// Require a plugin-free Core asset whose update authority already belongs to
/// `bundle`.
///
/// Core stores plugins in a header and registry appended after the base
/// `AssetV1` serialization, and permanent transfer delegates — which
/// force-approve transfers by their authority without the owner — are minted
/// with the asset itself and can never be removed. The only admissible escrow
/// shape is therefore the exact base serialization: no trailing registry
/// bytes, with the update authority already transferred to the bundle PDA so
/// the creator retains no plugin, freeze, or transfer power over the prize.
fn validate_core_asset_data(data: &[u8], bundle: &Address) -> ProgramResult {
	if data.first() != Some(&CORE_ASSET_V1_KEY)
		|| data.get(CORE_UPDATE_AUTHORITY_OFFSET) != Some(&CORE_UPDATE_AUTHORITY_ADDRESS_TAG)
	{
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	let update_authority = data
		.get(CORE_UPDATE_AUTHORITY_OFFSET + 1..CORE_UPDATE_AUTHORITY_OFFSET + 33)
		.ok_or(ProgramError::InvalidAccountData)?;

	if update_authority != bundle.as_ref() {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	let mut cursor = CORE_UPDATE_AUTHORITY_OFFSET + 33;
	let mut strings = 0usize;

	for _ in 0..2 {
		let length = metadata_string_length(data, &mut cursor)?;
		strings = strings
			.checked_add(length)
			.ok_or(ProgramError::InvalidAccountData)?;
		cursor = cursor
			.checked_add(length)
			.ok_or(ProgramError::InvalidAccountData)?;

		if cursor > data.len() {
			return Err(ProgramError::InvalidAccountData);
		}
	}

	let seq = data
		.get(cursor)
		.copied()
		.ok_or(ProgramError::InvalidAccountData)?;

	let seq_payload = match seq {
		0 => 0,
		1 => 8,
		_ => return Err(ProgramError::InvalidAccountData),
	};

	// Mirror Core's own `AssetV1::get_size` boundary: a longer account means a
	// plugin header and registry are appended to the base serialization.
	let expected = CORE_ASSET_BASE_LENGTH
		.checked_add(strings)
		.and_then(|value| value.checked_add(seq_payload))
		.ok_or(ProgramError::InvalidAccountData)?;

	if data.len() != expected {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	Ok(())
}

/// Read one Borsh string length and advance the cursor past its prefix.
fn metadata_string_length(data: &[u8], cursor: &mut usize) -> Result<usize, ProgramError> {
	let prefix: [u8; 4] = data
		.get(*cursor..*cursor + 4)
		.and_then(|bytes| bytes.try_into().ok())
		.ok_or(ProgramError::InvalidAccountData)?;
	*cursor = (*cursor)
		.checked_add(4)
		.ok_or(ProgramError::InvalidAccountData)?;

	if *cursor > data.len() {
		return Err(ProgramError::InvalidAccountData);
	}

	usize::try_from(u32::from_le_bytes(prefix)).map_err(|_| ProgramError::InvalidAccountData)
}

/// `CompressionAccountType::ConcurrentMerkleTree` discriminant.
const TREE_ACCOUNT_TYPE: u8 = 1;
/// `ConcurrentMerkleTreeHeaderData::V1` discriminant.
const TREE_VERSION_V1: u8 = 1;
/// `CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1` from spl-account-compression.
const TREE_HEADER_SIZE: usize = 56;
/// The sequence number, active index, and buffer size of the tree region.
const TREE_REGION_FIXED: usize = 24;
/// Fixed bytes around one changelog or rightmost-proof path: the root node,
/// leaf index, and padding surrounding its `max_depth` nodes.
const TREE_PER_ENTRY_FIXED: usize = 72;

/// Require a Bubblegum tree whose claims can never outgrow the proof cap.
///
/// Proofs are truncated at the canopy, so the longest inclusion proof any
/// churned sibling can force is `max_depth - canopy_depth` accounts. Trees
/// that cannot guarantee deliverability inside the accepted proof tail are
/// rejected when a leaf enters escrow instead of stranding prizes later.
fn validate_claimable_tree_data(data: &[u8]) -> ProgramResult {
	if data.first() != Some(&TREE_ACCOUNT_TYPE) || data.get(1) != Some(&TREE_VERSION_V1) {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	let read = |offset: usize| -> Result<usize, ProgramError> {
		let bytes: [u8; 4] = data
			.get(offset..offset + 4)
			.and_then(|bytes| bytes.try_into().ok())
			.ok_or(ProgramError::InvalidAccountData)?;
		usize::try_from(u32::from_le_bytes(bytes)).map_err(|_| ProgramError::InvalidAccountData)
	};
	let max_buffer = read(2)?;
	let max_depth = read(6)?;

	// The serialized tree region is `sequence, active index, buffer size`
	// followed by one changelog per buffer slot plus the rightmost proof.
	let per_entry = TREE_PER_ENTRY_FIXED
		.checked_add(
			max_depth
				.checked_mul(32)
				.ok_or(ProgramError::InvalidAccountData)?,
		)
		.ok_or(ProgramError::InvalidAccountData)?;
	let entries = max_buffer
		.checked_add(1)
		.ok_or(ProgramError::InvalidAccountData)?;
	let entries_size = entries
		.checked_mul(per_entry)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let fixed = TREE_HEADER_SIZE
		.checked_add(TREE_REGION_FIXED)
		.and_then(|value| value.checked_add(entries_size))
		.ok_or(ProgramError::InvalidAccountData)?;
	let tail = data
		.len()
		.checked_sub(fixed)
		.ok_or(lootbox_error(LootboxError::InvalidPrize))?;
	if tail % 32 != 0 {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	// The canopy is a full binary tree without the root, so its node count is
	// always two below a power of two; a zero-length canopy caches nothing.
	let canopy_nodes = tail / 32;
	let canopy_depth = if canopy_nodes == 0 {
		0
	} else {
		let size = canopy_nodes
			.checked_add(2)
			.ok_or(ProgramError::InvalidAccountData)?;
		if size
			& size
				.checked_sub(1)
				.ok_or(ProgramError::InvalidAccountData)?
			!= 0
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		size.trailing_zeros()
			.checked_sub(1)
			.ok_or(ProgramError::InvalidAccountData)? as usize
	};

	if max_depth
		.checked_sub(canopy_depth)
		.is_none_or(|proofs| proofs > MAX_BUBBLEGUM_PROOF_ACCOUNTS)
	{
		return Err(lootbox_error(LootboxError::TreeNotClaimable));
	}

	Ok(())
}

pub(super) fn assert_claimable_tree(tree: &AccountView) -> ProgramResult {
	let data = tree.try_borrow()?;
	validate_claimable_tree_data(&data)
}

struct CoreTransfer<'a> {
	asset: &'a AccountView,
	collection: &'a AccountView,
	payer: &'a AccountView,
	authority: &'a AccountView,
	new_owner: &'a AccountView,
	core_program: &'a AccountView,
	system_program: &'a AccountView,
	log_wrapper: &'a AccountView,
}

fn invoke_core_transfer(
	accounts: &CoreTransfer<'_>,
	plugin_accounts: &[AccountView],
	signers: &[Signer<'_, '_>],
) -> ProgramResult {
	// Core transfer ABI pinned to upstream commit
	// 83131e07872b9e98dcdb6dde8ec53931813c0d20: discriminator [14], no
	// compression proof, and the seven fixed accounts followed by adapters.
	let mut metas = Vec::with_capacity(7 + plugin_accounts.len());
	metas.extend_from_slice(&[
		InstructionAccount::writable(accounts.asset.address()),
		InstructionAccount::readonly(accounts.collection.address()),
		InstructionAccount::writable_signer(accounts.payer.address()),
		InstructionAccount::readonly_signer(accounts.authority.address()),
		InstructionAccount::readonly(accounts.new_owner.address()),
		InstructionAccount::readonly(accounts.system_program.address()),
		InstructionAccount::readonly(accounts.log_wrapper.address()),
	]);

	for account in plugin_accounts {
		metas.push(InstructionAccount::new(
			account.address(),
			account.is_writable(),
			account.is_signer(),
		));
	}

	let mut views = Vec::with_capacity(7 + plugin_accounts.len());
	views.extend_from_slice(&[
		accounts.asset,
		accounts.collection,
		accounts.payer,
		accounts.authority,
		accounts.new_owner,
		accounts.system_program,
		accounts.log_wrapper,
	]);
	views.extend(plugin_accounts.iter());
	let instruction = InstructionView {
		program_id: accounts.core_program.address(),
		accounts: &metas,
		data: &[14, 0],
	};
	pinocchio::cpi::invoke_signed_with_slice(&instruction, &views, signers)
}

fn validate_core_accounts(
	asset: &AccountView,
	collection: &AccountView,
	plugin_accounts: &[AccountView],
	core_program: &AccountView,
	system_program: &AccountView,
	log_wrapper: &AccountView,
	bundle: &Address,
) -> ProgramResult {
	core_program.assert_program(&MPL_CORE_ID)?;
	asset.assert_owner(&MPL_CORE_ID)?;
	// Collections and plugins can add transfer delegates or external adapters
	// after escrow. Plain, uncollected Core assets have no such mutable
	// dependency and are the only admitted Core shape for now.
	collection.assert_address(&MPL_CORE_ID)?;

	if !plugin_accounts.is_empty() {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	system_program.assert_address(&system::ID)?;
	log_wrapper.assert_address(&SPL_NOOP_ID)?;

	let asset_data = asset.try_borrow()?;
	validate_core_asset_data(&asset_data, bundle)?;

	Ok(())
}

pub(super) struct CompressedTransfer<'a> {
	pub tree_config: &'a AccountView,
	pub owner: &'a AccountView,
	pub new_owner: &'a AccountView,
	pub merkle_tree: &'a AccountView,
	pub bubblegum_program: &'a AccountView,
	pub log_wrapper: &'a AccountView,
	pub compression_program: &'a AccountView,
	pub system_program: &'a AccountView,
}

pub(super) struct CompressedProof<'a> {
	pub root: &'a [u8; 32],
	pub data_hash: &'a [u8; 32],
	pub creator_hash: &'a [u8; 32],
	pub nonce: u64,
	pub index: u32,
}

/// Largest proof tail accepted without an address lookup table.
pub const MAX_BUBBLEGUM_PROOF_ACCOUNTS: usize = 16;

fn validate_bubblegum_proof_count(length: usize) -> ProgramResult {
	if length > MAX_BUBBLEGUM_PROOF_ACCOUNTS {
		return Err(ProgramError::InvalidArgument);
	}

	Ok(())
}

pub(super) fn invoke_compressed_transfer(
	accounts: &CompressedTransfer<'_>,
	proof_accounts: &[AccountView],
	proof: &CompressedProof<'_>,
	signers: &[Signer<'_, '_>],
) -> ProgramResult {
	validate_bubblegum_proof_count(proof_accounts.len())?;
	// Bubblegum transfer ABI pinned to upstream commit
	// f03717ae97c331e4bf4ae576793990c4e3436db1: discriminator and
	// root/data/creator hashes, nonce, index, then leaf-to-root proof accounts.
	let mut metas = Vec::with_capacity(8 + proof_accounts.len());
	metas.extend_from_slice(&[
		InstructionAccount::readonly(accounts.tree_config.address()),
		InstructionAccount::readonly_signer(accounts.owner.address()),
		InstructionAccount::readonly_signer(accounts.owner.address()),
		InstructionAccount::readonly(accounts.new_owner.address()),
		InstructionAccount::writable(accounts.merkle_tree.address()),
		InstructionAccount::readonly(accounts.log_wrapper.address()),
		InstructionAccount::readonly(accounts.compression_program.address()),
		InstructionAccount::readonly(accounts.system_program.address()),
	]);

	for proof in proof_accounts {
		metas.push(InstructionAccount::readonly(proof.address()));
	}

	let mut views = Vec::with_capacity(8 + proof_accounts.len());
	views.extend_from_slice(&[
		accounts.tree_config,
		accounts.owner,
		accounts.owner,
		accounts.new_owner,
		accounts.merkle_tree,
		accounts.log_wrapper,
		accounts.compression_program,
		accounts.system_program,
	]);
	views.extend(proof_accounts.iter());
	let mut data = [0u8; 116];
	data[..8].copy_from_slice(&[163, 52, 200, 231, 140, 3, 69, 186]);
	data[8..40].copy_from_slice(proof.root);
	data[40..72].copy_from_slice(proof.data_hash);
	data[72..104].copy_from_slice(proof.creator_hash);
	data[104..112].copy_from_slice(&proof.nonce.to_le_bytes());
	data[112..].copy_from_slice(&proof.index.to_le_bytes());
	let instruction = InstructionView {
		program_id: accounts.bubblegum_program.address(),
		accounts: &metas,
		data: &data,
	};
	pinocchio::cpi::invoke_signed_with_slice(&instruction, &views, signers)
}

pub(super) fn compressed_asset_id(tree: &Address, nonce: u64) -> Result<Address, ProgramError> {
	try_find_program_address(
		&[b"asset", tree.as_ref(), &nonce.to_le_bytes()],
		&MPL_BUBBLEGUM_ID,
	)
	.map(|(address, _)| address)
	.ok_or(ProgramError::InvalidSeeds)
}

pub(super) fn validate_compressed_accounts(accounts: &CompressedTransfer<'_>) -> ProgramResult {
	accounts
		.bubblegum_program
		.assert_program(&MPL_BUBBLEGUM_ID)?;
	accounts.log_wrapper.assert_address(&SPL_NOOP_ID)?;
	accounts
		.compression_program
		.assert_program(&SPL_ACCOUNT_COMPRESSION_ID)?;
	accounts.system_program.assert_address(&system::ID)?;

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for FundCoreAssetPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = FundCoreAssetPrizeInstruction::try_from_bytes(data)?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle_address = *self.bundle.address();
		validate_core_accounts(
			self.asset,
			self.collection,
			self.plugin_accounts,
			self.core_program,
			self.system_program,
			self.log_wrapper,
			&bundle_address,
		)?;

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;

		if bundle.status != BUNDLE_FUNDING || bundle.quantity.get() != 1 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		record_prize(&mut bundle, self.asset.address(), 1, PRIZE_CORE_ASSET, 0)?;
		drop(bundle);

		invoke_core_transfer(
			&CoreTransfer {
				asset: self.asset,
				collection: self.collection,
				payer: self.authority,
				authority: self.authority,
				new_owner: self.bundle,
				core_program: self.core_program,
				system_program: self.system_program,
				log_wrapper: self.log_wrapper,
			},
			self.plugin_accounts,
			&[],
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimCoreAssetPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimCoreAssetPrizeInstruction::try_from_bytes(data)?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle_address = *self.bundle.address();
		validate_core_accounts(
			self.asset,
			self.collection,
			self.plugin_accounts,
			self.core_program,
			self.system_program,
			self.log_wrapper,
			&bundle_address,
		)?;
		let opening_address = *self.opening.address();
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;

		assert_template_opening(&opening_address, &opening, self.template.address())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);

		if bundle.kinds.get(index) != Some(&PRIZE_CORE_ASSET)
			|| mint_at(&bundle, index)? != *self.asset.address()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		drop(opening);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		invoke_core_transfer(
			&CoreTransfer {
				asset: self.asset,
				collection: self.collection,
				payer: self.payer,
				authority: self.bundle,
				new_owner: self.recipient,
				core_program: self.core_program,
				system_program: self.system_program,
				log_wrapper: self.log_wrapper,
			},
			self.plugin_accounts,
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimCoreAssetPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimCoreAssetPrizeInstruction::try_from_bytes(data)?;
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle_address = *self.bundle.address();
		validate_core_accounts(
			self.asset,
			self.collection,
			self.plugin_accounts,
			self.core_program,
			self.system_program,
			self.log_wrapper,
			&bundle_address,
		)?;

		let supply = assert_template_mint(
			self.box_mint,
			self.template.address(),
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);

		if bundle.kinds.get(index) != Some(&PRIZE_CORE_ASSET)
			|| mint_at(&bundle, index)? != *self.asset.address()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		if reclaim_amount(
			state.status,
			state.pending_openings.get(),
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)? != 1
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		invoke_core_transfer(
			&CoreTransfer {
				asset: self.asset,
				collection: self.collection,
				payer: self.authority,
				authority: self.bundle,
				new_owner: self.authority,
				core_program: self.core_program,
				system_program: self.system_program,
				log_wrapper: self.log_wrapper,
			},
			self.plugin_accounts,
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for FundCompressedNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundCompressedNftPrizeInstruction::try_from_bytes(data)?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let asset = compressed_asset_id(self.merkle_tree.address(), args.nonce.get())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;

		if bundle.status != BUNDLE_FUNDING || bundle.quantity.get() != 1 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		record_prize(&mut bundle, &asset, 1, PRIZE_COMPRESSED_NFT, 0)?;
		drop(bundle);
		let context = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.authority,
			new_owner: self.bundle,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&context)?;
		assert_claimable_tree(self.merkle_tree)?;

		invoke_compressed_transfer(
			&context,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&[],
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimCompressedNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimCompressedNftPrizeInstruction::try_from_bytes(data)?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let asset = compressed_asset_id(self.merkle_tree.address(), args.nonce.get())?;
		let opening_address = *self.opening.address();
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&opening_address, &opening, self.template.address())?;

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);

		if bundle.kinds.get(index) != Some(&PRIZE_COMPRESSED_NFT)
			|| mint_at(&bundle, index)? != asset
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		drop(opening);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];
		let context = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.bundle,
			new_owner: self.recipient,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&context)?;

		invoke_compressed_transfer(
			&context,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimCompressedNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimCompressedNftPrizeInstruction::try_from_bytes(data)?;
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let supply = assert_template_mint(
			self.box_mint,
			self.template.address(),
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;
		let asset = compressed_asset_id(self.merkle_tree.address(), args.nonce.get())?;

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);

		if bundle.kinds.get(index) != Some(&PRIZE_COMPRESSED_NFT)
			|| mint_at(&bundle, index)? != asset
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		if reclaim_amount(
			state.status,
			state.pending_openings.get(),
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)? != 1
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];
		let context = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.bundle,
			new_owner: self.authority,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&context)?;

		invoke_compressed_transfer(
			&context,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&signers,
		)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn tree_account(max_depth: u32, max_buffer: u32, canopy_nodes: usize) -> Vec<u8> {
		let per_entry = TREE_PER_ENTRY_FIXED + 32 * max_depth as usize;
		let mut data = alloc::vec![0u8; TREE_HEADER_SIZE + TREE_REGION_FIXED
			+ (max_buffer as usize + 1) * per_entry
			+ canopy_nodes * 32];
		data[0] = TREE_ACCOUNT_TYPE;
		data[1] = TREE_VERSION_V1;
		data[2..6].copy_from_slice(&max_buffer.to_le_bytes());
		data[6..10].copy_from_slice(&max_depth.to_le_bytes());
		data
	}

	#[test]
	fn trees_with_claimable_proof_bounds_are_admitted() {
		// A depth-6 tree without any canopy never needs more than six proof
		// accounts, and a depth-26 tree with a ten-level canopy bottoms out at
		// exactly the sixteen-account cap.
		assert_eq!(
			validate_claimable_tree_data(&tree_account(6, 64, 0)),
			Ok(())
		);
		assert_eq!(
			validate_claimable_tree_data(&tree_account(26, 64, (1 << 11) - 2)),
			Ok(()),
		);
	}

	#[test]
	fn deep_thin_canopy_trees_are_rejected_at_admission() {
		// Twenty-six proof accounts can be forced by sibling churn, and the
		// claim would strand once the path exceeds the accepted tail.
		assert_eq!(
			validate_claimable_tree_data(&tree_account(26, 64, 0)),
			Err(lootbox_error(LootboxError::TreeNotClaimable)),
		);
		// A canopy that trims the path to seventeen accounts still misses.
		assert_eq!(
			validate_claimable_tree_data(&tree_account(26, 64, (1 << 10) - 2)),
			Err(lootbox_error(LootboxError::TreeNotClaimable)),
		);
	}

	#[test]
	fn malformed_tree_accounts_fail_closed() {
		let mut wrong_type = tree_account(6, 64, 0);
		wrong_type[0] = 0;
		assert_eq!(
			validate_claimable_tree_data(&wrong_type),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);

		let mut wrong_version = tree_account(6, 64, 0);
		wrong_version[1] = 2;
		assert_eq!(
			validate_claimable_tree_data(&wrong_version),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);

		// A trailing byte breaks the 32-byte node alignment of the canopy.
		let mut misaligned = tree_account(6, 64, 0);
		misaligned.push(0);
		assert_eq!(
			validate_claimable_tree_data(&misaligned),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);

		// A canopy whose node count is not two below a power of two cannot
		// exist on the real compression program.
		let mut bad_canopy = tree_account(6, 64, 3);
		bad_canopy[0] = TREE_ACCOUNT_TYPE;
		assert_eq!(
			validate_claimable_tree_data(&bad_canopy),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);

		// A header claiming more tree than the account holds.
		assert!(validate_claimable_tree_data(&tree_account(6, 64, 0)[..64]).is_err());
	}

	#[test]
	fn bubblegum_proof_tail_is_bounded_at_the_program_boundary() {
		assert_eq!(validate_bubblegum_proof_count(0), Ok(()));
		assert_eq!(validate_bubblegum_proof_count(16), Ok(()));
		assert_eq!(
			validate_bubblegum_proof_count(17),
			Err(ProgramError::InvalidArgument),
		);
	}

	fn core_asset(owner: &Address, bundle: &Address, seq: Option<u64>) -> Vec<u8> {
		let mut data = alloc::vec![CORE_ASSET_V1_KEY];
		data.extend_from_slice(owner.as_ref());
		data.push(CORE_UPDATE_AUTHORITY_ADDRESS_TAG);
		data.extend_from_slice(bundle.as_ref());

		for value in ["Prize", "https://example.com/prize.json"] {
			data.extend_from_slice(&(value.len() as u32).to_le_bytes());
			data.extend_from_slice(value.as_bytes());
		}

		match seq {
			Some(sequence) => {
				data.push(1);
				data.extend_from_slice(&sequence.to_le_bytes());
			}
			None => data.push(0),
		}

		data
	}

	#[test]
	fn plugin_free_core_assets_with_bundle_update_authority_are_admitted() {
		let owner = Address::new_from_array([3; 32]);
		let bundle = Address::new_from_array([4; 32]);

		for seq in [None, Some(7)] {
			assert_eq!(
				validate_core_asset_data(&core_asset(&owner, &bundle, seq), &bundle),
				Ok(()),
			);
		}
	}

	#[test]
	fn core_assets_with_permanent_delegate_plugins_are_rejected() {
		let owner = Address::new_from_array([3; 32]);
		let bundle = Address::new_from_array([4; 32]);
		let mut booby_trapped = core_asset(&owner, &bundle, None);
		// A plugin header (key 3) plus registry (key 4) appended after the base
		// serialization is exactly how Core stores PermanentTransferDelegate.
		booby_trapped.extend_from_slice(&[3, 0, 0, 0, 4, 1]);

		assert_eq!(
			validate_core_asset_data(&booby_trapped, &bundle),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);
	}

	#[test]
	fn core_assets_with_retained_creator_authorities_are_rejected() {
		let owner = Address::new_from_array([3; 32]);
		let bundle = Address::new_from_array([4; 32]);
		let creator = Address::new_from_array([5; 32]);

		assert_eq!(
			validate_core_asset_data(&core_asset(&owner, &creator, None), &bundle),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);

		// UpdateAuthority::None (tag 0) and ::Collection (tag 2) are equally
		// inadmissible: only the bundle PDA may hold plugin powers.
		for tag in [0u8, 2] {
			let mut unset = core_asset(&owner, &bundle, None);
			unset[CORE_UPDATE_AUTHORITY_OFFSET] = tag;
			assert_eq!(
				validate_core_asset_data(&unset, &bundle),
				Err(lootbox_error(LootboxError::InvalidPrize)),
			);
		}
	}

	#[test]
	fn core_assets_with_wrong_keys_or_corrupt_strings_are_rejected() {
		let owner = Address::new_from_array([3; 32]);
		let bundle = Address::new_from_array([4; 32]);

		let mut collection = core_asset(&owner, &bundle, None);
		collection[0] = 5; // Key::CollectionV1
		assert_eq!(
			validate_core_asset_data(&collection, &bundle),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);

		let mut lying_name = core_asset(&owner, &bundle, None);
		lying_name[66..70].copy_from_slice(&u32::MAX.to_le_bytes());
		assert!(validate_core_asset_data(&lying_name, &bundle).is_err());

		let mut lying_uri = core_asset(&owner, &bundle, None);
		let uri_length_offset = 66 + 4 + "Prize".len();
		lying_uri[uri_length_offset..uri_length_offset + 4]
			.copy_from_slice(&u32::MAX.to_le_bytes());
		assert!(validate_core_asset_data(&lying_uri, &bundle).is_err());

		let mut bad_seq = core_asset(&owner, &bundle, None);
		let seq_offset = bad_seq.len() - 1;
		bad_seq[seq_offset] = 2;
		assert!(validate_core_asset_data(&bad_seq, &bundle).is_err());

		let truncated = &core_asset(&owner, &bundle, None)[..40];
		assert!(validate_core_asset_data(truncated, &bundle).is_err());
	}
}
