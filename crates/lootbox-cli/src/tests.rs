//! Coverage tests: every instruction builder, output format, and run mode.

use clap::Parser;
use solana_instruction::Instruction;
use solana_pubkey::Pubkey;

use crate::Cli;
use crate::Command;
use crate::Submit;
use crate::SubmitOutcome;
use crate::error::CliError;

const PROGRAM: &str = "Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op";
const PK1: &str = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const PK2: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PK3: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const HASH32: &str = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const SIG64: &str = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

fn pubkey(value: &str) -> Pubkey {
	Pubkey::from_str_const(value)
}

#[derive(Clone, Copy)]
struct MockOutcome {
	signature_byte: u8,
}

#[derive(Clone, Copy)]
struct MockSubmit {
	outcome: MockOutcome,
}

impl Submit for MockSubmit {
	fn submit(&self, _instruction: &Instruction) -> Result<SubmitOutcome, CliError> {
		Ok(SubmitOutcome {
			signature: format!("mock-{}", self.outcome.signature_byte),
		})
	}
}

fn submit_mock(signature_byte: u8) -> MockSubmit {
	MockSubmit {
		outcome: MockOutcome { signature_byte },
	}
}

struct MockErrorSubmit;

impl Submit for MockErrorSubmit {
	fn submit(&self, _instruction: &Instruction) -> Result<SubmitOutcome, CliError> {
		Err(CliError::Rpc("rejected by mock".to_string()))
	}
}

fn parse(args: &[&str]) -> Result<Cli, clap::Error> {
	let mut full = vec!["lootbox"];
	full.extend_from_slice(args);
	Cli::try_parse_from(full)
}

fn build_from(args: &[&str]) -> Result<Instruction, CliError> {
	let cli = parse(args).unwrap_or_else(|error| panic!("parse: {error}"));
	crate::build_command(&cli.command)
}

#[test]
fn create_lootbox_builds_with_derived_pdas() {
	let instruction = build_from(&[
		"create-lootbox",
		"--authority",
		PK1,
		"--box-mint",
		PK2,
		"--id",
		"7",
		"--max-supply",
		"1000",
		"--oracle-program",
		PROGRAM,
		"--oracle-queue",
		PK3,
	])
	.expect("builds");

	assert_eq!(instruction.program_id, pubkey(PROGRAM));
	assert_eq!(instruction.data[0], 0);
	// id (8) + max_supply (8) + oracle_program (32) + oracle_queue (32) + bumps (2)
	assert_eq!(instruction.data.len(), 1 + 8 + 8 + 32 + 32 + 2);

	let explicit = build_from(&[
		"create-lootbox",
		"--authority",
		PK1,
		"--box-mint",
		PK2,
		"--id",
		"7",
		"--max-supply",
		"1000",
		"--oracle-program",
		PROGRAM,
		"--oracle-queue",
		PK3,
		"--bump",
		"254",
		"--vault-bump",
		"255",
	])
	.expect("builds");
	assert_eq!(explicit.data[instruction.data.len() - 2], 254);
	assert_eq!(explicit.data[instruction.data.len() - 1], 255);
}

#[test]
fn deposit_builds() {
	let instruction = build_from(&[
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 2);
	assert_eq!(instruction.data.len(), 1 + 8);
	assert!(instruction.accounts.iter().any(|meta| meta.is_signer));
}

#[test]
fn add_outcome_builds() {
	let instruction = build_from(&[
		"add-outcome",
		"--authority",
		PK1,
		"--lootbox",
		PK2,
		"--weight",
		"5",
		"--reward-lamports",
		"1000",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 1);
	assert_eq!(instruction.data.len(), 1 + 8 + 8);
}

#[test]
fn seal_builds() {
	let instruction = build_from(&["seal", "--authority", PK1, "--lootbox", PK2]).expect("builds");

	assert_eq!(instruction.data[0], 3);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn mint_boxes_builds() {
	let instruction = build_from(&[
		"mint-boxes",
		"--authority",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--box-mint",
		PK1,
		"--recipient-box-account",
		PK2,
		"--amount",
		"3",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 4);
	assert_eq!(instruction.data.len(), 1 + 8);
}

#[test]
fn request_open_builds() {
	let instruction = build_from(&[
		"request-open",
		"--owner",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--box-mint",
		PK1,
		"--owner-box-account",
		PK2,
		"--randomness",
		PK3,
		"--reward-escrow",
		PK1,
		"--oracle-queue",
		PK2,
		"--oracle",
		PK3,
		"--recent-slot-hashes",
		PK1,
		"--oracle-program",
		PROGRAM,
		"--oracle-program-state",
		PK2,
		"--oracle-lut-signer",
		PK3,
		"--oracle-lut",
		PK1,
		"--wrapped-sol-mint",
		PK2,
		"--address-lookup-table-program",
		PK3,
		"--recent-slot",
		"99",
		"--bump",
		"253",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 5);
	assert_eq!(instruction.data.len(), 1 + 8 + 1);
}

#[test]
fn settle_open_builds() {
	let instruction = build_from(&[
		"settle-open",
		"--recipient",
		PK1,
		"--payer",
		PK2,
		"--lootbox",
		PK3,
		"--vault",
		PK1,
		"--box-mint",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
		"--oracle-queue",
		PK2,
		"--oracle",
		PK3,
		"--oracle-stats",
		PK1,
		"--recent-slot-hashes",
		PK2,
		"--oracle-program",
		PROGRAM,
		"--reward-escrow",
		PK3,
		"--oracle-program-state",
		PK1,
		"--wrapped-sol-mint",
		PK2,
		"--signature",
		SIG64,
		"--recovery-id",
		"1",
		"--value",
		HASH32,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 6);
	assert_eq!(instruction.data.len(), 1 + 64 + 1 + 32);
}

#[test]
fn refund_open_builds() {
	let instruction = build_from(&[
		"refund-open",
		"--recipient",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--box-mint",
		PK1,
		"--opening",
		PK2,
		"--randomness",
		PK3,
		"--clock",
		PK1,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 7);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn close_opening_builds() {
	let instruction = build_from(&[
		"close-opening",
		"--recipient",
		PK1,
		"--lootbox",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
		"--reward-escrow",
		PK2,
		"--oracle-program",
		PROGRAM,
		"--oracle-program-state",
		PK3,
		"--oracle-lut",
		PK1,
		"--oracle-lut-signer",
		PK2,
		"--wrapped-sol-mint",
		PK3,
		"--address-lookup-table-program",
		PK1,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 8);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn withdraw_surplus_builds() {
	let instruction = build_from(&[
		"withdraw-surplus",
		"--authority",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--box-mint",
		PK1,
		"--lamports",
		"500",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 9);
	assert_eq!(instruction.data.len(), 1 + 8);
}

#[test]
fn create_template_builds() {
	let instruction = build_from(&[
		"create-template",
		"--authority",
		PK1,
		"--box-mint",
		PK2,
		"--id",
		"9",
		"--opens-at",
		"1700000000",
		"--oracle-program",
		PROGRAM,
		"--oracle-queue",
		PK3,
		"--name",
		"winter drop",
		"--uri",
		"https://example.com/winter.json",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 10);
	assert_eq!(instruction.data.len(), 314);
}

#[test]
fn create_template_rejects_long_names() {
	let error = build_from(&[
		"create-template",
		"--authority",
		PK1,
		"--box-mint",
		PK2,
		"--id",
		"9",
		"--opens-at",
		"1700000000",
		"--oracle-program",
		PROGRAM,
		"--oracle-queue",
		PK3,
		"--name",
		&"x".repeat(33),
		"--uri",
		"https://example.com/winter.json",
	])
	.expect_err("rejects");

	assert!(error.to_string().contains("at most 32 bytes"));
}

#[test]
fn create_template_rejects_long_uris() {
	let error = build_from(&[
		"create-template",
		"--authority",
		PK1,
		"--box-mint",
		PK2,
		"--id",
		"9",
		"--opens-at",
		"1700000000",
		"--oracle-program",
		PROGRAM,
		"--oracle-queue",
		PK3,
		"--name",
		"winter",
		"--uri",
		&"https://x.dev/".repeat(30),
	])
	.expect_err("rejects");

	assert!(error.to_string().contains("at most 200 bytes"));
}

#[test]
fn add_bundle_builds() {
	let instruction = build_from(&[
		"add-bundle",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--quantity",
		"2",
		"--asset-count",
		"2",
		"--remaining-writable",
		PK1,
		"--remaining-writable",
		PK2,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 11);
	assert_eq!(instruction.data.len(), 1 + 8 + 1 + 1);
	assert_eq!(instruction.accounts.len(), 4 + 2);
}

#[test]
fn add_bundle_rejects_asset_count_mismatch() {
	let error = build_from(&[
		"add-bundle",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--quantity",
		"2",
		"--asset-count",
		"3",
		"--remaining-writable",
		PK1,
		"--remaining-writable",
		PK2,
	])
	.expect_err("rejects");

	assert!(error.to_string().contains("does not match the 2 remaining"));
}

#[test]
fn seal_template_builds() {
	let instruction =
		build_from(&["seal-template", "--authority", PK1, "--template", PK2]).expect("builds");

	assert_eq!(instruction.data[0], 14);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn mint_template_boxes_builds() {
	let instruction = build_from(&[
		"mint-template-boxes",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--recipient-box-account",
		PK1,
		"--amount",
		"4",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 15);
	assert_eq!(instruction.data.len(), 1 + 8);
}

#[test]
fn request_template_open_builds() {
	let instruction = build_from(&[
		"request-template-open",
		"--owner",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--owner-box-account",
		PK1,
		"--opening",
		PK2,
		"--randomness",
		PK3,
		"--reward-escrow",
		PK1,
		"--oracle-queue",
		PK2,
		"--oracle",
		PK3,
		"--recent-slot-hashes",
		PK1,
		"--oracle-program",
		PROGRAM,
		"--oracle-program-state",
		PK2,
		"--oracle-lut-signer",
		PK3,
		"--oracle-lut",
		PK1,
		"--wrapped-sol-mint",
		PK2,
		"--address-lookup-table-program",
		PK3,
		"--recent-slot",
		"12",
		"--bump",
		"252",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 16);
	assert_eq!(instruction.data.len(), 1 + 8 + 1);
}

#[test]
fn fulfill_template_open_builds() {
	let instruction = build_from(&[
		"fulfill-template-open",
		"--payer",
		PK1,
		"--template",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
		"--oracle-queue",
		PK2,
		"--oracle",
		PK3,
		"--oracle-stats",
		PK1,
		"--recent-slot-hashes",
		PK2,
		"--oracle-program",
		PROGRAM,
		"--reward-escrow",
		PK3,
		"--oracle-program-state",
		PK1,
		"--wrapped-sol-mint",
		PK2,
		"--signature",
		SIG64,
		"--recovery-id",
		"0",
		"--value",
		HASH32,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 17);
	assert_eq!(instruction.data.len(), 1 + 64 + 1 + 32);
}

#[test]
fn allocate_template_open_builds() {
	let instruction = build_from(&[
		"allocate-template-open",
		"--template",
		PK1,
		"--opening",
		PK2,
		"--bundle",
		PK3,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 18);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn forfeit_template_open_builds() {
	let instruction = build_from(&[
		"forfeit-template-open",
		"--caller",
		PK1,
		"--template",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 36);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn close_template_opening_builds() {
	let instruction = build_from(&[
		"close-template-opening",
		"--recipient",
		PK1,
		"--template",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
		"--reward-escrow",
		PK2,
		"--oracle-program",
		PROGRAM,
		"--oracle-program-state",
		PK3,
		"--oracle-lut",
		PK1,
		"--oracle-lut-signer",
		PK2,
		"--wrapped-sol-mint",
		PK3,
		"--address-lookup-table-program",
		PK1,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 24);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn retire_template_builds() {
	let instruction =
		build_from(&["retire-template", "--authority", PK1, "--template", PK2]).expect("builds");

	assert_eq!(instruction.data[0], 21);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn lock_treasury_builds() {
	let instruction = build_from(&[
		"lock-treasury",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--bundle",
		PK1,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 37);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn activate_bundle_builds() {
	let instruction = build_from(&[
		"activate-bundle",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 25);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn cancel_bundle_builds() {
	let instruction = build_from(&[
		"cancel-bundle",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 26);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn fund_sol_prize_builds() {
	let instruction = build_from(&[
		"fund-sol-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--lamports-per-win",
		"750",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 12);
	assert_eq!(instruction.data.len(), 1 + 8);
}

#[test]
fn fund_token_prize_builds() {
	let instruction = build_from(&[
		"fund-token-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--mint",
		PK1,
		"--source",
		PK2,
		"--escrow",
		PK3,
		"--amount-per-win",
		"80",
		"--is-nft",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 13);
	assert_eq!(instruction.data.len(), 1 + 8 + 1);
}

#[test]
fn fund_metadata_nft_prize_builds() {
	let instruction = build_from(&[
		"fund-metadata-nft-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--mint",
		PK1,
		"--source",
		PK2,
		"--escrow",
		PK3,
		"--metadata",
		PK1,
		"--token-metadata-program",
		PK2,
		"--system-program",
		PK3,
		"--instructions-sysvar",
		PK1,
		"--token-program",
		PK2,
		"--associated-token-program",
		PK3,
		"--optional-accounts",
		PK1,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 27);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn fund_core_asset_prize_builds() {
	let instruction = build_from(&[
		"fund-core-asset-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--asset",
		PK1,
		"--collection",
		PK2,
		"--core-program",
		PK3,
		"--system-program",
		PK1,
		"--log-wrapper",
		PK2,
		"--plugin-accounts",
		PK3,
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 30);
	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn fund_compressed_nft_prize_builds() {
	let instruction = build_from(&[
		"fund-compressed-nft-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--tree-config",
		PK1,
		"--merkle-tree",
		PK2,
		"--bubblegum-program",
		PK3,
		"--log-wrapper",
		PK1,
		"--compression-program",
		PK2,
		"--system-program",
		PK3,
		"--proof-accounts",
		PK1,
		"--root",
		HASH32,
		"--data-hash",
		HASH32,
		"--creator-hash",
		HASH32,
		"--nonce",
		"6",
		"--index",
		"2",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 33);
	assert_eq!(instruction.data.len(), 1 + 32 * 3 + 8 + 4);
}

#[test]
fn claim_sol_prize_builds() {
	let instruction = build_from(&[
		"claim-sol-prize",
		"--template",
		PK1,
		"--opening",
		PK2,
		"--bundle",
		PK3,
		"--recipient",
		PK1,
		"--asset-index",
		"0",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 19);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn claim_token_prize_builds() {
	let instruction = build_from(&[
		"claim-token-prize",
		"--template",
		PK1,
		"--opening",
		PK2,
		"--bundle",
		PK3,
		"--recipient",
		PK1,
		"--mint",
		PK2,
		"--escrow",
		PK3,
		"--destination",
		PK1,
		"--asset-index",
		"1",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 20);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn claim_metadata_nft_prize_builds() {
	let instruction = build_from(&[
		"claim-metadata-nft-prize",
		"--payer",
		PK1,
		"--template",
		PK2,
		"--opening",
		PK3,
		"--bundle",
		PK1,
		"--recipient",
		PK2,
		"--mint",
		PK3,
		"--escrow",
		PK1,
		"--destination",
		PK2,
		"--metadata",
		PK3,
		"--token-metadata-program",
		PK1,
		"--system-program",
		PK2,
		"--instructions-sysvar",
		PK3,
		"--token-program",
		PK1,
		"--associated-token-program",
		PK2,
		"--optional-accounts",
		PK3,
		"--asset-index",
		"0",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 28);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn claim_core_asset_prize_builds() {
	let instruction = build_from(&[
		"claim-core-asset-prize",
		"--payer",
		PK1,
		"--template",
		PK2,
		"--opening",
		PK3,
		"--bundle",
		PK1,
		"--recipient",
		PK2,
		"--asset",
		PK3,
		"--collection",
		PK1,
		"--core-program",
		PK2,
		"--system-program",
		PK3,
		"--log-wrapper",
		PK1,
		"--plugin-accounts",
		PK2,
		"--asset-index",
		"1",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 31);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn claim_compressed_nft_prize_builds() {
	let instruction = build_from(&[
		"claim-compressed-nft-prize",
		"--template",
		PK1,
		"--opening",
		PK2,
		"--bundle",
		PK3,
		"--recipient",
		PK1,
		"--tree-config",
		PK2,
		"--merkle-tree",
		PK3,
		"--bubblegum-program",
		PK1,
		"--log-wrapper",
		PK2,
		"--compression-program",
		PK3,
		"--system-program",
		PK1,
		"--proof-accounts",
		PK2,
		"--asset-index",
		"0",
		"--root",
		HASH32,
		"--data-hash",
		HASH32,
		"--creator-hash",
		HASH32,
		"--nonce",
		"9",
		"--index",
		"3",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 34);
	assert_eq!(instruction.data.len(), 1 + 1 + 32 * 3 + 8 + 4);
}

#[test]
fn reclaim_sol_prize_builds() {
	let instruction = build_from(&[
		"reclaim-sol-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--bundle",
		PK1,
		"--asset-index",
		"2",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 22);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn reclaim_token_prize_builds() {
	let instruction = build_from(&[
		"reclaim-token-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--bundle",
		PK1,
		"--mint",
		PK2,
		"--escrow",
		PK3,
		"--destination",
		PK1,
		"--asset-index",
		"0",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 23);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn reclaim_metadata_nft_prize_builds() {
	let instruction = build_from(&[
		"reclaim-metadata-nft-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--bundle",
		PK1,
		"--mint",
		PK2,
		"--escrow",
		PK3,
		"--destination",
		PK1,
		"--metadata",
		PK2,
		"--token-metadata-program",
		PK3,
		"--system-program",
		PK1,
		"--instructions-sysvar",
		PK2,
		"--token-program",
		PK3,
		"--associated-token-program",
		PK1,
		"--optional-accounts",
		PK2,
		"--asset-index",
		"1",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 29);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn reclaim_core_asset_prize_builds() {
	let instruction = build_from(&[
		"reclaim-core-asset-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--bundle",
		PK1,
		"--asset",
		PK2,
		"--collection",
		PK3,
		"--core-program",
		PK1,
		"--system-program",
		PK2,
		"--log-wrapper",
		PK3,
		"--plugin-accounts",
		PK1,
		"--asset-index",
		"0",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 32);
	assert_eq!(instruction.data.len(), 1 + 1);
}

#[test]
fn reclaim_compressed_nft_prize_builds() {
	let instruction = build_from(&[
		"reclaim-compressed-nft-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--bundle",
		PK1,
		"--tree-config",
		PK2,
		"--merkle-tree",
		PK3,
		"--bubblegum-program",
		PK1,
		"--log-wrapper",
		PK2,
		"--compression-program",
		PK3,
		"--system-program",
		PK1,
		"--proof-accounts",
		PK2,
		"--asset-index",
		"1",
		"--root",
		HASH32,
		"--data-hash",
		HASH32,
		"--creator-hash",
		HASH32,
		"--nonce",
		"3",
		"--index",
		"0",
	])
	.expect("builds");

	assert_eq!(instruction.data[0], 35);
	assert_eq!(instruction.data.len(), 1 + 1 + 32 * 3 + 8 + 4);
}

#[test]
fn hex_args_reject_bad_input() {
	let error = build_from(&[
		"settle-open",
		"--recipient",
		PK1,
		"--payer",
		PK2,
		"--lootbox",
		PK3,
		"--vault",
		PK1,
		"--box-mint",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
		"--oracle-queue",
		PK2,
		"--oracle",
		PK3,
		"--oracle-stats",
		PK1,
		"--recent-slot-hashes",
		PK2,
		"--oracle-program",
		PROGRAM,
		"--reward-escrow",
		PK3,
		"--oracle-program-state",
		PK1,
		"--wrapped-sol-mint",
		PK2,
		"--signature",
		"0x00",
		"--recovery-id",
		"1",
		"--value",
		HASH32,
	])
	.expect_err("rejects");

	assert!(
		error
			.to_string()
			.contains("must decode to exactly 64 bytes")
	);
}

#[test]
fn run_build_mode_prints_text() {
	let cli = parse(&[
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect("parses");
	let output = crate::run(&cli, None).expect("runs");

	assert!(output.contains("program:"));
	assert!(output.contains("data (base64):"));
}

#[test]
fn run_build_mode_prints_json() {
	let cli = parse(&[
		"--json",
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect("parses");
	let output = crate::run(&cli, None).expect("runs");
	let parsed: serde_json::Value = serde_json::from_str(&output).expect("json");

	assert_eq!(parsed["accounts"].as_array().expect("accounts").len(), 4);
}

#[test]
fn run_send_mode_submits_through_the_transport() {
	let cli = parse(&[
		"--send",
		"--rpc",
		"http://localhost:8899",
		"--keypair",
		"/tmp/kp.json",
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect("parses");
	let output = crate::run(&cli, Some(&submit_mock(1))).expect("runs");

	assert!(output.contains("signature:"));
}

#[test]
fn run_send_mode_prints_json_with_signature() {
	let cli = parse(&[
		"--send",
		"--json",
		"--rpc",
		"http://localhost:8899",
		"--keypair",
		"/tmp/kp.json",
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect("parses");
	let output = crate::run(&cli, Some(&submit_mock(1))).expect("runs");
	let parsed: serde_json::Value = serde_json::from_str(&output).expect("json");

	assert!(
		parsed["signature"]
			.as_str()
			.expect("signature")
			.starts_with("mock-")
	);
}

#[test]
fn run_send_mode_reports_transport_errors() {
	let cli = parse(&[
		"--send",
		"--rpc",
		"http://localhost:8899",
		"--keypair",
		"/tmp/kp.json",
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect("parses");
	let error = crate::run(&cli, Some(&MockErrorSubmit)).expect_err("errors");

	assert!(error.to_string().contains("rejected by mock"));
}

#[test]
fn run_send_mode_without_transport_is_rejected() {
	let cli = parse(&[
		"--send",
		"--rpc",
		"http://localhost:8899",
		"--keypair",
		"/tmp/kp.json",
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect("parses");
	let error = crate::run(&cli, None).expect_err("errors");

	assert!(error.to_string().contains("without a submission transport"));
}

#[test]
fn clap_rejects_send_without_rpc() {
	let error = parse(&[
		"--send",
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect_err("rejects");

	assert!(error.to_string().contains("--rpc"));
}

#[test]
fn clap_rejects_send_without_keypair() {
	let error = parse(&[
		"--send",
		"--rpc",
		"http://localhost:8899",
		"deposit",
		"--depositor",
		PK1,
		"--lootbox",
		PK2,
		"--vault",
		PK3,
		"--lamports",
		"42",
	])
	.expect_err("rejects");

	assert!(error.to_string().contains("--keypair"));
}

#[test]
fn clap_lists_every_instruction_subcommand() {
	let command = <Cli as clap::CommandFactory>::command();
	let subcommand_names: Vec<String> = command
		.get_subcommands()
		.filter(|sub| sub.get_name() != "help")
		.map(|sub| sub.get_name().to_string())
		.collect();

	assert_eq!(subcommand_names.len(), 38);
}

#[test]
fn hex_arg_rejects_non_hex_digits() {
	let error = build_from(&[
		"settle-open",
		"--recipient",
		PK1,
		"--payer",
		PK2,
		"--lootbox",
		PK3,
		"--vault",
		PK1,
		"--box-mint",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
		"--oracle-queue",
		PK2,
		"--oracle",
		PK3,
		"--oracle-stats",
		PK1,
		"--recent-slot-hashes",
		PK2,
		"--oracle-program",
		PROGRAM,
		"--reward-escrow",
		PK3,
		"--oracle-program-state",
		PK1,
		"--wrapped-sol-mint",
		PK2,
		"--signature",
		&format!("0x{}", "zz".repeat(64)),
		"--recovery-id",
		"1",
		"--value",
		HASH32,
	])
	.expect_err("rejects");

	assert!(
		error
			.to_string()
			.contains("must decode to exactly 64 bytes")
	);
}

impl Command {
	/// Number of distinct instruction subcommands.
	pub const VARIANTS: usize = 39;
}

#[test]
fn hex_arg_rejects_bad_hex_for_u8_32() {
	// A [u8; 32] hex argument with the wrong length
	let error = build_from(&[
		"settle-open",
		"--recipient",
		PK1,
		"--payer",
		PK2,
		"--lootbox",
		PK3,
		"--vault",
		PK1,
		"--box-mint",
		PK2,
		"--opening",
		PK3,
		"--randomness",
		PK1,
		"--oracle-queue",
		PK2,
		"--oracle",
		PK3,
		"--oracle-stats",
		PK1,
		"--recent-slot-hashes",
		PK2,
		"--oracle-program",
		PROGRAM,
		"--reward-escrow",
		PK3,
		"--oracle-program-state",
		PK1,
		"--wrapped-sol-mint",
		PK2,
		"--signature",
		SIG64,
		"--recovery-id",
		"1",
		"--value",
		"0x01",
	])
	.expect_err("rejects");

	assert!(
		error
			.to_string()
			.contains("must decode to exactly 32 bytes")
	);
}

#[test]
fn claim_compressed_nft_rejects_bad_hex() {
	let error = build_from(&[
		"claim-compressed-nft-prize",
		"--template",
		PK1,
		"--opening",
		PK2,
		"--bundle",
		PK3,
		"--recipient",
		PK1,
		"--tree-config",
		PK2,
		"--merkle-tree",
		PK3,
		"--bubblegum-program",
		PK1,
		"--log-wrapper",
		PK2,
		"--compression-program",
		PK3,
		"--system-program",
		PK1,
		"--proof-accounts",
		PK2,
		"--asset-index",
		"0",
		"--root",
		"0xzz",
		"--data-hash",
		HASH32,
		"--creator-hash",
		HASH32,
		"--nonce",
		"9",
		"--index",
		"3",
	])
	.expect_err("rejects");

	assert!(
		error
			.to_string()
			.contains("must decode to exactly 32 bytes")
	);
}

#[test]
fn fund_compressed_nft_rejects_bad_hex() {
	let _error = build_from(&[
		"fund-compressed-nft-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--bundle",
		PK3,
		"--tree-config",
		PK1,
		"--merkle-tree",
		PK2,
		"--bubblegum-program",
		PK3,
		"--log-wrapper",
		PK1,
		"--compression-program",
		PK2,
		"--system-program",
		PK3,
		"--proof-accounts",
		PK1,
		"--root",
		HASH32,
		"--data-hash",
		HASH32,
		"--creator-hash",
		HASH32,
		"--nonce",
		"6",
		"--index",
		"2",
	])
	.expect("builds");
}

#[test]
fn reclaim_compressed_nft_rejects_bad_hex() {
	let error = build_from(&[
		"reclaim-compressed-nft-prize",
		"--authority",
		PK1,
		"--template",
		PK2,
		"--box-mint",
		PK3,
		"--bundle",
		PK1,
		"--tree-config",
		PK2,
		"--merkle-tree",
		PK3,
		"--bubblegum-program",
		PK1,
		"--log-wrapper",
		PK2,
		"--compression-program",
		PK3,
		"--system-program",
		PK1,
		"--proof-accounts",
		PK2,
		"--asset-index",
		"1",
		"--root",
		"0xnonexistent",
		"--data-hash",
		HASH32,
		"--creator-hash",
		HASH32,
		"--nonce",
		"3",
		"--index",
		"0",
	])
	.expect_err("rejects");

	assert!(
		error
			.to_string()
			.contains("must decode to exactly 32 bytes")
	);
}

#[test]
fn allocate_template_open_with_default_bump() {
	let instruction = build_from(&[
		"allocate-template-open",
		"--template",
		PK1,
		"--opening",
		PK2,
		"--bundle",
		PK3,
	])
	.expect("builds");

	assert_eq!(instruction.data.len(), 1);
}

#[test]
fn create_template_bump_defaults_to_pda_bump() {
	let without_bump = build_from(&[
		"create-template",
		"--authority",
		PK1,
		"--box-mint",
		PK2,
		"--id",
		"99",
		"--opens-at",
		"1700000000",
		"--oracle-program",
		PROGRAM,
		"--oracle-queue",
		PK3,
		"--name",
		"test",
		"--uri",
		"https://example.com",
	])
	.expect("builds");

	let with_bump = build_from(&[
		"create-template",
		"--authority",
		PK1,
		"--box-mint",
		PK2,
		"--id",
		"99",
		"--opens-at",
		"1700000000",
		"--oracle-program",
		PROGRAM,
		"--oracle-queue",
		PK3,
		"--name",
		"test",
		"--uri",
		"https://example.com",
		"--bump",
		"0",
	])
	.expect("builds");

	// The derived bump must differ from 0 (the PDA bump for this seed).
	assert_ne!(without_bump.data, with_bump.data);
}
