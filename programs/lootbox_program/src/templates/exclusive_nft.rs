//! Exclusive Lootbox NFTs: layered consolation collectibles minted on claim.
//!
//! One [`ExclusiveCollectionState`] is shared by every lootbox that attaches
//! to it. Its PDA is the private Bubblegum V2 tree creator and the update
//! authority of a Metaplex Core collection, so only a valid claim can mint.
//! Its admin loads frozen trait-layer tables, appends trees, and publishes it
//! once. While its attach window is open, any treasury creator may bind a
//! bundle slot of kind [`PRIZE_EXCLUSIVE_NFT`] to it through an
//! [`ExclusiveAttachmentState`] that escrows the Bubblegum mint fees. Traits
//! come from the opening's verified Switchboard value; see
//! [`exclusive_nft_seed`].

use super::*;

mod derivation;
pub use derivation::*;

mod metaplex;
pub use metaplex::*;

/// Bundle slot kind for an Exclusive Lootbox NFT minted on claim.
pub const PRIZE_EXCLUSIVE_NFT: u8 = 11;
/// Smallest Bubblegum tree depth a collection accepts.
pub const MIN_EXCLUSIVE_TREE_DEPTH: u8 = 3;
/// Largest Bubblegum tree depth a collection accepts (1,048,576 leaves).
pub const MAX_EXCLUSIVE_TREE_DEPTH: u8 = 20;

const SEED_EXCLUSIVE_COLLECTION: &[u8] = b"exclusive-collection";
const SEED_EXCLUSIVE_ATTACHMENT: &[u8] = b"exclusive-attachment";
const SEED_EXCLUSIVE_FEE_VAULT: &[u8] = b"exclusive-fee-vault";
const EXCLUSIVE_LAYERS_DOMAIN: &[u8] = b"lootbox:exclusive-nft-layers";
const EXCLUSIVE_ATTACHMENT_DOMAIN: &[u8] = b"lootbox:exclusive-nft-attachment";
const COLLECTION_URI_SUFFIX: &[u8] = b"collection.json";
const EXCLUSIVE_COLLECTION_DRAFT: u8 = 0;
const EXCLUSIVE_COLLECTION_PUBLISHED: u8 = 1;

/// A protocol-level Exclusive Lootbox NFT collection shared by many lootboxes.
///
/// Drafts accept layer tables from the admin. Publishing freezes them under
/// `layers_hash`; afterwards the admin can only append trees. Every mint
/// takes the next global serial and lands in `active_tree`.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(
	seeds = [SEED_EXCLUSIVE_COLLECTION, admin: Address, collection_id: u64],
	bump = bump
)]
pub struct ExclusiveCollectionState {
	/// Loads layers, appends trees, and publishes; a multisig on mainnet.
	pub admin: Address,
	/// Metaplex Core collection whose update authority is this PDA.
	pub core_collection: Address,
	/// Bubblegum V2 tree that receives the next mint; zero until appended.
	pub active_tree: Address,
	/// Commitment to every frozen term; zero until published.
	pub layers_hash: [u8; 32],
	pub collection_id: u64,
	/// Editions minted so far; the next global serial is `minted + 1`.
	pub minted: u64,
	/// Unix time from which bundles may attach.
	pub attach_opens_at: i64,
	/// Unix time from which bundles may no longer attach.
	pub attach_closes_at: i64,
	pub tree_count: u32,
	/// Trait count of each layer, bottom to top.
	pub trait_counts: [u8; 12],
	/// Twelve layers of sixty-four little-endian `u32` trait weights.
	pub weights: [u8; 3072],
	/// Null-padded UTF-8 name prefix; minted names are `{prefix} #{serial}`.
	pub name_prefix: [u8; 32],
	/// Null-padded UTF-8 symbol.
	pub symbol: [u8; 10],
	/// Null-padded `https://` base of every metadata URI.
	pub base_uri: [u8; 128],
	pub layer_count: u8,
	/// 0 draft, 1 published.
	pub status: u8,
	pub bump: u8,
}

/// One bundle slot's promise of Exclusive Lootbox NFTs from a collection.
///
/// The PDA commits the slot to the collection's frozen layers and owns a
/// zero-data fee vault prepaying Bubblegum's per-mint fee, so a claim costs
/// its submitter only the transaction fee.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(
	seeds = [SEED_EXCLUSIVE_ATTACHMENT, bundle: Address, asset_index: u8],
	bump = bump
)]
pub struct ExclusiveAttachmentState {
	pub template: Address,
	pub bundle: Address,
	pub collection: Address,
	/// The collection's frozen `layers_hash` at attach time.
	pub layers_hash: [u8; 32],
	/// Copies the bound bundle slot can ever mint.
	pub quantity: u64,
	/// Copies minted through this attachment.
	pub minted: u64,
	/// Bubblegum mint fee escrowed per copy.
	pub mint_fee_lamports: u64,
	pub asset_index: u8,
	pub bump: u8,
	pub fee_vault_bump: u8,
}

/// Emitted once per minted Exclusive Lootbox NFT.
#[event(discriminator = LootboxEventType::ExclusiveNftMinted, migrations)]
pub struct ExclusiveNftMintedEvent {
	pub template: Address,
	pub opening: Address,
	pub collection: Address,
	pub attachment: Address,
	pub beneficiary: Address,
	/// Bubblegum asset ID of the minted leaf.
	pub asset: Address,
	/// Seed `S` that determined every trait.
	pub seed: [u8; 32],
	/// Global serial within the collection.
	pub serial: u64,
	/// Trait index per layer, bottom to top; unused layers are zero.
	pub traits: [u8; 12],
	pub layer_count: u8,
}

#[instruction(discriminator = LootboxInstruction::CreateExclusiveCollection, migrations)]
pub struct CreateExclusiveCollectionInstruction {
	pub collection_id: u64,
	pub attach_opens_at: i64,
	pub attach_closes_at: i64,
	pub layer_count: u8,
	pub bump: u8,
	pub name_prefix: [u8; 32],
	pub symbol: [u8; 10],
	pub base_uri: [u8; 128],
}

#[instruction(discriminator = LootboxInstruction::SetExclusiveLayer, migrations)]
pub struct SetExclusiveLayerInstruction {
	pub layer_index: u8,
	pub trait_count: u8,
	/// Sixty-four little-endian `u32` weights; slots past `trait_count` are zero.
	pub weights: [u8; 256],
}

#[instruction(discriminator = LootboxInstruction::AppendExclusiveTree, migrations)]
pub struct AppendExclusiveTreeInstruction {
	pub max_depth: u8,
	pub max_buffer_size: u32,
}

#[instruction(discriminator = LootboxInstruction::PublishExclusiveCollection, migrations)]
pub struct PublishExclusiveCollectionInstruction {}

#[instruction(discriminator = LootboxInstruction::AttachExclusiveNft, migrations)]
pub struct AttachExclusiveNftInstruction {
	pub asset_index: u8,
	pub bump: u8,
	pub fee_vault_bump: u8,
}

#[instruction(discriminator = LootboxInstruction::ClaimExclusiveNft, migrations)]
pub struct ClaimExclusiveNftInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ReclaimExclusiveFees, migrations)]
pub struct ReclaimExclusiveFeesInstruction {
	pub asset_index: u8,
}

#[derive(Accounts, Debug)]
pub struct CreateExclusiveCollectionAccounts<'a> {
	#[pina(validate(signer))]
	pub admin: &'a mut AccountView,
	#[pina(validate(empty))]
	pub exclusive_collection: &'a mut AccountView,
	/// Fresh Core collection keypair; its update authority becomes the PDA.
	#[pina(validate(signer))]
	#[pina(validate(empty))]
	pub core_collection: &'a mut AccountView,
	#[pina(validate(address = MPL_CORE_ID))]
	pub core_program: &'a AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct SetExclusiveLayerAccounts<'a> {
	#[pina(validate(signer))]
	pub admin: &'a AccountView,
	pub exclusive_collection: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct AppendExclusiveTreeAccounts<'a> {
	#[pina(validate(signer))]
	pub admin: &'a mut AccountView,
	pub exclusive_collection: &'a mut AccountView,
	/// Bubblegum tree config PDA of `merkle_tree`.
	pub tree_config: &'a mut AccountView,
	/// Pre-allocated, uninitialized MPL Account Compression tree whose size
	/// includes a canopy leaving proofs of at most ten nodes.
	pub merkle_tree: &'a mut AccountView,
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	#[pina(validate(address = MPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	#[pina(validate(address = MPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct PublishExclusiveCollectionAccounts<'a> {
	#[pina(validate(signer))]
	pub admin: &'a AccountView,
	pub exclusive_collection: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct AttachExclusiveNftAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub exclusive_collection: &'a AccountView,
	#[pina(validate(empty))]
	pub exclusive_attachment: &'a mut AccountView,
	/// Zero-data System account PDA that prepays Bubblegum mint fees.
	/// Unsolicited lamports are accepted and reduce the required top-up.
	#[pina(validate(empty))]
	pub fee_vault: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct ClaimExclusiveNftAccounts<'a> {
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub exclusive_attachment: &'a mut AccountView,
	/// Pays Bubblegum's per-mint fee from the creator's escrow.
	pub fee_vault: &'a mut AccountView,
	pub exclusive_collection: &'a mut AccountView,
	/// Must be the opening's bound beneficiary; becomes the leaf owner.
	pub recipient: &'a AccountView,
	pub tree_config: &'a mut AccountView,
	pub merkle_tree: &'a mut AccountView,
	pub core_collection: &'a mut AccountView,
	#[pina(validate(address = MPL_CORE_CPI_SIGNER_ID))]
	pub core_cpi_signer: &'a AccountView,
	#[pina(validate(address = MPL_BUBBLEGUM_ID))]
	pub bubblegum_program: &'a AccountView,
	#[pina(validate(address = MPL_CORE_ID))]
	pub core_program: &'a AccountView,
	#[pina(validate(address = MPL_NOOP_ID))]
	pub log_wrapper: &'a AccountView,
	#[pina(validate(address = MPL_ACCOUNT_COMPRESSION_ID))]
	pub compression_program: &'a AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct ReclaimExclusiveFeesAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub exclusive_attachment: &'a mut AccountView,
	pub fee_vault: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

/// Require the canonical collection PDA and return its signer seeds' inputs.
fn assert_collection(address: &Address, state: &ExclusiveCollectionStateZc) -> ProgramResult {
	let seeds = ExclusiveCollectionState::seeds(&state.admin, state.collection_id.get())
		.with_bump(state.bump);

	if *address != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	Ok(())
}

/// Require the collection admin's signature on a collection mutation.
fn assert_collection_admin(
	admin: &AccountView,
	address: &Address,
	state: &ExclusiveCollectionStateZc,
) -> ProgramResult {
	assert_collection(address, state)?;
	admin.assert_signer()?;
	assert_authority_address(admin, &state.admin)
}

/// Domain-separated commitment to every frozen collection term.
///
/// Attachments copy it and bundle slots commit to it, so the layer odds, text,
/// and Core collection promised by a locked treasury can never change.
fn layers_hash(collection: &Address, state: &ExclusiveCollectionStateZc) -> [u8; 32] {
	hashv(&[
		EXCLUSIVE_LAYERS_DOMAIN,
		collection.as_ref(),
		state.admin.as_ref(),
		state.core_collection.as_ref(),
		&state.collection_id.get().to_le_bytes(),
		&[state.layer_count],
		&state.trait_counts,
		&state.weights,
		&state.name_prefix,
		&state.symbol,
		&state.base_uri,
	])
	.to_bytes()
}

/// Commitment written into the bundle slot at attach time.
fn attachment_commitment(attachment: &Address, state: &ExclusiveAttachmentStateZc) -> [u8; 32] {
	hashv(&[
		EXCLUSIVE_ATTACHMENT_DOMAIN,
		attachment.as_ref(),
		state.template.as_ref(),
		state.bundle.as_ref(),
		state.collection.as_ref(),
		&state.layers_hash,
		&state.quantity.get().to_le_bytes(),
		&[state.asset_index],
	])
	.to_bytes()
}

/// Require the canonical attachment PDA bound to this bundle slot and its
/// bundle commitment.
fn assert_attachment(
	address: &Address,
	state: &ExclusiveAttachmentStateZc,
	template: &Address,
	bundle_address: &Address,
	bundle: &BundleStateZc,
	asset_index: u8,
) -> ProgramResult {
	let seeds = ExclusiveAttachmentState::seeds(bundle_address, asset_index).with_bump(state.bump);
	if *address != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	let slot = usize::from(asset_index);
	if state.template != *template
		|| state.bundle != *bundle_address
		|| state.asset_index != asset_index
		|| bundle.kinds.get(slot) != Some(&PRIZE_EXCLUSIVE_NFT)
		|| mint_at(bundle, slot)? != *address
		|| read_slot(&bundle.amounts, slot)? != 1
		|| bundle.commitments[slot * 32..(slot + 1) * 32] != attachment_commitment(address, state)
	{
		return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
	}

	Ok(())
}

/// Require the attachment's canonical zero-data System fee vault.
fn assert_fee_vault(account: &AccountView, attachment: &Address, bump: u8) -> ProgramResult {
	let bump = [bump];
	let seeds = [
		SEED_EXCLUSIVE_FEE_VAULT,
		attachment.as_ref(),
		bump.as_slice(),
	];
	account.assert_seeds_with_bump(&seeds, &ID)?;

	if account.owner() != &system::ID || !account.is_data_empty() {
		return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
	}

	Ok(())
}

/// Lamports the fee vault needs to pay Bubblegum for `copies` more mints while
/// staying rent exempt.
fn required_fee_vault_balance(copies: u64, mint_fee: u64) -> Result<u64, ProgramError> {
	copies
		.checked_mul(mint_fee)
		.and_then(|fees| fees.checked_add(Rent::get().ok()?.try_minimum_balance(0).ok()?))
		.ok_or(ProgramError::ArithmeticOverflow)
}

/// Move lamports out of the fee vault under its PDA signature.
fn withdraw_fee_vault(
	fee_vault: &AccountView,
	attachment: &Address,
	bump: u8,
	to: &AccountView,
	lamports: u64,
) -> ProgramResult {
	if lamports == 0 {
		return Ok(());
	}

	let bump = [bump];
	let signer = PdaSigner::from_slices([
		SEED_EXCLUSIVE_FEE_VAULT,
		attachment.as_ref(),
		bump.as_slice(),
	]);
	system::instructions::Transfer {
		from: fee_vault,
		to,
		lamports,
	}
	.invoke_signed(&[signer.as_signer()])
}

/// Require a published collection accepting attachments at `now`.
fn assert_attach_window(state: &ExclusiveCollectionStateZc, now: i64) -> ProgramResult {
	if state.status != EXCLUSIVE_COLLECTION_PUBLISHED {
		return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
	}

	if now < state.attach_opens_at.get() || now >= state.attach_closes_at.get() {
		return Err(lootbox_error(LootboxError::ExclusiveAttachWindowClosed));
	}

	Ok(())
}

/// Validate every configured layer before the tables freeze.
fn validate_collection_layers(state: &ExclusiveCollectionStateZc) -> ProgramResult {
	let layer_count = usize::from(state.layer_count);
	let (layers, _) = state.weights.as_chunks::<EXCLUSIVE_LAYER_WEIGHT_BYTES>();

	for (layer, weights) in layers.iter().enumerate() {
		if layer < layer_count {
			validate_exclusive_layer(weights, state.trait_counts[layer])?;
		} else if state.trait_counts[layer] != 0 || weights.iter().any(|byte| *byte != 0) {
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}
	}

	Ok(())
}

/// Advance the attachment and global counters for one mint.
///
/// The attachment can never mint more copies than its committed quantity,
/// and every mint takes the next global serial.
fn record_exclusive_mint(
	collection: &mut ExclusiveCollectionStateZc,
	attachment: &mut ExclusiveAttachmentStateZc,
) -> Result<u64, ProgramError> {
	let attachment_minted = attachment
		.minted
		.get()
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if attachment_minted > attachment.quantity.get() {
		return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
	}

	let serial = collection
		.minted
		.get()
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	attachment.minted.set(attachment_minted);
	collection.minted.set(serial);

	Ok(serial)
}

impl<'a> ProcessAccountInfos<'a> for CreateExclusiveCollectionAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = CreateExclusiveCollectionInstruction::try_from_bytes(data)?;
		let admin = *self.admin.address();
		let collection_address = *self.exclusive_collection.address();
		validate_exclusive_text(&args.name_prefix, &args.symbol, &args.base_uri)?;

		if args.layer_count == 0
			|| usize::from(args.layer_count) > MAX_EXCLUSIVE_LAYERS
			|| args.attach_opens_at.get() >= args.attach_closes_at.get()
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}

		let seeds = ExclusiveCollectionState::seeds(&admin, args.collection_id.get());
		if self
			.exclusive_collection
			.assert_canonical_bump(&seeds.as_slices(), &ID)?
			!= args.bump
		{
			return Err(ProgramError::InvalidSeeds);
		}

		CreateProgramAccountWithBump {
			account: self.exclusive_collection,
			payer: self.admin,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<ExclusiveCollectionState>()?;
		let mut state = self
			.exclusive_collection
			.as_account_mut::<ExclusiveCollectionState>(&ID)?;
		state.admin = admin;
		state.core_collection = *self.core_collection.address();
		state.collection_id.set(args.collection_id.get());
		state.attach_opens_at.set(args.attach_opens_at.get());
		state.attach_closes_at.set(args.attach_closes_at.get());
		state.name_prefix = args.name_prefix;
		state.symbol = args.symbol;
		state.base_uri = args.base_uri;
		state.layer_count = args.layer_count;
		state.status = EXCLUSIVE_COLLECTION_DRAFT;
		state.bump = args.bump;
		drop(state);

		let mut collection_uri = BoundedText::<MAX_EXCLUSIVE_URI_BYTES>::default();
		collection_uri.push_text(&args.base_uri[..text_len(&args.base_uri)])?;
		collection_uri.push_text(COLLECTION_URI_SUFFIX)?;
		let signer_seeds = seeds.with_bump(args.bump);
		let signer = signer_seeds.to_signer();

		CreateCoreCollection {
			collection: self.core_collection,
			update_authority: self.exclusive_collection,
			payer: self.admin,
			system_program: self.system_program,
			core_program: self.core_program,
			name: &args.name_prefix[..text_len(&args.name_prefix)],
			uri: collection_uri.as_bytes(),
		}
		.invoke_signed(&[signer.as_signer()])?;

		assert_core_collection(self.core_collection, &collection_address)
	}
}

impl<'a> ProcessAccountInfos<'a> for SetExclusiveLayerAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = SetExclusiveLayerInstruction::try_from_bytes(data)?;
		let address = *self.exclusive_collection.address();
		let mut state = self
			.exclusive_collection
			.as_account_mut::<ExclusiveCollectionState>(&ID)?;
		assert_collection_admin(self.admin, &address, &state)?;

		if state.status != EXCLUSIVE_COLLECTION_DRAFT || args.layer_index >= state.layer_count {
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}

		validate_exclusive_layer(&args.weights, args.trait_count)?;
		let layer = usize::from(args.layer_index);
		let start = layer * EXCLUSIVE_LAYER_WEIGHT_BYTES;
		state.weights[start..start + EXCLUSIVE_LAYER_WEIGHT_BYTES].copy_from_slice(&args.weights);
		state.trait_counts[layer] = args.trait_count;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for AppendExclusiveTreeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AppendExclusiveTreeInstruction::try_from_bytes(data)?;
		let address = *self.exclusive_collection.address();
		let state = self
			.exclusive_collection
			.as_account::<ExclusiveCollectionState>(&ID)?;
		assert_collection_admin(self.admin, &address, &state)?;
		let admin = state.admin;
		let collection_id = state.collection_id.get();
		let bump = state.bump;
		drop(state);

		let depth = u64::from(args.max_depth);
		let canopy = depth.saturating_sub(u64::from(MAX_EXCLUSIVE_TRANSFER_PROOF_NODES));
		let minimum_size =
			merkle_tree_account_size(depth, u64::from(args.max_buffer_size.get()), canopy);
		if !(MIN_EXCLUSIVE_TREE_DEPTH..=MAX_EXCLUSIVE_TREE_DEPTH).contains(&args.max_depth)
			|| (self.merkle_tree.data_len() as u64) < minimum_size
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}

		assert_tree_config_address(self.tree_config, self.merkle_tree.address())?;
		self.merkle_tree
			.assert_owner(&MPL_ACCOUNT_COMPRESSION_ID)?
			.assert_writable()?;
		let seeds = ExclusiveCollectionState::seeds(&admin, collection_id).with_bump(bump);
		let signer = seeds.to_signer();

		CreateBubblegumTree {
			tree_config: self.tree_config,
			merkle_tree: self.merkle_tree,
			payer: self.admin,
			tree_creator: self.exclusive_collection,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
			bubblegum_program: self.bubblegum_program,
			max_depth: u32::from(args.max_depth),
			max_buffer_size: args.max_buffer_size.get(),
		}
		.invoke_signed(&[signer.as_signer()])?;

		let tree = read_tree_config(self.tree_config)?;
		if tree.tree_creator != address
			|| tree.tree_delegate != address
			|| tree.is_public
			|| tree.num_minted != 0
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}

		let mut state = self
			.exclusive_collection
			.as_account_mut::<ExclusiveCollectionState>(&ID)?;
		let tree_count = state
			.tree_count
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		state.active_tree = *self.merkle_tree.address();
		state.tree_count.set(tree_count);

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for PublishExclusiveCollectionAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = PublishExclusiveCollectionInstruction::try_from_bytes(data)?;
		let address = *self.exclusive_collection.address();
		let mut state = self
			.exclusive_collection
			.as_account_mut::<ExclusiveCollectionState>(&ID)?;
		assert_collection_admin(self.admin, &address, &state)?;

		if state.status != EXCLUSIVE_COLLECTION_DRAFT || state.active_tree == Address::default() {
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}

		validate_collection_layers(&state)?;
		state.layers_hash = layers_hash(&address, &state);
		state.status = EXCLUSIVE_COLLECTION_PUBLISHED;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for AttachExclusiveNftAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AttachExclusiveNftInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let collection_address = *self.exclusive_collection.address();
		let attachment_address = *self.exclusive_attachment.address();
		let template = as_template(self.template)?;
		assert_template(&template_address, &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_editable(&template)?;
		assert_bundle(self.bundle, &template_address)?;

		let collection = self
			.exclusive_collection
			.as_account::<ExclusiveCollectionState>(&ID)?;
		assert_collection(&collection_address, &collection)?;
		assert_attach_window(&collection, sysvars::clock::Clock::get()?.unix_timestamp)?;
		let layers_hash = collection.layers_hash;
		drop(collection);

		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let quantity = bundle.quantity.get();
		if bundle.status != BUNDLE_FUNDING || args.asset_index != bundle.funded_assets {
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}
		drop(bundle);

		let seeds = ExclusiveAttachmentState::seeds(&bundle_address, args.asset_index);
		if self
			.exclusive_attachment
			.assert_canonical_bump(&seeds.as_slices(), &ID)?
			!= args.bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		let fee_vault_seeds = [SEED_EXCLUSIVE_FEE_VAULT, attachment_address.as_ref()];
		if self
			.fee_vault
			.assert_canonical_bump(&fee_vault_seeds, &ID)?
			!= args.fee_vault_bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		self.fee_vault.assert_owner(&system::ID)?;
		let fee_top_up = required_fee_vault_balance(quantity, BUBBLEGUM_MINT_V2_FEE_LAMPORTS)?
			.saturating_sub(self.fee_vault.lamports());

		CreateProgramAccountWithBump {
			account: self.exclusive_attachment,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<ExclusiveAttachmentState>()?;
		let mut attachment = self
			.exclusive_attachment
			.as_account_mut::<ExclusiveAttachmentState>(&ID)?;
		attachment.template = template_address;
		attachment.bundle = bundle_address;
		attachment.collection = collection_address;
		attachment.layers_hash = layers_hash;
		attachment.quantity.set(quantity);
		attachment
			.mint_fee_lamports
			.set(BUBBLEGUM_MINT_V2_FEE_LAMPORTS);
		attachment.asset_index = args.asset_index;
		attachment.bump = args.bump;
		attachment.fee_vault_bump = args.fee_vault_bump;
		let commitment = attachment_commitment(&attachment_address, &attachment);
		drop(attachment);

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let slot = usize::from(args.asset_index);
		record_prize(&mut bundle, &attachment_address, 1, PRIZE_EXCLUSIVE_NFT, 0)?;
		bundle.commitments[slot * 32..(slot + 1) * 32].copy_from_slice(&commitment);
		drop(bundle);

		if fee_top_up == 0 {
			return Ok(());
		}

		system::instructions::Transfer {
			from: self.authority,
			to: self.fee_vault,
			lamports: fee_top_up,
		}
		.invoke()
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimExclusiveNftAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimExclusiveNftInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let opening_address = *self.opening.address();
		let bundle_address = *self.bundle.address();
		let attachment_address = *self.exclusive_attachment.address();
		let collection_address = *self.exclusive_collection.address();
		let recipient_address = *self.recipient.address();
		let template = as_template(self.template)?;
		assert_template(&template_address, &template)?;
		assert_bundle(self.bundle, &template_address)?;

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		let mut attachment = self
			.exclusive_attachment
			.as_account_mut::<ExclusiveAttachmentState>(&ID)?;
		let mut collection = self
			.exclusive_collection
			.as_account_mut::<ExclusiveCollectionState>(&ID)?;
		assert_template_opening(&opening_address, &opening, &template_address)?;
		assert_attachment(
			&attachment_address,
			&attachment,
			&template_address,
			&bundle_address,
			&bundle,
			args.asset_index,
		)?;
		assert_collection(&collection_address, &collection)?;

		// Security: the CPI targets only the committed collection, its current
		// tree, and its Core collection; `record_claim` binds the leaf owner.
		if attachment.collection != collection_address
			|| attachment.layers_hash != collection.layers_hash
			|| collection.status != EXCLUSIVE_COLLECTION_PUBLISHED
			|| *self.merkle_tree.address() != collection.active_tree
			|| *self.core_collection.address() != collection.core_collection
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveCollection));
		}

		record_claim(
			&mut opening,
			&mut bundle,
			&recipient_address,
			args.asset_index,
		)?;
		let seed = exclusive_nft_seed(&template_address, &opening_address, &opening.entropy);
		let traits = exclusive_traits(
			&seed,
			&collection.trait_counts,
			&collection.weights,
			collection.layer_count,
		)?;
		let serial = record_exclusive_mint(&mut collection, &mut attachment)?;
		let name = exclusive_nft_name(
			&collection.name_prefix[..text_len(&collection.name_prefix)],
			serial,
		)?;
		let uri = exclusive_nft_uri(
			&collection.base_uri[..text_len(&collection.base_uri)],
			&traits,
			serial,
		)?;
		let symbol = collection.symbol;
		let core_collection = collection.core_collection;
		let admin = collection.admin;
		let collection_id = collection.collection_id.get();
		let collection_bump = collection.bump;
		let fee_vault_bump = attachment.fee_vault_bump;
		drop(collection);
		drop(attachment);
		drop(opening);
		drop(bundle);

		assert_fee_vault(self.fee_vault, &attachment_address, fee_vault_bump)?;
		assert_tree_config_address(self.tree_config, self.merkle_tree.address())?;
		let nonce = read_tree_config(self.tree_config)?.num_minted;
		let asset = compressed_asset_id(self.merkle_tree.address(), nonce)?;
		let collection_seeds =
			ExclusiveCollectionState::seeds(&admin, collection_id).with_bump(collection_bump);
		let collection_signer = collection_seeds.to_signer();
		let fee_vault_bump = [fee_vault_bump];
		let fee_vault_signer = PdaSigner::from_slices([
			SEED_EXCLUSIVE_FEE_VAULT,
			attachment_address.as_ref(),
			fee_vault_bump.as_slice(),
		]);

		MintBubblegumLeaf {
			tree_config: self.tree_config,
			payer: self.fee_vault,
			tree_authority: self.exclusive_collection,
			collection_authority: self.exclusive_collection,
			leaf_owner: self.recipient,
			merkle_tree: self.merkle_tree,
			collection: self.core_collection,
			core_cpi_signer: self.core_cpi_signer,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			core_program: self.core_program,
			system_program: self.system_program,
			bubblegum_program: self.bubblegum_program,
			metadata: LeafMetadata {
				name: name.as_bytes(),
				symbol: &symbol[..text_len(&symbol)],
				uri: uri.as_bytes(),
				collection: &core_collection,
			},
		}
		.invoke_signed(&[collection_signer.as_signer(), fee_vault_signer.as_signer()])?;

		ExclusiveNftMintedEvent::emit(|event| {
			event.template = template_address;
			event.opening = opening_address;
			event.collection = collection_address;
			event.attachment = attachment_address;
			event.beneficiary = recipient_address;
			event.asset = asset;
			event.seed = seed;
			event.serial.set(serial);
			event.traits = traits.traits;
			event.layer_count = traits.layer_count;
			Ok(())
		})
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimExclusiveFeesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimExclusiveFeesInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let attachment_address = *self.exclusive_attachment.address();
		let template_data = self.template.try_borrow()?;
		let template = TemplateState::try_from_bytes(&template_data)?;
		assert_template(&template_address, &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_bundle(self.bundle, &template_address)?;
		let supply = assert_template_mint(
			self.box_mint,
			&template_address,
			&template.box_mint,
			template.locked_at.get() != 0,
		)?;

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let attachment = self
			.exclusive_attachment
			.as_account::<ExclusiveAttachmentState>(&ID)?;
		assert_attachment(
			&attachment_address,
			&attachment,
			&template_address,
			&bundle_address,
			&bundle,
			args.asset_index,
		)?;
		let fee_vault_bump = attachment.fee_vault_bump;
		let mint_fee = attachment.mint_fee_lamports.get();
		drop(attachment);
		assert_fee_vault(self.fee_vault, &attachment_address, fee_vault_bump)?;

		// Existing recovery rules release only undrawn copies: a staged bundle
		// releases all of them, an active one only after retirement with zero
		// box supply and no pending openings. Allocated copies stay payable.
		let bit = 1u8
			.checked_shl(u32::from(args.asset_index))
			.ok_or(ProgramError::ArithmeticOverflow)?;
		if bundle.reclaimed_mask & bit == 0 {
			let bundle_index = usize::try_from(bundle.index.get())
				.map_err(|_| ProgramError::InvalidAccountData)?;
			let active_remaining = if bundle.status == BUNDLE_ACTIVE {
				Some(remaining_at(&template, bundle_index)?)
			} else {
				None
			};
			reclaim_amount(
				template.status,
				template.pending_openings.get(),
				&mut bundle,
				supply,
				args.asset_index,
				active_remaining,
			)?;
		}

		let outstanding = bundle
			.quantity
			.get()
			.checked_sub(read_slot(&bundle.claimed, usize::from(args.asset_index))?)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let is_staged = bundle.status == BUNDLE_FUNDING;
		drop(bundle);
		drop(template_data);

		// A cancelled staged bundle never minted anything, so the attachment
		// closes and the slot may later attach again.
		if is_staged {
			withdraw_fee_vault(
				self.fee_vault,
				&attachment_address,
				fee_vault_bump,
				self.authority,
				self.fee_vault.lamports(),
			)?;

			return self
				.exclusive_attachment
				.close_account_zeroed(&ID, self.authority);
		}

		let surplus = self
			.fee_vault
			.lamports()
			.saturating_sub(required_fee_vault_balance(outstanding, mint_fee)?);
		withdraw_fee_vault(
			self.fee_vault,
			&attachment_address,
			fee_vault_bump,
			self.authority,
			surplus,
		)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn collection_bytes() -> [u8; ExclusiveCollectionState::SIZE] {
		let mut bytes = [0u8; ExclusiveCollectionState::SIZE];
		let state =
			ExclusiveCollectionState::initialize(&mut bytes, |_| Ok(())).expect("collection");
		state.layer_count = 2;
		state.trait_counts[..2].copy_from_slice(&[2, 3]);
		state.weights[..8].copy_from_slice(&[1, 0, 0, 0, 2, 0, 0, 0]);
		state.weights[256..268].copy_from_slice(&[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
		bytes
	}

	#[test]
	fn publishing_requires_complete_canonical_layers() {
		let mut bytes = collection_bytes();
		let state = ExclusiveCollectionState::try_from_bytes_mut(&mut bytes).expect("collection");
		assert_eq!(validate_collection_layers(state), Ok(()));

		state.trait_counts[2] = 1;
		assert!(
			validate_collection_layers(state).is_err(),
			"unused layer with traits"
		);
		state.trait_counts[2] = 0;
		state.weights[512] = 1;
		assert!(
			validate_collection_layers(state).is_err(),
			"unused layer with weights"
		);
		state.weights[512] = 0;
		state.trait_counts[1] = 0;
		assert!(
			validate_collection_layers(state).is_err(),
			"configured layer left empty"
		);
	}

	#[test]
	fn frozen_terms_change_the_layers_hash() {
		let address = Address::new_from_array([3; 32]);
		let mut bytes = collection_bytes();
		let state = ExclusiveCollectionState::try_from_bytes_mut(&mut bytes).expect("collection");
		let hash = layers_hash(&address, state);
		state.weights[0] = 2;
		assert_ne!(hash, layers_hash(&address, state));
		state.weights[0] = 1;
		state.base_uri[0] = b'x';
		assert_ne!(hash, layers_hash(&address, state));
		state.base_uri[0] = 0;
		assert_eq!(hash, layers_hash(&address, state));
		assert_ne!(hash, layers_hash(&Address::new_from_array([4; 32]), state));
	}

	#[test]
	fn the_attach_window_is_half_open_and_needs_publication() {
		let mut bytes = collection_bytes();
		let state = ExclusiveCollectionState::try_from_bytes_mut(&mut bytes).expect("collection");
		state.attach_opens_at.set(100);
		state.attach_closes_at.set(200);
		assert!(assert_attach_window(state, 150).is_err(), "draft");
		state.status = EXCLUSIVE_COLLECTION_PUBLISHED;
		assert_eq!(
			assert_attach_window(state, 99),
			Err(lootbox_error(LootboxError::ExclusiveAttachWindowClosed))
		);
		assert_eq!(assert_attach_window(state, 100), Ok(()));
		assert_eq!(assert_attach_window(state, 199), Ok(()));
		assert_eq!(
			assert_attach_window(state, 200),
			Err(lootbox_error(LootboxError::ExclusiveAttachWindowClosed))
		);
	}

	#[test]
	fn attachments_mint_at_most_their_quantity_with_global_serials() {
		let mut collection_bytes = collection_bytes();
		let collection = ExclusiveCollectionState::try_from_bytes_mut(&mut collection_bytes)
			.expect("collection");
		collection.minted.set(41);
		let mut attachment_bytes = [0u8; ExclusiveAttachmentState::SIZE];
		let attachment = ExclusiveAttachmentState::initialize(&mut attachment_bytes, |_| Ok(()))
			.expect("attachment");
		attachment.quantity.set(2);

		assert_eq!(record_exclusive_mint(collection, attachment), Ok(42));
		assert_eq!(record_exclusive_mint(collection, attachment), Ok(43));
		assert_eq!(
			record_exclusive_mint(collection, attachment),
			Err(lootbox_error(LootboxError::InvalidExclusiveCollection))
		);
		assert_eq!(collection.minted.get(), 43);
		assert_eq!(attachment.minted.get(), 2);
	}

	#[test]
	fn attachment_commitments_pin_the_collection_layers() {
		let attachment_address = Address::new_from_array([5; 32]);
		let mut bytes = [0u8; ExclusiveAttachmentState::SIZE];
		let attachment =
			ExclusiveAttachmentState::initialize(&mut bytes, |_| Ok(())).expect("attachment");
		attachment.quantity.set(9);
		let commitment = attachment_commitment(&attachment_address, attachment);
		attachment.layers_hash[0] = 1;
		assert_ne!(
			commitment,
			attachment_commitment(&attachment_address, attachment)
		);
		attachment.layers_hash[0] = 0;
		attachment.quantity.set(10);
		assert_ne!(
			commitment,
			attachment_commitment(&attachment_address, attachment)
		);
	}

	#[test]
	fn layouts_are_fixed() {
		assert_eq!(
			ExclusiveCollectionState::SIZE,
			size_of::<ExclusiveCollectionStateZc>()
		);
		assert_eq!(
			ExclusiveAttachmentState::SIZE,
			size_of::<ExclusiveAttachmentStateZc>()
		);
	}
}
