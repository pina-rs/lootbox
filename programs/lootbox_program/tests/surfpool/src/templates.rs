//! current treasury protocol tests use real token programs and real lootbox SBF. Only the external
//! oracle boundary is emulated; no lootbox account is fabricated or mutated.

use program_under_test::*;
use spl_token_2022_interface::instruction as token_ix;
use spl_token_metadata_interface::instruction as metadata_ix;

use super::*;

const NAME: &str = "Treasury test";
const URI: &str = "https://example.com/lootbox.json";

fn token_2022() -> Pubkey {
	spl_token_2022_interface::id()
}

fn mint_with_metadata(program: &Harness, template: &Pubkey) -> Pubkey {
	let mint = Keypair::new();
	let payer = program.payer();
	let address = mint.pubkey();
	let instructions = [
		create_account_instruction(&payer, &address, rent_minimum(512), 234, &token_2022()),
		spl_token_2022_interface::extension::metadata_pointer::instruction::initialize(
			&token_2022(),
			&address,
			None,
			Some(address),
		)
		.expect("pointer"),
		token_ix::initialize_mint2(&token_2022(), &address, &payer, None, 0).expect("mint"),
		metadata_ix::initialize(
			&token_2022(),
			&address,
			&payer,
			&address,
			&payer,
			NAME.to_owned(),
			"LOOT".to_owned(),
			URI.to_owned(),
		),
		metadata_ix::update_authority(&token_2022(), &address, &payer, Pubkey::default().into()),
		token_ix::set_authority(
			&token_2022(),
			&address,
			Some(template),
			token_ix::AuthorityType::MintTokens,
			&payer,
			&[],
		)
		.expect("authority"),
	];
	program
		.send_instructions_with_signers(&instructions, &[&mint])
		.expect("create immutable Token-2022 metadata mint");
	address
}

fn box_ata(program: &Harness, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
	let address = Pubkey::find_program_address(
		&[owner.as_ref(), token_2022().as_ref(), mint.as_ref()],
		&ata_program_id(),
	)
	.0;
	program
		.send_instruction(Instruction::new_with_bytes(
			ata_program_id(),
			&[1],
			vec![
				AccountMeta::new(program.payer(), true),
				AccountMeta::new(address, false),
				AccountMeta::new_readonly(*owner, false),
				AccountMeta::new_readonly(*mint, false),
				AccountMeta::new_readonly(Pubkey::default(), false),
				AccountMeta::new_readonly(token_2022(), false),
			],
		))
		.expect("Token-2022 ATA");
	address
}

fn create_template_data(
	queue: Pubkey,
	bump: u8,
	opens_at: i64,
	result_receipts_enabled: bool,
) -> Vec<u8> {
	let mut bytes = vec![0; CreateTemplateInstruction::SIZE];
	let args = CreateTemplateInstruction::initialize(&mut bytes).expect("create template data");
	args.id.set(1);
	args.opens_at.set(opens_at);
	args.oracle_program = SWITCHBOARD_DEVNET_ID;
	args.oracle_queue = queue.to_bytes().into();
	args.name[..NAME.len()].copy_from_slice(NAME.as_bytes());
	args.uri[..URI.len()].copy_from_slice(URI.as_bytes());
	args.settlement_bounty_lamports
		.set(if result_receipts_enabled { 1_000 } else { 0 });
	args.result_receipts_enabled.set(result_receipts_enabled);
	args.bump = bump;
	bytes
}

fn add_bundle(
	program: &Harness,
	template: Pubkey,
	index: u32,
	quantity: u64,
	assets: u8,
) -> Pubkey {
	let (bundle, bump) = Pubkey::find_program_address(
		&[b"bundle", template.as_ref(), &index.to_le_bytes()],
		&program.program_id,
	);
	let mut bytes = vec![0; AddBundleInstruction::SIZE];
	let args = AddBundleInstruction::initialize(&mut bytes).expect("bundle data");
	args.quantity.set(quantity);
	args.asset_count = assets;
	args.bump = bump;
	program
		.send(
			&bytes,
			vec![
				AccountMeta::new(program.payer(), true),
				AccountMeta::new(template, false),
				AccountMeta::new(bundle, false),
				AccountMeta::new_readonly(Pubkey::default(), false),
			],
		)
		.expect("add bundle");
	bundle
}

fn activate_bundle(program: &Harness, template: Pubkey, bundle: Pubkey) {
	program
		.send(
			&[LootboxInstruction::ActivateBundle as u8],
			vec![
				AccountMeta::new_readonly(program.payer(), true),
				AccountMeta::new(template, false),
				AccountMeta::new(bundle, false),
			],
		)
		.expect("activate fully funded bundle");
}

fn fund_sol(
	program: &Harness,
	template: Pubkey,
	bundle: Pubkey,
	amount: u64,
) -> Result<(), String> {
	let mut bytes = vec![0; FundSolPrizeInstruction::SIZE];
	FundSolPrizeInstruction::initialize(&mut bytes)
		.expect("fund data")
		.lamports_per_win
		.set(amount);
	program.send(
		&bytes,
		vec![
			AccountMeta::new(program.payer(), true),
			AccountMeta::new(template, false),
			AccountMeta::new(bundle, false),
			AccountMeta::new_readonly(Pubkey::default(), false),
		],
	)
}

fn fund_token(
	program: &Harness,
	template: Pubkey,
	bundle: Pubkey,
	nft: bool,
	quantity: u64,
) -> Pubkey {
	let payer = program.payer();
	let mint = provision_mint(program, &payer, &payer).expect("reward mint");
	let source = provision_ata(program, &payer, &payer, &mint).expect("source");
	let escrow = provision_ata(program, &payer, &bundle, &mint).expect("escrow");
	let amount = if nft { 1 } else { 100 };
	let mut mint_data = vec![7];
	mint_data.extend_from_slice(&(amount * quantity).to_le_bytes());
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
		.expect("fund rewards");
	if nft {
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
	}
	let mut data = vec![0; FundTokenPrizeInstruction::SIZE];
	let args = FundTokenPrizeInstruction::initialize(&mut data).expect("fund token data");
	args.amount_per_win.set(amount);
	args.is_nft.set(nft);
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
		.expect("escrow complete prize inventory");
	mint
}

fn template_mint_data(amount: u64) -> Vec<u8> {
	let mut data = vec![0; MintTemplateBoxesInstruction::SIZE];
	MintTemplateBoxesInstruction::initialize(&mut data)
		.expect("mint data")
		.amount
		.set(amount);
	data
}

fn chain_timestamp(program: &Harness) -> i64 {
	let clock = program.account(&clock_sysvar_id()).expect("clock");
	i64::from_le_bytes(clock.data[32..40].try_into().expect("timestamp"))
}

fn lock_treasury(program: &Harness, template: Pubkey, mint: Pubkey, bundle_count: u32) {
	let next_bundle = Pubkey::find_program_address(
		&[b"bundle", template.as_ref(), &bundle_count.to_le_bytes()],
		&program.program_id,
	)
	.0;
	let (service_vault, service_vault_bump) =
		Pubkey::find_program_address(&[b"service-vault", template.as_ref()], &program.program_id);
	let mut data = vec![0; LockTreasuryInstruction::SIZE];
	LockTreasuryInstruction::initialize(&mut data)
		.expect("lock data")
		.service_vault_bump = service_vault_bump;
	program
		.send(
			&data,
			vec![
				AccountMeta::new(program.payer(), true),
				AccountMeta::new(template, false),
				AccountMeta::new(mint, false),
				AccountMeta::new_readonly(next_bundle, false),
				AccountMeta::new(service_vault, false),
				AccountMeta::new_readonly(Pubkey::default(), false),
				AccountMeta::new_readonly(token_2022(), false),
			],
		)
		.expect("lock exact treasury supply");

	let mint_account = program.account(&mint).expect("locked mint");
	assert_eq!(&mint_account.data[..4], &[0; 4], "mint authority revoked");
}

fn template_request_data(bump: u8, beneficiary: Pubkey) -> Vec<u8> {
	let mut data = vec![0; RequestTemplateOpenInstruction::SIZE];
	let args = RequestTemplateOpenInstruction::initialize(&mut data).expect("request data");
	args.recent_slot.set(1);
	args.beneficiary = beneficiary.to_bytes().into();
	args.bump = bump;
	data
}

struct TemplateRequestContext<'a> {
	owner: Pubkey,
	template: Pubkey,
	mint: Pubkey,
	ata: Pubkey,
	opening: Pubkey,
	randomness: Pubkey,
	queue: Pubkey,
	oracle: Pubkey,
	cpi: &'a OracleCpiAccounts,
}

fn template_request_accounts(context: &TemplateRequestContext<'_>) -> Vec<AccountMeta> {
	let mut accounts = request_accounts(
		&context.owner,
		&context.template,
		&Pubkey::default(),
		&context.mint,
		&context.ata,
		&context.opening,
		&context.randomness,
		&context.queue,
		&context.oracle,
		context.cpi,
	);
	accounts.remove(2);
	accounts.insert(0, AccountMeta::new_readonly(context.owner, true));
	accounts.insert(
		accounts.len() - 1,
		AccountMeta::new_readonly(token_2022(), false),
	);
	accounts
}

fn oracle_fixture(program: &mut Harness) -> (Pubkey, Pubkey, OracleCpiAccounts) {
	let artifact = std::env::var("MOCK_SWITCHBOARD_SBF_ARTIFACT").expect("oracle artifact");
	program
		.deploy_program(oracle_program_id(), Path::new(&artifact))
		.expect("oracle emulator");
	let queue = Pubkey::new_unique();
	let oracle = Pubkey::new_unique();
	let cpi = OracleCpiAccounts {
		reward_escrow: Pubkey::new_unique(),
		program_state: Pubkey::new_unique(),
		lut_signer: Pubkey::new_unique(),
		lut: Pubkey::new_unique(),
		stats: Pubkey::new_unique(),
	};
	program
		.fund_many(
			&[
				queue,
				oracle,
				cpi.reward_escrow,
				cpi.program_state,
				cpi.lut_signer,
				cpi.lut,
				cpi.stats,
			],
			rent_minimum(0),
		)
		.expect("oracle infrastructure");
	(queue, oracle, cpi)
}

struct FulfillContext<'a> {
	program: &'a Harness,
	payer: &'a Keypair,
	template: Pubkey,
	opening: Pubkey,
	randomness: Pubkey,
	queue: Pubkey,
	oracle: Pubkey,
	cpi: &'a OracleCpiAccounts,
}

fn fulfill(context: &FulfillContext<'_>, value: u8) -> Result<(), String> {
	let mut accounts = settle_accounts(
		&context.payer.pubkey(),
		&context.payer.pubkey(),
		&context.template,
		&Pubkey::default(),
		&Pubkey::default(),
		&context.opening,
		&context.randomness,
		&context.queue,
		&context.oracle,
		context.cpi,
	);
	for index in [4, 3, 0] {
		accounts.remove(index);
	}
	let service_vault = Pubkey::find_program_address(
		&[b"service-vault", context.template.as_ref()],
		&context.program.program_id,
	)
	.0;
	accounts.insert(2, AccountMeta::new(service_vault, false));
	let mut data = vec![0; FulfillTemplateOpenInstruction::SIZE];
	let args = FulfillTemplateOpenInstruction::initialize(&mut data).expect("fulfill");
	args.signature.fill(7);
	args.recovery_id = 1;
	args.value.fill(value);
	context.program.send_with_signers(
		context.program.instruction(&data, accounts),
		&[context.payer],
	)?;
	let account = context.program.account(&context.randomness)?;
	let snapshot = randomness_snapshot(&account);
	if snapshot.authority.as_ref() != context.opening.as_ref()
		|| snapshot.queue.as_ref() != context.queue.as_ref()
		|| snapshot.oracle.as_ref() != context.oracle.as_ref()
		|| snapshot.reveal_slot <= snapshot.seed_slot
		|| snapshot.value != [value; 32]
	{
		return Err("on-chain randomness receipt does not match the fulfilled proof".to_owned());
	}

	Ok(())
}

fn allocate_any(
	program: &Harness,
	template: Pubkey,
	opening: Pubkey,
	bundles: &[Pubkey; 3],
) -> Result<usize, String> {
	// Exercise wrong-prize account rejection as well as the successful path.
	let mut failures = Vec::with_capacity(bundles.len());
	for (index, bundle) in bundles.iter().enumerate() {
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
		let (result_receipt, result_receipt_bump) = Pubkey::find_program_address(
			&[b"result-receipt", opening.as_ref()],
			&program.program_id,
		);
		let mut data = vec![0; AllocateTemplateOpenInstruction::SIZE];
		AllocateTemplateOpenInstruction::initialize(&mut data)
			.expect("allocate")
			.result_receipt_bump = result_receipt_bump;
		match program.send(
			&data,
			vec![
				AccountMeta::new(template, false),
				AccountMeta::new(opening, false),
				AccountMeta::new(*bundle, false),
				AccountMeta::new(service_vault, false),
				AccountMeta::new(result_receipt, false),
				AccountMeta::new_readonly(Pubkey::default(), false),
			],
		) {
			Ok(()) => return Ok(index),
			Err(error) => failures.push(format!("bundle {index}: {error}")),
		}
	}
	Err(format!(
		"no bundle can be allocated: {}",
		failures.join("; ")
	))
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn template_treasury_token_nft_fifo_and_time_lock_round_trip() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let (queue, oracle, cpi) = oracle_fixture(&mut program);
		let payer = program.payer();
		let recipient = Keypair::new();
		program
			.fund(&recipient.pubkey(), 100_000_000)
			.expect("recipient fee funds");
		let (template, bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata(&program, &template);
		let creator_ata = box_ata(&program, &payer, &mint);
		let owner_ata = box_ata(&program, &recipient.pubkey(), &mint);
		let now = chain_timestamp(&program);
		let opens_at = now + 3600;
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
		let first_bundle = add_bundle(&program, template, 0, 3, 1);
		let seal_accounts = vec![
			AccountMeta::new_readonly(payer, true),
			AccountMeta::new(template, false),
		];
		assert!(
			program
				.send(
					&[LootboxInstruction::SealTemplate as u8],
					seal_accounts.clone()
				)
				.is_err(),
			"unfunded prizes cannot be sold"
		);
		fund_sol(&program, template, first_bundle, 100_000).expect("SOL inventory");
		activate_bundle(&program, template, first_bundle);
		let second_bundle = add_bundle(&program, template, 1, 2, 1);
		let reward_mint = fund_token(&program, template, second_bundle, false, 2);
		activate_bundle(&program, template, second_bundle);
		let third_bundle = add_bundle(&program, template, 2, 1, 3);
		fund_sol(&program, template, third_bundle, 1_000_000).expect("jackpot SOL");
		assert!(
			fund_sol(&program, template, third_bundle, 1_000_000).is_err(),
			"same SOL collateral cannot be recorded twice"
		);
		let nft_a = fund_token(&program, template, third_bundle, true, 1);
		let nft_b = fund_token(&program, template, third_bundle, true, 1);
		activate_bundle(&program, template, third_bundle);
		let bundles = [first_bundle, second_bundle, third_bundle];
		program
			.send(&[LootboxInstruction::SealTemplate as u8], seal_accounts)
			.expect("seal funded manifest");
		let mint_accounts = vec![
			AccountMeta::new_readonly(payer, true),
			AccountMeta::new(template, false),
			AccountMeta::new(mint, false),
			AccountMeta::new(creator_ata, false),
			AccountMeta::new_readonly(token_2022(), false),
		];
		program
			.send(&template_mint_data(6), mint_accounts.clone())
			.expect("mint six tradable claims");
		assert!(
			program
				.send(&template_mint_data(1), mint_accounts.clone())
				.is_err(),
			"no overissuance"
		);
		lock_treasury(&program, template, mint, 3);
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
		assert_eq!(
			program.balance(&service_vault).expect("service balance"),
			rent_minimum(0) + 6 * (rent_minimum(ResultReceiptState::SIZE as u64) + 1_000),
			"service reserve includes one recoverable zero-data rent floor",
		);
		assert_eq!(
			program
				.account(&service_vault)
				.expect("service vault")
				.owner,
			Pubkey::default(),
			"creator-funded services are isolated from prizes",
		);
		assert!(
			program.send(&template_mint_data(1), mint_accounts).is_err(),
			"locked treasury rejects any later issuance",
		);
		assert!(
			fund_sol(&program, template, first_bundle, 100_000).is_err(),
			"locked treasury rejects every funding mutation",
		);
		program
			.send_instruction(
				token_ix::transfer_checked(
					&token_2022(),
					&creator_ata,
					&mint,
					&owner_ata,
					&payer,
					&[],
					6,
					0,
				)
				.expect("standard token transfer"),
			)
			.expect("transfer unopened boxes before their claim date");
		assert_eq!(
			token_amount(&program.account(&creator_ata).expect("creator ATA")),
			0
		);
		assert_eq!(
			token_amount(&program.account(&owner_ata).expect("recipient ATA")),
			6
		);
		let mut openings = Vec::new();
		for index in 0..6 {
			let randomness = Keypair::new();
			let (opening, bump) = Pubkey::find_program_address(
				&[
					b"template-opening",
					template.as_ref(),
					randomness.pubkey().as_ref(),
				],
				&program.program_id,
			);
			let request = program.instruction(
				&template_request_data(bump, recipient.pubkey()),
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
				assert!(
					program
						.send_with_signers(request.clone(), &[&recipient, &randomness])
						.is_err(),
					"early opening is rejected"
				);
				assert_eq!(
					token_amount(&program.account(&owner_ata).expect("unburned tokens")),
					6
				);
				program
					.surfnet
					.cheatcodes()
					.time_travel_to_timestamp(
						u64::try_from(opens_at + 1).expect("timestamp") * 1000,
					)
					.expect("unlock date");
			}
			program
				.send_with_signers(request, &[&recipient, &randomness])
				.expect("burn and commit");
			openings.push((opening, randomness.pubkey()));
		}
		assert_eq!(
			token_amount(&program.account(&owner_ata).expect("all burned")),
			0
		);
		program
			.send(
				&[LootboxInstruction::RetireTemplate as u8],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("retirement does not revoke committed openings");
		let reclaim_accounts = vec![
			AccountMeta::new(payer, true),
			AccountMeta::new_readonly(template, false),
			AccountMeta::new_readonly(mint, false),
			AccountMeta::new(bundles[0], false),
		];
		assert!(
			program
				.send(
					&[LootboxInstruction::ReclaimSolPrize as u8, 0],
					reclaim_accounts,
				)
				.is_err(),
			"zero box supply does not erase pending opening liabilities"
		);
		program.advance_one_slot().expect("oracle delay");
		for (index, (opening, randomness)) in openings.iter().enumerate().rev() {
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
				u8::try_from(index + 1).expect("value"),
			)
			.expect("persist proof independently of allocation order");
		}
		assert!(
			program
				.send(
					&[LootboxInstruction::CloseTemplateOpening as u8],
					close_accounts(
						&recipient.pubkey(),
						&template,
						&openings[0].0,
						&openings[0].1,
						&cpi
					),
				)
				.is_err(),
			"unpaid receipts cannot be closed"
		);
		assert!(
			allocate_any(&program, template, openings[1].0, &bundles).is_err(),
			"later known result cannot jump the queue"
		);
		let mut counts = [0; 3];
		let mut expected_sol = 0;
		let balance_before = program.balance(&recipient.pubkey()).expect("before prizes");
		for (opening, _) in &openings {
			let index =
				allocate_any(&program, template, *opening, &bundles).expect("FIFO allocation");
			let result_receipt = Pubkey::find_program_address(
				&[b"result-receipt", opening.as_ref()],
				&program.program_id,
			)
			.0;
			assert_eq!(
				program
					.account(&result_receipt)
					.expect("immutable result receipt")
					.owner,
				program.program_id,
			);
			counts[index] += 1;
			let assets = match index {
				0 => vec![None],
				1 => vec![Some(reward_mint)],
				_ => vec![None, Some(nft_a), Some(nft_b)],
			};
			for (asset_index, reward) in assets.iter().enumerate() {
				let asset_index = u8::try_from(asset_index).expect("index");
				if let Some(reward) = reward {
					let destination = ata_of(&recipient.pubkey(), reward);
					let claim_accounts = vec![
						AccountMeta::new_readonly(template, false),
						AccountMeta::new(*opening, false),
						AccountMeta::new(bundles[index], false),
						AccountMeta::new_readonly(recipient.pubkey(), false),
						AccountMeta::new_readonly(*reward, false),
						AccountMeta::new(ata_of(&bundles[index], reward), false),
						AccountMeta::new(destination, false),
						AccountMeta::new_readonly(token_program_id(), false),
					];
					let mut data = vec![0; ClaimTokenPrizeInstruction::SIZE];
					ClaimTokenPrizeInstruction::initialize(&mut data)
						.expect("claim")
						.asset_index = asset_index;
					if program.account(&destination).is_err() {
						assert!(
							program.send(&data, claim_accounts.clone()).is_err(),
							"failed transfer preserves allocated prize"
						);
						provision_ata(&program, &payer, &recipient.pubkey(), reward)
							.expect("create missing destination");
					}
					program
						.send(&data, claim_accounts.clone())
						.expect("retry pays same asset");
					program.advance_one_slot().expect("new blockhash");
					assert!(
						program.send(&data, claim_accounts).is_err(),
						"no duplicate token claim"
					);
				} else {
					let mut data = vec![0; ClaimSolPrizeInstruction::SIZE];
					ClaimSolPrizeInstruction::initialize(&mut data)
						.expect("claim")
						.asset_index = asset_index;
					let mut accounts = vec![
						AccountMeta::new_readonly(template, false),
						AccountMeta::new(*opening, false),
						AccountMeta::new(bundles[index], false),
						AccountMeta::new(payer, false),
					];
					assert!(
						program.send(&data, accounts.clone()).is_err(),
						"relayer cannot redirect a prize"
					);
					accounts[3] = AccountMeta::new(recipient.pubkey(), false);
					program
						.send(&data, accounts.clone())
						.expect("recipient gets SOL");
					program.advance_one_slot().expect("new blockhash");
					assert!(
						program.send(&data, accounts).is_err(),
						"no duplicate SOL claim"
					);
					expected_sol += if index == 0 { 100_000 } else { 1_000_000 };
				}
			}
		}
		assert_eq!(
			counts,
			[3, 2, 1],
			"every finite prize is allocated exactly once"
		);
		assert_eq!(
			program.balance(&recipient.pubkey()).expect("after prizes") - balance_before,
			expected_sol
		);
		assert_eq!(
			token_amount(
				&program
					.account(&ata_of(&recipient.pubkey(), &reward_mint))
					.expect("reward tokens")
			),
			200
		);
		for nft in [nft_a, nft_b] {
			assert_eq!(
				token_amount(
					&program
						.account(&ata_of(&recipient.pubkey(), &nft))
						.expect("NFT")
				),
				1
			);
		}
		for (opening, randomness) in &openings {
			let result_receipt = Pubkey::find_program_address(
				&[b"result-receipt", opening.as_ref()],
				&program.program_id,
			)
			.0;
			assert!(
				program
					.send(
						&[LootboxInstruction::CloseTemplateOpening as u8],
						close_accounts(&payer, &template, opening, randomness, &cpi),
					)
					.is_err(),
				"receipt rent cannot be redirected"
			);
			program
				.send(
					&[LootboxInstruction::CloseTemplateOpening as u8],
					close_accounts(&recipient.pubkey(), &template, opening, randomness, &cpi),
				)
				.expect("close completed receipt and oracle account");
			assert!(program.account(opening).is_err());
			assert!(program.account(randomness).is_err());
			assert!(
				program.account(&result_receipt).is_ok(),
				"result receipts outlive closeable opening accounts",
			);
		}
		program
			.send(
				&[LootboxInstruction::CloseServiceVault as u8],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(service_vault, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("creator closes the exhausted service vault");
		assert!(program.account(&service_vault).is_err());
		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn missed_market_lock_retires_without_stranding_holder_claims() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let (queue, oracle, cpi) = oracle_fixture(&mut program);
		let payer = program.payer();
		let (template, bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata(&program, &template);
		let owner_ata = box_ata(&program, &payer, &mint);
		let opens_at = chain_timestamp(&program) + 60;
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
		let bundle = add_bundle(&program, template, 0, 2, 1);
		fund_sol(&program, template, bundle, 100_000).expect("fund prizes");
		activate_bundle(&program, template, bundle);
		let admin_accounts = vec![
			AccountMeta::new_readonly(payer, true),
			AccountMeta::new(template, false),
		];
		program
			.send(
				&[LootboxInstruction::SealTemplate as u8],
				admin_accounts.clone(),
			)
			.expect("seal");
		program
			.send(
				&template_mint_data(1),
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new(mint, false),
					AccountMeta::new(owner_ata, false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("issue short recovery supply");
		assert!(
			program
				.send(
					&[LootboxInstruction::RetireTemplate as u8],
					admin_accounts.clone(),
				)
				.is_err(),
			"issued treasury must use exact lock before reveal",
		);
		program
			.surfnet
			.cheatcodes()
			.time_travel_to_timestamp(u64::try_from(opens_at + 1).expect("timestamp") * 1000)
			.expect("miss reveal deadline");
		program
			.send(&[LootboxInstruction::RetireTemplate as u8], admin_accounts)
			.expect("bounded recovery retirement");
		assert_eq!(
			&program.account(&mint).expect("mint").data[..4],
			&[1, 0, 0, 0],
			"recovery is not represented as a market lock",
		);

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
					&template_request_data(opening_bump, payer),
					template_request_accounts(&TemplateRequestContext {
						owner: payer,
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
				&[&randomness],
			)
			.expect("retired recovery box can still open");
		assert_eq!(
			token_amount(&program.account(&owner_ata).expect("burned box")),
			0,
		);
		let crank = Keypair::new();
		program
			.fund(&crank.pubkey(), 10_000_000)
			.expect("crank fees");
		program.advance_one_slot().expect("oracle delay");
		fulfill(
			&FulfillContext {
				program: &program,
				payer: &crank,
				template,
				opening,
				randomness: randomness.pubkey(),
				queue,
				oracle,
				cpi: &cpi,
			},
			9,
		)
		.expect("permissionless fulfillment without a service bounty");
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
		let (result_receipt, result_receipt_bump) = Pubkey::find_program_address(
			&[b"result-receipt", opening.as_ref()],
			&program.program_id,
		);
		let mut allocate = vec![0; AllocateTemplateOpenInstruction::SIZE];
		AllocateTemplateOpenInstruction::initialize(&mut allocate)
			.expect("allocation data")
			.result_receipt_bump = result_receipt_bump;
		program
			.send(
				&allocate,
				vec![
					AccountMeta::new(template, false),
					AccountMeta::new(opening, false),
					AccountMeta::new_readonly(bundle, false),
					AccountMeta::new(service_vault, false),
					AccountMeta::new(result_receipt, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("allocate with receipts disabled");
		assert!(
			program.account(&service_vault).is_err(),
			"disabled services reserve no vault balance",
		);
		assert!(
			program.account(&result_receipt).is_err(),
			"disabled receipts create no account and charge no receipt rent",
		);
		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn expired_fifo_head_can_be_forfeited_by_an_unrelated_signer() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let (queue, oracle, cpi) = oracle_fixture(&mut program);
		let payer = program.payer();
		let recipient = Keypair::new();
		program
			.fund(&recipient.pubkey(), 100_000_000)
			.expect("recipient fee funds");
		let (template, bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata(&program, &template);
		let recipient_ata = box_ata(&program, &recipient.pubkey(), &mint);
		let opens_at = chain_timestamp(&program) + 60;
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
		let bundle = add_bundle(&program, template, 0, 2, 1);
		fund_sol(&program, template, bundle, 100_000).expect("fund prizes");
		activate_bundle(&program, template, bundle);
		let admin_accounts = vec![
			AccountMeta::new_readonly(payer, true),
			AccountMeta::new(template, false),
		];
		program
			.send(
				&[LootboxInstruction::SealTemplate as u8],
				admin_accounts.clone(),
			)
			.expect("seal");
		program
			.send(
				&template_mint_data(2),
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new(mint, false),
					AccountMeta::new(recipient_ata, false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("issue recipient boxes");
		lock_treasury(&program, template, mint, 1);
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
		assert!(
			program.account(&service_vault).is_ok(),
			"enabled settlement services create their isolated vault",
		);
		program
			.surfnet
			.cheatcodes()
			.time_travel_to_timestamp(u64::try_from(opens_at + 1).expect("timestamp") * 1000)
			.expect("reveal date");
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
						mint,
						ata: recipient_ata,
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
		program
			.advance_slots(RANDOMNESS_TIMEOUT_SLOTS + 1)
			.expect("expire opening");
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
		let forfeit_accounts = vec![
			AccountMeta::new(payer, true),
			AccountMeta::new(template, false),
			AccountMeta::new(service_vault, false),
			AccountMeta::new(opening, false),
			AccountMeta::new_readonly(randomness.pubkey(), false),
			AccountMeta::new_readonly(Pubkey::default(), false),
		];
		program
			.send(
				&[LootboxInstruction::ForfeitTemplateOpen as u8],
				forfeit_accounts.clone(),
			)
			.expect("unrelated signer unblocks expired FIFO head");
		program.advance_one_slot().expect("new blockhash");
		assert!(
			program
				.send(
					&[LootboxInstruction::ForfeitTemplateOpen as u8],
					forfeit_accounts,
				)
				.is_err(),
			"forfeiture is final",
		);
		assert!(
			program
				.send(
					&[LootboxInstruction::CloseTemplateOpening as u8],
					close_accounts(&payer, &template, &opening, &randomness.pubkey(), &cpi),
				)
				.is_err(),
			"caller cannot redirect receipt rent",
		);
		program
			.send(
				&[LootboxInstruction::CloseTemplateOpening as u8],
				close_accounts(
					&recipient.pubkey(),
					&template,
					&opening,
					&randomness.pubkey(),
					&cpi,
				),
			)
			.expect("bound recipient closes forfeited receipt");
		program
			.send(&[LootboxInstruction::RetireTemplate as u8], admin_accounts)
			.expect("retire");
		program
			.send_instructions_with_signers(
				&[token_ix::burn_checked(
					&token_2022(),
					&recipient_ata,
					&mint,
					&recipient.pubkey(),
					&[],
					1,
					0,
				)
				.expect("burn remaining box")],
				&[&recipient],
			)
			.expect("remove outstanding supply");
		let before = program.balance(&bundle).expect("funded escrow");
		program
			.send(
				&[LootboxInstruction::ReclaimSolPrize as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(bundle, false),
				],
			)
			.expect("reclaim both unallocated prizes");
		assert_eq!(
			before - program.balance(&bundle).expect("rent retained"),
			200_000,
			"forfeiture consumes no prize inventory",
		);
		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn retirement_recovers_inventory_only_after_all_claims_are_gone() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let payer = program.payer();
		let (template, bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata(&program, &template);
		let owner_ata = box_ata(&program, &payer, &mint);
		let opens_at = chain_timestamp(&program) + 60;
		program
			.send(
				&create_template_data(Pubkey::new_unique(), bump, opens_at, false),
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("template");
		let cancelled = add_bundle(&program, template, 0, 2, 1);
		fund_sol(&program, template, cancelled, 50_000).expect("fund staged bundle");
		program
			.send(
				&[LootboxInstruction::ReclaimSolPrize as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(cancelled, false),
				],
			)
			.expect("reclaim staged collateral");
		assert!(
			program
				.send(
					&[LootboxInstruction::ActivateBundle as u8],
					vec![
						AccountMeta::new_readonly(payer, true),
						AccountMeta::new(template, false),
						AccountMeta::new(cancelled, false),
					],
				)
				.is_err(),
			"reclaimed collateral cannot be activated",
		);
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(cancelled, false),
				],
			)
			.expect("cancel staged bundle");
		assert!(program.account(&cancelled).is_err());
		let bundle = add_bundle(&program, template, 0, 8, 1);
		fund_sol(&program, template, bundle, 100_000).expect("fund eight prizes");
		activate_bundle(&program, template, bundle);
		let admin_accounts = vec![
			AccountMeta::new_readonly(payer, true),
			AccountMeta::new(template, false),
		];
		program
			.send(
				&[LootboxInstruction::SealTemplate as u8],
				admin_accounts.clone(),
			)
			.expect("seal");
		let mint_accounts = vec![
			AccountMeta::new_readonly(payer, true),
			AccountMeta::new(template, false),
			AccountMeta::new(mint, false),
			AccountMeta::new(owner_ata, false),
			AccountMeta::new_readonly(token_2022(), false),
		];
		program
			.send(&template_mint_data(8), mint_accounts.clone())
			.expect("issue one box for every prize-bundle copy");
		lock_treasury(&program, template, mint, 1);
		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
		assert!(
			program.account(&service_vault).is_err(),
			"disabled services create no vault and reserve no rent",
		);
		let reclaim_accounts = vec![
			AccountMeta::new(payer, true),
			AccountMeta::new_readonly(template, false),
			AccountMeta::new_readonly(mint, false),
			AccountMeta::new(bundle, false),
		];
		let reclaim = [LootboxInstruction::ReclaimSolPrize as u8, 0];
		assert!(
			program.send(&reclaim, reclaim_accounts.clone()).is_err(),
			"active template"
		);
		program
			.send(&[LootboxInstruction::RetireTemplate as u8], admin_accounts)
			.expect("retire");
		assert!(
			program.send(&template_mint_data(1), mint_accounts).is_err(),
			"retired minter"
		);
		assert!(
			program.send(&reclaim, reclaim_accounts.clone()).is_err(),
			"unopened liabilities"
		);
		// A holder may deliberately destroy their standard tokens without an
		// opening request. This forfeits that claim; retirement cannot force it.
		program
			.send_instruction(
				token_ix::burn_checked(&token_2022(), &owner_ata, &mint, &payer, &[], 8, 0)
					.expect("burn instruction"),
			)
			.expect("holder abandons both claims");
		let before = program.balance(&bundle).expect("funded escrow");
		program
			.send(&reclaim, reclaim_accounts.clone())
			.expect("reclaim unused inventory");
		assert_eq!(
			before - program.balance(&bundle).expect("rent retained"),
			800_000
		);
		program.advance_one_slot().expect("new blockhash");
		assert!(
			program.send(&reclaim, reclaim_accounts).is_err(),
			"no duplicate reclamation"
		);
		program.stop().expect("stop Surfpool");
	});
}
