//! Retirement stops issuance; it never revokes an existing holder's claim.

use pina::sysvars::Sysvar;

use super::*;

/// Permanently retires a live template: issuance and every creator mutation
/// stop, while existing boxes stay openable and prizes stay claimable.
///
/// Signed by the template authority. An issued template that is not
/// market-locked may retire only at or after `opens_at`, as a missed-deadline
/// recovery; that path also disables result receipts and settlement bounties,
/// which were never prepaid.
#[instruction(discriminator = LootboxInstruction::RetireTemplate, migrations)]
pub struct RetireTemplateInstruction {}

/// Returns undrawn native SOL inventory of one bundle asset to the template
/// authority.
///
/// Signed by the template authority. A funding bundle releases its full
/// quantity; an active bundle releases only its remaining undrawn copies and
/// requires a retired template with zero box supply and zero pending openings.
/// Allocated but unclaimed copies stay escrowed, and each asset is reclaimed
/// at most once.
#[instruction(discriminator = LootboxInstruction::ReclaimSolPrize, migrations)]
pub struct ReclaimSolPrizeInstruction {
	/// Asset slot within the bundle; must be below its funded asset count,
	/// hold a `PRIZE_SOL` or `PRIZE_QUOTE_SOL` asset, and not be reclaimed
	/// already.
	pub asset_index: u8,
}

/// Returns undrawn token inventory of one bundle asset from its escrow to the
/// template authority's associated token account.
///
/// Signed by the template authority. A funding bundle releases its full
/// quantity; an active bundle releases only its remaining undrawn copies and
/// requires a retired template with zero box supply and zero pending openings.
/// Allocated but unclaimed copies stay escrowed, and each asset is reclaimed
/// at most once.
#[instruction(discriminator = LootboxInstruction::ReclaimTokenPrize, migrations)]
pub struct ReclaimTokenPrizeInstruction {
	/// Asset slot within the bundle; must be below its funded asset count,
	/// hold a `PRIZE_TOKEN`, `PRIZE_NFT`, `PRIZE_TOKEN_2022`, or
	/// `PRIZE_QUOTE_TOKEN` asset, and not be reclaimed already.
	pub asset_index: u8,
}

/// Releases undrawn copies of one mint-badge asset and revokes the bundle's
/// mint authority once no copies remain claimable.
///
/// Signed by the template authority, under the same funding-or-retired rules
/// as the other reclaims. Mints nothing; when allocated copies are still
/// unclaimed, only the accounting changes and the final claim later revokes
/// the authority.
#[instruction(discriminator = LootboxInstruction::ReclaimMintPrize, migrations)]
pub struct ReclaimMintPrizeInstruction {
	/// Asset slot within the bundle; must be below its funded asset count,
	/// hold a `PRIZE_MINT_BADGE` asset with an amount of one, and not be
	/// reclaimed already.
	pub asset_index: u8,
}

/// Accounts for `retireTemplate`.
#[derive(Accounts, Debug)]
pub struct RetireTemplateAccounts<'a> {
	/// Template authority; must sign and match the authority recorded on the
	/// template.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Live template treasury, validated by its PDA seeds; moves to the retired
	/// status.
	pub template: &'a mut AccountView,
}

/// Accounts for `reclaimSolPrize`.
#[derive(Accounts, Debug)]
pub struct ReclaimSolPrizeAccounts<'a> {
	/// Template authority; must sign and match the authority recorded on the
	/// template. Receives the reclaimed lamports.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template treasury, validated by its PDA seeds; supplies the status,
	/// pending-opening count, and remaining inventory of the bundle.
	pub template: &'a AccountView,
	/// Template's box mint, validated against the template; its live supply
	/// must be zero to reclaim from an active bundle.
	pub box_mint: &'a AccountView,
	/// Bundle PDA of this template; records the asset as reclaimed and pays
	/// the lamports directly.
	pub bundle: &'a mut AccountView,
}

/// Accounts for `reclaimTokenPrize`.
#[derive(Accounts, Debug)]
pub struct ReclaimTokenPrizeAccounts<'a> {
	/// Template authority; must sign and match the authority recorded on the
	/// template. Owns `destination`.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Template treasury, validated by its PDA seeds; supplies the status,
	/// pending-opening count, and remaining inventory of the bundle.
	pub template: &'a AccountView,
	/// Template's box mint, validated against the template; its live supply
	/// must be zero to reclaim from an active bundle.
	pub box_mint: &'a AccountView,
	/// Bundle PDA of this template; records the asset as reclaimed and signs
	/// the transfer as escrow owner.
	pub bundle: &'a mut AccountView,
	/// Prize mint; must match the mint recorded in the bundle's asset slot.
	pub mint: &'a AccountView,
	/// Bundle's associated token account for `mint` under `token_program`;
	/// source of the transfer.
	pub escrow: &'a mut AccountView,
	/// Authority's existing associated token account for `mint` under
	/// `token_program`; receives the tokens.
	pub destination: &'a mut AccountView,
	/// SPL Token or Token-2022 program matching the asset kind: SPL Token for
	/// `PRIZE_TOKEN` and `PRIZE_NFT`, Token-2022 for `PRIZE_TOKEN_2022`, and
	/// either for `PRIZE_QUOTE_TOKEN`.
	pub token_program: &'a AccountView,
}

/// Accounts for `reclaimMintPrize`.
#[derive(Accounts, Debug)]
pub struct ReclaimMintPrizeAccounts<'a> {
	/// Template authority; must sign and match the authority recorded on the
	/// template.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Template treasury, validated by its PDA seeds; supplies the status,
	/// pending-opening count, and remaining inventory of the bundle.
	pub template: &'a AccountView,
	/// Template's box mint, validated against the template; its live supply
	/// must be zero to reclaim from an active bundle.
	pub box_mint: &'a AccountView,
	/// Bundle PDA of this template; records the asset as reclaimed and signs
	/// the authority revocation.
	pub bundle: &'a mut AccountView,
	/// Badge mint recorded in the bundle's asset slot; must have zero decimals,
	/// the bundle as mint authority, no freeze authority, and only metadata
	/// extensions. Its mint authority is revoked once every copy is released.
	pub mint: &'a mut AccountView,
	/// SPL Token or Token-2022 program that owns `mint`.
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
		let state = as_template(self.template)?;
		assert_template(&address, &state)?;
		assert_template_authority(self.authority, &state)?;
		validate_retirement(&state, sysvars::clock::Clock::get()?.unix_timestamp)?;

		let patch = if state.locked_at.get() == 0 {
			// The optional services are funded only by a successful market lock.
			// A missed-deadline recovery therefore preserves opening rights without
			// promising receipts or bounties that were never collateralized.
			TemplateStatePatch::new()
				.status(TEMPLATE_RETIRED)
				.result_receipts_enabled(false)
				.settlement_bounty_lamports(0)
		} else {
			TemplateStatePatch::new().status(TEMPLATE_RETIRED)
		};
		update_template(self.template, &patch)?;

		Ok(())
	}
}

pub(super) fn reclaim_amount(
	template_status: u8,
	pending_openings: u64,
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
			if template_status != TEMPLATE_RETIRED || supply != 0 || pending_openings != 0 {
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

#[cfg(kani)]
mod proofs {
	use super::*;

	#[kani::proof]
	fn retirement_reclaims_only_undrawn_inventory() {
		let quantity = kani::any::<u64>();
		let claimed = kani::any::<u64>();
		let active_remaining = kani::any::<u64>();

		kani::assume(claimed <= quantity);
		kani::assume(active_remaining <= quantity - claimed);

		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes, |_| Ok(())).expect("bundle");
		bundle.quantity.set(quantity);
		bundle.funded_assets = 1;
		bundle.status = BUNDLE_ACTIVE;
		write_slot(&mut bundle.claimed, 0, claimed).expect("claimed slot");
		write_slot(&mut bundle.amounts, 0, 1).expect("amount slot");

		let reclaimed = reclaim_amount(TEMPLATE_RETIRED, 0, bundle, 0, 0, Some(active_remaining))
			.expect("valid retirement recovery");
		let released = claimed + active_remaining;

		assert_eq!(reclaimed, active_remaining);
		assert_eq!(read_slot(&bundle.claimed, 0), Ok(released));
		assert_eq!(bundle.reclaimed_mask, 1);
		assert_eq!(quantity - released, quantity - claimed - active_remaining);

		assert!(reclaim_amount(TEMPLATE_RETIRED, 0, bundle, 0, 0, Some(active_remaining)).is_err());
		assert_eq!(read_slot(&bundle.claimed, 0), Ok(released));
	}
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
			state.status,
			state.pending_openings.get(),
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
		self.bundle.send_owned(&ID, amount, self.authority)
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

		drop(self.escrow.as_associated_token_account(
			&bundle_address,
			self.mint.address(),
			&token_program,
		)?);
		drop(self.destination.as_associated_token_account(
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
			state.status,
			state.pending_openings.get(),
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

		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		let _ = reclaim_amount(
			state.status,
			state.pending_openings.get(),
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)?;
		if read_slot(&bundle.claimed, index)? != bundle.quantity.get() {
			// Allocated copies remain claimable after retirement. Their claims mint
			// the final badges and revoke this authority once every copy is released.
			return Ok(());
		}
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
		let mut state = initialized_template_header(&TemplateStatePatch::new());
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
		let mut state = initialized_template_header(&TemplateStatePatch::new());
		state.status = TEMPLATE_RETIRED;
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes, |_| Ok(())).expect("bundle");
		bundle.quantity.set(5);
		bundle.funded_assets = 1;
		bundle.status = BUNDLE_ACTIVE;
		write_slot(&mut bundle.amounts, 0, 100).expect("amount");
		assert!(
			reclaim_amount(
				state.status,
				state.pending_openings.get(),
				bundle,
				1,
				0,
				Some(3),
			)
			.is_err()
		);
		state.pending_openings.set(1);
		assert!(
			reclaim_amount(
				state.status,
				state.pending_openings.get(),
				bundle,
				0,
				0,
				Some(3),
			)
			.is_err()
		);
		state.pending_openings.set(0);
		assert_eq!(
			reclaim_amount(
				state.status,
				state.pending_openings.get(),
				bundle,
				0,
				0,
				Some(3),
			),
			Ok(300)
		);
		assert_eq!(read_slot(&bundle.claimed, 0), Ok(3));
		assert_eq!(
			bundle.quantity.get() - read_slot(&bundle.claimed, 0).expect("released"),
			2
		);
		assert!(
			reclaim_amount(
				state.status,
				state.pending_openings.get(),
				bundle,
				0,
				0,
				Some(3),
			)
			.is_err()
		);
	}
}
