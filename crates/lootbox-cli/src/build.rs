//! clap argument structs and instruction builders for every lootbox program
//! instruction.

use lootbox_program_client::generated::accounts as generated_accounts;
use lootbox_program_client::generated::instructions as generated;
use solana_instruction::AccountMeta;
use solana_instruction::Instruction;
use solana_pubkey::Pubkey;

use crate::error::CliError;

/// Builds the wire-encoded instruction for one subcommand.
pub trait InstructionBuilder {
	fn build(&self) -> Result<Instruction, CliError>;
}

/// Appends caller-supplied remaining accounts after the fixed account list.
fn remaining_metas(writable: &[Pubkey], readonly: &[Pubkey]) -> Vec<AccountMeta> {
	writable
		.iter()
		.map(|pubkey| AccountMeta::new(*pubkey, false))
		.chain(
			readonly
				.iter()
				.map(|pubkey| AccountMeta::new_readonly(*pubkey, false)),
		)
		.collect()
}

/// Parses a fixed-size hex argument (`0x` prefix optional).
fn hex_arg<const N: usize>(value: &str, field: &'static str) -> Result<[u8; N], CliError> {
	let digits = value.strip_prefix("0x").unwrap_or(value);
	if digits.len() != N * 2 {
		return Err(CliError::InvalidHexLength {
			field,
			value: value.to_string(),
			expected: N,
		});
	}

	let mut out = [0u8; N];
	for (index, pair) in digits.as_bytes().chunks_exact(2).enumerate() {
		let byte = std::str::from_utf8(pair)
			.ok()
			.and_then(|pair| u8::from_str_radix(pair, 16).ok())
			.ok_or(CliError::InvalidHexLength {
				field,
				value: value.to_string(),
				expected: N,
			})?;
		out[index] = byte;
	}

	Ok(out)
}

/// Packs a text argument into a zero-padded fixed-size wire field.
fn text_arg<const N: usize>(value: &str, field: &'static str) -> Result<[u8; N], CliError> {
	let bytes = value.as_bytes();
	if bytes.len() > N {
		return Err(CliError::TextTooLong {
			field,
			limit: N,
			actual: bytes.len(),
		});
	}

	let mut out = [0u8; N];
	out[..bytes.len()].copy_from_slice(bytes);

	Ok(out)
}

// ---------------------------------------------------------------------------
// lootbox lifecycle
// ---------------------------------------------------------------------------

/// Arguments for `create-lootbox`.
#[derive(Debug, clap::Args)]
pub struct CreateLootboxArgs {
	/// Payer and update authority of the lootbox.
	#[arg(long)]
	pub authority: Pubkey,
	/// Box mint controlled by the lootbox.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Lootbox id; the lootbox PDA is derived from authority and id.
	#[arg(long)]
	pub id: u64,
	/// Maximum number of boxes the mint can ever supply.
	#[arg(long)]
	pub max_supply: u64,
	/// Switchboard On-Demand program (mainnet or devnet).
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Switchboard queue that will serve randomness.
	#[arg(long)]
	pub oracle_queue: Pubkey,
	/// Lootbox PDA bump; derived when omitted.
	#[arg(long)]
	pub bump: Option<u8>,
	/// Vault PDA bump; derived when omitted.
	#[arg(long)]
	pub vault_bump: Option<u8>,
}

impl CreateLootboxArgs {
	fn lootbox_pda(&self) -> Pubkey {
		generated_accounts::LootboxState::find_pda(&self.authority, self.id).0
	}

	fn bump(&self) -> u8 {
		self.bump.unwrap_or_else(|| {
			generated_accounts::LootboxState::find_pda(&self.authority, self.id).1
		})
	}

	fn vault_bump(&self) -> u8 {
		self.vault_bump
			.unwrap_or_else(|| generated_accounts::VaultState::find_pda(&self.lootbox_pda()).1)
	}
}

impl InstructionBuilder for CreateLootboxArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts =
			generated::CreateLootbox::new(self.authority, self.box_mint, self.lootbox_pda());
		let bump = self.bump();
		let vault_bump = self.vault_bump();
		let data = generated::CreateLootboxInstructionData::new(|wire| {
			wire.id = self.id.into();
			wire.max_supply = self.max_supply.into();
			wire.oracle_program = self.oracle_program;
			wire.oracle_queue = self.oracle_queue;
			wire.bump = bump;
			wire.vault_bump = vault_bump;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `deposit`.
#[derive(Debug, clap::Args)]
pub struct DepositArgs {
	/// Wallet depositing lamports into the vault.
	#[arg(long)]
	pub depositor: Pubkey,
	/// Lootbox the deposit funds.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Vault PDA receiving the lamports.
	#[arg(long)]
	pub vault: Pubkey,
	/// Lamports to deposit.
	#[arg(long)]
	pub lamports: u64,
}

impl InstructionBuilder for DepositArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::Deposit::new(self.depositor, self.lootbox, self.vault);
		let lamports = self.lamports;
		let data = generated::DepositInstructionData::new(|wire| {
			wire.lamports = lamports.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `add-outcome`.
#[derive(Debug, clap::Args)]
pub struct AddOutcomeArgs {
	/// Lootbox authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Lootbox receiving the outcome.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Relative selection weight of the outcome.
	#[arg(long)]
	pub weight: u64,
	/// SOL payout of the outcome in lamports.
	#[arg(long)]
	pub reward_lamports: u64,
}

impl InstructionBuilder for AddOutcomeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::AddOutcome::new(self.authority, self.lootbox);
		let weight = self.weight;
		let reward_lamports = self.reward_lamports;
		let data = generated::AddOutcomeInstructionData::new(|wire| {
			wire.weight = weight.into();
			wire.reward_lamports = reward_lamports.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `seal`.
#[derive(Debug, clap::Args)]
pub struct SealArgs {
	/// Lootbox authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Lootbox to seal.
	#[arg(long)]
	pub lootbox: Pubkey,
}

impl InstructionBuilder for SealArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::Seal::new(self.authority, self.lootbox);
		let data = generated::SealInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `mint-boxes`.
#[derive(Debug, clap::Args)]
pub struct MintBoxesArgs {
	/// Lootbox authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Lootbox minting the boxes.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Vault PDA funding the mint.
	#[arg(long)]
	pub vault: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Destination box token account.
	#[arg(long)]
	pub recipient_box_account: Pubkey,
	/// Number of boxes to mint.
	#[arg(long)]
	pub amount: u64,
}

impl InstructionBuilder for MintBoxesArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::MintBoxes::new(
			self.authority,
			self.lootbox,
			self.vault,
			self.box_mint,
			self.recipient_box_account,
		);
		let amount = self.amount;
		let data = generated::MintBoxesInstructionData::new(|wire| {
			wire.amount = amount.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `request-open`.
#[derive(Debug, clap::Args)]
pub struct RequestOpenArgs {
	/// Box holder opening the lootbox.
	#[arg(long)]
	pub owner: Pubkey,
	/// Lootbox being opened.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Vault PDA.
	#[arg(long)]
	pub vault: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Holder's box token account.
	#[arg(long)]
	pub owner_box_account: Pubkey,
	/// Fresh randomness account created for this open.
	#[arg(long)]
	pub randomness: Pubkey,
	/// Reward escrow PDA.
	#[arg(long)]
	pub reward_escrow: Pubkey,
	/// Switchboard queue.
	#[arg(long)]
	pub oracle_queue: Pubkey,
	/// Switchboard oracle.
	#[arg(long)]
	pub oracle: Pubkey,
	/// Recent slot-hashes sysvar.
	#[arg(long)]
	pub recent_slot_hashes: Pubkey,
	/// Switchboard On-Demand program.
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Switchboard program state.
	#[arg(long)]
	pub oracle_program_state: Pubkey,
	/// Switchboard lookup-table signer.
	#[arg(long)]
	pub oracle_lut_signer: Pubkey,
	/// Switchboard lookup table.
	#[arg(long)]
	pub oracle_lut: Pubkey,
	/// Wrapped-SOL mint.
	#[arg(long)]
	pub wrapped_sol_mint: Pubkey,
	/// Address-lookup-table program.
	#[arg(long)]
	pub address_lookup_table_program: Pubkey,
	/// Recent slot used by Switchboard to derive its lookup table.
	#[arg(long)]
	pub recent_slot: u64,
	/// Opening PDA bump.
	#[arg(long)]
	pub bump: u8,
}

impl InstructionBuilder for RequestOpenArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::RequestOpen::new(
			self.owner,
			self.lootbox,
			self.vault,
			self.box_mint,
			self.owner_box_account,
			self.randomness,
			self.reward_escrow,
			self.oracle_queue,
			self.oracle,
			self.recent_slot_hashes,
			self.oracle_program,
			self.oracle_program_state,
			self.oracle_lut_signer,
			self.oracle_lut,
			self.wrapped_sol_mint,
			self.address_lookup_table_program,
		);
		let recent_slot = self.recent_slot;
		let bump = self.bump;
		let data = generated::RequestOpenInstructionData::new(|wire| {
			wire.recent_slot = recent_slot.into();
			wire.bump = bump;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `settle-open`.
#[derive(Debug, clap::Args)]
pub struct SettleOpenArgs {
	/// Opening recipient.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Payer funding oracle bookkeeping.
	#[arg(long)]
	pub payer: Pubkey,
	/// Lootbox being settled.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Vault PDA.
	#[arg(long)]
	pub vault: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Randomness account.
	#[arg(long)]
	pub randomness: Pubkey,
	/// Switchboard queue.
	#[arg(long)]
	pub oracle_queue: Pubkey,
	/// Switchboard oracle.
	#[arg(long)]
	pub oracle: Pubkey,
	/// Oracle stats tracker.
	#[arg(long)]
	pub oracle_stats: Pubkey,
	/// Recent slot-hashes sysvar.
	#[arg(long)]
	pub recent_slot_hashes: Pubkey,
	/// Switchboard On-Demand program.
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Reward escrow.
	#[arg(long)]
	pub reward_escrow: Pubkey,
	/// Switchboard program state.
	#[arg(long)]
	pub oracle_program_state: Pubkey,
	/// Wrapped-SOL mint.
	#[arg(long)]
	pub wrapped_sol_mint: Pubkey,
	/// Enclave signature returned by the Switchboard gateway (hex).
	#[arg(long)]
	pub signature: String,
	/// Secp256k1 recovery identifier returned by the gateway.
	#[arg(long)]
	pub recovery_id: u8,
	/// Revealed value covered by the signature (hex).
	#[arg(long)]
	pub value: String,
}

impl InstructionBuilder for SettleOpenArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::SettleOpen::new(
			self.recipient,
			self.payer,
			self.lootbox,
			self.vault,
			self.box_mint,
			self.opening,
			self.randomness,
			self.oracle_queue,
			self.oracle,
			self.oracle_stats,
			self.recent_slot_hashes,
			self.oracle_program,
			self.reward_escrow,
			self.oracle_program_state,
			self.wrapped_sol_mint,
		);
		let signature = hex_arg::<64>(&self.signature, "signature")?;
		let recovery_id = self.recovery_id;
		let value = hex_arg::<32>(&self.value, "value")?;
		let data = generated::SettleOpenInstructionData::new(|wire| {
			wire.signature = signature;
			wire.recovery_id = recovery_id;
			wire.value = value;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `refund-open`.
#[derive(Debug, clap::Args)]
pub struct RefundOpenArgs {
	/// Opening recipient.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Lootbox being refunded.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Vault PDA.
	#[arg(long)]
	pub vault: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Randomness account.
	#[arg(long)]
	pub randomness: Pubkey,
	/// Clock sysvar.
	#[arg(long)]
	pub clock: Pubkey,
}

impl InstructionBuilder for RefundOpenArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::RefundOpen::new(
			self.recipient,
			self.lootbox,
			self.vault,
			self.box_mint,
			self.opening,
			self.randomness,
			self.clock,
		);
		let data = generated::RefundOpenInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `close-opening`.
#[derive(Debug, clap::Args)]
pub struct CloseOpeningArgs {
	/// Opening recipient receiving the reclaimed rent.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Lootbox the opening belonged to.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Opening receipt to close.
	#[arg(long)]
	pub opening: Pubkey,
	/// Randomness account.
	#[arg(long)]
	pub randomness: Pubkey,
	/// Reward escrow.
	#[arg(long)]
	pub reward_escrow: Pubkey,
	/// Switchboard On-Demand program.
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Switchboard program state.
	#[arg(long)]
	pub oracle_program_state: Pubkey,
	/// Switchboard lookup table.
	#[arg(long)]
	pub oracle_lut: Pubkey,
	/// Switchboard lookup-table signer.
	#[arg(long)]
	pub oracle_lut_signer: Pubkey,
	/// Wrapped-SOL mint.
	#[arg(long)]
	pub wrapped_sol_mint: Pubkey,
	/// Address-lookup-table program.
	#[arg(long)]
	pub address_lookup_table_program: Pubkey,
}

impl InstructionBuilder for CloseOpeningArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::CloseOpening::new(
			self.recipient,
			self.lootbox,
			self.opening,
			self.randomness,
			self.reward_escrow,
			self.oracle_program,
			self.oracle_program_state,
			self.oracle_lut,
			self.oracle_lut_signer,
			self.wrapped_sol_mint,
			self.address_lookup_table_program,
		);
		let data = generated::CloseOpeningInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `withdraw-surplus`.
#[derive(Debug, clap::Args)]
pub struct WithdrawSurplusArgs {
	/// Lootbox authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Lootbox withdrawing surplus.
	#[arg(long)]
	pub lootbox: Pubkey,
	/// Vault PDA.
	#[arg(long)]
	pub vault: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Lamports to withdraw.
	#[arg(long)]
	pub lamports: u64,
}

impl InstructionBuilder for WithdrawSurplusArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::WithdrawSurplus::new(
			self.authority,
			self.lootbox,
			self.vault,
			self.box_mint,
		);
		let lamports = self.lamports;
		let data = generated::WithdrawSurplusInstructionData::new(|wire| {
			wire.lamports = lamports.into();
		})?;

		Ok(accounts.instruction(data))
	}
}
// ---------------------------------------------------------------------------
// treasury template lifecycle
// ---------------------------------------------------------------------------

/// Arguments for `create-template`.
#[derive(Debug, clap::Args)]
pub struct CreateTemplateArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Box mint the template will mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Template id; the template PDA is derived from authority and id.
	#[arg(long)]
	pub id: u64,
	/// Earliest opening timestamp (unix seconds).
	#[arg(long)]
	pub opens_at: i64,
	/// Switchboard On-Demand program (mainnet or devnet).
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Switchboard queue that will serve randomness.
	#[arg(long)]
	pub oracle_queue: Pubkey,
	/// Template name, at most 32 bytes.
	#[arg(long)]
	pub name: String,
	/// Metadata URI, at most 200 bytes.
	#[arg(long)]
	pub uri: String,
	/// Template PDA bump; derived when omitted.
	#[arg(long)]
	pub bump: Option<u8>,
}

impl CreateTemplateArgs {
	fn template_pda(&self) -> Pubkey {
		generated_accounts::TemplateState::find_pda(&self.authority, self.id).0
	}

	fn bump(&self) -> u8 {
		self.bump.unwrap_or_else(|| {
			generated_accounts::TemplateState::find_pda(&self.authority, self.id).1
		})
	}
}

impl InstructionBuilder for CreateTemplateArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts =
			generated::CreateTemplate::new(self.authority, self.template_pda(), self.box_mint);
		let id = self.id;
		let opens_at = self.opens_at;
		let oracle_program = self.oracle_program;
		let oracle_queue = self.oracle_queue;
		let name = text_arg::<32>(&self.name, "name")?;
		let uri = text_arg::<200>(&self.uri, "uri")?;
		let bump = self.bump();
		let data = generated::CreateTemplateInstructionData::new(|wire| {
			wire.id = id.into();
			wire.opens_at = opens_at.into();
			wire.oracle_program = oracle_program;
			wire.oracle_queue = oracle_queue;
			wire.name = name;
			wire.uri = uri;
			wire.bump = bump;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `add-bundle`.
#[derive(Debug, clap::Args)]
pub struct AddBundleArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template receiving the bundle.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA that will hold the prizes.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Number of prizes in the bundle.
	#[arg(long)]
	pub quantity: u64,
	/// Number of prize assets appended as remaining accounts.
	#[arg(long)]
	pub asset_count: u8,
	/// Writable remaining accounts (the bundle's prize assets).
	#[arg(long = "remaining-writable")]
	#[arg(long)]
	pub remaining_writable: Vec<Pubkey>,
	/// Read-only remaining accounts.
	#[arg(long = "remaining-readonly")]
	#[arg(long)]
	pub remaining_readonly: Vec<Pubkey>,
}

impl InstructionBuilder for AddBundleArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let remaining = self.remaining_writable.len() + self.remaining_readonly.len();
		if remaining != self.asset_count as usize {
			return Err(CliError::AssetCountMismatch {
				declared: self.asset_count as usize,
				remaining,
			});
		}

		let accounts = generated::AddBundle::new(self.authority, self.template, self.bundle);
		let quantity = self.quantity;
		let asset_count = self.asset_count;
		let data = generated::AddBundleInstructionData::new(|wire| {
			wire.quantity = quantity.into();
			wire.asset_count = asset_count;
		})?;
		let remaining = remaining_metas(&self.remaining_writable, &self.remaining_readonly);

		Ok(accounts.instruction_with_remaining_accounts(data, &remaining))
	}
}

/// Arguments for `seal-template`.
#[derive(Debug, clap::Args)]
pub struct SealTemplateArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template to seal.
	#[arg(long)]
	pub template: Pubkey,
}

impl InstructionBuilder for SealTemplateArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::SealTemplate::new(self.authority, self.template);
		let data = generated::SealTemplateInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `mint-template-boxes`.
#[derive(Debug, clap::Args)]
pub struct MintTemplateBoxesArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template minting the boxes.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Destination box token account.
	#[arg(long)]
	pub recipient_box_account: Pubkey,
	/// Number of boxes to mint.
	#[arg(long)]
	pub amount: u64,
}

impl InstructionBuilder for MintTemplateBoxesArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::MintTemplateBoxes::new(
			self.authority,
			self.template,
			self.box_mint,
			self.recipient_box_account,
		);
		let amount = self.amount;
		let data = generated::MintTemplateBoxesInstructionData::new(|wire| {
			wire.amount = amount.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `request-template-open`.
#[derive(Debug, clap::Args)]
pub struct RequestTemplateOpenArgs {
	/// Box holder opening the template box.
	#[arg(long)]
	pub box_authority: Pubkey,
	/// Payer funding oracle bookkeeping.
	#[arg(long)]
	pub payer: Pubkey,
	/// Template whose box is opened.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Holder's box token account.
	#[arg(long)]
	pub box_account: Pubkey,
	/// Template-opening receipt PDA.
	#[arg(long)]
	pub opening: Pubkey,
	/// Fresh randomness account created for this open.
	#[arg(long)]
	pub randomness: Pubkey,
	/// Reward escrow PDA.
	#[arg(long)]
	pub reward_escrow: Pubkey,
	/// Switchboard queue.
	#[arg(long)]
	pub oracle_queue: Pubkey,
	/// Switchboard oracle.
	#[arg(long)]
	pub oracle: Pubkey,
	/// Recent slot-hashes sysvar.
	#[arg(long)]
	pub recent_slot_hashes: Pubkey,
	/// Switchboard On-Demand program.
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Switchboard program state.
	#[arg(long)]
	pub oracle_program_state: Pubkey,
	/// Switchboard lookup-table signer.
	#[arg(long)]
	pub oracle_lut_signer: Pubkey,
	/// Switchboard lookup table.
	#[arg(long)]
	pub oracle_lut: Pubkey,
	/// Wrapped-SOL mint.
	#[arg(long)]
	pub wrapped_sol_mint: Pubkey,
	/// Address-lookup-table program.
	#[arg(long)]
	pub address_lookup_table_program: Pubkey,
	/// Beneficiary for the consumer program.
	#[arg(long)]
	pub beneficiary: Pubkey,
	/// Consumer program for the consumer context.
	#[arg(long)]
	pub consumer_program: Pubkey,
	/// Consumer context (hex).
	#[arg(long)]
	pub consumer_context: String,
	/// Recent slot used by Switchboard to derive its lookup table.
	#[arg(long)]
	pub recent_slot: u64,
	/// Template-opening PDA bump.
	#[arg(long)]
	pub bump: u8,
}

impl InstructionBuilder for RequestTemplateOpenArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::RequestTemplateOpen::new(
			self.box_authority,
			self.payer,
			self.template,
			self.box_mint,
			self.box_account,
			self.opening,
			self.randomness,
			self.reward_escrow,
			self.oracle_queue,
			self.oracle,
			self.recent_slot_hashes,
			self.oracle_program,
			self.oracle_program_state,
			self.oracle_lut_signer,
			self.oracle_lut,
			self.wrapped_sol_mint,
			self.address_lookup_table_program,
		);
		let beneficiary = self.beneficiary;
		let consumer_program = self.consumer_program;
		let consumer_context = hex_arg::<32>(&self.consumer_context, "consumer_context")?;
		let recent_slot = self.recent_slot;
		let bump = self.bump;
		let data = generated::RequestTemplateOpenInstructionData::new(|wire| {
			wire.beneficiary = beneficiary;
			wire.consumer_program = consumer_program;
			wire.consumer_context = consumer_context;
			wire.recent_slot = recent_slot.into();
			wire.bump = bump;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `fulfill-template-open`.
#[derive(Debug, clap::Args)]
pub struct FulfillTemplateOpenArgs {
	/// Payer funding oracle bookkeeping.
	#[arg(long)]
	pub payer: Pubkey,
	/// Template whose box is revealed.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Service vault PDA.
	#[arg(long)]
	pub service_vault: Pubkey,
	/// Randomness account.
	#[arg(long)]
	pub randomness: Pubkey,
	/// Switchboard queue.
	#[arg(long)]
	pub oracle_queue: Pubkey,
	/// Switchboard oracle.
	#[arg(long)]
	pub oracle: Pubkey,
	/// Oracle stats tracker.
	#[arg(long)]
	pub oracle_stats: Pubkey,
	/// Recent slot-hashes sysvar.
	#[arg(long)]
	pub recent_slot_hashes: Pubkey,
	/// Switchboard On-Demand program.
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Switchboard program state.
	#[arg(long)]
	pub oracle_program_state: Pubkey,
	/// Wrapped-SOL mint.
	#[arg(long)]
	pub wrapped_sol_mint: Pubkey,
	/// Enclave signature returned by the Switchboard gateway (hex).
	#[arg(long)]
	pub signature: String,
	/// Secp256k1 recovery identifier returned by the gateway.
	#[arg(long)]
	pub recovery_id: u8,
	/// Revealed value covered by the signature (hex).
	#[arg(long)]
	pub value: String,
}

impl InstructionBuilder for FulfillTemplateOpenArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::FulfillTemplateOpen::new(
			self.payer,
			self.template,
			self.service_vault,
			self.service_vault,
			self.opening,
			self.randomness,
			self.oracle_queue,
			self.oracle,
			self.oracle_stats,
			self.recent_slot_hashes,
			self.oracle_program,
			self.oracle_program_state,
			self.wrapped_sol_mint,
		);
		let signature = hex_arg::<64>(&self.signature, "signature")?;
		let recovery_id = self.recovery_id;
		let value = hex_arg::<32>(&self.value, "value")?;
		let data = generated::FulfillTemplateOpenInstructionData::new(|wire| {
			wire.signature = signature;
			wire.recovery_id = recovery_id;
			wire.value = value;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `allocate-template-open`.
#[derive(Debug, clap::Args)]
pub struct AllocateTemplateOpenArgs {
	/// Template whose bundle is allocated.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Bundle PDA receiving the allocation.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Service vault PDA.
	#[arg(long)]
	pub service_vault: Pubkey,
	/// Result receipt PDA.
	#[arg(long)]
	pub result_receipt: Pubkey,
}

impl InstructionBuilder for AllocateTemplateOpenArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::AllocateTemplateOpen::new(
			self.template,
			self.opening,
			self.bundle,
			self.service_vault,
			self.result_receipt,
		);
		let data = generated::AllocateTemplateOpenInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `forfeit-template-open`.
#[derive(Debug, clap::Args)]
pub struct ForfeitTemplateOpenArgs {
	/// Any signer advancing an expired FIFO head.
	#[arg(long)]
	pub caller: Pubkey,
	/// Template whose opening is forfeited.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Service vault PDA.
	#[arg(long)]
	pub service_vault: Pubkey,
	/// Randomness account.
	#[arg(long)]
	pub randomness: Pubkey,
}

impl InstructionBuilder for ForfeitTemplateOpenArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ForfeitTemplateOpen::new(
			self.caller,
			self.template,
			self.service_vault,
			self.opening,
			self.randomness,
		);
		let data = generated::ForfeitTemplateOpenInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `close-template-opening`.
#[derive(Debug, clap::Args)]
pub struct CloseTemplateOpeningArgs {
	/// Opening recipient receiving the reclaimed rent.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Template the opening belonged to.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt to close.
	#[arg(long)]
	pub opening: Pubkey,
	/// Randomness account.
	#[arg(long)]
	pub randomness: Pubkey,
	/// Reward escrow.
	#[arg(long)]
	pub reward_escrow: Pubkey,
	/// Switchboard On-Demand program.
	#[arg(long)]
	pub oracle_program: Pubkey,
	/// Switchboard program state.
	#[arg(long)]
	pub oracle_program_state: Pubkey,
	/// Switchboard lookup table.
	#[arg(long)]
	pub oracle_lut: Pubkey,
	/// Switchboard lookup-table signer.
	#[arg(long)]
	pub oracle_lut_signer: Pubkey,
	/// Wrapped-SOL mint.
	#[arg(long)]
	pub wrapped_sol_mint: Pubkey,
	/// Address-lookup-table program.
	#[arg(long)]
	pub address_lookup_table_program: Pubkey,
}

impl InstructionBuilder for CloseTemplateOpeningArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::CloseTemplateOpening::new(
			self.recipient,
			self.template,
			self.opening,
			self.randomness,
			self.reward_escrow,
			self.oracle_program,
			self.oracle_program_state,
			self.oracle_lut,
			self.oracle_lut_signer,
			self.wrapped_sol_mint,
			self.address_lookup_table_program,
		);
		let data = generated::CloseTemplateOpeningInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `retire-template`.
#[derive(Debug, clap::Args)]
pub struct RetireTemplateArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template to retire.
	#[arg(long)]
	pub template: Pubkey,
}

impl InstructionBuilder for RetireTemplateArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::RetireTemplate::new(self.authority, self.template);
		let data = generated::RetireTemplateInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `lock-treasury`.
#[derive(Debug, clap::Args)]
pub struct LockTreasuryArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose treasury is locked.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Bundle PDA.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Service vault PDA.
	#[arg(long)]
	pub service_vault: Pubkey,
}

impl InstructionBuilder for LockTreasuryArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::LockTreasury::new(
			self.authority,
			self.template,
			self.box_mint,
			self.bundle,
			self.service_vault,
		);
		let data = generated::LockTreasuryInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `activate-bundle`.
#[derive(Debug, clap::Args)]
pub struct ActivateBundleArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose bundle is activated.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA to activate.
	#[arg(long)]
	pub bundle: Pubkey,
}

impl InstructionBuilder for ActivateBundleArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ActivateBundle::new(self.authority, self.template, self.bundle);
		let data = generated::ActivateBundleInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `cancel-bundle`.
#[derive(Debug, clap::Args)]
pub struct CancelBundleArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose bundle is cancelled.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA to cancel.
	#[arg(long)]
	pub bundle: Pubkey,
}

impl InstructionBuilder for CancelBundleArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::CancelBundle::new(self.authority, self.template, self.bundle);
		let data = generated::CancelBundleInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `fund-sol-prize`.
#[derive(Debug, clap::Args)]
pub struct FundSolPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template funding the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA receiving the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// SOL payout per winning box, in lamports.
	#[arg(long)]
	pub lamports_per_win: u64,
}

impl InstructionBuilder for FundSolPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::FundSolPrize::new(self.authority, self.template, self.bundle);
		let lamports_per_win = self.lamports_per_win;
		let data = generated::FundSolPrizeInstructionData::new(|wire| {
			wire.lamports_per_win = lamports_per_win.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `fund-token-prize`.
#[derive(Debug, clap::Args)]
pub struct FundTokenPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template funding the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA receiving the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize token mint.
	#[arg(long)]
	pub mint: Pubkey,
	/// Source token account funding the prize.
	#[arg(long)]
	pub source: Pubkey,
	/// Bundle escrow token account.
	#[arg(long)]
	pub escrow: Pubkey,
	/// Payout per winning box, in base units.
	#[arg(long)]
	pub amount_per_win: u64,
	/// Whether the prize is an NFT (one recipient per bundle).
	#[arg(long)]
	pub is_nft: bool,
}

impl InstructionBuilder for FundTokenPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::FundTokenPrize::new(
			self.authority,
			self.template,
			self.bundle,
			self.mint,
			self.source,
			self.escrow,
		);
		let amount_per_win = self.amount_per_win;
		let is_nft = self.is_nft;
		let data = generated::FundTokenPrizeInstructionData::new(|wire| {
			wire.amount_per_win = amount_per_win.into();
			wire.is_nft = is_nft.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `fund-metadata-nft-prize`.
#[derive(Debug, clap::Args)]
pub struct FundMetadataNftPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template funding the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA receiving the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize NFT mint.
	#[arg(long)]
	pub mint: Pubkey,
	/// Source token account.
	#[arg(long)]
	pub source: Pubkey,
	/// Bundle escrow token account.
	#[arg(long)]
	pub escrow: Pubkey,
	/// Token metadata account.
	#[arg(long)]
	pub metadata: Pubkey,
	/// Token-metadata program.
	#[arg(long)]
	pub token_metadata_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Instructions sysvar.
	#[arg(long)]
	pub instructions_sysvar: Pubkey,
	/// Token program.
	#[arg(long)]
	pub token_program: Pubkey,
	/// Associated-token program.
	#[arg(long)]
	pub associated_token_program: Pubkey,
	/// Optional accounts supplied by the caller.
	#[arg(long)]
	pub optional_accounts: Pubkey,
}

impl InstructionBuilder for FundMetadataNftPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::FundMetadataNftPrize::new(
			self.authority,
			self.template,
			self.bundle,
			self.mint,
			self.source,
			self.escrow,
			self.metadata,
			self.token_metadata_program,
			self.system_program,
			self.instructions_sysvar,
			self.token_program,
			self.associated_token_program,
			self.optional_accounts,
		);
		let data = generated::FundMetadataNftPrizeInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `fund-core-asset-prize`.
#[derive(Debug, clap::Args)]
pub struct FundCoreAssetPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template funding the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA receiving the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Core asset.
	#[arg(long)]
	pub asset: Pubkey,
	/// Core asset collection.
	#[arg(long)]
	pub collection: Pubkey,
	/// Core program.
	#[arg(long)]
	pub core_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Log wrapper program.
	#[arg(long)]
	pub log_wrapper: Pubkey,
	/// Plugin accounts supplied by the caller.
	#[arg(long)]
	pub plugin_accounts: Pubkey,
}

impl InstructionBuilder for FundCoreAssetPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::FundCoreAssetPrize::new(
			self.authority,
			self.template,
			self.bundle,
			self.asset,
			self.collection,
			self.core_program,
			self.system_program,
			self.log_wrapper,
			self.plugin_accounts,
		);
		let data = generated::FundCoreAssetPrizeInstructionData::new(|_wire| {})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `fund-compressed-nft-prize`.
#[derive(Debug, clap::Args)]
pub struct FundCompressedNftPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template funding the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Bundle PDA receiving the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Compressed NFT tree config.
	#[arg(long)]
	pub tree_config: Pubkey,
	/// Merkle tree.
	#[arg(long)]
	pub merkle_tree: Pubkey,
	/// Bubblegum program.
	#[arg(long)]
	pub bubblegum_program: Pubkey,
	/// Log wrapper program.
	#[arg(long)]
	pub log_wrapper: Pubkey,
	/// Compression program.
	#[arg(long)]
	pub compression_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Proof accounts supplied by the caller.
	#[arg(long)]
	pub proof_accounts: Pubkey,
	/// Compressed asset root (hex).
	#[arg(long)]
	pub root: String,
	/// Compressed asset data hash (hex).
	#[arg(long)]
	pub data_hash: String,
	/// Compressed asset creator hash (hex).
	#[arg(long)]
	pub creator_hash: String,
	/// Compressed asset nonce.
	#[arg(long)]
	pub nonce: u64,
	/// Compressed asset index.
	#[arg(long)]
	pub index: u32,
}

impl InstructionBuilder for FundCompressedNftPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::FundCompressedNftPrize::new(
			self.authority,
			self.template,
			self.bundle,
			self.tree_config,
			self.merkle_tree,
			self.bubblegum_program,
			self.log_wrapper,
			self.compression_program,
			self.system_program,
			self.proof_accounts,
		);
		let root = hex_arg::<32>(&self.root, "root")?;
		let data_hash = hex_arg::<32>(&self.data_hash, "data_hash")?;
		let creator_hash = hex_arg::<32>(&self.creator_hash, "creator_hash")?;
		let nonce = self.nonce;
		let index = self.index;
		let data = generated::FundCompressedNftPrizeInstructionData::new(|wire| {
			wire.root = root;
			wire.data_hash = data_hash;
			wire.creator_hash = creator_hash;
			wire.nonce = nonce.into();
			wire.index = index.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `claim-sol-prize`.
#[derive(Debug, clap::Args)]
pub struct ClaimSolPrizeArgs {
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Bundle PDA paying the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize recipient.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Index of the winning prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ClaimSolPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts =
			generated::ClaimSolPrize::new(self.template, self.opening, self.bundle, self.recipient);
		let asset_index = self.asset_index;
		let data = generated::ClaimSolPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `claim-token-prize`.
#[derive(Debug, clap::Args)]
pub struct ClaimTokenPrizeArgs {
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Bundle PDA paying the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize recipient.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Prize token mint.
	#[arg(long)]
	pub mint: Pubkey,
	/// Bundle escrow token account.
	#[arg(long)]
	pub escrow: Pubkey,
	/// Destination token account.
	#[arg(long)]
	pub destination: Pubkey,
	/// Index of the winning prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ClaimTokenPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ClaimTokenPrize::new(
			self.template,
			self.opening,
			self.bundle,
			self.recipient,
			self.mint,
			self.escrow,
			self.destination,
		);
		let asset_index = self.asset_index;
		let data = generated::ClaimTokenPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `claim-metadata-nft-prize`.
#[derive(Debug, clap::Args)]
pub struct ClaimMetadataNftPrizeArgs {
	/// Payer funding the claim.
	#[arg(long)]
	pub payer: Pubkey,
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Bundle PDA paying the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize recipient.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Prize NFT mint.
	#[arg(long)]
	pub mint: Pubkey,
	/// Bundle escrow token account.
	#[arg(long)]
	pub escrow: Pubkey,
	/// Destination token account.
	#[arg(long)]
	pub destination: Pubkey,
	/// Token metadata account.
	#[arg(long)]
	pub metadata: Pubkey,
	/// Token-metadata program.
	#[arg(long)]
	pub token_metadata_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Instructions sysvar.
	#[arg(long)]
	pub instructions_sysvar: Pubkey,
	/// Token program.
	#[arg(long)]
	pub token_program: Pubkey,
	/// Associated-token program.
	#[arg(long)]
	pub associated_token_program: Pubkey,
	/// Optional accounts supplied by the caller.
	#[arg(long)]
	pub optional_accounts: Pubkey,
	/// Index of the winning prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ClaimMetadataNftPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ClaimMetadataNftPrize::new(
			self.payer,
			self.template,
			self.opening,
			self.bundle,
			self.recipient,
			self.mint,
			self.escrow,
			self.destination,
			self.metadata,
			self.token_metadata_program,
			self.system_program,
			self.instructions_sysvar,
			self.token_program,
			self.associated_token_program,
			self.optional_accounts,
		);
		let asset_index = self.asset_index;
		let data = generated::ClaimMetadataNftPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `claim-core-asset-prize`.
#[derive(Debug, clap::Args)]
pub struct ClaimCoreAssetPrizeArgs {
	/// Payer funding the claim.
	#[arg(long)]
	pub payer: Pubkey,
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Bundle PDA paying the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize recipient.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Core asset.
	#[arg(long)]
	pub asset: Pubkey,
	/// Core asset collection.
	#[arg(long)]
	pub collection: Pubkey,
	/// Core program.
	#[arg(long)]
	pub core_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Log wrapper program.
	#[arg(long)]
	pub log_wrapper: Pubkey,
	/// Plugin accounts supplied by the caller.
	#[arg(long)]
	pub plugin_accounts: Pubkey,
	/// Index of the winning prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ClaimCoreAssetPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ClaimCoreAssetPrize::new(
			self.payer,
			self.template,
			self.opening,
			self.bundle,
			self.recipient,
			self.asset,
			self.collection,
			self.core_program,
			self.system_program,
			self.log_wrapper,
			self.plugin_accounts,
		);
		let asset_index = self.asset_index;
		let data = generated::ClaimCoreAssetPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `claim-compressed-nft-prize`.
#[derive(Debug, clap::Args)]
pub struct ClaimCompressedNftPrizeArgs {
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Template-opening receipt.
	#[arg(long)]
	pub opening: Pubkey,
	/// Bundle PDA paying the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize recipient.
	#[arg(long)]
	pub recipient: Pubkey,
	/// Compressed NFT tree config.
	#[arg(long)]
	pub tree_config: Pubkey,
	/// Merkle tree.
	#[arg(long)]
	pub merkle_tree: Pubkey,
	/// Bubblegum program.
	#[arg(long)]
	pub bubblegum_program: Pubkey,
	/// Log wrapper program.
	#[arg(long)]
	pub log_wrapper: Pubkey,
	/// Compression program.
	#[arg(long)]
	pub compression_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Proof accounts supplied by the caller.
	#[arg(long)]
	pub proof_accounts: Pubkey,
	/// Index of the winning prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
	/// Compressed asset root (hex).
	#[arg(long)]
	pub root: String,
	/// Compressed asset data hash (hex).
	#[arg(long)]
	pub data_hash: String,
	/// Compressed asset creator hash (hex).
	#[arg(long)]
	pub creator_hash: String,
	/// Compressed asset nonce.
	#[arg(long)]
	pub nonce: u64,
	/// Compressed asset index.
	#[arg(long)]
	pub index: u32,
}

impl InstructionBuilder for ClaimCompressedNftPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ClaimCompressedNftPrize::new(
			self.template,
			self.opening,
			self.bundle,
			self.recipient,
			self.tree_config,
			self.merkle_tree,
			self.bubblegum_program,
			self.log_wrapper,
			self.compression_program,
			self.system_program,
			self.proof_accounts,
		);
		let asset_index = self.asset_index;
		let root = hex_arg::<32>(&self.root, "root")?;
		let data_hash = hex_arg::<32>(&self.data_hash, "data_hash")?;
		let creator_hash = hex_arg::<32>(&self.creator_hash, "creator_hash")?;
		let nonce = self.nonce;
		let index = self.index;
		let data = generated::ClaimCompressedNftPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
			wire.root = root;
			wire.data_hash = data_hash;
			wire.creator_hash = creator_hash;
			wire.nonce = nonce.into();
			wire.index = index.into();
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `reclaim-sol-prize`.
#[derive(Debug, clap::Args)]
pub struct ReclaimSolPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Bundle PDA reclaiming the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Index of the exhausted prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ReclaimSolPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ReclaimSolPrize::new(
			self.authority,
			self.template,
			self.box_mint,
			self.bundle,
		);
		let asset_index = self.asset_index;
		let data = generated::ReclaimSolPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `reclaim-token-prize`.
#[derive(Debug, clap::Args)]
pub struct ReclaimTokenPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Bundle PDA reclaiming the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize token mint.
	#[arg(long)]
	pub mint: Pubkey,
	/// Bundle escrow token account.
	#[arg(long)]
	pub escrow: Pubkey,
	/// Destination token account.
	#[arg(long)]
	pub destination: Pubkey,
	/// Index of the exhausted prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ReclaimTokenPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ReclaimTokenPrize::new(
			self.authority,
			self.template,
			self.box_mint,
			self.bundle,
			self.mint,
			self.escrow,
			self.destination,
		);
		let asset_index = self.asset_index;
		let data = generated::ReclaimTokenPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `reclaim-metadata-nft-prize`.
#[derive(Debug, clap::Args)]
pub struct ReclaimMetadataNftPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Bundle PDA reclaiming the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Prize NFT mint.
	#[arg(long)]
	pub mint: Pubkey,
	/// Bundle escrow token account.
	#[arg(long)]
	pub escrow: Pubkey,
	/// Destination token account.
	#[arg(long)]
	pub destination: Pubkey,
	/// Token metadata account.
	#[arg(long)]
	pub metadata: Pubkey,
	/// Token-metadata program.
	#[arg(long)]
	pub token_metadata_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Instructions sysvar.
	#[arg(long)]
	pub instructions_sysvar: Pubkey,
	/// Token program.
	#[arg(long)]
	pub token_program: Pubkey,
	/// Associated-token program.
	#[arg(long)]
	pub associated_token_program: Pubkey,
	/// Optional accounts supplied by the caller.
	#[arg(long)]
	pub optional_accounts: Pubkey,
	/// Index of the exhausted prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ReclaimMetadataNftPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ReclaimMetadataNftPrize::new(
			self.authority,
			self.template,
			self.box_mint,
			self.bundle,
			self.mint,
			self.escrow,
			self.destination,
			self.metadata,
			self.token_metadata_program,
			self.system_program,
			self.instructions_sysvar,
			self.token_program,
			self.associated_token_program,
			self.optional_accounts,
		);
		let asset_index = self.asset_index;
		let data = generated::ReclaimMetadataNftPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `reclaim-core-asset-prize`.
#[derive(Debug, clap::Args)]
pub struct ReclaimCoreAssetPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Bundle PDA reclaiming the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Core asset.
	#[arg(long)]
	pub asset: Pubkey,
	/// Core asset collection.
	#[arg(long)]
	pub collection: Pubkey,
	/// Core program.
	#[arg(long)]
	pub core_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Log wrapper program.
	#[arg(long)]
	pub log_wrapper: Pubkey,
	/// Plugin accounts supplied by the caller.
	#[arg(long)]
	pub plugin_accounts: Pubkey,
	/// Index of the exhausted prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
}

impl InstructionBuilder for ReclaimCoreAssetPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ReclaimCoreAssetPrize::new(
			self.authority,
			self.template,
			self.box_mint,
			self.bundle,
			self.asset,
			self.collection,
			self.core_program,
			self.system_program,
			self.log_wrapper,
			self.plugin_accounts,
		);
		let asset_index = self.asset_index;
		let data = generated::ReclaimCoreAssetPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
		})?;

		Ok(accounts.instruction(data))
	}
}

/// Arguments for `reclaim-compressed-nft-prize`.
#[derive(Debug, clap::Args)]
pub struct ReclaimCompressedNftPrizeArgs {
	/// Template authority.
	#[arg(long)]
	pub authority: Pubkey,
	/// Template whose bundle pays the prize.
	#[arg(long)]
	pub template: Pubkey,
	/// Box mint.
	#[arg(long)]
	pub box_mint: Pubkey,
	/// Bundle PDA reclaiming the prize.
	#[arg(long)]
	pub bundle: Pubkey,
	/// Compressed NFT tree config.
	#[arg(long)]
	pub tree_config: Pubkey,
	/// Merkle tree.
	#[arg(long)]
	pub merkle_tree: Pubkey,
	/// Bubblegum program.
	#[arg(long)]
	pub bubblegum_program: Pubkey,
	/// Log wrapper program.
	#[arg(long)]
	pub log_wrapper: Pubkey,
	/// Compression program.
	#[arg(long)]
	pub compression_program: Pubkey,
	/// System program.
	#[arg(long)]
	pub system_program: Pubkey,
	/// Proof accounts supplied by the caller.
	#[arg(long)]
	pub proof_accounts: Pubkey,
	/// Index of the exhausted prize within the bundle.
	#[arg(long)]
	pub asset_index: u8,
	/// Compressed asset root (hex).
	#[arg(long)]
	pub root: String,
	/// Compressed asset data hash (hex).
	#[arg(long)]
	pub data_hash: String,
	/// Compressed asset creator hash (hex).
	#[arg(long)]
	pub creator_hash: String,
	/// Compressed asset nonce.
	#[arg(long)]
	pub nonce: u64,
	/// Compressed asset index.
	#[arg(long)]
	pub index: u32,
}

impl InstructionBuilder for ReclaimCompressedNftPrizeArgs {
	fn build(&self) -> Result<Instruction, CliError> {
		let accounts = generated::ReclaimCompressedNftPrize::new(
			self.authority,
			self.template,
			self.box_mint,
			self.bundle,
			self.tree_config,
			self.merkle_tree,
			self.bubblegum_program,
			self.log_wrapper,
			self.compression_program,
			self.system_program,
			self.proof_accounts,
		);
		let asset_index = self.asset_index;
		let root = hex_arg::<32>(&self.root, "root")?;
		let data_hash = hex_arg::<32>(&self.data_hash, "data_hash")?;
		let creator_hash = hex_arg::<32>(&self.creator_hash, "creator_hash")?;
		let nonce = self.nonce;
		let index = self.index;
		let data = generated::ReclaimCompressedNftPrizeInstructionData::new(|wire| {
			wire.asset_index = asset_index;
			wire.root = root;
			wire.data_hash = data_hash;
			wire.creator_hash = creator_hash;
			wire.nonce = nonce.into();
			wire.index = index.into();
		})?;

		Ok(accounts.instruction(data))
	}
}
