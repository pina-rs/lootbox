//! Prize adapters for Metaplex Token Metadata, Core, and Bubblegum assets.

use alloc::vec::Vec;

use super::*;

const MPL_TOKEN_METADATA_ID: Address = address!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const MPL_CORE_ID: Address = address!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const MPL_BUBBLEGUM_ID: Address = address!("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");
const SPL_ACCOUNT_COMPRESSION_ID: Address = address!("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
const SPL_NOOP_ID: Address = address!("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");
const INSTRUCTIONS_SYSVAR_ID: Address = address!("Sysvar1nstructions1111111111111111111111111");

#[instruction(discriminator = LootboxInstruction::FundMetadataNftPrize)]
pub struct FundMetadataNftPrizeInstruction {}

#[instruction(discriminator = LootboxInstruction::ClaimMetadataNftPrize)]
pub struct ClaimMetadataNftPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ReclaimMetadataNftPrize)]
pub struct ReclaimMetadataNftPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::FundCoreAssetPrize)]
pub struct FundCoreAssetPrizeInstruction {}

#[instruction(discriminator = LootboxInstruction::ClaimCoreAssetPrize)]
pub struct ClaimCoreAssetPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::ReclaimCoreAssetPrize)]
pub struct ReclaimCoreAssetPrizeInstruction {
	pub asset_index: u8,
}

#[instruction(discriminator = LootboxInstruction::FundCompressedNftPrize)]
pub struct FundCompressedNftPrizeInstruction {
	pub root: [u8; 32],
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub index: u32,
}

#[instruction(discriminator = LootboxInstruction::ClaimCompressedNftPrize)]
pub struct ClaimCompressedNftPrizeInstruction {
	pub asset_index: u8,
	pub root: [u8; 32],
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub index: u32,
}

#[instruction(discriminator = LootboxInstruction::ReclaimCompressedNftPrize)]
pub struct ReclaimCompressedNftPrizeInstruction {
	pub asset_index: u8,
	pub root: [u8; 32],
	pub data_hash: [u8; 32],
	pub creator_hash: [u8; 32],
	pub nonce: u64,
	pub index: u32,
}

#[derive(Accounts, Debug)]
pub struct FundMetadataNftPrizeAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub mint: &'a AccountView,
	pub source: &'a mut AccountView,
	pub escrow: &'a mut AccountView,
	pub metadata: &'a mut AccountView,
	pub token_metadata_program: &'a AccountView,
	pub system_program: &'a AccountView,
	pub instructions_sysvar: &'a AccountView,
	pub token_program: &'a AccountView,
	pub associated_token_program: &'a AccountView,
	/// Edition, source record, destination record, rules program, and rules.
	#[pina(remaining)]
	pub optional_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ClaimMetadataNftPrizeAccounts<'a> {
	pub payer: &'a mut AccountView,
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub recipient: &'a AccountView,
	pub mint: &'a AccountView,
	pub escrow: &'a mut AccountView,
	pub destination: &'a mut AccountView,
	pub metadata: &'a mut AccountView,
	pub token_metadata_program: &'a AccountView,
	pub system_program: &'a AccountView,
	pub instructions_sysvar: &'a AccountView,
	pub token_program: &'a AccountView,
	pub associated_token_program: &'a AccountView,
	/// Edition, source record, destination record, rules program, and rules.
	#[pina(remaining)]
	pub optional_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ReclaimMetadataNftPrizeAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub mint: &'a AccountView,
	pub escrow: &'a mut AccountView,
	pub destination: &'a mut AccountView,
	pub metadata: &'a mut AccountView,
	pub token_metadata_program: &'a AccountView,
	pub system_program: &'a AccountView,
	pub instructions_sysvar: &'a AccountView,
	pub token_program: &'a AccountView,
	pub associated_token_program: &'a AccountView,
	/// Edition, source record, destination record, rules program, and rules.
	#[pina(remaining)]
	pub optional_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct FundCoreAssetPrizeAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub asset: &'a mut AccountView,
	pub collection: &'a AccountView,
	pub core_program: &'a AccountView,
	pub system_program: &'a AccountView,
	pub log_wrapper: &'a AccountView,
	/// Core plugin and external-adapter accounts, preserving client flags.
	#[pina(remaining)]
	pub plugin_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ClaimCoreAssetPrizeAccounts<'a> {
	pub payer: &'a mut AccountView,
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub recipient: &'a AccountView,
	pub asset: &'a mut AccountView,
	pub collection: &'a AccountView,
	pub core_program: &'a AccountView,
	pub system_program: &'a AccountView,
	pub log_wrapper: &'a AccountView,
	/// Core plugin and external-adapter accounts, preserving client flags.
	#[pina(remaining)]
	pub plugin_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ReclaimCoreAssetPrizeAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub asset: &'a mut AccountView,
	pub collection: &'a AccountView,
	pub core_program: &'a AccountView,
	pub system_program: &'a AccountView,
	pub log_wrapper: &'a AccountView,
	/// Core plugin and external-adapter accounts, preserving client flags.
	#[pina(remaining)]
	pub plugin_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct FundCompressedNftPrizeAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub tree_config: &'a AccountView,
	pub merkle_tree: &'a mut AccountView,
	pub bubblegum_program: &'a AccountView,
	pub log_wrapper: &'a AccountView,
	pub compression_program: &'a AccountView,
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in root-to-leaf order.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ClaimCompressedNftPrizeAccounts<'a> {
	pub template: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub bundle: &'a mut AccountView,
	pub recipient: &'a AccountView,
	pub tree_config: &'a AccountView,
	pub merkle_tree: &'a mut AccountView,
	pub bubblegum_program: &'a AccountView,
	pub log_wrapper: &'a AccountView,
	pub compression_program: &'a AccountView,
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in root-to-leaf order.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

#[derive(Accounts, Debug)]
pub struct ReclaimCompressedNftPrizeAccounts<'a> {
	pub authority: &'a AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	pub bundle: &'a mut AccountView,
	pub tree_config: &'a AccountView,
	pub merkle_tree: &'a mut AccountView,
	pub bubblegum_program: &'a AccountView,
	pub log_wrapper: &'a AccountView,
	pub compression_program: &'a AccountView,
	pub system_program: &'a AccountView,
	/// Merkle proof nodes in root-to-leaf order.
	#[pina(remaining)]
	pub proof_accounts: &'a [AccountView],
}

struct MetadataTransfer<'a> {
	source: &'a AccountView,
	source_owner: &'a AccountView,
	destination: &'a AccountView,
	destination_owner: &'a AccountView,
	mint: &'a AccountView,
	metadata: &'a AccountView,
	authority: &'a AccountView,
	payer: &'a AccountView,
	system_program: &'a AccountView,
	instructions_sysvar: &'a AccountView,
	token_program: &'a AccountView,
	associated_token_program: &'a AccountView,
	token_metadata_program: &'a AccountView,
}

fn invoke_metadata_transfer(
	accounts: &MetadataTransfer<'_>,
	optional_accounts: &[AccountView],
	signers: &[Signer<'_, '_>],
) -> ProgramResult {
	// Token Metadata transfer ABI pinned to upstream commit
	// 6f5dbcbfcb658ce1c371ea517b46583c0d23a90f: discriminator [49, 0],
	// amount 1, no authorization data, and the 17-account order below.
	if optional_accounts.len() != 5 {
		return Err(ProgramError::NotEnoughAccountKeys);
	}
	let placeholder = |account: &AccountView| account.address() == &MPL_TOKEN_METADATA_ID;
	let mut metas = Vec::with_capacity(17);
	metas.push(InstructionAccount::writable(accounts.source.address()));
	metas.push(InstructionAccount::readonly(
		accounts.source_owner.address(),
	));
	metas.push(InstructionAccount::writable(accounts.destination.address()));
	metas.push(InstructionAccount::readonly(
		accounts.destination_owner.address(),
	));
	metas.push(InstructionAccount::readonly(accounts.mint.address()));
	metas.push(InstructionAccount::writable(accounts.metadata.address()));
	metas.push(InstructionAccount::readonly(optional_accounts[0].address()));
	for account in &optional_accounts[1..3] {
		metas.push(if placeholder(account) {
			InstructionAccount::readonly(account.address())
		} else {
			InstructionAccount::writable(account.address())
		});
	}
	metas.push(InstructionAccount::readonly_signer(
		accounts.authority.address(),
	));
	metas.push(InstructionAccount::writable_signer(
		accounts.payer.address(),
	));
	metas.push(InstructionAccount::readonly(
		accounts.system_program.address(),
	));
	metas.push(InstructionAccount::readonly(
		accounts.instructions_sysvar.address(),
	));
	metas.push(InstructionAccount::readonly(
		accounts.token_program.address(),
	));
	metas.push(InstructionAccount::readonly(
		accounts.associated_token_program.address(),
	));
	metas.push(InstructionAccount::readonly(optional_accounts[3].address()));
	metas.push(InstructionAccount::readonly(optional_accounts[4].address()));

	let mut views = Vec::with_capacity(17);
	views.extend_from_slice(&[
		accounts.source,
		accounts.source_owner,
		accounts.destination,
		accounts.destination_owner,
		accounts.mint,
		accounts.metadata,
	]);
	views.extend(optional_accounts.iter().take(3));
	views.extend_from_slice(&[
		accounts.authority,
		accounts.payer,
		accounts.system_program,
		accounts.instructions_sysvar,
		accounts.token_program,
		accounts.associated_token_program,
	]);
	views.extend(optional_accounts.iter().skip(3));

	let mut data = [0u8; 11];
	data[..2].copy_from_slice(&[49, 0]);
	data[2..10].copy_from_slice(&1u64.to_le_bytes());
	let instruction = InstructionView {
		program_id: accounts.token_metadata_program.address(),
		accounts: &metas,
		data: &data,
	};
	pinocchio::cpi::invoke_signed_with_slice(&instruction, &views, signers)
}

struct MetadataValidation<'a> {
	mint: &'a AccountView,
	metadata: &'a AccountView,
	token_metadata_program: &'a AccountView,
	system_program: &'a AccountView,
	instructions_sysvar: &'a AccountView,
	token_program: &'a AccountView,
	associated_token_program: &'a AccountView,
}

fn metadata_authority_is_safe(authority: Option<&Address>, edition: &Address) -> bool {
	authority.is_none_or(|address| address == edition)
}

fn validate_metadata_accounts(
	accounts: &MetadataValidation<'_>,
	optional_accounts: &[AccountView],
) -> ProgramResult {
	if optional_accounts.len() != 5 {
		return Err(ProgramError::NotEnoughAccountKeys);
	}
	// Admission policy: programmable token records and mutable authorization
	// rules can change after funding and strand a prize. Until those semantics
	// have dedicated compatibility tests, accept only standard Metadata NFTs.
	if optional_accounts[1..]
		.iter()
		.any(|account| account.address() != &MPL_TOKEN_METADATA_ID)
	{
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	accounts
		.token_metadata_program
		.assert_program(&MPL_TOKEN_METADATA_ID)?;
	accounts.system_program.assert_address(&system::ID)?;
	accounts
		.instructions_sysvar
		.assert_sysvar(&INSTRUCTIONS_SYSVAR_ID)?;
	accounts.token_program.assert_address(&token::ID)?;
	accounts
		.associated_token_program
		.assert_address(&associated_token_account::ID)?;
	let mint_data = accounts.mint.as_token_mint_checked()?;
	if mint_data.supply() != 1 || mint_data.decimals() != 0 {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	let (expected_edition, _) = try_find_program_address(
		&[
			b"metadata",
			MPL_TOKEN_METADATA_ID.as_ref(),
			accounts.mint.address().as_ref(),
			b"edition",
		],
		&MPL_TOKEN_METADATA_ID,
	)
	.ok_or(ProgramError::InvalidSeeds)?;
	let mint_authority = mint_data.mint_authority();
	let freeze_authority = mint_data.freeze_authority();
	if !metadata_authority_is_safe(mint_authority, &expected_edition)
		|| !metadata_authority_is_safe(freeze_authority, &expected_edition)
	{
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	let uses_edition_authority = mint_authority.is_some() || freeze_authority.is_some();
	drop(mint_data);
	if uses_edition_authority {
		optional_accounts[0]
			.assert_address(&expected_edition)?
			.assert_owner(&MPL_TOKEN_METADATA_ID)?;
	}
	let (expected_metadata, _) = try_find_program_address(
		&[
			b"metadata",
			MPL_TOKEN_METADATA_ID.as_ref(),
			accounts.mint.address().as_ref(),
		],
		&MPL_TOKEN_METADATA_ID,
	)
	.ok_or(ProgramError::InvalidSeeds)?;
	accounts
		.metadata
		.assert_address(&expected_metadata)?
		.assert_owner(&MPL_TOKEN_METADATA_ID)?;

	Ok(())
}

struct CoreTransfer<'a> {
	asset: &'a AccountView,
	collection: &'a AccountView,
	payer: &'a AccountView,
	authority: &'a AccountView,
	new_owner: &'a AccountView,
	core_program: &'a AccountView,
	system_program: &'a AccountView,
	log_wrapper: &'a AccountView,
}

fn invoke_core_transfer(
	accounts: &CoreTransfer<'_>,
	plugin_accounts: &[AccountView],
	signers: &[Signer<'_, '_>],
) -> ProgramResult {
	// Core transfer ABI pinned to upstream commit
	// 83131e07872b9e98dcdb6dde8ec53931813c0d20: discriminator [14], no
	// compression proof, and the seven fixed accounts followed by adapters.
	let mut metas = Vec::with_capacity(7 + plugin_accounts.len());
	metas.extend_from_slice(&[
		InstructionAccount::writable(accounts.asset.address()),
		InstructionAccount::readonly(accounts.collection.address()),
		InstructionAccount::writable_signer(accounts.payer.address()),
		InstructionAccount::readonly_signer(accounts.authority.address()),
		InstructionAccount::readonly(accounts.new_owner.address()),
		InstructionAccount::readonly(accounts.system_program.address()),
		InstructionAccount::readonly(accounts.log_wrapper.address()),
	]);
	for account in plugin_accounts {
		metas.push(InstructionAccount::new(
			account.address(),
			account.is_writable(),
			account.is_signer(),
		));
	}
	let mut views = Vec::with_capacity(7 + plugin_accounts.len());
	views.extend_from_slice(&[
		accounts.asset,
		accounts.collection,
		accounts.payer,
		accounts.authority,
		accounts.new_owner,
		accounts.system_program,
		accounts.log_wrapper,
	]);
	views.extend(plugin_accounts.iter());
	let instruction = InstructionView {
		program_id: accounts.core_program.address(),
		accounts: &metas,
		data: &[14, 0],
	};
	pinocchio::cpi::invoke_signed_with_slice(&instruction, &views, signers)
}

fn validate_core_accounts(
	asset: &AccountView,
	collection: &AccountView,
	plugin_accounts: &[AccountView],
	core_program: &AccountView,
	system_program: &AccountView,
	log_wrapper: &AccountView,
) -> ProgramResult {
	core_program.assert_program(&MPL_CORE_ID)?;
	asset.assert_owner(&MPL_CORE_ID)?;
	// Collections and plugins can add transfer delegates or external adapters
	// after escrow. Plain, uncollected Core assets have no such mutable
	// dependency and are the only admitted Core shape for now.
	collection.assert_address(&MPL_CORE_ID)?;
	if !plugin_accounts.is_empty() {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}
	system_program.assert_address(&system::ID)?;
	log_wrapper.assert_address(&SPL_NOOP_ID)?;

	Ok(())
}

struct CompressedTransfer<'a> {
	tree_config: &'a AccountView,
	owner: &'a AccountView,
	new_owner: &'a AccountView,
	merkle_tree: &'a AccountView,
	bubblegum_program: &'a AccountView,
	log_wrapper: &'a AccountView,
	compression_program: &'a AccountView,
	system_program: &'a AccountView,
}

struct CompressedProof<'a> {
	root: &'a [u8; 32],
	data_hash: &'a [u8; 32],
	creator_hash: &'a [u8; 32],
	nonce: u64,
	index: u32,
}

fn invoke_compressed_transfer(
	accounts: &CompressedTransfer<'_>,
	proof_accounts: &[AccountView],
	proof: &CompressedProof<'_>,
	signers: &[Signer<'_, '_>],
) -> ProgramResult {
	// Bubblegum transfer ABI pinned to upstream commit
	// f03717ae97c331e4bf4ae576793990c4e3436db1: discriminator and
	// root/data/creator hashes, nonce, index, then root-to-leaf proof accounts.
	let mut metas = Vec::with_capacity(8 + proof_accounts.len());
	metas.extend_from_slice(&[
		InstructionAccount::readonly(accounts.tree_config.address()),
		InstructionAccount::readonly_signer(accounts.owner.address()),
		InstructionAccount::readonly_signer(accounts.owner.address()),
		InstructionAccount::readonly(accounts.new_owner.address()),
		InstructionAccount::writable(accounts.merkle_tree.address()),
		InstructionAccount::readonly(accounts.log_wrapper.address()),
		InstructionAccount::readonly(accounts.compression_program.address()),
		InstructionAccount::readonly(accounts.system_program.address()),
	]);
	for proof in proof_accounts {
		metas.push(InstructionAccount::readonly(proof.address()));
	}
	let mut views = Vec::with_capacity(8 + proof_accounts.len());
	views.extend_from_slice(&[
		accounts.tree_config,
		accounts.owner,
		accounts.owner,
		accounts.new_owner,
		accounts.merkle_tree,
		accounts.log_wrapper,
		accounts.compression_program,
		accounts.system_program,
	]);
	views.extend(proof_accounts.iter());
	let mut data = [0u8; 116];
	data[..8].copy_from_slice(&[163, 52, 200, 231, 140, 3, 69, 186]);
	data[8..40].copy_from_slice(proof.root);
	data[40..72].copy_from_slice(proof.data_hash);
	data[72..104].copy_from_slice(proof.creator_hash);
	data[104..112].copy_from_slice(&proof.nonce.to_le_bytes());
	data[112..].copy_from_slice(&proof.index.to_le_bytes());
	let instruction = InstructionView {
		program_id: accounts.bubblegum_program.address(),
		accounts: &metas,
		data: &data,
	};
	pinocchio::cpi::invoke_signed_with_slice(&instruction, &views, signers)
}

fn compressed_asset_id(tree: &Address, nonce: u64) -> Result<Address, ProgramError> {
	try_find_program_address(
		&[b"asset", tree.as_ref(), &nonce.to_le_bytes()],
		&MPL_BUBBLEGUM_ID,
	)
	.map(|(address, _)| address)
	.ok_or(ProgramError::InvalidSeeds)
}

fn validate_compressed_accounts(accounts: &CompressedTransfer<'_>) -> ProgramResult {
	accounts
		.bubblegum_program
		.assert_program(&MPL_BUBBLEGUM_ID)?;
	accounts.log_wrapper.assert_address(&SPL_NOOP_ID)?;
	accounts
		.compression_program
		.assert_program(&SPL_ACCOUNT_COMPRESSION_ID)?;
	accounts.system_program.assert_address(&system::ID)?;

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for FundMetadataNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = FundMetadataNftPrizeInstruction::try_from_bytes(data)?;
		self.authority.assert_signer()?.assert_writable()?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, self.template.address())?;
		validate_metadata_accounts(
			&MetadataValidation {
				mint: self.mint,
				metadata: self.metadata,
				token_metadata_program: self.token_metadata_program,
				system_program: self.system_program,
				instructions_sysvar: self.instructions_sysvar,
				token_program: self.token_program,
				associated_token_program: self.associated_token_program,
			},
			self.optional_accounts,
		)?;
		let bundle_address = *self.bundle.address();
		drop(self.source.as_associated_token_account_checked(
			self.authority.address(),
			self.mint.address(),
			&token::ID,
		)?);
		drop(self.escrow.as_associated_token_account_checked(
			&bundle_address,
			self.mint.address(),
			&token::ID,
		)?);
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING || bundle.quantity.get() != 1 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		record_prize(&mut bundle, self.mint.address(), 1, PRIZE_METADATA_NFT, 0)?;
		drop(bundle);
		drop(state);

		invoke_metadata_transfer(
			&MetadataTransfer {
				source: self.source,
				source_owner: self.authority,
				destination: self.escrow,
				destination_owner: self.bundle,
				mint: self.mint,
				metadata: self.metadata,
				authority: self.authority,
				payer: self.authority,
				system_program: self.system_program,
				instructions_sysvar: self.instructions_sysvar,
				token_program: self.token_program,
				associated_token_program: self.associated_token_program,
				token_metadata_program: self.token_metadata_program,
			},
			self.optional_accounts,
			&[],
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimMetadataNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimMetadataNftPrizeInstruction::try_from_bytes(data)?;
		self.payer.assert_signer()?.assert_writable()?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		validate_metadata_accounts(
			&MetadataValidation {
				mint: self.mint,
				metadata: self.metadata,
				token_metadata_program: self.token_metadata_program,
				system_program: self.system_program,
				instructions_sysvar: self.instructions_sysvar,
				token_program: self.token_program,
				associated_token_program: self.associated_token_program,
			},
			self.optional_accounts,
		)?;
		let opening_address = *self.opening.address();
		let bundle_address = *self.bundle.address();
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&opening_address, &opening, self.template.address())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_METADATA_NFT)
			|| mint_at(&bundle, index)? != *self.mint.address()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(self.escrow.as_associated_token_account_checked(
			&bundle_address,
			self.mint.address(),
			&token::ID,
		)?);
		drop(self.destination.as_associated_token_account_checked(
			&opening.beneficiary,
			self.mint.address(),
			&token::ID,
		)?);
		record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		drop(opening);
		drop(state);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		invoke_metadata_transfer(
			&MetadataTransfer {
				source: self.escrow,
				source_owner: self.bundle,
				destination: self.destination,
				destination_owner: self.recipient,
				mint: self.mint,
				metadata: self.metadata,
				authority: self.bundle,
				payer: self.payer,
				system_program: self.system_program,
				instructions_sysvar: self.instructions_sysvar,
				token_program: self.token_program,
				associated_token_program: self.associated_token_program,
				token_metadata_program: self.token_metadata_program,
			},
			self.optional_accounts,
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimMetadataNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimMetadataNftPrizeInstruction::try_from_bytes(data)?;
		self.authority.assert_signer()?.assert_writable()?;
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		validate_metadata_accounts(
			&MetadataValidation {
				mint: self.mint,
				metadata: self.metadata,
				token_metadata_program: self.token_metadata_program,
				system_program: self.system_program,
				instructions_sysvar: self.instructions_sysvar,
				token_program: self.token_program,
				associated_token_program: self.associated_token_program,
			},
			self.optional_accounts,
		)?;
		let supply = assert_template_mint(
			self.box_mint,
			self.template.address(),
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;
		let bundle_address = *self.bundle.address();
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_METADATA_NFT)
			|| mint_at(&bundle, index)? != *self.mint.address()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(self.escrow.as_associated_token_account_checked(
			&bundle_address,
			self.mint.address(),
			&token::ID,
		)?);
		drop(self.destination.as_associated_token_account_checked(
			self.authority.address(),
			self.mint.address(),
			&token::ID,
		)?);
		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		if reclaim_amount(
			&state,
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)? != 1
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		invoke_metadata_transfer(
			&MetadataTransfer {
				source: self.escrow,
				source_owner: self.bundle,
				destination: self.destination,
				destination_owner: self.authority,
				mint: self.mint,
				metadata: self.metadata,
				authority: self.bundle,
				payer: self.authority,
				system_program: self.system_program,
				instructions_sysvar: self.instructions_sysvar,
				token_program: self.token_program,
				associated_token_program: self.associated_token_program,
				token_metadata_program: self.token_metadata_program,
			},
			self.optional_accounts,
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for FundCoreAssetPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = FundCoreAssetPrizeInstruction::try_from_bytes(data)?;
		self.authority.assert_signer()?.assert_writable()?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, self.template.address())?;
		validate_core_accounts(
			self.asset,
			self.collection,
			self.plugin_accounts,
			self.core_program,
			self.system_program,
			self.log_wrapper,
		)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING || bundle.quantity.get() != 1 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		record_prize(&mut bundle, self.asset.address(), 1, PRIZE_CORE_ASSET, 0)?;
		drop(bundle);
		drop(state);

		invoke_core_transfer(
			&CoreTransfer {
				asset: self.asset,
				collection: self.collection,
				payer: self.authority,
				authority: self.authority,
				new_owner: self.bundle,
				core_program: self.core_program,
				system_program: self.system_program,
				log_wrapper: self.log_wrapper,
			},
			self.plugin_accounts,
			&[],
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimCoreAssetPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimCoreAssetPrizeInstruction::try_from_bytes(data)?;
		self.payer.assert_signer()?.assert_writable()?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		validate_core_accounts(
			self.asset,
			self.collection,
			self.plugin_accounts,
			self.core_program,
			self.system_program,
			self.log_wrapper,
		)?;
		let opening_address = *self.opening.address();
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&opening_address, &opening, self.template.address())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_CORE_ASSET)
			|| mint_at(&bundle, index)? != *self.asset.address()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		drop(opening);
		drop(state);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		invoke_core_transfer(
			&CoreTransfer {
				asset: self.asset,
				collection: self.collection,
				payer: self.payer,
				authority: self.bundle,
				new_owner: self.recipient,
				core_program: self.core_program,
				system_program: self.system_program,
				log_wrapper: self.log_wrapper,
			},
			self.plugin_accounts,
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimCoreAssetPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimCoreAssetPrizeInstruction::try_from_bytes(data)?;
		self.authority.assert_signer()?.assert_writable()?;
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		validate_core_accounts(
			self.asset,
			self.collection,
			self.plugin_accounts,
			self.core_program,
			self.system_program,
			self.log_wrapper,
		)?;
		let supply = assert_template_mint(
			self.box_mint,
			self.template.address(),
			&state.box_mint,
			state.locked_at.get() != 0,
		)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_CORE_ASSET)
			|| mint_at(&bundle, index)? != *self.asset.address()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		if reclaim_amount(
			&state,
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)? != 1
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];

		invoke_core_transfer(
			&CoreTransfer {
				asset: self.asset,
				collection: self.collection,
				payer: self.authority,
				authority: self.bundle,
				new_owner: self.authority,
				core_program: self.core_program,
				system_program: self.system_program,
				log_wrapper: self.log_wrapper,
			},
			self.plugin_accounts,
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for FundCompressedNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundCompressedNftPrizeInstruction::try_from_bytes(data)?;
		self.authority.assert_signer()?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let asset = compressed_asset_id(self.merkle_tree.address(), args.nonce.get())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING || bundle.quantity.get() != 1 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		record_prize(&mut bundle, &asset, 1, PRIZE_COMPRESSED_NFT, 0)?;
		drop(bundle);
		drop(state);
		let context = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.authority,
			new_owner: self.bundle,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&context)?;

		invoke_compressed_transfer(
			&context,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&[],
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ClaimCompressedNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ClaimCompressedNftPrizeInstruction::try_from_bytes(data)?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let asset = compressed_asset_id(self.merkle_tree.address(), args.nonce.get())?;
		let opening_address = *self.opening.address();
		let mut opening = self.opening.as_account_mut::<TemplateOpeningState>(&ID)?;
		assert_template_opening(&opening_address, &opening, self.template.address())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_COMPRESSED_NFT)
			|| mint_at(&bundle, index)? != asset
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		record_claim(
			&mut opening,
			&mut bundle,
			self.recipient.address(),
			args.asset_index,
		)?;
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		drop(opening);
		drop(state);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];
		let context = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.bundle,
			new_owner: self.recipient,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&context)?;

		invoke_compressed_transfer(
			&context,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&signers,
		)
	}
}

impl<'a> ProcessAccountInfos<'a> for ReclaimCompressedNftPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = ReclaimCompressedNftPrizeInstruction::try_from_bytes(data)?;
		self.authority.assert_signer()?;
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
		let asset = compressed_asset_id(self.merkle_tree.address(), args.nonce.get())?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		let index = usize::from(args.asset_index);
		if bundle.kinds.get(index) != Some(&PRIZE_COMPRESSED_NFT)
			|| mint_at(&bundle, index)? != asset
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let bundle_index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		let active_remaining = if bundle.status == BUNDLE_ACTIVE {
			Some(remaining_at(&state, bundle_index)?)
		} else {
			None
		};
		if reclaim_amount(
			&state,
			&mut bundle,
			supply,
			args.asset_index,
			active_remaining,
		)? != 1
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let template = bundle.template;
		let seeds = BundleState::seeds(&template, bundle.index.get()).with_bump(bundle.bump);
		drop(bundle);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];
		let context = CompressedTransfer {
			tree_config: self.tree_config,
			owner: self.bundle,
			new_owner: self.authority,
			merkle_tree: self.merkle_tree,
			bubblegum_program: self.bubblegum_program,
			log_wrapper: self.log_wrapper,
			compression_program: self.compression_program,
			system_program: self.system_program,
		};
		validate_compressed_accounts(&context)?;

		invoke_compressed_transfer(
			&context,
			self.proof_accounts,
			&CompressedProof {
				root: &args.root,
				data_hash: &args.data_hash,
				creator_hash: &args.creator_hash,
				nonce: args.nonce.get(),
				index: args.index.get(),
			},
			&signers,
		)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn metadata_authority_must_be_revoked_or_program_controlled() {
		assert!(metadata_authority_is_safe(None, &MPL_TOKEN_METADATA_ID));
		assert!(metadata_authority_is_safe(
			Some(&MPL_TOKEN_METADATA_ID),
			&MPL_TOKEN_METADATA_ID,
		));
		assert!(!metadata_authority_is_safe(
			Some(&MPL_CORE_ID),
			&MPL_TOKEN_METADATA_ID,
		));
	}
}
