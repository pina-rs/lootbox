#![cfg(test)]

//! Full offline Surfpool journey against real SBF artifacts.
//!
//! The test deploys the lootbox program and a separate, test-only program at
//! Switchboard's devnet address. The oracle fixture owns the canonical
//! 408-byte randomness account and performs commit/reveal transitions; the
//! lootbox program has no mock branches or privileged testing instructions.

use std::path::Path;
use std::path::PathBuf;

use pina_test::Account;
use pina_test::AccountMeta;
use pina_test::Instruction;
use pina_test::Keypair;
use pina_test::Pubkey;
use pina_test::Signer;
use program_under_test::AddOutcomeInstruction;
use program_under_test::CreateLootboxInstruction;
use program_under_test::DepositInstruction;
use program_under_test::ID;
use program_under_test::LootboxInstruction;
use program_under_test::MintBoxesInstruction;
use program_under_test::RANDOMNESS_TIMEOUT_SLOTS;
use program_under_test::RequestOpenInstruction;
use program_under_test::SWITCHBOARD_DEVNET_ID;
use program_under_test::WithdrawSurplusInstruction;
use solana_message::Message;
use solana_transaction::Transaction;
use surfpool_sdk::Surfnet;
use surfpool_sdk::cheatcodes::builders::DeployProgram;

const ATA_PROGRAM: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const CLOCK_SYSVAR: &str = "SysvarC1ock11111111111111111111111111111111";
const TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const RANDOMNESS_SPACE: u64 = 408;
const MINT_SPACE: u64 = 82;
const FUND: u64 = 50_000_000;
const BOXES: u64 = 2;
const MAX_REWARD: u64 = 500_000;
const OUTCOMES: [(u64, u64); 3] = [(60, 50_000), (30, 150_000), (10, MAX_REWARD)];

struct Harness {
	program_id: Pubkey,
	surfnet: Surfnet,
}

impl Harness {
	async fn start(program_id: Pubkey) -> Result<Self, String> {
		let artifact = std::env::var_os("PINA_SBF_ARTIFACT")
			.map(PathBuf::from)
			.ok_or_else(|| "PINA_SBF_ARTIFACT is not set; run with pina test".to_owned())?;
		let surfnet = Surfnet::builder()
			.offline(true)
			.start()
			.await
			.map_err(|error| format!("start offline Surfpool: {error}"))?;
		let harness = Self {
			program_id,
			surfnet,
		};
		harness.deploy_program(program_id, &artifact)?;

		Ok(harness)
	}

	fn deploy_program(&self, program_id: Pubkey, artifact: &Path) -> Result<(), String> {
		self.surfnet
			.cheatcodes()
			.deploy(DeployProgram::new(program_id).so_path(artifact))
			.map(|_| ())
			.map_err(|error| format!("deploy program: {error}"))
	}

	fn payer(&self) -> Pubkey {
		self.surfnet.payer().pubkey()
	}

	fn instruction(&self, data: &[u8], accounts: Vec<AccountMeta>) -> Instruction {
		Instruction::new_with_bytes(self.program_id, data, accounts)
	}

	fn send(&self, data: &[u8], accounts: Vec<AccountMeta>) -> Result<(), String> {
		self.send_instruction(self.instruction(data, accounts))
	}

	fn send_instruction(&self, instruction: Instruction) -> Result<(), String> {
		self.send_with_signers(instruction, &[])
	}

	fn send_with_signers(
		&self,
		instruction: Instruction,
		signers: &[&dyn Signer],
	) -> Result<(), String> {
		self.send_instructions_with_signers(&[instruction], signers)
	}

	fn send_instructions_with_signers(
		&self,
		instructions: &[Instruction],
		signers: &[&dyn Signer],
	) -> Result<(), String> {
		let rpc = self.surfnet.rpc_client();
		let payer = self.surfnet.payer();
		let mut transaction_signers: Vec<&dyn Signer> = Vec::with_capacity(signers.len() + 1);
		transaction_signers.push(payer);
		transaction_signers.extend_from_slice(signers);
		let blockhash = rpc
			.get_latest_blockhash()
			.map_err(|error| format!("fetch blockhash: {error}"))?;
		let message = Message::new(instructions, Some(&payer.pubkey()));
		let mut transaction = Transaction::new_unsigned(message);
		transaction
			.try_sign(&transaction_signers, blockhash)
			.map_err(|error| format!("sign transaction: {error}"))?;
		rpc.send_and_confirm_transaction(&transaction)
			.map(|_| ())
			.map_err(|error| format!("execute transaction: {error}"))
	}

	fn fund(&self, address: &Pubkey, lamports: u64) -> Result<(), String> {
		let mut data = 2u32.to_le_bytes().to_vec();
		data.extend_from_slice(&lamports.to_le_bytes());
		self.send_instruction(Instruction::new_with_bytes(
			Pubkey::default(),
			&data,
			vec![
				AccountMeta::new(self.payer(), true),
				AccountMeta::new(*address, false),
			],
		))
	}

	fn account(&self, address: &Pubkey) -> Result<Account, String> {
		self.surfnet
			.rpc_client()
			.get_account(address)
			.map_err(|error| format!("fetch account: {error}"))
	}

	fn balance(&self, address: &Pubkey) -> Result<u64, String> {
		self.surfnet
			.rpc_client()
			.get_balance(address)
			.map_err(|error| format!("fetch balance: {error}"))
	}

	fn advance_one_slot(&self) -> Result<(), String> {
		self.advance_slots(2)
	}

	fn advance_slots(&self, slots: u64) -> Result<(), String> {
		let current = self
			.surfnet
			.rpc_client()
			.get_epoch_info()
			.map_err(|error| format!("fetch epoch info: {error}"))?
			.absolute_slot;
		self.surfnet
			.cheatcodes()
			.time_travel_to_slot(current.saturating_add(slots))
			.map(|_| ())
			.map_err(|error| format!("advance Surfpool slot: {error}"))
	}

	fn stop(&mut self) -> Result<(), String> {
		self.surfnet
			.stop()
			.map_err(|error| format!("stop Surfpool: {error}"))
	}
}

fn token_program_id() -> Pubkey {
	Pubkey::from_str_const(TOKEN_PROGRAM)
}

fn ata_program_id() -> Pubkey {
	Pubkey::from_str_const(ATA_PROGRAM)
}

fn clock_sysvar_id() -> Pubkey {
	Pubkey::from_str_const(CLOCK_SYSVAR)
}

fn oracle_program_id() -> Pubkey {
	Pubkey::new_from_array(SWITCHBOARD_DEVNET_ID.to_bytes())
}

fn ata_of(wallet: &Pubkey, mint: &Pubkey) -> Pubkey {
	Pubkey::find_program_address(
		&[wallet.as_ref(), token_program_id().as_ref(), mint.as_ref()],
		&ata_program_id(),
	)
	.0
}

fn lootbox_pda(program_id: &Pubkey, authority: &Pubkey, id: u64) -> (Pubkey, u8) {
	Pubkey::find_program_address(
		&[b"lootbox", authority.as_ref(), &id.to_le_bytes()],
		program_id,
	)
}

fn vault_pda(program_id: &Pubkey, lootbox: &Pubkey) -> (Pubkey, u8) {
	Pubkey::find_program_address(&[b"vault", lootbox.as_ref()], program_id)
}

fn opening_pda(program_id: &Pubkey, lootbox: &Pubkey, randomness: &Pubkey) -> (Pubkey, u8) {
	Pubkey::find_program_address(
		&[b"opening", lootbox.as_ref(), randomness.as_ref()],
		program_id,
	)
}

fn rent_minimum(space: u64) -> u64 {
	solana_rent::Rent::default().minimum_balance(usize::try_from(space).expect("space"))
}

fn create_account_instruction(
	payer: &Pubkey,
	new_account: &Pubkey,
	lamports: u64,
	space: u64,
	owner: &Pubkey,
) -> Instruction {
	let mut data = vec![0u8, 0, 0, 0];
	data.extend_from_slice(&lamports.to_le_bytes());
	data.extend_from_slice(&space.to_le_bytes());
	data.extend_from_slice(owner.as_ref());

	Instruction::new_with_bytes(
		Pubkey::default(),
		&data,
		vec![
			AccountMeta::new(*payer, true),
			AccountMeta::new(*new_account, true),
		],
	)
}

fn provision_mint(
	program: &Harness,
	payer: &Pubkey,
	mint_authority: &Pubkey,
) -> Result<Pubkey, String> {
	let mint = Keypair::new();
	let create = create_account_instruction(
		payer,
		&mint.pubkey(),
		rent_minimum(MINT_SPACE),
		MINT_SPACE,
		&token_program_id(),
	);
	program.send_with_signers(create, &[&mint])?;

	let mut data = vec![20u8, 0u8];
	data.extend_from_slice(mint_authority.as_ref());
	data.extend_from_slice(&0u32.to_le_bytes());
	let initialize = Instruction::new_with_bytes(
		token_program_id(),
		&data,
		vec![AccountMeta::new(mint.pubkey(), false)],
	);
	program.send_instruction(initialize)?;

	Ok(mint.pubkey())
}

fn provision_ata(
	program: &Harness,
	payer: &Pubkey,
	wallet: &Pubkey,
	mint: &Pubkey,
) -> Result<Pubkey, String> {
	let ata = ata_of(wallet, mint);
	let create = Instruction::new_with_bytes(
		ata_program_id(),
		&[1u8],
		vec![
			AccountMeta::new(*payer, true),
			AccountMeta::new(ata, false),
			AccountMeta::new_readonly(*wallet, false),
			AccountMeta::new_readonly(*mint, false),
			AccountMeta::new_readonly(Pubkey::default(), false),
			AccountMeta::new_readonly(token_program_id(), false),
		],
	);
	program.send_instruction(create)?;

	Ok(ata)
}

fn create_lootbox_data(
	id: u64,
	max_supply: u64,
	queue: &Pubkey,
	bump: u8,
	vault_bump: u8,
) -> Vec<u8> {
	let mut data = vec![0u8; CreateLootboxInstruction::SIZE];
	let args = CreateLootboxInstruction::initialize(&mut data).expect("create data");
	args.id.set(id);
	args.max_supply.set(max_supply);
	args.oracle_program = SWITCHBOARD_DEVNET_ID;
	args.oracle_queue = queue.to_bytes().into();
	args.bump = bump;
	args.vault_bump = vault_bump;
	data
}

fn add_outcome_data(weight: u64, reward_lamports: u64) -> Vec<u8> {
	let mut data = vec![0u8; AddOutcomeInstruction::SIZE];
	let args = AddOutcomeInstruction::initialize(&mut data).expect("outcome data");
	args.weight.set(weight);
	args.reward_lamports.set(reward_lamports);
	data
}

fn deposit_data(lamports: u64) -> Vec<u8> {
	let mut data = vec![0u8; DepositInstruction::SIZE];
	DepositInstruction::initialize(&mut data)
		.expect("deposit data")
		.lamports
		.set(lamports);
	data
}

fn mint_data(amount: u64) -> Vec<u8> {
	let mut data = vec![0u8; MintBoxesInstruction::SIZE];
	MintBoxesInstruction::initialize(&mut data)
		.expect("mint data")
		.amount
		.set(amount);
	data
}

fn request_data(bump: u8) -> Vec<u8> {
	let mut data = vec![0u8; RequestOpenInstruction::SIZE];
	RequestOpenInstruction::initialize(&mut data)
		.expect("request data")
		.bump = bump;
	data
}

fn withdraw_data(lamports: u64) -> Vec<u8> {
	let mut data = vec![0u8; WithdrawSurplusInstruction::SIZE];
	WithdrawSurplusInstruction::initialize(&mut data)
		.expect("withdraw data")
		.lamports
		.set(lamports);
	data
}

fn token_amount(account: &Account) -> u64 {
	u64::from_le_bytes(account.data[64..72].try_into().expect("token amount"))
}

fn stored_u64(data: &[u8], offset: usize) -> u64 {
	u64::from_le_bytes(data[offset..offset + 8].try_into().expect("stored u64"))
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn commit_burn_reveal_and_payout_round_trip() {
	pina_test::run(async {
		let program_id = Pubkey::new_from_array(ID.to_bytes());
		let mut program = Harness::start(program_id)
			.await
			.expect("start isolated Surfpool test");
		let mock_artifact = std::env::var("MOCK_SWITCHBOARD_SBF_ARTIFACT")
			.expect("MOCK_SWITCHBOARD_SBF_ARTIFACT is set by test:surfpool");
		program
			.deploy_program(oracle_program_id(), Path::new(&mock_artifact))
			.expect("deploy test-only Switchboard emulator");

		let authority = program.payer();
		let recipient = Keypair::new();
		program
			.fund(&recipient.pubkey(), FUND)
			.expect("fund box recipient");

		let id = 7u64;
		let queue = Pubkey::new_from_array([7u8; 32]);
		let (lootbox, bump) = lootbox_pda(&program_id, &authority, id);
		let (vault, vault_bump) = vault_pda(&program_id, &lootbox);
		let mint = provision_mint(&program, &authority, &lootbox).expect("provision box mint");
		let recipient_ata = provision_ata(&program, &authority, &recipient.pubkey(), &mint)
			.expect("provision recipient box account");

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

		for (weight, reward) in OUTCOMES {
			program
				.send(
					&add_outcome_data(weight, reward),
					vec![
						AccountMeta::new_readonly(authority, true),
						AccountMeta::new(lootbox, false),
					],
				)
				.expect("add weighted outcome");
		}

		program
			.send(
				&deposit_data(BOXES * MAX_REWARD),
				vec![
					AccountMeta::new(authority, true),
					AccountMeta::new_readonly(lootbox, false),
					AccountMeta::new(vault, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("fully collateralize lootbox");
		program
			.send(
				&[LootboxInstruction::Seal as u8],
				vec![
					AccountMeta::new_readonly(authority, true),
					AccountMeta::new(lootbox, false),
				],
			)
			.expect("seal immutable reward table");
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
		assert_eq!(
			token_amount(&program.account(&recipient_ata).expect("recipient ATA")),
			BOXES
		);
		assert!(
			program
				.send(
					&mint_data(1),
					vec![
						AccountMeta::new_readonly(authority, true),
						AccountMeta::new(lootbox, false),
						AccountMeta::new_readonly(vault, false),
						AccountMeta::new(mint, false),
						AccountMeta::new(recipient_ata, false),
						AccountMeta::new_readonly(token_program_id(), false),
					],
				)
				.is_err(),
			"max supply rejects over-minting"
		);
		assert!(
			program
				.send(
					&withdraw_data(1),
					vec![
						AccountMeta::new(authority, true),
						AccountMeta::new_readonly(lootbox, false),
						AccountMeta::new(vault, false),
						AccountMeta::new_readonly(mint, false),
					],
				)
				.is_err(),
			"fully reserved collateral cannot be withdrawn"
		);

		let stale_randomness = Keypair::new();
		program
			.send_with_signers(
				create_account_instruction(
					&authority,
					&stale_randomness.pubkey(),
					rent_minimum(RANDOMNESS_SPACE),
					RANDOMNESS_SPACE,
					&oracle_program_id(),
				),
				&[&stale_randomness],
			)
			.expect("create stale randomness candidate");
		let mut stale_commit_data = vec![0u8];
		stale_commit_data.extend_from_slice(queue.as_ref());
		program
			.send_with_signers(
				Instruction::new_with_bytes(
					oracle_program_id(),
					&stale_commit_data,
					vec![
						AccountMeta::new_readonly(recipient.pubkey(), true),
						AccountMeta::new(stale_randomness.pubkey(), false),
						AccountMeta::new_readonly(clock_sysvar_id(), false),
					],
				),
				&[&recipient],
			)
			.expect("commit stale randomness candidate");
		program.advance_one_slot().expect("age stale commitment");
		let (stale_opening, stale_bump) =
			opening_pda(&program_id, &lootbox, &stale_randomness.pubkey());
		assert!(
			program
				.send_with_signers(
					program.instruction(
						&request_data(stale_bump),
						vec![
							AccountMeta::new(recipient.pubkey(), true),
							AccountMeta::new(lootbox, false),
							AccountMeta::new_readonly(vault, false),
							AccountMeta::new(mint, false),
							AccountMeta::new(recipient_ata, false),
							AccountMeta::new(stale_opening, false),
							AccountMeta::new_readonly(stale_randomness.pubkey(), false),
							AccountMeta::new_readonly(clock_sysvar_id(), false),
							AccountMeta::new_readonly(Pubkey::default(), false),
							AccountMeta::new_readonly(token_program_id(), false),
						],
					),
					&[&recipient],
				)
				.is_err(),
			"a prior-slot commitment cannot become a selective-opening option"
		);
		assert_eq!(
			token_amount(&program.account(&recipient_ata).expect("recipient ATA")),
			BOXES,
			"rejected stale request does not burn a box"
		);

		let randomness = Keypair::new();
		program
			.send_with_signers(
				create_account_instruction(
					&authority,
					&randomness.pubkey(),
					rent_minimum(RANDOMNESS_SPACE),
					RANDOMNESS_SPACE,
					&oracle_program_id(),
				),
				&[&randomness],
			)
			.expect("create oracle-owned randomness account");
		let (opening, opening_bump) = opening_pda(&program_id, &lootbox, &randomness.pubkey());
		let mut commit_data = vec![0u8];
		commit_data.extend_from_slice(queue.as_ref());
		program
			.send_instructions_with_signers(
				&[
					Instruction::new_with_bytes(
						oracle_program_id(),
						&commit_data,
						vec![
							AccountMeta::new_readonly(recipient.pubkey(), true),
							AccountMeta::new(randomness.pubkey(), false),
							AccountMeta::new_readonly(clock_sysvar_id(), false),
						],
					),
					program.instruction(
						&request_data(opening_bump),
						vec![
							AccountMeta::new(recipient.pubkey(), true),
							AccountMeta::new(lootbox, false),
							AccountMeta::new_readonly(vault, false),
							AccountMeta::new(mint, false),
							AccountMeta::new(recipient_ata, false),
							AccountMeta::new(opening, false),
							AccountMeta::new_readonly(randomness.pubkey(), false),
							AccountMeta::new_readonly(clock_sysvar_id(), false),
							AccountMeta::new_readonly(Pubkey::default(), false),
							AccountMeta::new_readonly(token_program_id(), false),
						],
					),
				],
				&[&recipient],
			)
			.expect("atomically commit randomness and burn one box");
		let committed = program
			.account(&randomness.pubkey())
			.expect("committed randomness account");
		let clock = program
			.account(&clock_sysvar_id())
			.expect("clock sysvar after commitment");
		let seed_slot = stored_u64(&committed.data, 104);
		let current_slot = stored_u64(&clock.data, 0);
		assert_eq!(
			committed.owner,
			oracle_program_id(),
			"oracle owns commitment"
		);
		assert_eq!(
			committed.data.len(),
			408,
			"canonical randomness account size"
		);
		assert_eq!(&committed.data[8..40], recipient.pubkey().as_ref());
		assert_eq!(&committed.data[40..72], queue.as_ref());
		assert_eq!(
			stored_u64(&committed.data, 144),
			0,
			"commitment is unrevealed"
		);
		assert!(
			seed_slot <= current_slot,
			"committed slot is not in the future"
		);
		assert_eq!(
			stored_u64(
				&program.account(&opening).expect("opening receipt").data,
				97
			),
			seed_slot,
			"atomic request binds the committed slot"
		);
		assert_eq!(
			token_amount(&program.account(&recipient_ata).expect("recipient ATA")),
			BOXES - 1
		);
		let pending_state = program.account(&lootbox).expect("lootbox state");
		assert_eq!(
			stored_u64(&pending_state.data, 153),
			1,
			"one pending opening"
		);
		assert!(
			program
				.send(
					&[LootboxInstruction::SettleOpen as u8],
					vec![
						AccountMeta::new(recipient.pubkey(), false),
						AccountMeta::new(lootbox, false),
						AccountMeta::new(vault, false),
						AccountMeta::new_readonly(mint, false),
						AccountMeta::new(opening, false),
						AccountMeta::new_readonly(randomness.pubkey(), false),
					],
				)
				.is_err(),
			"unrevealed randomness cannot settle"
		);
		assert!(
			program
				.send(
					&[LootboxInstruction::RefundOpen as u8],
					vec![
						AccountMeta::new(recipient.pubkey(), false),
						AccountMeta::new(lootbox, false),
						AccountMeta::new_readonly(vault, false),
						AccountMeta::new(mint, false),
						AccountMeta::new(recipient_ata, false),
						AccountMeta::new(opening, false),
						AccountMeta::new_readonly(randomness.pubkey(), false),
						AccountMeta::new_readonly(clock_sysvar_id(), false),
						AccountMeta::new_readonly(token_program_id(), false),
					],
				)
				.is_err(),
			"a live commitment cannot be refunded early"
		);
		program
			.advance_one_slot()
			.expect("advance beyond the commitment slot");

		let revealed_value = [42u8; 32];
		let mut reveal_data = vec![1u8];
		reveal_data.extend_from_slice(&revealed_value);
		program
			.send_with_signers(
				Instruction::new_with_bytes(
					oracle_program_id(),
					&reveal_data,
					vec![
						AccountMeta::new_readonly(recipient.pubkey(), true),
						AccountMeta::new(randomness.pubkey(), false),
						AccountMeta::new_readonly(clock_sysvar_id(), false),
					],
				),
				&[&recipient],
			)
			.expect("reveal randomness after burn");

		let recipient_before = program
			.balance(&recipient.pubkey())
			.expect("recipient balance");
		let vault_before = program.balance(&vault).expect("vault balance");
		assert!(
			program
				.send(
					&[LootboxInstruction::SettleOpen as u8],
					vec![
						AccountMeta::new(authority, false),
						AccountMeta::new(lootbox, false),
						AccountMeta::new(vault, false),
						AccountMeta::new_readonly(mint, false),
						AccountMeta::new(opening, false),
						AccountMeta::new_readonly(randomness.pubkey(), false),
					],
				)
				.is_err(),
			"settlement cannot redirect the payout"
		);
		program
			.send(
				&[LootboxInstruction::SettleOpen as u8],
				vec![
					AccountMeta::new(recipient.pubkey(), false),
					AccountMeta::new(lootbox, false),
					AccountMeta::new(vault, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new(opening, false),
					AccountMeta::new_readonly(randomness.pubkey(), false),
				],
			)
			.expect("settle revealed opening permissionlessly");

		let opening_account = program.account(&opening).expect("opening receipt");
		let reward = stored_u64(&opening_account.data, 105);
		let selected = usize::from(opening_account.data[113]);
		assert_eq!(opening_account.data[114], 1, "opening is settled");
		assert_eq!(
			reward, OUTCOMES[selected].1,
			"receipt contains selected reward"
		);
		assert_eq!(
			program
				.balance(&recipient.pubkey())
				.expect("recipient payout")
				- recipient_before,
			reward,
			"recipient receives the exact selected reward"
		);
		assert_eq!(
			vault_before - program.balance(&vault).expect("vault after payout"),
			reward,
			"vault pays the exact selected reward"
		);
		let settled_state = program.account(&lootbox).expect("settled lootbox state");
		assert_eq!(
			stored_u64(&settled_state.data, 153),
			0,
			"pending decremented"
		);
		assert_eq!(
			stored_u64(&settled_state.data, 161),
			1,
			"opened incremented"
		);

		program
			.send(
				&[LootboxInstruction::CloseOpening as u8],
				vec![
					AccountMeta::new(recipient.pubkey(), false),
					AccountMeta::new(opening, false),
				],
			)
			.expect("close terminal receipt and recover rent");
		assert!(
			program.account(&opening).is_err(),
			"terminal receipt is closed"
		);

		let refund_randomness = Keypair::new();
		program
			.send_with_signers(
				create_account_instruction(
					&authority,
					&refund_randomness.pubkey(),
					rent_minimum(RANDOMNESS_SPACE),
					RANDOMNESS_SPACE,
					&oracle_program_id(),
				),
				&[&refund_randomness],
			)
			.expect("create refund-path randomness account");
		let (refund_opening, refund_bump) =
			opening_pda(&program_id, &lootbox, &refund_randomness.pubkey());
		let mut refund_commit_data = vec![0u8];
		refund_commit_data.extend_from_slice(queue.as_ref());
		program
			.send_instructions_with_signers(
				&[
					Instruction::new_with_bytes(
						oracle_program_id(),
						&refund_commit_data,
						vec![
							AccountMeta::new_readonly(recipient.pubkey(), true),
							AccountMeta::new(refund_randomness.pubkey(), false),
							AccountMeta::new_readonly(clock_sysvar_id(), false),
						],
					),
					program.instruction(
						&request_data(refund_bump),
						vec![
							AccountMeta::new(recipient.pubkey(), true),
							AccountMeta::new(lootbox, false),
							AccountMeta::new_readonly(vault, false),
							AccountMeta::new(mint, false),
							AccountMeta::new(recipient_ata, false),
							AccountMeta::new(refund_opening, false),
							AccountMeta::new_readonly(refund_randomness.pubkey(), false),
							AccountMeta::new_readonly(clock_sysvar_id(), false),
							AccountMeta::new_readonly(Pubkey::default(), false),
							AccountMeta::new_readonly(token_program_id(), false),
						],
					),
				],
				&[&recipient],
			)
			.expect("request a second opening for the timeout path");
		assert_eq!(
			token_amount(&program.account(&recipient_ata).expect("recipient ATA")),
			0,
			"second opening burns the remaining box"
		);
		program
			.advance_slots(RANDOMNESS_TIMEOUT_SLOTS + 1)
			.expect("advance beyond randomness timeout");
		let vault_before_refund = program.balance(&vault).expect("vault before refund");
		program
			.send(
				&[LootboxInstruction::RefundOpen as u8],
				vec![
					AccountMeta::new(recipient.pubkey(), false),
					AccountMeta::new(lootbox, false),
					AccountMeta::new_readonly(vault, false),
					AccountMeta::new(mint, false),
					AccountMeta::new(recipient_ata, false),
					AccountMeta::new(refund_opening, false),
					AccountMeta::new_readonly(refund_randomness.pubkey(), false),
					AccountMeta::new_readonly(clock_sysvar_id(), false),
					AccountMeta::new_readonly(token_program_id(), false),
				],
			)
			.expect("refund timed-out opening permissionlessly");
		assert_eq!(
			token_amount(&program.account(&recipient_ata).expect("recipient ATA")),
			1,
			"timeout restores the burned box"
		);
		assert_eq!(
			program.balance(&vault).expect("vault after refund"),
			vault_before_refund,
			"refund preserves reward collateral"
		);
		let refunded_receipt = program
			.account(&refund_opening)
			.expect("refunded opening receipt");
		assert_eq!(refunded_receipt.data[114], 2, "opening is refunded");
		let refunded_state = program.account(&lootbox).expect("refunded lootbox state");
		assert_eq!(stored_u64(&refunded_state.data, 153), 0, "pending cleared");
		assert_eq!(stored_u64(&refunded_state.data, 169), 1, "refund counted");
		program
			.send(
				&[LootboxInstruction::CloseOpening as u8],
				vec![
					AccountMeta::new(recipient.pubkey(), false),
					AccountMeta::new(refund_opening, false),
				],
			)
			.expect("close refunded receipt");
		assert!(
			program.account(&refund_opening).is_err(),
			"refunded receipt is closed"
		);

		program.stop().expect("stop isolated Surfpool test");
	});
}
