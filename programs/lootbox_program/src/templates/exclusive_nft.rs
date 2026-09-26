//! Exclusive Lootbox NFTs: rarity-tiered consolation prizes minted on claim.
//!
//! A bundle slot of kind [`PRIZE_EXCLUSIVE_NFT`] targets one
//! [`ExclusiveSeriesState`] PDA. The series is the Bubblegum V2 tree creator
//! and the update authority of a Metaplex Core collection, so only a valid
//! claim can mint. Rarity and traits come from the opening's verified
//! Switchboard value; see [`exclusive_nft_seed`].

use super::*;

mod derivation;
pub use derivation::*;

mod metaplex;
pub use metaplex::*;

/// Bundle slot kind for an Exclusive Lootbox NFT minted on claim.
pub const PRIZE_EXCLUSIVE_NFT: u8 = 11;

const SEED_EXCLUSIVE_SERIES: &[u8] = b"exclusive-series";
const SEED_EXCLUSIVE_FEE_VAULT: &[u8] = b"exclusive-fee-vault";
const EXCLUSIVE_SERIES_COMMITMENT_DOMAIN: &[u8] = b"lootbox:exclusive-nft-series";
const EXCLUSIVE_SERIES_CONFIGURED: u8 = 0;
const EXCLUSIVE_SERIES_READY: u8 = 1;
/// Smallest Bubblegum tree depth a series accepts.
pub const MIN_EXCLUSIVE_TREE_DEPTH: u8 = 3;
/// Largest Bubblegum tree depth a series accepts (1,048,576 leaves).
pub const MAX_EXCLUSIVE_TREE_DEPTH: u8 = 20;
const COLLECTION_URI_SUFFIX: &[u8] = b"collection.json";

/// Immutable rarity rules, art references, bonus reserves, and mint counters of
/// one template's Exclusive Lootbox NFT series.
///
/// The PDA is the Bubblegum tree creator and the Core collection update
/// authority. Its lamports hold rent plus every unpaid tier bonus:
/// `lamports >= rent_reserve + sum(bonus_remaining[k] * bonus_lamports[k])`.
/// A separate zero-data fee vault PDA prepays Bubblegum's per-mint fee, so a
/// claim costs its submitter only the transaction fee.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(seeds = [SEED_EXCLUSIVE_SERIES, template: Address], bump = bump)]
pub struct ExclusiveSeriesState {
	pub authority: Address,
	pub template: Address,
	pub bundle: Address,
	/// Metaplex Core collection; zero until the series is initialized.
	pub collection: Address,
	/// Bubblegum V2 tree; zero until the series is initialized.
	pub merkle_tree: Address,
	/// Consolation copies the bound bundle slot can ever mint.
	pub quantity: u64,
	/// Editions minted so far; the next serial is `minted + 1`.
	pub minted: u64,
	/// Rent-exempt balance kept apart from the bonus reserves.
	pub rent_reserve: u64,
	/// Bubblegum mint fee escrowed per copy in the fee vault at creation.
	pub mint_fee_lamports: u64,
	/// Sixteen little-endian `u32` tier weights.
	pub weights: [u8; 64],
	/// Sixteen little-endian `u64` lamport bonuses paid per tier win.
	pub bonus_lamports: [u8; 128],
	/// Sixteen little-endian `u32` bonus counts funded at creation.
	pub bonus_counts: [u8; 64],
	/// Sixteen little-endian `u32` bonuses still escrowed.
	pub bonus_remaining: [u8; 64],
	/// Sixteen little-endian `u32` editions minted per tier.
	pub tier_minted: [u8; 64],
	/// Null-padded UTF-8 name prefix; minted names are `{prefix} #{serial}`.
	pub name_prefix: [u8; 32],
	/// Null-padded UTF-8 symbol.
	pub symbol: [u8; 10],
	/// Null-padded `https://` base of every metadata URI.
	pub base_uri: [u8; 96],
	pub max_buffer_size: u32,
	pub asset_index: u8,
	pub contents_count: u8,
	pub background_count: u8,
	pub pattern_count: u8,
	pub max_depth: u8,
	/// 0 configured (reserves escrowed), 1 ready (collection and tree bound).
	pub status: u8,
	pub bump: u8,
	pub fee_vault_bump: u8,
}

/// Emitted once per minted Exclusive Lootbox NFT.
#[event(discriminator = LootboxEventType::ExclusiveNftMinted, migrations)]
pub struct ExclusiveNftMintedEvent {
	pub template: Address,
	pub opening: Address,
	pub series: Address,
	pub beneficiary: Address,
	/// Bubblegum asset ID of the minted leaf.
	pub asset: Address,
	/// Series seed `S` that determined the tier and traits.
	pub seed: [u8; 32],
	pub serial: u64,
	/// Tier bonus paid with this mint; zero when the tier has none left.
	pub bonus_lamports: u64,
	pub tier: u8,
	pub contents: u8,
	pub background: u8,
	pub pattern: u8,
}

#[instruction(discriminator = LootboxInstruction::CreateExclusiveSeries, migrations)]
pub struct CreateExclusiveSeriesInstruction {
	pub asset_index: u8,
	pub bump: u8,
	pub fee_vault_bump: u8,
	pub contents_count: u8,
	pub background_count: u8,
	pub pattern_count: u8,
	/// Sixteen little-endian `u32` tier weights.
	pub weights: [u8; 64],
	/// Sixteen little-endian `u64` lamport bonuses per tier win.
	pub bonus_lamports: [u8; 128],
	/// Sixteen little-endian `u32` funded bonus counts.
	pub bonus_counts: [u8; 64],
	pub name_prefix: [u8; 32],
	pub symbol: [u8; 10],
	pub base_uri: [u8; 96],
}

#[instruction(discriminator = LootboxInstruction::InitializeExclusiveSeries, migrations)]
pub struct InitializeExclusiveSeriesInstruction {
	pub max_depth: u8,
	pub max_buffer_size: u32,
}

#[instruction(discriminator = LootboxInstruction::ClaimExclusiveNft, migrations)]
pub struct ClaimExclusiveNftInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ReclaimExclusiveReserve, migrations)]
pub struct ReclaimExclusiveReserveInstruction {
	pub asset_index: u8,
}

#[derive(Accounts, Debug)]
pub struct CreateExclusiveSeriesAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	#[pina(validate(empty))]
	pub exclusive_series: &'a mut AccountView,
	/// Zero-data System account PDA that prepays Bubblegum mint fees.
	/// Unsolicited lamports are accepted and reduce the required top-up.
	#[pina(validate(empty))]
	pub fee_vault: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct InitializeExclusiveSeriesAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub exclusive_series: &'a mut AccountView,
	/// Fresh Core collection keypair; its update authority becomes the series.
	#[pina(validate(signer))]
	#[pina(validate(empty))]
	pub collection: &'a mut AccountView,
	/// Bubblegum tree config PDA of `merkle_tree`.
	pub tree_config: &'a mut AccountView,
	/// Pre-allocated, uninitialized MPL Account Compression tree.
	pub merkle_tree: &'a mut AccountView,
	#[pina(validate(address = MPL_CORE_ID))]
	pub core_program: &'a AccountView,
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
pub struct ClaimExclusiveNftAccounts<'a> {
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub exclusive_series: &'a mut AccountView,
	/// Pays Bubblegum's per-mint fee from the creator's escrow.
	pub fee_vault: &'a mut AccountView,
	/// Must be the opening's bound beneficiary; receives the leaf and bonus.
	pub recipient: &'a mut AccountView,
	pub tree_config: &'a mut AccountView,
	pub merkle_tree: &'a mut AccountView,
	pub collection: &'a mut AccountView,
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
pub struct ReclaimExclusiveReserveAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub exclusive_series: &'a mut AccountView,
	pub fee_vault: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

/// Read one little-endian `u32` lane of a sixteen-slot table.
fn read_u32_slot(slots: &[u8; 64], index: usize) -> Result<u32, ProgramError> {
	let bytes = slots
		.get(index * 4..index * 4 + 4)
		.ok_or(ProgramError::InvalidAccountData)?;

	Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn write_u32_slot(slots: &mut [u8; 64], index: usize, value: u32) -> ProgramResult {
	slots
		.get_mut(index * 4..index * 4 + 4)
		.ok_or(ProgramError::InvalidAccountData)?
		.copy_from_slice(&value.to_le_bytes());

	Ok(())
}

/// Lamports every unpaid tier bonus still requires.
fn bonus_liability(
	bonus_lamports: &[u8; 128],
	bonus_remaining: &[u8; 64],
) -> Result<u64, ProgramError> {
	(0..EXCLUSIVE_TIER_COUNT).try_fold(0u64, |total, tier| {
		let remaining = u64::from(read_u32_slot(bonus_remaining, tier)?);
		read_slot(bonus_lamports, tier)?
			.checked_mul(remaining)
			.and_then(|owed| total.checked_add(owed))
			.ok_or(ProgramError::ArithmeticOverflow)
	})
}

/// Validate creator bonus reserves and return the total lamports to escrow.
///
/// A tier bonus needs both a positive amount and a positive count, must sit on
/// a drawable tier, and can never be won more often than the bundle quantity.
fn validate_bonus_reserves(
	weights: &[u32; EXCLUSIVE_TIER_COUNT],
	bonus_lamports: &[u8; 128],
	bonus_counts: &[u8; 64],
	quantity: u64,
) -> Result<u64, ProgramError> {
	for (tier, weight) in weights.iter().enumerate() {
		let lamports = read_slot(bonus_lamports, tier)?;
		let count = u64::from(read_u32_slot(bonus_counts, tier)?);

		if (lamports == 0) != (count == 0) || (count != 0 && (*weight == 0 || count > quantity)) {
			return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
		}
	}

	bonus_liability(bonus_lamports, bonus_counts)
}

/// Domain-separated commitment to every immutable series term.
///
/// Initialization writes it into the bundle slot, so activation folds it into
/// the treasury manifest and a locked template's odds and art rules are
/// provable from the market-lock manifest hash.
fn series_commitment(series: &Address, state: &ExclusiveSeriesStateZc) -> [u8; 32] {
	hashv(&[
		EXCLUSIVE_SERIES_COMMITMENT_DOMAIN,
		series.as_ref(),
		state.template.as_ref(),
		state.bundle.as_ref(),
		state.collection.as_ref(),
		state.merkle_tree.as_ref(),
		&state.quantity.get().to_le_bytes(),
		&state.weights,
		&state.bonus_lamports,
		&state.bonus_counts,
		&state.name_prefix,
		&state.symbol,
		&state.base_uri,
		&state.max_buffer_size.get().to_le_bytes(),
		&[
			state.asset_index,
			state.contents_count,
			state.background_count,
			state.pattern_count,
			state.max_depth,
		],
	])
	.to_bytes()
}

fn trait_counts(state: &ExclusiveSeriesStateZc) -> ExclusiveTraitCounts {
	ExclusiveTraitCounts {
		contents: state.contents_count,
		background: state.background_count,
		pattern: state.pattern_count,
	}
}

/// Require the series' canonical zero-data System fee vault.
fn assert_fee_vault(account: &AccountView, series: &Address, bump: u8) -> ProgramResult {
	let bump = [bump];
	let seeds = [SEED_EXCLUSIVE_FEE_VAULT, series.as_ref(), bump.as_slice()];
	account.assert_seeds_with_bump(&seeds, &ID)?;

	if account.owner() != &system::ID || !account.is_data_empty() {
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
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
	series: &Address,
	bump: u8,
	to: &AccountView,
	lamports: u64,
) -> ProgramResult {
	if lamports == 0 {
		return Ok(());
	}

	let bump = [bump];
	let signer =
		PdaSigner::from_slices([SEED_EXCLUSIVE_FEE_VAULT, series.as_ref(), bump.as_slice()]);
	system::instructions::Transfer {
		from: fee_vault,
		to,
		lamports,
	}
	.invoke_signed(&[signer.as_signer()])
}

/// Require the canonical series PDA bound to this template, bundle, and slot.
fn assert_series(
	address: &Address,
	state: &ExclusiveSeriesStateZc,
	template: &Address,
	bundle: &Address,
	asset_index: u8,
) -> ProgramResult {
	let seeds = ExclusiveSeriesState::seeds(template).with_bump(state.bump);
	if *address != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	if state.template != *template || state.bundle != *bundle || state.asset_index != asset_index {
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	Ok(())
}

/// Require that the bundle slot still commits to this ready series.
fn assert_series_commitment(
	bundle: &BundleStateZc,
	series: &Address,
	state: &ExclusiveSeriesStateZc,
) -> ProgramResult {
	let index = usize::from(state.asset_index);

	if state.status != EXCLUSIVE_SERIES_READY
		|| bundle.kinds.get(index) != Some(&PRIZE_EXCLUSIVE_NFT)
		|| mint_at(bundle, index)? != *series
		|| read_slot(&bundle.amounts, index)? != 1
		|| bundle.commitments[index * 32..(index + 1) * 32] != series_commitment(series, state)
	{
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	Ok(())
}

/// Reserve the next bundle slot for a configured series.
///
/// The slot counts as funded only after initialization binds the collection
/// and tree, so activation and cancellation fail while it is half set up.
fn reserve_exclusive_slot(
	bundle: &mut BundleStateZc,
	series: &Address,
	index: u8,
) -> ProgramResult {
	let slot = usize::from(index);

	if index != bundle.funded_assets
		|| index >= bundle.asset_count
		|| bundle.kinds[slot] != 0
		|| mint_at(bundle, slot)? != Address::default()
		|| bundle.commitments[slot * 32..(slot + 1) * 32] != [0; 32]
		|| read_slot(&bundle.amounts, slot)? != 0
		|| bundle.decimals[slot] != 0
	{
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	bundle.mints[slot * 32..(slot + 1) * 32].copy_from_slice(series.as_ref());
	write_slot(&mut bundle.amounts, slot, 1)?;
	bundle.kinds[slot] = PRIZE_EXCLUSIVE_NFT;

	Ok(())
}

fn clear_exclusive_slot(bundle: &mut BundleStateZc, index: u8) -> ProgramResult {
	let slot = usize::from(index);

	if index != bundle.funded_assets || bundle.kinds.get(slot) != Some(&PRIZE_EXCLUSIVE_NFT) {
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	bundle.mints[slot * 32..(slot + 1) * 32].fill(0);
	bundle.commitments[slot * 32..(slot + 1) * 32].fill(0);
	write_slot(&mut bundle.amounts, slot, 0)?;
	bundle.kinds[slot] = 0;

	Ok(())
}

/// One allocated claim's edition, traits, and tier bonus.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ExclusiveMint {
	traits: ExclusiveTraits,
	serial: u64,
	bonus_lamports: u64,
}

/// Advance the series counters for one mint and reserve its tier bonus.
///
/// The bonus is paid only while that tier's escrowed count lasts; otherwise
/// the winner receives the NFT alone.
fn record_exclusive_mint(
	state: &mut ExclusiveSeriesStateZc,
	traits: ExclusiveTraits,
) -> Result<ExclusiveMint, ProgramError> {
	let tier = usize::from(traits.tier);
	let serial = state
		.minted
		.get()
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;

	if serial > state.quantity.get() || tier >= EXCLUSIVE_TIER_COUNT {
		return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
	}

	let tier_minted = read_u32_slot(&state.tier_minted, tier)?
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let remaining = read_u32_slot(&state.bonus_remaining, tier)?;
	let bonus_lamports = if remaining == 0 {
		0
	} else {
		write_u32_slot(&mut state.bonus_remaining, tier, remaining - 1)?;
		read_slot(&state.bonus_lamports, tier)?
	};
	state.minted.set(serial);
	write_u32_slot(&mut state.tier_minted, tier, tier_minted)?;

	Ok(ExclusiveMint {
		traits,
		serial,
		bonus_lamports,
	})
}

/// Cap every tier's unpaid bonuses at the claims that can still happen.
///
/// No tier can be won more often than the remaining outstanding claims, so
/// trimming releases only lamports no holder can ever receive.
fn trim_bonus_reserves(state: &mut ExclusiveSeriesStateZc, outstanding: u64) -> ProgramResult {
	for tier in 0..EXCLUSIVE_TIER_COUNT {
		let remaining = read_u32_slot(&state.bonus_remaining, tier)?;
		let capped = u64::from(remaining).min(outstanding);
		write_u32_slot(
			&mut state.bonus_remaining,
			tier,
			u32::try_from(capped).map_err(|_| ProgramError::ArithmeticOverflow)?,
		)?;
	}

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for CreateExclusiveSeriesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = CreateExclusiveSeriesInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let template = as_template(self.template)?;
		assert_template(&template_address, &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_editable(&template)?;
		assert_bundle(self.bundle, &template_address)?;

		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let quantity = bundle.quantity.get();
		if bundle.status != BUNDLE_FUNDING || quantity > MAX_TOTAL_WEIGHT {
			return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
		}
		drop(bundle);

		let weights = exclusive_weights(&args.weights);
		exclusive_weight_total(&weights)?;
		validate_exclusive_trait_counts(ExclusiveTraitCounts {
			contents: args.contents_count,
			background: args.background_count,
			pattern: args.pattern_count,
		})?;
		validate_exclusive_text(&args.name_prefix, &args.symbol, &args.base_uri, quantity)?;
		let reserve =
			validate_bonus_reserves(&weights, &args.bonus_lamports, &args.bonus_counts, quantity)?;

		let seeds = ExclusiveSeriesState::seeds(&template_address);
		if self
			.exclusive_series
			.assert_canonical_bump(&seeds.as_slices(), &ID)?
			!= args.bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		let series_address = *self.exclusive_series.address();
		let fee_vault_seeds = [SEED_EXCLUSIVE_FEE_VAULT, series_address.as_ref()];
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

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		reserve_exclusive_slot(
			&mut bundle,
			self.exclusive_series.address(),
			args.asset_index,
		)?;
		drop(bundle);

		CreateProgramAccountWithBump {
			account: self.exclusive_series,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<ExclusiveSeriesState>()?;
		let rent_reserve = self.exclusive_series.lamports();
		let mut series = self
			.exclusive_series
			.as_account_mut::<ExclusiveSeriesState>(&ID)?;
		series.authority = *self.authority.address();
		series.template = template_address;
		series.bundle = bundle_address;
		series.quantity.set(quantity);
		series.rent_reserve.set(rent_reserve);
		series.mint_fee_lamports.set(BUBBLEGUM_MINT_V2_FEE_LAMPORTS);
		series.weights = args.weights;
		series.bonus_lamports = args.bonus_lamports;
		series.bonus_counts = args.bonus_counts;
		series.bonus_remaining = args.bonus_counts;
		series.name_prefix = args.name_prefix;
		series.symbol = args.symbol;
		series.base_uri = args.base_uri;
		series.asset_index = args.asset_index;
		series.contents_count = args.contents_count;
		series.background_count = args.background_count;
		series.pattern_count = args.pattern_count;
		series.status = EXCLUSIVE_SERIES_CONFIGURED;
		series.bump = args.bump;
		series.fee_vault_bump = args.fee_vault_bump;
		drop(series);

		if fee_top_up != 0 {
			system::instructions::Transfer {
				from: self.authority,
				to: self.fee_vault,
				lamports: fee_top_up,
			}
			.invoke()?;
		}

		if reserve == 0 {
			return Ok(());
		}

		system::instructions::Transfer {
			from: self.authority,
			to: self.exclusive_series,
			lamports: reserve,
		}
		.invoke()
	}
}

impl<'a> ProcessAccountInfos<'a> for InitializeExclusiveSeriesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = InitializeExclusiveSeriesInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let series_address = *self.exclusive_series.address();
		let template = as_template(self.template)?;
		assert_template(&template_address, &template)?;
		assert_template_authority(self.authority, &template)?;
		assert_treasury_editable(&template)?;
		assert_bundle(self.bundle, &template_address)?;

		let series = self
			.exclusive_series
			.as_account::<ExclusiveSeriesState>(&ID)?;
		let asset_index = series.asset_index;
		assert_series(
			&series_address,
			&series,
			&template_address,
			&bundle_address,
			asset_index,
		)?;
		let capacity = 1u64
			.checked_shl(u32::from(args.max_depth))
			.ok_or(ProgramError::ArithmeticOverflow)?;
		if series.status != EXCLUSIVE_SERIES_CONFIGURED
			|| !(MIN_EXCLUSIVE_TREE_DEPTH..=MAX_EXCLUSIVE_TREE_DEPTH).contains(&args.max_depth)
			|| capacity < series.quantity.get()
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
		}

		let bump = series.bump;
		let mut collection_name = BoundedText::<MAX_EXCLUSIVE_NAME_BYTES>::default();
		collection_name.push_text(&series.name_prefix[..text_len(&series.name_prefix)])?;
		let mut collection_uri = BoundedText::<MAX_EXCLUSIVE_URI_BYTES>::default();
		collection_uri.push_text(&series.base_uri[..text_len(&series.base_uri)])?;
		collection_uri.push_text(COLLECTION_URI_SUFFIX)?;
		drop(series);

		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let slot = usize::from(asset_index);
		if bundle.status != BUNDLE_FUNDING
			|| bundle.funded_assets != asset_index
			|| bundle.kinds.get(slot) != Some(&PRIZE_EXCLUSIVE_NFT)
			|| mint_at(&bundle, slot)? != series_address
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
		}
		drop(bundle);

		assert_tree_config_address(self.tree_config, self.merkle_tree.address())?;
		self.merkle_tree
			.assert_owner(&MPL_ACCOUNT_COMPRESSION_ID)?
			.assert_writable()?;

		let series_seeds = ExclusiveSeriesState::seeds(&template_address).with_bump(bump);
		let series_signer = series_seeds.to_signer();
		let signers = [series_signer.as_signer()];

		CreateCoreCollection {
			collection: self.collection,
			update_authority: self.exclusive_series,
			payer: self.authority,
			system_program: self.system_program,
			core_program: self.core_program,
			name: collection_name.as_bytes(),
			uri: collection_uri.as_bytes(),
		}
		.invoke_signed(&signers)?;

		CreateBubblegumTree {
			tree_config: self.tree_config,
			merkle_tree: self.merkle_tree,
			payer: self.authority,
			tree_creator: self.exclusive_series,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
			bubblegum_program: self.bubblegum_program,
			max_depth: u32::from(args.max_depth),
			max_buffer_size: args.max_buffer_size.get(),
		}
		.invoke_signed(&signers)?;

		assert_core_collection(self.collection, &series_address)?;
		let tree = read_tree_config(self.tree_config)?;
		if tree.tree_creator != series_address
			|| tree.tree_delegate != series_address
			|| tree.is_public
			|| tree.num_minted != 0
			|| tree.total_mint_capacity < capacity
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
		}

		let mut series = self
			.exclusive_series
			.as_account_mut::<ExclusiveSeriesState>(&ID)?;
		series.collection = *self.collection.address();
		series.merkle_tree = *self.merkle_tree.address();
		series.max_depth = args.max_depth;
		series.max_buffer_size.set(args.max_buffer_size.get());
		series.status = EXCLUSIVE_SERIES_READY;
		let commitment = series_commitment(&series_address, &series);
		drop(series);

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		bundle.commitments[slot * 32..(slot + 1) * 32].copy_from_slice(&commitment);
		bundle.funded_assets = bundle
			.funded_assets
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimExclusiveNftAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimExclusiveNftInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let opening_address = *self.opening.address();
		let bundle_address = *self.bundle.address();
		let series_address = *self.exclusive_series.address();
		let recipient_address = *self.recipient.address();
		let template = as_template(self.template)?;
		assert_template(&template_address, &template)?;
		assert_bundle(self.bundle, &template_address)?;

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		let mut series = self
			.exclusive_series
			.as_account_mut::<ExclusiveSeriesState>(&ID)?;
		assert_template_opening(&opening_address, &opening, &template_address)?;
		assert_series(
			&series_address,
			&series,
			&template_address,
			&bundle_address,
			args.asset_index,
		)?;
		assert_series_commitment(&bundle, &series_address, &series)?;

		// Security: the CPI targets only the committed tree and collection, and
		// the leaf owner is the recipient that `record_claim` binds below.
		if *self.merkle_tree.address() != series.merkle_tree
			|| *self.collection.address() != series.collection
		{
			return Err(lootbox_error(LootboxError::InvalidExclusiveSeries));
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
			&exclusive_weights(&series.weights),
			trait_counts(&series),
		)?;
		let mint = record_exclusive_mint(&mut series, traits)?;
		let required_after = series
			.rent_reserve
			.get()
			.checked_add(bonus_liability(
				&series.bonus_lamports,
				&series.bonus_remaining,
			)?)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let name = exclusive_nft_name(
			&series.name_prefix[..text_len(&series.name_prefix)],
			mint.serial,
		)?;
		let uri = exclusive_nft_uri(
			&series.base_uri[..text_len(&series.base_uri)],
			mint.traits,
			mint.serial,
		)?;
		let mut symbol = BoundedText::<MAX_EXCLUSIVE_SYMBOL_BYTES>::default();
		symbol.push_text(&series.symbol[..text_len(&series.symbol)])?;
		let collection = series.collection;
		let bump = series.bump;
		let fee_vault_bump = series.fee_vault_bump;
		drop(series);
		drop(opening);
		drop(bundle);

		let balance_after = self
			.exclusive_series
			.lamports()
			.checked_sub(mint.bonus_lamports)
			.ok_or_else(|| lootbox_error(LootboxError::Insolvent))?;
		if balance_after < required_after {
			return Err(lootbox_error(LootboxError::Insolvent));
		}

		assert_fee_vault(self.fee_vault, &series_address, fee_vault_bump)?;
		assert_tree_config_address(self.tree_config, self.merkle_tree.address())?;
		let nonce = read_tree_config(self.tree_config)?.num_minted;
		let asset = compressed_asset_id(self.merkle_tree.address(), nonce)?;
		let series_seeds = ExclusiveSeriesState::seeds(&template_address).with_bump(bump);
		let series_signer = series_seeds.to_signer();
		let fee_vault_bump = [fee_vault_bump];
		let fee_vault_signer = PdaSigner::from_slices([
			SEED_EXCLUSIVE_FEE_VAULT,
			series_address.as_ref(),
			fee_vault_bump.as_slice(),
		]);

		MintBubblegumLeaf {
			tree_config: self.tree_config,
			payer: self.fee_vault,
			tree_authority: self.exclusive_series,
			collection_authority: self.exclusive_series,
			leaf_owner: self.recipient,
			merkle_tree: self.merkle_tree,
			collection: self.collection,
			core_cpi_signer: self.core_cpi_signer,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			core_program: self.core_program,
			system_program: self.system_program,
			bubblegum_program: self.bubblegum_program,
			metadata: LeafMetadata {
				name: name.as_bytes(),
				symbol: symbol.as_bytes(),
				uri: uri.as_bytes(),
				collection: &collection,
			},
		}
		.invoke_signed(&[series_signer.as_signer(), fee_vault_signer.as_signer()])?;

		if mint.bonus_lamports != 0 {
			self.exclusive_series.assert_owner(&ID)?;
			self.exclusive_series
				.send_owned(&ID, mint.bonus_lamports, self.recipient)?;
		}

		ExclusiveNftMintedEvent::emit(|event| {
			event.template = template_address;
			event.opening = opening_address;
			event.series = series_address;
			event.beneficiary = recipient_address;
			event.asset = asset;
			event.seed = seed;
			event.serial.set(mint.serial);
			event.bonus_lamports.set(mint.bonus_lamports);
			event.tier = mint.traits.tier;
			event.contents = mint.traits.contents;
			event.background = mint.traits.background;
			event.pattern = mint.traits.pattern;
			Ok(())
		})
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimExclusiveReserveAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimExclusiveReserveInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let series_address = *self.exclusive_series.address();
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
		let mut series = self
			.exclusive_series
			.as_account_mut::<ExclusiveSeriesState>(&ID)?;
		assert_series(
			&series_address,
			&series,
			&template_address,
			&bundle_address,
			args.asset_index,
		)?;
		let fee_vault_bump = series.fee_vault_bump;
		let mint_fee = series.mint_fee_lamports.get();
		assert_fee_vault(self.fee_vault, &series_address, fee_vault_bump)?;

		// An unfinished series never counted as funded: release its slot and
		// return every escrowed lamport with the account rent.
		if series.status == EXCLUSIVE_SERIES_CONFIGURED {
			if bundle.status != BUNDLE_FUNDING {
				return Err(lootbox_error(LootboxError::InvalidState));
			}
			clear_exclusive_slot(&mut bundle, args.asset_index)?;
			drop(series);
			drop(bundle);
			drop(template_data);

			return self.close_series(&series_address, fee_vault_bump);
		}

		assert_series_commitment(&bundle, &series_address, &series)?;
		let slot = usize::from(args.asset_index);
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
			.checked_sub(read_slot(&bundle.claimed, slot)?)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let is_staged = bundle.status == BUNDLE_FUNDING;
		trim_bonus_reserves(&mut series, outstanding)?;
		let required = series
			.rent_reserve
			.get()
			.checked_add(bonus_liability(
				&series.bonus_lamports,
				&series.bonus_remaining,
			)?)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		drop(series);
		drop(bundle);
		drop(template_data);

		// A cancelled staged bundle never minted anything, so the whole series
		// closes and the template may configure a new one.
		if is_staged {
			return self.close_series(&series_address, fee_vault_bump);
		}

		let fee_surplus = self
			.fee_vault
			.lamports()
			.saturating_sub(required_fee_vault_balance(outstanding, mint_fee)?);
		withdraw_fee_vault(
			self.fee_vault,
			&series_address,
			fee_vault_bump,
			self.authority,
			fee_surplus,
		)?;

		let surplus = self
			.exclusive_series
			.lamports()
			.checked_sub(required)
			.ok_or_else(|| lootbox_error(LootboxError::Insolvent))?;
		if surplus == 0 {
			return Ok(());
		}

		self.exclusive_series.assert_owner(&ID)?;
		self.exclusive_series
			.send_owned(&ID, surplus, self.authority)
	}
}

impl ReclaimExclusiveReserveAccounts<'_> {
	/// Return the fee vault, bonus reserves, and series rent to the creator.
	fn close_series(self, series: &Address, fee_vault_bump: u8) -> ProgramResult {
		withdraw_fee_vault(
			self.fee_vault,
			series,
			fee_vault_bump,
			self.authority,
			self.fee_vault.lamports(),
		)?;

		self.exclusive_series
			.close_account_zeroed(&ID, self.authority)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn ready_series(quantity: u64) -> [u8; ExclusiveSeriesState::SIZE] {
		let mut bytes = [0u8; ExclusiveSeriesState::SIZE];
		let state = ExclusiveSeriesState::initialize(&mut bytes, |_| Ok(())).expect("series");
		state.quantity.set(quantity);
		state.status = EXCLUSIVE_SERIES_READY;
		bytes
	}

	fn tier_traits(tier: u8) -> ExclusiveTraits {
		ExclusiveTraits {
			tier,
			contents: 0,
			background: 0,
			pattern: 0,
		}
	}

	#[test]
	fn bonus_reserves_are_paid_once_per_funded_count_then_exhausted() {
		let mut bytes = ready_series(3);
		let state = ExclusiveSeriesState::try_from_bytes_mut(&mut bytes).expect("series");
		write_slot(&mut state.bonus_lamports, 15, 1_000).expect("bonus");
		write_u32_slot(&mut state.bonus_remaining, 15, 1).expect("count");
		assert_eq!(
			bonus_liability(&state.bonus_lamports, &state.bonus_remaining),
			Ok(1_000)
		);

		let first = record_exclusive_mint(state, tier_traits(15)).expect("first mint");
		assert_eq!((first.serial, first.bonus_lamports), (1, 1_000));
		assert_eq!(
			bonus_liability(&state.bonus_lamports, &state.bonus_remaining),
			Ok(0)
		);
		let second = record_exclusive_mint(state, tier_traits(15)).expect("second mint");
		assert_eq!((second.serial, second.bonus_lamports), (2, 0));
		assert_eq!(read_u32_slot(&state.tier_minted, 15), Ok(2));
		let third = record_exclusive_mint(state, tier_traits(0)).expect("third mint");
		assert_eq!((third.serial, third.bonus_lamports), (3, 0));
		assert_eq!(
			record_exclusive_mint(state, tier_traits(0)),
			Err(lootbox_error(LootboxError::InvalidExclusiveSeries))
		);
		assert_eq!(state.minted.get(), 3);
	}

	#[test]
	fn reserve_validation_rejects_unreachable_or_unbacked_bonuses() {
		let mut weights = [0u32; 16];
		weights[0] = 1;
		weights[15] = 1;
		let mut lamports = [0u8; 128];
		let mut counts = [0u8; 64];
		assert_eq!(
			validate_bonus_reserves(&weights, &lamports, &counts, 5),
			Ok(0)
		);

		write_slot(&mut lamports, 15, 7).expect("lamports");
		assert!(validate_bonus_reserves(&weights, &lamports, &counts, 5).is_err());
		write_u32_slot(&mut counts, 15, 2).expect("count");
		assert_eq!(
			validate_bonus_reserves(&weights, &lamports, &counts, 5),
			Ok(14)
		);
		write_u32_slot(&mut counts, 15, 6).expect("count above quantity");
		assert!(validate_bonus_reserves(&weights, &lamports, &counts, 5).is_err());

		write_u32_slot(&mut counts, 15, 0).expect("reset");
		write_slot(&mut lamports, 15, 0).expect("reset");
		write_slot(&mut lamports, 7, 7).expect("zero-weight tier");
		write_u32_slot(&mut counts, 7, 1).expect("zero-weight tier");
		assert!(validate_bonus_reserves(&weights, &lamports, &counts, 5).is_err());

		let mut huge = [0u8; 128];
		let mut many = [0u8; 64];
		write_slot(&mut huge, 0, u64::MAX).expect("huge");
		write_u32_slot(&mut many, 0, 2).expect("many");
		assert_eq!(
			validate_bonus_reserves(&weights, &huge, &many, 5),
			Err(ProgramError::ArithmeticOverflow)
		);
	}

	#[test]
	fn trimming_never_drops_below_outstanding_claims() {
		let mut bytes = ready_series(10);
		let state = ExclusiveSeriesState::try_from_bytes_mut(&mut bytes).expect("series");
		write_slot(&mut state.bonus_lamports, 3, 100).expect("bonus");
		write_u32_slot(&mut state.bonus_remaining, 3, 5).expect("count");
		write_slot(&mut state.bonus_lamports, 4, 100).expect("bonus");
		write_u32_slot(&mut state.bonus_remaining, 4, 1).expect("count");

		trim_bonus_reserves(state, 2).expect("trim");
		assert_eq!(read_u32_slot(&state.bonus_remaining, 3), Ok(2));
		assert_eq!(read_u32_slot(&state.bonus_remaining, 4), Ok(1));
		trim_bonus_reserves(state, 0).expect("trim all");
		assert_eq!(
			bonus_liability(&state.bonus_lamports, &state.bonus_remaining),
			Ok(0)
		);
	}

	#[test]
	fn slots_are_reserved_once_and_committed_terms_are_pinned() {
		let series = Address::new_from_array([4; 32]);
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes, |_| Ok(())).expect("bundle");
		bundle.quantity.set(2);
		bundle.asset_count = 2;
		assert!(reserve_exclusive_slot(bundle, &series, 1).is_err());
		reserve_exclusive_slot(bundle, &series, 0).expect("reserve");
		assert!(reserve_exclusive_slot(bundle, &series, 0).is_err());
		assert!(has_reserved_slot(bundle).expect("reserved"));

		let mut bytes = ready_series(2);
		let state = ExclusiveSeriesState::try_from_bytes_mut(&mut bytes).expect("series");
		let commitment = series_commitment(&series, state);
		bundle.commitments[..32].copy_from_slice(&commitment);
		assert_eq!(assert_series_commitment(bundle, &series, state), Ok(()));

		state.weights[0] = 1;
		assert!(assert_series_commitment(bundle, &series, state).is_err());
		state.weights[0] = 0;
		state.base_uri[0] = b'x';
		assert!(assert_series_commitment(bundle, &series, state).is_err());
		state.base_uri[0] = 0;
		state.status = EXCLUSIVE_SERIES_CONFIGURED;
		assert!(assert_series_commitment(bundle, &series, state).is_err());
	}

	#[test]
	fn series_layout_is_fixed() {
		assert_eq!(
			ExclusiveSeriesState::SIZE,
			size_of::<ExclusiveSeriesStateZc>()
		);
	}
}
