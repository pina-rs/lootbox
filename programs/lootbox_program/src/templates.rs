//! Finite, fully escrowed prize bundles and reusable Token-2022 box templates.

use crate::*;

mod opening;
pub use opening::*;

mod claims;
pub use claims::*;

mod retirement;
pub use retirement::*;

mod close;
pub use close::*;

const TEMPLATE_SEED: &[u8] = b"template";
const BUNDLE_SEED: &[u8] = b"bundle";
const TEMPLATE_OPENING_SEED: &[u8] = b"template-opening";
/// Maximum assets delivered by one winning bundle.
pub const MAX_PRIZE_ASSETS: usize = 4;
/// A native SOL prize, denominated in lamports.
pub const PRIZE_SOL: u8 = 0;
/// A classic SPL Token prize, denominated in base units.
pub const PRIZE_TOKEN: u8 = 1;
/// A unique, non-freezable classic SPL mint with revoked mint authority.
pub const PRIZE_NFT: u8 = 2;

/// Immutable template terms and the live finite inventory.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [TEMPLATE_SEED, authority: Address, id: u64], bump = bump)]
pub struct TemplateState {
	pub authority: Address,
	pub box_mint: Address,
	pub oracle_program: Address,
	pub oracle_queue: Address,
	pub id: u64,
	pub opens_at: i64,
	pub max_supply: u64,
	pub total_minted: u64,
	pub remaining_bundles: u64,
	pub pending_openings: u64,
	pub next_request: u64,
	pub next_allocation: u64,
	/// Immutable positive per-unit weights, encoded as eight little-endian u64s.
	pub weights: [u8; 64],
	/// Undrawn inventory per bundle, encoded as eight little-endian u64s.
	pub remaining: [u8; 64],
	/// Null-padded UTF-8 display name; never used for authorization.
	pub name: [u8; 32],
	/// Null-padded UTF-8 metadata URI; terms on chain remain authoritative.
	pub uri: [u8; 200],
	pub outcome_count: u8,
	pub funded_outcomes: u8,
	pub sealed: bool,
	pub retired: bool,
	pub bump: u8,
}

/// A complete prize outcome and its escrow authority, shared across all boxes.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [BUNDLE_SEED, template: Address, index: u8], bump = bump)]
pub struct BundleState {
	pub template: Address,
	pub quantity: u64,
	pub rent_reserve: u64,
	/// Four mint addresses; the zero address denotes native SOL.
	pub mints: [u8; 128],
	/// Four little-endian base-unit amounts paid per winning bundle.
	pub amounts: [u8; 32],
	/// Four little-endian counts released through claims or retirement recovery.
	pub claimed: [u8; 32],
	pub kinds: [u8; 4],
	pub decimals: [u8; 4],
	pub index: u8,
	pub asset_count: u8,
	pub funded_assets: u8,
	pub reclaimed_mask: u8,
	pub bump: u8,
}

/// A burned box, its verified entropy, and independently claimable winning assets.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [TEMPLATE_OPENING_SEED, template: Address, randomness: Address], bump = bump)]
pub struct TemplateOpeningState {
	pub template: Address,
	pub recipient: Address,
	pub randomness: Address,
	pub sequence: u64,
	pub seed_slot: u64,
	pub entropy: [u8; 32],
	/// 0 committed, 1 verified, 2 allocated, 3 fully delivered.
	pub status: u8,
	pub selected_outcome: u8,
	pub claimed_mask: u8,
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::CreateTemplate)]
pub struct CreateTemplateInstruction {
	pub id: u64,
	pub max_supply: u64,
	pub opens_at: i64,
	pub oracle_program: Address,
	pub oracle_queue: Address,
	pub name: [u8; 32],
	pub uri: [u8; 200],
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::AddBundle)]
pub struct AddBundleInstruction {
	pub quantity: u64,
	pub weight: u64,
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

#[instruction(discriminator = LootboxInstruction::MintTemplateBoxes)]
pub struct MintTemplateBoxesInstruction {
	pub amount: u64,
}

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
pub struct MintTemplateBoxesAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a mut AccountView,
	pub box_mint: &'a mut AccountView,
	pub recipient_box_account: &'a mut AccountView,
	pub box_token_program: &'a AccountView,
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

	let seeds = BundleState::seeds(template, bundle.index).with_bump(bundle.bump);
	account.assert_seeds_with_bump(&seeds.as_slices(), &ID)?;

	Ok(())
}

fn assert_template_authority(authority: &AccountView, state: &TemplateStateZc) -> ProgramResult {
	authority.assert_signer()?;
	assert_authority_address(authority, &state.authority)
}

fn assert_draft(state: &TemplateStateZc) -> ProgramResult {
	if state.sealed.get() || state.retired.get() {
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

fn mint_at(bundle: &BundleStateZc, index: usize) -> Result<Address, ProgramError> {
	if index >= MAX_PRIZE_ASSETS {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	parse_address(&bundle.mints, index * 32)
}

fn inventory_weight(state: &TemplateStateZc) -> Result<u64, ProgramError> {
	let mut weight = 0u64;

	for index in 0..usize::from(state.outcome_count) {
		let entry = read_slot(&state.weights, index)?
			.checked_mul(read_slot(&state.remaining, index)?)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		weight = weight
			.checked_add(entry)
			.ok_or(ProgramError::ArithmeticOverflow)?;
	}

	if weight > MAX_TOTAL_WEIGHT {
		return Err(lootbox_error(LootboxError::InvalidWeight));
	}

	Ok(weight)
}

fn assert_template_mint(
	mint: &AccountView,
	template: &Address,
	expected: &Address,
) -> Result<u64, ProgramError> {
	mint.assert_address(expected)?;
	let data = mint
		.as_token_mint_for_program(&token_2022::ID)?
		.assert_extensions_allowed(&[
			token_2022::state::ExtensionType::MetadataPointer,
			token_2022::state::ExtensionType::TokenMetadata,
		])?;

	if data.decimals() != 0
		|| data.mint_authority() != Some(template)
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

		if args.max_supply.get() == 0
			|| args.opens_at.get() < 0
			|| args.oracle_queue == Address::default()
		{
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
		state.max_supply.set(args.max_supply.get());
		state.name = args.name;
		state.uri = args.uri;
		state.bump = args.bump;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for AddBundleAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AddBundleInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_draft(&state)?;
		self.authority.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.bundle.assert_empty()?.assert_writable()?;

		if usize::from(state.outcome_count) >= MAX_OUTCOMES
			|| args.asset_count == 0
			|| usize::from(args.asset_count) > MAX_PRIZE_ASSETS
			|| args.quantity.get() == 0
			|| args.weight.get() == 0
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let index = state.outcome_count;
		let seeds = BundleState::seeds(&template_address, index);
		if self.bundle.assert_canonical_bump(&seeds.as_slices(), &ID)? != args.bump {
			return Err(ProgramError::InvalidSeeds);
		}

		write_slot(&mut state.weights, usize::from(index), args.weight.get())?;
		write_slot(
			&mut state.remaining,
			usize::from(index),
			args.quantity.get(),
		)?;
		state.outcome_count = index
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		inventory_weight(&state)?;
		let remaining = state
			.remaining_bundles
			.get()
			.checked_add(args.quantity.get())
			.ok_or(ProgramError::ArithmeticOverflow)?;
		state.remaining_bundles.set(remaining);
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
		bundle.index = index;
		bundle.asset_count = args.asset_count;
		bundle.bump = args.bump;

		Ok(())
	}
}

fn record_prize(
	state: &mut TemplateStateZc,
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

	if bundle.funded_assets == bundle.asset_count {
		state.funded_outcomes = state
			.funded_outcomes
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
	}

	Ok(deposit)
}

impl<'a> ProcessAccountInfos<'a> for FundSolPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundSolPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_draft(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		self.system_program.assert_address(&system::ID)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let deposit = record_prize(
			&mut state,
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
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_draft(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		self.token_program.assert_address(&token::ID)?;
		let mint = self.mint.as_token_mint_checked()?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;

		if mint.freeze_authority().is_some() || self.mint.address() == &WRAPPED_SOL_MINT_ID {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		if args.is_nft.get()
			&& (mint.supply() != 1
				|| mint.decimals() != 0
				|| mint.mint_authority().is_some()
				|| bundle.quantity.get() != 1
				|| args.amount_per_win.get() != 1)
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let decimals = mint.decimals();
		drop(mint);
		let escrow = self.escrow.as_associated_token_account_checked(
			&bundle_address,
			self.mint.address(),
			&token::ID,
		)?;
		// Security: an escrow delegate or close authority could steal collateral.
		if escrow.delegate().is_some() || escrow.close_authority().is_some() || escrow.is_frozen() {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(escrow);
		let kind = if args.is_nft.get() {
			PRIZE_NFT
		} else {
			PRIZE_TOKEN
		};
		let deposit = record_prize(
			&mut state,
			&mut bundle,
			self.mint.address(),
			args.amount_per_win.get(),
			kind,
			decimals,
		)?;
		drop(bundle);
		drop(state);

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

impl<'a> ProcessAccountInfos<'a> for SealTemplateAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = SealTemplateInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_draft(&state)?;

		if state.outcome_count == 0
			|| state.funded_outcomes != state.outcome_count
			|| state.max_supply.get() > state.remaining_bundles.get()
		{
			return Err(lootbox_error(LootboxError::IncompleteConfiguration));
		}

		state.sealed.set(true);

		Ok(())
	}
}

fn validate_issuance(
	state: &TemplateStateZc,
	supply: u64,
	amount: u64,
) -> Result<u64, ProgramError> {
	if !state.sealed.get() || state.retired.get() || amount == 0 {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	for index in 0..usize::from(state.outcome_count) {
		if read_slot(&state.remaining, index)? == 0 {
			return Err(lootbox_error(LootboxError::PrizeExhausted));
		}
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
	if minted > state.max_supply.get() || liability > state.remaining_bundles.get() {
		return Err(lootbox_error(LootboxError::SupplyExceeded));
	}

	Ok(minted)
}

impl<'a> ProcessAccountInfos<'a> for MintTemplateBoxesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = MintTemplateBoxesInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		self.box_token_program.assert_address(&token_2022::ID)?;
		let supply = assert_template_mint(self.box_mint, &template_address, &state.box_mint)?;
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
