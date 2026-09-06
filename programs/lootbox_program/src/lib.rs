//! A fully collateralized random-reward primitive for Solana.
//!
//! A lootbox definition controls a zero-decimal SPL Token mint. Each token is
//! one transferable unopened box. Opening burns one token before randomness is
//! known, records the exact Switchboard commitment, then allocates one escrowed
//! bundle uniformly without replacement after that commitment is revealed.

#![allow(clippy::inline_always)]
// AccountView is a copyable handle, but borrowing it makes account access and
// mutability explicit at helper boundaries.
#![allow(clippy::trivially_copy_pass_by_ref)]
#![no_std]

extern crate alloc;

#[cfg(all(
	not(any(target_os = "solana", target_arch = "bpf")),
	not(feature = "bpf-entrypoint"),
	not(test)
))]
extern crate std;

#[cfg(feature = "bpf-entrypoint")]
pub mod entrypoint;

use core::mem::size_of;

use pina::*;
use solana_sha256_hasher::hashv;
pub use switchboard_randomness_cpi::DEVNET_ID as SWITCHBOARD_DEVNET_ID;
pub use switchboard_randomness_cpi::MAINNET_ID as SWITCHBOARD_MAINNET_ID;
use switchboard_randomness_cpi::RandomnessClose;
use switchboard_randomness_cpi::RandomnessCommit;
use switchboard_randomness_cpi::RandomnessInit;
use switchboard_randomness_cpi::RandomnessReveal;
use switchboard_randomness_cpi::RandomnessSnapshot;
use switchboard_randomness_cpi::parse_randomness_account;

mod templates;
pub use templates::*;

declare_id!("Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op");

/// Maximum number of weighted outcomes in the single-reward model.
pub const MAX_OUTCOMES: usize = 8;
/// Maximum append-only prize bundles in an editable template treasury.
pub const MAX_TEMPLATE_BUNDLES: usize = 1_024;
/// Number of slots after which an unfulfilled opening receives its reward floor.
pub const RANDOMNESS_TIMEOUT_SLOTS: u64 = 300;

/// Maximum sum of outcome weights.
///
/// This bound makes eight-step rejection sampling failure less likely than
/// `2^-256`; the final deterministic fallback then guarantees settlement.
pub const MAX_TOTAL_WEIGHT: u64 = u32::MAX as u64;

const CLOCK_SYSVAR_ID: Address = address!("SysvarC1ock11111111111111111111111111111111");
const SLOT_HASHES_SYSVAR_ID: Address = address!("SysvarS1otHashes111111111111111111111111111");
const SEED_LOOTBOX: &[u8] = b"lootbox";
const SEED_VAULT: &[u8] = b"vault";
const SEED_OPENING: &[u8] = b"opening";
const WRAPPED_SOL_MINT_ID: Address = address!("So11111111111111111111111111111111111111112");
const ADDRESS_LOOKUP_TABLE_PROGRAM_ID: Address =
	address!("AddressLookupTab1e1111111111111111111111111");
const OPENING_PENDING: u8 = 0;
const OPENING_SETTLED: u8 = 1;
const OPENING_REFUNDED: u8 = 2;
const OUTCOME_DOMAIN: &[u8] = b"pina-lootbox-outcome";

#[error]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LootboxError {
	/// The signer is not authorized to perform this action.
	Unauthorized = 0,
	/// The account or lootbox is not in the required state.
	InvalidState = 1,
	/// The configured outcome does not exist or is out of range.
	InvalidOutcome = 2,
	/// An outcome weight must be non-zero and keep total weight within the bound.
	InvalidWeight = 3,
	/// The lootbox cannot be sealed until at least one outcome exists.
	IncompleteConfiguration = 4,
	/// The vault cannot cover the worst-case outstanding liability.
	Insolvent = 5,
	/// The box mint or token account does not match the lootbox.
	InvalidMint = 6,
	/// The randomness account, owner, queue, authority, or commitment is invalid.
	InvalidRandomness = 7,
	/// The committed randomness is not ready for the requested transition.
	RandomnessNotReady = 8,
	/// The randomness is already revealed and cannot take this path.
	RandomnessExpired = 9,
	/// The pending opening has not reached its refund timeout.
	OpeningNotExpired = 10,
	/// The opening receipt has already been settled or refunded.
	OpeningAlreadyFinalized = 11,
	/// The supplied recipient does not match the receipt-bound recipient.
	InvalidRecipient = 12,
	/// Minting would exceed the configured maximum supply.
	SupplyExceeded = 13,
	/// The template's earliest opening timestamp has not arrived.
	ClaimLocked = 14,
	/// An earlier opening must be allocated first.
	AllocationOutOfOrder = 15,
	/// At least one advertised prize has been exhausted.
	PrizeExhausted = 16,
	/// The asset, quantity, or escrow does not match the immutable prize.
	InvalidPrize = 17,
	/// This asset has already been delivered for this opening.
	PrizeAlreadyClaimed = 18,
	/// The treasury is permanently locked and cannot accept more bundles.
	TreasuryLocked = 19,
	/// The treasury must be locked before any box can be opened.
	TreasuryUnlocked = 20,
	/// Fixed box supply does not exactly match the funded bundle inventory.
	SupplyMismatch = 21,
	/// A market treasury must be locked before its earliest reveal date.
	RevealDatePassed = 22,
	/// The optional service vault or result receipt is invalid.
	InvalidServiceAccount = 23,
	/// The creator-funded receipt or settlement budget is exhausted.
	ServiceBudgetExhausted = 24,
}

#[discriminator]
pub enum LootboxInstruction {
	CreateLootbox = 0,
	AddOutcome = 1,
	Deposit = 2,
	Seal = 3,
	MintBoxes = 4,
	RequestOpen = 5,
	SettleOpen = 6,
	RefundOpen = 7,
	CloseOpening = 8,
	WithdrawSurplus = 9,
	CreateTemplate = 10,
	AddBundle = 11,
	FundSolPrize = 12,
	FundTokenPrize = 13,
	SealTemplate = 14,
	MintTemplateBoxes = 15,
	RequestTemplateOpen = 16,
	FulfillTemplateOpen = 17,
	AllocateTemplateOpen = 18,
	ClaimSolPrize = 19,
	ClaimTokenPrize = 20,
	RetireTemplate = 21,
	ReclaimSolPrize = 22,
	ReclaimTokenPrize = 23,
	CloseTemplateOpening = 24,
	ActivateBundle = 25,
	CancelBundle = 26,
	FundMetadataNftPrize = 27,
	ClaimMetadataNftPrize = 28,
	ReclaimMetadataNftPrize = 29,
	FundCoreAssetPrize = 30,
	ClaimCoreAssetPrize = 31,
	ReclaimCoreAssetPrize = 32,
	FundCompressedNftPrize = 33,
	ClaimCompressedNftPrize = 34,
	ReclaimCompressedNftPrize = 35,
	ForfeitTemplateOpen = 36,
	LockTreasury = 37,
	CloseServiceVault = 38,
	FundQuoteSolPrize = 39,
	FundQuoteTokenPrize = 40,
	FundMintPrize = 41,
	ClaimMintPrize = 42,
	ReclaimMintPrize = 43,
}

#[discriminator]
pub enum LootboxAccountType {
	LootboxState = 1,
	VaultState = 2,
	OpeningState = 3,
	TemplateState = 4,
	BundleState = 5,
	TemplateOpeningState = 6,
	ResultReceiptState = 7,
}

/// Immutable definition and live accounting for one lootbox mint.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [SEED_LOOTBOX, authority: Address, id: u64], bump = bump)]
pub struct LootboxState {
	pub authority: Address,
	pub box_mint: Address,
	pub oracle_program: Address,
	pub oracle_queue: Address,
	pub id: u64,
	pub max_supply: u64,
	pub total_minted: u64,
	pub pending_openings: u64,
	pub opened: u64,
	pub refunded: u64,
	pub total_weight: u64,
	pub max_reward_lamports: u64,
	/// Eight little-endian `u64` weight slots.
	pub outcome_weights: [u8; 64],
	/// Eight little-endian `u64` reward slots.
	pub outcome_lamports: [u8; 64],
	pub outcome_count: u8,
	pub sealed: bool,
	pub bump: u8,
	pub vault_bump: u8,
}

/// Program-owned SOL vault for one lootbox definition.
#[account(discriminator = LootboxAccountType)]
#[pda(seeds = [SEED_VAULT, lootbox: Address], bump = bump)]
pub struct VaultState {
	pub lootbox: Address,
	pub rent_reserve: u64,
	pub bump: u8,
}

/// Receipt binding a burned box to one unrevealed randomness commitment.
#[account(discriminator = LootboxAccountType)]
#[pda(
	seeds = [SEED_OPENING, lootbox: Address, randomness: Address],
	bump = bump
)]
pub struct OpeningState {
	pub lootbox: Address,
	pub recipient: Address,
	pub randomness: Address,
	pub seed_slot: u64,
	pub reward_lamports: u64,
	pub selected_outcome: u8,
	pub status: u8,
	pub bump: u8,
}

fn read_outcome_slot(slots: &[u8; 64], index: usize) -> Result<u64, ProgramError> {
	let start = index
		.checked_mul(size_of::<u64>())
		.ok_or(ProgramError::InvalidAccountData)?;
	let end = start
		.checked_add(size_of::<u64>())
		.ok_or(ProgramError::InvalidAccountData)?;
	let bytes: [u8; 8] = slots
		.get(start..end)
		.ok_or(ProgramError::InvalidAccountData)?
		.try_into()
		.map_err(|_| ProgramError::InvalidAccountData)?;

	Ok(u64::from_le_bytes(bytes))
}

fn write_outcome_slot(slots: &mut [u8; 64], index: usize, value: u64) -> Result<(), ProgramError> {
	let start = index
		.checked_mul(size_of::<u64>())
		.ok_or(ProgramError::InvalidAccountData)?;
	let end = start
		.checked_add(size_of::<u64>())
		.ok_or(ProgramError::InvalidAccountData)?;
	let destination = slots
		.get_mut(start..end)
		.ok_or(ProgramError::InvalidAccountData)?;
	destination.copy_from_slice(&value.to_le_bytes());

	Ok(())
}

#[instruction(discriminator = LootboxInstruction::CreateLootbox)]
pub struct CreateLootboxInstruction {
	pub id: u64,
	pub max_supply: u64,
	pub oracle_program: Address,
	pub oracle_queue: Address,
	pub bump: u8,
	pub vault_bump: u8,
}

#[instruction(discriminator = LootboxInstruction::AddOutcome)]
pub struct AddOutcomeInstruction {
	pub weight: u64,
	pub reward_lamports: u64,
}

#[instruction(discriminator = LootboxInstruction::Deposit)]
pub struct DepositInstruction {
	pub lamports: u64,
}

#[instruction(discriminator = LootboxInstruction::Seal)]
pub struct SealInstruction {}

#[instruction(discriminator = LootboxInstruction::MintBoxes)]
pub struct MintBoxesInstruction {
	pub amount: u64,
}

#[instruction(discriminator = LootboxInstruction::RequestOpen)]
pub struct RequestOpenInstruction {
	/// Recent slot used by Switchboard to derive its per-randomness lookup table.
	pub recent_slot: u64,
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::SettleOpen)]
pub struct SettleOpenInstruction {
	/// Switchboard enclave signature returned by the randomness gateway.
	pub signature: [u8; 64],
	/// Secp256k1 recovery identifier returned by the randomness gateway.
	pub recovery_id: u8,
	/// Revealed value covered by `signature`.
	pub value: [u8; 32],
}

#[instruction(discriminator = LootboxInstruction::RefundOpen)]
pub struct RefundOpenInstruction {}

#[instruction(discriminator = LootboxInstruction::CloseOpening)]
pub struct CloseOpeningInstruction {}

#[instruction(discriminator = LootboxInstruction::WithdrawSurplus)]
pub struct WithdrawSurplusInstruction {
	pub lamports: u64,
}

#[derive(Accounts, Debug)]
pub struct CreateLootboxAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub box_mint: &'a AccountView,
	pub lootbox: &'a mut AccountView,
	pub vault: &'a mut AccountView,
	pub system_program: &'a AccountView,
	pub token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct AddOutcomeAccounts<'a> {
	pub authority: &'a AccountView,
	pub lootbox: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct DepositAccounts<'a> {
	pub depositor: &'a mut AccountView,
	pub lootbox: &'a AccountView,
	pub vault: &'a mut AccountView,
	pub system_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct SealAccounts<'a> {
	pub authority: &'a AccountView,
	pub lootbox: &'a mut AccountView,
}

#[derive(Accounts, Debug)]
pub struct MintBoxesAccounts<'a> {
	pub authority: &'a AccountView,
	pub lootbox: &'a mut AccountView,
	pub vault: &'a AccountView,
	pub box_mint: &'a mut AccountView,
	pub recipient_box_account: &'a mut AccountView,
	pub token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct RequestOpenAccounts<'a> {
	pub owner: &'a mut AccountView,
	pub lootbox: &'a mut AccountView,
	pub vault: &'a AccountView,
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
	pub token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct SettleOpenAccounts<'a> {
	pub recipient: &'a mut AccountView,
	pub payer: &'a mut AccountView,
	pub lootbox: &'a mut AccountView,
	pub vault: &'a mut AccountView,
	pub box_mint: &'a AccountView,
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
pub struct RefundOpenAccounts<'a> {
	pub recipient: &'a mut AccountView,
	pub lootbox: &'a mut AccountView,
	pub vault: &'a mut AccountView,
	pub box_mint: &'a AccountView,
	pub opening: &'a mut AccountView,
	pub randomness: &'a AccountView,
	pub clock: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct CloseOpeningAccounts<'a> {
	pub recipient: &'a mut AccountView,
	pub lootbox: &'a AccountView,
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
pub struct WithdrawSurplusAccounts<'a> {
	pub authority: &'a mut AccountView,
	pub lootbox: &'a AccountView,
	pub vault: &'a mut AccountView,
	pub box_mint: &'a AccountView,
}

fn lootbox_error(error: LootboxError) -> ProgramError {
	error.into()
}

fn assert_known_oracle_program(program: &Address) -> ProgramResult {
	if program != &SWITCHBOARD_MAINNET_ID && program != &SWITCHBOARD_DEVNET_ID {
		return Err(lootbox_error(LootboxError::InvalidRandomness));
	}

	Ok(())
}

fn assert_authority_address(authority: &AccountView, expected: &Address) -> ProgramResult {
	authority
		.assert_address(expected)
		.map(|_| ())
		.map_err(|_| lootbox_error(LootboxError::Unauthorized))
}

fn assert_lootbox_pda(address: &Address, state: &LootboxStateZc) -> ProgramResult {
	let seeds = LootboxState::seeds(&state.authority, state.id.get());
	let seeds_with_bump = seeds.with_bump(state.bump);
	let expected = create_program_address(&seeds_with_bump.as_slices(), &ID)?;

	if address != &expected {
		return Err(ProgramError::InvalidSeeds);
	}

	Ok(())
}

fn assert_vault(vault: &AccountView, lootbox: &Address) -> Result<u64, ProgramError> {
	let state = vault.as_account::<VaultState>(&ID)?;
	let seeds = VaultState::seeds(lootbox);
	let seeds_with_bump = seeds.with_bump(state.bump);

	if state.lootbox != *lootbox {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	vault.assert_seeds_with_bump(&seeds_with_bump.as_slices(), &ID)?;

	Ok(state.rent_reserve.get())
}

fn assert_box_mint(
	box_mint: &AccountView,
	lootbox: &Address,
	expected_mint: &Address,
) -> Result<u64, ProgramError> {
	box_mint.assert_address(expected_mint)?;
	let mint = box_mint.as_token_mint_checked()?;

	if mint.decimals() != 0
		|| mint.mint_authority() != Some(lootbox)
		|| mint.freeze_authority().is_some()
	{
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	Ok(mint.supply())
}

fn clock_slot(clock: &AccountView) -> Result<u64, ProgramError> {
	clock.assert_sysvar(&CLOCK_SYSVAR_ID)?;
	let data = clock.try_borrow()?;
	let bytes = data
		.get(..8)
		.ok_or_else(|| lootbox_error(LootboxError::InvalidState))?;
	let mut slot = [0u8; 8];
	slot.copy_from_slice(bytes);

	Ok(u64::from_le_bytes(slot))
}

fn parse_address(data: &[u8], start: usize) -> Result<Address, ProgramError> {
	let bytes = data
		.get(start..start + 32)
		.ok_or_else(|| lootbox_error(LootboxError::InvalidRandomness))?;
	let mut address = [0u8; 32];
	address.copy_from_slice(bytes);

	Ok(Address::new_from_array(address))
}

fn parse_randomness(
	account: &AccountView,
	oracle_program: &Address,
) -> Result<RandomnessSnapshot, ProgramError> {
	account.assert_owner(oracle_program)?;
	let data = account.try_borrow()?;

	parse_randomness_account(&data).map_err(|_| lootbox_error(LootboxError::InvalidRandomness))
}

fn required_liability(
	state: &LootboxStateZc,
	mint_supply: u64,
	pending_openings: u64,
) -> Result<u64, ProgramError> {
	let active_boxes = mint_supply
		.checked_add(pending_openings)
		.ok_or(ProgramError::ArithmeticOverflow)?;

	active_boxes
		.checked_mul(state.max_reward_lamports.get())
		.ok_or(ProgramError::ArithmeticOverflow)
}

fn assert_solvency(vault: &AccountView, rent_reserve: u64, required: u64) -> ProgramResult {
	let minimum = rent_reserve
		.checked_add(required)
		.ok_or(ProgramError::ArithmeticOverflow)?;

	if vault.lamports() < minimum {
		return Err(lootbox_error(LootboxError::Insolvent));
	}

	Ok(())
}

fn select_outcome(
	randomness: &[u8; 32],
	lootbox: &Address,
	opening: &Address,
	total_weight: u64,
) -> Result<u64, ProgramError> {
	if total_weight == 0 || total_weight > MAX_TOTAL_WEIGHT {
		return Err(lootbox_error(LootboxError::InvalidWeight));
	}

	let rejection_threshold = total_weight.wrapping_neg() % total_weight;
	let mut fallback = 0u64;

	for counter in 0u8..8 {
		let counter_bytes = [counter];
		let hash = hashv(&[
			OUTCOME_DOMAIN,
			randomness,
			lootbox.as_ref(),
			opening.as_ref(),
			&counter_bytes,
		]);
		let mut candidate_bytes = [0u8; 8];
		candidate_bytes.copy_from_slice(&hash.as_ref()[..8]);
		let candidate = u64::from_le_bytes(candidate_bytes);
		fallback = candidate;

		if candidate >= rejection_threshold {
			return Ok(candidate % total_weight);
		}
	}

	// With `total_weight <= u32::MAX`, reaching this line has probability below
	// 2^-256 under SHA-256. A modulo fallback introduces only that negligible
	// statistical distance while ensuring a revealed receipt can always settle.
	Ok(fallback % total_weight)
}

fn outcome_for_target(state: &LootboxStateZc, target: u64) -> Result<(u8, u64), ProgramError> {
	let mut cumulative = 0u64;

	for index in 0..usize::from(state.outcome_count) {
		cumulative = cumulative
			.checked_add(read_outcome_slot(&state.outcome_weights, index)?)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if target < cumulative {
			let selected = u8::try_from(index).map_err(|_| ProgramError::InvalidAccountData)?;

			return Ok((selected, read_outcome_slot(&state.outcome_lamports, index)?));
		}
	}

	Err(lootbox_error(LootboxError::InvalidOutcome))
}

fn minimum_outcome(state: &LootboxStateZc) -> Result<(u8, u64), ProgramError> {
	if state.outcome_count == 0 {
		return Err(lootbox_error(LootboxError::IncompleteConfiguration));
	}

	let mut selected = 0u8;
	let mut reward = read_outcome_slot(&state.outcome_lamports, 0)?;

	for index in 1..usize::from(state.outcome_count) {
		let candidate = read_outcome_slot(&state.outcome_lamports, index)?;

		if candidate < reward {
			selected = u8::try_from(index).map_err(|_| ProgramError::InvalidAccountData)?;
			reward = candidate;
		}
	}

	Ok((selected, reward))
}

impl<'a> ProcessAccountInfos<'a> for CreateLootboxAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = CreateLootboxInstruction::try_from_bytes(data)?;
		let authority = *self.authority.address();
		let lootbox_address = *self.lootbox.address();
		let lootbox_seeds = LootboxState::seeds(&authority, args.id.get());
		let lootbox_seeds_with_bump = lootbox_seeds.with_bump(args.bump);
		let vault_seeds = VaultState::seeds(&lootbox_address);
		let vault_seeds_with_bump = vault_seeds.with_bump(args.vault_bump);

		self.authority.assert_signer()?.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.token_program.assert_address(&token::ID)?;
		assert_known_oracle_program(&args.oracle_program)?;

		if args.max_supply.get() == 0 {
			return Err(lootbox_error(LootboxError::SupplyExceeded));
		}

		let canonical_bump = self
			.lootbox
			.assert_canonical_bump(&lootbox_seeds.as_slices(), &ID)?;

		if canonical_bump != args.bump {
			return Err(ProgramError::InvalidSeeds);
		}

		self.lootbox
			.assert_empty()?
			.assert_writable()?
			.assert_seeds_with_bump(&lootbox_seeds_with_bump.as_slices(), &ID)?;
		let canonical_vault_bump = self
			.vault
			.assert_canonical_bump(&vault_seeds.as_slices(), &ID)?;

		if canonical_vault_bump != args.vault_bump {
			return Err(ProgramError::InvalidSeeds);
		}

		self.vault
			.assert_empty()?
			.assert_writable()?
			.assert_seeds_with_bump(&vault_seeds_with_bump.as_slices(), &ID)?;
		let mint = self.box_mint.as_token_mint_checked()?;

		if mint.decimals() != 0
			|| mint.supply() != 0
			|| mint.mint_authority() != Some(&lootbox_address)
			|| mint.freeze_authority().is_some()
		{
			return Err(lootbox_error(LootboxError::InvalidMint));
		}
		drop(mint);

		CreateProgramAccountWithBump {
			account: self.lootbox,
			payer: self.authority,
			owner: &ID,
			seeds: &lootbox_seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<LootboxState>()?;
		CreateProgramAccountWithBump {
			account: self.vault,
			payer: self.authority,
			owner: &ID,
			seeds: &vault_seeds.as_slices(),
			bump: args.vault_bump,
		}
		.invoke::<VaultState>()?;

		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		state.authority = authority;
		state.box_mint = *self.box_mint.address();
		state.oracle_program = args.oracle_program;
		state.oracle_queue = args.oracle_queue;
		state.id.set(args.id.get());
		state.max_supply.set(args.max_supply.get());
		state.bump = args.bump;
		state.vault_bump = args.vault_bump;
		state.sealed.set(false);
		drop(state);

		let rent_reserve = self.vault.lamports();
		let mut vault = self.vault.as_account_mut::<VaultState>(&ID)?;
		vault.lootbox = lootbox_address;
		vault.rent_reserve.set(rent_reserve);
		vault.bump = args.vault_bump;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for AddOutcomeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AddOutcomeInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.authority.assert_signer()?;
		assert_authority_address(self.authority, &state.authority)?;

		if state.sealed.get() {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if args.weight.get() == 0 {
			return Err(lootbox_error(LootboxError::InvalidWeight));
		}

		let index = usize::from(state.outcome_count);

		if index >= MAX_OUTCOMES {
			return Err(lootbox_error(LootboxError::InvalidOutcome));
		}

		let total_weight = state
			.total_weight
			.get()
			.checked_add(args.weight.get())
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if total_weight > MAX_TOTAL_WEIGHT {
			return Err(lootbox_error(LootboxError::InvalidWeight));
		}

		write_outcome_slot(&mut state.outcome_weights, index, args.weight.get())?;
		write_outcome_slot(
			&mut state.outcome_lamports,
			index,
			args.reward_lamports.get(),
		)?;
		state.outcome_count = state
			.outcome_count
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		state.total_weight.set(total_weight);
		let max_reward = state
			.max_reward_lamports
			.get()
			.max(args.reward_lamports.get());
		state.max_reward_lamports.set(max_reward);

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for DepositAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = DepositInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let state = self.lootbox.as_account::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.system_program.assert_address(&system::ID)?;
		self.depositor.assert_signer()?.assert_writable()?;
		self.vault.assert_writable()?;
		assert_vault(self.vault, &lootbox_address)?;

		if args.lamports.get() == 0 {
			return Err(ProgramError::InvalidArgument);
		}

		system::instructions::Transfer {
			from: self.depositor,
			to: self.vault,
			lamports: args.lamports.get(),
		}
		.invoke()
	}
}

impl<'a> ProcessAccountInfos<'a> for SealAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = SealInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.authority.assert_signer()?;
		assert_authority_address(self.authority, &state.authority)?;

		if state.sealed.get() {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if state.outcome_count == 0 || state.total_weight.get() == 0 {
			return Err(lootbox_error(LootboxError::IncompleteConfiguration));
		}

		state.sealed.set(true);

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for MintBoxesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = MintBoxesInstruction::try_from_bytes(data)?;
		let amount = args.amount.get();
		let lootbox_address = *self.lootbox.address();
		self.token_program.assert_address(&token::ID)?;
		self.box_mint.assert_writable()?;
		self.recipient_box_account.assert_writable()?;
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.authority.assert_signer()?;
		assert_authority_address(self.authority, &state.authority)?;

		if !state.sealed.get() || amount == 0 {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		let mint_supply = assert_box_mint(self.box_mint, &lootbox_address, &state.box_mint)?;
		let minted = state
			.total_minted
			.get()
			.checked_add(amount)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if minted > state.max_supply.get() {
			return Err(lootbox_error(LootboxError::SupplyExceeded));
		}

		let recipient_box_account = self.recipient_box_account.as_token_account_checked()?;
		let recipient = *recipient_box_account.owner();
		drop(recipient_box_account);
		drop(
			self.recipient_box_account
				.as_associated_token_account_checked(
					&recipient,
					self.box_mint.address(),
					&token::ID,
				)?,
		);
		let new_supply = mint_supply
			.checked_add(amount)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let liability = required_liability(&state, new_supply, state.pending_openings.get())?;
		assert_solvency(self.vault, rent_reserve, liability)?;
		let authority = state.authority;
		let id = state.id.get();
		let bump = state.bump;
		state.total_minted.set(minted);
		drop(state);

		let seeds = LootboxState::seeds(&authority, id).with_bump(bump);
		let signer = seeds.to_signer();
		let signers = [signer.as_signer()];
		token::instructions::MintTo::new(
			self.box_mint,
			self.recipient_box_account,
			self.lootbox,
			amount,
		)
		.invoke_signed(&signers)
	}
}

impl<'a> ProcessAccountInfos<'a> for RequestOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = RequestOpenInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let owner_address = *self.owner.address();
		let randomness_address = *self.randomness.address();
		let opening_address = *self.opening.address();
		self.owner.assert_signer()?.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.token_program.assert_address(&token::ID)?;
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
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.oracle_queue.assert_address(&state.oracle_queue)?;
		self.oracle_program.assert_program(&state.oracle_program)?;

		if !state.sealed.get() {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		let mint_supply = assert_box_mint(self.box_mint, &lootbox_address, &state.box_mint)?;
		let box_account = self.owner_box_account.as_associated_token_account_checked(
			&owner_address,
			self.box_mint.address(),
			&token::ID,
		)?;

		if box_account.amount() == 0 {
			return Err(ProgramError::InsufficientFunds);
		}
		drop(box_account);

		let opening_seeds = OpeningState::seeds(&lootbox_address, &randomness_address);
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
		let liability = required_liability(&state, post_burn_supply, pending)?;
		assert_solvency(self.vault, rent_reserve, liability)?;
		state.pending_openings.set(pending);
		drop(state);

		CreateProgramAccountWithBump {
			account: self.opening,
			payer: self.owner,
			owner: &ID,
			seeds: &opening_seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<OpeningState>()?;

		let mut opening = self.opening.as_account_mut::<OpeningState>(&ID)?;
		opening.lootbox = lootbox_address;
		opening.recipient = owner_address;
		opening.randomness = randomness_address;
		opening.status = OPENING_PENDING;
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
			payer: self.owner,
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
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		token::instructions::Burn::new(self.owner_box_account, self.box_mint, self.owner, 1)
			.invoke()?;

		let mut opening = self.opening.as_account_mut::<OpeningState>(&ID)?;
		opening.seed_slot.set(committed.seed_slot);

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for SettleOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = SettleOpenInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let opening_address = *self.opening.address();
		let randomness_address = *self.randomness.address();
		let recipient_address = *self.recipient.address();
		self.recipient.assert_writable()?;
		self.payer.assert_signer()?.assert_writable()?;
		self.vault.assert_writable()?;
		self.opening.assert_writable()?;
		self.randomness.assert_writable()?;
		self.oracle_stats.assert_writable()?;
		self.reward_escrow.assert_writable()?;
		self.recent_slot_hashes
			.assert_sysvar(&SLOT_HASHES_SYSVAR_ID)?;
		self.system_program.assert_address(&system::ID)?;
		self.token_program.assert_address(&token::ID)?;
		self.wrapped_sol_mint.assert_address(&WRAPPED_SOL_MINT_ID)?;
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.oracle_queue.assert_address(&state.oracle_queue)?;
		self.oracle_program.assert_program(&state.oracle_program)?;
		let supply = assert_box_mint(self.box_mint, &lootbox_address, &state.box_mint)?;
		let opening = self.opening.as_account_mut::<OpeningState>(&ID)?;

		if opening.status != OPENING_PENDING {
			return Err(lootbox_error(LootboxError::OpeningAlreadyFinalized));
		}

		if opening.lootbox != lootbox_address
			|| opening.randomness != randomness_address
			|| opening.recipient != recipient_address
		{
			return Err(lootbox_error(LootboxError::InvalidRecipient));
		}

		let opening_seeds = OpeningState::seeds(&lootbox_address, &randomness_address);
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

		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		let mut opening = self.opening.as_account_mut::<OpeningState>(&ID)?;
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

		let target = select_outcome(
			&randomness.value,
			&lootbox_address,
			&opening_address,
			state.total_weight.get(),
		)?;
		let (selected_outcome, reward_lamports) = outcome_for_target(&state, target)?;
		let pending = state
			.pending_openings
			.get()
			.checked_sub(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let remaining_liability = required_liability(&state, supply, pending)?;
		let post_payout_balance = self
			.vault
			.lamports()
			.checked_sub(reward_lamports)
			.ok_or_else(|| lootbox_error(LootboxError::Insolvent))?;
		let minimum = rent_reserve
			.checked_add(remaining_liability)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if post_payout_balance < minimum {
			return Err(lootbox_error(LootboxError::Insolvent));
		}

		let opened = state
			.opened
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		state.pending_openings.set(pending);
		state.opened.set(opened);
		opening.reward_lamports.set(reward_lamports);
		opening.selected_outcome = selected_outcome;
		opening.status = OPENING_SETTLED;
		drop(opening);
		drop(state);

		self.vault.assert_owner(&ID)?;
		self.vault.send(reward_lamports, self.recipient)
	}
}

impl<'a> ProcessAccountInfos<'a> for RefundOpenAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = RefundOpenInstruction::try_from_bytes(data)?;
		let slot = clock_slot(self.clock)?;
		let lootbox_address = *self.lootbox.address();
		let opening_address = *self.opening.address();
		let randomness_address = *self.randomness.address();
		let recipient_address = *self.recipient.address();
		self.recipient.assert_signer()?.assert_writable()?;
		self.vault.assert_writable()?;
		self.opening.assert_writable()?;
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		let supply = assert_box_mint(self.box_mint, &lootbox_address, &state.box_mint)?;
		let mut opening = self.opening.as_account_mut::<OpeningState>(&ID)?;

		if opening.status != OPENING_PENDING {
			return Err(lootbox_error(LootboxError::OpeningAlreadyFinalized));
		}

		if opening.lootbox != lootbox_address
			|| opening.randomness != randomness_address
			|| opening.recipient != recipient_address
		{
			return Err(lootbox_error(LootboxError::InvalidRecipient));
		}

		let opening_seeds = OpeningState::seeds(&lootbox_address, &randomness_address);
		let opening_seeds_with_bump = opening_seeds.with_bump(opening.bump);
		let expected_opening = create_program_address(&opening_seeds_with_bump.as_slices(), &ID)?;

		if expected_opening != opening_address {
			return Err(ProgramError::InvalidSeeds);
		}

		let randomness = parse_randomness(self.randomness, &state.oracle_program)?;

		if randomness.seed_slot != opening.seed_slot.get()
			|| randomness.authority != opening_address
			|| randomness.queue != state.oracle_queue
		{
			return Err(lootbox_error(LootboxError::InvalidRandomness));
		}

		if randomness.reveal_slot != 0 {
			return Err(lootbox_error(LootboxError::RandomnessExpired));
		}

		let refund_slot = opening
			.seed_slot
			.get()
			.checked_add(RANDOMNESS_TIMEOUT_SLOTS)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if slot < refund_slot {
			return Err(lootbox_error(LootboxError::OpeningNotExpired));
		}

		let (floor_outcome, floor_lamports) = minimum_outcome(&state)?;
		let pending = state
			.pending_openings
			.get()
			.checked_sub(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let remaining_liability = required_liability(&state, supply, pending)?;
		let post_refund_balance = self
			.vault
			.lamports()
			.checked_sub(floor_lamports)
			.ok_or_else(|| lootbox_error(LootboxError::Insolvent))?;
		let minimum = rent_reserve
			.checked_add(remaining_liability)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if post_refund_balance < minimum {
			return Err(lootbox_error(LootboxError::Insolvent));
		}

		let refunded = state
			.refunded
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		state.pending_openings.set(pending);
		state.refunded.set(refunded);
		opening.reward_lamports.set(floor_lamports);
		opening.selected_outcome = floor_outcome;
		opening.status = OPENING_REFUNDED;
		drop(opening);
		drop(state);

		self.vault.assert_owner(&ID)?;
		self.vault.send(floor_lamports, self.recipient)
	}
}

impl<'a> ProcessAccountInfos<'a> for CloseOpeningAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = CloseOpeningInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let opening_address = *self.opening.address();
		let randomness_address = *self.randomness.address();
		self.recipient.assert_writable()?;
		self.opening.assert_writable()?;
		self.randomness.assert_writable()?;
		self.reward_escrow.assert_writable()?;
		self.oracle_lut.assert_writable()?;
		self.system_program.assert_address(&system::ID)?;
		self.token_program.assert_address(&token::ID)?;
		self.wrapped_sol_mint.assert_address(&WRAPPED_SOL_MINT_ID)?;
		self.address_lookup_table_program
			.assert_address(&ADDRESS_LOOKUP_TABLE_PROGRAM_ID)?;
		let state = self.lootbox.as_account::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.oracle_program.assert_program(&state.oracle_program)?;
		let opening = self.opening.as_account::<OpeningState>(&ID)?;

		if opening.status == OPENING_PENDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if opening.recipient != *self.recipient.address()
			|| opening.lootbox != lootbox_address
			|| opening.randomness != randomness_address
		{
			return Err(lootbox_error(LootboxError::InvalidRecipient));
		}

		let opening_seeds = OpeningState::seeds(&lootbox_address, &randomness_address);
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

		let opening_signer = opening_seeds_with_bump.to_signer();
		let signers = [opening_signer.as_signer()];

		RandomnessClose {
			program_id: self.oracle_program.address(),
			randomness: self.randomness,
			reward_escrow: self.reward_escrow,
			authority: self.opening,
			program_state: self.oracle_program_state,
			system_program: self.system_program,
			token_program: self.token_program,
			wrapped_sol_mint: self.wrapped_sol_mint,
			lut: self.oracle_lut,
			lut_signer: self.oracle_lut_signer,
			address_lookup_table_program: self.address_lookup_table_program,
		}
		.invoke_signed(&signers)?;

		self.opening.close_account_zeroed(self.recipient)
	}
}

impl<'a> ProcessAccountInfos<'a> for WithdrawSurplusAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = WithdrawSurplusInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		self.authority.assert_writable()?;
		self.vault.assert_writable()?;
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let state = self.lootbox.as_account::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.authority.assert_signer()?;
		assert_authority_address(self.authority, &state.authority)?;
		let supply = assert_box_mint(self.box_mint, &lootbox_address, &state.box_mint)?;
		let liability = required_liability(&state, supply, state.pending_openings.get())?;
		let requested_minimum = rent_reserve
			.checked_add(liability)
			.and_then(|value| value.checked_add(args.lamports.get()))
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if self.vault.lamports() < requested_minimum {
			return Err(lootbox_error(LootboxError::Insolvent));
		}

		drop(state);
		self.vault.assert_owner(&ID)?;
		self.vault.send(args.lamports.get(), self.authority)
	}
}

/// Dispatches one validated lootbox instruction.
///
/// # Errors
///
/// Returns a program error when instruction data, account relationships,
/// authorization, oracle state, or protocol invariants are invalid.
pub fn process_instruction(
	program_id: &Address,
	accounts: &mut [AccountView],
	data: &[u8],
) -> ProgramResult {
	let instruction: LootboxInstruction = parse_instruction(program_id, &ID, data)?;

	match instruction {
		LootboxInstruction::CreateLootbox => {
			CreateLootboxAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::AddOutcome => {
			AddOutcomeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::Deposit => {
			DepositAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::Seal => SealAccounts::try_from((program_id, accounts))?.process(data),
		LootboxInstruction::MintBoxes => {
			MintBoxesAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::RequestOpen => {
			RequestOpenAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::SettleOpen => {
			SettleOpenAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::RefundOpen => {
			RefundOpenAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::CloseOpening => {
			CloseOpeningAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::WithdrawSurplus => {
			WithdrawSurplusAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::CreateTemplate => {
			CreateTemplateAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::AddBundle => {
			AddBundleAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundSolPrize => {
			FundSolPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundTokenPrize => {
			FundTokenPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::SealTemplate => {
			SealTemplateAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::MintTemplateBoxes => {
			MintTemplateBoxesAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::RequestTemplateOpen => {
			RequestTemplateOpenAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FulfillTemplateOpen => {
			FulfillTemplateOpenAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::AllocateTemplateOpen => {
			AllocateTemplateOpenAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ClaimSolPrize => {
			ClaimSolPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ClaimTokenPrize => {
			ClaimTokenPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::RetireTemplate => {
			RetireTemplateAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ReclaimSolPrize => {
			ReclaimSolPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ReclaimTokenPrize => {
			ReclaimTokenPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::CloseTemplateOpening => {
			CloseTemplateOpeningAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ActivateBundle => {
			ActivateBundleAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::CancelBundle => {
			CancelBundleAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundMetadataNftPrize => {
			FundMetadataNftPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ClaimMetadataNftPrize => {
			ClaimMetadataNftPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ReclaimMetadataNftPrize => {
			ReclaimMetadataNftPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundCoreAssetPrize => {
			FundCoreAssetPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ClaimCoreAssetPrize => {
			ClaimCoreAssetPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ReclaimCoreAssetPrize => {
			ReclaimCoreAssetPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundCompressedNftPrize => {
			FundCompressedNftPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ClaimCompressedNftPrize => {
			ClaimCompressedNftPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ReclaimCompressedNftPrize => {
			ReclaimCompressedNftPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ForfeitTemplateOpen => {
			ForfeitTemplateOpenAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::LockTreasury => {
			LockTreasuryAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::CloseServiceVault => {
			CloseServiceVaultAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundQuoteSolPrize => {
			FundQuoteSolPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundQuoteTokenPrize => {
			FundQuoteTokenPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundMintPrize => {
			FundMintPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ClaimMintPrize => {
			ClaimMintPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ReclaimMintPrize => {
			ReclaimMintPrizeAccounts::try_from((program_id, accounts))?.process(data)
		}
	}
}

#[cfg(test)]
mod tests {
	use proptest::prelude::*;

	use super::*;

	#[test]
	fn weighted_boundaries_select_expected_outcomes() {
		let mut bytes = [0u8; LootboxState::SIZE];
		let state = LootboxState::initialize(&mut bytes).unwrap();
		state.outcome_count = 3;
		write_outcome_slot(&mut state.outcome_weights, 0, 50).expect("first weight");
		write_outcome_slot(&mut state.outcome_weights, 1, 30).expect("second weight");
		write_outcome_slot(&mut state.outcome_weights, 2, 20).expect("third weight");
		write_outcome_slot(&mut state.outcome_lamports, 0, 1).expect("first reward");
		write_outcome_slot(&mut state.outcome_lamports, 1, 2).expect("second reward");
		write_outcome_slot(&mut state.outcome_lamports, 2, 3).expect("third reward");

		assert_eq!(outcome_for_target(state, 0).unwrap(), (0, 1));
		assert_eq!(outcome_for_target(state, 49).unwrap(), (0, 1));
		assert_eq!(outcome_for_target(state, 50).unwrap(), (1, 2));
		assert_eq!(outcome_for_target(state, 79).unwrap(), (1, 2));
		assert_eq!(outcome_for_target(state, 80).unwrap(), (2, 3));
		assert_eq!(outcome_for_target(state, 99).unwrap(), (2, 3));
	}

	#[test]
	fn timeout_floor_uses_the_lowest_configured_reward() {
		let mut bytes = [0u8; LootboxState::SIZE];
		let state = LootboxState::initialize(&mut bytes).unwrap();
		state.outcome_count = 3;
		write_outcome_slot(&mut state.outcome_lamports, 0, 50).expect("first reward");
		write_outcome_slot(&mut state.outcome_lamports, 1, 10).expect("second reward");
		write_outcome_slot(&mut state.outcome_lamports, 2, 30).expect("third reward");

		assert_eq!(minimum_outcome(state), Ok((1, 10)));
	}

	#[test]
	fn liability_counts_minted_and_pending_boxes_once() {
		let mut bytes = [0u8; LootboxState::SIZE];
		let state = LootboxState::initialize(&mut bytes).expect("state");
		state.max_reward_lamports.set(500_000);

		assert_eq!(required_liability(state, 3, 2), Ok(2_500_000));
	}

	#[test]
	fn selection_rejects_weight_domains_above_the_liveness_bound() {
		let lootbox = Address::new_from_array([1u8; 32]);
		let opening = Address::new_from_array([2u8; 32]);
		let result = select_outcome(&[3u8; 32], &lootbox, &opening, MAX_TOTAL_WEIGHT + 1);

		assert_eq!(result, Err(lootbox_error(LootboxError::InvalidWeight)));
	}

	proptest! {
		#[test]
		fn selection_is_always_inside_the_weight_domain(
			randomness in any::<[u8; 32]>(),
			total_weight in 1u64..=u64::from(u32::MAX),
		) {
			let lootbox = Address::new_from_array([1u8; 32]);
			let opening = Address::new_from_array([2u8; 32]);
			let selected = select_outcome(
				&randomness,
				&lootbox,
				&opening,
				total_weight,
			).unwrap();

			prop_assert!(selected < total_weight);
		}
	}
}
