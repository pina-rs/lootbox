//! FIFO allocation is independent of retryable, recipient-bound asset delivery.

use super::*;

#[instruction(discriminator = LootboxInstruction::AllocateTemplateOpen)]
pub struct AllocateTemplateOpenInstruction {
	pub result_receipt_bump: u8,
}

#[instruction(discriminator = LootboxInstruction::ClaimSolPrize)]
pub struct ClaimSolPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ClaimTokenPrize)]
pub struct ClaimTokenPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ClaimMintPrize)]
pub struct ClaimMintPrizeInstruction {
	pub asset_index: u8,
}

#[derive(Accounts, Debug)]
pub struct AllocateTemplateOpenAccounts<'a> {
	pub template: &'a mut AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a AccountView,
	/// Creator-funded when permanent result receipts are enabled.
	pub service_vault: &'a mut AccountView,
	/// Created only when enabled in the locked treasury configuration.
	pub result_receipt: &'a mut AccountView,
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct ClaimSolPrizeAccounts<'a> {
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub recipient: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct ClaimTokenPrizeAccounts<'a> {
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub recipient: &'a AccountView,
	pub mint: &'a AccountView,
	pub escrow: &'a mut AccountView,
	pub destination: &'a mut AccountView,
	pub token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct ClaimMintPrizeAccounts<'a> {
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub recipient: &'a AccountView,
	pub mint: &'a mut AccountView,
	pub destination: &'a mut AccountView,
	pub token_program: &'a AccountView,
}

pub(super) fn assert_template_opening(
	address: &Address,
	opening: &TemplateOpeningStateZc,
	template: &Address,
) -> ProgramResult {
	if opening.template != *template {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	let seeds = TemplateOpeningState::seeds(template, &opening.randomness).with_bump(opening.bump);
	if *address != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	Ok(())
}

fn bundle_for_target(
	state: &TemplateStateRef<'_>,
	eligible_bundle_count: u32,
	target: u64,
) -> Result<u32, ProgramError> {
	let mut cumulative = 0u64;
	let count =
		usize::try_from(eligible_bundle_count).map_err(|_| ProgramError::InvalidAccountData)?;
	if count > MAX_TEMPLATE_BUNDLES {
		return Err(ProgramError::InvalidAccountData);
	}
	for index in 0..count {
		let weight = remaining_at(state, index)?;
		cumulative = cumulative
			.checked_add(weight)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		if target < cumulative {
			return u32::try_from(index).map_err(|_| ProgramError::InvalidAccountData);
		}
	}

	Err(lootbox_error(LootboxError::InvalidOutcome))
}

fn allocate(
	state: &mut TemplateStateHeader,
	opening: &mut TemplateOpeningStateZc,
	bundle_index: u32,
	remaining: u64,
) -> Result<u64, ProgramError> {
	if opening.status != 1 {
		return Err(lootbox_error(LootboxError::RandomnessNotReady));
	}

	if opening.sequence.get() != state.next_allocation.get() {
		return Err(lootbox_error(LootboxError::AllocationOutOfOrder));
	}

	if opening.eligible_bundle_count.get() > state.bundle_count.get()
		|| opening.treasury_revision.get() > state.revision.get()
	{
		return Err(ProgramError::InvalidAccountData);
	}
	let remaining = remaining
		.checked_sub(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	state.remaining_bundles.set(
		state
			.remaining_bundles
			.get()
			.checked_sub(1)
			.ok_or(ProgramError::ArithmeticOverflow)?,
	);
	state.pending_openings.set(
		state
			.pending_openings
			.get()
			.checked_sub(1)
			.ok_or(ProgramError::ArithmeticOverflow)?,
	);
	state.next_allocation.set(
		state
			.next_allocation
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?,
	);
	opening.selected_bundle.set(bundle_index);
	opening.status = 2;

	Ok(remaining)
}

impl<'a> ProcessAccountInfos<'a> for AllocateTemplateOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AllocateTemplateOpenInstruction::try_from_bytes(data)?;
		let template = *self.template.address();
		let address = *self.opening.address();
		self.service_vault.assert_writable()?;
		self.result_receipt.assert_empty()?.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		let account_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&account_data)?;
		assert_template(&template, &state)?;
		assert_service_vault(self.service_vault, &template, &state)?;
		assert_bundle(self.bundle, &template)?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&address, &opening, &template)?;

		if bundle.status != BUNDLE_ACTIVE
			|| bundle.activated_revision.get() > opening.treasury_revision.get()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let inventory = available_in_prefix(&state, opening.eligible_bundle_count.get())?;
		let target = select_outcome(&opening.entropy, &opening.template, &address, inventory)?;
		let selected = bundle_for_target(&state, opening.eligible_bundle_count.get(), target)?;
		if selected != bundle.index.get() {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let index = usize::try_from(selected).map_err(|_| ProgramError::InvalidAccountData)?;
		let selected_remaining = remaining_at(&state, index)?;
		drop(bundle);
		drop(account_data);

		let mut state = as_template_mut(self.template)?;
		let remaining = allocate(&mut state, &mut opening, selected, selected_remaining)?;

		if !state.result_receipts_enabled.get() {
			drop(state);
			drop(opening);
			return write_template_remaining(self.template, index, remaining);
		}

		let result_receipt_seeds = ResultReceiptState::seeds(&address);
		if self
			.result_receipt
			.assert_canonical_bump(&result_receipt_seeds.as_slices(), &ID)?
			!= args.result_receipt_bump
		{
			return Err(ProgramError::InvalidSeeds);
		}

		let selected_bundle = opening.selected_bundle.get();
		let box_authority = opening.box_authority;
		let beneficiary = opening.beneficiary;
		let consumer_program = opening.consumer_program;
		let consumer_context = opening.consumer_context;
		let randomness = opening.randomness;
		let sequence = opening.sequence.get();
		let manifest_hash = state.manifest_hash;
		let service_vault_bump = state.service_vault_bump;
		drop(opening);

		let service_vault_balance = self.service_vault.lamports();
		let required_before = required_service_balance(&state)?;
		let remaining_receipts = state
			.remaining_result_receipts
			.get()
			.checked_sub(1)
			.ok_or_else(|| lootbox_error(LootboxError::ServiceBudgetExhausted))?;

		if service_vault_balance < required_before {
			return Err(lootbox_error(LootboxError::ServiceBudgetExhausted));
		}

		let receipt_rent_lamports = state.result_receipt_rent_lamports.get();
		state.remaining_result_receipts.set(remaining_receipts);
		let required_after = required_service_balance(&state)?;
		drop(state);
		write_template_remaining(self.template, index, remaining)?;

		let service_vault_bump = [service_vault_bump];
		let service_vault_signer = PdaSigner::from_slices([
			SEED_SERVICE_VAULT,
			template.as_ref(),
			service_vault_bump.as_slice(),
		]);
		// The isolated vault is a zero-data System account controlled by this PDA,
		// so its prepaid balance can fund receipt creation through ordinary System
		// Program CPIs without making the opener sign or pay.
		system::instructions::Transfer {
			from: self.service_vault,
			to: self.result_receipt,
			lamports: receipt_rent_lamports,
		}
		.invoke_signed(&[service_vault_signer.as_signer()])?;

		CreateProgramAccountWithBump {
			account: self.result_receipt,
			payer: self.service_vault,
			owner: &ID,
			seeds: &result_receipt_seeds.as_slices(),
			bump: args.result_receipt_bump,
		}
		.invoke_signed::<ResultReceiptState>(&[service_vault_signer.as_signer()])?;

		if self.service_vault.lamports() < required_after {
			return Err(lootbox_error(LootboxError::ServiceBudgetExhausted));
		}

		let mut result_receipt = self
			.result_receipt
			.as_account_mut::<ResultReceiptState>(&ID)?;
		result_receipt.template = template;
		result_receipt.opening = address;
		result_receipt.box_authority = box_authority;
		result_receipt.beneficiary = beneficiary;
		result_receipt.consumer_program = consumer_program;
		result_receipt.consumer_context = consumer_context;
		result_receipt.manifest_hash = manifest_hash;
		result_receipt.randomness = randomness;
		result_receipt.sequence.set(sequence);
		result_receipt.selected_bundle.set(selected_bundle);
		result_receipt.bump = args.result_receipt_bump;

		Ok(())
	}
}

pub(super) fn record_claim(
	opening: &mut TemplateOpeningStateZc,
	bundle: &mut BundleStateZc,
	recipient: &Address,
	asset_index: u8,
) -> Result<u64, ProgramError> {
	if opening.status != 2
		|| opening.selected_bundle.get() != bundle.index.get()
		|| opening.template != bundle.template
	{
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	if opening.beneficiary != *recipient {
		return Err(lootbox_error(LootboxError::InvalidRecipient));
	}

	if asset_index >= bundle.asset_count {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	let bit = 1u8
		.checked_shl(u32::from(asset_index))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if opening.claimed_mask & bit != 0 {
		return Err(lootbox_error(LootboxError::PrizeAlreadyClaimed));
	}

	let index = usize::from(asset_index);
	let claimed = read_slot(&bundle.claimed, index)?
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if claimed > bundle.quantity.get() {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	write_slot(&mut bundle.claimed, index, claimed)?;
	opening.claimed_mask |= bit;
	if opening.claimed_mask == (1u8 << bundle.asset_count) - 1 {
		opening.status = 3;
	}

	read_slot(&bundle.amounts, index)
}

impl<'a> ProcessAccountInfos<'a> for ClaimSolPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimSolPrizeInstruction::try_from_bytes(data)?;
		let address = *self.opening.address();
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&address, &opening, self.template.address())?;
		let index = usize::from(args.asset_index);
		if !matches!(bundle.kinds.get(index), Some(&PRIZE_SOL | &PRIZE_QUOTE_SOL)) {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let amount = record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		let owed = bundle
			.quantity
			.get()
			.checked_sub(read_slot(&bundle.claimed, index)?)
			.and_then(|count| count.checked_mul(amount))
			.and_then(|value| value.checked_add(bundle.rent_reserve.get()))
			.ok_or(ProgramError::ArithmeticOverflow)?;
		drop(bundle);
		drop(opening);
		let after = self
			.bundle
			.lamports()
			.checked_sub(amount)
			.ok_or_else(|| lootbox_error(LootboxError::Insolvent))?;
		if after < owed {
			return Err(lootbox_error(LootboxError::Insolvent));
		}

		self.bundle.assert_owner(&ID)?;
		self.bundle.send(amount, self.recipient)
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimTokenPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimTokenPrizeInstruction::try_from_bytes(data)?;
		let address = *self.opening.address();
		let bundle_address = *self.bundle.address();
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let token_program = *self.token_program.address();
		if token_program != token::ID && token_program != token_2022::ID {
			return Err(ProgramError::IncorrectProgramId);
		}
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&address, &opening, self.template.address())?;
		let index = usize::from(args.asset_index);
		let kind = bundle.kinds.get(index).copied().unwrap_or(u8::MAX);
		let valid_kind = match kind {
			PRIZE_TOKEN_2022 => token_program == token_2022::ID,
			PRIZE_TOKEN | PRIZE_NFT => token_program == token::ID,
			PRIZE_QUOTE_TOKEN => true,
			_ => false,
		};
		if !valid_kind || mint_at(&bundle, index)? != *self.mint.address() {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		drop(self.escrow.as_associated_token_account_checked(
			&bundle_address,
			self.mint.address(),
			&token_program,
		)?);
		drop(self.destination.as_associated_token_account_checked(
			&opening.beneficiary,
			self.mint.address(),
			&token_program,
		)?);
		let amount = record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		let decimals = bundle.decimals[index];
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		drop(opening);
		let signer = seeds.to_signer();

		if token_program == token_2022::ID {
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::TransferChecked::new(
				self.escrow,
				self.mint,
				self.destination,
				self.bundle,
				amount,
				decimals,
			)
			.invoke_signed(&[signer.as_signer()])
		} else {
			self.token_program.assert_address(&token::ID)?;
			token::instructions::TransferChecked::new(
				self.escrow,
				self.mint,
				self.destination,
				self.bundle,
				amount,
				decimals,
			)
			.invoke_signed(&[signer.as_signer()])
		}
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimMintPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimMintPrizeInstruction::try_from_bytes(data)?;
		let address = *self.opening.address();
		let bundle_address = *self.bundle.address();
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let token_program = *self.token_program.address();
		if token_program != token::ID && token_program != token_2022::ID {
			return Err(ProgramError::IncorrectProgramId);
		}

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&address, &opening, self.template.address())?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_MINT_BADGE)
			|| mint_at(&bundle, index)? != *self.mint.address()
			|| read_slot(&bundle.amounts, index)? != 1
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let mint = self
			.mint
			.as_token_mint_for_program(&token_program)?
			.assert_extensions_allowed(&[
				token_2022::state::ExtensionType::MetadataPointer,
				token_2022::state::ExtensionType::TokenMetadata,
			])?;
		if mint.decimals() != 0
			|| mint.mint_authority() != Some(&bundle_address)
			|| mint.freeze_authority().is_some()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(mint);
		drop(self.destination.as_associated_token_account_checked(
			&opening.beneficiary,
			self.mint.address(),
			&token_program,
		)?);

		let amount = record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		if amount != 1 {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let is_final = read_slot(&bundle.claimed, index)? == bundle.quantity.get();
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		drop(opening);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		if token_program == token_2022::ID {
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::MintTo::new(self.mint, self.destination, self.bundle, 1)
				.invoke_signed(&signers)?;
			if is_final {
				token_2022::instructions::SetAuthority::new(
					self.mint,
					self.bundle,
					token_2022::instructions::AuthorityType::MintTokens,
					None,
				)
				.invoke_signed(&signers)?;
			}
		} else {
			self.token_program.assert_address(&token::ID)?;
			token::instructions::MintTo::new(self.mint, self.destination, self.bundle, 1)
				.invoke_signed(&signers)?;
			if is_final {
				token::instructions::SetAuthority::new(
					self.mint,
					self.bundle,
					token::instructions::AuthorityType::MintTokens,
					None,
				)
				.invoke_signed(&signers)?;
			}
		}

		Ok(())
	}
}

#[cfg(test)]
mod tests {
	use proptest::prelude::*;

	use super::*;

	const POOL_SIZE: usize = TemplateState::HEADER_SIZE + 3 * size_of::<PodU64>();

	fn initialize_pool(bytes: &mut [u8; POOL_SIZE], quantities: [u64; 3]) {
		let remaining = quantities.map(PodU64::from);
		let mut state = TemplateState::initialize(bytes).expect("template");
		state.bundle_count.set(3);
		state.revision.set(3);
		state.status = TEMPLATE_LIVE;
		let total = quantities.iter().sum();
		state.remaining_bundles.set(total);
		state.total_bundles.set(total);
		state.set_remaining(&remaining).expect("inventory");
		assert_eq!(state.commit(), Ok(POOL_SIZE));
	}

	fn write_remaining(bytes: &mut [u8], index: usize, value: u64) {
		let start = TemplateState::HEADER_SIZE + index * size_of::<PodU64>();
		bytes[start..start + size_of::<PodU64>()].copy_from_slice(&value.to_le_bytes());
	}

	#[test]
	fn finite_odds_follow_remaining_units_and_skip_exhausted_prizes() {
		let mut bytes = [0; POOL_SIZE];
		initialize_pool(&mut bytes, [90, 9, 1]);
		let state = TemplateState::try_from_bytes(&bytes).expect("template");
		assert_eq!(available_in_prefix(&state, 3), Ok(100));
		assert_eq!(bundle_for_target(&state, 3, 89), Ok(0));
		assert_eq!(bundle_for_target(&state, 3, 90), Ok(1));
		assert_eq!(bundle_for_target(&state, 3, 99), Ok(2));
		write_remaining(&mut bytes, 2, 0);
		let mut state = TemplateState::try_from_bytes_mut(&mut bytes).expect("template");
		state.remaining_bundles.set(99);
		let state = TemplateState::try_from_bytes(&bytes).expect("template");
		assert_eq!(available_in_prefix(&state, 3), Ok(99));
		assert_eq!(bundle_for_target(&state, 3, 98), Ok(1));
		assert!(bundle_for_target(&state, 3, 99).is_err());
		assert_eq!(validate_issuance(&state, 0, 1), Ok(1));
	}

	#[test]
	fn mint_capacity_includes_pending_openings() {
		let mut bytes = [0; POOL_SIZE];
		initialize_pool(&mut bytes, [3, 3, 1]);
		let mut state = TemplateState::try_from_bytes_mut(&mut bytes).expect("template");
		state.pending_openings.set(2);
		assert_eq!(validate_issuance(&state, 4, 1), Ok(1));
		assert_eq!(
			validate_issuance(&state, 4, 2),
			Err(lootbox_error(LootboxError::SupplyExceeded))
		);
		state.total_minted.set(7);
		assert_eq!(
			validate_issuance(&state, 0, 1),
			Err(lootbox_error(LootboxError::SupplyExceeded))
		);
	}

	#[test]
	fn revealed_openings_cannot_jump_the_queue() {
		let mut bytes = [0; POOL_SIZE];
		initialize_pool(&mut bytes, [3, 3, 1]);
		let mut state = TemplateState::try_from_bytes_mut(&mut bytes).expect("template");
		state.pending_openings.set(2);
		let mut receipt = [0; TemplateOpeningState::SIZE];
		let opening = TemplateOpeningState::initialize(&mut receipt).expect("opening");
		opening.status = 1;
		opening.sequence.set(1);
		opening.treasury_revision.set(3);
		opening.eligible_bundle_count.set(3);
		assert_eq!(
			allocate(&mut state, opening, 0, 3),
			Err(lootbox_error(LootboxError::AllocationOutOfOrder))
		);
		assert_eq!(state.remaining_bundles.get(), 7);
		assert_eq!(state.next_allocation.get(), 0);
	}

	#[test]
	fn bundles_are_paid_once_per_asset_to_the_bound_recipient() {
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes).expect("bundle");
		bundle.quantity.set(1);
		bundle.asset_count = 2;
		write_slot(&mut bundle.amounts, 0, 50).expect("SOL");
		write_slot(&mut bundle.amounts, 1, 1).expect("NFT");
		let mut receipt = [0; TemplateOpeningState::SIZE];
		let opening = TemplateOpeningState::initialize(&mut receipt).expect("opening");
		opening.status = 2;
		let thief = Address::new_from_array([9; 32]);
		assert_eq!(
			record_claim(opening, bundle, &thief, 0),
			Err(lootbox_error(LootboxError::InvalidRecipient))
		);
		assert_eq!(opening.claimed_mask, 0);
		assert_eq!(
			record_claim(opening, bundle, &Address::default(), 0),
			Ok(50)
		);
		assert_eq!(opening.status, 2);
		assert_eq!(
			record_claim(opening, bundle, &Address::default(), 0),
			Err(lootbox_error(LootboxError::PrizeAlreadyClaimed))
		);
		assert_eq!(record_claim(opening, bundle, &Address::default(), 1), Ok(1));
		assert_eq!(opening.status, 3);
		assert!(record_claim(opening, bundle, &Address::default(), 1).is_err());
	}

	#[test]
	fn mint_prize_accounting_never_exceeds_the_bundle_quantity() {
		let recipient = Address::new_from_array([7; 32]);
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes).expect("bundle");
		bundle.quantity.set(2);
		bundle.asset_count = 1;
		bundle.kinds[0] = PRIZE_MINT_BADGE;
		write_slot(&mut bundle.amounts, 0, 1).expect("one badge per win");

		for _ in 0..2 {
			let mut receipt = [0; TemplateOpeningState::SIZE];
			let opening = TemplateOpeningState::initialize(&mut receipt).expect("opening");
			opening.template = bundle.template;
			opening.beneficiary = recipient;
			opening.selected_bundle.set(bundle.index.get());
			opening.status = 2;
			assert_eq!(record_claim(opening, bundle, &recipient, 0), Ok(1));
		}

		let mut receipt = [0; TemplateOpeningState::SIZE];
		let opening = TemplateOpeningState::initialize(&mut receipt).expect("opening");
		opening.template = bundle.template;
		opening.beneficiary = recipient;
		opening.selected_bundle.set(bundle.index.get());
		opening.status = 2;
		assert_eq!(
			record_claim(opening, bundle, &recipient, 0),
			Err(lootbox_error(LootboxError::InvalidState))
		);
		assert_eq!(read_slot(&bundle.claimed, 0), Ok(2));
	}

	#[test]
	fn funding_cannot_count_one_asset_twice() {
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes).expect("bundle");
		bundle.quantity.set(3);
		bundle.asset_count = 2;
		assert_eq!(
			record_prize(bundle, &Address::default(), 10, PRIZE_SOL, 9),
			Ok(30)
		);
		assert_eq!(
			record_prize(bundle, &Address::default(), 10, PRIZE_SOL, 9),
			Err(lootbox_error(LootboxError::InvalidPrize))
		);
		assert_eq!(bundle.funded_assets, 1);
	}

	#[test]
	fn funding_overflow_fails_closed() {
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes).expect("bundle");
		bundle.quantity.set(2);
		bundle.asset_count = 1;
		assert_eq!(
			record_prize(bundle, &Address::default(), u64::MAX, PRIZE_SOL, 9),
			Err(ProgramError::ArithmeticOverflow)
		);
		assert_eq!(bundle.funded_assets, 0);
	}

	#[test]
	fn metadata_parser_rejects_truncated_or_oversized_lengths() {
		assert!(metadata_bytes(&[0; 165]).is_err());
		let mut bytes = [0; 170];
		bytes[166] = 19;
		bytes[168] = 255;
		assert!(metadata_bytes(&bytes).is_err());
		assert!(take_metadata_string(&mut [255u8; 4].as_slice()).is_err());
		assert!(validate_text(&[b'a', 0, b'b'], true).is_err());
	}

	#[test]
	fn all_1024_append_slots_are_addressable_and_snapshots_exclude_later_bundles() {
		let remaining = alloc::vec![PodU64::from(1); MAX_TEMPLATE_BUNDLES];
		let mut bytes = [0; TemplateState::MAX_SIZE];
		let mut state = TemplateState::initialize(&mut bytes).expect("template");
		state.bundle_count.set(MAX_TEMPLATE_BUNDLES as u32);
		state.set_remaining(&remaining).expect("inventory");
		assert_eq!(state.commit(), Ok(TemplateState::MAX_SIZE));
		let state = TemplateState::try_from_bytes(&bytes).expect("template");
		assert_eq!(available_in_prefix(&state, 9), Ok(9));
		assert_eq!(available_in_prefix(&state, 1_024), Ok(1_024));
		assert_eq!(bundle_for_target(&state, 9, 8), Ok(8));
		assert!(bundle_for_target(&state, 9, 9).is_err());
		assert_eq!(bundle_for_target(&state, 1_024, 1_023), Ok(1_023));
	}

	proptest! {
		#[test]
		fn every_issued_box_can_allocate_without_reusing_inventory(a in 1u64..15, b in 1u64..15, c in 1u64..4, entropy in any::<[u8; 32]>()) {
			let quantities = [a, b, c];
			let total = a + b + c;
			let mut bytes = [0; POOL_SIZE];
			initialize_pool(&mut bytes, quantities);
			let mut state = TemplateState::try_from_bytes_mut(&mut bytes).expect("template");
			state.total_minted.set(total);
			state.pending_openings.set(total);
			let mut awarded = [0u64; 3];
			for sequence in 0..total {
				let mut receipt = [0; TemplateOpeningState::SIZE];
				let opening = TemplateOpeningState::initialize(&mut receipt).expect("opening");
				opening.status = 1;
				opening.sequence.set(sequence);
				opening.treasury_revision.set(3);
				opening.eligible_bundle_count.set(3);
				opening.entropy = entropy;
				let state = TemplateState::try_from_bytes(&bytes).expect("template");
				let target = select_outcome(&entropy, &Address::default(), &Address::default(), available_in_prefix(&state, 3).expect("inventory")).expect("target");
				let selected = bundle_for_target(&state, 3, target).expect("outcome");
				let selected_index = usize::try_from(selected).expect("index");
				let selected_remaining = remaining_at(&state, selected_index).expect("remaining");
				let mut state = TemplateState::try_from_bytes_mut(&mut bytes).expect("template");
				let after = allocate(&mut state, opening, selected, selected_remaining).expect("allocate");
				awarded[usize::try_from(selected).expect("index")] += 1;
				prop_assert_eq!(state.pending_openings.get(), total - sequence - 1);
				prop_assert_eq!(state.remaining_bundles.get(), total - sequence - 1);
				prop_assert!(allocate(&mut state, opening, selected, selected_remaining).is_err());
				write_remaining(&mut bytes, selected_index, after);
			}
			prop_assert_eq!(awarded, quantities);
			let state = TemplateState::try_from_bytes(&bytes).expect("template");
			prop_assert_eq!(available_in_prefix(&state, 3), Ok(0));
		}
	}
}
