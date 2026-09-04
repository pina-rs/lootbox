//! Commit and persist oracle entropy before FIFO allocation or asset transfers.

use pina::sysvars::Sysvar;

use super::*;

#[instruction(discriminator = LootboxInstruction::RequestTemplateOpen)]
pub struct RequestTemplateOpenInstruction {
	pub recent_slot: u64,
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::FulfillTemplateOpen)]
pub struct FulfillTemplateOpenInstruction {
	pub signature: [u8; 64],
	pub recovery_id: u8,
	pub value: [u8; 32],
}

#[instruction(discriminator = LootboxInstruction::ForfeitTemplateOpen)]
pub struct ForfeitTemplateOpenInstruction {}

#[derive(Accounts, Debug)]
pub struct RequestTemplateOpenAccounts<'a> {
	pub owner: &'a mut AccountView,
	pub template: &'a mut AccountView,
	pub box_mint: &'a mut AccountView,
	pub owner_box_account: &'a mut AccountView,
	pub opening: &'a mut AccountView,
	pub randomness: &'a mut AccountView,
	pub reward_escrow: &'a mut AccountView,
	pub oracle_queue: &'a mut AccountView,
	pub oracle: &'a mut AccountView,
	pub recent_slot_hashes: &'a AccountView,
	pub oracle_program: &'a AccountView,
	pub oracle_program_state: &'a AccountView,
	pub oracle_lut_signer: &'a AccountView,
	pub oracle_lut: &'a mut AccountView,
	pub associated_token_program: &'a AccountView,
	pub wrapped_sol_mint: &'a AccountView,
	pub address_lookup_table_program: &'a AccountView,
	pub system_program: &'a AccountView,
	pub box_token_program: &'a AccountView,
	pub token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct FulfillTemplateOpenAccounts<'a> {
	pub payer: &'a mut AccountView,
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub randomness: &'a mut AccountView,
	pub oracle_queue: &'a AccountView,
	pub oracle: &'a AccountView,
	pub oracle_stats: &'a mut AccountView,
	pub recent_slot_hashes: &'a AccountView,
	pub oracle_program: &'a AccountView,
	pub reward_escrow: &'a mut AccountView,
	pub oracle_program_state: &'a AccountView,
	pub system_program: &'a AccountView,
	pub token_program: &'a AccountView,
	pub wrapped_sol_mint: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct ForfeitTemplateOpenAccounts<'a> {
	/// Any signer may advance an expired FIFO head; the stored recipient and
	/// their exclusive claim rights are never changed.
	pub caller: &'a AccountView,
	pub template: &'a mut AccountView,
	pub opening: &'a mut AccountView,
	pub randomness: &'a AccountView,
}

fn assert_openable(status: u8) -> ProgramResult {
	if status == TEMPLATE_DRAFT {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	Ok(())
}

fn assert_reveal_payer(payer: &Address, recipient: &Address) -> ProgramResult {
	if payer != recipient {
		return Err(lootbox_error(LootboxError::InvalidRecipient));
	}

	Ok(())
}

fn record_forfeit(
	state: &mut TemplateStateZc,
	opening: &mut TemplateOpeningStateZc,
) -> ProgramResult {
	if opening.status != OPENING_PENDING {
		return Err(lootbox_error(LootboxError::OpeningAlreadyFinalized));
	}
	if opening.sequence.get() != state.next_allocation.get() {
		return Err(lootbox_error(LootboxError::AllocationOutOfOrder));
	}
	let pending = state
		.pending_openings
		.get()
		.checked_sub(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	state.pending_openings.set(pending);
	let next_allocation = state
		.next_allocation
		.get()
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	state.next_allocation.set(next_allocation);
	opening.status = 4;

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for RequestTemplateOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = RequestTemplateOpenInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let owner_address = *self.owner.address();
		let randomness_address = *self.randomness.address();
		let opening_address = *self.opening.address();
		self.owner.assert_signer()?.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.token_program.assert_address(&token::ID)?;
		self.box_token_program.assert_address(&token_2022::ID)?;
		self.box_mint.assert_writable()?;
		self.owner_box_account.assert_writable()?;
		self.opening.assert_empty()?.assert_writable()?;
		self.randomness
			.assert_signer()?
			.assert_empty()?
			.assert_writable()?;
		self.reward_escrow.assert_writable()?;
		self.oracle_queue.assert_writable()?;
		self.oracle.assert_writable()?;
		self.oracle_lut.assert_writable()?;
		self.recent_slot_hashes
			.assert_sysvar(&SLOT_HASHES_SYSVAR_ID)?;
		self.associated_token_program
			.assert_address(&associated_token_account::ID)?;
		self.wrapped_sol_mint.assert_address(&WRAPPED_SOL_MINT_ID)?;
		self.address_lookup_table_program
			.assert_address(&ADDRESS_LOOKUP_TABLE_PROGRAM_ID)?;
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		self.oracle_queue.assert_address(&state.oracle_queue)?;
		self.oracle_program.assert_program(&state.oracle_program)?;

		// Retirement closes issuance and additions, but must not strand boxes
		// already held by recipients. Draft treasuries are the only unopenable state.
		assert_openable(state.status)?;

		if sysvars::clock::Clock::get()?.unix_timestamp < state.opens_at.get() {
			return Err(lootbox_error(LootboxError::ClaimLocked));
		}

		let mint_supply = assert_template_mint(self.box_mint, &template_address, &state.box_mint)?;
		let box_account = self.owner_box_account.as_associated_token_account_checked(
			&owner_address,
			self.box_mint.address(),
			&token_2022::ID,
		)?;

		if box_account.amount() == 0 {
			return Err(ProgramError::InsufficientFunds);
		}
		drop(box_account);

		let opening_seeds = TemplateOpeningState::seeds(&template_address, &randomness_address);
		let opening_seeds_with_bump = opening_seeds.with_bump(args.bump);
		let canonical_bump = self
			.opening
			.assert_canonical_bump(&opening_seeds.as_slices(), &ID)?;

		if canonical_bump != args.bump {
			return Err(ProgramError::InvalidSeeds);
		}

		self.opening
			.assert_seeds_with_bump(&opening_seeds_with_bump.as_slices(), &ID)?;

		let pending = state
			.pending_openings
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let post_burn_supply = mint_supply
			.checked_sub(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		if post_burn_supply
			.checked_add(pending)
			.ok_or(ProgramError::ArithmeticOverflow)?
			> state.remaining_bundles.get()
		{
			return Err(lootbox_error(LootboxError::Insolvent));
		}
		let sequence = state.next_request.get();
		let treasury_version = state.version.get();
		let eligible_bundle_count = state.bundle_count.get();
		state.next_request.set(
			sequence
				.checked_add(1)
				.ok_or(ProgramError::ArithmeticOverflow)?,
		);
		state.pending_openings.set(pending);
		drop(state);

		CreateProgramAccountWithBump {
			account: self.opening,
			payer: self.owner,
			owner: &ID,
			seeds: &opening_seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<TemplateOpeningState>()?;

		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		opening.template = template_address;
		opening.recipient = owner_address;
		opening.randomness = randomness_address;
		opening.status = OPENING_PENDING;
		opening.sequence.set(sequence);
		opening.treasury_version.set(treasury_version);
		opening.eligible_bundle_count.set(eligible_bundle_count);
		opening.bump = args.bump;
		drop(opening);

		let mut init_data = [0u8; 16];
		init_data[..8].copy_from_slice(&RANDOMNESS_INIT_DISCRIMINATOR);
		init_data[8..].copy_from_slice(&args.recent_slot.get().to_le_bytes());
		let init_accounts = [
			InstructionAccount::writable_signer(self.randomness.address()),
			InstructionAccount::writable(self.reward_escrow.address()),
			InstructionAccount::readonly_signer(self.opening.address()),
			InstructionAccount::writable(self.oracle_queue.address()),
			InstructionAccount::writable_signer(self.owner.address()),
			InstructionAccount::readonly(self.system_program.address()),
			InstructionAccount::readonly(self.token_program.address()),
			InstructionAccount::readonly(self.associated_token_program.address()),
			InstructionAccount::readonly(self.wrapped_sol_mint.address()),
			InstructionAccount::readonly(self.oracle_program_state.address()),
			InstructionAccount::readonly(self.oracle_lut_signer.address()),
			InstructionAccount::writable(self.oracle_lut.address()),
			InstructionAccount::readonly(self.address_lookup_table_program.address()),
		];
		let init_account_views: [&AccountView; 13] = [
			self.randomness,
			self.reward_escrow,
			self.opening,
			self.oracle_queue,
			self.owner,
			self.system_program,
			self.token_program,
			self.associated_token_program,
			self.wrapped_sol_mint,
			self.oracle_program_state,
			self.oracle_lut_signer,
			self.oracle_lut,
			self.address_lookup_table_program,
		];
		let init_instruction = InstructionView {
			program_id: self.oracle_program.address(),
			accounts: &init_accounts,
			data: &init_data,
		};
		let opening_signer = opening_seeds_with_bump.to_signer();
		let signers = [opening_signer.as_signer()];
		pinocchio::cpi::invoke_signed::<13, _>(&init_instruction, &init_account_views, &signers)?;

		let initialized = parse_randomness(self.randomness, self.oracle_program.address())?;

		if initialized.authority != opening_address
			|| initialized.queue != *self.oracle_queue.address()
			|| initialized.seed_slot != 0
			|| initialized.reveal_slot != 0
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		let instruction_accounts = [
			InstructionAccount::writable(self.randomness.address()),
			InstructionAccount::readonly(self.oracle_queue.address()),
			InstructionAccount::writable(self.oracle.address()),
			InstructionAccount::readonly(self.recent_slot_hashes.address()),
			InstructionAccount::readonly_signer(self.opening.address()),
		];
		let account_views: [&AccountView; 5] = [
			self.randomness,
			self.oracle_queue,
			self.oracle,
			self.recent_slot_hashes,
			self.opening,
		];
		let instruction = InstructionView {
			program_id: self.oracle_program.address(),
			accounts: &instruction_accounts,
			data: &RANDOMNESS_COMMIT_DISCRIMINATOR,
		};
		pinocchio::cpi::invoke_signed::<5, _>(&instruction, &account_views, &signers)?;

		let committed = parse_randomness(self.randomness, self.oracle_program.address())?;

		if committed.authority != opening_address
			|| committed.queue != *self.oracle_queue.address()
			|| committed.seed_slot == 0
			|| committed.reveal_slot != 0
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		token_2022::instructions::Burn::new(self.owner_box_account, self.box_mint, self.owner, 1)
			.invoke()?;

		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		opening.seed_slot.set(committed.seed_slot);

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for FulfillTemplateOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FulfillTemplateOpenInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let opening_address = *self.opening.address();
		let randomness_address = *self.randomness.address();
		self.payer.assert_signer()?.assert_writable()?;
		self.opening.assert_writable()?;
		self.randomness.assert_writable()?;
		self.oracle_stats.assert_writable()?;
		self.reward_escrow.assert_writable()?;
		self.recent_slot_hashes
			.assert_sysvar(&SLOT_HASHES_SYSVAR_ID)?;
		self.system_program.assert_address(&system::ID)?;
		self.token_program.assert_address(&token::ID)?;
		self.wrapped_sol_mint.assert_address(&WRAPPED_SOL_MINT_ID)?;
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		self.oracle_queue.assert_address(&state.oracle_queue)?;
		self.oracle_program.assert_program(&state.oracle_program)?;
		let opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;

		if opening.status != OPENING_PENDING {
			return Err(lootbox_error(LootboxError::OpeningAlreadyFinalized));
		}

		assert_reveal_payer(self.payer.address(), &opening.recipient)?;
		if opening.template != template_address || opening.randomness != randomness_address {
			return Err(lootbox_error(LootboxError::InvalidRecipient));
		}

		let opening_seeds = TemplateOpeningState::seeds(&template_address, &randomness_address);
		let opening_seeds_with_bump = opening_seeds.with_bump(opening.bump);
		let expected_opening = create_program_address(&opening_seeds_with_bump.as_slices(), &ID)?;

		if expected_opening != opening_address {
			return Err(ProgramError::InvalidSeeds);
		}
		let randomness = parse_randomness(self.randomness, &state.oracle_program)?;

		if randomness.authority != opening_address
			|| randomness.queue != state.oracle_queue
			|| randomness.seed_slot != opening.seed_slot.get()
			|| randomness.oracle != *self.oracle.address()
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		if randomness.reveal_slot != 0 {
			return Err(lootbox_error(LootboxError::RandomnessExpired));
		}
		drop(opening);
		drop(state);

		let mut reveal_data = [0u8; 105];
		reveal_data[..8].copy_from_slice(&RANDOMNESS_REVEAL_DISCRIMINATOR);
		reveal_data[8..72].copy_from_slice(&args.signature);
		reveal_data[72] = args.recovery_id;
		reveal_data[73..].copy_from_slice(&args.value);
		let reveal_accounts = [
			InstructionAccount::writable(self.randomness.address()),
			InstructionAccount::readonly(self.oracle.address()),
			InstructionAccount::readonly(self.oracle_queue.address()),
			InstructionAccount::writable(self.oracle_stats.address()),
			InstructionAccount::readonly_signer(self.opening.address()),
			InstructionAccount::writable_signer(self.payer.address()),
			InstructionAccount::readonly(self.recent_slot_hashes.address()),
			InstructionAccount::readonly(self.system_program.address()),
			InstructionAccount::writable(self.reward_escrow.address()),
			InstructionAccount::readonly(self.token_program.address()),
			InstructionAccount::readonly(self.wrapped_sol_mint.address()),
			InstructionAccount::readonly(self.oracle_program_state.address()),
		];
		let reveal_account_views: [&AccountView; 12] = [
			self.randomness,
			self.oracle,
			self.oracle_queue,
			self.oracle_stats,
			self.opening,
			self.payer,
			self.recent_slot_hashes,
			self.system_program,
			self.reward_escrow,
			self.token_program,
			self.wrapped_sol_mint,
			self.oracle_program_state,
		];
		let reveal_instruction = InstructionView {
			program_id: self.oracle_program.address(),
			accounts: &reveal_accounts,
			data: &reveal_data,
		};
		let opening_signer = opening_seeds_with_bump.to_signer();
		let signers = [opening_signer.as_signer()];
		pinocchio::cpi::invoke_signed::<12, _>(
			&reveal_instruction,
			&reveal_account_views,
			&signers,
		)?;

		let state = self.template.as_account::<TemplateState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		let randomness = parse_randomness(self.randomness, &state.oracle_program)?;

		if randomness.authority != opening_address
			|| randomness.queue != state.oracle_queue
			|| randomness.seed_slot != opening.seed_slot.get()
			|| randomness.oracle != *self.oracle.address()
			|| randomness.reveal_slot <= randomness.seed_slot
			|| randomness.value != args.value
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		opening.entropy = randomness.value;
		opening.status = 1;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for ForfeitTemplateOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = ForfeitTemplateOpenInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let opening_address = *self.opening.address();
		self.caller.assert_signer()?;
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&opening_address, &opening, &template_address)?;
		if opening.randomness != *self.randomness.address() {
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}
		let randomness = parse_randomness(self.randomness, &state.oracle_program)?;
		if randomness.authority != opening_address
			|| randomness.queue != state.oracle_queue
			|| randomness.seed_slot != opening.seed_slot.get()
			|| randomness.reveal_slot != 0
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}
		let refund_slot = opening
			.seed_slot
			.get()
			.checked_add(RANDOMNESS_TIMEOUT_SLOTS)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		if sysvars::clock::Clock::get()?.slot < refund_slot {
			return Err(lootbox_error(LootboxError::OpeningNotExpired));
		}
		record_forfeit(&mut state, &mut opening)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn retirement_preserves_opening_rights_but_drafts_do_not() {
		assert!(assert_openable(TEMPLATE_DRAFT).is_err());
		assert_eq!(assert_openable(TEMPLATE_LIVE), Ok(()));
		assert_eq!(assert_openable(TEMPLATE_RETIRED), Ok(()));
	}

	#[test]
	fn reveal_payer_is_the_bound_recipient() {
		let recipient = Address::default();
		assert_eq!(assert_reveal_payer(&recipient, &recipient), Ok(()));
		assert!(assert_reveal_payer(&ID, &recipient).is_err());
	}

	#[test]
	fn timeout_forfeits_only_the_fifo_head_without_consuming_inventory() {
		let mut template_bytes = [0; TemplateState::SIZE];
		let state = TemplateState::initialize(&mut template_bytes).expect("template");
		state.remaining_bundles.set(3);
		state.pending_openings.set(2);
		state.next_allocation.set(7);
		let mut opening_bytes = [0; TemplateOpeningState::SIZE];
		let opening = TemplateOpeningState::initialize(&mut opening_bytes).expect("opening");
		opening.status = OPENING_PENDING;
		opening.sequence.set(8);
		assert!(record_forfeit(state, opening).is_err());
		assert_eq!(state.pending_openings.get(), 2);
		opening.sequence.set(7);
		assert_eq!(record_forfeit(state, opening), Ok(()));
		assert_eq!(opening.status, 4);
		assert_eq!(state.pending_openings.get(), 1);
		assert_eq!(state.next_allocation.get(), 8);
		assert_eq!(state.remaining_bundles.get(), 3);
		assert!(record_forfeit(state, opening).is_err());
	}
}
