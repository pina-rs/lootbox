//! Reclaim receipt and randomness rent after every prize asset is delivered.

use super::*;

#[instruction(discriminator = LootboxInstruction::CloseTemplateOpening)]
pub struct CloseTemplateOpeningInstruction {}

#[instruction(discriminator = LootboxInstruction::CloseServiceVault)]
pub struct CloseServiceVaultInstruction {}

#[derive(Accounts, Debug)]
pub struct CloseTemplateOpeningAccounts<'a> {
	pub rent_refund: &'a mut AccountView,
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub randomness: &'a mut AccountView,
	pub reward_escrow: &'a mut AccountView,
	pub oracle_program: &'a AccountView,
	pub oracle_program_state: &'a AccountView,
	pub oracle_lut: &'a mut AccountView,
	pub oracle_lut_signer: &'a AccountView,
	pub system_program: &'a AccountView,
	pub token_program: &'a AccountView,
	pub wrapped_sol_mint: &'a AccountView,
	pub address_lookup_table_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct CloseServiceVaultAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub service_vault: &'a mut AccountView,
	pub system_program: &'a AccountView,
}

impl<'a> ProcessAccountInfos<'a> for CloseTemplateOpeningAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = CloseTemplateOpeningInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let opening_address = *self.opening.address();
		let randomness_address = *self.randomness.address();
		self.rent_refund.assert_writable()?;
		self.opening.assert_writable()?;
		self.randomness.assert_writable()?;
		self.reward_escrow.assert_writable()?;
		self.oracle_lut.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.token_program.assert_address(&token::ID)?;
		self.wrapped_sol_mint.assert_address(&WRAPPED_SOL_MINT_ID)?;
		self.address_lookup_table_program
			.assert_address(&ADDRESS_LOOKUP_TABLE_PROGRAM_ID)?;
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		self.oracle_program.assert_program(&state.oracle_program)?;
		let opening = self.opening.as_account::<TemplateOpeningState>(&ID)?;

		if opening.status != 3 && opening.status != 4 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if opening.rent_refund != *self.rent_refund.address()
			|| opening.template != template_address
			|| opening.randomness != randomness_address
		{
			return Err(lootbox_error(LootboxError::InvalidRecipient));
		}

		let opening_seeds = TemplateOpeningState::seeds(&template_address, &randomness_address);
		let opening_seeds_with_bump = opening_seeds.with_bump(opening.bump);
		let expected_opening = create_program_address(&opening_seeds_with_bump.as_slices(), &ID)?;

		if expected_opening != opening_address {
			return Err(ProgramError::InvalidSeeds);
		}
		let randomness = parse_randomness(self.randomness, &state.oracle_program)?;

		if randomness.authority != opening_address || randomness.queue != state.oracle_queue {
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}
		drop(opening);
		drop(state);

		let close_accounts = [
			InstructionAccount::writable(self.randomness.address()),
			InstructionAccount::writable(self.reward_escrow.address()),
			InstructionAccount::writable_signer(self.opening.address()),
			InstructionAccount::readonly(self.oracle_program_state.address()),
			InstructionAccount::readonly(self.system_program.address()),
			InstructionAccount::readonly(self.token_program.address()),
			InstructionAccount::readonly(self.wrapped_sol_mint.address()),
			InstructionAccount::writable(self.oracle_lut.address()),
			InstructionAccount::readonly(self.oracle_lut_signer.address()),
			InstructionAccount::readonly(self.address_lookup_table_program.address()),
		];
		let close_account_views: [&AccountView; 10] = [
			self.randomness,
			self.reward_escrow,
			self.opening,
			self.oracle_program_state,
			self.system_program,
			self.token_program,
			self.wrapped_sol_mint,
			self.oracle_lut,
			self.oracle_lut_signer,
			self.address_lookup_table_program,
		];
		let close_instruction = InstructionView {
			program_id: self.oracle_program.address(),
			accounts: &close_accounts,
			data: &RANDOMNESS_CLOSE_DISCRIMINATOR,
		};
		let opening_signer = opening_seeds_with_bump.to_signer();
		let signers = [opening_signer.as_signer()];
		pinocchio::cpi::invoke_signed::<10, _>(&close_instruction, &close_account_views, &signers)?;

		self.opening.close_account_zeroed(self.rent_refund)
	}
}

impl<'a> ProcessAccountInfos<'a> for CloseServiceVaultAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = CloseServiceVaultInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		self.authority.assert_signer()?.assert_writable()?;
		self.service_vault.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		let state = self.template.as_account::<TemplateState>(&ID)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		if !has_service_vault(&state) {
			return Err(lootbox_error(LootboxError::InvalidServiceAccount));
		}
		assert_service_vault(self.service_vault, &template_address, &state)?;
		let supply = assert_template_mint(
			self.box_mint,
			&template_address,
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;

		if state.status != TEMPLATE_RETIRED || state.pending_openings.get() != 0 || supply != 0 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		let service_vault_bump = state.service_vault_bump;
		drop(state);
		let balance = self.service_vault.lamports();
		if balance == 0 {
			return Ok(());
		}
		let service_vault_bump = [service_vault_bump];
		let service_vault_signer = PdaSigner::from_slices([
			SEED_SERVICE_VAULT,
			template_address.as_ref(),
			service_vault_bump.as_slice(),
		]);
		system::instructions::Transfer {
			from: self.service_vault,
			to: self.authority,
			lamports: balance,
		}
		.invoke_signed(&[service_vault_signer.as_signer()])
	}
}
