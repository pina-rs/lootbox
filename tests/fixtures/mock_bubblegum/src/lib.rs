//! Test-only Bubblegum V1 transfer boundary for offline Surfpool journeys.
//!
//! This is deliberately not a Merkle-tree implementation. It models the
//! properties Lootbox relies on at the CPI boundary: exact leaf commitments,
//! a current owner that must sign, an evolving root that makes old proofs
//! stale, and an atomic owner transition. The account carries a real
//! `ConcurrentMerkleTreeHeader` prefix — with a parameterized depth and
//! canopy — so on-chain admission checks parse the deployed layout, followed
//! by the fixture's own leaf store inside the serialized tree region.

#![allow(clippy::inline_always)]
#![no_std]

#[cfg(feature = "bpf-entrypoint")]
pub mod entrypoint;

use pina::*;
use solana_sha256_hasher::hashv;

declare_id!("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");

pub const INITIALIZE_DISCRIMINATOR: [u8; 8] = *b"LBGMINT1";
pub const TRANSFER_DISCRIMINATOR: [u8; 8] = [163, 52, 200, 231, 140, 3, 69, 186];
pub const UPDATE_HASHES_DISCRIMINATOR: [u8; 8] = *b"LBGMUPD1";
pub const TREE_MAGIC: [u8; 8] = *b"LBGMTRE1";
pub const HEADER_SIZE: usize = 76;
pub const LEAF_SIZE: usize = 108;
pub const INITIALIZE_LEAF_SIZE: usize = 76;
pub const MAX_LEAVES: usize = 64;
/// Real `ConcurrentMerkleTreeHeader` size followed by the tree region's
/// sequence-number, active-index, and buffer-size words.
pub const TREE_PREFIX: usize = 56 + 24;
/// The buffer size every fixture tree reports in its real header. Eight
/// changelog slots keep the serialized tree region inside the 10,240-byte
/// CPI allocation cap for every depth the fixtures exercise.
pub const MOCK_MAX_BUFFER: u32 = 8;
const TREE_ACCOUNT_TYPE: u8 = 1;
const TREE_VERSION_V1: u8 = 1;
/// One changelog or rightmost-proof entry around its `max_depth` nodes.
const TREE_PER_ENTRY_FIXED: usize = 72;

fn read_u32(data: &[u8], offset: usize) -> Result<u32, ProgramError> {
	Ok(u32::from_le_bytes(
		data.get(offset..offset + 4)
			.ok_or(ProgramError::InvalidInstructionData)?
			.try_into()
			.map_err(|_| ProgramError::InvalidInstructionData)?,
	))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64, ProgramError> {
	Ok(u64::from_le_bytes(
		data.get(offset..offset + 8)
			.ok_or(ProgramError::InvalidInstructionData)?
			.try_into()
			.map_err(|_| ProgramError::InvalidInstructionData)?,
	))
}

fn tree_space(max_depth: u32, canopy_depth: u32) -> Result<usize, ProgramError> {
	if max_depth == 0 || max_depth > 30 || canopy_depth > max_depth {
		return Err(ProgramError::InvalidInstructionData);
	}
	let depth = usize::try_from(max_depth).map_err(|_| ProgramError::InvalidInstructionData)?;
	let per_entry = TREE_PER_ENTRY_FIXED
		.checked_add(
			depth
				.checked_mul(32)
				.ok_or(ProgramError::ArithmeticOverflow)?,
		)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let region = (MOCK_MAX_BUFFER as usize)
		.checked_add(1)
		.and_then(|entries| entries.checked_mul(per_entry))
		.ok_or(ProgramError::ArithmeticOverflow)?;
	let canopy_nodes = if canopy_depth == 0 {
		0usize
	} else {
		let doubled = (1u64 << canopy_depth)
			.checked_mul(2)
			.and_then(|value| value.checked_sub(2))
			.ok_or(ProgramError::InvalidInstructionData)?;
		usize::try_from(doubled).map_err(|_| ProgramError::InvalidInstructionData)?
	};
	let canopy_bytes = canopy_nodes
		.checked_mul(32)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	TREE_PREFIX
		.checked_add(region)
		.and_then(|size| size.checked_add(canopy_bytes))
		.ok_or(ProgramError::ArithmeticOverflow)
}

fn process_initialize(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
	let [payer, tree, system_program] = accounts else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};
	payer.assert_signer()?.assert_writable()?;
	tree.assert_signer()?.assert_empty()?.assert_writable()?;
	system_program.assert_address(&system::ID)?;
	let count =
		usize::try_from(read_u32(data, 0)?).map_err(|_| ProgramError::InvalidInstructionData)?;
	let max_depth = read_u32(data, 4)?;
	let canopy_depth = read_u32(data, 8)?;
	let expected = 12usize
		.checked_add(
			count
				.checked_mul(INITIALIZE_LEAF_SIZE)
				.ok_or(ProgramError::ArithmeticOverflow)?,
		)
		.ok_or(ProgramError::ArithmeticOverflow)?;
	if count == 0
		|| count > MAX_LEAVES
		|| max_depth == 0
		|| max_depth > 30
		|| canopy_depth > max_depth
		|| count as u64 > 1 << max_depth
		|| data.len() != expected
	{
		return Err(ProgramError::InvalidInstructionData);
	}
	let space = tree_space(max_depth, canopy_depth)?;
	CreateAccount {
		from: payer,
		to: tree,
		space: u64::try_from(space).map_err(|_| ProgramError::ArithmeticOverflow)?,
		owner: &ID,
	}
	.invoke()?;
	let tree_address = *tree.address();
	let mut target = tree.try_borrow_mut()?;
	target.fill(0);
	// Real ConcurrentMerkleTreeHeader V1: account type, version, buffer size,
	// depth, authority, creation slot, and the batch flag.
	target[0] = TREE_ACCOUNT_TYPE;
	target[1] = TREE_VERSION_V1;
	target[2..6].copy_from_slice(&MOCK_MAX_BUFFER.to_le_bytes());
	target[6..10].copy_from_slice(&max_depth.to_le_bytes());
	target[10..42].copy_from_slice(payer.address().as_ref());
	// The fixture's leaf store starts after the header and the tree region's
	// three fixed words, exactly where the deployed layout keeps opaque tree
	// bytes the admission check never reads.
	target[TREE_PREFIX..TREE_PREFIX + 8].copy_from_slice(&TREE_MAGIC);
	let initial_root = hashv(&[
		b"lootbox-mock-bubblegum-root".as_slice(),
		tree_address.as_ref(),
	]);
	target[TREE_PREFIX + 8..TREE_PREFIX + 40].copy_from_slice(initial_root.as_ref());
	target[TREE_PREFIX + 40..TREE_PREFIX + 44].copy_from_slice(&(count as u32).to_le_bytes());
	target[TREE_PREFIX + 44..TREE_PREFIX + 76].copy_from_slice(payer.address().as_ref());
	for leaf in 0..count {
		let source = 12 + leaf * INITIALIZE_LEAF_SIZE;
		let destination = TREE_PREFIX + HEADER_SIZE + leaf * LEAF_SIZE;
		target[destination..destination + 32].copy_from_slice(payer.address().as_ref());
		target[destination + 32..destination + LEAF_SIZE]
			.copy_from_slice(&data[source..source + LEAF_SIZE - 32]);
	}

	Ok(())
}

fn process_update_hashes(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
	let [authority, merkle_tree] = accounts else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};
	authority.assert_signer()?;
	merkle_tree.assert_owner(&ID)?.assert_writable()?;
	if data.len() != 76 {
		return Err(ProgramError::InvalidInstructionData);
	}
	let nonce = read_u64(data, 0)?;
	let index = read_u32(data, 8)?;
	let mut tree = merkle_tree.try_borrow_mut()?;
	if tree.get(TREE_PREFIX..TREE_PREFIX + 8) != Some(TREE_MAGIC.as_slice())
		|| tree.get(TREE_PREFIX + 44..TREE_PREFIX + 76) != Some(authority.address().as_ref())
	{
		return Err(ProgramError::InvalidAccountData);
	}
	let count = usize::try_from(read_u32(&tree, TREE_PREFIX + 40)?)
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let offset = (0..count)
		.map(|leaf| TREE_PREFIX + HEADER_SIZE + leaf * LEAF_SIZE)
		.find(|offset| {
			read_u64(&tree, offset + 96) == Ok(nonce) && read_u32(&tree, offset + 104) == Ok(index)
		})
		.ok_or(ProgramError::InvalidArgument)?;
	let mut old_root = [0; 32];
	old_root.copy_from_slice(&tree[TREE_PREFIX + 8..TREE_PREFIX + 40]);
	tree[offset + 32..offset + 64].copy_from_slice(&data[12..44]);
	tree[offset + 64..offset + 96].copy_from_slice(&data[44..76]);
	let next_root = hashv(&[
		b"lootbox-mock-bubblegum-update".as_slice(),
		old_root.as_slice(),
		&nonce.to_le_bytes(),
		&index.to_le_bytes(),
		&data[12..44],
		&data[44..76],
	]);
	tree[TREE_PREFIX + 8..TREE_PREFIX + 40].copy_from_slice(next_root.as_ref());

	Ok(())
}

fn process_transfer(accounts: &mut [AccountView], data: &[u8]) -> ProgramResult {
	let [
		_tree_config,
		owner,
		delegate,
		new_owner,
		merkle_tree,
		_log_wrapper,
		_compression_program,
		_system_program,
		_proof_accounts @ ..,
	] = accounts
	else {
		return Err(ProgramError::NotEnoughAccountKeys);
	};
	owner.assert_signer()?;
	delegate.assert_signer()?;
	if owner.address() != delegate.address() {
		return Err(ProgramError::InvalidArgument);
	}
	merkle_tree.assert_owner(&ID)?.assert_writable()?;
	if data.len() != 108 {
		return Err(ProgramError::InvalidInstructionData);
	}
	let nonce = read_u64(data, 96)?;
	let index = read_u32(data, 104)?;
	let mut tree = merkle_tree.try_borrow_mut()?;
	if tree.get(TREE_PREFIX..TREE_PREFIX + 8) != Some(TREE_MAGIC.as_slice())
		|| tree.get(TREE_PREFIX + 8..TREE_PREFIX + 40) != data.get(..32)
	{
		return Err(ProgramError::InvalidAccountData);
	}
	let count = usize::try_from(read_u32(&tree, TREE_PREFIX + 40)?)
		.map_err(|_| ProgramError::InvalidAccountData)?;
	let mut matched = None;
	for leaf in 0..count {
		let offset = TREE_PREFIX + HEADER_SIZE + leaf * LEAF_SIZE;
		let stored_nonce = read_u64(&tree, offset + 96)?;
		let stored_index = read_u32(&tree, offset + 104)?;
		if stored_nonce == nonce && stored_index == index {
			matched = Some(offset);
			break;
		}
	}
	let offset = matched.ok_or(ProgramError::InvalidArgument)?;
	if tree.get(offset..offset + 32) != Some(owner.address().as_ref())
		|| tree.get(offset + 32..offset + 64) != data.get(32..64)
		|| tree.get(offset + 64..offset + 96) != data.get(64..96)
	{
		return Err(ProgramError::InvalidAccountData);
	}
	let mut old_root = [0; 32];
	old_root.copy_from_slice(&tree[TREE_PREFIX + 8..TREE_PREFIX + 40]);
	tree[offset..offset + 32].copy_from_slice(new_owner.address().as_ref());
	let next_root = hashv(&[
		b"lootbox-mock-bubblegum-transfer".as_slice(),
		old_root.as_slice(),
		new_owner.address().as_ref(),
		&nonce.to_le_bytes(),
		&index.to_le_bytes(),
	]);
	tree[TREE_PREFIX + 8..TREE_PREFIX + 40].copy_from_slice(next_root.as_ref());

	Ok(())
}

/// Process fixture initialization or the pinned Bubblegum transfer ABI.
pub fn process_instruction(
	program_id: &Address,
	accounts: &mut [AccountView],
	data: &[u8],
) -> ProgramResult {
	if program_id != &ID {
		return Err(ProgramError::IncorrectProgramId);
	}
	if let Some(payload) = data.strip_prefix(&INITIALIZE_DISCRIMINATOR) {
		return process_initialize(accounts, payload);
	}
	if let Some(payload) = data.strip_prefix(&TRANSFER_DISCRIMINATOR) {
		return process_transfer(accounts, payload);
	}
	if let Some(payload) = data.strip_prefix(&UPDATE_HASHES_DISCRIMINATOR) {
		return process_update_hashes(accounts, payload);
	}
	Err(ProgramError::InvalidInstructionData)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn fixture_tree_space_matches_the_deployed_layout() {
		// depth 6, no canopy: header 56 + fixed 24 + 9 * (72 + 192)
		assert_eq!(tree_space(6, 0), Ok(56 + 24 + 9 * 264));
		// depth 20 with a four-level canopy caches 30 nodes and every size
		// stays inside the runtime's inner-instruction allocation cap.
		assert_eq!(
			tree_space(20, 4),
			Ok(56 + 24 + 9 * (72 + 32 * 20) + 30 * 32)
		);
		for (depth, canopy) in [(26, 0), (20, 0), (6, 0)] {
			let size = tree_space(depth, canopy).expect("bounded fixture size");
			assert!(
				size <= 10_240,
				"depth {depth} canopy {canopy} needs {size} bytes"
			);
		}
		assert!(tree_space(6, 7).is_err());
	}
}
