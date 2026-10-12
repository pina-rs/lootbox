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
// Pina 0.21 macros (`PinaPod` derive and `#[pda]`) generate public items
// without docs, so the workspace `missing_docs` lint cannot apply to this crate
// until those macros document their output. Hand-written items are fully
// documented; remove this once Pina ships generated-item docs.
#![allow(missing_docs)]
// The Surfpool suite includes this source by path inside its own test
// harness, where `no_std` is both wrong and rejected at the module level;
// keep it for every deployed and host build of the program crate itself.
#![cfg_attr(not(test), no_std)]

extern crate alloc;

#[cfg(all(
	not(any(target_os = "solana", target_arch = "bpf")),
	not(feature = "bpf-entrypoint"),
	not(test)
))]
extern crate std;

/// On-chain entrypoint that routes every instruction to `process_instruction`
/// and installs the default allocator and `no_std` panic handler.
#[cfg(feature = "bpf-entrypoint")]
pub mod entrypoint;

pub(crate) use core::mem::size_of;

// Surfpool includes this source by path; the crate-visible re-export carries
// these bindings into the harness so `crate::` paths in submodules keep
// resolving there. In the program crate the visibility is unchanged.
pub(crate) use pina::*;
pub(crate) use solana_sha256_hasher::hashv;
pub use switchboard_randomness_cpi::DEVNET_ID as SWITCHBOARD_DEVNET_ID;
pub use switchboard_randomness_cpi::MAINNET_ID as SWITCHBOARD_MAINNET_ID;
pub(crate) use switchboard_randomness_cpi::RandomnessClose;
pub(crate) use switchboard_randomness_cpi::RandomnessCommit;
pub(crate) use switchboard_randomness_cpi::RandomnessInit;
pub(crate) use switchboard_randomness_cpi::RandomnessReveal;
pub(crate) use switchboard_randomness_cpi::RandomnessSnapshot;
pub(crate) use switchboard_randomness_cpi::parse_randomness_account;

mod templates;
pub use templates::*;

declare_id!("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");

/// Maximum append-only prize bundles in an editable template treasury.
pub const MAX_TEMPLATE_BUNDLES: usize = 1_024;
/// Number of slots after which an unrevealed FIFO head opening may be
/// forfeited.
pub const RANDOMNESS_TIMEOUT_SLOTS: u64 = 300;

/// Maximum sum of outcome weights.
///
/// This bound makes eight-step rejection-sampling exhaustion less likely than
/// `2^-256`. Exhaustion fails closed instead of introducing modulo bias.
pub const MAX_TOTAL_WEIGHT: u64 = u32::MAX as u64;

pub(crate) const SLOT_HASHES_SYSVAR_ID: Address =
	address!("SysvarS1otHashes111111111111111111111111111");
pub(crate) const WRAPPED_SOL_MINT_ID: Address =
	address!("So11111111111111111111111111111111111111112");
pub(crate) const ADDRESS_LOOKUP_TABLE_PROGRAM_ID: Address =
	address!("AddressLookupTab1e1111111111111111111111111");

pub(crate) const OPENING_PENDING: u8 = 0;
pub(crate) const OUTCOME_DOMAIN: &[u8] = b"pina-lootbox-outcome";

/// Custom error codes the lootbox program returns as `ProgramError::Custom`.
#[error]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LootboxError {
	/// The signer is not authorized to perform this action.
	Unauthorized = 0,
	/// The account or lootbox is not in the required state.
	InvalidState = 1,
	/// The configured outcome does not exist or is out of range.
	InvalidOutcome = 2,
	/// An outcome weight must be non-zero, every outcome must promise a
	/// positive reward, and total weight must stay within the bound.
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
	/// The prize-pool account, item, tree, or bundle binding is invalid.
	InvalidPrizePool = 25,
	/// The prize pool already contains its advertised number of items.
	PrizePoolFull = 26,
	/// The prize pool cannot be sealed until every advertised item is escrowed.
	PrizePoolIncomplete = 27,
	/// The selected pool item was already reserved, claimed, or reclaimed.
	PrizePoolItemUnavailable = 28,
	/// The supplied Bubblegum leaf identity differs from the deposited item.
	PrizePoolItemMismatch = 29,
	/// The Bubblegum metadata preimage is malformed or does not match the leaf.
	InvalidPrizePoolMetadata = 30,
	/// `PrizePool` custody accepts only permanently immutable Bubblegum metadata.
	MutablePrizePoolItem = 31,
	/// Every bounded rejection-sampling round landed outside the uniform range.
	EntropyRejectionExhausted = 32,
	/// A prize's advertised identity is still mutable after escrow.
	MutablePrize = 33,
	/// The reserved migration route only validates already-current accounts.
	MigrationLocked = 34,
	/// The Exclusive NFT collection, attachment, layers, or tree is invalid.
	InvalidExclusiveCollection = 35,
	/// The Exclusive NFT collection is not accepting new attachments now.
	ExclusiveAttachWindowClosed = 36,
	/// The box curve's terms, accounts, or trade size are invalid.
	InvalidBoxCurve = 37,
	/// The box curve has sold out, or the lootbox's reveal closed trading.
	BoxCurveClosed = 38,
	/// The trade costs more, or returns less, than the caller allowed.
	BoxCurveSlippage = 39,
	/// A curve with boxes sold can close only after it sells out or trading
	/// closes.
	BoxCurveTrading = 40,
	/// A Bubblegum tree cannot guarantee claim proofs inside the proof cap.
	TreeNotClaimable = 41,
}

/// Single-byte instruction discriminators for every lootbox instruction.
#[discriminator]
pub enum LootboxInstruction {
	/// Creates a draft treasury template bound to a box mint.
	CreateTemplate = 0,
	/// Stages a new prize bundle at the template's next bundle index.
	AddBundle = 1,
	/// Escrows native SOL for one asset of a staged bundle.
	FundSolPrize = 2,
	/// Escrows an SPL Token or Token-2022 prize for one asset of a staged
	/// bundle.
	FundTokenPrize = 3,
	/// Publishes a draft template with at least one activated bundle as live.
	SealTemplate = 4,
	/// Mints template boxes within the activated inventory before the market
	/// lock.
	MintTemplateBoxes = 5,
	/// Burns one template box and commits fresh Switchboard randomness under an
	/// opening receipt.
	RequestTemplateOpen = 6,
	/// Reveals and persists a template opening's randomness without moving any
	/// prize.
	FulfillTemplateOpen = 7,
	/// Allocates the FIFO head opening to one bundle from its verified
	/// randomness.
	AllocateTemplateOpen = 8,
	/// Delivers one allocated SOL asset to the opening's recipient.
	ClaimSolPrize = 9,
	/// Delivers one allocated token asset to the opening's recipient.
	ClaimTokenPrize = 10,
	/// Retires a template, stopping issuance and creator mutations.
	RetireTemplate = 11,
	/// Returns unallocated SOL inventory to the template authority.
	ReclaimSolPrize = 12,
	/// Returns unallocated token inventory to the template authority.
	ReclaimTokenPrize = 13,
	/// Closes a fully delivered template opening and its Switchboard accounts.
	CloseTemplateOpening = 14,
	/// Appends a fully funded staged bundle to the template's live inventory.
	ActivateBundle = 15,
	/// Closes the unfunded or fully reclaimed staged tail bundle.
	CancelBundle = 16,
	/// Escrows a Metaplex Core asset for one asset of a staged bundle.
	FundCoreAssetPrize = 17,
	/// Delivers one allocated Core asset to the opening's recipient.
	ClaimCoreAssetPrize = 18,
	/// Returns an unallocated Core asset to the template authority.
	ReclaimCoreAssetPrize = 19,
	/// Escrows a Bubblegum compressed NFT for one asset of a staged bundle.
	FundCompressedNftPrize = 20,
	/// Delivers one allocated compressed NFT to the opening's recipient.
	ClaimCompressedNftPrize = 21,
	/// Returns an unallocated compressed NFT to the template authority.
	ReclaimCompressedNftPrize = 22,
	/// Advances a FIFO head opening left unrevealed past the timeout without
	/// consuming inventory.
	ForfeitTemplateOpen = 23,
	/// Irreversibly fixes a live template's box supply to its activated
	/// inventory.
	LockTreasury = 24,
	/// Returns a retired, fully settled template's service vault balance.
	CloseServiceVault = 25,
	/// Escrows winner-routable native SOL for one asset of a staged bundle.
	FundQuoteSolPrize = 26,
	/// Escrows a winner-routable token quote for one asset of a staged bundle.
	FundQuoteTokenPrize = 27,
	/// Hands an empty badge mint's authority to a staged bundle for
	/// mint-on-claim delivery.
	FundMintPrize = 28,
	/// Mints one allocated badge to the opening's recipient.
	ClaimMintPrize = 29,
	/// Releases unallocated badge copies and revokes the bundle's mint
	/// authority once every copy is released.
	ReclaimMintPrize = 30,
	/// Reserves one bundle asset slot for a Bubblegum prize pool over one tree.
	CreatePrizePool = 31,
	/// Transfers the prepared compressed NFT into the prize pool's custody.
	DepositPrizePoolItem = 32,
	/// Commits a fully deposited prize pool to its bundle slot.
	SealPrizePool = 33,
	/// Allocates the FIFO head opening and selects one prize-pool item.
	AllocatePrizePoolOpen = 34,
	/// Transfers the selected prize-pool item to the opening's recipient.
	ClaimPrizePoolItem = 35,
	/// Returns an unassigned prize-pool item to the template authority.
	ReclaimPrizePoolItem = 36,
	/// Closes an empty, fully recovered, or terminal prize pool.
	ClosePrizePool = 37,
	/// Records the verified immutable metadata commitment for the next pool
	/// item.
	PreparePrizePoolItem = 38,
	/// Closes a prepared prize-pool item that was never deposited.
	CancelPrizePoolItem = 39,
	/// Creates an Exclusive NFT collection PDA and its Metaplex Core
	/// collection.
	CreateExclusiveCollection = 40,
	/// Loads one trait layer into a draft Exclusive NFT collection.
	SetExclusiveLayer = 41,
	/// Creates a Bubblegum tree and makes it the collection's active tree.
	AppendExclusiveTree = 42,
	/// Validates and freezes an Exclusive NFT collection's layer tables.
	PublishExclusiveCollection = 43,
	/// Binds a staged bundle asset slot to a published Exclusive NFT
	/// collection and escrows its mint fees.
	AttachExclusiveNft = 44,
	/// Mints one allocated Exclusive NFT to the opening's recipient.
	ClaimExclusiveNft = 45,
	/// Returns unused Exclusive NFT mint fees to the template authority.
	ReclaimExclusiveFees = 46,
	OpenBoxCurve = 47,
	BuyCurveBoxes = 48,
	SellCurveBoxes = 49,
	CloseBoxCurve = 50,
	/// Claims an assigned pool item after the pool account has closed.
	ClaimStrandedPrizePoolItem = 51,
}

/// Single-byte account discriminators for every lootbox-owned account.
#[discriminator]
pub enum LootboxAccountType {
	/// A `TemplateState` treasury template.
	TemplateState = 1,
	/// A `BundleState` prize bundle.
	BundleState = 2,
	/// A `TemplateOpeningState` receipt for a template box.
	TemplateOpeningState = 3,
	/// A `ResultReceiptState` immutable allocation result.
	ResultReceiptState = 4,
	/// A `PrizePoolState` Bubblegum prize pool.
	PrizePoolState = 5,
	/// A `PrizePoolItemState` prize-pool item.
	PrizePoolItemState = 6,
	/// An `ExclusiveCollectionState` layered NFT collection.
	ExclusiveCollectionState = 7,
	/// An `ExclusiveAttachmentState` binding a bundle slot to a collection.
	ExclusiveAttachmentState = 8,
	BoxCurveState = 9,
}

/// Single-byte event discriminators for every event the program emits.
#[discriminator]
pub enum LootboxEventType {
	/// An `ExclusiveNftMintedEvent`, emitted once per minted Exclusive NFT.
	ExclusiveNftMinted = 1,
	BoxCurveTraded = 2,
}

pub(crate) fn lootbox_error(error: LootboxError) -> ProgramError {
	error.into()
}

pub(crate) fn assert_known_oracle_program(program: &Address) -> ProgramResult {
	if program != &SWITCHBOARD_MAINNET_ID && program != &SWITCHBOARD_DEVNET_ID {
		return Err(lootbox_error(LootboxError::InvalidRandomness));
	}

	Ok(())
}

pub(crate) fn assert_authority_address(
	authority: &AccountView,
	expected: &Address,
) -> ProgramResult {
	authority
		.assert_address(expected)
		.map(|_| ())
		.map_err(|_| lootbox_error(LootboxError::Unauthorized))
}

pub(crate) fn parse_address(data: &[u8], start: usize) -> Result<Address, ProgramError> {
	let bytes = data
		.get(start..start + 32)
		.ok_or_else(|| lootbox_error(LootboxError::InvalidRandomness))?;
	let mut address = [0u8; 32];
	address.copy_from_slice(bytes);

	Ok(Address::new_from_array(address))
}

pub(crate) fn parse_randomness(
	account: &AccountView,
	oracle_program: &Address,
) -> Result<RandomnessSnapshot, ProgramError> {
	account.assert_owner(oracle_program)?;
	let data = account.try_borrow()?;

	parse_randomness_account(&data).map_err(|_| lootbox_error(LootboxError::InvalidRandomness))
}

/// Require the Switchboard reward escrow for one randomness account.
///
/// The oracle derives this escrow as the wrapped-SOL associated token account
/// of the randomness account itself; pinning the derivation keeps a client
/// from substituting an arbitrary writable token account into the CPI.
pub(crate) fn assert_reward_escrow(escrow: &AccountView, randomness: &Address) -> ProgramResult {
	escrow
		.assert_associated_token_address(randomness, &WRAPPED_SOL_MINT_ID, &token::ID)
		.map(|_| ())
}

/// Require a commit-time oracle account owned by the oracle program itself.
///
/// Switchboard's own commit validates queue membership; this ownership check
/// fails a substituted foreign account closed before the CPI runs.
pub(crate) fn assert_commit_oracle(
	oracle: &AccountView,
	oracle_program: &Address,
) -> ProgramResult {
	oracle.assert_owner(oracle_program).map(|_| ())
}

/// Map one uniformly distributed 64-bit candidate onto `0..bound` without
/// modulo bias.
///
/// The low band `0..(2^64 mod bound)` is rejected so every accepted residue has
/// exactly the same number of preimages. Callers draw a fresh candidate after
/// a rejection. `bound` must be nonzero.
pub(crate) const fn accept_uniform_candidate(candidate: u64, bound: u64) -> Option<u64> {
	let rejection_threshold = bound.wrapping_neg() % bound;

	if candidate < rejection_threshold {
		return None;
	}

	Some(candidate % bound)
}

/// Read the first eight bytes of a digest as a little-endian sample.
pub(crate) fn digest_candidate(digest: &[u8]) -> u64 {
	let mut candidate_bytes = [0u8; 8];
	candidate_bytes.copy_from_slice(&digest[..8]);

	u64::from_le_bytes(candidate_bytes)
}

pub(crate) fn select_outcome(
	randomness: &[u8; 32],
	lootbox: &Address,
	opening: &Address,
	total_weight: u64,
) -> Result<u64, ProgramError> {
	if total_weight == 0 || total_weight > MAX_TOTAL_WEIGHT {
		return Err(lootbox_error(LootboxError::InvalidWeight));
	}

	for counter in 0u8..8 {
		let counter_bytes = [counter];
		let hash = hashv(&[
			OUTCOME_DOMAIN,
			randomness,
			lootbox.as_ref(),
			opening.as_ref(),
			&counter_bytes,
		]);

		if let Some(target) =
			accept_uniform_candidate(digest_candidate(hash.as_ref()), total_weight)
		{
			return Ok(target);
		}
	}

	Err(lootbox_error(LootboxError::EntropyRejectionExhausted))
}

/// Largest total rent top-up the reserved `Migrate` instruction may draw from
/// its payer across every account slot in one invocation.
pub(crate) const MAX_MIGRATION_LAMPORTS: u64 = 1_000_000;

/// Fail closed unless one reserved-route slot is already at the current
/// schema version.
///
/// The reserved `Migrate` instruction is permissionless, so any third party
/// could otherwise force a future schema transition onto live accounts at a
/// time of their choosing. Until a maintainer deliberately replaces this
/// tripwire with an authority-checked migration entry point, the route may
/// only validate accounts that have nothing to migrate.
pub(crate) fn assert_migration_slot_is_current<T: MigratableAccount>(
	program_id: &Address,
	accounts: &[AccountView],
	index: usize,
) -> ProgramResult {
	let Some(account) = accounts.get(index) else {
		return Ok(());
	};

	if account.address() == program_id {
		return Ok(());
	}

	let data = account.try_borrow()?;

	if !T::matches_discriminator(&data) || T::require_current_migration_version(&data).is_err() {
		return Err(lootbox_error(LootboxError::MigrationLocked));
	}

	Ok(())
}

/// Runs the reserved framework `Migrate` instruction.
///
/// Accounts are `[payer, systemProgram, template,
/// bundle, templateOpening, resultReceipt, prizePool, prizePoolItem,
/// exclusiveCollection, exclusiveAttachment, boxCurve]`; every
/// state slot is optional and skipped when it holds the program-address
/// placeholder.
pub(crate) fn process_migrate(program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
	assert_migration_slot_is_current::<TemplateState>(program_id, accounts, 2)?;
	assert_migration_slot_is_current::<BundleState>(program_id, accounts, 3)?;
	assert_migration_slot_is_current::<TemplateOpeningState>(program_id, accounts, 4)?;
	assert_migration_slot_is_current::<ResultReceiptState>(program_id, accounts, 5)?;
	assert_migration_slot_is_current::<PrizePoolState>(program_id, accounts, 6)?;

	assert_migration_slot_is_current::<PrizePoolItemState>(program_id, accounts, 7)?;
	assert_migration_slot_is_current::<ExclusiveCollectionState>(program_id, accounts, 8)?;
	assert_migration_slot_is_current::<ExclusiveAttachmentState>(program_id, accounts, 9)?;
	assert_migration_slot_is_current::<BoxCurveState>(program_id, accounts, 10)?;

	let mut context = MigrateContext::new(program_id, accounts, Some(MAX_MIGRATION_LAMPORTS))?;
	context.run_optional::<TemplateState>(2)?;
	context.run_optional::<BundleState>(3)?;
	context.run_optional::<TemplateOpeningState>(4)?;
	context.run_optional::<ResultReceiptState>(5)?;

	context.run_optional::<PrizePoolState>(6)?;
	context.run_optional::<PrizePoolItemState>(7)?;
	context.run_optional::<ExclusiveCollectionState>(8)?;
	context.run_optional::<ExclusiveAttachmentState>(9)?;
	context.run_optional::<BoxCurveState>(10)?;
	Ok(())
}

/// Stranded pool-item claims, dispatched out of line.
///
/// Follows the box-curve pattern: the main dispatcher's frame has no room for
/// another account-parsing slot, and the IDL extractor still reads the
/// canonical arm here.
mod stranded_pool_dispatch {
	use super::*;

	#[inline(never)]
	pub fn process_instruction(
		program_id: &Address,
		accounts: &mut [AccountView],
		data: &[u8],
	) -> ProgramResult {
		let instruction: LootboxInstruction = parse_instruction(program_id, &ID, data)?;

		match instruction {
			LootboxInstruction::ClaimStrandedPrizePoolItem => {
				ClaimStrandedPrizePoolItemAccounts::try_from((program_id, accounts))?.process(data)
			}
			_ => Err(ProgramError::InvalidInstructionData),
		}
	}
}

/// Metaplex-asset prize adapters, dispatched out of line.
///
/// Same reason as the curve family: LTO inlines every handler it can into
/// the main dispatcher's frame, and that frame stays under 4 KiB only while
/// a second frame carries these adapters.
mod adapter_dispatch {
	use super::*;

	#[inline(never)]
	pub fn process_instruction(
		program_id: &Address,
		accounts: &mut [AccountView],
		data: &[u8],
	) -> ProgramResult {
		let instruction: LootboxInstruction = parse_instruction(program_id, &ID, data)?;

		match instruction {
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
			LootboxInstruction::FundTokenPrize => {
				FundTokenPrizeAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::ClaimTokenPrize => {
				ClaimTokenPrizeAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::ReclaimTokenPrize => {
				ReclaimTokenPrizeAccounts::try_from((program_id, accounts))?.process(data)
			}
			_ => Err(ProgramError::InvalidInstructionData),
		}
	}
}

/// Prize-pool instructions, dispatched out of line.
///
/// Same reason as the curve family: LTO inlines every handler it can into
/// the main dispatcher's frame, and that frame stays under 4 KiB only while
/// a second frame carries this family.
mod prize_pool_dispatch {
	use super::*;

	#[inline(never)]
	pub fn process_instruction(
		program_id: &Address,
		accounts: &mut [AccountView],
		data: &[u8],
	) -> ProgramResult {
		let instruction: LootboxInstruction = parse_instruction(program_id, &ID, data)?;

		match instruction {
			LootboxInstruction::CreatePrizePool => {
				CreatePrizePoolAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::PreparePrizePoolItem => {
				PreparePrizePoolItemAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::DepositPrizePoolItem => {
				DepositPrizePoolItemAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::CancelPrizePoolItem => {
				CancelPrizePoolItemAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::SealPrizePool => {
				SealPrizePoolAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::AllocatePrizePoolOpen => {
				AllocatePrizePoolOpenAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::ClaimPrizePoolItem => {
				ClaimPrizePoolItemAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::ReclaimPrizePoolItem => {
				ReclaimPrizePoolItemAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::ClosePrizePool => {
				ClosePrizePoolAccounts::try_from((program_id, accounts))?.process(data)
			}
			_ => Err(ProgramError::InvalidInstructionData),
		}
	}
}

/// Exclusive-NFT instructions, dispatched out of line.
///
/// Same reason as the curve family: LTO inlines every handler it can into
/// the main dispatcher's frame, and that frame stays under 4 KiB only while
/// a second frame carries this family.
mod exclusive_dispatch {
	use super::*;

	#[inline(never)]
	pub fn process_instruction(
		program_id: &Address,
		accounts: &mut [AccountView],
		data: &[u8],
	) -> ProgramResult {
		let instruction: LootboxInstruction = parse_instruction(program_id, &ID, data)?;

		match instruction {
			LootboxInstruction::CreateExclusiveCollection => {
				CreateExclusiveCollectionAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::SetExclusiveLayer => {
				SetExclusiveLayerAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::AppendExclusiveTree => {
				AppendExclusiveTreeAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::PublishExclusiveCollection => {
				PublishExclusiveCollectionAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::AttachExclusiveNft => {
				AttachExclusiveNftAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::ClaimExclusiveNft => {
				ClaimExclusiveNftAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::ReclaimExclusiveFees => {
				ReclaimExclusiveFeesAccounts::try_from((program_id, accounts))?.process(data)
			}
			_ => Err(ProgramError::InvalidInstructionData),
		}
	}
}

/// Box-curve instructions, dispatched out of line.
///
/// Every arm of the main dispatcher keeps its own account-parsing slots in one
/// SBF frame, and that frame has no room for four more. Routing the curve
/// family through this second `process_instruction` keeps both frames under
/// 4 KiB, and the IDL extractor still reads the canonical arms here.
mod box_curve_dispatch {
	use super::*;

	#[inline(never)]
	pub fn process_instruction(
		program_id: &Address,
		accounts: &mut [AccountView],
		data: &[u8],
	) -> ProgramResult {
		let instruction: LootboxInstruction = parse_instruction(program_id, &ID, data)?;

		match instruction {
			LootboxInstruction::OpenBoxCurve => {
				OpenBoxCurveAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::BuyCurveBoxes => {
				BuyCurveBoxesAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::SellCurveBoxes => {
				SellCurveBoxesAccounts::try_from((program_id, accounts))?.process(data)
			}
			LootboxInstruction::CloseBoxCurve => {
				CloseBoxCurveAccounts::try_from((program_id, accounts))?.process(data)
			}
			_ => Err(ProgramError::InvalidInstructionData),
		}
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
	if is_migrate_instruction(data) {
		return process_migrate(program_id, accounts);
	}

	let instruction: LootboxInstruction = parse_instruction(program_id, &ID, data)?;

	match instruction {
		LootboxInstruction::CreateTemplate => {
			CreateTemplateAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::AddBundle => {
			AddBundleAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::FundSolPrize => {
			FundSolPrizeAccounts::try_from((program_id, accounts))?.process(data)
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

		LootboxInstruction::RetireTemplate => {
			RetireTemplateAccounts::try_from((program_id, accounts))?.process(data)
		}
		LootboxInstruction::ReclaimSolPrize => {
			ReclaimSolPrizeAccounts::try_from((program_id, accounts))?.process(data)
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
		_adapter @ (LootboxInstruction::FundTokenPrize
		| LootboxInstruction::ClaimTokenPrize
		| LootboxInstruction::ReclaimTokenPrize
		| LootboxInstruction::FundCoreAssetPrize
		| LootboxInstruction::ClaimCoreAssetPrize
		| LootboxInstruction::ReclaimCoreAssetPrize
		| LootboxInstruction::FundCompressedNftPrize
		| LootboxInstruction::ClaimCompressedNftPrize
		| LootboxInstruction::ReclaimCompressedNftPrize) => {
			adapter_dispatch::process_instruction(program_id, accounts, data)
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
		_pool @ (LootboxInstruction::CreatePrizePool
		| LootboxInstruction::PreparePrizePoolItem
		| LootboxInstruction::DepositPrizePoolItem
		| LootboxInstruction::CancelPrizePoolItem
		| LootboxInstruction::SealPrizePool
		| LootboxInstruction::AllocatePrizePoolOpen
		| LootboxInstruction::ClaimPrizePoolItem
		| LootboxInstruction::ReclaimPrizePoolItem
		| LootboxInstruction::ClosePrizePool) => {
			prize_pool_dispatch::process_instruction(program_id, accounts, data)
		}
		_stranded @ LootboxInstruction::ClaimStrandedPrizePoolItem => {
			stranded_pool_dispatch::process_instruction(program_id, accounts, data)
		}
		_exclusive @ (LootboxInstruction::CreateExclusiveCollection
		| LootboxInstruction::SetExclusiveLayer
		| LootboxInstruction::AppendExclusiveTree
		| LootboxInstruction::PublishExclusiveCollection
		| LootboxInstruction::AttachExclusiveNft
		| LootboxInstruction::ClaimExclusiveNft
		| LootboxInstruction::ReclaimExclusiveFees) => {
			exclusive_dispatch::process_instruction(program_id, accounts, data)
		}
		// Bound rather than listed, so the IDL reads these arms from the
		// curve dispatcher instead of recording them twice.
		_curve @ (LootboxInstruction::OpenBoxCurve
		| LootboxInstruction::BuyCurveBoxes
		| LootboxInstruction::SellCurveBoxes
		| LootboxInstruction::CloseBoxCurve) => {
			box_curve_dispatch::process_instruction(program_id, accounts, data)
		}
	}
}

#[cfg(test)]
mod tests {
	use proptest::prelude::*;

	use super::*;

	#[test]
	fn instruction_discriminators_are_stable() {
		assert_eq!(LootboxInstruction::CreateTemplate as u8, 0);
		assert_eq!(LootboxInstruction::FundSolPrize as u8, 2);
		assert_eq!(LootboxInstruction::LockTreasury as u8, 24);
		assert_eq!(LootboxInstruction::CloseServiceVault as u8, 25);
		assert_eq!(LootboxInstruction::FundQuoteSolPrize as u8, 26);
		assert_eq!(LootboxInstruction::FundQuoteTokenPrize as u8, 27);
		assert_eq!(LootboxInstruction::FundMintPrize as u8, 28);

		assert_eq!(LootboxInstruction::ClaimMintPrize as u8, 29);
		assert_eq!(LootboxInstruction::ReclaimMintPrize as u8, 30);
		assert_eq!(LootboxInstruction::OpenBoxCurve as u8, 47);
		assert_eq!(LootboxInstruction::ClaimStrandedPrizePoolItem as u8, 51);
	}

	#[test]
	fn account_discriminators_are_stable() {
		assert_eq!(LootboxAccountType::TemplateState as u8, 1);
		assert_eq!(LootboxAccountType::BundleState as u8, 2);
		assert_eq!(LootboxAccountType::TemplateOpeningState as u8, 3);
		assert_eq!(LootboxAccountType::BoxCurveState as u8, 9);
	}

	#[test]
	fn parse_instruction_rejects_wrong_program_id() {
		let wrong_id = Address::new_from_array([9u8; 32]);
		let data = [LootboxInstruction::CreateTemplate as u8];
		let result = parse_instruction::<LootboxInstruction>(&wrong_id, &ID, &data);

		assert!(matches!(result, Err(ProgramError::IncorrectProgramId)));
	}

	#[test]
	fn selection_rejects_weight_domains_above_the_liveness_bound() {
		let template = Address::new_from_array([1u8; 32]);
		let opening = Address::new_from_array([2u8; 32]);
		let result = select_outcome(&[3u8; 32], &template, &opening, MAX_TOTAL_WEIGHT + 1);

		assert_eq!(result, Err(lootbox_error(LootboxError::InvalidWeight)));
	}

	#[test]
	fn fixed_wire_types_reject_trailing_bytes() {
		let mut account = alloc::vec![0; TemplateOpeningState::SIZE];
		TemplateOpeningState::initialize(&mut account, |_| Ok(())).expect("template opening state");
		account.push(0);
		assert_eq!(
			TemplateOpeningState::try_from_bytes(&account).err(),
			Some(PinaProgramError::InvalidAccountSize.into()),
		);

		let mut instruction = alloc::vec![0; FundSolPrizeInstruction::SIZE];
		FundSolPrizeInstruction::initialize(&mut instruction, |_| Ok(())).expect("fund prize");
		instruction.push(0);
		assert!(FundSolPrizeInstruction::try_from_bytes(&instruction).is_err());
	}

	#[test]
	fn future_schema_versions_fail_closed() {
		let mut account = alloc::vec![0; TemplateOpeningState::SIZE];
		TemplateOpeningState::initialize(&mut account, |_| Ok(())).expect("template opening state");
		account[1] = 1;
		assert_eq!(
			TemplateOpeningState::try_from_bytes(&account).err(),
			Some(PinaProgramError::InvalidMigrationVersion.into()),
		);
		assert_eq!(
			TemplateOpeningState::try_from_bytes_versioned(&account).err(),
			Some(PinaProgramError::InvalidMigrationVersion.into()),
		);

		let mut instruction = alloc::vec![0; FundSolPrizeInstruction::SIZE];
		FundSolPrizeInstruction::initialize(&mut instruction, |_| Ok(())).expect("fund prize");
		instruction[1] = 1;
		assert_eq!(
			FundSolPrizeInstruction::try_from_bytes(&instruction).err(),
			Some(PinaProgramError::InvalidMigrationVersion.into()),
		);
	}

	#[test]
	fn reserved_migration_discriminator_requires_an_exact_envelope() {
		assert!(is_migrate_instruction(&[MIGRATE_DISCRIMINATOR_U8]));
		assert!(!is_migrate_instruction(&[MIGRATE_DISCRIMINATOR_U8, 0,]));
	}

	proptest! {
		#[test]
		fn selection_is_always_inside_the_weight_domain(
			randomness in any::<[u8; 32]>(),
			total_weight in 1u64..=u64::from(u32::MAX),
		) {
			let template = Address::new_from_array([1u8; 32]);
			let opening = Address::new_from_array([2u8; 32]);
			let selected = select_outcome(
				&randomness,
				&template,
				&opening,
				total_weight,
			).unwrap();

			prop_assert!(selected < total_weight);
		}
	}
}
