//! Exclusive Lootbox NFT journeys against the real mainnet Bubblegum V2, Core,
//! MPL Account Compression, and MPL Noop images pinned by
//! `tests/fixtures/metaplex-programs.sha256`.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

use super::*;

const METAPLEX_PROGRAMS: [&str; 4] = [
	"BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY",
	"CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
	"mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW",
	"mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3",
];
const SERIES_QUANTITY: u64 = 3;
const TOP_TIER: usize = 15;
const BONUS_LAMPORTS: u64 = 5_000_000;
/// A drawable tier that the fixed test entropies never select.
const RARE_TIER: usize = 14;
const RARE_BONUS_LAMPORTS: u64 = 7_000_000;
const TIER_WEIGHTS: [u32; 16] = {
	let mut weights = [0; 16];
	weights[RARE_TIER] = 1;
	weights[TOP_TIER] = 1_000_000;
	weights
};
const TREE_DEPTH: u8 = 3;
const TREE_BUFFER: u32 = 8;
const NAME_PREFIX: &str = "Lootbox Exclusive";
const SYMBOL: &str = "LBX";
const BASE_URI: &str = "https://example.com/exclusive/";
const COUNTS: ExclusiveTraitCounts = ExclusiveTraitCounts {
	contents: 12,
	background: 8,
	pattern: 5,
};

fn pubkey(address: &str) -> Pubkey {
	Pubkey::from_str_const(address)
}

fn deploy_metaplex_programs(program: &Harness) {
	let directory = PathBuf::from(
		std::env::var_os("METAPLEX_PROGRAMS_DIR")
			.expect("METAPLEX_PROGRAMS_DIR; run `devenv shell -- test:surfpool`"),
	);
	for id in METAPLEX_PROGRAMS {
		program
			.deploy_program(pubkey(id), &directory.join(format!("{id}.so")))
			.expect("deploy pinned Metaplex program");
	}
}

/// MPL Account Compression V1 account size with no canopy.
fn merkle_tree_space(depth: u64, buffer: u64) -> u64 {
	let header = 2 + 54;
	let change_log = 32 + 32 * depth + 8;
	let rightmost_path = 32 * depth + 32 + 8;
	header + 24 + buffer * change_log + rightmost_path
}

fn series_addresses(program: &Harness, template: Pubkey) -> ((Pubkey, u8), (Pubkey, u8)) {
	let series = Pubkey::find_program_address(
		&[b"exclusive-series", template.as_ref()],
		&program.program_id,
	);
	let fee_vault = Pubkey::find_program_address(
		&[b"exclusive-fee-vault", series.0.as_ref()],
		&program.program_id,
	);
	(series, fee_vault)
}

fn padded<const N: usize>(value: &str) -> [u8; N] {
	let mut bytes = [0; N];
	bytes[..value.len()].copy_from_slice(value.as_bytes());
	bytes
}

fn create_series_data(bump: u8, fee_vault_bump: u8, bonuses: &[(usize, u64)]) -> Vec<u8> {
	let mut data = vec![0; CreateExclusiveSeriesInstruction::SIZE];
	let args = CreateExclusiveSeriesInstruction::initialize(&mut data, |_| Ok(()))
		.expect("create series data");
	args.bump = bump;
	args.fee_vault_bump = fee_vault_bump;
	args.contents_count = COUNTS.contents;
	args.background_count = COUNTS.background;
	args.pattern_count = COUNTS.pattern;
	for (tier, weight) in TIER_WEIGHTS.iter().enumerate() {
		args.weights[tier * 4..tier * 4 + 4].copy_from_slice(&weight.to_le_bytes());
	}
	for (tier, lamports) in bonuses {
		args.bonus_lamports[tier * 8..tier * 8 + 8].copy_from_slice(&lamports.to_le_bytes());
		args.bonus_counts[tier * 4..tier * 4 + 4].copy_from_slice(&1u32.to_le_bytes());
	}
	args.name_prefix = padded(NAME_PREFIX);
	args.symbol = padded(SYMBOL);
	args.base_uri = padded(BASE_URI);
	data
}

struct SeriesContext {
	template: Pubkey,
	bundle: Pubkey,
	series: Pubkey,
	fee_vault: Pubkey,
	box_mint: Pubkey,
}

fn create_series(
	program: &Harness,
	context: &SeriesContext,
	bump: u8,
	fee_vault_bump: u8,
	bonuses: &[(usize, u64)],
) -> Result<(), String> {
	program.send(
		&create_series_data(bump, fee_vault_bump, bonuses),
		vec![
			AccountMeta::new(program.payer(), true),
			AccountMeta::new_readonly(context.template, false),
			AccountMeta::new(context.bundle, false),
			AccountMeta::new(context.series, false),
			AccountMeta::new(context.fee_vault, false),
			AccountMeta::new_readonly(Pubkey::default(), false),
		],
	)
}

fn reclaim_series(program: &Harness, context: &SeriesContext) -> Result<(), String> {
	program.send(
		&[LootboxInstruction::ReclaimExclusiveReserve as u8, 0, 0],
		vec![
			AccountMeta::new(program.payer(), true),
			AccountMeta::new_readonly(context.template, false),
			AccountMeta::new_readonly(context.box_mint, false),
			AccountMeta::new(context.bundle, false),
			AccountMeta::new(context.series, false),
			AccountMeta::new(context.fee_vault, false),
			AccountMeta::new_readonly(Pubkey::default(), false),
		],
	)
}

fn create_template(program: &Harness, queue: Pubkey, opens_at: i64) -> (Pubkey, Pubkey) {
	let payer = program.payer();
	let (template, bump) = Pubkey::find_program_address(
		&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
		&program.program_id,
	);
	let box_mint = mint_with_metadata(program, &template);
	program
		.send(
			&create_template_data(queue, bump, opens_at, false),
			vec![
				AccountMeta::new(payer, true),
				AccountMeta::new(template, false),
				AccountMeta::new_readonly(box_mint, false),
				AccountMeta::new_readonly(Pubkey::default(), false),
				AccountMeta::new_readonly(token_2022(), false),
			],
		)
		.expect("template");
	(template, box_mint)
}

/// Borsh `MetadataArgsV2` the program must hand Bubblegum for one edition.
fn expected_metadata(name: &str, uri: &str, collection: &Pubkey) -> Vec<u8> {
	let mut bytes = Vec::new();
	push_borsh_string(&mut bytes, name);
	push_borsh_string(&mut bytes, SYMBOL);
	push_borsh_string(&mut bytes, uri);
	bytes.extend_from_slice(&[0, 0, 0, 0, 1, 0]);
	bytes.extend_from_slice(&0u32.to_le_bytes());
	bytes.push(1);
	bytes.extend_from_slice(collection.as_ref());
	bytes
}

fn read_borsh_string(data: &[u8], offset: &mut usize) -> String {
	let length = u32::from_le_bytes(data[*offset..*offset + 4].try_into().expect("length"));
	let start = *offset + 4;
	let end = start + usize::try_from(length).expect("length");
	*offset = end;
	String::from_utf8(data[start..end].to_vec()).expect("UTF-8")
}

/// Encoded `ExclusiveNftMinted` event from a claim's `Program data:` logs.
fn minted_event_bytes(logs: &[String]) -> Vec<u8> {
	logs.iter()
		.filter_map(|line| line.strip_prefix("Program data: "))
		.find_map(|payload| {
			let bytes = BASE64.decode(payload).ok()?;
			let is_event = ExclusiveNftMintedEvent::try_from_bytes(&bytes).is_ok();
			is_event.then_some(bytes)
		})
		.expect("ExclusiveNftMinted event in the claim logs")
}

struct MintedLeaf {
	id: Pubkey,
	owner: Pubkey,
	nonce: u64,
	data_hash: [u8; 32],
}

/// Parse Bubblegum's `LeafSchemaEvent` from its MPL Noop application-data CPI.
fn minted_leaf(execution: &Execution) -> MintedLeaf {
	let noop = pubkey(METAPLEX_PROGRAMS[3]);
	let data = execution
		.inner_instructions
		.iter()
		.find(|(program, data)| *program == noop && data.starts_with(&[1, 0]))
		.map(|(_, data)| data)
		.expect("Bubblegum leaf schema event");
	let application = &data[6..];
	assert_eq!(&application[..3], &[1, 1, 1], "V2 leaf schema event");
	MintedLeaf {
		id: Pubkey::try_from(&application[3..35]).expect("asset id"),
		owner: Pubkey::try_from(&application[35..67]).expect("owner"),
		nonce: u64::from_le_bytes(application[99..107].try_into().expect("nonce")),
		data_hash: application[107..139].try_into().expect("data hash"),
	}
}

/// Name, symbol, and URI the lootbox program handed Bubblegum's `mint_v2`.
fn minted_metadata(execution: &Execution) -> (String, String, String) {
	let bubblegum = pubkey(METAPLEX_PROGRAMS[0]);
	let data = execution
		.inner_instructions
		.iter()
		.find(|(program, data)| {
			*program == bubblegum && data.starts_with(&[120, 121, 23, 146, 173, 110, 199, 205])
		})
		.map(|(_, data)| data)
		.expect("mint_v2 CPI");
	let mut offset = 8;
	let name = read_borsh_string(data, &mut offset);
	let symbol = read_borsh_string(data, &mut offset);
	let uri = read_borsh_string(data, &mut offset);
	(name, symbol, uri)
}

fn collection_minted(program: &Harness, collection: &Pubkey) -> u32 {
	let data = program.account(collection).expect("collection").data;
	let mut offset = 33;
	let _name = read_borsh_string(&data, &mut offset);
	let _uri = read_borsh_string(&data, &mut offset);
	u32::from_le_bytes(data[offset..offset + 4].try_into().expect("num minted"))
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn exclusive_series_unwinds_before_it_is_initialized() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let (queue, ..) = oracle_fixture(&mut program);
		let opens_at = chain_timestamp(&program) + 3_600;
		let (template, box_mint) = create_template(&program, queue, opens_at);
		let bundle = add_bundle(&program, template, 0, SERIES_QUANTITY, 1);
		let ((series, bump), (fee_vault, fee_vault_bump)) = series_addresses(&program, template);
		let context = SeriesContext {
			template,
			bundle,
			series,
			fee_vault,
			box_mint,
		};

		assert!(
			create_series(
				&program,
				&context,
				bump,
				fee_vault_bump,
				&[(3, BONUS_LAMPORTS)]
			)
			.is_err(),
			"a bonus on an undrawable tier is rejected"
		);
		let before = program.balance(&program.payer()).expect("creator balance");
		create_series(
			&program,
			&context,
			bump,
			fee_vault_bump,
			&[(TOP_TIER, BONUS_LAMPORTS)],
		)
		.expect("series");
		assert_eq!(
			program.balance(&fee_vault).expect("fee vault"),
			rent_minimum(0) + SERIES_QUANTITY * BUBBLEGUM_MINT_V2_FEE_LAMPORTS,
		);
		program
			.send(
				&[LootboxInstruction::ActivateBundle as u8, 0],
				vec![
					AccountMeta::new(program.payer(), true),
					AccountMeta::new(template, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect_err("a configured series is not yet funded collateral");

		reclaim_series(&program, &context).expect("unwind configured series");
		assert!(program.account(&series).is_err(), "series closed");
		assert_eq!(program.balance(&fee_vault).expect("fee vault"), 0);
		let after = program.balance(&program.payer()).expect("creator balance");
		assert!(
			before - after < 50_000,
			"every escrowed lamport and the rent returned, minus fees"
		);
		let bundle_state = program.account(&bundle).expect("bundle");
		let bundle_state = BundleState::try_from_bytes(&bundle_state.data).expect("bundle");
		assert_eq!(bundle_state.kinds[0], 0, "slot released");
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8, 0],
				vec![
					AccountMeta::new(program.payer(), true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
				],
			)
			.expect("cancel the empty staged bundle");
		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn exclusive_nfts_mint_to_the_bound_beneficiary_with_a_bonus_paid_once() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		deploy_metaplex_programs(&program);
		let (queue, oracle, cpi) = oracle_fixture(&mut program);
		let payer = program.payer();
		let recipient = Keypair::new();
		program
			.fund(&recipient.pubkey(), 100_000_000)
			.expect("recipient fee funds");
		let opens_at = chain_timestamp(&program) + 60;
		let (template, box_mint) = create_template(&program, queue, opens_at);
		let creator_box_ata = box_ata(&program, &payer, &box_mint);
		let recipient_box_ata = box_ata(&program, &recipient.pubkey(), &box_mint);
		let bundle = add_bundle(&program, template, 0, SERIES_QUANTITY, 1);
		let ((series, bump), (fee_vault, fee_vault_bump)) = series_addresses(&program, template);
		let context = SeriesContext {
			template,
			bundle,
			series,
			fee_vault,
			box_mint,
		};
		create_series(
			&program,
			&context,
			bump,
			fee_vault_bump,
			&[(TOP_TIER, BONUS_LAMPORTS), (RARE_TIER, RARE_BONUS_LAMPORTS)],
		)
		.expect("series");

		let tree = Keypair::new();
		let collection = Keypair::new();
		let tree_config =
			Pubkey::find_program_address(&[tree.pubkey().as_ref()], &pubkey(METAPLEX_PROGRAMS[0]))
				.0;
		let space = merkle_tree_space(u64::from(TREE_DEPTH), u64::from(TREE_BUFFER));
		let mut initialize = vec![0; InitializeExclusiveSeriesInstruction::SIZE];
		let args = InitializeExclusiveSeriesInstruction::initialize(&mut initialize, |_| Ok(()))
			.expect("initialize data");
		args.max_depth = TREE_DEPTH;
		args.max_buffer_size.set(TREE_BUFFER);
		let initialize = program.instruction(
			&initialize,
			vec![
				AccountMeta::new(payer, true),
				AccountMeta::new_readonly(template, false),
				AccountMeta::new(bundle, false),
				AccountMeta::new(series, false),
				AccountMeta::new(collection.pubkey(), true),
				AccountMeta::new(tree_config, false),
				AccountMeta::new(tree.pubkey(), false),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[1]), false),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[0]), false),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[3]), false),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[2]), false),
				AccountMeta::new_readonly(Pubkey::default(), false),
			],
		);
		program
			.send_instructions_with_signers(
				&[
					create_account_instruction(
						&payer,
						&tree.pubkey(),
						rent_minimum(space),
						space,
						&pubkey(METAPLEX_PROGRAMS[2]),
					),
					initialize,
				],
				&[&tree, &collection],
			)
			.expect("create the series Core collection and private Bubblegum V2 tree");
		let config = program.account(&tree_config).expect("tree config");
		assert_eq!(
			&config.data[8..40],
			series.as_ref(),
			"series is tree creator"
		);
		assert_eq!(
			&config.data[40..72],
			series.as_ref(),
			"series is tree delegate"
		);
		assert_eq!(config.data[88], 0, "private tree");
		let collection_account = program.account(&collection.pubkey()).expect("collection");
		assert_eq!(collection_account.data[0], 5, "Core CollectionV1");
		assert_eq!(&collection_account.data[1..33], series.as_ref());

		activate_bundle(&program, template, bundle);
		program
			.send(
				&[LootboxInstruction::SealTemplate as u8, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("seal");
		program
			.send(
				&template_mint_data(SERIES_QUANTITY),
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new(box_mint, false),
					AccountMeta::new(creator_box_ata, false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("mint exact boxes");
		lock_treasury(&program, template, box_mint, 1);
		program
			.send_instruction(
				token_ix::transfer_checked(
					&token_2022(),
					&creator_box_ata,
					&box_mint,
					&recipient_box_ata,
					&payer,
					&[],
					SERIES_QUANTITY,
					0,
				)
				.expect("box transfer"),
			)
			.expect("deliver boxes");
		program
			.surfnet
			.cheatcodes()
			.time_travel_to_timestamp(u64::try_from(opens_at + 1).expect("time") * 1000)
			.expect("unlock");

		let mut openings = Vec::new();
		for _ in 0..SERIES_QUANTITY {
			let randomness = Keypair::new();
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
							mint: box_mint,
							ata: recipient_box_ata,
							opening,
							randomness: randomness.pubkey(),
							queue,
							oracle,
							cpi: &cpi,
						}),
					),
					&[&recipient, &randomness],
				)
				.expect("commit opening");
			openings.push((opening, randomness.pubkey()));
		}
		program.advance_one_slot().expect("oracle delay");
		for (index, (opening, randomness)) in openings.iter().enumerate() {
			fulfill(
				&FulfillContext {
					program: &program,
					payer: &recipient,
					template,
					opening: *opening,
					randomness: *randomness,
					queue,
					oracle,
					cpi: &cpi,
				},
				7 + u8::try_from(index).expect("index"),
			)
			.expect("fulfill");
			let (result_receipt, result_receipt_bump) =
				result_receipt_address(&program, *opening).expect("result receipt");
			program
				.send(
					&[
						LootboxInstruction::AllocateTemplateOpen as u8,
						0,
						result_receipt_bump,
					],
					vec![
						AccountMeta::new(template, false),
						AccountMeta::new(*opening, false),
						AccountMeta::new_readonly(bundle, false),
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
				.expect("allocate the consolation bundle");
		}

		let claim_accounts = |opening: Pubkey, recipient: Pubkey| {
			vec![
				AccountMeta::new_readonly(template, false),
				AccountMeta::new(opening, false),
				AccountMeta::new(bundle, false),
				AccountMeta::new(series, false),
				AccountMeta::new(fee_vault, false),
				AccountMeta::new(recipient, false),
				AccountMeta::new(tree_config, false),
				AccountMeta::new(tree.pubkey(), false),
				AccountMeta::new(collection.pubkey(), false),
				AccountMeta::new_readonly(
					Pubkey::new_from_array(MPL_CORE_CPI_SIGNER_ID.to_bytes()),
					false,
				),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[0]), false),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[1]), false),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[3]), false),
				AccountMeta::new_readonly(pubkey(METAPLEX_PROGRAMS[2]), false),
				AccountMeta::new_readonly(Pubkey::default(), false),
			]
		};
		let claim_data = [LootboxInstruction::ClaimExclusiveNft as u8, 0, 0];
		for (index, (opening, _)) in openings.iter().enumerate() {
			let serial = u64::try_from(index + 1).expect("serial");
			let redirect = program.instruction(&claim_data, claim_accounts(*opening, payer));
			assert!(
				program.send_instruction(redirect).is_err(),
				"a relayer cannot redirect the NFT or its bonus"
			);

			let claim =
				program.instruction(&claim_data, claim_accounts(*opening, recipient.pubkey()));
			let execution = program
				.simulate_instructions(std::slice::from_ref(&claim), &[])
				.expect("simulate claim");
			let bubblegum_units = execution
				.logs
				.iter()
				.find_map(|line| {
					line.strip_prefix(&format!("Program {} consumed ", METAPLEX_PROGRAMS[0]))?
						.split_whitespace()
						.next()?
						.parse::<u64>()
						.ok()
				})
				.expect("Bubblegum compute log");
			eprintln!(
				"claim_exclusive_nft #{serial}: {} compute units total, {bubblegum_units} inside \
				 Bubblegum mint_v2",
				execution.compute_units
			);
			assert!(
				execution.compute_units < 200_000,
				"a claim fits the default compute budget"
			);
			let balance_before = program.balance(&recipient.pubkey()).expect("balance");
			program
				.send_instruction(claim.clone())
				.expect("permissionless claim mints to the bound beneficiary");
			program.advance_one_slot().expect("new blockhash");
			assert!(
				program.send_instruction(claim).is_err(),
				"one opening mints once"
			);

			let event_bytes = minted_event_bytes(&execution.logs);
			let event = ExclusiveNftMintedEvent::try_from_bytes(&event_bytes).expect("event");
			let seed = exclusive_nft_seed(
				&template.to_bytes().into(),
				&opening.to_bytes().into(),
				&[7 + u8::try_from(index).expect("index"); 32],
			);
			let traits = exclusive_traits(&seed, &TIER_WEIGHTS, COUNTS).expect("traits");
			let bonus = if index == 0 { BONUS_LAMPORTS } else { 0 };
			assert_eq!(event.seed, seed);
			assert_eq!(event.serial.get(), serial);
			assert_eq!(event.bonus_lamports.get(), bonus);
			assert_eq!(
				(event.tier, event.contents, event.background, event.pattern),
				(
					traits.tier,
					traits.contents,
					traits.background,
					traits.pattern
				),
			);
			assert_eq!(usize::from(event.tier), TOP_TIER);
			assert_eq!(
				program.balance(&recipient.pubkey()).expect("balance") - balance_before,
				bonus,
				"the tier bonus is paid only while its escrowed count lasts"
			);

			let name = format!("{NAME_PREFIX} #{serial}");
			let uri = format!(
				"{BASE_URI}{}-{}-{}-{}-{serial}.json",
				traits.tier, traits.contents, traits.background, traits.pattern
			);
			assert_eq!(
				minted_metadata(&execution),
				(name.clone(), SYMBOL.to_owned(), uri.clone())
			);
			let leaf = minted_leaf(&execution);
			let metadata = expected_metadata(&name, &uri, &collection.pubkey());
			let expected_data_hash =
				keccak_hashv(&[keccak_hashv(&[&metadata]).as_ref(), &0u16.to_le_bytes()]);
			assert_eq!(
				leaf.owner,
				recipient.pubkey(),
				"leaf owned by the beneficiary"
			);
			assert_eq!(
				leaf.id.as_ref(),
				event.asset.as_ref(),
				"event names the asset"
			);
			assert_eq!(leaf.nonce, serial - 1);
			assert_eq!(leaf.data_hash, expected_data_hash.to_bytes());
		}

		let config = program.account(&tree_config).expect("tree config");
		assert_eq!(stored_u64(&config.data, 80), SERIES_QUANTITY);
		assert_eq!(
			collection_minted(&program, &collection.pubkey()),
			u32::try_from(SERIES_QUANTITY).expect("count")
		);
		assert_eq!(
			program.balance(&fee_vault).expect("fee vault"),
			rent_minimum(0),
			"Bubblegum fees came from the creator's escrow, not the claimer"
		);
		let series_state = program.account(&series).expect("series");
		let series_state =
			ExclusiveSeriesState::try_from_bytes(&series_state.data).expect("series");
		assert_eq!(series_state.minted.get(), SERIES_QUANTITY);
		let series_rent = rent_minimum(ExclusiveSeriesState::SIZE as u64);
		assert_eq!(
			program.balance(&series).expect("series"),
			series_rent + RARE_BONUS_LAMPORTS,
			"the unwon rare-tier bonus stays escrowed"
		);

		assert!(
			reclaim_series(&program, &context).is_err(),
			"a live market treasury keeps its bonus reserves"
		);
		program
			.send(
				&[LootboxInstruction::RetireTemplate as u8, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("retire the fully opened series");
		let creator_before = program.balance(&payer).expect("creator");
		reclaim_series(&program, &context).expect("recover unwinnable bonuses");
		assert_eq!(program.balance(&series).expect("series"), series_rent);
		assert_eq!(
			program.balance(&fee_vault).expect("fee vault"),
			rent_minimum(0)
		);
		let recovered = program.balance(&payer).expect("creator") + 10_000 - creator_before;
		assert!(
			(RARE_BONUS_LAMPORTS..RARE_BONUS_LAMPORTS + 10_000).contains(&recovered),
			"only the unwinnable reserve returns to the creator"
		);
		program.advance_one_slot().expect("new blockhash");
		reclaim_series(&program, &context).expect("repeated recovery is a no-op");
		assert_eq!(program.balance(&series).expect("series"), series_rent);
		program.stop().expect("stop Surfpool");
	});
}
