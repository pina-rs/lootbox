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
#![no_std]

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

declare_id!("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");

/// Maximum number of weighted outcomes in the single-reward model.
pub const MAX_OUTCOMES: usize = 8;
/// Maximum append-only prize bundles in an editable template treasury.
pub const MAX_TEMPLATE_BUNDLES: usize = 1_024;
/// Number of slots after which an unfulfilled opening receives its reward floor.
pub const RANDOMNESS_TIMEOUT_SLOTS: u64 = 300;

/// Maximum sum of outcome weights.
///
/// This bound makes eight-step rejection-sampling exhaustion less likely than
/// `2^-256`. Exhaustion fails closed instead of introducing modulo bias.
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
}

/// Single-byte instruction discriminators for every lootbox instruction.
#[discriminator]
pub enum LootboxInstruction {
	/// Creates a lootbox definition and its SOL vault around an existing box
	/// mint.
	CreateLootbox = 0,
	/// Appends one weighted SOL outcome to an unsealed lootbox.
	AddOutcome = 1,
	/// Transfers SOL from any signer into a lootbox vault.
	Deposit = 2,
	/// Permanently freezes a lootbox's outcome table and enables minting.
	Seal = 3,
	/// Mints unopened boxes while enforcing maximum supply and solvency.
	MintBoxes = 4,
	/// Burns one box and commits fresh Switchboard randomness under an opening
	/// receipt.
	RequestOpen = 5,
	/// Reveals committed randomness, selects an outcome, and pays the recipient.
	SettleOpen = 6,
	/// Pays the minimum reward for an opening left unrevealed past the timeout.
	RefundOpen = 7,
	/// Closes a finalized opening and its Switchboard accounts, returning rent.
	CloseOpening = 8,
	/// Withdraws vault SOL above the rent reserve and worst-case liability.
	WithdrawSurplus = 9,
	/// Creates a draft treasury template bound to a box mint.
	CreateTemplate = 10,
	/// Stages a new prize bundle at the template's next bundle index.
	AddBundle = 11,
	/// Escrows native SOL for one asset of a staged bundle.
	FundSolPrize = 12,
	/// Escrows an SPL Token or Token-2022 prize for one asset of a staged
	/// bundle.
	FundTokenPrize = 13,
	/// Publishes a draft template with at least one activated bundle as live.
	SealTemplate = 14,
	/// Mints template boxes within the activated inventory before the market
	/// lock.
	MintTemplateBoxes = 15,
	/// Burns one template box and commits fresh Switchboard randomness under an
	/// opening receipt.
	RequestTemplateOpen = 16,
	/// Reveals and persists a template opening's randomness without moving any
	/// prize.
	FulfillTemplateOpen = 17,
	/// Allocates the FIFO head opening to one bundle from its verified
	/// randomness.
	AllocateTemplateOpen = 18,
	/// Delivers one allocated SOL asset to the opening's recipient.
	ClaimSolPrize = 19,
	/// Delivers one allocated token asset to the opening's recipient.
	ClaimTokenPrize = 20,
	/// Retires a template, stopping issuance and creator mutations.
	RetireTemplate = 21,
	/// Returns unallocated SOL inventory to the template authority.
	ReclaimSolPrize = 22,
	/// Returns unallocated token inventory to the template authority.
	ReclaimTokenPrize = 23,
	/// Closes a fully delivered template opening and its Switchboard accounts.
	CloseTemplateOpening = 24,
	/// Appends a fully funded staged bundle to the template's live inventory.
	ActivateBundle = 25,
	/// Closes the unfunded or fully reclaimed staged tail bundle.
	CancelBundle = 26,
	/// Escrows a Metaplex Token Metadata NFT for one asset of a staged bundle.
	FundMetadataNftPrize = 27,
	/// Delivers one allocated Token Metadata NFT to the opening's recipient.
	ClaimMetadataNftPrize = 28,
	/// Returns an unallocated Token Metadata NFT to the template authority.
	ReclaimMetadataNftPrize = 29,
	/// Escrows a Metaplex Core asset for one asset of a staged bundle.
	FundCoreAssetPrize = 30,
	/// Delivers one allocated Core asset to the opening's recipient.
	ClaimCoreAssetPrize = 31,
	/// Returns an unallocated Core asset to the template authority.
	ReclaimCoreAssetPrize = 32,
	/// Escrows a Bubblegum compressed NFT for one asset of a staged bundle.
	FundCompressedNftPrize = 33,
	/// Delivers one allocated compressed NFT to the opening's recipient.
	ClaimCompressedNftPrize = 34,
	/// Returns an unallocated compressed NFT to the template authority.
	ReclaimCompressedNftPrize = 35,
	/// Advances a FIFO head opening left unrevealed past the timeout without
	/// consuming inventory.
	ForfeitTemplateOpen = 36,
	/// Irreversibly fixes a live template's box supply to its activated
	/// inventory.
	LockTreasury = 37,
	/// Returns a retired, fully settled template's service vault balance.
	CloseServiceVault = 38,
	/// Escrows winner-routable native SOL for one asset of a staged bundle.
	FundQuoteSolPrize = 39,
	/// Escrows a winner-routable token quote for one asset of a staged bundle.
	FundQuoteTokenPrize = 40,
	/// Hands an empty badge mint's authority to a staged bundle for
	/// mint-on-claim delivery.
	FundMintPrize = 41,
	/// Mints one allocated badge to the opening's recipient.
	ClaimMintPrize = 42,
	/// Releases unallocated badge copies and revokes the bundle's mint
	/// authority once every copy is released.
	ReclaimMintPrize = 43,
	/// Reserves one bundle asset slot for a Bubblegum prize pool over one tree.
	CreatePrizePool = 44,
	/// Transfers the prepared compressed NFT into the prize pool's custody.
	DepositPrizePoolItem = 45,
	/// Commits a fully deposited prize pool to its bundle slot.
	SealPrizePool = 46,
	/// Allocates the FIFO head opening and selects one prize-pool item.
	AllocatePrizePoolOpen = 47,
	/// Transfers the selected prize-pool item to the opening's recipient.
	ClaimPrizePoolItem = 48,
	/// Returns an unassigned prize-pool item to the template authority.
	ReclaimPrizePoolItem = 49,
	/// Closes an empty, fully recovered, or terminal prize pool.
	ClosePrizePool = 50,
	/// Records the verified immutable metadata commitment for the next pool
	/// item.
	PreparePrizePoolItem = 51,
	/// Closes a prepared prize-pool item that was never deposited.
	CancelPrizePoolItem = 52,
	/// Creates an Exclusive NFT collection PDA and its Metaplex Core
	/// collection.
	CreateExclusiveCollection = 53,
	/// Loads one trait layer into a draft Exclusive NFT collection.
	SetExclusiveLayer = 54,
	/// Creates a Bubblegum tree and makes it the collection's active tree.
	AppendExclusiveTree = 55,
	/// Validates and freezes an Exclusive NFT collection's layer tables.
	PublishExclusiveCollection = 56,
	/// Binds a staged bundle asset slot to a published Exclusive NFT
	/// collection and escrows its mint fees.
	AttachExclusiveNft = 57,
	/// Mints one allocated Exclusive NFT to the opening's recipient.
	ClaimExclusiveNft = 58,
	/// Returns unused Exclusive NFT mint fees to the template authority.
	ReclaimExclusiveFees = 59,
}

/// Single-byte account discriminators for every lootbox-owned account.
#[discriminator]
pub enum LootboxAccountType {
	/// A `LootboxState` definition.
	LootboxState = 1,
	/// A `VaultState` SOL vault.
	VaultState = 2,
	/// An `OpeningState` receipt for the single-reward lootbox model.
	OpeningState = 3,
	/// A `TemplateState` treasury template.
	TemplateState = 4,
	/// A `BundleState` prize bundle.
	BundleState = 5,
	/// A `TemplateOpeningState` receipt for a template box.
	TemplateOpeningState = 6,
	/// A `ResultReceiptState` immutable allocation result.
	ResultReceiptState = 7,
	/// A `PrizePoolState` Bubblegum prize pool.
	PrizePoolState = 8,
	/// A `PrizePoolItemState` prize-pool item.
	PrizePoolItemState = 9,
	/// An `ExclusiveCollectionState` layered NFT collection.
	ExclusiveCollectionState = 10,
	/// An `ExclusiveAttachmentState` binding a bundle slot to a collection.
	ExclusiveAttachmentState = 11,
}

/// Single-byte event discriminators for every event the program emits.
#[discriminator]
pub enum LootboxEventType {
	/// An `ExclusiveNftMintedEvent`, emitted once per minted Exclusive NFT.
	ExclusiveNftMinted = 1,
}

/// Immutable definition and live accounting for one lootbox mint.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(seeds = [SEED_LOOTBOX, authority: Address, id: u64], bump = bump)]
pub struct LootboxState {
	/// Creator that pays for creation and alone may add outcomes, seal, mint
	/// boxes, and withdraw surplus. A PDA seed; never changes.
	pub authority: Address,
	/// Classic SPL Token mint whose tokens are unopened boxes. It has zero
	/// decimals, this PDA as mint authority, and no freeze authority.
	pub box_mint: Address,
	/// Switchboard On-Demand program, mainnet or devnet, that must own every
	/// opening's randomness account.
	pub oracle_program: Address,
	/// Switchboard queue that every opening's randomness must be bound to.
	pub oracle_queue: Address,
	/// Creator-chosen identifier that distinguishes this authority's lootboxes.
	/// A PDA seed.
	pub id: u64,
	/// Lifetime cap on boxes minted; nonzero and fixed at creation.
	pub max_supply: u64,
	/// Boxes ever minted. Never decreases when boxes burn; bounded by
	/// `max_supply`.
	pub total_minted: u64,
	/// Boxes burned by `RequestOpen` that are not yet settled or refunded.
	/// Each counts toward the vault's worst-case liability.
	pub pending_openings: u64,
	/// Openings settled by `SettleOpen`.
	pub opened: u64,
	/// Openings finalized at the reward floor by `RefundOpen`.
	pub refunded: u64,
	/// Sum of all outcome weights; the uniform sampling domain. At most
	/// `MAX_TOTAL_WEIGHT`.
	pub total_weight: u64,
	/// Largest outcome reward, in lamports. Every live or pending box is
	/// collateralized at this amount.
	pub max_reward_lamports: u64,
	/// Eight little-endian `u64` weight slots. Slot `i` holds outcome `i`'s
	/// positive weight; slots at or past `outcome_count` are zero.
	pub outcome_weights: [u8; 64],
	/// Eight little-endian `u64` reward slots, in lamports. Slot `i` holds
	/// outcome `i`'s positive reward; slots at or past `outcome_count` are zero.
	pub outcome_lamports: [u8; 64],
	/// Number of configured outcomes, from zero through `MAX_OUTCOMES`.
	pub outcome_count: u8,
	/// Set once by `Seal`. A sealed lootbox has a frozen outcome table and may
	/// mint and open boxes.
	pub sealed: bool,
	/// Canonical bump of this lootbox PDA.
	pub bump: u8,
	/// Canonical bump of this lootbox's vault PDA.
	pub vault_bump: u8,
}

/// Program-owned SOL vault for one lootbox definition.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(seeds = [SEED_VAULT, lootbox: Address], bump = bump)]
pub struct VaultState {
	/// Lootbox this vault collateralizes. A PDA seed.
	pub lootbox: Address,
	/// Vault balance in lamports recorded immediately after creation, normally
	/// its rent-exempt minimum. Never paid out or withdrawn.
	pub rent_reserve: u64,
	/// Canonical bump of this vault PDA.
	pub bump: u8,
}

/// Receipt binding a burned box to one unrevealed randomness commitment.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(
	seeds = [SEED_OPENING, lootbox: Address, randomness: Address],
	bump = bump
)]
pub struct OpeningState {
	/// Lootbox whose box was burned. A PDA seed.
	pub lootbox: Address,
	/// Box owner that requested the opening. The only address that may receive
	/// the reward, sign a refund, or receive the closed receipt's rent.
	pub recipient: Address,
	/// Switchboard randomness account committed for this opening, with this
	/// PDA as its authority. A PDA seed.
	pub randomness: Address,
	/// Slot Switchboard recorded when the randomness was committed. The reveal
	/// must match it, and a refund opens `RANDOMNESS_TIMEOUT_SLOTS` later.
	pub seed_slot: u64,
	/// Lamports paid to the recipient. Zero while pending; set to the selected
	/// reward on settlement or to the minimum reward on refund.
	pub reward_lamports: u64,
	/// Index of the paid outcome in the lootbox's outcome table. Zero while
	/// pending; on refund, the index of the minimum reward.
	pub selected_outcome: u8,
	/// Lifecycle status: `0` pending, `1` settled, `2` refunded.
	pub status: u8,
	/// Canonical bump of this opening PDA.
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

/// Creates a lootbox definition PDA and its SOL vault PDA, both paid for by the
/// signing authority. The box mint must be an existing classic SPL mint with
/// zero decimals, zero supply, the lootbox PDA as mint authority, and no freeze
/// authority. The new lootbox is unsealed and has no outcomes.
#[instruction(discriminator = LootboxInstruction::CreateLootbox, migrations)]
pub struct CreateLootboxInstruction {
	/// Creator-chosen identifier that distinguishes this authority's lootboxes;
	/// a seed of the lootbox PDA.
	pub id: u64,
	/// Lifetime cap on boxes minted. Rejected with `SupplyExceeded` when zero.
	pub max_supply: u64,
	/// Switchboard On-Demand program that will own randomness accounts; must be
	/// the mainnet or devnet program ID.
	pub oracle_program: Address,
	/// Switchboard queue that every opening's randomness must be bound to.
	/// Stored as given; each opening checks it.
	pub oracle_queue: Address,
	/// Canonical bump of the lootbox PDA; rejected unless it equals the derived
	/// canonical bump.
	pub bump: u8,
	/// Canonical bump of the vault PDA; rejected unless it equals the derived
	/// canonical bump.
	pub vault_bump: u8,
}

/// Appends one outcome to an unsealed lootbox's table, signed by the lootbox
/// authority. At most `MAX_OUTCOMES` outcomes may exist, and the total weight
/// must stay within `MAX_TOTAL_WEIGHT`. Raises `max_reward_lamports` when this
/// reward is the largest so far.
#[instruction(discriminator = LootboxInstruction::AddOutcome, migrations)]
pub struct AddOutcomeInstruction {
	/// Relative selection weight; must be nonzero.
	pub weight: u64,
	/// SOL reward paid when this outcome is selected, in lamports; must be
	/// nonzero.
	pub reward_lamports: u64,
}

/// Transfers lamports from any signer into a lootbox's vault. Allowed at any
/// point in the lootbox's life; deposits only add collateral.
#[instruction(discriminator = LootboxInstruction::Deposit, migrations)]
pub struct DepositInstruction {
	/// Amount to transfer into the vault, in lamports; must be nonzero.
	pub lamports: u64,
}

/// Permanently seals a lootbox, signed by its authority. Requires at least one
/// outcome. Sealing freezes the outcome table and enables minting and opening;
/// it cannot be undone.
#[instruction(discriminator = LootboxInstruction::Seal, migrations)]
pub struct SealInstruction {}

/// Mints boxes of a sealed lootbox into a recipient's canonical associated
/// token account, signed by the lootbox authority. Fails unless lifetime mints
/// stay within `max_supply` and the vault still covers the rent reserve plus
/// `max_reward_lamports` for every live and pending box.
#[instruction(discriminator = LootboxInstruction::MintBoxes, migrations)]
pub struct MintBoxesInstruction {
	/// Number of boxes to mint; must be nonzero.
	pub amount: u64,
}

/// Opens one box of a sealed lootbox, signed by the box owner and a fresh
/// randomness keypair. Creates the opening receipt PDA, initializes and
/// commits Switchboard randomness with that PDA as its authority, then burns
/// one box from the owner's associated token account. The owner pays all rent.
#[instruction(discriminator = LootboxInstruction::RequestOpen, migrations)]
pub struct RequestOpenInstruction {
	/// Recent slot used by Switchboard to derive its per-randomness lookup
	/// table; passed through to `randomness_init`.
	pub recent_slot: u64,
	/// Canonical bump of the opening PDA; rejected unless it equals the derived
	/// canonical bump.
	pub bump: u8,
}

/// Reveals a pending opening's randomness through a Switchboard CPI signed by
/// the opening PDA, selects an outcome, and pays its reward from the vault to
/// the opening's recipient. Permissionless: any signer may relay the proof and
/// pay the reveal fees. The randomness must still be unrevealed.
#[instruction(discriminator = LootboxInstruction::SettleOpen, migrations)]
pub struct SettleOpenInstruction {
	/// Switchboard enclave signature returned by the randomness gateway.
	pub signature: [u8; 64],
	/// Secp256k1 recovery identifier returned by the randomness gateway.
	pub recovery_id: u8,
	/// Revealed value covered by `signature`. The stored reveal must equal it
	/// after the CPI.
	pub value: [u8; 32],
}

/// Finalizes a pending opening at the lootbox's minimum reward, signed by the
/// opening's recipient. Allowed only while the randomness is unrevealed and at
/// least `RANDOMNESS_TIMEOUT_SLOTS` slots after the commitment's seed slot.
#[instruction(discriminator = LootboxInstruction::RefundOpen, migrations)]
pub struct RefundOpenInstruction {}

/// Closes a settled or refunded opening. Permissionless. Closes the Switchboard
/// randomness account and its reward escrow through a CPI signed by the opening
/// PDA, then closes the receipt and returns its lamports to the recipient.
#[instruction(discriminator = LootboxInstruction::CloseOpening, migrations)]
pub struct CloseOpeningInstruction {}

/// Transfers surplus vault lamports to the lootbox authority, who must sign.
/// The vault must keep its rent reserve plus `max_reward_lamports` for every
/// live and pending box.
#[instruction(discriminator = LootboxInstruction::WithdrawSurplus, migrations)]
pub struct WithdrawSurplusInstruction {
	/// Amount to withdraw, in lamports. Zero is accepted as a no-op.
	pub lamports: u64,
}

/// Accounts for `createLootbox`.
#[derive(Accounts, Debug)]
pub struct CreateLootboxAccounts<'a> {
	/// Creator that becomes the lootbox authority and pays rent for the lootbox
	/// and vault accounts. Signer; seed of the lootbox PDA.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Existing classic SPL mint for the boxes. Must have zero decimals, zero
	/// supply, the lootbox PDA as mint authority, and no freeze authority.
	pub box_mint: &'a AccountView,
	/// Lootbox PDA `["lootbox", authority, id]`, created here.
	#[pina(validate(empty))]
	pub lootbox: &'a mut AccountView,
	/// Vault PDA `["vault", lootbox]`, created here; its post-creation balance
	/// becomes the rent reserve.
	#[pina(validate(empty))]
	pub vault: &'a mut AccountView,
	/// System program, invoked to create the lootbox and vault accounts.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// SPL Token program that owns the box mint.
	#[pina(validate(address = token::ID))]
	pub token_program: &'a AccountView,
}

/// Accounts for `addOutcome`.
#[derive(Accounts, Debug)]
pub struct AddOutcomeAccounts<'a> {
	/// Lootbox authority. Signer; must match the stored authority.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Unsealed lootbox whose outcome table, total weight, and maximum reward
	/// are updated.
	pub lootbox: &'a mut AccountView,
}

/// Accounts for `deposit`.
#[derive(Accounts, Debug)]
pub struct DepositAccounts<'a> {
	/// Any wallet funding the vault. Writable signer; the lamports come from
	/// it.
	#[pina(validate(signer))]
	pub depositor: &'a mut AccountView,
	/// Lootbox whose vault receives the deposit; its PDA is revalidated.
	pub lootbox: &'a AccountView,
	/// Vault PDA of `lootbox` that receives the lamports. Writable.
	pub vault: &'a mut AccountView,
	/// System program, invoked for the transfer.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

/// Accounts for `seal`.
#[derive(Accounts, Debug)]
pub struct SealAccounts<'a> {
	/// Lootbox authority. Signer; must match the stored authority.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Unsealed lootbox with at least one outcome, marked sealed here.
	pub lootbox: &'a mut AccountView,
}

/// Accounts for `mintBoxes`.
#[derive(Accounts, Debug)]
pub struct MintBoxesAccounts<'a> {
	/// Lootbox authority. Signer; must match the stored authority.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Sealed lootbox whose `total_minted` grows; its PDA signs the mint as
	/// mint authority.
	pub lootbox: &'a mut AccountView,
	/// Vault PDA of `lootbox`, read to prove the new supply stays fully
	/// collateralized.
	pub vault: &'a AccountView,
	/// The lootbox's box mint. Writable; its supply grows.
	pub box_mint: &'a mut AccountView,
	/// Canonical associated token account of the recipient for the box mint,
	/// which receives the new boxes.
	pub recipient_box_account: &'a mut AccountView,
	/// SPL Token program, invoked to mint the boxes.
	#[pina(validate(address = token::ID))]
	pub token_program: &'a AccountView,
}

/// Accounts for `requestOpen`.
#[derive(Accounts, Debug)]
pub struct RequestOpenAccounts<'a> {
	/// Box owner that burns one box and becomes the opening's recipient.
	/// Writable signer; pays rent for the opening and Switchboard accounts.
	#[pina(validate(signer))]
	pub owner: &'a mut AccountView,
	/// Sealed lootbox whose `pending_openings` grows.
	pub lootbox: &'a mut AccountView,
	/// Vault PDA of `lootbox`, read to prove the pending opening stays fully
	/// collateralized.
	pub vault: &'a AccountView,
	/// The lootbox's box mint. Writable; one box is burned.
	pub box_mint: &'a mut AccountView,
	/// Owner's canonical associated token account for the box mint; must hold
	/// at least one box, and one is burned from it.
	pub owner_box_account: &'a mut AccountView,
	/// Opening PDA `["opening", lootbox, randomness]`, created here. It becomes
	/// the randomness authority and signs the Switchboard CPIs.
	#[pina(validate(empty))]
	pub opening: &'a mut AccountView,
	/// Fresh randomness keypair. Signer; initialized and committed here by
	/// Switchboard.
	#[pina(validate(signer))]
	#[pina(validate(empty))]
	pub randomness: &'a mut AccountView,
	/// Wrapped-SOL associated token account of `randomness`, used by
	/// Switchboard as its reward escrow.
	pub reward_escrow: &'a mut AccountView,
	/// Switchboard queue; must equal the lootbox's stored queue.
	pub oracle_queue: &'a mut AccountView,
	/// Oracle assigned to the commitment; must be owned by the oracle program.
	/// Switchboard validates queue membership and binds it to the randomness.
	pub oracle: &'a mut AccountView,
	/// Slot hashes sysvar, read by Switchboard's commit.
	#[pina(validate(sysvar = SLOT_HASHES_SYSVAR_ID))]
	pub recent_slot_hashes: &'a AccountView,
	/// Switchboard program; must equal the lootbox's stored oracle program.
	pub oracle_program: &'a AccountView,
	/// Switchboard program state, passed through to `randomness_init`.
	pub oracle_program_state: &'a AccountView,
	/// Switchboard lookup-table signer, passed through to `randomness_init`.
	pub oracle_lut_signer: &'a AccountView,
	/// Switchboard per-randomness lookup table derived from `recent_slot`,
	/// created by `randomness_init`.
	pub oracle_lut: &'a mut AccountView,
	/// Associated Token Account program, used by Switchboard to create the
	/// reward escrow.
	#[pina(validate(address = associated_token_account::ID))]
	pub associated_token_program: &'a AccountView,
	/// Wrapped-SOL mint backing the reward escrow.
	#[pina(validate(address = WRAPPED_SOL_MINT_ID))]
	pub wrapped_sol_mint: &'a AccountView,
	/// Address Lookup Table program, used by Switchboard to create its lookup
	/// table.
	#[pina(validate(address = ADDRESS_LOOKUP_TABLE_PROGRAM_ID))]
	pub address_lookup_table_program: &'a AccountView,
	/// System program, invoked to create the opening account.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// SPL Token program, invoked to burn the box.
	#[pina(validate(address = token::ID))]
	pub token_program: &'a AccountView,
}

/// Accounts for `settleOpen`.
#[derive(Accounts, Debug)]
pub struct SettleOpenAccounts<'a> {
	/// Opening's stored recipient, which receives the reward lamports. Writable;
	/// need not sign.
	pub recipient: &'a mut AccountView,
	/// Relayer that submits the proof. Writable signer; pays Switchboard's
	/// reveal costs.
	#[pina(validate(signer))]
	pub payer: &'a mut AccountView,
	/// Lootbox of the opening; `pending_openings` falls and `opened` grows.
	pub lootbox: &'a mut AccountView,
	/// Vault PDA of `lootbox` that pays the reward; must keep its rent reserve
	/// plus the remaining liability.
	pub vault: &'a mut AccountView,
	/// The lootbox's box mint, read for the live supply in the liability check.
	pub box_mint: &'a AccountView,
	/// Pending opening PDA bound to `lootbox`, `randomness`, and `recipient`.
	/// Signs the reveal CPI and records the result.
	pub opening: &'a mut AccountView,
	/// Opening's committed, unrevealed Switchboard randomness account, revealed
	/// here.
	pub randomness: &'a mut AccountView,
	/// Switchboard queue; must equal the lootbox's stored queue.
	pub oracle_queue: &'a AccountView,
	/// Oracle recorded on the randomness at commit time.
	pub oracle: &'a AccountView,
	/// Oracle stats account updated by Switchboard's reveal.
	pub oracle_stats: &'a mut AccountView,
	/// Slot hashes sysvar, read by Switchboard's reveal.
	#[pina(validate(sysvar = SLOT_HASHES_SYSVAR_ID))]
	pub recent_slot_hashes: &'a AccountView,
	/// Switchboard program; must equal the lootbox's stored oracle program.
	pub oracle_program: &'a AccountView,
	/// Wrapped-SOL associated token account of `randomness`, used by
	/// Switchboard as its reward escrow.
	pub reward_escrow: &'a mut AccountView,
	/// Switchboard program state, passed through to `randomness_reveal`.
	pub oracle_program_state: &'a AccountView,
	/// System program, passed through to `randomness_reveal`.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// SPL Token program backing the reward escrow.
	#[pina(validate(address = token::ID))]
	pub token_program: &'a AccountView,
	/// Wrapped-SOL mint backing the reward escrow.
	#[pina(validate(address = WRAPPED_SOL_MINT_ID))]
	pub wrapped_sol_mint: &'a AccountView,
}

/// Accounts for `refundOpen`.
#[derive(Accounts, Debug)]
pub struct RefundOpenAccounts<'a> {
	/// Opening's stored recipient. Writable signer; receives the minimum
	/// reward.
	#[pina(validate(signer))]
	pub recipient: &'a mut AccountView,
	/// Lootbox of the opening; `pending_openings` falls and `refunded` grows.
	pub lootbox: &'a mut AccountView,
	/// Vault PDA of `lootbox` that pays the minimum reward; must keep its rent
	/// reserve plus the remaining liability.
	pub vault: &'a mut AccountView,
	/// The lootbox's box mint, read for the live supply in the liability check.
	pub box_mint: &'a AccountView,
	/// Pending opening PDA bound to `lootbox`, `randomness`, and `recipient`;
	/// records the refund.
	pub opening: &'a mut AccountView,
	/// Opening's Switchboard randomness account; must still be unrevealed.
	pub randomness: &'a AccountView,
	/// Clock sysvar, validated in the handler and read for the current slot.
	pub clock: &'a AccountView,
}

/// Accounts for `closeOpening`.
#[derive(Accounts, Debug)]
pub struct CloseOpeningAccounts<'a> {
	/// Opening's stored recipient, which receives the receipt's lamports,
	/// including the randomness rent Switchboard returns to the opening PDA.
	pub recipient: &'a mut AccountView,
	/// Lootbox of the opening, read to validate the oracle program and queue.
	pub lootbox: &'a AccountView,
	/// Settled or refunded opening PDA; signs the close CPI and is closed here.
	pub opening: &'a mut AccountView,
	/// Opening's Switchboard randomness account, closed by Switchboard.
	pub randomness: &'a mut AccountView,
	/// Wrapped-SOL associated token account of `randomness`, closed by
	/// Switchboard.
	pub reward_escrow: &'a mut AccountView,
	/// Switchboard program; must equal the lootbox's stored oracle program.
	pub oracle_program: &'a AccountView,
	/// Switchboard program state, passed through to `randomness_close`.
	pub oracle_program_state: &'a AccountView,
	/// Switchboard lookup table of the randomness account, passed through to
	/// `randomness_close`.
	pub oracle_lut: &'a mut AccountView,
	/// Switchboard lookup-table signer, passed through to `randomness_close`.
	pub oracle_lut_signer: &'a AccountView,
	/// System program, passed through to `randomness_close`.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// SPL Token program backing the reward escrow.
	#[pina(validate(address = token::ID))]
	pub token_program: &'a AccountView,
	/// Wrapped-SOL mint backing the reward escrow.
	#[pina(validate(address = WRAPPED_SOL_MINT_ID))]
	pub wrapped_sol_mint: &'a AccountView,
	/// Address Lookup Table program, used by Switchboard to close its lookup
	/// table.
	#[pina(validate(address = ADDRESS_LOOKUP_TABLE_PROGRAM_ID))]
	pub address_lookup_table_program: &'a AccountView,
}

/// Accounts for `withdrawSurplus`.
#[derive(Accounts, Debug)]
pub struct WithdrawSurplusAccounts<'a> {
	/// Lootbox authority. Writable signer; must match the stored authority and
	/// receives the lamports.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Lootbox whose vault is drawn from.
	pub lootbox: &'a AccountView,
	/// Vault PDA of `lootbox` that pays the withdrawal. Writable.
	pub vault: &'a mut AccountView,
	/// The lootbox's box mint, read for the live supply in the liability check.
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
	let mint = box_mint.as_token_mint()?;

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

/// Require the Switchboard reward escrow for one randomness account.
///
/// The oracle derives this escrow as the wrapped-SOL associated token account
/// of the randomness account itself; pinning the derivation keeps a client
/// from substituting an arbitrary writable token account into the CPI.
fn assert_reward_escrow(escrow: &AccountView, randomness: &Address) -> ProgramResult {
	escrow
		.assert_associated_token_address(randomness, &WRAPPED_SOL_MINT_ID, &token::ID)
		.map(|_| ())
}

/// Require a commit-time oracle account owned by the oracle program itself.
///
/// Switchboard's own commit validates queue membership; this ownership check
/// fails a substituted foreign account closed before the CPI runs.
fn assert_commit_oracle(oracle: &AccountView, oracle_program: &Address) -> ProgramResult {
	oracle.assert_owner(oracle_program).map(|_| ())
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

/// Map one uniformly distributed 64-bit candidate onto `0..bound` without
/// modulo bias.
///
/// The low band `0..(2^64 mod bound)` is rejected so every accepted residue has
/// exactly the same number of preimages. Callers draw a fresh candidate after
/// a rejection. `bound` must be nonzero.
const fn accept_uniform_candidate(candidate: u64, bound: u64) -> Option<u64> {
	let rejection_threshold = bound.wrapping_neg() % bound;

	if candidate < rejection_threshold {
		return None;
	}

	Some(candidate % bound)
}

/// Read the first eight bytes of a digest as a little-endian sample.
fn digest_candidate(digest: &[u8]) -> u64 {
	let mut candidate_bytes = [0u8; 8];
	candidate_bytes.copy_from_slice(&digest[..8]);

	u64::from_le_bytes(candidate_bytes)
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
			.assert_seeds_with_bump(&lootbox_seeds_with_bump.as_slices(), &ID)?;
		let canonical_vault_bump = self
			.vault
			.assert_canonical_bump(&vault_seeds.as_slices(), &ID)?;

		if canonical_vault_bump != args.vault_bump {
			return Err(ProgramError::InvalidSeeds);
		}

		self.vault
			.assert_seeds_with_bump(&vault_seeds_with_bump.as_slices(), &ID)?;
		let mint = self.box_mint.as_token_mint()?;

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
		assert_authority_address(self.authority, &state.authority)?;

		if state.sealed.get() {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if args.weight.get() == 0 || args.reward_lamports.get() == 0 {
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
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
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

		let recipient_box_account = self.recipient_box_account.as_token_account()?;
		let recipient = *recipient_box_account.owner();
		drop(recipient_box_account);
		drop(self.recipient_box_account.as_associated_token_account(
			&recipient,
			self.box_mint.address(),
			&token::ID,
		)?);
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
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let mut state = self.lootbox.as_account_mut::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
		self.oracle_queue.assert_address(&state.oracle_queue)?;
		self.oracle_program.assert_program(&state.oracle_program)?;

		if !state.sealed.get() {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		let mint_supply = assert_box_mint(self.box_mint, &lootbox_address, &state.box_mint)?;
		let box_account = self.owner_box_account.as_associated_token_account(
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
			|| committed.oracle != *self.oracle.address()
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
		self.vault.send_owned(&ID, reward_lamports, self.recipient)
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
		self.vault.send_owned(&ID, floor_lamports, self.recipient)
	}
}

impl<'a> ProcessAccountInfos<'a> for CloseOpeningAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = CloseOpeningInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let opening_address = *self.opening.address();
		let randomness_address = *self.randomness.address();
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
		assert_reward_escrow(self.reward_escrow, &randomness_address)?;
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

		self.opening.close_account_zeroed(&ID, self.recipient)
	}
}

impl<'a> ProcessAccountInfos<'a> for WithdrawSurplusAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = WithdrawSurplusInstruction::try_from_bytes(data)?;
		let lootbox_address = *self.lootbox.address();
		let rent_reserve = assert_vault(self.vault, &lootbox_address)?;
		let state = self.lootbox.as_account::<LootboxState>(&ID)?;
		assert_lootbox_pda(&lootbox_address, &state)?;
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
		self.vault
			.send_owned(&ID, args.lamports.get(), self.authority)
	}
}

/// Largest total rent top-up the reserved `Migrate` instruction may draw from
/// its payer across every account slot in one invocation.
const MAX_MIGRATION_LAMPORTS: u64 = 1_000_000;

/// Fail closed unless one reserved-route slot is already at the current
/// schema version.
///
/// The reserved `Migrate` instruction is permissionless, so any third party
/// could otherwise force a future schema transition onto live accounts at a
/// time of their choosing. Until a maintainer deliberately replaces this
/// tripwire with an authority-checked migration entry point, the route may
/// only validate accounts that have nothing to migrate.
fn assert_migration_slot_is_current<T: MigratableAccount>(
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
/// Accounts are `[payer, systemProgram, lootbox, vault, opening, template,
/// bundle, templateOpening, resultReceipt, prizePool, prizePoolItem,
/// exclusiveCollection, exclusiveAttachment]`; every
/// state slot is optional and skipped when it holds the program-address
/// placeholder.
fn process_migrate(program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
	assert_migration_slot_is_current::<LootboxState>(program_id, accounts, 2)?;
	assert_migration_slot_is_current::<VaultState>(program_id, accounts, 3)?;
	assert_migration_slot_is_current::<OpeningState>(program_id, accounts, 4)?;
	assert_migration_slot_is_current::<TemplateState>(program_id, accounts, 5)?;
	assert_migration_slot_is_current::<BundleState>(program_id, accounts, 6)?;
	assert_migration_slot_is_current::<TemplateOpeningState>(program_id, accounts, 7)?;
	assert_migration_slot_is_current::<ResultReceiptState>(program_id, accounts, 8)?;
	assert_migration_slot_is_current::<PrizePoolState>(program_id, accounts, 9)?;
	assert_migration_slot_is_current::<PrizePoolItemState>(program_id, accounts, 10)?;
	assert_migration_slot_is_current::<ExclusiveCollectionState>(program_id, accounts, 11)?;
	assert_migration_slot_is_current::<ExclusiveAttachmentState>(program_id, accounts, 12)?;

	let mut context = MigrateContext::new(program_id, accounts, Some(MAX_MIGRATION_LAMPORTS))?;
	context.run_optional::<LootboxState>(2)?;
	context.run_optional::<VaultState>(3)?;
	context.run_optional::<OpeningState>(4)?;
	context.run_optional::<TemplateState>(5)?;
	context.run_optional::<BundleState>(6)?;
	context.run_optional::<TemplateOpeningState>(7)?;
	context.run_optional::<ResultReceiptState>(8)?;
	context.run_optional::<PrizePoolState>(9)?;
	context.run_optional::<PrizePoolItemState>(10)?;
	context.run_optional::<ExclusiveCollectionState>(11)?;
	context.run_optional::<ExclusiveAttachmentState>(12)?;
	Ok(())
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
	}
}

#[cfg(test)]
mod tests {
	use proptest::prelude::*;

	use super::*;

	#[test]
	fn weighted_boundaries_select_expected_outcomes() {
		let mut bytes = [0u8; LootboxState::SIZE];
		let state = LootboxState::initialize(&mut bytes, |_| Ok(())).unwrap();
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
		let state = LootboxState::initialize(&mut bytes, |_| Ok(())).unwrap();
		state.outcome_count = 3;
		write_outcome_slot(&mut state.outcome_lamports, 0, 50).expect("first reward");
		write_outcome_slot(&mut state.outcome_lamports, 1, 10).expect("second reward");
		write_outcome_slot(&mut state.outcome_lamports, 2, 30).expect("third reward");

		assert_eq!(minimum_outcome(state), Ok((1, 10)));
	}

	#[test]
	fn liability_counts_minted_and_pending_boxes_once() {
		let mut bytes = [0u8; LootboxState::SIZE];
		let state = LootboxState::initialize(&mut bytes, |_| Ok(())).expect("state");
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

	#[test]
	fn fixed_wire_types_reject_trailing_bytes() {
		let mut account = alloc::vec![0; LootboxState::SIZE];
		LootboxState::initialize(&mut account, |_| Ok(())).expect("lootbox state");
		account.push(0);
		assert_eq!(
			LootboxState::try_from_bytes(&account).err(),
			Some(PinaProgramError::InvalidAccountSize.into()),
		);

		let mut instruction = alloc::vec![0; DepositInstruction::SIZE];
		DepositInstruction::initialize(&mut instruction, |_| Ok(())).expect("deposit");
		instruction.push(0);
		assert!(DepositInstruction::try_from_bytes(&instruction).is_err());
	}

	#[test]
	fn future_schema_versions_fail_closed() {
		let mut account = alloc::vec![0; LootboxState::SIZE];
		LootboxState::initialize(&mut account, |_| Ok(())).expect("lootbox state");
		account[1] = 1;
		assert_eq!(
			LootboxState::try_from_bytes(&account).err(),
			Some(PinaProgramError::InvalidMigrationVersion.into()),
		);
		assert_eq!(
			LootboxState::try_from_bytes_versioned(&account).err(),
			Some(PinaProgramError::InvalidMigrationVersion.into()),
		);

		let mut instruction = alloc::vec![0; DepositInstruction::SIZE];
		DepositInstruction::initialize(&mut instruction, |_| Ok(())).expect("deposit");
		instruction[1] = 1;
		assert_eq!(
			DepositInstruction::try_from_bytes(&instruction).err(),
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
