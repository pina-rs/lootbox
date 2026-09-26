//! Finite, fully escrowed prize bundles and reusable Token-2022 box templates.

use pina::sysvars::Sysvar;
use pina::sysvars::rent::Rent;

use crate::*;

mod opening;
pub use opening::*;

mod claims;
pub use claims::*;

mod retirement;
pub use retirement::*;

mod collections;
pub use collections::*;

mod prize_pool;
pub use prize_pool::*;

mod close;
pub use close::*;

mod issuer_stock;
pub use issuer_stock::*;

mod exclusive_nft;
pub use exclusive_nft::*;

const SEED_TEMPLATE: &[u8] = b"template";
const SEED_BUNDLE: &[u8] = b"bundle";
const SEED_TEMPLATE_OPENING: &[u8] = b"template-opening";
const SEED_SERVICE_VAULT: &[u8] = b"service-vault";
const SEED_RESULT_RECEIPT: &[u8] = b"result-receipt";
const SEED_PRIZE_POOL: &[u8] = b"prize-pool";
const SEED_PRIZE_POOL_ITEM: &[u8] = b"prize-pool-item";
const MANIFEST_BUNDLE_DOMAIN: &[u8] = b"pina-lootbox-manifest-bundle";
const MANIFEST_DOMAIN: &[u8] = b"pina-lootbox-manifest";
/// Maximum assets delivered by one winning bundle.
pub const MAX_PRIZE_ASSETS: usize = 4;
/// A native SOL prize, denominated in lamports.
pub const PRIZE_SOL: u8 = 0;
/// A classic SPL Token prize, denominated in base units.
pub const PRIZE_TOKEN: u8 = 1;
/// A unique, non-freezable classic SPL mint with revoked mint authority.
pub const PRIZE_NFT: u8 = 2;
/// A safe fungible Token-2022 prize.
pub const PRIZE_TOKEN_2022: u8 = 3;
/// A standard Token Metadata NFT with no programmable transfer rules.
pub const PRIZE_METADATA_NFT: u8 = 4;
/// A Metaplex Core asset.
pub const PRIZE_CORE_ASSET: u8 = 5;
/// A Bubblegum compressed NFT.
pub const PRIZE_COMPRESSED_NFT: u8 = 6;
/// Native SOL released to the winner for winner-routed execution.
pub const PRIZE_QUOTE_SOL: u8 = 7;
/// A classic or safe Token-2022 quote released for winner-routed execution.
pub const PRIZE_QUOTE_TOKEN: u8 = 8;
/// A zero-decimal badge whose mint authority is held by the bundle PDA.
pub const PRIZE_MINT_BADGE: u8 = 9;
/// A uniformly sampled Bubblegum V1 inventory owned by a prize-pool PDA.
pub const PRIZE_POOL: u8 = 10;
/// Maximum Bubblegum leaves held by one prize pool.
pub const MAX_PRIZE_POOL_ITEMS: usize = 4_096;
/// Largest canonical Bubblegum V1 `MetadataArgs` Borsh preimage.
pub const MAX_PRIZE_POOL_METADATA_BYTES: usize = 512;
const MAX_PRIZE_POOL_BITMAP_BYTES: usize = MAX_PRIZE_POOL_ITEMS.div_ceil(8);

const TEMPLATE_DRAFT: u8 = 0;
const TEMPLATE_LIVE: u8 = 1;
const TEMPLATE_RETIRED: u8 = 2;
const BUNDLE_FUNDING: u8 = 0;
const BUNDLE_ACTIVE: u8 = 1;

/// Immutable template terms and the live finite inventory.
#[account(
	discriminator = LootboxAccountType,
	compact,
	migrations,
	validate(with = validate_template_state)
)]
#[pda(seeds = [SEED_TEMPLATE, authority: Address, id: u64], bump = bump)]
pub struct TemplateState {
	/// Creator that signs every administrative instruction and seeds this PDA.
	/// Receives staging rent, reclaimed inventory, and the closed service vault.
	pub authority: Address,
	/// Zero-decimal Token-2022 mint whose tokens are unopened boxes. This PDA
	/// holds its mint authority until `lockTreasury` revokes it.
	pub box_mint: Address,
	/// Switchboard On-Demand program, mainnet or devnet, fixed at creation.
	/// Every randomness account must be owned by this program.
	pub oracle_program: Address,
	/// Nonzero Switchboard queue that every opening's randomness must use.
	pub oracle_queue: Address,
	/// Creator-chosen identifier that seeds this PDA beside `authority`.
	pub id: u64,
	/// Non-negative reveal time in unix seconds. Openings fail before it, and
	/// `lockTreasury` must run strictly before it.
	pub opens_at: i64,
	/// Timestamp at which the creator irreversibly fixed inventory and supply.
	/// Zero means the treasury is still editable.
	pub locked_at: i64,
	/// Total bundle tickets ever activated. This is the lifetime issuance cap.
	/// It never decreases, never exceeds `u32::MAX`, and equals the fixed box
	/// supply once the treasury is locked.
	pub total_bundles: u64,
	/// Boxes ever minted by `mintTemplateBoxes`; burns do not reduce it. Must
	/// equal `total_bundles` before the treasury can lock.
	pub total_minted: u64,
	/// Undrawn tickets across all activated bundles, equal to the sum of
	/// `remaining`. Activation adds a bundle's quantity; each allocation
	/// removes one.
	pub remaining_bundles: u64,
	/// Burned boxes awaiting allocation or forfeiture. A request adds one; an
	/// allocation or forfeiture removes one.
	pub pending_openings: u64,
	/// Sequence assigned to the next opening request; increments per request.
	pub next_request: u64,
	/// Sequence of the FIFO head. Allocation and forfeiture accept only the
	/// opening with this sequence, then increment it.
	pub next_allocation: u64,
	/// Increments after every activated append; snapshotted by each opening.
	pub revision: u64,
	/// Incremental commitment to every activated bundle in append order.
	pub manifest_accumulator: [u8; 32],
	/// Final treasury commitment. Zero until the treasury is locked.
	/// Copied into every result receipt.
	pub manifest_hash: [u8; 32],
	/// Lamports paid from the creator-funded service vault to the payer of a
	/// successful fulfillment or to the beneficiary of a forfeiture. Zero
	/// disables bounties; retiring an unlocked template resets it to zero.
	pub settlement_bounty_lamports: u64,
	/// Rent prepaid for each optional immutable result receipt at market lock.
	/// Zero when receipts are disabled or the treasury is unlocked.
	pub result_receipt_rent_lamports: u64,
	/// Receipt allocations still covered by the isolated service vault.
	/// Set to `total_bundles` at lock when receipts are enabled.
	pub remaining_result_receipts: u64,
	/// Settlement or forfeiture cranks still covered by the service vault.
	/// Set to `total_bundles` at lock when the bounty is nonzero.
	pub remaining_settlement_bounties: u64,
	/// Null-padded UTF-8 display name; never used for authorization.
	/// Must be nonblank and match the box mint's metadata name at creation.
	pub name: [u8; 32],
	/// Null-padded UTF-8 metadata URI; terms on chain remain authoritative.
	/// Must match the box mint's metadata URI at creation.
	pub uri: [u8; 200],
	/// Number of activated bundles, the length of `remaining`, and the index
	/// of the next bundle PDA. At most 1,024.
	pub bundle_count: u32,
	/// 0 draft, 1 live, 2 retired. `locked_at` independently records the
	/// irreversible market lock so retirement never erases that fact.
	pub status: u8,
	/// Whether allocation creates a permanent result receipt at creator expense.
	/// Retiring an unlocked template clears it because no receipt was funded.
	pub result_receipts_enabled: bool,
	/// Canonical bump of this template PDA.
	pub bump: u8,
	/// Canonical service vault bump, fixed when the treasury is locked.
	/// Zero before the lock.
	pub service_vault_bump: u8,
	/// Undrawn inventory per append-only bundle. Only activated slots occupy
	/// account bytes; slots are never removed because openings snapshot indices.
	pub remaining: Vec<u64, 1024>,
}

fn validate_template_state(state: &TemplateStateRef<'_>) -> ProgramResult {
	let bundle_count =
		usize::try_from(state.bundle_count.get()).map_err(|_| ProgramError::InvalidAccountData)?;
	if state.remaining().len() != bundle_count || state.encoded_len() != state.storage_len() {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	Ok(())
}

/// A complete prize outcome and its escrow authority, shared across all boxes.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(seeds = [SEED_BUNDLE, template: Address, index: u32], bump = bump)]
pub struct BundleState {
	/// Template PDA that owns this bundle and seeds its address.
	pub template: Address,
	/// Copies of this outcome, each one draw ticket. Fixed by `addBundle`; every
	/// slot escrows its per-win amount times this quantity.
	pub quantity: u64,
	/// Lamports the bundle PDA held when `addBundle` created it. SOL claims
	/// and reclaims always leave this reserve in the account.
	pub rent_reserve: u64,
	/// Four asset identifiers; the zero address denotes native SOL.
	/// Slots hold a mint, Core asset, compressed asset ID, `PrizePool` PDA, or
	/// exclusive attachment PDA; unfunded slots stay zeroed.
	pub mints: [u8; 128],
	/// Adapter-specific immutable commitments, one 32-byte value per slot.
	/// Plain escrowed assets leave their commitment zeroed.
	pub commitments: [u8; 128],
	/// Four little-endian base-unit amounts paid per winning bundle.
	/// Native SOL is in lamports; NFTs, badges, and prize pools use one.
	pub amounts: [u8; 32],
	/// Four little-endian counts released through claims or retirement recovery.
	/// A slot's count never exceeds `quantity`.
	pub claimed: [u8; 32],
	/// Prize kind per slot: 0 SOL, 1 SPL token, 2 SPL NFT, 3 Token-2022 token,
	/// 4 Token Metadata NFT, 5 Core asset, 6 compressed NFT, 7 quote SOL,
	/// 8 quote token, 9 mint-on-claim badge, 10 prize pool, 11 exclusive NFT.
	/// Slots at or beyond `funded_assets` are unfunded unless reserved.
	pub kinds: [u8; 4],
	/// Mint decimals per slot: 9 for native SOL and 0 for unique assets.
	pub decimals: [u8; 4],
	/// Template `revision` assigned by `activateBundle`; zero while funding.
	/// Allocation rejects the bundle for openings snapshotted before it.
	pub activated_revision: u64,
	/// Append-order position within the template; seeds this PDA.
	pub index: u32,
	/// Declared asset slots, one to four, fixed by `addBundle`.
	pub asset_count: u8,
	/// Slots funded so far; funding fills slots in order at this index. A
	/// prize pool slot counts only once the pool is sealed.
	pub funded_assets: u8,
	/// Bit `i` is set once slot `i`'s undrawn inventory is fully returned to
	/// the creator by a reclaim instruction.
	pub reclaimed_mask: u8,
	/// 0 funding, 1 active.
	pub status: u8,
	/// Canonical bump of this bundle PDA.
	pub bump: u8,
}

/// A burned box, its verified entropy, and independently claimable winning assets.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(seeds = [SEED_TEMPLATE_OPENING, template: Address, randomness: Address], bump = bump)]
pub struct TemplateOpeningState {
	/// Template PDA whose box was burned; seeds this PDA.
	pub template: Address,
	/// Authority that owned and burned the box.
	pub box_authority: Address,
	/// Immutable destination for every prize claim.
	/// Also receives the forfeiture bounty when the opening expires.
	pub beneficiary: Address,
	/// Request payer, which receives the opening and randomness account rent
	/// when `closeTemplateOpening` closes the lifecycle.
	pub rent_refund: Address,
	/// Optional program expected to consume the result receipt.
	/// The zero address means no consumer is bound.
	pub consumer_program: Address,
	/// Consumer-selected correlation key, fixed before randomness is known.
	/// Must be zero when no consumer program is bound.
	pub consumer_context: [u8; 32],
	/// Switchboard randomness account created by the request; seeds this PDA,
	/// which is its authority.
	pub randomness: Address,
	/// FIFO position taken from the template's `next_request`.
	pub sequence: u64,
	/// Switchboard seed slot recorded at commit. Fulfillment must match it, and
	/// forfeiture is allowed 300 slots after it.
	pub seed_slot: u64,
	/// Revealed randomness value persisted by `fulfillTemplateOpen`; zero
	/// until verified. Allocation derives the outcome from it.
	pub entropy: [u8; 32],
	/// Treasury revision and bundle prefix fixed before the box is burned.
	/// Allocation rejects bundles activated at a later revision.
	pub treasury_revision: u64,
	/// Template `bundle_count` at request time; allocation draws only from
	/// this prefix of bundles.
	pub eligible_bundle_count: u32,
	/// 0 committed, 1 verified, 2 allocated, 3 delivered, 4 forfeited.
	pub status: u8,
	/// Index of the bundle won, set by allocation.
	pub selected_bundle: u32,
	/// Local item index reserved from a prize pool during allocation.
	pub selected_pool_item: u32,
	/// Manifest slot containing the prize pool when `has_pool_assignment` is set.
	pub selected_pool_asset: u8,
	/// Whether allocation reserved a prize pool item for this opening.
	pub has_pool_assignment: bool,
	/// Bit `i` is set once asset slot `i` is claimed. The opening becomes
	/// delivered when every slot of the selected bundle is set.
	pub claimed_mask: u8,
	/// Canonical bump of this opening PDA.
	pub bump: u8,
}

/// Optional immutable allocation result for consumption by another program.
///
/// No instruction mutates or closes this account after initialization.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(seeds = [SEED_RESULT_RECEIPT, opening: Address, sequence: u64], bump = bump)]
pub struct ResultReceiptState {
	/// Template PDA that allocated the result.
	pub template: Address,
	/// Opening PDA this receipt records; seeds this PDA.
	pub opening: Address,
	/// Authority that burned the box, copied from the opening.
	pub box_authority: Address,
	/// Bound prize destination, copied from the opening.
	pub beneficiary: Address,
	/// Consumer program bound at request time; the zero address means none.
	pub consumer_program: Address,
	/// Consumer correlation key bound at request time.
	pub consumer_context: [u8; 32],
	/// Template's locked manifest hash at allocation.
	pub manifest_hash: [u8; 32],
	/// Switchboard randomness account that supplied the entropy.
	pub randomness: Address,
	/// FIFO sequence of the opening; seeds this PDA.
	pub sequence: u64,
	/// Index of the bundle won.
	pub selected_bundle: u32,
	/// Prize pool item index reserved when `has_pool_assignment` is set.
	pub selected_pool_item: u32,
	/// Bundle slot holding the prize pool when `has_pool_assignment` is set.
	pub selected_pool_asset: u8,
	/// Whether allocation reserved a prize pool item.
	pub has_pool_assignment: bool,
	/// Canonical bump of this receipt PDA.
	pub bump: u8,
}

/// Compact, append-only Bubblegum inventory for one bundle manifest slot.
///
/// The account pays only for deposited bitmap bytes: one byte for every eight
/// items. Per-item PDAs retain deposit snapshots while the sealed accumulator
/// commits the ordered inventory into the parent treasury manifest.
#[account(
	discriminator = LootboxAccountType,
	compact,
	migrations,
	validate(with = validate_prize_pool_state)
)]
#[pda(
	seeds = [SEED_PRIZE_POOL, bundle: Address, asset_index: u8],
	bump = bump
)]
pub struct PrizePoolState {
	/// Template authority that created the pool. Receives item rent when a
	/// winner claims an item.
	pub authority: Address,
	/// Bundle whose asset slot this pool fills; seeds this PDA.
	pub bundle: Address,
	/// Nonzero Bubblegum Merkle tree that holds every deposited leaf.
	pub tree: Address,
	/// Chained hash of every deposited item in pool order. Removing the
	/// unsealed tail restores the previous value; sealing commits it into the
	/// bundle slot.
	pub manifest_accumulator: [u8; 32],
	/// Items the pool must hold before sealing; equals the bundle quantity and
	/// is between one and 4,096.
	pub quantity: u64,
	/// Seal counter mixed into the bundle slot commitment; `sealPrizePool`
	/// increments it from zero.
	pub version: u64,
	/// Items deposited so far, and the pool index of the next item.
	pub deposit_cursor: u32,
	/// Reserved items, including those already claimed by winners.
	pub assigned_count: u32,
	/// Assigned items already delivered to their winners.
	pub claimed_count: u32,
	/// Items returned to the creator from the sealed pool.
	pub reclaimed_count: u32,
	/// Bundle asset slot this pool fills; seeds this PDA.
	pub asset_index: u8,
	/// 0 funding, 1 sealed.
	pub status: u8,
	/// One metadata-admitted item PDA exists at `deposit_cursor`.
	pub has_prepared_item: bool,
	/// Canonical bump of this prize pool PDA.
	pub bump: u8,
	/// A set bit means the item cannot be allocated again.
	/// Holds one bit per deposited item, so its length is `deposit_cursor`
	/// divided by eight, rounded up; allocation and reclaim set bits.
	pub unavailable: Vec<u8, 512>,
}

/// Immutable identity and normalized metadata commitment for one Bubblegum leaf.
///
/// Bubblegum authorities may change verification flags after custody, so claims
/// re-prove the current metadata while pinning every semantic field.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(
	seeds = [SEED_PRIZE_POOL_ITEM, pool: Address, pool_index: u32],
	bump = bump
)]
pub struct PrizePoolItemState {
	/// Prize pool PDA that holds this item; seeds this PDA.
	pub pool: Address,
	/// Bubblegum asset ID derived from the pool's tree and `nonce`.
	pub asset: Address,
	/// Bubblegum leaf data hash admitted at preparation and re-checked on
	/// deposit.
	pub data_hash: [u8; 32],
	/// Bubblegum leaf creator hash admitted at preparation and re-checked on
	/// deposit.
	pub creator_hash: [u8; 32],
	/// Hash of the canonical metadata with only collection and creator
	/// verification flags zeroed; claims and reclaims must reproduce it.
	pub semantic_metadata_hash: [u8; 32],
	/// Restores the append-only accumulator when an unfinished tail is removed.
	pub previous_manifest_accumulator: [u8; 32],
	/// Bubblegum leaf nonce.
	pub nonce: u64,
	/// Leaf index within the Merkle tree.
	pub tree_index: u32,
	/// Position within the pool in deposit order; seeds this PDA.
	pub pool_index: u32,
	/// 0 metadata-admitted, 1 transferred into `PrizePool` custody.
	pub status: u8,
	/// Canonical bump of this item PDA.
	pub bump: u8,
}

fn validate_prize_pool_state(state: &PrizePoolStateRef<'_>) -> ProgramResult {
	let quantity =
		usize::try_from(state.quantity.get()).map_err(|_| ProgramError::InvalidAccountData)?;
	let deposited = usize::try_from(state.deposit_cursor.get())
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let assigned = usize::try_from(state.assigned_count.get())
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let claimed =
		usize::try_from(state.claimed_count.get()).map_err(|_| ProgramError::InvalidAccountData)?;
	let reclaimed = usize::try_from(state.reclaimed_count.get())
		.map_err(|_| ProgramError::InvalidAccountData)?;
	if quantity == 0
		|| quantity > MAX_PRIZE_POOL_ITEMS
		|| deposited > quantity
		|| claimed > assigned
		|| assigned
			.checked_add(reclaimed)
			.ok_or(ProgramError::ArithmeticOverflow)?
			> deposited
		|| state.unavailable().len() != deposited.div_ceil(8)
		|| state.unavailable().len() > MAX_PRIZE_POOL_BITMAP_BYTES
		|| state.encoded_len() != state.storage_len()
		|| state.status > 1
		|| (state.has_prepared_item.get() && (state.status != 0 || deposited >= quantity))
		|| (state.status == 1 && state.has_prepared_item.get())
		|| (state.status == 0 && (assigned != 0 || claimed != 0 || reclaimed != 0))
		|| (state.status == 1 && deposited != quantity)
	{
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}

	let unavailable = state.unavailable();
	let set_bits = (0..deposited)
		.filter(|index| unavailable[index / 8] & (1 << (index % 8)) != 0)
		.count();
	if set_bits != assigned + reclaimed {
		return Err(lootbox_error(LootboxError::InvalidPrizePool));
	}
	if deposited % 8 != 0 {
		let used_mask = (1u8 << (deposited % 8)) - 1;
		if unavailable
			.last()
			.is_some_and(|byte| byte & !used_mask != 0)
		{
			return Err(lootbox_error(LootboxError::InvalidPrizePool));
		}
	}

	Ok(())
}

#[cfg(test)]
mod layout_tests {
	use core::mem::size_of;

	use super::*;

	#[test]
	fn template_layout_charges_only_for_the_activated_prefix() {
		assert_eq!(TemplateState::HEADER_SIZE, 548);
		assert_eq!(TemplateState::MAX_SIZE, 8_740);
		assert_eq!(size_of::<TemplateStateHeader>(), 548);
		assert_eq!(BundleState::SIZE, size_of::<BundleStateZc>());
		assert_eq!(
			TemplateOpeningState::SIZE,
			size_of::<TemplateOpeningStateZc>()
		);
		assert_eq!(ResultReceiptState::SIZE, size_of::<ResultReceiptStateZc>());
		assert_eq!(
			(
				TemplateState::HEADER_SIZE,
				BundleState::SIZE,
				TemplateOpeningState::SIZE,
				ResultReceiptState::SIZE,
			),
			(548, 395, 299, 277),
		);
		assert_eq!(PrizePoolState::HEADER_SIZE, 168);
		assert_eq!(PrizePoolState::MIN_SIZE, 168);
		assert_eq!(PrizePoolState::MAX_SIZE, 680);
		assert_eq!(PrizePoolItemState::SIZE, 212);
		assert_eq!(PrizePoolItemState::SIZE, size_of::<PrizePoolItemStateZc>());
	}

	#[test]
	fn template_rejects_inventory_bytes_not_committed_by_bundle_count() {
		let mut bytes = alloc::vec![0; TemplateState::HEADER_SIZE];
		TemplateState::initialize(&mut bytes, &TemplateStatePatch::new())
			.expect("canonical empty template");
		bytes.extend_from_slice(&u64::MAX.to_le_bytes());

		assert!(
			TemplateState::try_from_bytes(&bytes).is_err(),
			"an aligned tail must not silently create an uncommitted inventory slot",
		);
		assert!(
			<TemplateState as MigratableAccount>::validate_current_migration(&bytes).is_err(),
			"migration validation must reject the same hidden tail",
		);
	}

	#[test]
	fn prize_pool_rejects_bytes_outside_the_committed_bitmap() {
		let mut bytes = alloc::vec![0; PrizePoolState::HEADER_SIZE];
		PrizePoolState::initialize(&mut bytes, &PrizePoolStatePatch::new().quantity(1))
			.expect("canonical empty prize pool");
		bytes.push(0xa5);

		assert!(
			PrizePoolState::try_from_bytes(&bytes).is_err(),
			"an unused byte must not survive outside the committed bitmap",
		);
		assert!(
			<PrizePoolState as MigratableAccount>::validate_current_migration(&bytes).is_err(),
			"migration validation must reject the same hidden byte",
		);
	}

	#[test]
	fn manifest_commits_to_bundle_and_service_terms() {
		let mut bundle_bytes = [0; BundleState::SIZE];
		let bundle = BundleState::initialize(&mut bundle_bytes, |_| Ok(())).expect("bundle");
		bundle.index.set(3);
		bundle.quantity.set(7);
		bundle.asset_count = 1;
		bundle.amounts[..8].copy_from_slice(&42u64.to_le_bytes());
		let first = next_manifest_accumulator(&[0; 32], bundle);
		bundle.amounts[..8].copy_from_slice(&43u64.to_le_bytes());
		assert_ne!(first, next_manifest_accumulator(&[0; 32], bundle));
		bundle.amounts[..8].copy_from_slice(&42u64.to_le_bytes());
		bundle.commitments[..32].copy_from_slice(&[7; 32]);
		assert_ne!(first, next_manifest_accumulator(&[0; 32], bundle));

		let mut template = initialized_template_header(&TemplateStatePatch::new());
		template.total_bundles.set(7);
		template.bundle_count.set(1);
		template.manifest_accumulator = first;
		let address = Address::new_from_array([9; 32]);
		let without_receipts = locked_manifest_hash(&address, &template);
		template.result_receipts_enabled.set(true);
		assert_ne!(without_receipts, locked_manifest_hash(&address, &template));
	}

	#[test]
	fn compact_prize_pool_rejects_counter_and_bitmap_drift() {
		let bitmap = [0b0000_0001, 0];
		let mut bytes = [0; PrizePoolState::MAX_SIZE];
		let encoded = PrizePoolState::initialize(
			&mut bytes,
			&PrizePoolStatePatch::new()
				.quantity(9)
				.deposit_cursor(9)
				.assigned_count(1)
				.status(1)
				.replace_unavailable(&bitmap),
		)
		.expect("valid sealed pool");
		assert_eq!(encoded, PrizePoolState::HEADER_SIZE + 2);

		let wrong_count = PrizePoolState::initialize(
			&mut bytes,
			&PrizePoolStatePatch::new()
				.quantity(9)
				.deposit_cursor(9)
				.assigned_count(2)
				.status(1)
				.replace_unavailable(&bitmap),
		);
		assert_eq!(
			wrong_count,
			Err(lootbox_error(LootboxError::InvalidPrizePool))
		);

		let invalid_padding = [0, 0b1000_0000];
		let padding = PrizePoolState::initialize(
			&mut bytes,
			&PrizePoolStatePatch::new()
				.quantity(9)
				.deposit_cursor(9)
				.assigned_count(1)
				.status(1)
				.replace_unavailable(&invalid_padding),
		);
		assert_eq!(padding, Err(lootbox_error(LootboxError::InvalidPrizePool)));

		let empty_bitmap = [0];
		for invalid_prepared in [
			PrizePoolStatePatch::new()
				.quantity(1)
				.deposit_cursor(1)
				.has_prepared_item(true)
				.replace_unavailable(&empty_bitmap),
			PrizePoolStatePatch::new()
				.quantity(1)
				.deposit_cursor(1)
				.status(1)
				.has_prepared_item(true)
				.replace_unavailable(&empty_bitmap),
		] {
			assert_eq!(
				PrizePoolState::initialize(&mut bytes, &invalid_prepared),
				Err(lootbox_error(LootboxError::InvalidPrizePool)),
			);
		}
	}
}

fn template_size(bundle_count: usize) -> Result<usize, ProgramError> {
	if bundle_count > MAX_TEMPLATE_BUNDLES {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	TemplateState::HEADER_SIZE
		.checked_add(
			bundle_count
				.checked_mul(size_of::<PodU64>())
				.ok_or(ProgramError::ArithmeticOverflow)?,
		)
		.ok_or(ProgramError::ArithmeticOverflow)
}

#[cfg(test)]
fn initialized_template_header(patch: &TemplateStatePatch<'_>) -> TemplateStateHeader {
	let mut bytes = [0; TemplateState::MIN_SIZE];
	TemplateState::initialize(&mut bytes, patch).expect("template");
	let state = TemplateState::try_from_bytes(&bytes).expect("template");

	*state
}

#[cfg(kani)]
mod proofs {
	use super::*;

	#[kani::proof]
	fn compact_template_size_matches_the_activated_prefix() {
		let bundle_count = kani::any::<u32>() as usize;
		let result = template_size(bundle_count);

		if bundle_count <= MAX_TEMPLATE_BUNDLES {
			let expected = TemplateState::HEADER_SIZE + bundle_count * size_of::<PodU64>();

			assert_eq!(result, Ok(expected));
			assert!(expected <= TemplateState::MAX_SIZE);
		} else {
			assert!(result.is_err());
		}
	}
}

/// Creates a draft treasury template PDA bound to an empty Token-2022 box mint.
///
/// The creator signs and pays rent. The box mint must have zero supply and
/// decimals, no freeze authority, this template PDA as mint authority, and
/// immutable on-mint metadata whose name and URI match the arguments.
#[instruction(discriminator = LootboxInstruction::CreateTemplate, migrations)]
pub struct CreateTemplateInstruction {
	/// Creator-chosen identifier that seeds the template PDA beside the
	/// authority.
	pub id: u64,
	/// Reveal time in unix seconds; rejected when negative.
	pub opens_at: i64,
	/// Switchboard On-Demand program; must be the mainnet or devnet ID.
	pub oracle_program: Address,
	/// Switchboard queue for every opening's randomness; must be nonzero.
	pub oracle_queue: Address,
	/// Null-padded UTF-8 display name; must be nonblank, free of control
	/// characters, and equal to the box mint's metadata name.
	pub name: [u8; 32],
	/// Null-padded UTF-8 metadata URI; may be empty, must be free of control
	/// characters, and must equal the box mint's metadata URI.
	pub uri: [u8; 200],
	/// Lamports paid per fulfilled or forfeited opening from the service
	/// vault; zero disables bounties.
	pub settlement_bounty_lamports: u64,
	/// Whether each allocation creates a creator-funded result receipt.
	pub result_receipts_enabled: bool,
	/// Canonical bump of the template PDA; rejected unless it equals the
	/// derived canonical bump.
	pub bump: u8,
}

/// Stages a new funding bundle at the template's next bundle index.
///
/// The template authority signs and pays rent. The treasury must be unlocked
/// and not retired, and at most one staged bundle can exist because its PDA
/// index is the activated bundle count.
#[instruction(discriminator = LootboxInstruction::AddBundle, migrations)]
pub struct AddBundleInstruction {
	/// Copies of this outcome, each one draw ticket; must be positive.
	pub quantity: u64,
	/// Asset slots the bundle will hold; must be between one and four.
	pub asset_count: u8,
	/// Canonical bump of the bundle PDA; rejected unless it equals the derived
	/// canonical bump.
	pub bump: u8,
}

/// Escrows native SOL in the next slot of a funding bundle.
///
/// The template authority signs and transfers `lamports_per_win` times the
/// bundle quantity to the bundle PDA. The treasury must be unlocked and not
/// retired.
#[instruction(discriminator = LootboxInstruction::FundSolPrize, migrations)]
pub struct FundSolPrizeInstruction {
	/// Lamports delivered per win; must be positive.
	pub lamports_per_win: u64,
}

/// Escrows an SPL Token or Token-2022 prize in the next slot of a funding
/// bundle.
///
/// The template authority signs the transfer of the per-win amount times the
/// bundle quantity into the bundle's associated token account. The treasury
/// must be unlocked and not retired, and the escrow must end with exactly that
/// increase.
#[instruction(discriminator = LootboxInstruction::FundTokenPrize, migrations)]
pub struct FundTokenPrizeInstruction {
	/// Base units delivered per win; must be positive. A transfer-fee mint
	/// charges the funder the gross amount so escrow nets this total.
	pub amount_per_win: u64,
	/// Records a classic SPL NFT: requires SPL Token, supply one, zero decimals,
	/// revoked mint authority, and a one-copy bundle paying one unit.
	pub is_nft: bool,
}

/// Escrows winner-routable native SOL in the next slot of a funding bundle.
///
/// The template authority signs and transfers `lamports_per_win` times the
/// bundle quantity to the bundle PDA. The treasury must be unlocked and not
/// retired.
#[instruction(discriminator = LootboxInstruction::FundQuoteSolPrize, migrations)]
pub struct FundQuoteSolPrizeInstruction {
	/// Lamports delivered per win; must be positive.
	pub lamports_per_win: u64,
}

/// Escrows a winner-routable token quote in the next slot of a funding bundle.
///
/// The template authority signs the transfer of the per-win amount times the
/// bundle quantity into the bundle's associated token account. The mint may
/// carry only metadata extensions and no freeze authority.
#[instruction(discriminator = LootboxInstruction::FundQuoteTokenPrize, migrations)]
pub struct FundQuoteTokenPrizeInstruction {
	/// Base units delivered per win; must be positive.
	pub amount_per_win: u64,
}

/// Hands an empty badge mint's authority to a funding bundle for mint-on-claim
/// delivery.
///
/// The template authority, which must be the mint's current mint authority,
/// signs. The mint needs zero supply and decimals, no freeze authority, and
/// immutable metadata if any. Mint authority moves to the bundle PDA and one
/// badge is recorded per win.
#[instruction(discriminator = LootboxInstruction::FundMintPrize, migrations)]
pub struct FundMintPrizeInstruction {}

/// Publishes a draft template as live.
///
/// The template authority signs, and at least one bundle must be activated.
#[instruction(discriminator = LootboxInstruction::SealTemplate, migrations)]
pub struct SealTemplateInstruction {}

/// Irreversibly fixes a live template's box supply to its activated inventory.
///
/// The template authority signs before `opens_at`. Inventory must be pristine,
/// with every activated ticket minted and no staged tail. It funds the service
/// vault when receipts or bounties are enabled, revokes box mint authority, and
/// records the manifest hash.
#[instruction(discriminator = LootboxInstruction::LockTreasury, migrations)]
pub struct LockTreasuryInstruction {
	/// Canonical bump of the service vault PDA; rejected unless it equals the
	/// derived canonical bump, then stored on the template.
	pub service_vault_bump: u8,
}

/// Mints boxes to any Token-2022 associated token account before the market
/// lock.
///
/// The template authority signs, and the template must be live, unlocked, and
/// not retired. Lifetime mints may not exceed activated tickets, and box supply
/// plus pending openings may not exceed undrawn tickets.
#[instruction(discriminator = LootboxInstruction::MintTemplateBoxes, migrations)]
pub struct MintTemplateBoxesInstruction {
	/// Boxes to mint; must be positive.
	pub amount: u64,
}

/// Appends a fully funded staged bundle to the template's live inventory.
///
/// The template authority signs and pays rent for one more eight-byte inventory
/// slot. The treasury must be unlocked and not retired. It increments the
/// revision, extends the manifest accumulator, and adds the bundle's copies to
/// mint capacity.
#[instruction(discriminator = LootboxInstruction::ActivateBundle, migrations)]
pub struct ActivateBundleInstruction {}

/// Closes the staged tail bundle once it is unfunded or fully reclaimed.
///
/// The template authority signs and receives the bundle's rent. The treasury
/// must be unlocked, though a retired template is allowed. No slot may be
/// reserved or hold a prize pool.
#[instruction(discriminator = LootboxInstruction::CancelBundle, migrations)]
pub struct CancelBundleInstruction {}

/// Accounts for `createTemplate`.
#[derive(Accounts, Debug)]
pub struct CreateTemplateAccounts<'a> {
	/// Creator; signs, pays the template rent, and becomes its authority.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template PDA created here from `["template", authority, id]`; must be
	/// empty.
	#[pina(validate(empty))]
	pub template: &'a mut AccountView,
	/// Empty Token-2022 box mint whose mint authority is the template PDA and
	/// whose metadata pointer and immutable metadata point at itself.
	pub box_mint: &'a AccountView,
	/// System program, invoked to create the template account.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// Token-2022 program that must own the box mint.
	#[pina(validate(address = token_2022::ID))]
	pub box_token_program: &'a AccountView,
}

/// Accounts for `addBundle`.
#[derive(Accounts, Debug)]
pub struct AddBundleAccounts<'a> {
	/// Template authority; signs and pays the bundle rent.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template PDA that must be unlocked and not retired; read only by the
	/// handler.
	pub template: &'a mut AccountView,
	/// Bundle PDA created here from `["bundle", template, bundle_count]`; must
	/// be empty.
	#[pina(validate(empty))]
	pub bundle: &'a mut AccountView,
	/// System program, invoked to create the bundle account.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

/// Accounts for `fundSolPrize`.
#[derive(Accounts, Debug)]
pub struct FundSolPrizeAccounts<'a> {
	/// Template authority; signs and pays the escrowed lamports.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template PDA that must be unlocked and not retired; read only by the
	/// handler.
	pub template: &'a mut AccountView,
	/// Funding bundle PDA of this template that receives the lamports.
	pub bundle: &'a mut AccountView,
	/// System program, invoked for the lamport transfer.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

/// Accounts for `fundTokenPrize`.
#[derive(Accounts, Debug)]
pub struct FundTokenPrizeAccounts<'a> {
	/// Template authority; signs the token transfer from `source`.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Template PDA that must be unlocked and not retired; read only by the
	/// handler.
	pub template: &'a mut AccountView,
	/// Funding bundle PDA of this template that records the prize.
	pub bundle: &'a mut AccountView,
	/// Prize mint owned by `token_program`; not wrapped SOL. Classic mints need
	/// no freeze authority; Token-2022 mints must pass the prize allowlist.
	pub mint: &'a AccountView,
	/// Token account debited for the deposit, including any transfer fee.
	pub source: &'a mut AccountView,
	/// Bundle's associated token account for `mint`; must have no delegate or
	/// close authority and must not be frozen.
	pub escrow: &'a mut AccountView,
	/// SPL Token or Token-2022 program that owns `mint`, invoked for the
	/// transfer.
	pub token_program: &'a AccountView,
}

/// Accounts for `fundQuoteSolPrize`.
#[derive(Accounts, Debug)]
pub struct FundQuoteSolPrizeAccounts<'a> {
	/// Template authority; signs and pays the escrowed lamports.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template PDA that must be unlocked and not retired; read only by the
	/// handler.
	pub template: &'a mut AccountView,
	/// Funding bundle PDA of this template that receives the lamports.
	pub bundle: &'a mut AccountView,
	/// System program, invoked for the lamport transfer.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

/// Accounts for `fundQuoteTokenPrize`.
#[derive(Accounts, Debug)]
pub struct FundQuoteTokenPrizeAccounts<'a> {
	/// Template authority; signs the token transfer from `source`.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Template PDA that must be unlocked and not retired; read only by the
	/// handler.
	pub template: &'a mut AccountView,
	/// Funding bundle PDA of this template that records the quote.
	pub bundle: &'a mut AccountView,
	/// Quote mint owned by `token_program` with only metadata extensions, no
	/// freeze authority, and not wrapped SOL.
	pub mint: &'a AccountView,
	/// Token account debited for the deposit.
	pub source: &'a mut AccountView,
	/// Bundle's associated token account for `mint`; must have no delegate or
	/// close authority and must not be frozen.
	pub escrow: &'a mut AccountView,
	/// SPL Token or Token-2022 program that owns `mint`, invoked for the
	/// transfer.
	pub token_program: &'a AccountView,
}

/// Accounts for `fundMintPrize`.
#[derive(Accounts, Debug)]
pub struct FundMintPrizeAccounts<'a> {
	/// Template authority and current mint authority of `mint`; signs the
	/// authority handoff.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Template PDA that must be unlocked and not retired; read only by the
	/// handler.
	pub template: &'a mut AccountView,
	/// Funding bundle PDA of this template that becomes the mint authority.
	pub bundle: &'a mut AccountView,
	/// Empty zero-decimal badge mint with no freeze authority; its mint
	/// authority changes here.
	pub mint: &'a mut AccountView,
	/// SPL Token or Token-2022 program that owns `mint`, invoked to set the
	/// authority.
	pub token_program: &'a AccountView,
}

/// Accounts for `sealTemplate`.
#[derive(Accounts, Debug)]
pub struct SealTemplateAccounts<'a> {
	/// Template authority; signs.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Draft template PDA whose status becomes live.
	pub template: &'a mut AccountView,
}

/// Accounts for `lockTreasury`.
#[derive(Accounts, Debug)]
pub struct LockTreasuryAccounts<'a> {
	/// Template authority; signs and pays any service vault top-up.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Live, unlocked template PDA; signs the mint authority revocation and
	/// records the lock.
	pub template: &'a mut AccountView,
	/// Template's box mint, whose supply must equal the activated tickets; its
	/// mint authority is revoked here.
	pub box_mint: &'a mut AccountView,
	/// The first unused bundle PDA proves that no funded tail was omitted.
	/// It must be the canonical PDA at `bundle_count` and hold no data.
	#[pina(validate(empty))]
	pub bundle: &'a AccountView,
	/// Creator-funded only when receipts or crank bounties are enabled.
	/// Unsolicited lamports are accepted and reduce the required top-up.
	/// Canonical PDA from `["service-vault", template]`.
	#[pina(validate(empty))]
	pub service_vault: &'a mut AccountView,
	/// System program, invoked for the service vault top-up.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	/// Token-2022 program, invoked to revoke the box mint authority.
	#[pina(validate(address = token_2022::ID))]
	pub box_token_program: &'a AccountView,
}

/// Accounts for `mintTemplateBoxes`.
#[derive(Accounts, Debug)]
pub struct MintTemplateBoxesAccounts<'a> {
	/// Template authority; signs.
	#[pina(validate(signer))]
	pub authority: &'a AccountView,
	/// Live, unlocked template PDA; records the new lifetime mint total and
	/// signs as mint authority.
	pub template: &'a mut AccountView,
	/// Template's box mint.
	pub box_mint: &'a mut AccountView,
	/// Token-2022 associated token account of its owner for the box mint;
	/// receives the new boxes.
	pub recipient_box_account: &'a mut AccountView,
	/// Token-2022 program, invoked to mint the boxes.
	pub box_token_program: &'a AccountView,
}

/// Accounts for `activateBundle`.
#[derive(Accounts, Debug)]
pub struct ActivateBundleAccounts<'a> {
	/// Template authority; signs and pays rent for the template's larger size.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Template PDA that must be unlocked and not retired; grows by one
	/// inventory slot here.
	pub template: &'a mut AccountView,
	/// Fully funded staged bundle PDA at index `bundle_count`; becomes active.
	pub bundle: &'a mut AccountView,
	/// System program, invoked to fund the template's rent increase.
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
}

/// Accounts for `cancelBundle`.
#[derive(Accounts, Debug)]
pub struct CancelBundleAccounts<'a> {
	/// Template authority; signs and receives the closed bundle's rent.
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// Unlocked template PDA, which may be retired.
	pub template: &'a AccountView,
	/// Staged bundle PDA at index `bundle_count`; closed here.
	pub bundle: &'a mut AccountView,
}

fn as_template(account: &AccountView) -> Result<TemplateStateHeader, ProgramError> {
	account.assert_owner(&ID)?;
	let data = account.try_borrow()?;
	let state = TemplateState::try_from_bytes(&data)?;

	Ok(*state)
}

fn update_template(account: &mut AccountView, patch: &TemplateStatePatch<'_>) -> ProgramResult {
	account.assert_owner(&ID)?.assert_writable()?;
	let mut data = account.try_borrow_mut()?;
	TemplateState::update(&mut data, patch)?;

	Ok(())
}

fn assert_template(address: &Address, state: &TemplateStateHeader) -> ProgramResult {
	let seeds = TemplateState::seeds(&state.authority, state.id.get()).with_bump(state.bump);

	if *address != create_program_address(&seeds.as_slices(), &ID)? {
		return Err(ProgramError::InvalidSeeds);
	}

	Ok(())
}

fn assert_bundle(account: &AccountView, template: &Address) -> ProgramResult {
	let bundle = account.as_account::<BundleState>(&ID)?;

	if bundle.template != *template {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	let seeds = BundleState::seeds(template, bundle.index.get()).with_bump(bundle.bump);
	account.assert_seeds_with_bump(&seeds.as_slices(), &ID)?;

	Ok(())
}

fn has_service_vault(state: &TemplateStateHeader) -> bool {
	state.result_receipts_enabled.get() || state.settlement_bounty_lamports.get() != 0
}

fn assert_service_vault(
	account: &AccountView,
	template: &Address,
	state: &TemplateStateHeader,
) -> ProgramResult {
	if !has_service_vault(state) {
		return Ok(());
	}

	let bump = [state.service_vault_bump];
	let seeds = [SEED_SERVICE_VAULT, template.as_ref(), bump.as_slice()];
	account.assert_seeds_with_bump(&seeds, &ID)?;
	if account.owner() != &system::ID || !account.is_data_empty() {
		return Err(lootbox_error(LootboxError::InvalidServiceAccount));
	}

	Ok(())
}

fn required_service_balance(state: &TemplateStateHeader) -> Result<u64, ProgramError> {
	let receipts = state
		.result_receipt_rent_lamports
		.get()
		.checked_mul(state.remaining_result_receipts.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let bounties = state
		.settlement_bounty_lamports
		.get()
		.checked_mul(state.remaining_settlement_bounties.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;

	receipts
		.checked_add(bounties)
		.ok_or(ProgramError::ArithmeticOverflow)
}

fn assert_template_authority(
	authority: &AccountView,
	state: &TemplateStateHeader,
) -> ProgramResult {
	authority.assert_signer()?;
	assert_authority_address(authority, &state.authority)
}

fn assert_treasury_unlocked(state: &TemplateStateHeader) -> ProgramResult {
	if state.locked_at.get() != 0 {
		return Err(lootbox_error(LootboxError::TreasuryLocked));
	}

	Ok(())
}

fn assert_treasury_editable(state: &TemplateStateHeader) -> ProgramResult {
	assert_treasury_unlocked(state)?;

	if state.status == TEMPLATE_RETIRED {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	Ok(())
}

fn read_slot<const N: usize>(slots: &[u8; N], index: usize) -> Result<u64, ProgramError> {
	let start = index
		.checked_mul(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let end = start
		.checked_add(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let bytes = slots
		.get(start..end)
		.ok_or(ProgramError::InvalidAccountData)?;

	Ok(u64::from_le_bytes(
		bytes
			.try_into()
			.map_err(|_| ProgramError::InvalidAccountData)?,
	))
}

fn write_slot<const N: usize>(slots: &mut [u8; N], index: usize, value: u64) -> ProgramResult {
	let start = index
		.checked_mul(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let end = start
		.checked_add(8)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	slots
		.get_mut(start..end)
		.ok_or(ProgramError::InvalidAccountData)?
		.copy_from_slice(&value.to_le_bytes());

	Ok(())
}

fn next_manifest_accumulator(previous: &[u8; 32], bundle: &BundleStateZc) -> [u8; 32] {
	let index = bundle.index.get().to_le_bytes();
	let quantity = bundle.quantity.get().to_le_bytes();
	let asset_count = [bundle.asset_count];
	let digest = hashv(&[
		MANIFEST_BUNDLE_DOMAIN,
		previous,
		&index,
		&quantity,
		&asset_count,
		&bundle.mints,
		&bundle.commitments,
		&bundle.amounts,
		&bundle.kinds,
		&bundle.decimals,
	]);
	let mut result = [0u8; 32];
	result.copy_from_slice(digest.as_ref());

	result
}

fn locked_manifest_hash(template: &Address, state: &TemplateStateHeader) -> [u8; 32] {
	let id = state.id.get().to_le_bytes();
	let opens_at = state.opens_at.get().to_le_bytes();
	let total_bundles = state.total_bundles.get().to_le_bytes();
	let bundle_count = state.bundle_count.get().to_le_bytes();
	let settlement_bounty = state.settlement_bounty_lamports.get().to_le_bytes();
	let result_receipts_enabled = [u8::from(state.result_receipts_enabled.get())];
	let digest = hashv(&[
		MANIFEST_DOMAIN,
		template.as_ref(),
		state.authority.as_ref(),
		state.box_mint.as_ref(),
		state.oracle_program.as_ref(),
		state.oracle_queue.as_ref(),
		&id,
		&opens_at,
		&total_bundles,
		&bundle_count,
		&settlement_bounty,
		&result_receipts_enabled,
		&state.manifest_accumulator,
	]);
	let mut result = [0u8; 32];
	result.copy_from_slice(digest.as_ref());

	result
}

fn mint_at(bundle: &BundleStateZc, index: usize) -> Result<Address, ProgramError> {
	if index >= MAX_PRIZE_ASSETS {
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	parse_address(&bundle.mints, index * 32)
}

fn available_in_prefix(state: &TemplateStateRef<'_>, count: u32) -> Result<u64, ProgramError> {
	let count = usize::try_from(count).map_err(|_| ProgramError::InvalidAccountData)?;
	if count > MAX_TEMPLATE_BUNDLES {
		return Err(ProgramError::InvalidAccountData);
	}

	let remaining = state.remaining();
	if count > remaining.len() {
		return Err(ProgramError::InvalidAccountData);
	}

	remaining[..count].iter().try_fold(0u64, |total, value| {
		total
			.checked_add(value.get())
			.ok_or(ProgramError::ArithmeticOverflow)
	})
}

fn remaining_at(state: &TemplateStateRef<'_>, index: usize) -> Result<u64, ProgramError> {
	state
		.remaining()
		.get(index)
		.map(PodU64::get)
		.ok_or(ProgramError::InvalidAccountData)
}

fn assert_template_mint(
	mint: &AccountView,
	template: &Address,
	expected: &Address,
	is_locked: bool,
) -> Result<u64, ProgramError> {
	mint.assert_address(expected)?;
	let data = mint
		.as_token_mint_for_program(&token_2022::ID)?
		.assert_extensions_allowed(&[
			token_2022::state::ExtensionType::MetadataPointer,
			token_2022::state::ExtensionType::TokenMetadata,
		])?;

	let expected_authority = if is_locked { None } else { Some(template) };

	if data.decimals() != 0
		|| data.mint_authority() != expected_authority
		|| data.freeze_authority().is_some()
	{
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	// Use the standard on-mint metadata interface, not a pointer to a proprietary
	// account layout that wallets cannot decode.
	let extension = data
		.token_2022()
		.ok_or(ProgramError::InvalidAccountData)?
		.get_extension::<token_2022::state::MetadataPointerExtension>()?;
	if extension.authority.as_ref().is_some()
		|| extension.metadata_address.as_ref() != Some(expected)
	{
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	Ok(data.supply())
}

fn metadata_bytes(data: &[u8]) -> Result<&[u8], ProgramError> {
	find_metadata_bytes(data)?.ok_or(lootbox_error(LootboxError::InvalidMint))
}

/// Return the on-mint Token-2022 metadata payload when the mint carries one.
fn find_metadata_bytes(data: &[u8]) -> Result<Option<&[u8]>, ProgramError> {
	// Token-2022 extended mints pad the base to 165 bytes, followed by the
	// account-type byte and (u16 type, u16 length, value) TLV entries. A
	// shorter account is a plain mint with no extensions at all.
	let Some(mut entries) = data.get(166..) else {
		return Ok(None);
	};
	// The mint allowlist permits only MetadataPointer and TokenMetadata.
	for _ in 0..2 {
		if entries.len() < 4 {
			break;
		}
		let kind = u16::from_le_bytes([entries[0], entries[1]]);
		let length = usize::from(u16::from_le_bytes([entries[2], entries[3]]));
		let value = entries
			.get(4..4 + length)
			.ok_or(ProgramError::InvalidAccountData)?;
		if kind == token_2022::state::ExtensionType::TokenMetadata as u16 {
			return Ok(Some(value));
		}
		entries = entries
			.get(4 + length..)
			.ok_or(ProgramError::InvalidAccountData)?;
	}

	Ok(None)
}

fn take_metadata_string<'a>(data: &mut &'a [u8]) -> Result<&'a [u8], ProgramError> {
	let prefix: [u8; 4] = data
		.get(..4)
		.ok_or(ProgramError::InvalidAccountData)?
		.try_into()
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let length = usize::try_from(u32::from_le_bytes(prefix))
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let end = 4usize
		.checked_add(length)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let value = data.get(4..end).ok_or(ProgramError::InvalidAccountData)?;
	*data = data.get(end..).ok_or(ProgramError::InvalidAccountData)?;

	Ok(value)
}

fn assert_metadata(mint: &AccountView, name: &[u8; 32], uri: &[u8; 200]) -> ProgramResult {
	let data = mint.try_borrow()?;
	let metadata = metadata_bytes(&data)?;
	if metadata.get(..32) != Some([0u8; 32].as_slice())
		|| parse_address(metadata, 32)? != *mint.address()
	{
		return Err(lootbox_error(LootboxError::InvalidMint));
	}
	let mut strings = metadata.get(64..).ok_or(ProgramError::InvalidAccountData)?;
	let metadata_name = take_metadata_string(&mut strings)?;
	let _symbol = take_metadata_string(&mut strings)?;
	let metadata_uri = take_metadata_string(&mut strings)?;
	let name_length = name
		.iter()
		.position(|byte| *byte == 0)
		.unwrap_or(name.len());
	let uri_length = uri.iter().position(|byte| *byte == 0).unwrap_or(uri.len());

	if metadata_name != &name[..name_length] || metadata_uri != &uri[..uri_length] {
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	Ok(())
}

fn validate_text<const N: usize>(text: &[u8; N], required: bool) -> ProgramResult {
	let length = text.iter().position(|byte| *byte == 0).unwrap_or(N);
	let value = core::str::from_utf8(&text[..length]).map_err(|_| ProgramError::InvalidArgument)?;

	if (required && value.trim().is_empty())
		|| text[length..].iter().any(|byte| *byte != 0)
		|| value.chars().any(char::is_control)
	{
		return Err(ProgramError::InvalidArgument);
	}

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for CreateTemplateAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = CreateTemplateInstruction::try_from_bytes(data)?;
		assert_known_oracle_program(&args.oracle_program)?;
		validate_text(&args.name, true)?;
		validate_text(&args.uri, false)?;

		if args.opens_at.get() < 0 || args.oracle_queue == Address::default() {
			return Err(ProgramError::InvalidArgument);
		}

		let seeds = TemplateState::seeds(self.authority.address(), args.id.get());
		if self
			.template
			.assert_canonical_bump(&seeds.as_slices(), &ID)?
			!= args.bump
		{
			return Err(ProgramError::InvalidSeeds);
		}

		if assert_template_mint(
			self.box_mint,
			self.template.address(),
			self.box_mint.address(),
			false,
		)? != 0
		{
			return Err(lootbox_error(LootboxError::InvalidMint));
		}
		assert_metadata(self.box_mint, &args.name, &args.uri)?;

		CreateCompactProgramAccountWithBump {
			account: self.template,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
			patch: TemplateStatePatch::new()
				.authority(*self.authority.address())
				.box_mint(*self.box_mint.address())
				.oracle_program(args.oracle_program)
				.oracle_queue(args.oracle_queue)
				.id(args.id.get())
				.opens_at(args.opens_at.get())
				.name(args.name)
				.uri(args.uri)
				.settlement_bounty_lamports(args.settlement_bounty_lamports.get())
				.result_receipts_enabled(args.result_receipts_enabled.get())
				.status(TEMPLATE_DRAFT)
				.bump(args.bump),
			space: TemplateState::MIN_SIZE,
		}
		.invoke::<TemplateState>()?;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for AddBundleAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = AddBundleInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;

		if usize::try_from(state.bundle_count.get())
			.map_err(|_| ProgramError::InvalidAccountData)?
			>= MAX_TEMPLATE_BUNDLES
			|| args.asset_count == 0
			|| usize::from(args.asset_count) > MAX_PRIZE_ASSETS
			|| args.quantity.get() == 0
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let index = state.bundle_count.get();
		let seeds = BundleState::seeds(&template_address, index);
		if self.bundle.assert_canonical_bump(&seeds.as_slices(), &ID)? != args.bump {
			return Err(ProgramError::InvalidSeeds);
		}

		CreateProgramAccountWithBump {
			account: self.bundle,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<BundleState>()?;
		let rent = self.bundle.lamports();
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		bundle.template = template_address;
		bundle.quantity.set(args.quantity.get());
		bundle.rent_reserve.set(rent);
		bundle.index.set(index);
		bundle.asset_count = args.asset_count;
		bundle.status = BUNDLE_FUNDING;
		bundle.bump = args.bump;

		Ok(())
	}
}

fn record_prize(
	bundle: &mut BundleStateZc,
	mint: &Address,
	amount: u64,
	kind: u8,
	decimals: u8,
) -> Result<u64, ProgramError> {
	let index = usize::from(bundle.funded_assets);
	if index >= usize::from(bundle.asset_count)
		|| amount == 0
		|| bundle.kinds[index] != 0
		|| mint_at(bundle, index)? != Address::default()
		|| bundle.commitments[index * 32..(index + 1) * 32] != [0; 32]
		|| read_slot(&bundle.amounts, index)? != 0
		|| bundle.decimals[index] != 0
	{
		return Err(lootbox_error(LootboxError::InvalidPrize));
	}

	for previous in 0..index {
		if mint_at(bundle, previous)? == *mint {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
	}

	let deposit = amount
		.checked_mul(bundle.quantity.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	bundle.mints[index * 32..(index + 1) * 32].copy_from_slice(mint.as_ref());
	write_slot(&mut bundle.amounts, index, amount)?;
	bundle.kinds[index] = kind;
	bundle.decimals[index] = decimals;
	bundle.funded_assets = bundle
		.funded_assets
		.checked_add(1)
		.ok_or(ProgramError::ArithmeticOverflow)?;

	Ok(deposit)
}

fn has_released_assets(bundle: &BundleStateZc) -> Result<bool, ProgramError> {
	for index in 0..usize::from(bundle.funded_assets) {
		if read_slot(&bundle.claimed, index)? != 0 {
			return Ok(true);
		}
	}

	Ok(false)
}

fn has_reserved_slot(bundle: &BundleStateZc) -> Result<bool, ProgramError> {
	let funded = usize::from(bundle.funded_assets);
	Ok(funded < usize::from(bundle.asset_count)
		&& (bundle.kinds[funded] != 0
			|| mint_at(bundle, funded)? != Address::default()
			|| bundle.commitments[funded * 32..(funded + 1) * 32] != [0; 32]
			|| read_slot(&bundle.amounts, funded)? != 0
			|| bundle.decimals[funded] != 0))
}

impl<'a> ProcessAccountInfos<'a> for FundSolPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundSolPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		let deposit = record_prize(
			&mut bundle,
			&Address::default(),
			args.lamports_per_win.get(),
			PRIZE_SOL,
			9,
		)?;
		drop(bundle);

		system::instructions::Transfer {
			from: self.authority,
			to: self.bundle,
			lamports: deposit,
		}
		.invoke()
	}
}

impl<'a> ProcessAccountInfos<'a> for FundQuoteSolPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundQuoteSolPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		let deposit = record_prize(
			&mut bundle,
			&Address::default(),
			args.lamports_per_win.get(),
			PRIZE_QUOTE_SOL,
			9,
		)?;
		drop(bundle);

		system::instructions::Transfer {
			from: self.authority,
			to: self.bundle,
			lamports: deposit,
		}
		.invoke()
	}
}

impl<'a> ProcessAccountInfos<'a> for FundTokenPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundTokenPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let token_program = *self.token_program.address();
		if token_program != token::ID && token_program != token_2022::ID {
			return Err(ProgramError::IncorrectProgramId);
		}
		// The outer allowlist is the widest prize policy. `admit_token_2022_prize`
		// then keeps a mint strict unless an allow-listed issuer controls it.
		let mint = self
			.mint
			.as_token_mint_for_program(&token_program)?
			.assert_extensions_allowed(&ISSUER_STOCK_EXTENSIONS)?;
		let transfer_fee = if mint.token_2022().is_some() {
			admit_token_2022_prize(&self.mint.try_borrow()?)?
		} else if mint.freeze_authority().is_some() {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		} else {
			None
		};
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if self.mint.address() == &WRAPPED_SOL_MINT_ID {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		if (args.is_nft.get() && token_program != token::ID)
			|| (args.is_nft.get()
				&& (mint.supply() != 1
					|| mint.decimals() != 0
					|| mint.mint_authority().is_some()
					|| bundle.quantity.get() != 1
					|| args.amount_per_win.get() != 1))
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let decimals = mint.decimals();
		drop(mint);
		let escrow = self.escrow.as_associated_token_account(
			&bundle_address,
			self.mint.address(),
			&token_program,
		)?;
		// Security: an escrow delegate or close authority could steal collateral.
		if escrow.delegate().is_some() || escrow.close_authority().is_some() || escrow.is_frozen() {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		let escrow_before = escrow.amount();
		drop(escrow);
		let kind = if args.is_nft.get() {
			PRIZE_NFT
		} else if token_program == token_2022::ID {
			PRIZE_TOKEN_2022
		} else {
			PRIZE_TOKEN
		};
		let deposit = record_prize(
			&mut bundle,
			self.mint.address(),
			args.amount_per_win.get(),
			kind,
			decimals,
		)?;
		drop(bundle);

		if let Some(config) = transfer_fee {
			// The issuer withholds its fee from the escrow's credit, so the
			// funder sends the gross that leaves exactly `deposit` in escrow.
			let schedule = config.epoch_fee(sysvars::clock::Clock::get()?.epoch);
			let gross = schedule
				.gross_for_net(deposit)
				.ok_or(ProgramError::ArithmeticOverflow)?;
			let fee = gross
				.checked_sub(deposit)
				.ok_or(ProgramError::ArithmeticOverflow)?;
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::transfer_fee::TransferCheckedWithFee::<&AccountView>::new(
				&token_2022::ID,
				self.source,
				self.mint,
				self.escrow,
				self.authority,
				gross,
				decimals,
				fee,
			)
			.invoke()?;
		} else if token_program == token_2022::ID {
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::TransferChecked::new(
				self.source,
				self.mint,
				self.escrow,
				self.authority,
				deposit,
				decimals,
			)
			.invoke()?;
		} else {
			self.token_program.assert_address(&token::ID)?;
			token::instructions::TransferChecked::new(
				self.source,
				self.mint,
				self.escrow,
				self.authority,
				deposit,
				decimals,
			)
			.invoke()?;
		}

		// The escrow must hold exactly the recorded inventory, whatever the
		// mint's fee schedule did to the transfer.
		let escrow_after = self
			.escrow
			.as_token_account_for_program(&token_program)?
			.amount();
		if escrow_after.checked_sub(escrow_before) != Some(deposit) {
			return Err(PinaProgramError::UnverifiedTransfer.into());
		}

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for FundQuoteTokenPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = FundQuoteTokenPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let token_program = *self.token_program.address();
		if token_program != token::ID && token_program != token_2022::ID {
			return Err(ProgramError::IncorrectProgramId);
		}
		let mint = self
			.mint
			.as_token_mint_for_program(&token_program)?
			.assert_extensions_allowed(&[
				token_2022::state::ExtensionType::MetadataPointer,
				token_2022::state::ExtensionType::TokenMetadata,
			])?;
		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		if mint.freeze_authority().is_some() || self.mint.address() == &WRAPPED_SOL_MINT_ID {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}

		let decimals = mint.decimals();
		drop(mint);
		let escrow = self.escrow.as_associated_token_account(
			&bundle_address,
			self.mint.address(),
			&token_program,
		)?;
		if escrow.delegate().is_some() || escrow.close_authority().is_some() || escrow.is_frozen() {
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(escrow);
		let deposit = record_prize(
			&mut bundle,
			self.mint.address(),
			args.amount_per_win.get(),
			PRIZE_QUOTE_TOKEN,
			decimals,
		)?;
		drop(bundle);

		if token_program == token_2022::ID {
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::TransferChecked::new(
				self.source,
				self.mint,
				self.escrow,
				self.authority,
				deposit,
				decimals,
			)
			.invoke()
		} else {
			self.token_program.assert_address(&token::ID)?;
			token::instructions::TransferChecked::new(
				self.source,
				self.mint,
				self.escrow,
				self.authority,
				deposit,
				decimals,
			)
			.invoke()
		}
	}
}

impl<'a> ProcessAccountInfos<'a> for FundMintPrizeAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = FundMintPrizeInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let bundle_address = *self.bundle.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let token_program = *self.token_program.address();
		if token_program != token::ID && token_program != token_2022::ID {
			return Err(ProgramError::IncorrectProgramId);
		}
		let mint = self
			.mint
			.as_token_mint_for_program(&token_program)?
			.assert_extensions_allowed(&[
				token_2022::state::ExtensionType::MetadataPointer,
				token_2022::state::ExtensionType::TokenMetadata,
			])?;
		if mint.supply() != 0
			|| mint.decimals() != 0
			|| mint.mint_authority() != Some(self.authority.address())
			|| mint.freeze_authority().is_some()
		{
			return Err(lootbox_error(LootboxError::InvalidPrize));
		}
		drop(mint);

		// Badge metadata is optional; when the mint carries any it must already
		// be immutable, so the advertised identity cannot change after escrow.
		// The borrow is scoped so the data guard never outlives local checks.
		{
			let mint_data = self.mint.try_borrow()?;
			if let Some(metadata) = find_metadata_bytes(&mint_data)?
				&& metadata.get(..32) != Some([0u8; 32].as_slice())
			{
				return Err(lootbox_error(LootboxError::MutablePrize));
			}
		}

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		if bundle.status != BUNDLE_FUNDING {
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		let _ = record_prize(&mut bundle, self.mint.address(), 1, PRIZE_MINT_BADGE, 0)?;
		drop(bundle);

		if token_program == token_2022::ID {
			self.token_program.assert_address(&token_2022::ID)?;
			token_2022::instructions::SetAuthority::new(
				self.mint,
				self.authority,
				token_2022::instructions::AuthorityType::MintTokens,
				Some(&bundle_address),
			)
			.invoke()
		} else {
			self.token_program.assert_address(&token::ID)?;
			token::instructions::SetAuthority::new(
				self.mint,
				self.authority,
				token::instructions::AuthorityType::MintTokens,
				Some(&bundle_address),
			)
			.invoke()
		}
	}
}

impl<'a> ProcessAccountInfos<'a> for SealTemplateAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = SealTemplateInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		if state.status != TEMPLATE_DRAFT {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if state.bundle_count.get() == 0 {
			return Err(lootbox_error(LootboxError::IncompleteConfiguration));
		}

		update_template(
			self.template,
			&TemplateStatePatch::new().status(TEMPLATE_LIVE),
		)?;

		Ok(())
	}
}

fn validate_market_lock(state: &TemplateStateHeader, supply: u64, now: i64) -> ProgramResult {
	if state.status != TEMPLATE_LIVE || state.locked_at.get() != 0 {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	if state.opens_at.get() <= now {
		return Err(lootbox_error(LootboxError::RevealDatePassed));
	}

	let total = state.total_bundles.get();
	let is_pristine = total != 0
		&& state.bundle_count.get() != 0
		&& state.remaining_bundles.get() == total
		&& state.pending_openings.get() == 0
		&& state.next_request.get() == 0
		&& state.next_allocation.get() == 0;
	let exact_supply = state.total_minted.get() == total && supply == total;

	if !is_pristine || !exact_supply {
		return Err(lootbox_error(LootboxError::SupplyMismatch));
	}

	Ok(())
}

fn service_budget(state: &TemplateStateHeader) -> Result<(u64, u64), ProgramError> {
	let rent = Rent::get()?;
	let receipt_rent = if state.result_receipts_enabled.get() {
		rent.try_minimum_balance(ResultReceiptState::SIZE)?
	} else {
		0
	};
	let receipt_budget = receipt_rent
		.checked_mul(state.total_bundles.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let bounty_budget = state
		.settlement_bounty_lamports
		.get()
		.checked_mul(state.total_bundles.get())
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let reserve = receipt_budget
		.checked_add(bounty_budget)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let total = if reserve == 0 {
		0
	} else {
		reserve
			.checked_add(rent.try_minimum_balance(0)?)
			.ok_or(ProgramError::ArithmeticOverflow)?
	};

	Ok((receipt_rent, total))
}

impl<'a> ProcessAccountInfos<'a> for LockTreasuryAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = LockTreasuryInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let now = sysvars::clock::Clock::get()?.unix_timestamp;
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		let supply =
			assert_template_mint(self.box_mint, &template_address, &state.box_mint, false)?;
		validate_market_lock(&state, supply, now)?;

		let next_bundle_seeds = BundleState::seeds(&template_address, state.bundle_count.get());
		self.bundle
			.assert_canonical_bump(&next_bundle_seeds.as_slices(), &ID)?;
		let service_vault_seeds = [SEED_SERVICE_VAULT, template_address.as_ref()];
		if self
			.service_vault
			.assert_canonical_bump(&service_vault_seeds, &ID)?
			!= args.service_vault_bump
		{
			return Err(ProgramError::InvalidSeeds);
		}
		let (receipt_rent, service_budget) = service_budget(&state)?;
		let total_bundles = state.total_bundles.get();
		let settlement_bounty = state.settlement_bounty_lamports.get();
		let receipts_enabled = state.result_receipts_enabled.get();
		let manifest_hash = locked_manifest_hash(&template_address, &state);

		let authority = state.authority;
		let id = state.id.get();
		let bump = state.bump;

		if service_budget != 0 {
			self.service_vault.assert_owner(&system::ID)?;
			let top_up = service_budget.saturating_sub(self.service_vault.lamports());
			if top_up != 0 {
				system::instructions::Transfer {
					from: self.authority,
					to: self.service_vault,
					lamports: top_up,
				}
				.invoke()?;
			}
		}

		let seeds = TemplateState::seeds(&authority, id).with_bump(bump);
		let signer = seeds.to_signer();
		token_2022::instructions::SetAuthority::new(
			self.box_mint,
			self.template,
			token_2022::instructions::AuthorityType::MintTokens,
			None,
		)
		.invoke_signed(&[signer.as_signer()])?;

		update_template(
			self.template,
			&TemplateStatePatch::new()
				.locked_at(now)
				.manifest_hash(manifest_hash)
				.service_vault_bump(args.service_vault_bump)
				.result_receipt_rent_lamports(receipt_rent)
				.remaining_result_receipts(if receipts_enabled { total_bundles } else { 0 })
				.remaining_settlement_bounties(if settlement_bounty == 0 {
					0
				} else {
					total_bundles
				}),
		)?;

		Ok(())
	}
}

fn validate_issuance(
	state: &TemplateStateHeader,
	supply: u64,
	amount: u64,
) -> Result<u64, ProgramError> {
	if state.status != TEMPLATE_LIVE || amount == 0 {
		return Err(lootbox_error(LootboxError::InvalidState));
	}

	let minted = state
		.total_minted
		.get()
		.checked_add(amount)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let liability = supply
		.checked_add(state.pending_openings.get())
		.and_then(|value| value.checked_add(amount))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if minted > state.total_bundles.get() || liability > state.remaining_bundles.get() {
		return Err(lootbox_error(LootboxError::SupplyExceeded));
	}

	Ok(minted)
}

impl<'a> ProcessAccountInfos<'a> for ActivateBundleAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = ActivateBundleInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let template_data = self.template.try_borrow()?;
		let state = TemplateState::try_from_bytes(&template_data)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		assert_bundle(self.bundle, &template_address)?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;

		if bundle.status != BUNDLE_FUNDING
			|| bundle.funded_assets != bundle.asset_count
			|| bundle.reclaimed_mask != 0
			|| has_released_assets(&bundle)?
			|| bundle.index.get() != state.bundle_count.get()
		{
			return Err(lootbox_error(LootboxError::IncompleteConfiguration));
		}

		let index =
			usize::try_from(bundle.index.get()).map_err(|_| ProgramError::InvalidAccountData)?;
		if state.remaining().len() != index {
			return Err(ProgramError::InvalidAccountData);
		}
		let quantity = bundle.quantity.get();
		let remaining_bundles = state
			.remaining_bundles
			.get()
			.checked_add(quantity)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let total_bundles = state
			.total_bundles
			.get()
			.checked_add(quantity)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		if total_bundles > MAX_TOTAL_WEIGHT {
			return Err(lootbox_error(LootboxError::SupplyExceeded));
		}
		let revision = state
			.revision
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let bundle_count = state
			.bundle_count
			.get()
			.checked_add(1)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let manifest_accumulator = next_manifest_accumulator(&state.manifest_accumulator, &bundle);
		let mut remaining = alloc::vec::Vec::with_capacity(index + 1);
		remaining.extend_from_slice(state.remaining());
		remaining.push(PodU64::from(quantity));
		drop(bundle);
		drop(template_data);

		let encoded_size = UpdateResizableAccount {
			account: self.template,
			rent_account: self.authority,
			program_id: &ID,
			patch: TemplateStatePatch::new()
				.remaining_bundles(remaining_bundles)
				.total_bundles(total_bundles)
				.revision(revision)
				.bundle_count(bundle_count)
				.manifest_accumulator(manifest_accumulator)
				.replace_remaining(&remaining),
		}
		.invoke::<TemplateState>()?;
		if encoded_size != template_size(index + 1)? {
			return Err(ProgramError::InvalidAccountData);
		}

		let mut bundle = self.bundle.as_account_mut::<BundleState>(&ID)?;
		bundle.activated_revision.set(revision);
		bundle.status = BUNDLE_ACTIVE;

		Ok(())
	}
}

impl<'a> ProcessAccountInfos<'a> for CancelBundleAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let _ = CancelBundleInstruction::try_from_bytes(data)?;
		let state = as_template(self.template)?;
		assert_template(self.template.address(), &state)?;
		assert_template_authority(self.authority, &state)?;
		// Cancellation only closes an unfunded or fully reclaimed staging account.
		// Recovery-retired treasuries may therefore release its rent without
		// reopening any creator mutation path.
		assert_treasury_unlocked(&state)?;
		assert_bundle(self.bundle, self.template.address())?;
		let bundle = self.bundle.as_account::<BundleState>(&ID)?;
		let reclaimed = if bundle.funded_assets == 0 {
			0
		} else {
			(1u8 << bundle.funded_assets) - 1
		};
		if bundle.status != BUNDLE_FUNDING
			|| bundle.index.get() != state.bundle_count.get()
			|| bundle.reclaimed_mask != reclaimed
			|| has_reserved_slot(&bundle)?
			|| (0..usize::from(bundle.funded_assets)).any(|index| bundle.kinds[index] == PRIZE_POOL)
		{
			return Err(lootbox_error(LootboxError::InvalidState));
		}
		drop(bundle);

		self.bundle.close_account_zeroed(&ID, self.authority)
	}
}

impl<'a> ProcessAccountInfos<'a> for MintTemplateBoxesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = MintTemplateBoxesInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;
		assert_treasury_editable(&state)?;
		let supply =
			assert_template_mint(self.box_mint, &template_address, &state.box_mint, false)?;
		let account = self
			.recipient_box_account
			.as_token_account_for_program(&token_2022::ID)?;
		let recipient = *account.owner();
		drop(account);
		drop(self.recipient_box_account.as_associated_token_account(
			&recipient,
			self.box_mint.address(),
			&token_2022::ID,
		)?);
		let minted = validate_issuance(&state, supply, args.amount.get())?;
		let authority = state.authority;
		let seeds = TemplateState::seeds(&authority, state.id.get()).with_bump(state.bump);
		update_template(
			self.template,
			&TemplateStatePatch::new().total_minted(minted),
		)?;
		let signer = seeds.to_signer();

		token_2022::instructions::MintTo::new(
			self.box_mint,
			self.recipient_box_account,
			self.template,
			args.amount.get(),
		)
		.invoke_signed(&[signer.as_signer()])
	}
}

#[cfg(test)]
mod market_lock_tests {
	use super::*;

	#[test]
	fn market_lock_requires_exact_pristine_supply_before_reveal() {
		let mut state = initialized_template_header(&TemplateStatePatch::new());
		state.status = TEMPLATE_LIVE;
		state.bundle_count.set(2);
		state.total_bundles.set(7);
		state.total_minted.set(7);
		state.remaining_bundles.set(7);
		state.opens_at.set(1_001);

		assert_eq!(validate_market_lock(&state, 7, 1_000), Ok(()));

		state.total_minted.set(6);
		assert!(validate_market_lock(&state, 6, 1_000).is_err());
		state.total_minted.set(7);
		state.remaining_bundles.set(6);
		assert!(validate_market_lock(&state, 7, 1_000).is_err());
		state.remaining_bundles.set(7);
		assert!(validate_market_lock(&state, 7, 1_001).is_err());
		state.locked_at.set(999);
		assert!(validate_market_lock(&state, 7, 1_000).is_err());
	}

	#[test]
	fn recovery_retirement_only_allows_staging_cleanup() {
		let mut state = initialized_template_header(&TemplateStatePatch::new());
		state.status = TEMPLATE_RETIRED;

		assert_eq!(assert_treasury_unlocked(&state), Ok(()));
		assert!(assert_treasury_editable(&state).is_err());

		state.locked_at.set(1);
		assert!(assert_treasury_unlocked(&state).is_err());
	}
}
