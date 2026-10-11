//! Compute-unit benchmark journeys for the core and treasury-template
//! instruction families.
//!
//! Every journey drives one family through its happy path, labeling exactly
//! one send per instruction with `record_as`. The harness simulates a labeled
//! transaction first, records the units consumed, and then executes it, so
//! the journey advances by the exact instruction that was measured. The JSON
//! reports feed `tools/perf/compare.mjs`, which the `performance` workflow
//! uses to compare a pull request against its base.
//!
//! These journeys are deliberately identical in shape to the functional
//! journeys: the measured instruction must exercise the same account
//! validation, oracle CPIs, and state transitions that users pay for.

use pina_test::AccountMeta;
use pina_test::Instruction;
use pina_test::Keypair;
use pina_test::Pubkey;
use pina_test::Signer as _;

use super::*;

/// Extra vault collateral so `withdraw_surplus` has a surplus to return.
const WITHDRAW_SURPLUS_LAMPORTS: u64 = 100_000;

/// Provision a claim destination only when it does not exist yet.
fn provision_missing_ata(program: &Harness, wallet: &Pubkey, mint: &Pubkey) {
	if program.account(&ata_of(wallet, mint)).is_err() {
		provision_ata(program, &program.payer(), wallet, mint).expect("claim destination");
	}
}

/// Fund one escrowed fungible-token prize and return the reward mint.
///
/// Splits `fund_token`'s provisioning from its final send so the benchmark
/// can label exactly the lootbox instruction.
fn fund_token_prize(
	program: &Harness,
	template: Pubkey,
	bundle: Pubkey,
	quantity: u64,
	record: Option<&str>,
	mint: &Keypair,
) -> Pubkey {
	let payer = program.payer();
	let mint = provision_mint_keypair(program, &payer, &payer, mint).expect("reward mint");
	let source = provision_ata(program, &payer, &payer, &mint).expect("source ATA");
	let escrow = provision_ata(program, &payer, &bundle, &mint).expect("escrow ATA");
	let mut mint_data = vec![7];
	mint_data.extend_from_slice(&(100 * quantity).to_le_bytes());
	program
		.send_instruction(Instruction::new_with_bytes(
			token_program_id(),
			&mint_data,
			vec![
				AccountMeta::new(mint, false),
				AccountMeta::new(source, false),
				AccountMeta::new_readonly(payer, true),
			],
		))
		.expect("mint reward inventory");

	if let Some(label) = record {
		program.record_as(label);
	}
	let mut data = vec![0; FundTokenPrizeInstruction::SIZE];
	let args =
		FundTokenPrizeInstruction::initialize(&mut data, |_| Ok(())).expect("fund token data");
	args.amount_per_win.set(100);
	args.is_nft.set(false);
	program
		.send(
			&data,
			vec![
				AccountMeta::new_readonly(payer, true),
				AccountMeta::new(template, false),
				AccountMeta::new(bundle, false),
				AccountMeta::new_readonly(mint, false),
				AccountMeta::new(source, false),
				AccountMeta::new(escrow, false),
				AccountMeta::new_readonly(token_program_id(), false),
			],
		)
		.expect("escrow token inventory");
	mint
}

/// Fund one escrowed unique NFT prize and return the reward mint.
fn fund_nft_prize(program: &Harness, template: Pubkey, bundle: Pubkey, mint: &Keypair) -> Pubkey {
	let payer = program.payer();
	let mint = provision_mint_keypair(program, &payer, &payer, mint).expect("NFT mint");
	let source = provision_ata(program, &payer, &payer, &mint).expect("source ATA");
	let escrow = provision_ata(program, &payer, &bundle, &mint).expect("escrow ATA");
	let mut mint_data = vec![7];
	mint_data.extend_from_slice(&1u64.to_le_bytes());
	program
		.send_instruction(Instruction::new_with_bytes(
			token_program_id(),
			&mint_data,
			vec![
				AccountMeta::new(mint, false),
				AccountMeta::new(source, false),
				AccountMeta::new_readonly(payer, true),
			],
		))
		.expect("mint NFT inventory");
	program
		.send_instruction(
			token_ix::set_authority(
				&token_program_id(),
				&mint,
				None,
				token_ix::AuthorityType::MintTokens,
				&payer,
				&[],
			)
			.expect("revoke"),
		)
		.expect("make unique NFT");

	let mut data = vec![0; FundTokenPrizeInstruction::SIZE];
	let args =
		FundTokenPrizeInstruction::initialize(&mut data, |_| Ok(())).expect("fund token data");
	args.amount_per_win.set(1);
	args.is_nft.set(true);
	program
		.send(
			&data,
			vec![
				AccountMeta::new_readonly(payer, true),
				AccountMeta::new(template, false),
				AccountMeta::new(bundle, false),
				AccountMeta::new_readonly(mint, false),
				AccountMeta::new(source, false),
				AccountMeta::new(escrow, false),
				AccountMeta::new_readonly(token_program_id(), false),
			],
		)
		.expect("escrow NFT inventory");
	mint
}

/// Fund one quote (creator-collateralized) token prize and return the mint.
fn fund_quote_token_prize(
	program: &Harness,
	template: Pubkey,
	bundle: Pubkey,
	quantity: u64,
	record: Option<&str>,
	mint: &Keypair,
) -> Pubkey {
	let payer = program.payer();
	let mint = provision_mint_keypair(program, &payer, &payer, mint).expect("quote mint");
	let source = provision_ata(program, &payer, &payer, &mint).expect("quote source");
	let escrow = provision_ata(program, &payer, &bundle, &mint).expect("quote escrow");
	let mut mint_data = vec![7];
	mint_data.extend_from_slice(&(25 * quantity).to_le_bytes());
	program
		.send_instruction(Instruction::new_with_bytes(
			token_program_id(),
			&mint_data,
			vec![
				AccountMeta::new(mint, false),
				AccountMeta::new(source, false),
				AccountMeta::new_readonly(payer, true),
			],
		))
		.expect("mint quote collateral");

	if let Some(label) = record {
		program.record_as(label);
	}
	let mut data = vec![0; FundQuoteTokenPrizeInstruction::SIZE];
	FundQuoteTokenPrizeInstruction::initialize(&mut data, |_| Ok(()))
		.expect("fund token quote data")
		.amount_per_win
		.set(25);
	program
		.send(
			&data,
			vec![
				AccountMeta::new_readonly(payer, true),
				AccountMeta::new(template, false),
				AccountMeta::new(bundle, false),
				AccountMeta::new_readonly(mint, false),
				AccountMeta::new(source, false),
				AccountMeta::new(escrow, false),
				AccountMeta::new_readonly(token_program_id(), false),
			],
		)
		.expect("escrow token quote inventory");
	mint
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn core_compute_units() {
	pina_test::run(async {
		let program_id = Pubkey::new_from_array(ID.to_bytes());
		let mut program = Harness::start_with_payer(program_id, stable_keypair(0, 0))
			.await
			.expect("Surfpool");
		let mock_artifact = std::env::var("MOCK_SWITCHBOARD_SBF_ARTIFACT")
			.expect("MOCK_SWITCHBOARD_SBF_ARTIFACT is set by test:surfpool");
		program
			.deploy_program(oracle_program_id(), Path::new(&mock_artifact))
			.expect("deploy test-only Switchboard emulator");

		let authority = program.payer();
		let recipient = stable_keypair(0, 1);
		program
			.fund(&recipient.pubkey(), FUND)
			.expect("fund box recipient");

		let id = 7u64;
		let queue = Pubkey::new_from_array([7u8; 32]);
		let oracle = stable_keypair(0, 2);
		let empty_account_rent = rent_minimum(0);
		let oracle_cpi = OracleCpiAccounts {
			program_state: Pubkey::new_from_array([10u8; 32]),
			lut_signer: Pubkey::new_from_array([11u8; 32]),
			lut: Pubkey::new_from_array([12u8; 32]),
			stats: Pubkey::new_from_array([13u8; 32]),
		};
		program
			.fund_many(
				&[
					queue,
					oracle_cpi.program_state,
					oracle_cpi.lut_signer,
					oracle_cpi.lut,
				],
				empty_account_rent,
			)
			.expect("fund mock Switchboard CPI accounts");
		program
			.send_with_signers(
				create_account_instruction(
					&authority,
					&oracle.pubkey(),
					empty_account_rent,
					0,
					&oracle_program_id(),
				),
				&[&oracle],
			)
			.expect("create program-owned oracle account");
		let (lootbox, bump) = lootbox_pda(&program_id, &authority, id);
		let (vault, vault_bump) = vault_pda(&program_id, &lootbox);
		let mint = provision_mint_keypair(&program, &authority, &lootbox, &stable_keypair(0, 3))
			.expect("provision box mint");
		let recipient_ata = provision_ata(&program, &authority, &recipient.pubkey(), &mint)
			.expect("provision recipient box account");

		program.start_recording("core");
		program.record_as("create_lootbox");
		program
			.send(
				&create_lootbox_data(id, BOXES, &queue, bump, vault_bump),
				vec![
					AccountMeta::new(authority, true),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(lootbox, false),
					AccountMeta::new(vault, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(token_program_id(), false),
				],
			)
			.expect("create lootbox");

		program.record_as("add_outcome");
		program
			.send(
				&add_outcome_data(OUTCOMES[0].0, OUTCOMES[0].1),
				vec![
					AccountMeta::new_readonly(authority, true),
					AccountMeta::new(lootbox, false),
				],
			)
			.expect("add first weighted outcome");
		for (weight, reward) in OUTCOMES.iter().skip(1) {
			program
				.send(
					&add_outcome_data(*weight, *reward),
					vec![
						AccountMeta::new_readonly(authority, true),
						AccountMeta::new(lootbox, false),
					],
				)
				.expect("add weighted outcome");
		}

		program.record_as("deposit");
		program
			.send(
				&deposit_data(BOXES * MAX_REWARD + WITHDRAW_SURPLUS_LAMPORTS),
				vec![
					AccountMeta::new(authority, true),
					AccountMeta::new_readonly(lootbox, false),
					AccountMeta::new(vault, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("fully collateralize lootbox");

		program.record_as("seal");
		program
			.send(
				&[LootboxInstruction::Seal as u8, 0],
				vec![
					AccountMeta::new_readonly(authority, true),
					AccountMeta::new(lootbox, false),
				],
			)
			.expect("seal immutable reward table");

		program.record_as("mint_boxes");
		program
			.send(
				&mint_data(BOXES),
				vec![
					AccountMeta::new_readonly(authority, true),
					AccountMeta::new(lootbox, false),
					AccountMeta::new_readonly(vault, false),
					AccountMeta::new(mint, false),
					AccountMeta::new(recipient_ata, false),
					AccountMeta::new_readonly(token_program_id(), false),
				],
			)
			.expect("mint transferable boxes");

		let recent_slot = stored_u64(
			&program
				.account(&clock_sysvar_id())
				.expect("clock before opening")
				.data,
			0,
		);
		let randomness = stable_keypair(0, 4);
		let (opening, opening_bump) = opening_pda(&program_id, &lootbox, &randomness.pubkey());
		let revealed_value = [42u8; 32];
		program.record_as("request_open");
		program
			.send_with_signers(
				program.instruction(
					&request_data(recent_slot, opening_bump),
					request_accounts(
						&recipient.pubkey(),
						&lootbox,
						&vault,
						&mint,
						&recipient_ata,
						&opening,
						&randomness.pubkey(),
						&queue,
						&oracle.pubkey(),
						&oracle_cpi,
					),
				),
				&[&recipient, &randomness],
			)
			.expect("burn and commit");

		program.advance_one_slot().expect("oracle delay");
		program.record_as("settle_open");
		program
			.send(
				&settle_data(revealed_value),
				settle_accounts(
					&recipient.pubkey(),
					&authority,
					&lootbox,
					&vault,
					&mint,
					&opening,
					&randomness.pubkey(),
					&queue,
					&oracle.pubkey(),
					&oracle_cpi,
				),
			)
			.expect("reveal and pay");

		let refund_randomness = stable_keypair(0, 5);
		let (refund_opening, refund_bump) =
			opening_pda(&program_id, &lootbox, &refund_randomness.pubkey());
		program
			.send_with_signers(
				program.instruction(
					&request_data(recent_slot, refund_bump),
					request_accounts(
						&recipient.pubkey(),
						&lootbox,
						&vault,
						&mint,
						&recipient_ata,
						&refund_opening,
						&refund_randomness.pubkey(),
						&queue,
						&oracle.pubkey(),
						&oracle_cpi,
					),
				),
				&[&recipient, &refund_randomness],
			)
			.expect("request a second opening for the timeout path");
		program
			.advance_slots(RANDOMNESS_TIMEOUT_SLOTS + 1)
			.expect("advance beyond randomness timeout");

		program.record_as("refund_open");
		program
			.send_with_signers(
				program.instruction(
					&[LootboxInstruction::RefundOpen as u8, 0],
					vec![
						AccountMeta::new(recipient.pubkey(), true),
						AccountMeta::new(lootbox, false),
						AccountMeta::new(vault, false),
						AccountMeta::new_readonly(mint, false),
						AccountMeta::new(refund_opening, false),
						AccountMeta::new_readonly(refund_randomness.pubkey(), false),
						AccountMeta::new_readonly(clock_sysvar_id(), false),
					],
				),
				&[&recipient],
			)
			.expect("refund the timed-out opening");

		program.record_as("close_opening");
		program
			.send(
				&[LootboxInstruction::CloseOpening as u8, 0],
				close_accounts(
					&recipient.pubkey(),
					&lootbox,
					&refund_opening,
					&refund_randomness.pubkey(),
					&oracle_cpi,
				),
			)
			.expect("close refunded receipt");

		program.record_as("withdraw_surplus");
		program
			.send(
				&withdraw_data(WITHDRAW_SURPLUS_LAMPORTS),
				vec![
					AccountMeta::new(authority, true),
					AccountMeta::new_readonly(lootbox, false),
					AccountMeta::new(vault, false),
					AccountMeta::new_readonly(mint, false),
				],
			)
			.expect("withdraw the deposited surplus");

		program.record_as("migrate");
		let placeholders: std::vec::Vec<AccountMeta> = (0..7)
			.map(|_| AccountMeta::new(program_id, false))
			.collect();
		program
			.send(
				&[255],
				vec![
					AccountMeta::new(program_id, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				]
				.into_iter()
				.chain(placeholders)
				.collect(),
			)
			.expect("reserved Migrate no-ops on placeholder slots");

		program.finish_recording().expect("write core report");
		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn templates_compute_units() {
	pina_test::run(async {
		let mut program =
			Harness::start_with_payer(Pubkey::new_from_array(ID.to_bytes()), stable_keypair(1, 0))
				.await
				.expect("Surfpool");
		let (queue, oracle, cpi) = oracle_fixture(&mut program);
		let payer = program.payer();
		let recipient = stable_keypair(1, 1);
		program
			.fund(&recipient.pubkey(), 100_000_000)
			.expect("recipient fee funds");
		let (template, bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata_keypair(&program, &template, &stable_keypair(1, 2));
		let creator_ata = box_ata(&program, &payer, &mint);
		let owner_ata = box_ata(&program, &recipient.pubkey(), &mint);
		let opens_at = chain_timestamp(&program) + 3_600;

		program.start_recording("templates");
		program.record_as("create_template");
		program
			.send(
				&create_template_data(queue, bump, opens_at, true),
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("create template");

		program.record_as("add_bundle");
		let sol_bundle = add_bundle(&program, template, 0, 4, 1);
		program.record_as("fund_sol_prize");
		fund_sol(&program, template, sol_bundle, 100_000).expect("SOL inventory");
		program.record_as("activate_bundle");
		activate_bundle(&program, template, sol_bundle);

		let token_bundle = add_bundle(&program, template, 1, 2, 1);
		let token_reward = fund_token_prize(
			&program,
			template,
			token_bundle,
			2,
			Some("fund_token_prize"),
			&stable_keypair(1, 3),
		);
		activate_bundle(&program, template, token_bundle);

		let jackpot_bundle = add_bundle(&program, template, 2, 1, 3);
		fund_sol(&program, template, jackpot_bundle, 1_000_000).expect("jackpot SOL");
		let jackpot_nft_a =
			fund_nft_prize(&program, template, jackpot_bundle, &stable_keypair(1, 4));
		let jackpot_nft_b =
			fund_nft_prize(&program, template, jackpot_bundle, &stable_keypair(1, 5));
		activate_bundle(&program, template, jackpot_bundle);

		let quote_bundle = add_bundle(&program, template, 3, 2, 3);
		program.record_as("fund_quote_sol_prize");
		fund_quote_sol(&program, template, quote_bundle, 50_000).expect("quote SOL collateral");
		let quote_reward = fund_quote_token_prize(
			&program,
			template,
			quote_bundle,
			2,
			Some("fund_quote_token_prize"),
			&stable_keypair(1, 6),
		);
		let badge_mint = provision_mint_keypair(&program, &payer, &payer, &stable_keypair(1, 7))
			.expect("badge mint");
		program.record_as("fund_mint_prize");
		fund_mint_badge(&program, template, quote_bundle, badge_mint)
			.expect("badge authority escrow");
		activate_bundle(&program, template, quote_bundle);

		// Staged (never activated) bundles exercise the recovery instructions.
		let staged_sol = add_bundle(&program, template, 4, 2, 1);
		fund_sol(&program, template, staged_sol, 50_000).expect("staged SOL collateral");
		program.record_as("reclaim_sol_prize");
		program
			.send(
				&[LootboxInstruction::ReclaimSolPrize as u8, 0, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(staged_sol, false),
				],
			)
			.expect("reclaim staged SOL collateral");
		program.record_as("cancel_bundle");
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(staged_sol, false),
				],
			)
			.expect("cancel emptied staged bundle");

		let staged_badge = add_bundle(&program, template, 4, 2, 1);
		let staged_badge_mint =
			provision_mint_keypair(&program, &payer, &payer, &stable_keypair(1, 8))
				.expect("staged badge");
		fund_mint_badge(&program, template, staged_badge, staged_badge_mint)
			.expect("staged badge authority");
		program.record_as("reclaim_mint_prize");
		program
			.send(
				&[LootboxInstruction::ReclaimMintPrize as u8, 0, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(staged_badge, false),
					AccountMeta::new(staged_badge_mint, false),
					AccountMeta::new_readonly(token_program_id(), false),
				],
			)
			.expect("revoke staged badge authority");
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(staged_badge, false),
				],
			)
			.expect("cancel staged badge bundle");

		let staged_token = add_bundle(&program, template, 4, 2, 1);
		let staged_reward = provision_mint_keypair(&program, &payer, &payer, &stable_keypair(1, 9))
			.expect("staged reward");
		let staged_source =
			provision_ata(&program, &payer, &payer, &staged_reward).expect("staged source");
		let staged_escrow =
			provision_ata(&program, &payer, &staged_token, &staged_reward).expect("staged escrow");
		let mut staged_mint_data = vec![7];
		staged_mint_data.extend_from_slice(&200u64.to_le_bytes());
		program
			.send_instruction(Instruction::new_with_bytes(
				token_program_id(),
				&staged_mint_data,
				vec![
					AccountMeta::new(staged_reward, false),
					AccountMeta::new(staged_source, false),
					AccountMeta::new_readonly(payer, true),
				],
			))
			.expect("mint staged inventory");
		let mut staged_fund = vec![0; FundTokenPrizeInstruction::SIZE];
		let args = FundTokenPrizeInstruction::initialize(&mut staged_fund, |_| Ok(()))
			.expect("staged fund data");
		args.amount_per_win.set(100);
		args.is_nft.set(false);
		program
			.send(
				&staged_fund,
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new(staged_token, false),
					AccountMeta::new_readonly(staged_reward, false),
					AccountMeta::new(staged_source, false),
					AccountMeta::new(staged_escrow, false),
					AccountMeta::new_readonly(token_program_id(), false),
				],
			)
			.expect("escrow staged token inventory");
		program.record_as("reclaim_token_prize");
		program
			.send(
				&[LootboxInstruction::ReclaimTokenPrize as u8, 0, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(staged_token, false),
					AccountMeta::new_readonly(staged_reward, false),
					AccountMeta::new(staged_escrow, false),
					AccountMeta::new(staged_source, false),
					AccountMeta::new_readonly(token_program_id(), false),
				],
			)
			.expect("reclaim staged token inventory");
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(staged_token, false),
				],
			)
			.expect("cancel staged token bundle");

		program.record_as("seal_template");
		program
			.send(
				&[LootboxInstruction::SealTemplate as u8, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("seal funded manifest");

		let supply = 4 + 2 + 1 + 2;
		program.record_as("mint_template_boxes");
		program
			.send(
				&template_mint_data(supply),
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new(mint, false),
					AccountMeta::new(creator_ata, false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("mint boxes for every prize-bundle copy");

		program.record_as("lock_treasury");
		lock_treasury(&program, template, mint, 4);
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;

		program
			.send_instruction(
				token_ix::transfer_checked(
					&token_2022(),
					&creator_ata,
					&mint,
					&owner_ata,
					&payer,
					&[],
					supply,
					0,
				)
				.expect("box transfer"),
			)
			.expect("deliver boxes");
		program
			.surfnet
			.cheatcodes()
			.time_travel_to_timestamp(u64::try_from(opens_at + 1).expect("timestamp") * 1000)
			.expect("unlock date");

		let mut openings = std::vec::Vec::new();
		for index in 0..supply {
			let randomness = stable_keypair(1, 10 + index as u8);
			let (opening, opening_bump) = Pubkey::find_program_address(
				&[
					b"template-opening",
					template.as_ref(),
					randomness.pubkey().as_ref(),
				],
				&program.program_id,
			);
			let request = program.instruction(
				&template_request_data(opening_bump, recipient.pubkey()),
				template_request_accounts(&TemplateRequestContext {
					owner: recipient.pubkey(),
					template,
					mint,
					ata: owner_ata,
					opening,
					randomness: randomness.pubkey(),
					queue,
					oracle,
					cpi: &cpi,
				}),
			);
			if index == 0 {
				program.record_as("request_template_open");
			}
			program
				.send_with_signers(request, &[&recipient, &randomness])
				.expect("burn and commit");
			openings.push((opening, randomness.pubkey()));
		}

		program.record_as("retire_template");
		program
			.send(
				&[LootboxInstruction::RetireTemplate as u8, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("retire the committed treasury");

		program.advance_one_slot().expect("oracle delay");
		for (index, (opening, randomness)) in openings.iter().copied().take(8).enumerate() {
			let context = FulfillContext {
				program: &program,
				payer: &recipient,
				template,
				opening,
				randomness,
				queue,
				oracle,
				cpi: &cpi,
			};
			if index == 0 {
				program.record_as("fulfill_template_open");
			}
			fulfill(&context, u8::try_from(index + 1).expect("value")).expect("persist proof");
		}

		// Allocation picks the bundle from the opening's entropy, so probe
		// with `allocate_any` exactly as the functional journey does. The
		// recorder holds the label across the expected failed probes and
		// records the successful one.
		let bundles = [sol_bundle, token_bundle, jackpot_bundle, quote_bundle];
		let mut assignment = std::vec::Vec::new();
		for (index, (opening, _)) in openings.iter().copied().take(8).enumerate() {
			if index == 0 {
				program.record_as("allocate_template_open");
			}
			let selected =
				allocate_any(&program, template, opening, &bundles).expect("FIFO allocation");
			assignment.push(bundles[selected]);
		}

		let mut measured_sol_prize = false;
		let mut measured_token_prize = false;
		let mut measured_mint_prize = false;
		for (index, ((opening, randomness), bundle)) in openings
			.iter()
			.copied()
			.take(8)
			.zip(assignment.iter().copied())
			.enumerate()
		{
			let claim_sol = |program: &Harness| {
				let mut data = vec![0; ClaimSolPrizeInstruction::SIZE];
				ClaimSolPrizeInstruction::initialize(&mut data, |_| Ok(()))
					.expect("claim SOL data")
					.asset_index = 0;
				program.send(
					&data,
					vec![
						AccountMeta::new_readonly(template, false),
						AccountMeta::new(opening, false),
						AccountMeta::new(bundle, false),
						AccountMeta::new(recipient.pubkey(), false),
					],
				)
			};
			let claim_token =
				|program: &Harness, reward: Pubkey, asset: u8| -> Result<(), std::string::String> {
					provision_missing_ata(program, &recipient.pubkey(), &reward);
					let mut data = vec![0; ClaimTokenPrizeInstruction::SIZE];
					ClaimTokenPrizeInstruction::initialize(&mut data, |_| Ok(()))
						.expect("claim token data")
						.asset_index = asset;
					program.send(
						&data,
						vec![
							AccountMeta::new_readonly(template, false),
							AccountMeta::new(opening, false),
							AccountMeta::new(bundle, false),
							AccountMeta::new_readonly(recipient.pubkey(), false),
							AccountMeta::new_readonly(reward, false),
							AccountMeta::new(ata_of(&bundle, &reward), false),
							AccountMeta::new(ata_of(&recipient.pubkey(), &reward), false),
							AccountMeta::new_readonly(token_program_id(), false),
						],
					)
				};

			match bundle {
				bundle if bundle == sol_bundle => {
					if !measured_sol_prize {
						measured_sol_prize = true;
						program.record_as("claim_sol_prize");
					}
					claim_sol(&program).expect("recipient gets SOL");
				}
				bundle if bundle == token_bundle => {
					if !measured_token_prize {
						measured_token_prize = true;
						program.record_as("claim_token_prize");
					}
					claim_token(&program, token_reward, 0).expect("recipient gets tokens");
				}
				bundle if bundle == jackpot_bundle => {
					if !measured_sol_prize {
						measured_sol_prize = true;
						program.record_as("claim_sol_prize");
					}
					claim_sol(&program).expect("jackpot SOL");
					if !measured_token_prize {
						measured_token_prize = true;
						program.record_as("claim_token_prize");
					}
					claim_token(&program, jackpot_nft_a, 1).expect("first NFT");
					claim_token(&program, jackpot_nft_b, 2).expect("second NFT");
				}
				_ => {
					if !measured_sol_prize {
						measured_sol_prize = true;
						program.record_as("claim_sol_prize");
					}
					claim_sol(&program).expect("quote SOL release");
					if !measured_token_prize {
						measured_token_prize = true;
						program.record_as("claim_token_prize");
					}
					claim_token(&program, quote_reward, 1).expect("quote token release");
					if !measured_mint_prize {
						measured_mint_prize = true;
						program.record_as("claim_mint_prize");
					}
					provision_missing_ata(&program, &recipient.pubkey(), &badge_mint);
					program
						.send_instruction(program.instruction(
							&[LootboxInstruction::ClaimMintPrize as u8, 0, 2],
							vec![
								AccountMeta::new_readonly(template, false),
								AccountMeta::new(opening, false),
								AccountMeta::new(bundle, false),
								AccountMeta::new_readonly(recipient.pubkey(), false),
								AccountMeta::new(badge_mint, false),
								AccountMeta::new(ata_of(&recipient.pubkey(), &badge_mint), false),
								AccountMeta::new_readonly(token_program_id(), false),
							],
						))
						.expect("mint badge to bound recipient");
				}
			}

			if index == 0 {
				program.record_as("close_template_opening");
			}
			program
				.send(
					&[LootboxInstruction::CloseTemplateOpening as u8, 0],
					close_accounts(&recipient.pubkey(), &template, &opening, &randomness, &cpi),
				)
				.expect("close completed receipt");
		}

		let (straggler, straggler_randomness) = openings[8];
		program
			.advance_slots(RANDOMNESS_TIMEOUT_SLOTS + 1)
			.expect("expire opening");
		program.record_as("forfeit_template_open");
		program
			.send(
				&[LootboxInstruction::ForfeitTemplateOpen as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(recipient.pubkey(), false),
					AccountMeta::new(template, false),
					AccountMeta::new(service_vault, false),
					AccountMeta::new(straggler, false),
					AccountMeta::new_readonly(straggler_randomness, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("forfeit the expired FIFO head");
		program
			.send(
				&[LootboxInstruction::CloseTemplateOpening as u8, 0],
				close_accounts(
					&recipient.pubkey(),
					&template,
					&straggler,
					&straggler_randomness,
					&cpi,
				),
			)
			.expect("close forfeited receipt");

		program.record_as("close_service_vault");
		program
			.send(
				&[LootboxInstruction::CloseServiceVault as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(service_vault, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("creator closes the exhausted service vault");

		program.finish_recording().expect("write templates report");
		program.stop().expect("stop Surfpool");
	});
}
