//! Finite, fully escrowed prize bundles and reusable Token-2022 box templates.

use pina::sysvars::Sysvar;
use pina::sysvars::rent::Rent;

use crate::*;

mod opening;
pub use opening::*;

mod claims;
pub use claims::*;

mod retirement;
pub use retirement::*;

mod collections;
pub use collections::*;

mod close;
pub use close::*;

const SEED_TEMPLATE: &[u8] = b"template";
const SEED_BUNDLE: &[u8] = b"bundle";
const SEED_TEMPLATE_OPENING: &[u8] = b"template-opening";
const SEED_SERVICE_VAULT: &[u8] = b"service-vault";
const SEED_RESULT_RECEIPT: &[u8] = b"result-receipt";
const MANIFEST_BUNDLE_DOMAIN: &[u8] = b"pina-lootbox-manifest-bundle";
const MANIFEST_DOMAIN: &[u8] = b"pina-lootbox-manifest";
/// Maximum assets delivered by one winning bundle.
pub const MAX_PRIZE_ASSETS: usize = 4;
/// A native SOL prize, denominated in lamports.
pub const PRIZE_SOL: u8 = 0;
/// A classic SPL Token prize, denominated in base units.
pub const PRIZE_TOKEN: u8 = 1;
/// A unique, non-freezable classic SPL mint with revoked mint authority.
pub const PRIZE_NFT: u8 = 2;
/// A safe fungible Token-2022 prize.
pub const PRIZE_TOKEN_2022: u8 = 3;
/// A standard Token Metadata NFT with no programmable transfer rules.
pub const PRIZE_METADATA_NFT: u8 = 4;
/// A Metaplex Core asset.
pub const PRIZE_CORE_ASSET: u8 = 5;
/// A Bubblegum compressed NFT.
pub const PRIZE_COMPRESSED_NFT: u8 = 6;

const TEMPLATE_DRAFT: u8 = 0;
const TEMPLATE_LIVE: u8 = 1;
const TEMPLATE_RETIRED: u8 = 2;
const BUNDLE_FUNDING: u8 = 0;
const BUNDLE_ACTIVE: u8 = 1;

/// Immutable template terms and the live finite inventory.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [SEED_TEMPLATE, authority: Address, id: u64], bump = bump)]
pub struct TemplateState {
	pub authority: Address,
	pub box_mint: Address,
	pub oracle_program: Address,
	pub oracle_queue: Address,
	pub id: u64,
	pub opens_at: i64,
	/// Timestamp at which the creator irreversibly fixed inventory and supply.
	/// Zero means the treasury is still editable.
	pub locked_at: i64,
	/// Total bundle tickets ever activated. This is the lifetime issuance cap.
	pub total_bundles: u64,
	pub total_minted: u64,
	pub remaining_bundles: u64,
	pub pending_openings: u64,
	pub next_request: u64,
	pub next_allocation: u64,
	/// Increments after every activated append; snapshotted by each opening.
	pub revision: u64,
	/// Incremental commitment to every activated bundle in append order.
	pub manifest_accumulator: [u8; 32],
	/// Final treasury commitment. Zero until the treasury is locked.
	pub manifest_hash: [u8; 32],
	/// Reward paid from the creator-funded service vault to a successful crank.
	pub settlement_bounty_lamports: u64,
	/// Rent prepaid for each optional immutable result receipt at market lock.
	pub result_receipt_rent_lamports: u64,
	/// Receipt allocations still covered by the isolated service vault.
	pub remaining_result_receipts: u64,
	/// Settlement or forfeiture cranks still covered by the service vault.
	pub remaining_settlement_bounties: u64,
	/// Undrawn inventory per append-only bundle, encoded as little-endian u64s.
	pub remaining: [u8; 2048],
	/// Null-padded UTF-8 display name; never used for authorization.
	pub name: [u8; 32],
	/// Null-padded UTF-8 metadata URI; terms on chain remain authoritative.
	pub uri: [u8; 200],
	pub bundle_count: u32,
	/// 0 draft, 1 live, 2 retired. `locked_at` independently records the
	/// irreversible market lock so retirement never erases that fact.
	pub status: u8,
	/// Whether allocation creates a permanent result receipt at creator expense.
	pub result_receipts_enabled: bool,
	pub bump: u8,
	/// Canonical service vault bump, fixed when the treasury is locked.
	pub service_vault_bump: u8,
}

/// A complete prize outcome and its escrow authority, shared across all boxes.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [SEED_BUNDLE, template: Address, index: u32], bump = bump)]
pub struct BundleState {
	pub template: Address,
	pub quantity: u64,
	pub rent_reserve: u64,
	/// Four asset identifiers; the zero address denotes native SOL.
	pub mints: [u8; 128],
	/// Four little-endian base-unit amounts paid per winning bundle.
	pub amounts: [u8; 32],
	/// Four little-endian counts released through claims or retirement recovery.
	pub claimed: [u8; 32],
	pub kinds: [u8; 4],
	pub decimals: [u8; 4],
	pub activated_revision: u64,
	pub index: u32,
	pub asset_count: u8,
	pub funded_assets: u8,
	pub reclaimed_mask: u8,
	/// 0 funding, 1 active.
	pub status: u8,
	pub bump: u8,
}

/// A burned box, its verified entropy, and independently claimable winning assets.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [SEED_TEMPLATE_OPENING, template: Address, randomness: Address], bump = bump)]
pub struct TemplateOpeningState {
	pub template: Address,
	/// Authority that owned and burned the box.
	pub box_authority: Address,
	/// Immutable destination for every prize claim.
	pub beneficiary: Address,
	/// Account that receives opening rent when the lifecycle is closed.
	pub rent_refund: Address,
	/// Optional program expected to consume the result receipt.
	pub consumer_program: Address,
	/// Consumer-selected correlation key, fixed before randomness is known.
	pub consumer_context: [u8; 32],
	pub randomness: Address,
	pub sequence: u64,
	pub seed_slot: u64,
	pub entropy: [u8; 32],
	/// Treasury revision and bundle prefix fixed before the box is burned.
	pub treasury_revision: u64,
	pub eligible_bundle_count: u32,
	/// 0 committed, 1 verified, 2 allocated, 3 delivered, 4 forfeited.
	pub status: u8,
	pub selected_bundle: u32,
	pub claimed_mask: u8,
	pub bump: u8,
}

/// Optional immutable allocation result for consumption by another program.
///
/// No instruction mutates or closes this account after initialization.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [SEED_RESULT_RECEIPT, opening: Address], bump = bump)]
pub struct ResultReceiptState {
	pub template: Address,
	pub opening: Address,
	pub box_authority: Address,
	pub beneficiary: Address,
	pub consumer_program: Address,
	pub consumer_context: [u8; 32],
	pub manifest_hash: [u8; 32],
	pub randomness: Address,
	pub sequence: u64,
	pub selected_bundle: u32,
	pub bump: u8,
}

#[cfg(test)]
mod layout_tests {
	use core::mem::size_of;

	use super::*;

	#[test]
	fn template_layout_reserves_all_256_inventory_slots() {
		assert_eq!(TemplateState::SIZE, size_of::<TemplateStateZc>());
		const { assert!(TemplateState::SIZE > 2_495) };
		const { assert!(TemplateState::SIZE <= 2_800) };
		assert_eq!(BundleState::SIZE, size_of::<BundleStateZc>());
		const { assert!(BundleState::SIZE <= 320) };
		assert_eq!(
			TemplateOpeningState::SIZE,
			size_of::<TemplateOpeningStateZc>()
		);
		const { assert!(TemplateOpeningState::SIZE <= 384) };
		assert_eq!(ResultReceiptState::SIZE, size_of::<ResultReceiptStateZc>());
		const { assert!(ResultReceiptState::SIZE <= 320) };
	}

	#[test]
	fn manifest_commits_to_bundle_and_service_terms() {
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes).expect("bundle");
		bundle.index.set(3);
		bundle.quantity.set(7);
		bundle.asset_count = 1;
		bundle.amounts[..8].copy_from_slice(&42u64.to_le_bytes());
		let first = next_manifest_accumulator(&[0; 32], bundle);
		bundle.amounts[..8].copy_from_slice(&43u64.to_le_bytes());
		assert_ne!(first, next_manifest_accumulator(&[0; 32], bundle));

		let mut template_bytes = [0; TemplateState::SIZE];
		let template = TemplateState::initialize(&mut template_bytes).expect("template");
		template.total_bundles.set(7);
		template.bundle_count.set(1);
		template.manifest_accumulator = first;
		let address = Address::new_from_array([9; 32]);
		let without_receipts = locked_manifest_hash(&address, template);
		template.result_receipts_enabled.set(true);
		assert_ne!(without_receipts, locked_manifest_hash(&address, template));
	}
}

#[instruction(discriminator = LootboxInstruction::CreateTemplate)]
pub struct CreateTemplateInstruction {
	pub id: u64,
	pub opens_at: i64,
	pub oracle_program: Address,
	pub oracle_queue: Address,
	pub name: [u8; 32],
	pub uri: [u8; 200],
	pub settlement_bounty_lamports: u64,
	pub result_receipts_enabled: bool,
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::AddBundle)]
pub struct AddBundleInstruction {
	pub quantity: u64,
	pub asset_count: u8,
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::FundSolPrize)]
pub struct FundSolPrizeInstruction {
	pub lamports_per_win: u64,
}

#[instruction(discriminator = LootboxInstruction::FundTokenPrize)]
pub struct FundTokenPrizeInstruction {
	pub amount_per_win: u64,
	pub is_nft: bool,
}

#[instruction(discriminator = LootboxInstruction::SealTemplate)]
pub struct SealTemplateInstruction {}

#[instruction(discriminator = LootboxInstruction::LockTreasury)]
pub struct LockTreasuryInstruction {
	pub service_vault_bump: u8,
}

#[instruction(discriminator = LootboxInstruction::MintTemplateBoxes)]
pub struct MintTemplateBoxesInstruction {
	pub amount: u64,
}

#[instruction(discriminator = LootboxInstruction::ActivateBundle)]
pub struct ActivateBundleInstruction {}

#[instruction(discriminator = LootboxInstruction::CancelBundle)]
pub struct CancelBundleInstruction {}

#[derive(Accounts, Debug)]
pub struct CreateTemplateAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a mut AccountView,
	pub box_mint: &'a AccountView,
	pub system_program: &'a AccountView,
	pub box_token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct AddBundleAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct FundSolPrizeAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct FundTokenPrizeAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub mint: &'a AccountView,
	pub source: &'a mut AccountView,
	pub escrow: &'a mut AccountView,
	pub token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct SealTemplateAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct LockTreasuryAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a mut AccountView,
	pub box_mint: &'a mut AccountView,
	/// The first unused bundle PDA proves that no funded tail was omitted.
	pub bundle: &'a AccountView,
	/// Created and creator-funded only when receipts or crank bounties are enabled.
	pub service_vault: &'a mut AccountView,
	pub system_program: &'a AccountView,
	pub box_token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct MintTemplateBoxesAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a mut AccountView,
	pub box_mint: &'a mut AccountView,
	pub recipient_box_account: &'a mut AccountView,
	pub box_token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct ActivateBundleAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct CancelBundleAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
}

fn assert_template(address: &Address, state: &TemplateStateZc) -> ProgramResult {
	let seeds = TemplateState::seeds(&state.authority, state.id.get()).with_bump(state.bump);

	if *address != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	Ok(())
}

fn assert_bundle(account: &AccountView, template: &Address) -> ProgramResult {
	let bundle = account.as_account::<BundleState>(&ID)?;

	if bundle.template != *template {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	let seeds = BundleState::seeds(template, bundle.index.get()).with_bump(bundle.bump);
	account.assert_seeds_with_bump(&seeds.as_slices(), &ID)?;

	Ok(())
}

fn has_service_vault(state: &TemplateStateZc) -> bool {
	state.result_receipts_enabled.get() || state.settlement_bounty_lamports.get() != 0
}

fn assert_service_vault(
	account: &AccountView,
	template: &Address,
	state: &TemplateStateZc,
) -> ProgramResult {
	if !has_service_vault(state) {
		return Ok(());
	}

	let bump = [state.service_vault_bump];
	let seeds = [SEED_SERVICE_VAULT, template.as_ref(), bump.as_slice()];
	account.assert_seeds_with_bump(&seeds, &ID)?;
	if account.owner() != &system::ID || !account.is_data_empty() {
		return Err(lootbox_error(LootboxError::InvalidServiceAccount));
	}

	Ok(())
}

fn required_service_balance(state: &TemplateStateZc) -> Result<u64, ProgramError> {
	let receipts = state
		.result_receipt_rent_lamports
		.get()
		.checked_mul(state.remaining_result_receipts.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let bounties = state
		.settlement_bounty_lamports
		.get()
		.checked_mul(state.remaining_settlement_bounties.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;

	receipts
		.checked_add(bounties)
		.ok_or(ProgramError::ArithmeticOverflow)
}

fn assert_template_authority(authority: &AccountView, state: &TemplateStateZc) -> ProgramResult {
	authority.assert_signer()?;
	assert_authority_address(authority, &state.authority)
}

fn assert_treasury_unlocked(state: &TemplateStateZc) -> ProgramResult {
	if state.locked_at.get() != 0 {
		return Err(lootbox_error(LootboxError::TreasuryLocked));
	}

	Ok(())
}

fn assert_treasury_editable(state: &TemplateStateZc) -> ProgramResult {
	assert_treasury_unlocked(state)?;

	if state.status == TEMPLATE_RETIRED {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	Ok(())
}

fn read_slot<const N: usize>(slots: &[u8; N], index: usize) -> Result<u64, ProgramError> {
	let start = index
		.checked_mul(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let end = start
		.checked_add(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let bytes = slots
		.get(start..end)
		.ok_or(ProgramError::InvalidAccountData)?;

	Ok(u64::from_le_bytes(
		bytes
			.try_into()
			.map_err(|_| ProgramError::InvalidAccountData)?,
	))
}

fn write_slot<const N: usize>(slots: &mut [u8; N], index: usize, value: u64) -> ProgramResult {
	let start = index
		.checked_mul(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let end = start
		.checked_add(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	slots
		.get_mut(start..end)
		.ok_or(ProgramError::InvalidAccountData)?
		.copy_from_slice(&value.to_le_bytes());

	Ok(())
}

fn next_manifest_accumulator(previous: &[u8; 32], bundle: &BundleStateZc) -> [u8; 32] {
	let index = bundle.index.get().to_le_bytes();
	let quantity = bundle.quantity.get().to_le_bytes();
	let asset_count = [bundle.asset_count];
	let digest = hashv(&[
		MANIFEST_BUNDLE_DOMAIN,
		previous,
		&index,
		&quantity,
		&asset_count,
		&bundle.mints,
		&bundle.amounts,
		&bundle.kinds,
		&bundle.decimals,
	]);
	let mut result = [0u8; 32];
	result.copy_from_slice(digest.as_ref());

	result
}

fn locked_manifest_hash(template: &Address, state: &TemplateStateZc) -> [u8; 32] {
	let id = state.id.get().to_le_bytes();
	let opens_at = state.opens_at.get().to_le_bytes();
	let total_bundles = state.total_bundles.get().to_le_bytes();
	let bundle_count = state.bundle_count.get().to_le_bytes();
	let settlement_bounty = state.settlement_bounty_lamports.get().to_le_bytes();
	let result_receipts_enabled = [u8::from(state.result_receipts_enabled.get())];
	let digest = hashv(&[
		MANIFEST_DOMAIN,
		template.as_ref(),
		state.authority.as_ref(),
		state.box_mint.as_ref(),
		state.oracle_program.as_ref(),
		state.oracle_queue.as_ref(),
		&id,
		&opens_at,
		&total_bundles,
		&bundle_count,
		&settlement_bounty,
		&result_receipts_enabled,
		&state.manifest_accumulator,
	]);
	let mut result = [0u8; 32];
	result.copy_from_slice(digest.as_ref());

	result
}

fn mint_at(bundle: &BundleStateZc, index: usize) -> Result<Address, ProgramError> {
	if index >= MAX_PRIZE_ASSETS {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	parse_address(&bundle.mints, index * 32)
}

fn available_in_prefix(state: &TemplateStateZc, count: u32) -> Result<u64, ProgramError> {
	let count = usize::try_from(count).map_err(|_| ProgramError::InvalidAccountData)?;
	if count > MAX_TEMPLATE_BUNDLES {
		return Err(ProgramError::InvalidAccountData);
	}

	(0..count).try_fold(0u64, |total, index| {
		total
			.checked_add(read_slot(&state.remaining, index)?)
			.ok_or(ProgramError::ArithmeticOverflow)
	})
}

fn assert_template_mint(
	mint: &AccountView,
	template: &Address,
	expected: &Address,
	is_locked: bool,
) -> Result<u64, ProgramError> {
	mint.assert_address(expected)?;
	let data = mint
		.as_token_mint_for_program(&token_2022::ID)?
		.assert_extensions_allowed(&[
			token_2022::state::ExtensionType::MetadataPointer,
			token_2022::state::ExtensionType::TokenMetadata,
		])?;

	let expected_authority = if is_locked { None } else { Some(template) };

	if data.decimals() != 0
		|| data.mint_authority() != expected_authority
		|| data.freeze_authority().is_some()
	{
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	// Use the standard on-mint metadata interface, not a pointer to a proprietary
	// account layout that wallets cannot decode.
	let extension = data
		.token_2022()
		.ok_or(ProgramError::InvalidAccountData)?
		.get_extension::<token_2022::state::MetadataPointerExtension>()?;
	if extension.authority.as_ref().is_some()
		|| extension.metadata_address.as_ref() != Some(expected)
	{
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	Ok(data.supply())
}

fn metadata_bytes(data: &[u8]) -> Result<&[u8], ProgramError> {
	// Token-2022 extended mints pad the base to 165 bytes, followed by the
	// account-type byte and (u16 type, u16 length, value) TLV entries.
	let mut entries = data.get(166..).ok_or(ProgramError::InvalidAccountData)?;
	// The mint allowlist permits only MetadataPointer and TokenMetadata.
	for _ in 0..2 {
		if entries.len() < 4 {
			break;
		}
		let kind = u16::from_le_bytes([entries[0], entries[1]]);
		let length = usize::from(u16::from_le_bytes([entries[2], entries[3]]));
		let value = entries
			.get(4..4 + length)
			.ok_or(ProgramError::InvalidAccountData)?;
		if kind == token_2022::state::ExtensionType::TokenMetadata as u16 {
			return Ok(value);
		}
		entries = entries
			.get(4 + length..)
			.ok_or(ProgramError::InvalidAccountData)?;
	}

	Err(lootbox_error(LootboxError::InvalidMint))
}

fn take_metadata_string<'a>(data: &mut &'a [u8]) -> Result<&'a [u8], ProgramError> {
	let prefix: [u8; 4] = data
		.get(..4)
		.ok_or(ProgramError::InvalidAccountData)?
		.try_into()
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let length = usize::try_from(u32::from_le_bytes(prefix))
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let end = 4usize
		.checked_add(length)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let value = data.get(4..end).ok_or(ProgramError::InvalidAccountData)?;
	*data = data.get(end..).ok_or(ProgramError::InvalidAccountData)?;

	Ok(value)
}

fn assert_metadata(mint: &AccountView, name: &[u8; 32], uri: &[u8; 200]) -> ProgramResult {
	let data = mint.try_borrow()?;
	let metadata = metadata_bytes(&data)?;
	if metadata.get(..32) != Some([0u8; 32].as_slice())
		|| parse_address(metadata, 32)? != *mint.address()
	{
		return Err(lootbox_error(LootboxError::InvalidMint));
	}
	let mut strings = metadata.get(64..).ok_or(ProgramError::InvalidAccountData)?;
	let metadata_name = take_metadata_string(&mut strings)?;
	let _symbol = take_metadata_string(&mut strings)?;
	let metadata_uri = take_metadata_string(&mut strings)?;
	let name_length = name
		.iter()
		.position(|byte| *byte == 0)
		.unwrap_or(name.len());
	let uri_length = uri.iter().position(|byte| *byte == 0).unwrap_or(uri.len());

	if metadata_name != &name[..name_length] || metadata_uri != &uri[..uri_length] {
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	Ok(())
}

fn validate_text<const N: usize>(text: &[u8; N], required: bool) -> ProgramResult {
	let length = text.iter().position(|byte| *byte == 0).unwrap_or(N);
	let value = core::str::from_utf8(&text[..length]).map_err(|_| ProgramError::InvalidArgument)?;

	if (required && value.trim().is_empty())
		|| text[length..].iter().any(|byte| *byte != 0)
		|| value.chars().any(char::is_control)
	{
		return Err(ProgramError::InvalidArgument);
	}

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for CreateTemplateAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = CreateTemplateInstruction::try_from_bytes(data)?;
		self.authority.assert_signer()?.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.box_token_program.assert_address(&token_2022::ID)?;
		assert_known_oracle_program(&args.oracle_program)?;
		validate_text(&args.name, true)?;
		validate_text(&args.uri, false)?;

		if args.opens_at.get() < 0 || args.oracle_queue == Address::default() {
			return Err(ProgramError::InvalidArgument);
		}

		let seeds = TemplateState::seeds(self.authority.address(), args.id.get());
		if self
			.template
			.assert_canonical_bump(&seeds.as_slices(), &ID)?
			!= args.bump
		{
			return Err(ProgramError::InvalidSeeds);
		}

		self.template.assert_empty()?.assert_writable()?;
		if assert_template_mint(
			self.box_mint,
			self.template.address(),
			self.box_mint.address(),
			false,
		)? != 0
		{
			return Err(lootbox_error(LootboxError::InvalidMint));
		}
		assert_metadata(self.box_mint, &args.name, &args.uri)?;

		CreateProgramAccountWithBump {
			account: self.template,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<TemplateState>()?;
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		state.authority = *self.authority.address();
		state.box_mint = *self.box_mint.address();
		state.oracle_program = args.oracle_program;
		state.oracle_queue = args.oracle_queue;
		state.id.set(args.id.get());
		state.opens_at.set(args.opens_at.get());
		state.name = args.name;
		state.uri = args.uri;
		state
			.settlement_bounty_lamports
			.set(args.settlement_bounty_lamports.get());
		state
			.result_receipts_enabled
			.set(args.result_receipts_enabled.get());
		state.status = TEMPLATE_DRAFT;
		state.bump = args.bump;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for AddBundleAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AddBundleInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		self.authority.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.bundle.assert_empty()?.assert_writable()?;

		if usize::try_from(state.bundle_count.get())
			.map_err(|_| ProgramError::InvalidAccountData)?
			>= MAX_TEMPLATE_BUNDLES
			|| args.asset_count == 0
			|| usize::from(args.asset_count) > MAX_PRIZE_ASSETS
			|| args.quantity.get() == 0
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let index = state.bundle_count.get();
		let seeds = BundleState::seeds(&template_address, index);
		if self.bundle.assert_canonical_bump(&seeds.as_slices(), &ID)? != args.bump {
			return Err(ProgramError::InvalidSeeds);
		}

		drop(state);

		CreateProgramAccountWithBump {
			account: self.bundle,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<BundleState>()?;
		let rent = self.bundle.lamports();
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		bundle.template = template_address;
		bundle.quantity.set(args.quantity.get());
		bundle.rent_reserve.set(rent);
		bundle.index.set(index);
		bundle.asset_count = args.asset_count;
		bundle.status = BUNDLE_FUNDING;
		bundle.bump = args.bump;

		Ok(())
	}
}

fn record_prize(
	bundle: &mut BundleStateZc,
	mint: &Address,
	amount: u64,
	kind: u8,
	decimals: u8,
) -> Result<u64, ProgramError> {
	let index = usize::from(bundle.funded_assets);
	if index >= usize::from(bundle.asset_count) || amount == 0 {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	for previous in 0..index {
		if mint_at(bundle, previous)? == *mint {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
	}

	let deposit = amount
		.checked_mul(bundle.quantity.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	bundle.mints[index * 32..(index + 1) * 32].copy_from_slice(mint.as_ref());
	write_slot(&mut bundle.amounts, index, amount)?;
	bundle.kinds[index] = kind;
	bundle.decimals[index] = decimals;
	bundle.funded_assets = bundle
		.funded_assets
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;

	Ok(deposit)
}

impl<'a> ProcessAccountInfos<'a> for FundSolPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundSolPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		self.system_program.assert_address(&system::ID)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		let deposit = record_prize(
			&mut bundle,
			&Address::default(),
			args.lamports_per_win.get(),
			PRIZE_SOL,
			9,
		)?;
		drop(bundle);
		drop(state);

		system::instructions::Transfer {
			from: self.authority,
			to: self.bundle,
			lamports: deposit,
		}
		.invoke()
	}
}

impl<'a> ProcessAccountInfos<'a> for FundTokenPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundTokenPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let token_program = *self.token_program.address();
		if token_program != token::ID && token_program != token_2022::ID {
			return Err(ProgramError::IncorrectProgramId);
		}
		let mint = self
			.mint
			.as_token_mint_for_program(&token_program)?
			.assert_extensions_allowed(&[
				token_2022::state::ExtensionType::MetadataPointer,
				token_2022::state::ExtensionType::TokenMetadata,
			])?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if mint.freeze_authority().is_some() || self.mint.address() == &WRAPPED_SOL_MINT_ID {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		if (args.is_nft.get() && token_program != token::ID)
			|| (args.is_nft.get()
				&& (mint.supply() != 1
					|| mint.decimals() != 0
					|| mint.mint_authority().is_some()
					|| bundle.quantity.get() != 1
					|| args.amount_per_win.get() != 1))
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let decimals = mint.decimals();
		drop(mint);
		let escrow = self.escrow.as_associated_token_account_checked(
			&bundle_address,
			self.mint.address(),
			&token_program,
		)?;
		// Security: an escrow delegate or close authority could steal collateral.
		if escrow.delegate().is_some() || escrow.close_authority().is_some() || escrow.is_frozen() {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(escrow);
		let kind = if args.is_nft.get() {
			PRIZE_NFT
		} else if token_program == token_2022::ID {
			PRIZE_TOKEN_2022
		} else {
			PRIZE_TOKEN
		};
		let deposit = record_prize(
			&mut bundle,
			self.mint.address(),
			args.amount_per_win.get(),
			kind,
			decimals,
		)?;
		drop(bundle);
		drop(state);

		if token_program == token_2022::ID {
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::TransferChecked::new(
				self.source,
				self.mint,
				self.escrow,
				self.authority,
				deposit,
				decimals,
			)
			.invoke()
		} else {
			self.token_program.assert_address(&token::ID)?;
			token::instructions::TransferChecked::new(
				self.source,
				self.mint,
				self.escrow,
				self.authority,
				deposit,
				decimals,
			)
			.invoke()
		}
	}
}

impl<'a> ProcessAccountInfos<'a> for SealTemplateAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = SealTemplateInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		if state.status != TEMPLATE_DRAFT {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if state.bundle_count.get() == 0 {
			return Err(lootbox_error(LootboxError::IncompleteConfiguration));
		}

		state.status = TEMPLATE_LIVE;

		Ok(())
	}
}

fn validate_market_lock(state: &TemplateStateZc, supply: u64, now: i64) -> ProgramResult {
	if state.status != TEMPLATE_LIVE || state.locked_at.get() != 0 {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	if state.opens_at.get() <= now {
		return Err(lootbox_error(LootboxError::RevealDatePassed));
	}

	let total = state.total_bundles.get();
	let is_pristine = total != 0
		&& state.bundle_count.get() != 0
		&& state.remaining_bundles.get() == total
		&& state.pending_openings.get() == 0
		&& state.next_request.get() == 0
		&& state.next_allocation.get() == 0;
	let exact_supply = state.total_minted.get() == total && supply == total;

	if !is_pristine || !exact_supply {
		return Err(lootbox_error(LootboxError::SupplyMismatch));
	}

	Ok(())
}

fn service_budget(state: &TemplateStateZc) -> Result<(u64, u64), ProgramError> {
	let receipt_rent = if state.result_receipts_enabled.get() {
		Rent::get()?.try_minimum_balance(ResultReceiptState::SIZE)?
	} else {
		0
	};
	let receipt_budget = receipt_rent
		.checked_mul(state.total_bundles.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let bounty_budget = state
		.settlement_bounty_lamports
		.get()
		.checked_mul(state.total_bundles.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let total = receipt_budget
		.checked_add(bounty_budget)
		.ok_or(ProgramError::ArithmeticOverflow)?;

	Ok((receipt_rent, total))
}

impl<'a> ProcessAccountInfos<'a> for LockTreasuryAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = LockTreasuryInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let now = sysvars::clock::Clock::get()?.unix_timestamp;
		self.authority.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.box_token_program.assert_address(&token_2022::ID)?;
		let state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		let supply =
			assert_template_mint(self.box_mint, &template_address, &state.box_mint, false)?;
		validate_market_lock(&state, supply, now)?;

		let next_bundle_seeds = BundleState::seeds(&template_address, state.bundle_count.get());
		self.bundle
			.assert_canonical_bump(&next_bundle_seeds.as_slices(), &ID)?;
		self.bundle.assert_empty()?;
		let service_vault_seeds = [SEED_SERVICE_VAULT, template_address.as_ref()];
		if self
			.service_vault
			.assert_canonical_bump(&service_vault_seeds, &ID)?
			!= args.service_vault_bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		self.service_vault.assert_empty()?.assert_writable()?;
		let (receipt_rent, service_budget) = service_budget(&state)?;
		let total_bundles = state.total_bundles.get();
		let settlement_bounty = state.settlement_bounty_lamports.get();
		let receipts_enabled = state.result_receipts_enabled.get();
		let manifest_hash = locked_manifest_hash(&template_address, &state);

		let authority = state.authority;
		let id = state.id.get();
		let bump = state.bump;
		drop(state);

		if service_budget != 0 {
			let service_vault_bump = [args.service_vault_bump];
			let service_vault_signer = PdaSigner::from_slices([
				SEED_SERVICE_VAULT,
				template_address.as_ref(),
				service_vault_bump.as_slice(),
			]);
			system::instructions::CreateAccount {
				from: self.authority,
				to: self.service_vault,
				lamports: service_budget,
				space: 0,
				owner: &system::ID,
			}
			.invoke_signed(&[service_vault_signer.as_signer()])?;
		}

		let seeds = TemplateState::seeds(&authority, id).with_bump(bump);
		let signer = seeds.to_signer();
		token_2022::instructions::SetAuthority::new(
			self.box_mint,
			self.template,
			token_2022::instructions::AuthorityType::MintTokens,
			None,
		)
		.invoke_signed(&[signer.as_signer()])?;

		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		state.locked_at.set(now);
		state.manifest_hash = manifest_hash;
		state.service_vault_bump = args.service_vault_bump;
		state.result_receipt_rent_lamports.set(receipt_rent);
		state
			.remaining_result_receipts
			.set(if receipts_enabled { total_bundles } else { 0 });
		state
			.remaining_settlement_bounties
			.set(if settlement_bounty == 0 {
				0
			} else {
				total_bundles
			});

		Ok(())
	}
}

fn validate_issuance(
	state: &TemplateStateZc,
	supply: u64,
	amount: u64,
) -> Result<u64, ProgramError> {
	if state.status != TEMPLATE_LIVE || amount == 0 {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	let minted = state
		.total_minted
		.get()
		.checked_add(amount)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let liability = supply
		.checked_add(state.pending_openings.get())
		.and_then(|value| value.checked_add(amount))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if minted > state.total_bundles.get() || liability > state.remaining_bundles.get() {
		return Err(lootbox_error(LootboxError::SupplyExceeded));
	}

	Ok(minted)
}

impl<'a> ProcessAccountInfos<'a> for ActivateBundleAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = ActivateBundleInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;

		if bundle.status != BUNDLE_FUNDING
			|| bundle.funded_assets != bundle.asset_count
			|| bundle.reclaimed_mask != 0
			|| bundle.index.get() != state.bundle_count.get()
		{
			return Err(lootbox_error(LootboxError::IncompleteConfiguration));
		}

		let index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		write_slot(&mut state.remaining, index, bundle.quantity.get())?;
		let remaining_bundles = state
			.remaining_bundles
			.get()
			.checked_add(bundle.quantity.get())
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let total_bundles = state
			.total_bundles
			.get()
			.checked_add(bundle.quantity.get())
			.ok_or(ProgramError::ArithmeticOverflow)?;
		if total_bundles > MAX_TOTAL_WEIGHT {
			return Err(lootbox_error(LootboxError::SupplyExceeded));
		}
		state.remaining_bundles.set(remaining_bundles);
		state.total_bundles.set(total_bundles);
		let revision = state
			.revision
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		state.revision.set(revision);
		let bundle_count = state
			.bundle_count
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		state.bundle_count.set(bundle_count);
		bundle.activated_revision.set(revision);
		bundle.status = BUNDLE_ACTIVE;
		state.manifest_accumulator =
			next_manifest_accumulator(&state.manifest_accumulator, &bundle);

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for CancelBundleAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = CancelBundleInstruction::try_from_bytes(data)?;
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		// Cancellation only closes an unfunded or fully reclaimed staging account.
		// Recovery-retired treasuries may therefore release its rent without
		// reopening any creator mutation path.
		assert_treasury_unlocked(&state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let reclaimed = if bundle.funded_assets == 0 {
			0
		} else {
			(1u8 << bundle.funded_assets) - 1
		};
		if bundle.status != BUNDLE_FUNDING
			|| bundle.index.get() != state.bundle_count.get()
			|| bundle.reclaimed_mask != reclaimed
		{
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		drop(bundle);
		drop(state);

		self.bundle.close_account_zeroed(self.authority)
	}
}

impl<'a> ProcessAccountInfos<'a> for MintTemplateBoxesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = MintTemplateBoxesInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		self.box_token_program.assert_address(&token_2022::ID)?;
		let supply =
			assert_template_mint(self.box_mint, &template_address, &state.box_mint, false)?;
		let account = self
			.recipient_box_account
			.as_token_account_for_program(&token_2022::ID)?;
		let recipient = *account.owner();
		drop(account);
		drop(
			self.recipient_box_account
				.as_associated_token_account_checked(
					&recipient,
					self.box_mint.address(),
					&token_2022::ID,
				)?,
		);
		let minted = validate_issuance(&state, supply, args.amount.get())?;
		state.total_minted.set(minted);
		let authority = state.authority;
		let seeds = TemplateState::seeds(&authority, state.id.get()).with_bump(state.bump);
		drop(state);
		let signer = seeds.to_signer();

		token_2022::instructions::MintTo::new(
			self.box_mint,
			self.recipient_box_account,
			self.template,
			args.amount.get(),
		)
		.invoke_signed(&[signer.as_signer()])
	}
}

#[cfg(test)]
mod market_lock_tests {
	use super::*;

	#[test]
	fn market_lock_requires_exact_pristine_supply_before_reveal() {
		let mut bytes = [0; TemplateState::SIZE];
		let state = TemplateState::initialize(&mut bytes).expect("template");
		state.status = TEMPLATE_LIVE;
		state.bundle_count.set(2);
		state.total_bundles.set(7);
		state.total_minted.set(7);
		state.remaining_bundles.set(7);
		state.opens_at.set(1_001);

		assert_eq!(validate_market_lock(state, 7, 1_000), Ok(()));

		state.total_minted.set(6);
		assert!(validate_market_lock(state, 6, 1_000).is_err());
		state.total_minted.set(7);
		state.remaining_bundles.set(6);
		assert!(validate_market_lock(state, 7, 1_000).is_err());
		state.remaining_bundles.set(7);
		assert!(validate_market_lock(state, 7, 1_001).is_err());
		state.locked_at.set(999);
		assert!(validate_market_lock(state, 7, 1_000).is_err());
	}

	#[test]
	fn recovery_retirement_only_allows_staging_cleanup() {
		let mut bytes = [0; TemplateState::SIZE];
		let state = TemplateState::initialize(&mut bytes).expect("template");
		state.status = TEMPLATE_RETIRED;

		assert_eq!(assert_treasury_unlocked(state), Ok(()));
		assert!(assert_treasury_editable(state).is_err());

		state.locked_at.set(1);
		assert!(assert_treasury_unlocked(state).is_err());
	}
}
