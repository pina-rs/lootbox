//! Compute-unit benchmark journeys for the Metaplex-prize instruction
//! families, against the real pinned Metaplex programs (see
//! `tests/fixtures/metaplex-programs.sha256`).
//!
//! The Core-asset journey mints a plugin-free `AssetV1` with mpl-core 0.15.3
//! `CreateV1` (discriminator 0; every omitted optional account slot carries
//! the Core program address as its placeholder, and the bundle PDA must
//! already be the asset's update authority when it is funded), then funds,
//! reclaims, and claims it through the lootbox program.
//!
//! # Remaining journeys
//!
//! The compressed-NFT and Token Metadata trios still need fixture programs
//! before they can be measured on chain:
//!
//! - `fundCompressedNftPrize` requires a tree that passes the on-chain
//!   claimable-tree check, which parses the real spl-account-compression
//!   `ConcurrentMerkleTree` layout; the mock bubblegum's `LBGMINT1` tree
//!   cannot pass it. The journey therefore needs the real Bubblegum V2 with
//!   harness-side `create_tree_v2` and `mint_v2` calls, plus reconstruction
//!   of the current root and leaf-to-root proof from the tree account (a
//!   full-depth canopy keeps the supplied-proof tail at zero accounts).
//! - `fundMetadataNftPrize` validates the Token Metadata program against an
//!   address this pre-release program pins locally, so the journey needs a
//!   mock Token Metadata ABI program at that address (the pattern the
//!   mock-switchboard and mock-bubblegum fixtures follow), plus harness-side
//!   creation of an immutable Metadata account and Master Edition in the
//!   serialization the program validates.

use super::exclusive_nft::core;
use super::exclusive_nft::deploy_metaplex_programs;
use super::*;

/// Canonical SPL Noop program the Core paths forward as their log wrapper.
fn spl_noop() -> Pubkey {
	Pubkey::from_str_const("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV")
}

/// Metaplex Core `CreateV1` discriminator, from the 0.15.3 borsh enum order
/// (the release the Surfpool suite pins).
const CORE_CREATE_V1: u8 = 0;

/// Create a plugin-free, collection-free Core asset owned by `owner`.
///
/// Mirrors the account and data layout of mpl-core 0.15.3 `CreateV1`, with
/// the Core program address as the placeholder every omitted optional slot
/// uses (the same convention the lootbox program relies on for "no
/// collection").
fn create_core_asset(program: &Harness, asset: &Keypair, update_authority: &Pubkey) {
	let core = core();
	let placeholder = |meta: &mut std::vec::Vec<AccountMeta>| {
		meta.push(AccountMeta::new_readonly(core, false));
	};
	let mut accounts = std::vec::Vec::<AccountMeta>::new();
	accounts.push(AccountMeta::new(asset.pubkey(), true));
	placeholder(&mut accounts); // collection: none
	accounts.push(AccountMeta::new_readonly(program.payer(), true));
	accounts.push(AccountMeta::new(program.payer(), true));
	accounts.push(AccountMeta::new_readonly(program.payer(), false));
	accounts.push(AccountMeta::new_readonly(*update_authority, false));
	accounts.push(AccountMeta::new_readonly(Pubkey::default(), false));
	placeholder(&mut accounts); // log wrapper: not compressed

	let mut data = std::vec![CORE_CREATE_V1, 0]; // DataState::AccountState
	push_borsh_string(&mut data, "Perf Asset");
	push_borsh_string(&mut data, "https://example.com/perf-asset.json");
	data.push(0); // plugins: None

	program
		.send_with_signers(Instruction::new_with_bytes(core, &data, accounts), &[asset])
		.expect("create Core asset");
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn core_asset_compute_units() {
	pina_test::run(async {
		let mut program =
			Harness::start_with_payer(Pubkey::new_from_array(ID.to_bytes()), stable_keypair(6, 0))
				.await
				.expect("Surfpool");
		deploy_metaplex_programs(&program);
		let (queue, oracle, cpi) = oracle_fixture(&mut program);
		let payer = program.payer();
		let recipient = stable_keypair(6, 1);
		program
			.fund(&recipient.pubkey(), 100_000_000)
			.expect("recipient fee funds");
		let (template, bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata_keypair(&program, &template, &stable_keypair(6, 2));
		let creator_ata = box_ata(&program, &payer, &mint);
		let owner_ata = box_ata(&program, &recipient.pubkey(), &mint);
		let opens_at = chain_timestamp(&program) + 3_600;
		program
			.send(
				&create_template_data(queue, bump, opens_at, false),
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("create template");

		let bundle = add_bundle(&program, template, 0, 1, 1);
		let asset = stable_keypair(6, 3);
		create_core_asset(&program, &asset, &bundle);

		program.start_recording("core_asset");
		program.record_as("fund_core_asset_prize");
		program
			.send(
				&[LootboxInstruction::FundCoreAssetPrize as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new(asset.pubkey(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(spl_noop(), false),
				],
			)
			.expect("escrow the Core asset");
		activate_bundle(&program, template, bundle);

		// A staged bundle exercises the reclaim path before the treasury seals.
		let staged = add_bundle(&program, template, 1, 1, 1);
		let staged_asset = stable_keypair(6, 4);
		create_core_asset(&program, &staged_asset, &staged);
		program
			.send(
				&[LootboxInstruction::FundCoreAssetPrize as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(staged, false),
					AccountMeta::new(staged_asset.pubkey(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(spl_noop(), false),
				],
			)
			.expect("escrow the staged Core asset");
		program.record_as("reclaim_core_asset_prize");
		program
			.send(
				&[LootboxInstruction::ReclaimCoreAssetPrize as u8, 0, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(staged, false),
					AccountMeta::new(staged_asset.pubkey(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(spl_noop(), false),
				],
			)
			.expect("reclaim the staged Core asset");
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(staged, false),
				],
			)
			.expect("cancel the emptied staged bundle");

		program
			.send(
				&[LootboxInstruction::SealTemplate as u8, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("seal the funded manifest");
		program
			.send(
				&template_mint_data(1),
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new(mint, false),
					AccountMeta::new(creator_ata, false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("mint one box");
		lock_treasury(&program, template, mint, 1);
		program
			.send_instruction(
				token_ix::transfer_checked(
					&token_2022(),
					&creator_ata,
					&mint,
					&owner_ata,
					&payer,
					&[],
					1,
					0,
				)
				.expect("box transfer"),
			)
			.expect("deliver the box");
		program
			.surfnet
			.cheatcodes()
			.time_travel_to_timestamp(u64::try_from(opens_at + 1).expect("timestamp") * 1000)
			.expect("unlock date");

		let randomness = stable_keypair(6, 5);
		let (opening, opening_bump) = Pubkey::find_program_address(
			&[
				b"template-opening",
				template.as_ref(),
				randomness.pubkey().as_ref(),
			],
			&program.program_id,
		);
		program
			.send_with_signers(
				program.instruction(
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
				),
				&[&recipient, &randomness],
			)
			.expect("burn and commit");
		program.advance_one_slot().expect("oracle delay");
		fulfill(
			&FulfillContext {
				program: &program,
				payer: &recipient,
				template,
				opening,
				randomness: randomness.pubkey(),
				queue,
				oracle,
				cpi: &cpi,
			},
			3,
		)
		.expect("fulfill");
		let (result_receipt, result_receipt_bump) =
			result_receipt_address(&program, opening).expect("result receipt");
		let mut allocate = vec![0; AllocateTemplateOpenInstruction::SIZE];
		AllocateTemplateOpenInstruction::initialize(&mut allocate, |_| Ok(()))
			.expect("allocate data")
			.result_receipt_bump = result_receipt_bump;
		program
			.send(
				&allocate,
				vec![
					AccountMeta::new(template, false),
					AccountMeta::new(opening, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new(
						Pubkey::find_program_address(
							&[b"service-vault", template.as_ref()],
							&program.program_id,
						)
						.0,
						false,
					),
					AccountMeta::new(result_receipt, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("allocate the Core-asset bundle");

		program.record_as("claim_core_asset_prize");
		program
			.send(
				&[LootboxInstruction::ClaimCoreAssetPrize as u8, 0, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(opening, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new_readonly(recipient.pubkey(), false),
					AccountMeta::new(asset.pubkey(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(spl_noop(), false),
				],
			)
			.expect("deliver the Core asset to the beneficiary");

		program.finish_recording().expect("write core_asset report");
		program.stop().expect("stop Surfpool");
	});
}
