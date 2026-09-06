//! Retirement stops issuance; it never revokes an existing holder's claim.

use pina::sysvars::Sysvar;

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

#[instruction(discriminator = LootboxInstruction::ReclaimMintPrize)]
pub struct ReclaimMintPrizeInstruction {
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

#[derive(Accounts, Debug)]
pub struct ReclaimMintPrizeAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub mint: &'a mut AccountView,
	pub token_program: &'a AccountView,
}

fn validate_retirement(state: &TemplateStateHeader, now: i64) -> ProgramResult {
	if state.status != TEMPLATE_LIVE {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	// Before reveal, issued series must use the exact-supply market lock. Once
	// that deadline is missed, retirement is the bounded recovery seal: all
	// creator mutations stop, but existing holders may still burn and open.
	if state.total_minted.get() != 0 && state.locked_at.get() == 0 && state.opens_at.get() > now {
		return Err(lootbox_error(LootboxError::TreasuryUnlocked));
	}

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for RetireTemplateAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = RetireTemplateInstruction::try_from_bytes(data)?;
		let address = *self.template.address();
		let mut state = as_template_mut(self.template)?;
		assert_template(&address, &state)?;
		assert_template_authority(self.authority, &state)?;
		validate_retirement(&state, sysvars::clock::Clock::get()?.unix_timestamp)?;

		state.status = TEMPLATE_RETIRED;
		if state.locked_at.get() == 0 {
			// The optional services are funded only by a successful market lock.
			// A missed-deadline recovery therefore preserves opening rights without
			// promising receipts or bounties that were never collateralized.
			state.result_receipts_enabled.set(false);
			state.settlement_bounty_lamports.set(0);
		}

		Ok(())
	}
}

pub(super) fn reclaim_amount(
	state: &TemplateStateHeader,
	bundle: &mut BundleStateZc,
	supply: u64,
	asset_index: u8,
	active_remaining: Option<u64>,
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
			active_remaining.ok_or(ProgramError::InvalidAccountData)?
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
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
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
		if !matches!(bundle.kinds.get(index), Some(&PRIZE_SOL | &PRIZE_QUOTE_SOL)) {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		let amount = reclaim_amount(
			&state,
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)?;
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
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
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
			self.authority.address(),
			self.mint.address(),
			&token_program,
		)?);
		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		let amount = reclaim_amount(
			&state,
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)?;
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

impl<'a> ProcessAccountInfos<'a> for ReclaimMintPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimMintPrizeInstruction::try_from_bytes(data)?;
		let bundle_address = *self.bundle.address();
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
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
		if bundle.kinds.get(index) != Some(&PRIZE_MINT_BADGE)
			|| mint_at(&bundle, index)? != *self.mint.address()
			|| read_slot(&bundle.amounts, index)? != 1
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let claimed = read_slot(&bundle.claimed, index)?;
		let mint = self
			.mint
			.as_token_mint_for_program(&token_program)?
			.assert_extensions_allowed(&[
				token_2022::state::ExtensionType::MetadataPointer,
				token_2022::state::ExtensionType::TokenMetadata,
			])?;
		if mint.supply() != claimed
			|| mint.decimals() != 0
			|| mint.mint_authority() != Some(&bundle_address)
			|| mint.freeze_authority().is_some()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(mint);

		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		let _ = reclaim_amount(
			&state,
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)?;
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		if token_program == token_2022::ID {
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::SetAuthority::new(
				self.mint,
				self.bundle,
				token_2022::instructions::AuthorityType::MintTokens,
				None,
			)
			.invoke_signed(&signers)
		} else {
			self.token_program.assert_address(&token::ID)?;
			token::instructions::SetAuthority::new(
				self.mint,
				self.bundle,
				token::instructions::AuthorityType::MintTokens,
				None,
			)
			.invoke_signed(&signers)
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn issued_unlocked_treasury_can_only_recover_after_its_deadline() {
		let mut bytes = [0; TemplateState::HEADER_SIZE];
		let mut state = TemplateState::initialize(&mut bytes).expect("template");
		state.status = TEMPLATE_LIVE;
		state.total_minted.set(1);
		state.opens_at.set(1_001);

		assert!(validate_retirement(&state, 1_000).is_err());
		assert_eq!(validate_retirement(&state, 1_001), Ok(()));
		state.locked_at.set(999);
		assert_eq!(validate_retirement(&state, 1_000), Ok(()));
	}

	#[test]
	fn retirement_preserves_allocated_but_unclaimed_prizes() {
		let mut bytes = [0; TemplateState::HEADER_SIZE];
		let mut state = TemplateState::initialize(&mut bytes).expect("template");
		state.status = TEMPLATE_RETIRED;
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes).expect("bundle");
		bundle.quantity.set(5);
		bundle.funded_assets = 1;
		bundle.status = BUNDLE_ACTIVE;
		write_slot(&mut bundle.amounts, 0, 100).expect("amount");
		assert!(reclaim_amount(&state, bundle, 1, 0, Some(3)).is_err());
		state.pending_openings.set(1);
		assert!(reclaim_amount(&state, bundle, 0, 0, Some(3)).is_err());
		state.pending_openings.set(0);
		assert_eq!(reclaim_amount(&state, bundle, 0, 0, Some(3)), Ok(300));
		assert_eq!(read_slot(&bundle.claimed, 0), Ok(3));
		assert_eq!(
			bundle.quantity.get() - read_slot(&bundle.claimed, 0).expect("released"),
			2
		);
		assert!(reclaim_amount(&state, bundle, 0, 0, Some(3)).is_err());
	}
}
