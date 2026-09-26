//! Entropy-selected Bubblegum prize pools with exact asset commitments.

use alloc::vec::Vec as AllocVec;

use solana_keccak_hasher::hashv as keccak_hashv;

use super::collections::CompressedProof;
use super::collections::CompressedTransfer;
use super::collections::MPL_BUBBLEGUM_ID;
use super::collections::SPL_ACCOUNT_COMPRESSION_ID;
use super::collections::SPL_NOOP_ID;
use super::collections::compressed_asset_id;
use super::collections::invoke_compressed_transfer;
use super::collections::validate_compressed_accounts;
use super::*;

const PRIZE_POOL_MANIFEST_DOMAIN: &[u8] = b"pina-lootbox-prize-pool-manifest";
const PRIZE_POOL_COMMITMENT_DOMAIN: &[u8] = b"pina-lootbox-prize-pool-commitment";
const PRIZE_POOL_SELECTION_DOMAIN: &[u8] = b"pina-lootbox-prize-pool-selection";
const PRIZE_POOL_METADATA_DOMAIN: &[u8] = b"pina-lootbox-prize-pool-metadata";
const PRIZE_POOL_FUNDING: u8 = 0;
const PRIZE_POOL_SEALED: u8 = 1;
const PRIZE_POOL_ITEM_PREPARED: u8 = 0;
const PRIZE_POOL_ITEM_DEPOSITED: u8 = 1;
const MAX_BUBBLEGUM_NAME_BYTES: usize = 32;
const MAX_BUBBLEGUM_SYMBOL_BYTES: usize = 10;
const MAX_BUBBLEGUM_URI_BYTES: usize = 200;
const MAX_BUBBLEGUM_CREATORS: usize = 5;

#[instruction(discriminator = LootboxInstruction::CreatePrizePool, migrations)]
pub struct CreatePrizePoolInstruction {
	pub asset_index: u8,
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::DepositPrizePoolItem, migrations)]
pub struct DepositPrizePoolItemInstruction {
	pub root: [u8; 32],
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub index: u32,
}

#[instruction(discriminator = LootboxInstruction::PreparePrizePoolItem, migrations)]
pub struct PreparePrizePoolItemInstruction {
	pub item_bump: u8,
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub index: u32,
	/// Canonical Borsh serialization of Bubblegum V1 `MetadataArgs`.
	pub metadata: Vec<u8, 512>,
}

#[instruction(discriminator = LootboxInstruction::CancelPrizePoolItem, migrations)]
pub struct CancelPrizePoolItemInstruction {}

#[instruction(discriminator = LootboxInstruction::SealPrizePool, migrations)]
pub struct SealPrizePoolInstruction {}

#[instruction(discriminator = LootboxInstruction::AllocatePrizePoolOpen, migrations)]
pub struct AllocatePrizePoolOpenInstruction {
	pub result_receipt_bump: u8,
}

#[instruction(discriminator = LootboxInstruction::ClaimPrizePoolItem, migrations)]
pub struct ClaimPrizePoolItemInstruction {
	pub asset_index: u8,
	pub root: [u8; 32],
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub index: u32,
	/// Current canonical Bubblegum V1 `MetadataArgs` Borsh preimage.
	pub metadata: Vec<u8, 512>,
}

#[instruction(discriminator = LootboxInstruction::ReclaimPrizePoolItem, migrations)]
pub struct ReclaimPrizePoolItemInstruction {
	pub pool_index: u32,
	pub root: [u8; 32],
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub index: u32,
	/// Current canonical Bubblegum V1 `MetadataArgs` Borsh preimage.
	pub metadata: Vec<u8, 512>,
}

#[instruction(discriminator = LootboxInstruction::ClosePrizePool, migrations)]
pub struct ClosePrizePoolInstruction {}

#[derive(Accounts, Debug)]
pub struct CreatePrizePoolAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	#[pina(validate(empty))]
	pub prize_pool: &'a mut AccountView,
	pub merkle_tree: &'a AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct DepositPrizePoolItemAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a AccountView,
	pub prize_pool: &'a mut AccountView,
	pub prize_pool_item: &'a mut AccountView,
	pub tree_config: &'a AccountView,
	pub merkle_tree: &'a mut AccountView,
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	#[pina(validate(address = SPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	#[pina(validate(address = SPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in leaf-to-root order.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct PreparePrizePoolItemAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a AccountView,
	pub prize_pool: &'a mut AccountView,
	#[pina(validate(empty))]
	pub prize_pool_item: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct CancelPrizePoolItemAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a AccountView,
	pub prize_pool: &'a mut AccountView,
	pub prize_pool_item: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct SealPrizePoolAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub prize_pool: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct AllocatePrizePoolOpenAccounts<'a> {
	pub template: &'a mut AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a AccountView,
	pub prize_pool: &'a mut AccountView,
	/// Creator-funded when permanent result receipts are enabled.
	pub service_vault: &'a mut AccountView,
	/// Created only when enabled in the locked treasury configuration.
	#[pina(validate(empty))]
	pub result_receipt: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct ClaimPrizePoolItemAccounts<'a> {
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub prize_pool: &'a mut AccountView,
	pub prize_pool_item: &'a mut AccountView,
	pub recipient: &'a AccountView,
	/// Receives the closed per-item PDA rent; fixed to the pool creator.
	pub rent_refund: &'a mut AccountView,
	pub tree_config: &'a AccountView,
	pub merkle_tree: &'a mut AccountView,
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	#[pina(validate(address = SPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	#[pina(validate(address = SPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in leaf-to-root order.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ReclaimPrizePoolItemAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub prize_pool: &'a mut AccountView,
	pub prize_pool_item: &'a mut AccountView,
	pub tree_config: &'a AccountView,
	pub merkle_tree: &'a mut AccountView,
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	#[pina(validate(address = SPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	#[pina(validate(address = SPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in leaf-to-root order.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ClosePrizePoolAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub prize_pool: &'a mut AccountView,
}

fn assert_prize_pool(
	account: &AccountView,
	pool: &PrizePoolStateRef<'_>,
	bundle: &Address,
) -> ProgramResult {
	if pool.bundle != *bundle {
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	let seeds = PrizePoolState::seeds(bundle, pool.asset_index).with_bump(pool.bump);
	if *account.address() != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	Ok(())
}

fn assert_pool_item(
	account: &AccountView,
	item: &PrizePoolItemStateZc,
	pool: &Address,
	pool_index: u32,
) -> ProgramResult {
	if item.pool != *pool || item.pool_index.get() != pool_index {
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	let seeds = PrizePoolItemState::seeds(pool, pool_index).with_bump(item.bump);
	if *account.address() != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	Ok(())
}

fn bitmap_is_set(bitmap: &[u8], index: usize) -> Result<bool, ProgramError> {
	let byte = bitmap
		.get(index / 8)
		.ok_or_else(|| lootbox_error(LootboxError::InvalidPrizePool))?;
	Ok(byte & (1 << (index % 8)) != 0)
}

fn set_bitmap(bitmap: &mut [u8], index: usize) -> ProgramResult {
	let byte = bitmap
		.get_mut(index / 8)
		.ok_or_else(|| lootbox_error(LootboxError::InvalidPrizePool))?;
	let bit = 1 << (index % 8);
	if *byte & bit != 0 {
		return Err(lootbox_error(LootboxError::PrizePoolItemUnavailable));
	}
	*byte |= bit;

	Ok(())
}

struct MetadataCursor<'a> {
	bytes: &'a [u8],
	offset: usize,
}

impl<'a> MetadataCursor<'a> {
	fn new(bytes: &'a [u8]) -> Self {
		Self { bytes, offset: 0 }
	}

	fn take(&mut self, length: usize) -> Result<&'a [u8], ProgramError> {
		let end = self
			.offset
			.checked_add(length)
			.ok_or_else(invalid_prize_pool_metadata)?;
		let value = self
			.bytes
			.get(self.offset..end)
			.ok_or_else(invalid_prize_pool_metadata)?;
		self.offset = end;
		Ok(value)
	}

	fn byte(&mut self) -> Result<u8, ProgramError> {
		self.take(1)?
			.first()
			.copied()
			.ok_or_else(invalid_prize_pool_metadata)
	}

	fn boolean(&mut self) -> Result<bool, ProgramError> {
		match self.byte()? {
			0 => Ok(false),
			1 => Ok(true),
			_ => Err(invalid_prize_pool_metadata()),
		}
	}

	fn u16(&mut self) -> Result<u16, ProgramError> {
		let value: [u8; 2] = self
			.take(2)?
			.try_into()
			.map_err(|_| invalid_prize_pool_metadata())?;
		Ok(u16::from_le_bytes(value))
	}

	fn u32(&mut self) -> Result<u32, ProgramError> {
		let value: [u8; 4] = self
			.take(4)?
			.try_into()
			.map_err(|_| invalid_prize_pool_metadata())?;
		Ok(u32::from_le_bytes(value))
	}

	fn string(&mut self, max_bytes: usize) -> ProgramResult {
		let length = usize::try_from(self.u32()?).map_err(|_| invalid_prize_pool_metadata())?;
		if length > max_bytes {
			return Err(invalid_prize_pool_metadata());
		}
		core::str::from_utf8(self.take(length)?)
			.map(|_| ())
			.map_err(|_| invalid_prize_pool_metadata())
	}

	fn option_tag(&mut self) -> Result<bool, ProgramError> {
		match self.byte()? {
			0 => Ok(false),
			1 => Ok(true),
			_ => Err(invalid_prize_pool_metadata()),
		}
	}

	fn enum_byte(&mut self, variants: u8) -> ProgramResult {
		if self.byte()? < variants {
			Ok(())
		} else {
			Err(invalid_prize_pool_metadata())
		}
	}
}

fn invalid_prize_pool_metadata() -> ProgramError {
	lootbox_error(LootboxError::InvalidPrizePoolMetadata)
}

#[derive(Debug, PartialEq, Eq)]
struct MetadataIdentity {
	semantic_hash: [u8; 32],
}

/// Validate a canonical Bubblegum V1 metadata preimage and derive an identity
/// commitment that masks only collection/creator verification flags. Bubblegum
/// permits those flags to change without leaf-owner consent; collection keys,
/// creator addresses/shares, and every other field remain committed.
fn metadata_identity(
	metadata: &[u8],
	data_hash: &[u8; 32],
	creator_hash: &[u8; 32],
) -> Result<MetadataIdentity, ProgramError> {
	let mut cursor = MetadataCursor::new(metadata);
	let mut verification_offsets = AllocVec::new();
	cursor.string(MAX_BUBBLEGUM_NAME_BYTES)?;
	cursor.string(MAX_BUBBLEGUM_SYMBOL_BYTES)?;
	cursor.string(MAX_BUBBLEGUM_URI_BYTES)?;
	let seller_fee_basis_points = cursor.u16()?;
	if seller_fee_basis_points > 10_000 {
		return Err(invalid_prize_pool_metadata());
	}
	cursor.boolean()?; // primary_sale_happened
	let is_mutable = cursor.boolean()?;
	if cursor.option_tag()? {
		cursor.byte()?; // edition_nonce
	}
	if cursor.option_tag()? {
		cursor.enum_byte(4)?; // TokenStandard
	}
	if cursor.option_tag()? {
		verification_offsets.push(cursor.offset);
		cursor.boolean()?;
		cursor.take(32)?; // Collection key
	}
	if cursor.option_tag()? {
		cursor.enum_byte(3)?; // UseMethod
		cursor.take(16)?; // remaining + total
	}
	cursor.enum_byte(2)?; // TokenProgramVersion
	let creator_count =
		usize::try_from(cursor.u32()?).map_err(|_| invalid_prize_pool_metadata())?;
	if creator_count > MAX_BUBBLEGUM_CREATORS {
		return Err(invalid_prize_pool_metadata());
	}
	let creator_start = cursor.offset;
	for _ in 0..creator_count {
		cursor.take(32)?;
		verification_offsets.push(cursor.offset);
		cursor.boolean()?;
		cursor.byte()?;
	}
	let creator_end = cursor.offset;
	if cursor.offset != metadata.len() {
		return Err(invalid_prize_pool_metadata());
	}

	let inner = keccak_hashv(&[metadata]);
	let computed_data_hash =
		keccak_hashv(&[inner.as_ref(), &seller_fee_basis_points.to_le_bytes()]);
	let computed_creator_hash = keccak_hashv(&[&metadata[creator_start..creator_end]]);
	if computed_data_hash.as_ref() != data_hash || computed_creator_hash.as_ref() != creator_hash {
		return Err(invalid_prize_pool_metadata());
	}
	if is_mutable {
		return Err(lootbox_error(LootboxError::MutablePrizePoolItem));
	}

	let mut normalized = AllocVec::with_capacity(metadata.len());
	normalized.extend_from_slice(metadata);
	for offset in verification_offsets {
		*normalized
			.get_mut(offset)
			.ok_or_else(invalid_prize_pool_metadata)? = 0;
	}
	Ok(MetadataIdentity {
		semantic_hash: hashv(&[PRIZE_POOL_METADATA_DOMAIN, &normalized]).to_bytes(),
	})
}

struct PoolManifestItem<'a> {
	pool_index: u32,
	asset: &'a Address,
	data_hash: &'a [u8; 32],
	creator_hash: &'a [u8; 32],
	semantic_metadata_hash: &'a [u8; 32],
	nonce: u64,
	index: u32,
}

fn next_pool_manifest(
	previous: &[u8; 32],
	pool: &Address,
	item: &PoolManifestItem<'_>,
) -> [u8; 32] {
	let digest = hashv(&[
		PRIZE_POOL_MANIFEST_DOMAIN,
		previous,
		pool.as_ref(),
		&item.pool_index.to_le_bytes(),
		item.asset.as_ref(),
		item.data_hash,
		item.creator_hash,
		item.semantic_metadata_hash,
		&item.nonce.to_le_bytes(),
		&item.index.to_le_bytes(),
	]);
	let mut result = [0; 32];
	result.copy_from_slice(digest.as_ref());
	result
}

fn sealed_pool_commitment(
	pool: &Address,
	tree: &Address,
	manifest_accumulator: &[u8; 32],
	quantity: u64,
	asset_index: u8,
	version: u64,
) -> [u8; 32] {
	let digest = hashv(&[
		PRIZE_POOL_COMMITMENT_DOMAIN,
		pool.as_ref(),
		tree.as_ref(),
		manifest_accumulator,
		&quantity.to_le_bytes(),
		core::slice::from_ref(&asset_index),
		&version.to_le_bytes(),
	]);
	let mut result = [0; 32];
	result.copy_from_slice(digest.as_ref());
	result
}

fn assert_pool_commitment(
	bundle: &BundleStateZc,
	pool_address: &Address,
	pool: &PrizePoolStateRef<'_>,
) -> ProgramResult {
	let index = usize::from(pool.asset_index);
	let stored = bundle
		.commitments
		.get(index * 32..(index + 1) * 32)
		.ok_or(ProgramError::InvalidAccountData)?;
	let expected = sealed_pool_commitment(
		pool_address,
		&pool.tree,
		&pool.manifest_accumulator,
		pool.quantity.get(),
		pool.asset_index,
		pool.version.get(),
	);
	if stored != expected {
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	Ok(())
}

fn assert_item_identity(
	item: &PrizePoolItemStateZc,
	tree: &Address,
	data_hash: &[u8; 32],
	creator_hash: &[u8; 32],
	metadata: &[u8],
	nonce: u64,
	index: u32,
) -> ProgramResult {
	let metadata = metadata_identity(metadata, data_hash, creator_hash)?;
	if item.asset != compressed_asset_id(tree, nonce)?
		|| item.nonce.get() != nonce
		|| item.tree_index.get() != index
		|| item.semantic_metadata_hash != metadata.semantic_hash
		|| item.status != PRIZE_POOL_ITEM_DEPOSITED
	{
		return Err(lootbox_error(LootboxError::PrizePoolItemMismatch));
	}

	Ok(())
}

pub(super) fn reserve_prize_pool_slot(bundle: &mut BundleStateZc, pool: &Address) -> ProgramResult {
	let index = usize::from(bundle.funded_assets);
	if index >= usize::from(bundle.asset_count)
		|| bundle.kinds[index] != 0
		|| mint_at(bundle, index)? != Address::default()
		|| bundle.commitments[index * 32..(index + 1) * 32] != [0; 32]
		|| read_slot(&bundle.amounts, index)? != 0
		|| bundle.decimals[index] != 0
		|| pool_asset_index(bundle)?.is_some()
	{
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	bundle.mints[index * 32..(index + 1) * 32].copy_from_slice(pool.as_ref());
	write_slot(&mut bundle.amounts, index, 1)?;
	bundle.kinds[index] = PRIZE_POOL;

	Ok(())
}

fn clear_prize_pool_slot(
	bundle: &mut BundleStateZc,
	asset_index: u8,
	pool: &Address,
) -> ProgramResult {
	let index = usize::from(asset_index);
	if bundle.kinds.get(index) != Some(&PRIZE_POOL)
		|| mint_at(bundle, index)? != *pool
		|| read_slot(&bundle.amounts, index)? != 1
		|| bundle.decimals.get(index) != Some(&0)
	{
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	bundle.mints[index * 32..(index + 1) * 32].fill(0);
	bundle.commitments[index * 32..(index + 1) * 32].fill(0);
	write_slot(&mut bundle.amounts, index, 0)?;
	bundle.kinds[index] = 0;

	Ok(())
}

fn update_pool(account: &mut AccountView, patch: &PrizePoolStatePatch<'_>) -> ProgramResult {
	account.assert_owner(&ID)?;
	let mut data = account.try_borrow_mut()?;
	let encoded = PrizePoolState::update(&mut data, patch)?;
	if encoded != data.len() {
		return Err(ProgramError::InvalidAccountData);
	}

	Ok(())
}

fn pool_asset_index(bundle: &BundleStateZc) -> Result<Option<u8>, ProgramError> {
	let mut found = None;
	for (index, kind) in bundle
		.kinds
		.iter()
		.enumerate()
		.take(usize::from(bundle.asset_count))
	{
		if *kind == PRIZE_POOL {
			if found.is_some() {
				return Err(lootbox_error(LootboxError::InvalidPrizePool));
			}
			found = Some(u8::try_from(index).map_err(|_| ProgramError::InvalidAccountData)?);
		}
	}
	Ok(found)
}

fn select_pool_target(
	entropy: &[u8; 32],
	pool: &Address,
	opening: &Address,
	available: u64,
) -> Result<u64, ProgramError> {
	if available == 0 || available > MAX_PRIZE_POOL_ITEMS as u64 {
		return Err(lootbox_error(LootboxError::PrizePoolItemUnavailable));
	}
	for counter in 0u8..8 {
		let counter_bytes = [counter];
		let hash = hashv(&[
			PRIZE_POOL_SELECTION_DOMAIN,
			entropy,
			pool.as_ref(),
			opening.as_ref(),
			&counter_bytes,
		]);

		if let Some(target) = accept_uniform_candidate(digest_candidate(hash.as_ref()), available) {
			return Ok(target);
		}
	}
	Err(lootbox_error(LootboxError::EntropyRejectionExhausted))
}

fn item_for_rank(bitmap: &[u8], quantity: usize, rank: u64) -> Result<u32, ProgramError> {
	let mut seen = 0u64;
	for index in 0..quantity {
		if !bitmap_is_set(bitmap, index)? {
			if seen == rank {
				return u32::try_from(index).map_err(|_| ProgramError::InvalidAccountData);
			}
			seen = seen
				.checked_add(1)
				.ok_or(ProgramError::ArithmeticOverflow)?;
		}
	}
	Err(lootbox_error(LootboxError::PrizePoolItemUnavailable))
}

#[allow(clippy::too_many_arguments)]
fn active_pool_is_terminal(
	pool_status: u8,
	bundle_status: u8,
	template_status: u8,
	pending_openings: u64,
	remaining: u64,
	assigned_count: u32,
	claimed_count: u32,
	reclaimed_count: u32,
	quantity: u64,
	released: u64,
) -> Result<bool, ProgramError> {
	let accounted = u64::from(assigned_count)
		.checked_add(u64::from(reclaimed_count))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	Ok(pool_status == PRIZE_POOL_SEALED
		&& bundle_status == BUNDLE_ACTIVE
		&& template_status == TEMPLATE_RETIRED
		&& pending_openings == 0
		&& remaining == u64::from(reclaimed_count)
		&& claimed_count == assigned_count
		&& accounted == quantity
		&& released == quantity)
}

pub(super) fn reserve_prize_pool_item(
	pool_account: Option<&mut AccountView>,
	bundle: &BundleStateZc,
	bundle_address: &Address,
	opening: &mut TemplateOpeningStateZc,
	opening_address: &Address,
	selected_remaining: u64,
) -> ProgramResult {
	let Some(asset_index) = pool_asset_index(bundle)? else {
		if pool_account.is_some() {
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		return Ok(());
	};
	let pool_account = pool_account.ok_or_else(|| lootbox_error(LootboxError::InvalidPrizePool))?;
	let pool_address = *pool_account.address();
	if mint_at(bundle, usize::from(asset_index))? != pool_address
		|| read_slot(&bundle.amounts, usize::from(asset_index))? != 1
	{
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	let pool_data = pool_account.try_borrow()?;
	let pool = PrizePoolState::try_from_bytes(&pool_data)?;
	assert_prize_pool(pool_account, &pool, bundle_address)?;
	if pool.status != PRIZE_POOL_SEALED
		|| pool.asset_index != asset_index
		|| pool.quantity.get() != bundle.quantity.get()
	{
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	assert_pool_commitment(bundle, &pool_address, &pool)?;
	let unavailable = u64::from(pool.assigned_count.get())
		.checked_add(u64::from(pool.reclaimed_count.get()))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let available = pool
		.quantity
		.get()
		.checked_sub(unavailable)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if available != selected_remaining {
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	let target = select_pool_target(&opening.entropy, &pool_address, opening_address, available)?;
	let quantity =
		usize::try_from(pool.quantity.get()).map_err(|_| ProgramError::InvalidAccountData)?;
	let selected = item_for_rank(pool.unavailable(), quantity, target)?;
	let mut bitmap = AllocVec::with_capacity(pool.unavailable().len());
	bitmap.extend_from_slice(pool.unavailable());
	set_bitmap(
		&mut bitmap,
		usize::try_from(selected).map_err(|_| ProgramError::InvalidAccountData)?,
	)?;
	let assigned_count = pool
		.assigned_count
		.get()
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	drop(pool_data);

	update_pool(
		pool_account,
		&PrizePoolStatePatch::new()
			.assigned_count(assigned_count)
			.replace_unavailable(&bitmap),
	)?;
	opening.selected_pool_item.set(selected);
	opening.selected_pool_asset = asset_index;
	opening.has_pool_assignment.set(true);

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for CreatePrizePoolAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = CreatePrizePoolInstruction::try_from_bytes(data)?;
		let template = as_template(self.template)?;
		assert_template(self.template.address(), &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_editable(&template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let quantity = usize::try_from(bundle.quantity.get())
			.map_err(|_| lootbox_error(LootboxError::InvalidPrizePool))?;
		if bundle.status != BUNDLE_FUNDING
			|| args.asset_index != bundle.funded_assets
			|| args.asset_index >= bundle.asset_count
			|| quantity == 0
			|| quantity > MAX_PRIZE_POOL_ITEMS
			|| *self.merkle_tree.address() == Address::default()
		{
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		let bundle_address = *self.bundle.address();
		let quantity = bundle.quantity.get();
		drop(bundle);

		let seeds = PrizePoolState::seeds(&bundle_address, args.asset_index);
		if self
			.prize_pool
			.assert_canonical_bump(&seeds.as_slices(), &ID)?
			!= args.bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		CreateCompactProgramAccountWithBump {
			account: self.prize_pool,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
			patch: PrizePoolStatePatch::new()
				.authority(*self.authority.address())
				.bundle(bundle_address)
				.tree(*self.merkle_tree.address())
				.quantity(quantity)
				.asset_index(args.asset_index)
				.status(PRIZE_POOL_FUNDING)
				.bump(args.bump),
			space: PrizePoolState::MIN_SIZE,
		}
		.invoke::<PrizePoolState>()?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		reserve_prize_pool_slot(&mut bundle, self.prize_pool.address())?;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for PreparePrizePoolItemAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = PreparePrizePoolItemInstruction::try_from_bytes(data)?;
		let template = as_template(self.template)?;
		assert_template(self.template.address(), &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_editable(&template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let bundle_address = *self.bundle.address();
		if bundle.status != BUNDLE_FUNDING
			|| bundle.funded_assets >= bundle.asset_count
			|| bundle.kinds.get(usize::from(bundle.funded_assets)) != Some(&PRIZE_POOL)
			|| mint_at(&bundle, usize::from(bundle.funded_assets))? != *self.prize_pool.address()
		{
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		drop(bundle);

		let metadata = metadata_identity(
			args.metadata.as_slice(),
			&args.data_hash,
			&args.creator_hash,
		)?;
		let pool_address = *self.prize_pool.address();
		let pool_data = self.prize_pool.try_borrow()?;
		let pool = PrizePoolState::try_from_bytes(&pool_data)?;
		assert_prize_pool(self.prize_pool, &pool, &bundle_address)?;
		if pool.status != PRIZE_POOL_FUNDING
			|| pool.has_prepared_item.get()
			|| u64::from(pool.deposit_cursor.get()) >= pool.quantity.get()
		{
			return Err(lootbox_error(LootboxError::PrizePoolFull));
		}
		let pool_index = pool.deposit_cursor.get();
		let tree = pool.tree;
		drop(pool_data);

		let item_seeds = PrizePoolItemState::seeds(&pool_address, pool_index);
		if self
			.prize_pool_item
			.assert_canonical_bump(&item_seeds.as_slices(), &ID)?
			!= args.item_bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		CreateProgramAccountWithBump {
			account: self.prize_pool_item,
			payer: self.authority,
			owner: &ID,
			seeds: &item_seeds.as_slices(),
			bump: args.item_bump,
		}
		.invoke::<PrizePoolItemState>()?;
		let mut item = self
			.prize_pool_item
			.as_account_mut::<PrizePoolItemState>(&ID)?;
		item.pool = pool_address;
		item.asset = compressed_asset_id(&tree, args.nonce.get())?;
		item.data_hash = args.data_hash;
		item.creator_hash = args.creator_hash;
		item.semantic_metadata_hash = metadata.semantic_hash;
		item.nonce.set(args.nonce.get());
		item.tree_index.set(args.index.get());
		item.pool_index.set(pool_index);
		item.status = PRIZE_POOL_ITEM_PREPARED;
		item.bump = args.item_bump;
		drop(item);
		update_pool(
			self.prize_pool,
			&PrizePoolStatePatch::new().has_prepared_item(true),
		)?;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for CancelPrizePoolItemAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = CancelPrizePoolItemInstruction::try_from_bytes(data)?;
		let template = as_template(self.template)?;
		assert_template(self.template.address(), &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_unlocked(&template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let bundle_address = *self.bundle.address();
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		drop(bundle);

		let pool_address = *self.prize_pool.address();
		let pool_data = self.prize_pool.try_borrow()?;
		let pool = PrizePoolState::try_from_bytes(&pool_data)?;
		assert_prize_pool(self.prize_pool, &pool, &bundle_address)?;
		if pool.status != PRIZE_POOL_FUNDING || !pool.has_prepared_item.get() {
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		let pool_index = pool.deposit_cursor.get();
		drop(pool_data);

		let item = self.prize_pool_item.as_account::<PrizePoolItemState>(&ID)?;
		assert_pool_item(self.prize_pool_item, &item, &pool_address, pool_index)?;
		if item.status != PRIZE_POOL_ITEM_PREPARED {
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		drop(item);
		update_pool(
			self.prize_pool,
			&PrizePoolStatePatch::new().has_prepared_item(false),
		)?;
		self.prize_pool_item
			.close_account_zeroed(&ID, self.authority)
	}
}

impl<'a> ProcessAccountInfos<'a> for DepositPrizePoolItemAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = DepositPrizePoolItemInstruction::try_from_bytes(data)?;
		let template = as_template(self.template)?;
		assert_template(self.template.address(), &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_editable(&template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let bundle_address = *self.bundle.address();
		if bundle.status != BUNDLE_FUNDING
			|| bundle.funded_assets >= bundle.asset_count
			|| bundle.kinds.get(usize::from(bundle.funded_assets)) != Some(&PRIZE_POOL)
			|| mint_at(&bundle, usize::from(bundle.funded_assets))? != *self.prize_pool.address()
		{
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		drop(bundle);

		let pool_address = *self.prize_pool.address();
		let pool_data = self.prize_pool.try_borrow()?;
		let pool = PrizePoolState::try_from_bytes(&pool_data)?;
		assert_prize_pool(self.prize_pool, &pool, &bundle_address)?;
		if pool.status != PRIZE_POOL_FUNDING
			|| !pool.has_prepared_item.get()
			|| u64::from(pool.deposit_cursor.get()) >= pool.quantity.get()
			|| pool.tree != *self.merkle_tree.address()
		{
			return Err(lootbox_error(LootboxError::PrizePoolFull));
		}
		let pool_index = pool.deposit_cursor.get();
		let previous_manifest = pool.manifest_accumulator;
		let mut bitmap = AllocVec::with_capacity(pool.unavailable().len() + 1);
		bitmap.extend_from_slice(pool.unavailable());
		if usize::try_from(pool_index).map_err(|_| ProgramError::InvalidAccountData)? % 8 == 0 {
			bitmap.push(0);
		}
		drop(pool_data);

		let item = self.prize_pool_item.as_account::<PrizePoolItemState>(&ID)?;
		assert_pool_item(self.prize_pool_item, &item, &pool_address, pool_index)?;
		let asset = compressed_asset_id(self.merkle_tree.address(), args.nonce.get())?;
		if item.status != PRIZE_POOL_ITEM_PREPARED
			|| item.asset != asset
			|| item.data_hash != args.data_hash
			|| item.creator_hash != args.creator_hash
			|| item.nonce.get() != args.nonce.get()
			|| item.tree_index.get() != args.index.get()
		{
			return Err(lootbox_error(LootboxError::PrizePoolItemMismatch));
		}
		let semantic_metadata_hash = item.semantic_metadata_hash;
		drop(item);
		let next_manifest = next_pool_manifest(
			&previous_manifest,
			&pool_address,
			&PoolManifestItem {
				pool_index,
				asset: &asset,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				semantic_metadata_hash: &semantic_metadata_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
		);

		let transfer = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.authority,
			new_owner: self.prize_pool,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&transfer)?;
		invoke_compressed_transfer(
			&transfer,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&[],
		)?;

		let mut item = self
			.prize_pool_item
			.as_account_mut::<PrizePoolItemState>(&ID)?;
		item.previous_manifest_accumulator = previous_manifest;
		item.status = PRIZE_POOL_ITEM_DEPOSITED;
		drop(item);

		UpdateResizableAccount {
			account: self.prize_pool,
			rent_account: self.authority,
			program_id: &ID,
			patch: PrizePoolStatePatch::new()
				.deposit_cursor(pool_index + 1)
				.manifest_accumulator(next_manifest)
				.has_prepared_item(false)
				.replace_unavailable(&bitmap),
		}
		.invoke::<PrizePoolState>()?;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for SealPrizePoolAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = SealPrizePoolInstruction::try_from_bytes(data)?;
		let template = as_template(self.template)?;
		assert_template(self.template.address(), &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_editable(&template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle_address = *self.bundle.address();
		let pool_data = self.prize_pool.try_borrow()?;
		let pool = PrizePoolState::try_from_bytes(&pool_data)?;
		assert_prize_pool(self.prize_pool, &pool, &bundle_address)?;
		if pool.status != PRIZE_POOL_FUNDING
			|| pool.has_prepared_item.get()
			|| u64::from(pool.deposit_cursor.get()) != pool.quantity.get()
		{
			return Err(lootbox_error(LootboxError::PrizePoolIncomplete));
		}
		let asset_index = pool.asset_index;
		let tree = pool.tree;
		let manifest_accumulator = pool.manifest_accumulator;
		let quantity = pool.quantity.get();
		let version = pool
			.version
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		drop(pool_data);

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(asset_index);
		if bundle.status != BUNDLE_FUNDING
			|| bundle.funded_assets != asset_index
			|| bundle.kinds.get(index) != Some(&PRIZE_POOL)
			|| mint_at(&bundle, index)? != *self.prize_pool.address()
			|| bundle.commitments[index * 32..(index + 1) * 32] != [0; 32]
			|| read_slot(&bundle.amounts, index)? != 1
			|| bundle.decimals.get(index) != Some(&0)
		{
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		bundle.funded_assets = bundle
			.funded_assets
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let commitment = sealed_pool_commitment(
			self.prize_pool.address(),
			&tree,
			&manifest_accumulator,
			quantity,
			asset_index,
			version,
		);
		bundle.commitments[index * 32..(index + 1) * 32].copy_from_slice(&commitment);
		drop(bundle);
		update_pool(
			self.prize_pool,
			&PrizePoolStatePatch::new()
				.status(PRIZE_POOL_SEALED)
				.version(version),
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for AllocatePrizePoolOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AllocatePrizePoolOpenInstruction::try_from_bytes(data)?;
		let opening = self.opening.as_account::<TemplateOpeningState>(&ID)?;
		let receipt_seeds =
			ResultReceiptState::seeds(self.opening.address(), opening.sequence.get());
		drop(opening);
		if self
			.result_receipt
			.assert_canonical_bump(&receipt_seeds.as_slices(), &ID)?
			!= args.result_receipt_bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		TemplateAllocationAccounts {
			template: self.template,
			opening: self.opening,
			bundle: self.bundle,
			service_vault: self.service_vault,
			result_receipt: self.result_receipt,
		}
		.process(args.result_receipt_bump, Some(self.prize_pool))
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimPrizePoolItemAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimPrizePoolItemInstruction::try_from_bytes(data)?;
		let template = as_template(self.template)?;
		assert_template(self.template.address(), &template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let opening_address = *self.opening.address();
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&opening_address, &opening, self.template.address())?;
		if !opening.has_pool_assignment.get()
			|| opening.selected_pool_asset != args.asset_index
			|| opening.beneficiary != *self.recipient.address()
		{
			return Err(lootbox_error(LootboxError::InvalidRecipient));
		}
		let pool_index = opening.selected_pool_item.get();
		let pool_address = *self.prize_pool.address();
		let pool_data = self.prize_pool.try_borrow()?;
		let pool = PrizePoolState::try_from_bytes(&pool_data)?;
		assert_prize_pool(self.prize_pool, &pool, self.bundle.address())?;
		if pool.status != PRIZE_POOL_SEALED
			|| pool.asset_index != args.asset_index
			|| pool.tree != *self.merkle_tree.address()
			|| pool.authority != *self.rent_refund.address()
			|| pool.claimed_count.get() >= pool.assigned_count.get()
			|| !bitmap_is_set(
				pool.unavailable(),
				usize::try_from(pool_index).map_err(|_| ProgramError::InvalidAccountData)?,
			)? {
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		let claimed_count = pool
			.claimed_count
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let pool_bump = pool.bump;
		let pool_bundle = pool.bundle;
		let pool_asset_index = pool.asset_index;
		let pool_quantity = pool.quantity.get();
		let pool_commitment = sealed_pool_commitment(
			&pool_address,
			&pool.tree,
			&pool.manifest_accumulator,
			pool_quantity,
			pool_asset_index,
			pool.version.get(),
		);
		drop(pool_data);

		let item = self.prize_pool_item.as_account::<PrizePoolItemState>(&ID)?;
		assert_pool_item(self.prize_pool_item, &item, &pool_address, pool_index)?;
		assert_item_identity(
			&item,
			self.merkle_tree.address(),
			&args.data_hash,
			&args.creator_hash,
			args.metadata.as_slice(),
			args.nonce.get(),
			args.index.get(),
		)?;
		drop(item);

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_POOL)
			|| mint_at(&bundle, index)? != pool_address
			|| bundle.quantity.get() != pool_quantity
			|| bundle.commitments[index * 32..(index + 1) * 32] != pool_commitment
		{
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		drop(bundle);
		drop(opening);
		update_pool(
			self.prize_pool,
			&PrizePoolStatePatch::new().claimed_count(claimed_count),
		)?;

		let pool_bump = [pool_bump];
		let pool_signer = PdaSigner::from_slices([
			SEED_PRIZE_POOL,
			pool_bundle.as_ref(),
			core::slice::from_ref(&pool_asset_index),
			pool_bump.as_slice(),
		]);
		let transfer = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.prize_pool,
			new_owner: self.recipient,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&transfer)?;
		invoke_compressed_transfer(
			&transfer,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&[pool_signer.as_signer()],
		)?;

		self.prize_pool_item
			.close_account_zeroed(&ID, self.rent_refund)
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimPrizePoolItemAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimPrizePoolItemInstruction::try_from_bytes(data)?;
		let template_data = self.template.try_borrow()?;
		let template = TemplateState::try_from_bytes(&template_data)?;
		assert_template(self.template.address(), &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle_address = *self.bundle.address();
		let pool_address = *self.prize_pool.address();
		let pool_data = self.prize_pool.try_borrow()?;
		let pool = PrizePoolState::try_from_bytes(&pool_data)?;
		assert_prize_pool(self.prize_pool, &pool, &bundle_address)?;
		if pool.tree != *self.merkle_tree.address()
			|| args.pool_index.get() >= pool.deposit_cursor.get()
		{
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
		let item = self.prize_pool_item.as_account::<PrizePoolItemState>(&ID)?;
		assert_pool_item(
			self.prize_pool_item,
			&item,
			&pool_address,
			args.pool_index.get(),
		)?;
		assert_item_identity(
			&item,
			self.merkle_tree.address(),
			&args.data_hash,
			&args.creator_hash,
			args.metadata.as_slice(),
			args.nonce.get(),
			args.index.get(),
		)?;
		let previous_manifest = item.previous_manifest_accumulator;
		drop(item);

		let pool_bump = pool.bump;
		let pool_bundle = pool.bundle;
		let pool_asset_index = pool.asset_index;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let asset_index = usize::from(pool.asset_index);
		if pool.status == PRIZE_POOL_FUNDING {
			assert_treasury_unlocked(&template)?;
			if bundle.status != BUNDLE_FUNDING
				|| pool.has_prepared_item.get()
				|| bundle.funded_assets != pool.asset_index
				|| args.pool_index.get().checked_add(1) != Some(pool.deposit_cursor.get())
			{
				return Err(lootbox_error(LootboxError::InvalidState));
			}
			let cursor = pool
				.deposit_cursor
				.get()
				.checked_sub(1)
				.ok_or(ProgramError::ArithmeticOverflow)?;
			let mut bitmap = AllocVec::with_capacity(cursor.div_ceil(8) as usize);
			bitmap.extend_from_slice(
				&pool.unavailable()[..usize::try_from(cursor.div_ceil(8))
					.map_err(|_| ProgramError::InvalidAccountData)?],
			);
			drop(bundle);
			drop(pool_data);
			drop(template_data);
			UpdateResizableAccount {
				account: self.prize_pool,
				rent_account: self.authority,
				program_id: &ID,
				patch: PrizePoolStatePatch::new()
					.deposit_cursor(cursor)
					.manifest_accumulator(previous_manifest)
					.replace_unavailable(&bitmap),
			}
			.invoke::<PrizePoolState>()?;
		} else {
			if pool.status != PRIZE_POOL_SEALED
				|| bundle.kinds.get(asset_index) != Some(&PRIZE_POOL)
				|| mint_at(&bundle, asset_index)? != pool_address
				|| bitmap_is_set(
					pool.unavailable(),
					usize::try_from(args.pool_index.get())
						.map_err(|_| ProgramError::InvalidAccountData)?,
				)? {
				return Err(lootbox_error(LootboxError::PrizePoolItemUnavailable));
			}
			assert_pool_commitment(&bundle, &pool_address, &pool)?;
			let supply = assert_template_mint(
				self.box_mint,
				self.template.address(),
				&template.box_mint,
				template.locked_at.get() != 0,
			)?;
			let expected_reclaims = match bundle.status {
				BUNDLE_FUNDING => {
					assert_treasury_unlocked(&template)?;
					bundle.quantity.get()
				}
				BUNDLE_ACTIVE => {
					if template.status != TEMPLATE_RETIRED
						|| template.pending_openings.get() != 0
						|| supply != 0
					{
						return Err(lootbox_error(LootboxError::InvalidState));
					}
					let index = usize::try_from(bundle.index.get())
						.map_err(|_| ProgramError::InvalidAccountData)?;
					remaining_at(&template, index)?
				}
				_ => return Err(lootbox_error(LootboxError::InvalidState)),
			};
			let reclaimed_count = pool
				.reclaimed_count
				.get()
				.checked_add(1)
				.ok_or(ProgramError::ArithmeticOverflow)?;
			if u64::from(reclaimed_count) > expected_reclaims {
				return Err(lootbox_error(LootboxError::InvalidState));
			}
			let released = read_slot(&bundle.claimed, asset_index)?
				.checked_add(1)
				.ok_or(ProgramError::ArithmeticOverflow)?;
			if released > bundle.quantity.get() {
				return Err(lootbox_error(LootboxError::InvalidState));
			}
			write_slot(&mut bundle.claimed, asset_index, released)?;
			if u64::from(reclaimed_count) == expected_reclaims {
				bundle.reclaimed_mask |= 1u8 << pool.asset_index;
			}
			let mut bitmap = AllocVec::with_capacity(pool.unavailable().len());
			bitmap.extend_from_slice(pool.unavailable());
			set_bitmap(
				&mut bitmap,
				usize::try_from(args.pool_index.get())
					.map_err(|_| ProgramError::InvalidAccountData)?,
			)?;
			drop(bundle);
			drop(pool_data);
			drop(template_data);
			update_pool(
				self.prize_pool,
				&PrizePoolStatePatch::new()
					.reclaimed_count(reclaimed_count)
					.replace_unavailable(&bitmap),
			)?;
		}

		let pool_bump = [pool_bump];
		let pool_signer = PdaSigner::from_slices([
			SEED_PRIZE_POOL,
			pool_bundle.as_ref(),
			core::slice::from_ref(&pool_asset_index),
			pool_bump.as_slice(),
		]);
		let transfer = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.prize_pool,
			new_owner: self.authority,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&transfer)?;
		invoke_compressed_transfer(
			&transfer,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&[pool_signer.as_signer()],
		)?;
		self.prize_pool_item
			.close_account_zeroed(&ID, self.authority)
	}
}

impl<'a> ProcessAccountInfos<'a> for ClosePrizePoolAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = ClosePrizePoolInstruction::try_from_bytes(data)?;
		self.template.assert_owner(&ID)?;
		let template_data = self.template.try_borrow()?;
		let template_ref = TemplateState::try_from_bytes(&template_data)?;
		let template = *template_ref;
		assert_template(self.template.address(), &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle_address = *self.bundle.address();
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let pool_data = self.prize_pool.try_borrow()?;
		let pool = PrizePoolState::try_from_bytes(&pool_data)?;
		assert_prize_pool(self.prize_pool, &pool, &bundle_address)?;
		let empty_unsealed = pool.status == PRIZE_POOL_FUNDING
			&& pool.deposit_cursor.get() == 0
			&& !pool.has_prepared_item.get()
			&& bundle.funded_assets == pool.asset_index
			&& bundle.commitments
				[usize::from(pool.asset_index) * 32..(usize::from(pool.asset_index) + 1) * 32]
				== [0; 32];
		let recovered_sealed = pool.status == PRIZE_POOL_SEALED
			&& bundle.status == BUNDLE_FUNDING
			&& u64::from(pool.reclaimed_count.get()) == pool.quantity.get()
			&& bundle.reclaimed_mask & (1 << pool.asset_index) != 0;
		let active_terminal = if pool.status == PRIZE_POOL_SEALED && bundle.status == BUNDLE_ACTIVE
		{
			let remaining = template_ref
				.remaining()
				.get(
					usize::try_from(bundle.index.get())
						.map_err(|_| ProgramError::InvalidAccountData)?,
				)
				.map(PodU64::get)
				.ok_or(ProgramError::InvalidAccountData)?;
			active_pool_is_terminal(
				pool.status,
				bundle.status,
				template.status,
				template.pending_openings.get(),
				remaining,
				pool.assigned_count.get(),
				pool.claimed_count.get(),
				pool.reclaimed_count.get(),
				pool.quantity.get(),
				read_slot(&bundle.claimed, usize::from(pool.asset_index))?,
			)?
		} else {
			false
		};
		if !empty_unsealed && !recovered_sealed && !active_terminal {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		if !active_terminal {
			assert_treasury_unlocked(&template)?;
		}
		if recovered_sealed || active_terminal {
			assert_pool_commitment(&bundle, self.prize_pool.address(), &pool)?;
		}
		if !active_terminal {
			clear_prize_pool_slot(&mut bundle, pool.asset_index, self.prize_pool.address())?;
		}
		drop(pool_data);
		drop(bundle);
		drop(template_data);

		self.prize_pool.close_account_zeroed(&ID, self.authority)
	}
}

#[cfg(kani)]
mod proofs {
	use super::*;

	#[kani::proof]
	#[kani::unwind(9)]
	fn rank_selection_returns_exactly_one_available_bit() {
		let byte = kani::any::<u8>();
		let rank = kani::any::<u64>();
		let available = 8 - u64::from(byte.count_ones());
		kani::assume(available > 0 && rank < available);

		let selected = item_for_rank(&[byte], 8, rank).expect("valid rank") as usize;
		assert!(selected < 8);
		assert_eq!(byte & (1 << selected), 0);

		let mut before = 0;
		for index in 0..selected {
			if byte & (1 << index) == 0 {
				before += 1;
			}
		}
		assert_eq!(before, rank);
	}

	#[kani::proof]
	fn reserving_a_bit_is_idempotently_rejected() {
		let mut byte = [kani::any::<u8>()];
		let index = kani::any::<usize>();
		kani::assume(index < 8 && byte[0] & (1 << index) == 0);

		assert_eq!(set_bitmap(&mut byte, index), Ok(()));
		assert!(set_bitmap(&mut byte, index).is_err());
	}
}

#[cfg(test)]
mod tests {
	use alloc::vec;

	use proptest::prelude::*;

	use super::*;

	fn bitmap(values: &[bool]) -> AllocVec<u8> {
		let mut bytes = vec![0; values.len().div_ceil(8)];
		for (index, value) in values.iter().enumerate() {
			if *value {
				bytes[index / 8] |= 1 << (index % 8);
			}
		}
		bytes
	}

	#[test]
	fn every_rank_maps_to_the_corresponding_available_item() {
		for quantity in 1usize..=8 {
			for mask in 0u16..(1 << quantity) {
				let unavailable = [mask as u8];
				let expected: AllocVec<_> = (0..quantity)
					.filter(|index| unavailable[0] & (1 << index) == 0)
					.collect();
				for (rank, expected_index) in expected.iter().enumerate() {
					assert_eq!(
						item_for_rank(&unavailable, quantity, rank as u64),
						Ok(*expected_index as u32),
					);
				}
				assert!(item_for_rank(&unavailable, quantity, expected.len() as u64).is_err());
			}
		}
	}

	proptest! {
		#[test]
		fn arbitrary_multi_byte_bitmaps_never_select_an_unavailable_item(
			values in prop::collection::vec(any::<bool>(), 1..=MAX_PRIZE_POOL_ITEMS),
			raw_rank in any::<u64>(),
		) {
			let available: AllocVec<_> = values
				.iter()
				.enumerate()
				.filter_map(|(index, unavailable)| (!unavailable).then_some(index))
				.collect();
			prop_assume!(!available.is_empty());
			let rank = raw_rank % available.len() as u64;
			let selected = item_for_rank(&bitmap(&values), values.len(), rank)
				.expect("rank within available items") as usize;

			prop_assert_eq!(selected, available[rank as usize]);
			prop_assert!(!values[selected]);
		}
	}

	#[test]
	fn duplicate_reservations_fail_closed() {
		let mut unavailable = [0u8; 2];
		assert_eq!(set_bitmap(&mut unavailable, 8), Ok(()));
		assert_eq!(unavailable, [0, 1]);
		assert_eq!(
			set_bitmap(&mut unavailable, 8),
			Err(lootbox_error(LootboxError::PrizePoolItemUnavailable)),
		);
	}

	#[test]
	fn active_pool_closes_only_after_every_ticket_is_terminal() {
		let terminal = active_pool_is_terminal(
			PRIZE_POOL_SEALED,
			BUNDLE_ACTIVE,
			TEMPLATE_RETIRED,
			0,
			2,
			3,
			3,
			2,
			5,
			5,
		);
		assert_eq!(terminal, Ok(true));
		for nonterminal in [
			active_pool_is_terminal(
				PRIZE_POOL_SEALED,
				BUNDLE_ACTIVE,
				TEMPLATE_RETIRED,
				1,
				2,
				3,
				3,
				2,
				5,
				5,
			),
			active_pool_is_terminal(
				PRIZE_POOL_SEALED,
				BUNDLE_ACTIVE,
				TEMPLATE_RETIRED,
				0,
				2,
				3,
				2,
				2,
				5,
				5,
			),
			active_pool_is_terminal(
				PRIZE_POOL_SEALED,
				BUNDLE_ACTIVE,
				TEMPLATE_RETIRED,
				0,
				1,
				3,
				3,
				2,
				5,
				5,
			),
			active_pool_is_terminal(
				PRIZE_POOL_SEALED,
				BUNDLE_ACTIVE,
				TEMPLATE_RETIRED,
				0,
				2,
				3,
				3,
				2,
				5,
				4,
			),
		] {
			assert_eq!(nonterminal, Ok(false));
		}
	}

	#[test]
	fn unfinished_pool_reserves_its_manifest_slot() {
		let pool = Address::new_from_array([8; 32]);
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes, |_| Ok(())).expect("bundle");
		bundle.quantity.set(2);
		bundle.asset_count = 2;

		assert_eq!(reserve_prize_pool_slot(bundle, &pool), Ok(()));
		assert_eq!(bundle.funded_assets, 0);
		assert_eq!(bundle.kinds[0], PRIZE_POOL);
		assert_eq!(mint_at(bundle, 0), Ok(pool));
		assert_eq!(read_slot(&bundle.amounts, 0), Ok(1));
		assert_eq!(
			record_prize(bundle, &Address::default(), 10, PRIZE_SOL, 9),
			Err(lootbox_error(LootboxError::InvalidPrize)),
		);
		assert_eq!(
			reserve_prize_pool_slot(bundle, &pool),
			Err(lootbox_error(LootboxError::InvalidPrizePool)),
		);

		assert_eq!(clear_prize_pool_slot(bundle, 0, &pool), Ok(()));
		assert_eq!(bundle.kinds[0], 0);
		assert_eq!(mint_at(bundle, 0), Ok(Address::default()));
		assert_eq!(read_slot(&bundle.amounts, 0), Ok(0));
		assert_eq!(
			record_prize(bundle, &Address::default(), 10, PRIZE_SOL, 9),
			Ok(20),
		);
	}

	#[test]
	fn bundle_cannot_reserve_a_second_prize_pool() {
		let first_pool = Address::new_from_array([8; 32]);
		let second_pool = Address::new_from_array([9; 32]);
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes, |_| Ok(())).expect("bundle");
		bundle.quantity.set(2);
		bundle.asset_count = 2;

		assert_eq!(reserve_prize_pool_slot(bundle, &first_pool), Ok(()));
		bundle.funded_assets = 1;
		assert_eq!(
			reserve_prize_pool_slot(bundle, &second_pool),
			Err(lootbox_error(LootboxError::InvalidPrizePool)),
		);
	}

	fn metadata_fixture(is_mutable: bool) -> (AllocVec<u8>, [u8; 32], [u8; 32]) {
		fn string(bytes: &mut AllocVec<u8>, value: &[u8]) {
			bytes.extend_from_slice(&(value.len() as u32).to_le_bytes());
			bytes.extend_from_slice(value);
		}

		let mut metadata = AllocVec::new();
		string(&mut metadata, b"Pool prize");
		string(&mut metadata, b"POOL");
		string(&mut metadata, b"https://example.com/prize.json");
		metadata.extend_from_slice(&500u16.to_le_bytes());
		metadata.push(0); // primary sale
		metadata.push(u8::from(is_mutable));
		metadata.push(0); // edition nonce
		metadata.extend_from_slice(&[1, 0]); // NonFungible token standard
		metadata.extend_from_slice(&[1, 1]); // verified collection
		metadata.extend_from_slice(&[8; 32]);
		metadata.push(0); // uses
		metadata.push(0); // original token program
		metadata.extend_from_slice(&1u32.to_le_bytes());
		let creator_start = metadata.len();
		metadata.extend_from_slice(&[9; 32]);
		metadata.extend_from_slice(&[1, 100]);

		let inner = keccak_hashv(&[&metadata]);
		let data_hash = keccak_hashv(&[inner.as_ref(), &500u16.to_le_bytes()]).to_bytes();
		let creator_hash = keccak_hashv(&[&metadata[creator_start..]]).to_bytes();
		(metadata, data_hash, creator_hash)
	}

	#[test]
	fn metadata_admission_recomputes_hashes_and_rejects_mutability() {
		let (metadata, data_hash, creator_hash) = metadata_fixture(false);
		assert!(metadata_identity(&metadata, &data_hash, &creator_hash).is_ok());
		assert_eq!(
			metadata_identity(&metadata, &[1; 32], &creator_hash),
			Err(lootbox_error(LootboxError::InvalidPrizePoolMetadata)),
		);
		let mut trailing = metadata.clone();
		trailing.push(0);
		assert_eq!(
			metadata_identity(&trailing, &data_hash, &creator_hash),
			Err(lootbox_error(LootboxError::InvalidPrizePoolMetadata)),
		);

		let (mutable, mutable_data_hash, mutable_creator_hash) = metadata_fixture(true);
		assert_eq!(
			metadata_identity(&mutable, &mutable_data_hash, &mutable_creator_hash),
			Err(lootbox_error(LootboxError::MutablePrizePoolItem)),
		);
	}

	#[test]
	fn deposited_identity_allows_only_verification_flag_drift() {
		let tree = Address::new_from_array([3; 32]);
		let nonce = 7;
		let (metadata, data_hash, creator_hash) = metadata_fixture(false);
		let identity = metadata_identity(&metadata, &data_hash, &creator_hash).expect("identity");
		let mut bytes = [0; PrizePoolItemState::SIZE];
		let item = PrizePoolItemState::initialize(&mut bytes, |_| Ok(())).expect("item");
		item.asset = compressed_asset_id(&tree, nonce).expect("asset PDA");
		item.data_hash = data_hash;
		item.creator_hash = creator_hash;
		item.semantic_metadata_hash = identity.semantic_hash;
		item.nonce.set(nonce);
		item.tree_index.set(9);
		item.status = PRIZE_POOL_ITEM_DEPOSITED;

		assert_eq!(
			assert_item_identity(item, &tree, &data_hash, &creator_hash, &metadata, nonce, 9),
			Ok(()),
		);

		let mut collection_unverified = metadata.clone();
		let collection_flag = collection_unverified
			.windows(5)
			.position(|bytes| bytes == [1, 1, 8, 8, 8])
			.expect("collection flag")
			+ 1;
		collection_unverified[collection_flag] = 0;
		let inner = keccak_hashv(&[&collection_unverified]);
		let collection_data_hash =
			keccak_hashv(&[inner.as_ref(), &500u16.to_le_bytes()]).to_bytes();
		assert_eq!(
			assert_item_identity(
				item,
				&tree,
				&collection_data_hash,
				&creator_hash,
				&collection_unverified,
				nonce,
				9,
			),
			Ok(()),
		);

		let mut creator_unverified = metadata.clone();
		creator_unverified[metadata.len() - 2] = 0;
		let inner = keccak_hashv(&[&creator_unverified]);
		let creator_data_hash = keccak_hashv(&[inner.as_ref(), &500u16.to_le_bytes()]).to_bytes();
		let changed_creator_hash =
			keccak_hashv(&[&creator_unverified[creator_unverified.len() - 34..]]).to_bytes();
		assert_eq!(
			assert_item_identity(
				item,
				&tree,
				&creator_data_hash,
				&changed_creator_hash,
				&creator_unverified,
				nonce,
				9,
			),
			Ok(()),
		);

		let mut replacement_collection = metadata.clone();
		replacement_collection[collection_flag + 1] ^= 1;
		let inner = keccak_hashv(&[&replacement_collection]);
		let replacement_data_hash =
			keccak_hashv(&[inner.as_ref(), &500u16.to_le_bytes()]).to_bytes();
		assert_eq!(
			assert_item_identity(
				item,
				&tree,
				&replacement_data_hash,
				&creator_hash,
				&replacement_collection,
				nonce,
				9,
			),
			Err(lootbox_error(LootboxError::PrizePoolItemMismatch)),
		);
		assert_eq!(
			assert_item_identity(
				item,
				&tree,
				&data_hash,
				&creator_hash,
				&metadata,
				nonce + 1,
				9
			),
			Err(lootbox_error(LootboxError::PrizePoolItemMismatch)),
		);
		assert_eq!(
			assert_item_identity(item, &tree, &data_hash, &creator_hash, &metadata, nonce, 10),
			Err(lootbox_error(LootboxError::PrizePoolItemMismatch)),
		);
	}

	#[test]
	fn manifest_commits_to_deposit_order_and_every_leaf_field() {
		let pool = Address::new_from_array([1; 32]);
		let asset = Address::new_from_array([2; 32]);
		let manifest = |pool_index, data_hash, semantic_metadata_hash, index| {
			next_pool_manifest(
				&[0; 32],
				&pool,
				&PoolManifestItem {
					pool_index,
					asset: &asset,
					data_hash,
					creator_hash: &[4; 32],
					semantic_metadata_hash,
					nonce: 6,
					index,
				},
			)
		};
		let first = manifest(0, &[3; 32], &[5; 32], 7);
		assert_ne!(first, manifest(1, &[3; 32], &[5; 32], 7),);
		assert_ne!(first, manifest(0, &[7; 32], &[5; 32], 7),);
		assert_ne!(first, manifest(0, &[3; 32], &[5; 32], 8),);
		assert_ne!(first, manifest(0, &[3; 32], &[9; 32], 7),);

		let first_tree = Address::new_from_array([8; 32]);
		let second_tree = Address::new_from_array([9; 32]);
		let commitment = sealed_pool_commitment(&pool, &first_tree, &first, 1, 0, 1);
		assert_ne!(
			commitment,
			sealed_pool_commitment(&pool, &second_tree, &first, 1, 0, 1),
		);
		assert_ne!(
			commitment,
			sealed_pool_commitment(&pool, &first_tree, &[0; 32], 1, 0, 1),
		);
	}
}
