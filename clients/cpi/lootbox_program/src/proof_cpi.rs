//! Variable-length Bubblegum proof CPI helpers.
//!
//! Pina's fixed generated CPI surface currently renders a remaining-account
//! slice as one placeholder account. These wrappers preserve the generated
//! instruction data while accepting the protocol's variable proof-node slice.

use alloc::vec::Vec;

use pina::AccountView;
use pina::InstructionAccount;
use pina::InstructionView;
use pina::ProgramError;
use pina::ProgramResult;
use pina::Signer;

use crate::ClaimPrizePoolItemIx;
use crate::DepositPrizePoolItemIx;
use crate::ProgramAccount;
use crate::ReclaimPrizePoolItemIx;

/// Largest Bubblegum proof accepted by the typed CPI helpers.
pub const MAX_BUBBLEGUM_PROOF_ACCOUNTS: usize = 16;
const MAX_CPI_ACCOUNTS: usize = 64;

#[derive(Clone, Copy)]
struct AccountSpec<'a> {
	view: &'a AccountView,
	writable: bool,
	signer: bool,
}

impl<'a> AccountSpec<'a> {
	const fn readonly(view: &'a AccountView) -> Self {
		Self {
			view,
			writable: false,
			signer: false,
		}
	}

	fn writable(view: &'a AccountView) -> Result<Self, ProgramError> {
		if !view.is_writable() {
			return Err(ProgramError::InvalidAccountData);
		}
		Ok(Self {
			view,
			writable: true,
			signer: false,
		})
	}

	fn writable_signer(view: &'a AccountView) -> Result<Self, ProgramError> {
		let mut result = Self::writable(view)?;
		result.signer = true;
		Ok(result)
	}
}

fn assert_proof_bound(length: usize) -> ProgramResult {
	if length > MAX_BUBBLEGUM_PROOF_ACCOUNTS {
		return Err(ProgramError::InvalidArgument);
	}
	Ok(())
}

fn invoke_with_proof(
	program: &ProgramAccount<'_>,
	fixed: &[AccountSpec<'_>],
	proof_accounts: &[AccountView],
	data: &[u8],
	signers: &[Signer<'_, '_>],
) -> ProgramResult {
	assert_proof_bound(proof_accounts.len())?;
	let count = fixed
		.len()
		.checked_add(proof_accounts.len())
		.ok_or(ProgramError::InvalidArgument)?;
	if count > MAX_CPI_ACCOUNTS {
		return Err(ProgramError::InvalidArgument);
	}
	let mut instruction_accounts = Vec::with_capacity(count);
	let mut account_views = Vec::with_capacity(count);
	for account in fixed {
		instruction_accounts.push(InstructionAccount::new(
			account.view.address(),
			account.writable,
			account.signer,
		));
		account_views.push(account.view);
	}
	for account in proof_accounts {
		instruction_accounts.push(InstructionAccount::readonly(account.address()));
		account_views.push(account);
	}
	let instruction = InstructionView {
		program_id: program.address(),
		accounts: &instruction_accounts,
		data,
	};
	pina::pinocchio::cpi::invoke_signed_with_bounds::<MAX_CPI_ACCOUNTS, _>(
		&instruction,
		&account_views,
		signers,
	)
}

/// Deposit one compressed asset with its leaf-to-root proof nodes.
#[derive(Clone, Copy)]
#[must_use = "the CPI has no effect until invoke or invoke_signed is called"]
pub struct DepositPrizePoolItemWithProof<'account> {
	pub authority: &'account AccountView,
	pub template: &'account AccountView,
	pub bundle: &'account AccountView,
	pub prize_pool: &'account AccountView,
	pub prize_pool_item: &'account AccountView,
	pub tree_config: &'account AccountView,
	pub merkle_tree: &'account AccountView,
	pub bubblegum_program: &'account AccountView,
	pub log_wrapper: &'account AccountView,
	pub compression_program: &'account AccountView,
	pub system_program: &'account AccountView,
	pub proof_accounts: &'account [AccountView],
	pub ix: DepositPrizePoolItemIx,
}

impl DepositPrizePoolItemWithProof<'_> {
	pub fn invoke(&self, program: &ProgramAccount<'_>) -> ProgramResult {
		self.invoke_signed(program, &[])
	}

	pub fn invoke_signed(
		&self,
		program: &ProgramAccount<'_>,
		signers: &[Signer<'_, '_>],
	) -> ProgramResult {
		let fixed = [
			AccountSpec::writable_signer(self.authority)?,
			AccountSpec::readonly(self.template),
			AccountSpec::readonly(self.bundle),
			AccountSpec::writable(self.prize_pool)?,
			AccountSpec::writable(self.prize_pool_item)?,
			AccountSpec::readonly(self.tree_config),
			AccountSpec::writable(self.merkle_tree)?,
			AccountSpec::readonly(self.bubblegum_program),
			AccountSpec::readonly(self.log_wrapper),
			AccountSpec::readonly(self.compression_program),
			AccountSpec::readonly(self.system_program),
		];
		invoke_with_proof(
			program,
			&fixed,
			self.proof_accounts,
			&self.ix.to_bytes()?,
			signers,
		)
	}
}

/// Deliver the entropy-selected asset with its current leaf-to-root proof.
#[derive(Clone, Copy)]
#[must_use = "the CPI has no effect until invoke or invoke_signed is called"]
pub struct ClaimPrizePoolItemWithProof<'account> {
	pub template: &'account AccountView,
	pub opening: &'account AccountView,
	pub bundle: &'account AccountView,
	pub prize_pool: &'account AccountView,
	pub prize_pool_item: &'account AccountView,
	pub recipient: &'account AccountView,
	pub rent_refund: &'account AccountView,
	pub tree_config: &'account AccountView,
	pub merkle_tree: &'account AccountView,
	pub bubblegum_program: &'account AccountView,
	pub log_wrapper: &'account AccountView,
	pub compression_program: &'account AccountView,
	pub system_program: &'account AccountView,
	pub proof_accounts: &'account [AccountView],
	pub ix: ClaimPrizePoolItemIx<'account>,
}

impl ClaimPrizePoolItemWithProof<'_> {
	pub fn invoke(&self, program: &ProgramAccount<'_>) -> ProgramResult {
		self.invoke_signed(program, &[])
	}

	pub fn invoke_signed(
		&self,
		program: &ProgramAccount<'_>,
		signers: &[Signer<'_, '_>],
	) -> ProgramResult {
		let fixed = [
			AccountSpec::readonly(self.template),
			AccountSpec::writable(self.opening)?,
			AccountSpec::writable(self.bundle)?,
			AccountSpec::writable(self.prize_pool)?,
			AccountSpec::writable(self.prize_pool_item)?,
			AccountSpec::readonly(self.recipient),
			AccountSpec::writable(self.rent_refund)?,
			AccountSpec::readonly(self.tree_config),
			AccountSpec::writable(self.merkle_tree)?,
			AccountSpec::readonly(self.bubblegum_program),
			AccountSpec::readonly(self.log_wrapper),
			AccountSpec::readonly(self.compression_program),
			AccountSpec::readonly(self.system_program),
		];
		invoke_with_proof(
			program,
			&fixed,
			self.proof_accounts,
			&self.ix.to_bytes()?,
			signers,
		)
	}
}

/// Recover one pool asset with its current leaf-to-root proof.
#[derive(Clone, Copy)]
#[must_use = "the CPI has no effect until invoke or invoke_signed is called"]
pub struct ReclaimPrizePoolItemWithProof<'account> {
	pub authority: &'account AccountView,
	pub template: &'account AccountView,
	pub box_mint: &'account AccountView,
	pub bundle: &'account AccountView,
	pub prize_pool: &'account AccountView,
	pub prize_pool_item: &'account AccountView,
	pub tree_config: &'account AccountView,
	pub merkle_tree: &'account AccountView,
	pub bubblegum_program: &'account AccountView,
	pub log_wrapper: &'account AccountView,
	pub compression_program: &'account AccountView,
	pub system_program: &'account AccountView,
	pub proof_accounts: &'account [AccountView],
	pub ix: ReclaimPrizePoolItemIx<'account>,
}

impl ReclaimPrizePoolItemWithProof<'_> {
	pub fn invoke(&self, program: &ProgramAccount<'_>) -> ProgramResult {
		self.invoke_signed(program, &[])
	}

	pub fn invoke_signed(
		&self,
		program: &ProgramAccount<'_>,
		signers: &[Signer<'_, '_>],
	) -> ProgramResult {
		let fixed = [
			AccountSpec::writable_signer(self.authority)?,
			AccountSpec::readonly(self.template),
			AccountSpec::readonly(self.box_mint),
			AccountSpec::writable(self.bundle)?,
			AccountSpec::writable(self.prize_pool)?,
			AccountSpec::writable(self.prize_pool_item)?,
			AccountSpec::readonly(self.tree_config),
			AccountSpec::writable(self.merkle_tree)?,
			AccountSpec::readonly(self.bubblegum_program),
			AccountSpec::readonly(self.log_wrapper),
			AccountSpec::readonly(self.compression_program),
			AccountSpec::readonly(self.system_program),
		];
		invoke_with_proof(
			program,
			&fixed,
			self.proof_accounts,
			&self.ix.to_bytes()?,
			signers,
		)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn proof_bound_accepts_protocol_limit_and_rejects_larger_slices() {
		assert_eq!(assert_proof_bound(0), Ok(()));
		assert_eq!(assert_proof_bound(16), Ok(()));
		assert_eq!(assert_proof_bound(17), Err(ProgramError::InvalidArgument),);
	}
}
