//! Command-line client for the lootbox program.
//!
//! The library builds every lootbox program instruction — addressing, account
//! metadata, and wire encoding — and renders it as text or JSON for any
//! execution path. With `--send` the built instruction is signed by the
//! `--keypair` payer and submitted through `--rpc`.
//!
//! Tests drive [`run`] with in-memory submit doubles; the thin RPC adapter
//! lives in the binary entrypoint.

pub mod build;
pub mod error;
pub mod output;
pub mod send;

pub use build::InstructionBuilder;
pub use error::CliError;
pub use send::Submit;
pub use send::SubmitOutcome;
use solana_instruction::Instruction;

/// Builds the instruction for the parsed subcommand.
pub fn build_command(command: &Command) -> Result<Instruction, CliError> {
	use build::InstructionBuilder;

	match command {
		Command::CreateLootbox(args) => args.build(),
		Command::Deposit(args) => args.build(),
		Command::AddOutcome(args) => args.build(),
		Command::Seal(args) => args.build(),
		Command::MintBoxes(args) => args.build(),
		Command::RequestOpen(args) => args.build(),
		Command::SettleOpen(args) => args.build(),
		Command::RefundOpen(args) => args.build(),
		Command::CloseOpening(args) => args.build(),
		Command::WithdrawSurplus(args) => args.build(),
		Command::CreateTemplate(args) => args.build(),
		Command::AddBundle(args) => args.build(),
		Command::SealTemplate(args) => args.build(),
		Command::MintTemplateBoxes(args) => args.build(),
		Command::RequestTemplateOpen(args) => args.build(),
		Command::FulfillTemplateOpen(args) => args.build(),
		Command::AllocateTemplateOpen(args) => args.build(),
		Command::ForfeitTemplateOpen(args) => args.build(),
		Command::CloseTemplateOpening(args) => args.build(),
		Command::RetireTemplate(args) => args.build(),
		Command::LockTreasury(args) => args.build(),
		Command::ActivateBundle(args) => args.build(),
		Command::CancelBundle(args) => args.build(),
		Command::FundSolPrize(args) => args.build(),
		Command::FundTokenPrize(args) => args.build(),
		Command::FundMetadataNftPrize(args) => args.build(),
		Command::FundCoreAssetPrize(args) => args.build(),
		Command::FundCompressedNftPrize(args) => args.build(),
		Command::ClaimSolPrize(args) => args.build(),
		Command::ClaimTokenPrize(args) => args.build(),
		Command::ClaimMetadataNftPrize(args) => args.build(),
		Command::ClaimCoreAssetPrize(args) => args.build(),
		Command::ClaimCompressedNftPrize(args) => args.build(),
		Command::ReclaimSolPrize(args) => args.build(),
		Command::ReclaimTokenPrize(args) => args.build(),
		Command::ReclaimMetadataNftPrize(args) => args.build(),
		Command::ReclaimCoreAssetPrize(args) => args.build(),
		Command::ReclaimCompressedNftPrize(args) => args.build(),
	}
}

#[cfg(test)]
mod tests;

use std::path::PathBuf;

use clap::Parser;
use output::render;

/// Top-level CLI: global options plus one subcommand per program instruction.
#[derive(Debug, Parser)]
#[command(
	name = "lootbox",
	version,
	about = "Build, print, and send every lootbox program instruction"
)]
pub struct Cli {
	/// Submit the built instruction through the RPC endpoint.
	#[arg(long, requires = "rpc", requires = "keypair")]
	pub send: bool,

	/// RPC URL used when `--send` is set.
	#[arg(long, global = true)]
	pub rpc: Option<String>,

	/// Payer keypair file used when `--send` is set.
	#[arg(long, global = true, value_name = "PATH")]
	pub keypair: Option<PathBuf>,

	/// Emit machine-readable JSON.
	#[arg(long, global = true)]
	pub json: bool,

	#[command(subcommand)]
	pub command: Command,
}

/// One subcommand per lootbox program instruction.
#[derive(Debug, clap::Subcommand)]
pub enum Command {
	/// Create a lootbox definition, its vault, and its box mint authority.
	CreateLootbox(build::CreateLootboxArgs),
	/// Deposit lamports into the vault.
	Deposit(build::DepositArgs),
	/// Append a weighted SOL outcome to the lootbox.
	AddOutcome(build::AddOutcomeArgs),
	/// Seal the lootbox before boxes can be opened.
	Seal(build::SealArgs),
	/// Mint boxes to a recipient.
	MintBoxes(build::MintBoxesArgs),
	/// Burn a box and commit oracle entropy for the open.
	RequestOpen(build::RequestOpenArgs),
	/// Reveal the committed randomness and allocate the reward.
	SettleOpen(build::SettleOpenArgs),
	/// Refund an expired opening.
	RefundOpen(build::RefundOpenArgs),
	/// Close the opening receipt and reclaim the randomness rent.
	CloseOpening(build::CloseOpeningArgs),
	/// Withdraw surplus lamports that are not owed to open boxes.
	WithdrawSurplus(build::WithdrawSurplusArgs),
	/// Create a treasury template, its box mint, and its bundle vault.
	CreateTemplate(build::CreateTemplateArgs),
	/// Append a fully collateralized prize bundle to the treasury.
	AddBundle(build::AddBundleArgs),
	/// Seal the template before boxes can be opened.
	SealTemplate(build::SealTemplateArgs),
	/// Mint template boxes to a recipient.
	MintTemplateBoxes(build::MintTemplateBoxesArgs),
	/// Burn a template box and commit oracle entropy for the open.
	RequestTemplateOpen(build::RequestTemplateOpenArgs),
	/// Reveal the committed randomness for a template opening.
	FulfillTemplateOpen(build::FulfillTemplateOpenArgs),
	/// Allocate one escrowed prize bundle to the revealed entropy.
	AllocateTemplateOpen(build::AllocateTemplateOpenArgs),
	/// Advance an expired FIFO head so the opening receives its floor.
	ForfeitTemplateOpen(build::ForfeitTemplateOpenArgs),
	/// Close the template-opening receipt and reclaim rent.
	CloseTemplateOpening(build::CloseTemplateOpeningArgs),
	/// Retire the template; every holder keeps the right to open.
	RetireTemplate(build::RetireTemplateArgs),
	/// Lock the treasury before its earliest reveal date.
	LockTreasury(build::LockTreasuryArgs),
	/// Activate a bundle into the allocation FIFO.
	ActivateBundle(build::ActivateBundleArgs),
	/// Cancel a bundle that is not yet in the FIFO.
	CancelBundle(build::CancelBundleArgs),
	/// Fund a bundle with a SOL prize.
	FundSolPrize(build::FundSolPrizeArgs),
	/// Fund a bundle with a token prize.
	FundTokenPrize(build::FundTokenPrizeArgs),
	/// Fund a bundle with a metadata NFT prize.
	FundMetadataNftPrize(build::FundMetadataNftPrizeArgs),
	/// Fund a bundle with a core asset prize.
	FundCoreAssetPrize(build::FundCoreAssetPrizeArgs),
	/// Fund a bundle with a compressed NFT prize.
	FundCompressedNftPrize(build::FundCompressedNftPrizeArgs),
	/// Claim the allocated SOL prize.
	ClaimSolPrize(build::ClaimSolPrizeArgs),
	/// Claim the allocated token prize.
	ClaimTokenPrize(build::ClaimTokenPrizeArgs),
	/// Claim the allocated metadata NFT prize.
	ClaimMetadataNftPrize(build::ClaimMetadataNftPrizeArgs),
	/// Claim the allocated core asset prize.
	ClaimCoreAssetPrize(build::ClaimCoreAssetPrizeArgs),
	/// Claim the allocated compressed NFT prize.
	ClaimCompressedNftPrize(build::ClaimCompressedNftPrizeArgs),
	/// Reclaim an exhausted SOL prize from the bundle.
	ReclaimSolPrize(build::ReclaimSolPrizeArgs),
	/// Reclaim an exhausted token prize from the bundle.
	ReclaimTokenPrize(build::ReclaimTokenPrizeArgs),
	/// Reclaim an exhausted metadata NFT prize from the bundle.
	ReclaimMetadataNftPrize(build::ReclaimMetadataNftPrizeArgs),
	/// Reclaim an exhausted core asset prize from the bundle.
	ReclaimCoreAssetPrize(build::ReclaimCoreAssetPrizeArgs),
	/// Reclaim an exhausted compressed NFT prize from the bundle.
	ReclaimCompressedNftPrize(build::ReclaimCompressedNftPrizeArgs),
}

/// Runs the parsed command, returning the rendered output text.
///
/// In build mode the rendered instruction is returned; in send mode the
/// rendered instruction and the submission outcome are returned.
pub fn run(cli: &Cli, submitter: Option<&dyn Submit>) -> Result<String, CliError> {
	let instruction = build_command(&cli.command)?;

	let rendered = render(&instruction);

	if !cli.send {
		return Ok(if cli.json {
			output::format_json(&rendered)
		} else {
			output::format_text(&rendered)
		});
	}

	let submitter = submitter.ok_or(CliError::MissingSubmit)?;
	let outcome = send::submit(submitter, &instruction)?;

	Ok(if cli.json {
		output::format_json_with_signature(&rendered, &outcome)
	} else {
		format!(
			"{}\nsignature: {}\n",
			output::format_text(&rendered),
			outcome.signature
		)
	})
}
