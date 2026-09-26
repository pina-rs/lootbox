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
const COLLECTION_ID: u64 = 1;
const NAME_PREFIX: &str = "Introductory";
const SYMBOL: &str = "LBX";
const BASE_URI: &str = "https://example.com/exclusive/";
const TREE_DEPTH: u8 = 14;
const TREE_BUFFER: u32 = 64;
/// Trait counts of the fixture layers, bottom to top.
const FIXTURE_TRAITS: [u8; 7] = [15, 16, 8, 10, 12, 20, 13];

fn pubkey(address: &str) -> Pubkey {
	Pubkey::from_str_const(address)
}

fn bubblegum() -> Pubkey {
	pubkey(METAPLEX_PROGRAMS[0])
}

fn core() -> Pubkey {
	pubkey(METAPLEX_PROGRAMS[1])
}

fn compression() -> Pubkey {
	pubkey(METAPLEX_PROGRAMS[2])
}

fn noop() -> Pubkey {
	pubkey(METAPLEX_PROGRAMS[3])
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

fn padded<const N: usize>(value: &str) -> [u8; N] {
	let mut bytes = [0; N];
	bytes[..value.len()].copy_from_slice(value.as_bytes());
	bytes
}

/// Fixture weights: a steep power law so rare combinations exist, with a
/// dominant "none" trait in the decoration layer.
fn fixture_weight(layer: usize, slot: usize) -> u32 {
	if layer == 4 && slot == 0 {
		return 5_000_000;
	}
	let rank = u32::try_from(slot + 1).expect("slot");
	(1_000_000 / (rank * rank)).max(1)
}

fn fixture_table() -> ([u8; 12], Vec<u8>) {
	let mut counts = [0u8; 12];
	let mut weights = vec![0u8; 12 * 256];
	for (layer, count) in FIXTURE_TRAITS.iter().enumerate() {
		counts[layer] = *count;
		for slot in 0..usize::from(*count) {
			let start = layer * 256 + slot * 4;
			weights[start..start + 4].copy_from_slice(&fixture_weight(layer, slot).to_le_bytes());
		}
	}
	(counts, weights)
}

struct CollectionContext {
	collection: Pubkey,
	core_collection: Pubkey,
	tree: Pubkey,
	tree_config: Pubkey,
}

/// Create, load, and publish the fixture collection with one tree.
fn publish_collection(program: &Harness, attach_closes_at: i64) -> CollectionContext {
	let payer = program.payer();
	let (collection, bump) = Pubkey::find_program_address(
		&[
			b"exclusive-collection",
			payer.as_ref(),
			&COLLECTION_ID.to_le_bytes(),
		],
		&program.program_id,
	);
	let core_collection = Keypair::new();
	let mut create = vec![0; CreateExclusiveCollectionInstruction::SIZE];
	let args = CreateExclusiveCollectionInstruction::initialize(&mut create, |_| Ok(()))
		.expect("create collection data");
	args.collection_id.set(COLLECTION_ID);
	args.attach_opens_at.set(chain_timestamp(program) - 10);
	args.attach_closes_at.set(attach_closes_at);
	args.layer_count = u8::try_from(FIXTURE_TRAITS.len()).expect("layers");
	args.bump = bump;
	args.name_prefix = padded(NAME_PREFIX);
	args.symbol = padded(SYMBOL);
	args.base_uri = padded(BASE_URI);
	program
		.send_with_signers(
			program.instruction(
				&create,
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(collection, false),
					AccountMeta::new(core_collection.pubkey(), true),
					AccountMeta::new_readonly(core(), false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			),
			&[&core_collection],
		)
		.expect("create the collection and its PDA-controlled Core collection");

	let (counts, weights) = fixture_table();
	for layer in 0..FIXTURE_TRAITS.len() {
		let mut data = vec![0; SetExclusiveLayerInstruction::SIZE];
		let args =
			SetExclusiveLayerInstruction::initialize(&mut data, |_| Ok(())).expect("layer data");
		args.layer_index = u8::try_from(layer).expect("layer");
		args.trait_count = counts[layer];
		args.weights
			.copy_from_slice(&weights[layer * 256..(layer + 1) * 256]);
		program
			.send(
				&data,
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(collection, false),
				],
			)
			.expect("load one layer table");
	}

	let publish = [LootboxInstruction::PublishExclusiveCollection as u8, 0];
	let publish_accounts = vec![
		AccountMeta::new_readonly(payer, true),
		AccountMeta::new(collection, false),
	];
	assert!(
		program.send(&publish, publish_accounts.clone()).is_err(),
		"a collection cannot publish without a tree"
	);

	let proof_heavy = append_tree(program, collection, 0);
	assert!(
		proof_heavy.is_err(),
		"a tree whose proofs exceed ten nodes is rejected"
	);
	let tree = Keypair::new();
	let canopy = u64::from(TREE_DEPTH) - u64::from(MAX_EXCLUSIVE_TRANSFER_PROOF_NODES);
	let tree_config = append_tree_with(program, collection, &tree, canopy)
		.expect("append a private Bubblegum V2 tree");
	program
		.send(&publish, publish_accounts.clone())
		.expect("publish and freeze the layers");
	assert!(
		program.send(&publish, publish_accounts).is_err(),
		"a collection publishes exactly once"
	);

	let mut layer = vec![0; SetExclusiveLayerInstruction::SIZE];
	let args =
		SetExclusiveLayerInstruction::initialize(&mut layer, |_| Ok(())).expect("layer data");
	args.trait_count = 1;
	args.weights[0] = 1;
	assert!(
		program
			.send(
				&layer,
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(collection, false),
				],
			)
			.is_err(),
		"published layers are frozen"
	);

	CollectionContext {
		collection,
		core_collection: core_collection.pubkey(),
		tree: tree.pubkey(),
		tree_config,
	}
}

fn append_tree(program: &Harness, collection: Pubkey, canopy: u64) -> Result<Pubkey, String> {
	append_tree_with(program, collection, &Keypair::new(), canopy)
}

fn append_tree_with(
	program: &Harness,
	collection: Pubkey,
	tree: &Keypair,
	canopy: u64,
) -> Result<Pubkey, String> {
	let payer = program.payer();
	let tree_config = Pubkey::find_program_address(&[tree.pubkey().as_ref()], &bubblegum()).0;
	let space = merkle_tree_account_size(u64::from(TREE_DEPTH), u64::from(TREE_BUFFER), canopy);
	let mut data = vec![0; AppendExclusiveTreeInstruction::SIZE];
	let args =
		AppendExclusiveTreeInstruction::initialize(&mut data, |_| Ok(())).expect("tree data");
	args.max_depth = TREE_DEPTH;
	args.max_buffer_size.set(TREE_BUFFER);
	program.send_instructions_with_signers(
		&[
			create_account_instruction(
				&payer,
				&tree.pubkey(),
				rent_minimum(space),
				space,
				&compression(),
			),
			program.instruction(
				&data,
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(collection, false),
					AccountMeta::new(tree_config, false),
					AccountMeta::new(tree.pubkey(), false),
					AccountMeta::new_readonly(bubblegum(), false),
					AccountMeta::new_readonly(noop(), false),
					AccountMeta::new_readonly(compression(), false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			),
		],
		&[tree],
	)?;
	Ok(tree_config)
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

struct AttachmentContext {
	template: Pubkey,
	bundle: Pubkey,
	attachment: Pubkey,
	fee_vault: Pubkey,
	box_mint: Pubkey,
}

fn attach(
	program: &Harness,
	collection: Pubkey,
	template: Pubkey,
	bundle: Pubkey,
	box_mint: Pubkey,
) -> Result<AttachmentContext, String> {
	let (attachment, bump) = Pubkey::find_program_address(
		&[b"exclusive-attachment", bundle.as_ref(), &[0]],
		&program.program_id,
	);
	let (fee_vault, fee_vault_bump) = Pubkey::find_program_address(
		&[b"exclusive-fee-vault", attachment.as_ref()],
		&program.program_id,
	);
	program.send(
		&[
			LootboxInstruction::AttachExclusiveNft as u8,
			0,
			0,
			bump,
			fee_vault_bump,
		],
		vec![
			AccountMeta::new(program.payer(), true),
			AccountMeta::new_readonly(template, false),
			AccountMeta::new(bundle, false),
			AccountMeta::new_readonly(collection, false),
			AccountMeta::new(attachment, false),
			AccountMeta::new(fee_vault, false),
			AccountMeta::new_readonly(Pubkey::default(), false),
		],
	)?;
	Ok(AttachmentContext {
		template,
		bundle,
		attachment,
		fee_vault,
		box_mint,
	})
}

fn reclaim_fees(program: &Harness, context: &AttachmentContext) -> Result<(), String> {
	program.send(
		&[LootboxInstruction::ReclaimExclusiveFees as u8, 0, 0],
		vec![
			AccountMeta::new(program.payer(), true),
			AccountMeta::new_readonly(context.template, false),
			AccountMeta::new_readonly(context.box_mint, false),
			AccountMeta::new(context.bundle, false),
			AccountMeta::new(context.attachment, false),
			AccountMeta::new(context.fee_vault, false),
			AccountMeta::new_readonly(Pubkey::default(), false),
		],
	)
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
	let noop = noop();
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
	let bubblegum = bubblegum();
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

fn core_collection_minted(program: &Harness, collection: &Pubkey) -> u32 {
	let data = program.account(collection).expect("collection").data;
	let mut offset = 33;
	let _name = read_borsh_string(&data, &mut offset);
	let _uri = read_borsh_string(&data, &mut offset);
	u32::from_le_bytes(data[offset..offset + 4].try_into().expect("num minted"))
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn exclusive_attachment_unwinds_from_a_staged_bundle() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		deploy_metaplex_programs(&program);
		let (queue, ..) = oracle_fixture(&mut program);
		let payer = program.payer();
		let opens_at = chain_timestamp(&program) + 3_600;
		let collection = publish_collection(&program, opens_at);
		let (template, box_mint) = create_template(&program, queue, opens_at);
		let bundle = add_bundle(&program, template, 0, 3, 1);

		let before = program.balance(&payer).expect("creator balance");
		let context = attach(&program, collection.collection, template, bundle, box_mint)
			.expect("attach while the window is open");
		assert_eq!(
			program.balance(&context.fee_vault).expect("fee vault"),
			rent_minimum(0) + 3 * BUBBLEGUM_MINT_V2_FEE_LAMPORTS,
		);
		reclaim_fees(&program, &context).expect("unwind the staged attachment");
		assert!(
			program.account(&context.attachment).is_err(),
			"attachment closed"
		);
		assert_eq!(program.balance(&context.fee_vault).expect("fee vault"), 0);
		assert!(
			before - program.balance(&payer).expect("creator balance") < 50_000,
			"every escrowed lamport and the rent returned, minus fees"
		);
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
				],
			)
			.expect("cancel the reclaimed staged bundle");
		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn exclusive_nfts_mint_layered_traits_to_the_bound_beneficiary() {
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
		let collection = publish_collection(&program, opens_at);
		let (template, box_mint) = create_template(&program, queue, opens_at);
		let creator_box_ata = box_ata(&program, &payer, &box_mint);
		let recipient_box_ata = box_ata(&program, &recipient.pubkey(), &box_mint);
		// Four copies: three are opened and one is burned unopened, so
		// retirement recovery returns exactly one unused mint fee.
		let quantity = 4;
		let bundle = add_bundle(&program, template, 0, quantity, 1);
		let context = attach(&program, collection.collection, template, bundle, box_mint)
			.expect("attach while the window is open");

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
				&template_mint_data(quantity),
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
					quantity,
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
		assert!(
			attach(&program, collection.collection, template, bundle, box_mint).is_err(),
			"the attach window has closed"
		);

		let mut openings = Vec::new();
		for _ in 0..3 {
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
		program
			.send_with_signers(
				token_ix::burn_checked(
					&token_2022(),
					&recipient_box_ata,
					&box_mint,
					&recipient.pubkey(),
					&[],
					1,
					0,
				)
				.expect("burn"),
				&[&recipient],
			)
			.expect("burn the fourth box unopened");
		program.advance_one_slot().expect("oracle delay");
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
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
						AccountMeta::new(service_vault, false),
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
				AccountMeta::new(context.attachment, false),
				AccountMeta::new(context.fee_vault, false),
				AccountMeta::new(collection.collection, false),
				AccountMeta::new_readonly(recipient, false),
				AccountMeta::new(collection.tree_config, false),
				AccountMeta::new(collection.tree, false),
				AccountMeta::new(collection.core_collection, false),
				AccountMeta::new_readonly(
					Pubkey::new_from_array(MPL_CORE_CPI_SIGNER_ID.to_bytes()),
					false,
				),
				AccountMeta::new_readonly(bubblegum(), false),
				AccountMeta::new_readonly(core(), false),
				AccountMeta::new_readonly(noop(), false),
				AccountMeta::new_readonly(compression(), false),
				AccountMeta::new_readonly(Pubkey::default(), false),
			]
		};
		let claim_data = [LootboxInstruction::ClaimExclusiveNft as u8, 0, 0];
		let (counts, weights) = fixture_table();
		for (index, (opening, _)) in openings.iter().enumerate() {
			let serial = u64::try_from(index + 1).expect("serial");
			let redirect = program.instruction(&claim_data, claim_accounts(*opening, payer));
			assert!(
				program.send_instruction(redirect).is_err(),
				"a relayer cannot redirect the NFT"
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
			let layer_count = u8::try_from(FIXTURE_TRAITS.len()).expect("layers");
			let traits = exclusive_traits(&seed, &counts, &weights, layer_count).expect("traits");
			assert_eq!(event.seed, seed);
			assert_eq!(event.serial.get(), serial);
			assert_eq!(event.layer_count, layer_count);
			assert_eq!(event.traits, traits.traits);
			assert_eq!(event.collection.as_ref(), collection.collection.as_ref());

			let name = format!("{NAME_PREFIX} #{serial}");
			let hex = traits
				.as_slice()
				.iter()
				.fold(String::new(), |mut text, value| {
					use std::fmt::Write as _;
					write!(text, "{value:02x}").expect("write hex");
					text
				});
			let uri = format!("{BASE_URI}{hex}-{serial}.json");
			assert_eq!(
				minted_metadata(&execution),
				(name.clone(), SYMBOL.to_owned(), uri.clone())
			);
			let leaf = minted_leaf(&execution);
			let metadata = expected_metadata(&name, &uri, &collection.core_collection);
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

		let config = program
			.account(&collection.tree_config)
			.expect("tree config");
		assert_eq!(stored_u64(&config.data, 80), 3);
		assert_eq!(
			core_collection_minted(&program, &collection.core_collection),
			3
		);
		assert_eq!(
			program.balance(&context.fee_vault).expect("fee vault"),
			rent_minimum(0) + BUBBLEGUM_MINT_V2_FEE_LAMPORTS,
			"Bubblegum fees came from the creator's escrow, not the claimer"
		);

		assert!(
			reclaim_fees(&program, &context).is_err(),
			"a live market treasury keeps its mint-fee escrow"
		);
		program
			.send(
				&[LootboxInstruction::RetireTemplate as u8, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("retire the drained series");
		let creator_before = program.balance(&payer).expect("creator");
		reclaim_fees(&program, &context).expect("recover the unused copy's fee");
		assert_eq!(
			program.balance(&context.fee_vault).expect("fee vault"),
			rent_minimum(0)
		);
		assert_eq!(
			program.balance(&payer).expect("creator") + 5_000 - creator_before,
			BUBBLEGUM_MINT_V2_FEE_LAMPORTS,
			"exactly the unused copy's fee returns"
		);
		program.stop().expect("stop Surfpool");
	});
}
