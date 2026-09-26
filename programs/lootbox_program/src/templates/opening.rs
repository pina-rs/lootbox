//! Commit and persist oracle entropy before FIFO allocation or asset transfers.

use pina::sysvars::Sysvar;

use super::*;

/// Burns one box and commits a fresh Switchboard randomness request for it,
/// creating a pending opening at the tail of the template's FIFO queue.
///
/// Signed by the box holder and a payer, which may be a sponsor, plus the new
/// randomness keypair. Requires a non-draft template that is market-locked or
/// retired, a reached `opens_at`, and remaining inventory for every live and
/// pending box. The beneficiary, consumer binding, request sequence, treasury
/// revision, and eligible bundle prefix are fixed before any entropy exists.
#[instruction(discriminator = LootboxInstruction::RequestTemplateOpen, migrations)]
pub struct RequestTemplateOpenInstruction {
	/// Recent slot passed to Switchboard `randomness_init`, which uses it to
	/// derive the per-randomness address lookup table.
	pub recent_slot: u64,
	/// Immutable destination for every prize claim and any forfeit bounty of
	/// this opening; rejected when it is the default address. May differ from
	/// the box authority and the payer.
	pub beneficiary: Address,
	/// Program expected to consume the result receipt, or the default address
	/// for none. Recorded on the opening and copied into any result receipt.
	pub consumer_program: Address,
	/// Consumer-selected correlation key, fixed before randomness is known;
	/// must be all zeros when `consumer_program` is the default address.
	pub consumer_context: [u8; 32],
	/// Canonical bump of the opening PDA; rejected unless it equals the derived
	/// canonical bump.
	pub bump: u8,
}

/// Verifies the Switchboard reveal for a pending opening and records its
/// entropy, moving the opening to the verified status.
///
/// Permissionless: any signer may submit the gateway proof, and openings may
/// be verified out of FIFO order. Requires a pending opening whose randomness
/// is still unrevealed; the program applies no deadline of its own, so only
/// `forfeitTemplateOpen` ends the window. Pays any configured settlement
/// bounty from the service vault to the payer.
#[instruction(discriminator = LootboxInstruction::FulfillTemplateOpen, migrations)]
pub struct FulfillTemplateOpenInstruction {
	/// Switchboard enclave signature returned by the randomness gateway.
	pub signature: [u8; 64],
	/// Secp256k1 recovery identifier returned by the randomness gateway.
	pub recovery_id: u8,
	/// Revealed value covered by `signature`; rejected unless Switchboard
	/// stores exactly this value on the randomness account.
	pub value: [u8; 32],
}

/// Forfeits the FIFO head opening after its reveal timed out, so later
/// openings can allocate.
///
/// Permissionless: any signer may call once `RANDOMNESS_TIMEOUT_SLOTS` slots
/// have passed since the committed seed slot and the randomness is still
/// unrevealed. Consumes no inventory, never remints the box, and never changes
/// the beneficiary; pays any configured settlement bounty to the beneficiary.
#[instruction(discriminator = LootboxInstruction::ForfeitTemplateOpen, migrations)]
pub struct ForfeitTemplateOpenInstruction {}

/// Accounts for `requestTemplateOpen`.
#[derive(Accounts, Debug)]
pub struct RequestTemplateOpenAccounts<'a> {
	/// Owns the box token account and authorizes burning exactly one box.
	/// Recorded on the opening as `box_authority`.
	#[pina(validate(signer))]
	pub box_authority: &'a AccountView,
	/// Pays for the opening and oracle initialization; may be a sponsor.
	/// Recorded as the opening's `rent_refund` address.
	///
	/// The immutable authority intentionally precedes the mutable payer so the
	/// same signer may fill both roles after Solana promotes duplicate metas to
	/// writable. Parsing the mutable alias last preserves the cursor's safety
	/// checks while supporting the common self-paid opening flow.
	#[pina(validate(signer))]
	pub payer: &'a mut AccountView,
	/// Template treasury, validated by its PDA seeds; its request sequence and
	/// pending-opening count advance.
	pub template: &'a mut AccountView,
	/// Template's Token-2022 box mint, validated against the template; one box
	/// is burned from it.
	pub box_mint: &'a mut AccountView,
	/// Box authority's Token-2022 associated token account for `box_mint`; must
	/// hold at least one box, and one is burned.
	pub box_account: &'a mut AccountView,
	/// Opening PDA at `["template-opening", template, randomness]`; must be
	/// empty, is created here funded by `payer`, and signs as the randomness
	/// authority.
	#[pina(validate(empty))]
	pub opening: &'a mut AccountView,
	/// Fresh Switchboard randomness account; must sign and be empty because
	/// `randomness_init` creates it. Its address seeds the opening PDA.
	#[pina(validate(signer))]
	#[pina(validate(empty))]
	pub randomness: &'a mut AccountView,
	/// Switchboard reward escrow for `randomness`; rejected unless it is the
	/// wrapped-SOL associated token account of `randomness`.
	pub reward_escrow: &'a mut AccountView,
	/// Switchboard queue; must match the queue recorded on the template.
	pub oracle_queue: &'a mut AccountView,
	/// Oracle assigned to the commitment; must be owned by the oracle program,
	/// and Switchboard checks its queue membership. Recorded on `randomness`.
	pub oracle: &'a mut AccountView,
	/// Slot hashes sysvar, read by Switchboard `randomness_commit`.
	#[pina(validate(sysvar = SLOT_HASHES_SYSVAR_ID))]
	pub recent_slot_hashes: &'a AccountView,
	/// Switchboard On-Demand program; must match the oracle program recorded on
	/// the template.
	pub oracle_program: &'a AccountView,
	/// Switchboard program state, passed to `randomness_init`.
	pub oracle_program_state: &'a AccountView,
	/// Switchboard lookup-table signer, passed to `randomness_init`.
	pub oracle_lut_signer: &'a AccountView,
	/// Switchboard address lookup table for `randomness`, derived from
	/// `recent_slot` and passed to `randomness_init`.
	pub oracle_lut: &'a mut AccountView,
	/// Associated Token Account program, used by Switchboard for the reward
	/// escrow.
	#[pina(validate(address = associated_token_account::ID))]
	pub associated_token_program: &'a AccountView,
	/// Wrapped SOL mint backing the reward escrow.
	#[pina(validate(address = WRAPPED_SOL_MINT_ID))]
	pub wrapped_sol_mint: &'a AccountView,
	/// Address Lookup Table program, used by Switchboard for `oracle_lut`.
	#[pina(validate(address = ADDRESS_LOOKUP_TABLE_PROGRAM_ID))]
	pub address_lookup_table_program: &'a AccountView,
	/// System program, used to create the opening and Switchboard accounts.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// Token-2022 program, invoked to burn the box.
	#[pina(validate(address = token_2022::ID))]
	pub box_token_program: &'a AccountView,
	/// SPL Token program backing the wrapped-SOL reward escrow.
	#[pina(validate(address = token::ID))]
	pub token_program: &'a AccountView,
}

/// Accounts for `fulfillTemplateOpen`.
#[derive(Accounts, Debug)]
pub struct FulfillTemplateOpenAccounts<'a> {
	/// Submits the proof and funds Switchboard's reveal bookkeeping; receives
	/// the settlement bounty when one is configured.
	#[pina(validate(signer))]
	pub payer: &'a mut AccountView,
	/// Template treasury, validated by its PDA seeds; its remaining
	/// settlement-bounty count is written back.
	pub template: &'a mut AccountView,
	/// Service vault PDA at `["service-vault", template]`; validated only when
	/// receipts or bounties are enabled, and pays the settlement bounty.
	pub service_vault: &'a mut AccountView,
	/// Pending opening PDA for `template` and `randomness`; signs the reveal as
	/// the randomness authority, then stores the entropy and becomes verified.
	pub opening: &'a mut AccountView,
	/// Switchboard randomness bound to the opening; must be committed at the
	/// opening's seed slot and not yet revealed.
	pub randomness: &'a mut AccountView,
	/// Switchboard queue; must match the queue recorded on the template.
	pub oracle_queue: &'a AccountView,
	/// Oracle bound at commit time; rejected unless it matches the oracle
	/// recorded on `randomness`.
	pub oracle: &'a AccountView,
	/// Oracle stats account, updated by Switchboard `randomness_reveal`.
	pub oracle_stats: &'a mut AccountView,
	/// Slot hashes sysvar, read by Switchboard `randomness_reveal`.
	#[pina(validate(sysvar = SLOT_HASHES_SYSVAR_ID))]
	pub recent_slot_hashes: &'a AccountView,
	/// Switchboard On-Demand program; must match the oracle program recorded on
	/// the template.
	pub oracle_program: &'a AccountView,
	/// Switchboard reward escrow for `randomness`; rejected unless it is the
	/// wrapped-SOL associated token account of `randomness`.
	pub reward_escrow: &'a mut AccountView,
	/// Switchboard program state, passed to `randomness_reveal`.
	pub oracle_program_state: &'a AccountView,
	/// System program, used by Switchboard and for the bounty transfer.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// SPL Token program backing the wrapped-SOL reward escrow.
	#[pina(validate(address = token::ID))]
	pub token_program: &'a AccountView,
	/// Wrapped SOL mint backing the reward escrow.
	#[pina(validate(address = WRAPPED_SOL_MINT_ID))]
	pub wrapped_sol_mint: &'a AccountView,
}

/// Accounts for `forfeitTemplateOpen`.
#[derive(Accounts, Debug)]
pub struct ForfeitTemplateOpenAccounts<'a> {
	/// Any signer may advance an expired FIFO head; the stored beneficiary and
	/// their exclusive claim rights are never changed.
	#[pina(validate(signer))]
	pub caller: &'a mut AccountView,
	/// Bound destination of the forfeit bounty: the creator-funded service
	/// budget compensates the beneficiary whose box burned, never the crank.
	/// Must match the opening's stored beneficiary.
	pub beneficiary: &'a mut AccountView,
	/// Template treasury, validated by its PDA seeds; its pending-opening count
	/// falls and its FIFO allocation cursor advances.
	pub template: &'a mut AccountView,
	/// Service vault PDA at `["service-vault", template]`; validated only when
	/// receipts or bounties are enabled, and pays the settlement bounty.
	pub service_vault: &'a mut AccountView,
	/// Pending opening at the FIFO head, validated by its PDA seeds; moves to
	/// the forfeited status and is not closed here.
	pub opening: &'a mut AccountView,
	/// Switchboard randomness bound to the opening; must still be unrevealed at
	/// the committed seed slot, which starts the timeout.
	pub randomness: &'a AccountView,
	/// System program, used for the bounty transfer.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

fn assert_openable(state: &TemplateStateHeader) -> ProgramResult {
	if state.status == TEMPLATE_DRAFT {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	if state.locked_at.get() == 0 && state.status != TEMPLATE_RETIRED {
		return Err(lootbox_error(LootboxError::TreasuryUnlocked));
	}

	Ok(())
}

fn validate_request_binding(
	beneficiary: &Address,
	consumer_program: &Address,
	consumer_context: &[u8; 32],
) -> ProgramResult {
	if *beneficiary == Address::default()
		|| (*consumer_program == Address::default()
			&& consumer_context.iter().any(|byte| *byte != 0))
	{
		return Err(ProgramError::InvalidArgument);
	}

	Ok(())
}

fn record_forfeit(
	state: &mut TemplateStateHeader,
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

fn pay_settlement_bounty(
	template: &Address,
	state: &mut TemplateStateHeader,
	service_vault: &mut AccountView,
	recipient: &mut AccountView,
	system_program: &AccountView,
) -> ProgramResult {
	assert_service_vault(service_vault, template, state)?;
	let bounty = state.settlement_bounty_lamports.get();

	if bounty == 0 {
		return Ok(());
	}

	service_vault.assert_writable()?;
	recipient.assert_writable()?;
	let service_vault_balance = service_vault.lamports();
	let remaining = state
		.remaining_settlement_bounties
		.get()
		.checked_sub(1)
		.ok_or_else(|| lootbox_error(LootboxError::ServiceBudgetExhausted))?;
	let required_before = required_service_balance(state)?;

	if service_vault_balance < required_before {
		return Err(lootbox_error(LootboxError::ServiceBudgetExhausted));
	}

	state.remaining_settlement_bounties.set(remaining);
	let required_after = required_service_balance(state)?;
	let balance_after = service_vault
		.lamports()
		.checked_sub(bounty)
		.ok_or_else(|| lootbox_error(LootboxError::ServiceBudgetExhausted))?;

	if balance_after < required_after {
		return Err(lootbox_error(LootboxError::ServiceBudgetExhausted));
	}

	system_program.assert_address(&system::ID)?;
	let service_vault_bump = [state.service_vault_bump];
	let service_vault_signer = PdaSigner::from_slices([
		SEED_SERVICE_VAULT,
		template.as_ref(),
		service_vault_bump.as_slice(),
	]);
	system::instructions::Transfer {
		from: service_vault,
		to: recipient,
		lamports: bounty,
	}
	.invoke_signed(&[service_vault_signer.as_signer()])
}

impl<'a> ProcessAccountInfos<'a> for RequestTemplateOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = RequestTemplateOpenInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let payer_address = *self.payer.address();
		let box_authority_address = *self.box_authority.address();
		let randomness_address = *self.randomness.address();
		let opening_address = *self.opening.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		self.oracle_queue.assert_address(&state.oracle_queue)?;
		self.oracle_program.assert_program(&state.oracle_program)?;

		validate_request_binding(
			&args.beneficiary,
			&args.consumer_program,
			&args.consumer_context,
		)?;

		// Retirement closes administration. A market lock or a missed-deadline
		// recovery retirement preserves every issued holder's right to open.
		assert_openable(&state)?;

		if sysvars::clock::Clock::get()?.unix_timestamp < state.opens_at.get() {
			return Err(lootbox_error(LootboxError::ClaimLocked));
		}

		let mint_supply = assert_template_mint(
			self.box_mint,
			&template_address,
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;
		let box_account = self.box_account.as_associated_token_account(
			&box_authority_address,
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

		assert_reward_escrow(self.reward_escrow, &randomness_address)?;
		assert_commit_oracle(self.oracle, self.oracle_program.address())?;

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
		let treasury_revision = state.revision.get();
		let eligible_bundle_count = state.bundle_count.get();
		let next_request = sequence
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		update_template(
			self.template,
			&TemplateStatePatch::new()
				.next_request(next_request)
				.pending_openings(pending),
		)?;

		CreateProgramAccountWithBump {
			account: self.opening,
			payer: self.payer,
			owner: &ID,
			seeds: &opening_seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<TemplateOpeningState>()?;

		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		opening.template = template_address;
		opening.box_authority = box_authority_address;
		opening.beneficiary = args.beneficiary;
		opening.rent_refund = payer_address;
		opening.consumer_program = args.consumer_program;
		opening.consumer_context = args.consumer_context;
		opening.randomness = randomness_address;
		opening.status = OPENING_PENDING;
		opening.sequence.set(sequence);
		opening.treasury_revision.set(treasury_revision);
		opening.eligible_bundle_count.set(eligible_bundle_count);
		opening.bump = args.bump;
		drop(opening);

		let opening_signer = opening_seeds_with_bump.to_signer();
		let signers = [opening_signer.as_signer()];

		RandomnessInit {
			program_id: self.oracle_program.address(),
			randomness: self.randomness,
			reward_escrow: self.reward_escrow,
			authority: self.opening,
			queue: self.oracle_queue,
			payer: self.payer,
			system_program: self.system_program,
			token_program: self.token_program,
			associated_token_program: self.associated_token_program,
			wrapped_sol_mint: self.wrapped_sol_mint,
			program_state: self.oracle_program_state,
			lut_signer: self.oracle_lut_signer,
			lut: self.oracle_lut,
			address_lookup_table_program: self.address_lookup_table_program,
			recent_slot: args.recent_slot.get(),
		}
		.invoke_signed(&signers)?;

		let initialized = parse_randomness(self.randomness, self.oracle_program.address())?;

		if initialized.authority != opening_address
			|| initialized.queue != *self.oracle_queue.address()
			|| initialized.seed_slot != 0
			|| initialized.reveal_slot != 0
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		RandomnessCommit {
			program_id: self.oracle_program.address(),
			randomness: self.randomness,
			queue: self.oracle_queue,
			oracle: self.oracle,
			recent_slot_hashes: self.recent_slot_hashes,
			authority: self.opening,
		}
		.invoke_signed(&signers)?;

		let committed = parse_randomness(self.randomness, self.oracle_program.address())?;

		if committed.authority != opening_address
			|| committed.queue != *self.oracle_queue.address()
			|| committed.seed_slot == 0
			|| committed.reveal_slot != 0
			|| committed.oracle != *self.oracle.address()
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		token_2022::instructions::Burn::new(self.box_account, self.box_mint, self.box_authority, 1)
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
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_service_vault(self.service_vault, &template_address, &state)?;
		self.oracle_queue.assert_address(&state.oracle_queue)?;
		self.oracle_program.assert_program(&state.oracle_program)?;
		let opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;

		if opening.status != OPENING_PENDING {
			return Err(lootbox_error(LootboxError::OpeningAlreadyFinalized));
		}

		if opening.template != template_address || opening.randomness != randomness_address {
			return Err(lootbox_error(LootboxError::InvalidRecipient));
		}

		let opening_seeds = TemplateOpeningState::seeds(&template_address, &randomness_address);
		let opening_seeds_with_bump = opening_seeds.with_bump(opening.bump);
		let expected_opening = create_program_address(&opening_seeds_with_bump.as_slices(), &ID)?;

		if expected_opening != opening_address {
			return Err(ProgramError::InvalidSeeds);
		}
		assert_reward_escrow(self.reward_escrow, &randomness_address)?;
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

		let opening_signer = opening_seeds_with_bump.to_signer();
		let signers = [opening_signer.as_signer()];

		RandomnessReveal {
			program_id: self.oracle_program.address(),
			randomness: self.randomness,
			oracle: self.oracle,
			queue: self.oracle_queue,
			oracle_stats: self.oracle_stats,
			authority: self.opening,
			payer: self.payer,
			recent_slot_hashes: self.recent_slot_hashes,
			system_program: self.system_program,
			reward_escrow: self.reward_escrow,
			token_program: self.token_program,
			wrapped_sol_mint: self.wrapped_sol_mint,
			program_state: self.oracle_program_state,
			signature: &args.signature,
			recovery_id: args.recovery_id,
			value: &args.value,
		}
		.invoke_signed(&signers)?;

		let mut state = as_template(self.template)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		let randomness = parse_randomness(self.randomness, &state.oracle_program)?;

		// Switchboard clears the bound oracle when it records a reveal, so the
		// oracle is checked only before the CPI; the reveal itself verifies the
		// proof against that oracle.
		if randomness.authority != opening_address
			|| randomness.queue != state.oracle_queue
			|| randomness.seed_slot != opening.seed_slot.get()
			|| randomness.reveal_slot <= randomness.seed_slot
			|| randomness.value != args.value
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		opening.entropy = randomness.value;
		opening.status = 1;
		drop(opening);
		pay_settlement_bounty(
			&template_address,
			&mut state,
			self.service_vault,
			self.payer,
			self.system_program,
		)?;
		update_template(
			self.template,
			&TemplateStatePatch::new()
				.remaining_settlement_bounties(state.remaining_settlement_bounties.get()),
		)?;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for ForfeitTemplateOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = ForfeitTemplateOpenInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let opening_address = *self.opening.address();
		let mut state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_service_vault(self.service_vault, &template_address, &state)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&opening_address, &opening, &template_address)?;
		if opening.randomness != *self.randomness.address()
			|| opening.beneficiary != *self.beneficiary.address()
		{
			return Err(lootbox_error(LootboxError::InvalidRecipient));
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
		record_forfeit(&mut state, &mut opening)?;
		drop(opening);

		pay_settlement_bounty(
			&template_address,
			&mut state,
			self.service_vault,
			self.beneficiary,
			self.system_program,
		)?;
		update_template(
			self.template,
			&TemplateStatePatch::new()
				.pending_openings(state.pending_openings.get())
				.next_allocation(state.next_allocation.get())
				.remaining_settlement_bounties(state.remaining_settlement_bounties.get()),
		)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn retirement_preserves_opening_rights_but_drafts_do_not() {
		let mut state = initialized_template_header(&TemplateStatePatch::new());

		assert!(assert_openable(&state).is_err());
		state.status = TEMPLATE_LIVE;
		assert!(assert_openable(&state).is_err());
		state.status = TEMPLATE_RETIRED;
		assert_eq!(assert_openable(&state), Ok(()));
		state.status = TEMPLATE_LIVE;
		state.locked_at.set(1);
		assert_eq!(assert_openable(&state), Ok(()));
		state.status = TEMPLATE_RETIRED;
		assert_eq!(assert_openable(&state), Ok(()));
	}

	#[test]
	fn consumer_context_requires_a_consumer_program() {
		let beneficiary = Address::new_from_array([1; 32]);
		assert_eq!(
			validate_request_binding(&beneficiary, &Address::default(), &[0; 32]),
			Ok(())
		);
		assert!(validate_request_binding(&beneficiary, &Address::default(), &[1; 32]).is_err());
		assert_eq!(
			validate_request_binding(&beneficiary, &ID, &[1; 32]),
			Ok(())
		);
	}

	#[test]
	fn timeout_forfeits_only_the_fifo_head_without_consuming_inventory() {
		let mut state = initialized_template_header(
			&TemplateStatePatch::new()
				.remaining_bundles(3)
				.pending_openings(2)
				.next_allocation(7),
		);
		let mut opening_bytes = [0; TemplateOpeningState::SIZE];
		let opening =
			TemplateOpeningState::initialize(&mut opening_bytes, |_| Ok(())).expect("opening");
		opening.status = OPENING_PENDING;
		opening.sequence.set(8);
		assert!(record_forfeit(&mut state, opening).is_err());
		assert_eq!(state.pending_openings.get(), 2);
		opening.sequence.set(7);
		assert_eq!(record_forfeit(&mut state, opening), Ok(()));
		assert_eq!(opening.status, 4);
		assert_eq!(state.pending_openings.get(), 1);
		assert_eq!(state.next_allocation.get(), 8);
		assert_eq!(state.remaining_bundles.get(), 3);
		assert!(record_forfeit(&mut state, opening).is_err());
	}
}
