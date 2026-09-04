//! FIFO allocation is independent of retryable, recipient-bound asset delivery.

use super::*;

#[instruction(discriminator = LootboxInstruction::AllocateTemplateOpen)]
pub struct AllocateTemplateOpenInstruction {}

#[instruction(discriminator = LootboxInstruction::ClaimSolPrize)]
pub struct ClaimSolPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ClaimTokenPrize)]
pub struct ClaimTokenPrizeInstruction {
	pub asset_index: u8,
}

#[derive(Accounts, Debug)]
pub struct AllocateTemplateOpenAccounts<'a> {
	pub template: &'a mut AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a AccountView,
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
	state: &TemplateStateZc,
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
		let weight = read_slot(&state.remaining, index)?;
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
	state: &mut TemplateStateZc,
	opening: &mut TemplateOpeningStateZc,
	address: &Address,
	bundle_index: u32,
) -> ProgramResult {
	if opening.status != 1 {
		return Err(lootbox_error(LootboxError::RandomnessNotReady));
	}

	if opening.sequence.get() != state.next_allocation.get() {
		return Err(lootbox_error(LootboxError::AllocationOutOfOrder));
	}

	if opening.eligible_bundle_count.get() > state.bundle_count.get()
		|| opening.treasury_version.get() > state.version.get()
	{
		return Err(ProgramError::InvalidAccountData);
	}
	let inventory = available_in_prefix(state, opening.eligible_bundle_count.get())?;
	let target = select_outcome(&opening.entropy, &opening.template, address, inventory)?;
	let selected = bundle_for_target(state, opening.eligible_bundle_count.get(), target)?;
	if selected != bundle_index {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	let index = usize::try_from(selected).map_err(|_| ProgramError::InvalidAccountData)?;
	let remaining = read_slot(&state.remaining, index)?
		.checked_sub(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	write_slot(&mut state.remaining, index, remaining)?;
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
	opening.selected_bundle.set(selected);
	opening.status = 2;

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for AllocateTemplateOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = AllocateTemplateOpenInstruction::try_from_bytes(data)?;
		let template = *self.template.address();
		let address = *self.opening.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&template, &state)?;
		assert_bundle(self.bundle, &template)?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&address, &opening, &template)?;

		if bundle.status != BUNDLE_ACTIVE
			|| bundle.activated_version.get() > opening.treasury_version.get()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		allocate(&mut state, &mut opening, &address, bundle.index.get())
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

	if opening.recipient != *recipient {
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
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&address, &opening, self.template.address())?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_SOL) {
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
		let state = self.template.as_account::<TemplateState>(&ID)?;
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
		let expected_kind = if token_program == token_2022::ID {
			PRIZE_TOKEN_2022
		} else {
			bundle.kinds.get(index).copied().unwrap_or(u8::MAX)
		};
		if !matches!(expected_kind, PRIZE_TOKEN | PRIZE_NFT | PRIZE_TOKEN_2022)
			|| bundle.kinds.get(index) != Some(&expected_kind)
			|| mint_at(&bundle, index)? != *self.mint.address()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		drop(self.escrow.as_associated_token_account_checked(
			&bundle_address,
			self.mint.address(),
			&token_program,
		)?);
		drop(self.destination.as_associated_token_account_checked(
			&opening.recipient,
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

#[cfg(test)]
mod tests {
	use proptest::prelude::*;

	use super::*;

	fn pool(bytes: &mut [u8; TemplateState::SIZE], quantities: [u64; 3]) -> &mut TemplateStateZc {
		let state = TemplateState::initialize(bytes).expect("template");
		state.bundle_count.set(3);
		state.version.set(3);
		state.status = TEMPLATE_LIVE;
		let total = quantities.iter().sum();
		state.remaining_bundles.set(total);
		state.total_bundles.set(total);
		for (index, count) in quantities.into_iter().enumerate() {
			write_slot(&mut state.remaining, index, count).expect("inventory");
		}
		state
	}

	#[test]
	fn finite_odds_follow_remaining_units_and_skip_exhausted_prizes() {
		let mut bytes = [0; TemplateState::SIZE];
		let state = pool(&mut bytes, [90, 9, 1]);
		assert_eq!(available_in_prefix(state, 3), Ok(100));
		assert_eq!(bundle_for_target(state, 3, 89), Ok(0));
		assert_eq!(bundle_for_target(state, 3, 90), Ok(1));
		assert_eq!(bundle_for_target(state, 3, 99), Ok(2));
		write_slot(&mut state.remaining, 2, 0).expect("jackpot consumed");
		state.remaining_bundles.set(99);
		assert_eq!(available_in_prefix(state, 3), Ok(99));
		assert_eq!(bundle_for_target(state, 3, 98), Ok(1));
		assert!(bundle_for_target(state, 3, 99).is_err());
		assert_eq!(validate_issuance(state, 0, 1), Ok(1));
	}

	#[test]
	fn mint_capacity_includes_pending_openings() {
		let mut bytes = [0; TemplateState::SIZE];
		let state = pool(&mut bytes, [3, 3, 1]);
		state.pending_openings.set(2);
		assert_eq!(validate_issuance(state, 4, 1), Ok(1));
		assert_eq!(
			validate_issuance(state, 4, 2),
			Err(lootbox_error(LootboxError::SupplyExceeded))
		);
		state.total_minted.set(7);
		assert_eq!(
			validate_issuance(state, 0, 1),
			Err(lootbox_error(LootboxError::SupplyExceeded))
		);
	}

	#[test]
	fn revealed_openings_cannot_jump_the_queue() {
		let mut bytes = [0; TemplateState::SIZE];
		let state = pool(&mut bytes, [3, 3, 1]);
		state.pending_openings.set(2);
		let mut receipt = [0; TemplateOpeningState::SIZE];
		let opening = TemplateOpeningState::initialize(&mut receipt).expect("opening");
		opening.status = 1;
		opening.sequence.set(1);
		opening.treasury_version.set(3);
		opening.eligible_bundle_count.set(3);
		assert_eq!(
			allocate(state, opening, &Address::default(), 0),
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
	fn all_256_append_slots_are_addressable_and_snapshots_exclude_later_bundles() {
		let mut bytes = [0; TemplateState::SIZE];
		let state = TemplateState::initialize(&mut bytes).expect("template");
		state.bundle_count.set(256);
		for index in 0..MAX_TEMPLATE_BUNDLES {
			write_slot(&mut state.remaining, index, 1).expect("inventory slot");
		}
		assert_eq!(available_in_prefix(state, 9), Ok(9));
		assert_eq!(available_in_prefix(state, 256), Ok(256));
		assert_eq!(bundle_for_target(state, 9, 8), Ok(8));
		assert!(bundle_for_target(state, 9, 9).is_err());
		assert_eq!(bundle_for_target(state, 256, 255), Ok(255));
	}

	proptest! {
		#[test]
		fn every_issued_box_can_allocate_without_reusing_inventory(a in 1u64..15, b in 1u64..15, c in 1u64..4, entropy in any::<[u8; 32]>()) {
			let quantities = [a, b, c];
			let total = a + b + c;
			let mut bytes = [0; TemplateState::SIZE];
			let state = pool(&mut bytes, quantities);
			state.total_minted.set(total);
			state.pending_openings.set(total);
			let mut awarded = [0u64; 3];
			for sequence in 0..total {
				let mut receipt = [0; TemplateOpeningState::SIZE];
				let opening = TemplateOpeningState::initialize(&mut receipt).expect("opening");
				opening.status = 1;
				opening.sequence.set(sequence);
				opening.treasury_version.set(3);
				opening.eligible_bundle_count.set(3);
				opening.entropy = entropy;
				let target = select_outcome(&entropy, &Address::default(), &Address::default(), available_in_prefix(state, 3).expect("inventory")).expect("target");
				let selected = bundle_for_target(state, 3, target).expect("outcome");
				allocate(state, opening, &Address::default(), selected).expect("allocate");
				awarded[usize::try_from(selected).expect("index")] += 1;
				prop_assert_eq!(state.pending_openings.get(), total - sequence - 1);
				prop_assert_eq!(state.remaining_bundles.get(), total - sequence - 1);
				prop_assert!(allocate(state, opening, &Address::default(), selected).is_err());
			}
			prop_assert_eq!(awarded, quantities);
			prop_assert_eq!(available_in_prefix(state, 3), Ok(0));
		}
	}
}
