//! Retirement stops issuance; it never revokes an existing holder's claim.

use super::*;

#[instruction(discriminator = LootboxInstruction::RetireTemplate)]
pub struct RetireTemplateInstruction {}

#[instruction(discriminator = LootboxInstruction::ReclaimSolPrize)]
pub struct ReclaimSolPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ReclaimTokenPrize)]
pub struct ReclaimTokenPrizeInstruction {
	pub asset_index: u8,
}

#[derive(Accounts, Debug)]
pub struct RetireTemplateAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct ReclaimSolPrizeAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct ReclaimTokenPrizeAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub mint: &'a AccountView,
	pub escrow: &'a mut AccountView,
	pub destination: &'a mut AccountView,
	pub token_program: &'a AccountView,
}

impl<'a> ProcessAccountInfos<'a> for RetireTemplateAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = RetireTemplateInstruction::try_from_bytes(data)?;
		let address = *self.template.address();
		let mut state = self.template.as_account_mut::<TemplateState>(&ID)?;
		assert_template(&address, &state)?;
		assert_template_authority(self.authority, &state)?;
		if state.status != TEMPLATE_LIVE {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		// Issued market boxes may only be retired after the irreversible lock;
		// otherwise the creator could strand holders before their reveal date.
		if state.total_minted.get() != 0 && state.locked_at.get() == 0 {
			return Err(lootbox_error(LootboxError::TreasuryUnlocked));
		}

		state.status = TEMPLATE_RETIRED;

		Ok(())
	}
}

pub(super) fn reclaim_amount(
	state: &TemplateStateZc,
	bundle: &mut BundleStateZc,
	supply: u64,
	asset_index: u8,
) -> Result<u64, ProgramError> {
	// Allocated but not yet claimed prizes are deliberately excluded from this
	// recovery: only inventory still in the draw pool belongs to the creator.
	if asset_index >= bundle.funded_assets {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	let bit = 1u8
		.checked_shl(u32::from(asset_index))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if bundle.reclaimed_mask & bit != 0 {
		return Err(lootbox_error(LootboxError::PrizeAlreadyClaimed));
	}

	let index = usize::from(asset_index);
	let unused = match bundle.status {
		BUNDLE_FUNDING => bundle.quantity.get(),
		BUNDLE_ACTIVE => {
			if state.status != TEMPLATE_RETIRED || supply != 0 || state.pending_openings.get() != 0
			{
				return Err(lootbox_error(LootboxError::InvalidState));
			}
			let bundle_index = usize::try_from(bundle.index.get())
				.map_err(|_| ProgramError::InvalidAccountData)?;
			read_slot(&state.remaining, bundle_index)?
		}
		_ => return Err(lootbox_error(LootboxError::InvalidState)),
	};
	let released = read_slot(&bundle.claimed, index)?
		.checked_add(unused)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if released > bundle.quantity.get() {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	let amount = read_slot(&bundle.amounts, index)?
		.checked_mul(unused)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	write_slot(&mut bundle.claimed, index, released)?;
	bundle.reclaimed_mask |= bit;

	Ok(amount)
}

impl<'a> ProcessAccountInfos<'a> for ReclaimSolPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimSolPrizeInstruction::try_from_bytes(data)?;
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let supply = assert_template_mint(
			self.box_mint,
			self.template.address(),
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_SOL) {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let amount = reclaim_amount(&state, &mut bundle, supply, args.asset_index)?;
		let owed = bundle
			.quantity
			.get()
			.checked_sub(read_slot(&bundle.claimed, index)?)
			.and_then(|count| count.checked_mul(read_slot(&bundle.amounts, index).ok()?))
			.and_then(|value| value.checked_add(bundle.rent_reserve.get()))
			.ok_or(ProgramError::ArithmeticOverflow)?;
		drop(bundle);
		let after = self
			.bundle
			.lamports()
			.checked_sub(amount)
			.ok_or_else(|| lootbox_error(LootboxError::Insolvent))?;
		if after < owed {
			return Err(lootbox_error(LootboxError::Insolvent));
		}

		self.bundle.assert_owner(&ID)?;
		self.bundle.send(amount, self.authority)
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimTokenPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimTokenPrizeInstruction::try_from_bytes(data)?;
		let bundle_address = *self.bundle.address();
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let token_program = *self.token_program.address();
		if token_program != token::ID && token_program != token_2022::ID {
			return Err(ProgramError::IncorrectProgramId);
		}
		let supply = assert_template_mint(
			self.box_mint,
			self.template.address(),
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
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
			self.authority.address(),
			self.mint.address(),
			&token_program,
		)?);
		let amount = reclaim_amount(&state, &mut bundle, supply, args.asset_index)?;
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		let decimals = bundle.decimals[index];
		drop(bundle);
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
	use super::*;

	#[test]
	fn retirement_preserves_allocated_but_unclaimed_prizes() {
		let mut bytes = [0; TemplateState::SIZE];
		let state = TemplateState::initialize(&mut bytes).expect("template");
		state.status = TEMPLATE_RETIRED;
		write_slot(&mut state.remaining, 0, 3).expect("three undrawn");
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes).expect("bundle");
		bundle.quantity.set(5);
		bundle.funded_assets = 1;
		bundle.status = BUNDLE_ACTIVE;
		write_slot(&mut bundle.amounts, 0, 100).expect("amount");
		assert!(reclaim_amount(state, bundle, 1, 0).is_err());
		state.pending_openings.set(1);
		assert!(reclaim_amount(state, bundle, 0, 0).is_err());
		state.pending_openings.set(0);
		assert_eq!(reclaim_amount(state, bundle, 0, 0), Ok(300));
		assert_eq!(read_slot(&bundle.claimed, 0), Ok(3));
		assert_eq!(
			bundle.quantity.get() - read_slot(&bundle.claimed, 0).expect("released"),
			2
		);
		assert!(reclaim_amount(state, bundle, 0, 0).is_err());
	}
}
