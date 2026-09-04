#![cfg(test)]

//! Full offline Surfpool journey against real SBF artifacts.
//!
//! The test deploys the lootbox program and a separate, test-only program at
//! Switchboard's devnet address. The oracle fixture owns the canonical
//! 408-byte randomness account and performs PDA-authorized commit/reveal
//! transitions; the lootbox program has no mock branches or privileged testing
//! instructions.

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
use program_under_test::MAX_TOTAL_WEIGHT;
use program_under_test::MintBoxesInstruction;
use program_under_test::RANDOMNESS_TIMEOUT_SLOTS;
use program_under_test::RequestOpenInstruction;
use program_under_test::SWITCHBOARD_DEVNET_ID;
use program_under_test::SettleOpenInstruction;
use program_under_test::WithdrawSurplusInstruction;
use solana_commitment_config::CommitmentConfig;
use solana_message::Message;
use solana_transaction::Transaction;
use surfpool_sdk::Surfnet;
use surfpool_sdk::cheatcodes::builders::DeployProgram;

mod templates;

const ATA_PROGRAM: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const ADDRESS_LOOKUP_TABLE_PROGRAM: &str = "AddressLookupTab1e1111111111111111111111111";
const CLOCK_SYSVAR: &str = "SysvarC1ock11111111111111111111111111111111";
const SLOT_HASHES_SYSVAR: &str = "SysvarS1otHashes111111111111111111111111111";
const TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const WRAPPED_SOL_MINT: &str = "So11111111111111111111111111111111111111112";
const RANDOMNESS_COMMIT_DISCRIMINATOR: [u8; 8] = [52, 170, 152, 201, 179, 133, 242, 141];
const RANDOMNESS_REVEAL_DISCRIMINATOR: [u8; 8] = [197, 181, 187, 10, 30, 58, 20, 73];
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
			// Use Solana-like slot duration. The SDK's 1ms default crosses many
			// epochs in a one-hour jump; Surfpool 1.5's clock helper uses a
			// relative slot across epoch boundaries instead of an absolute slot.
			.slot_time_ms(400)
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
		// Surfpool 1.5 has a bounded 1,024-event observer channel. Leaving it
		// unread stalls longer journeys even though the RPC server is healthy.
		let _ = self.surfnet.events().try_iter().count();
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
		// A single-node offline network has no independent finality to wait
		// for. Still confirm execution and propagate transaction errors.
		rpc.send_and_confirm_transaction_with_spinner_and_commitment(
			&transaction,
			CommitmentConfig::processed(),
		)
		.map(|_| ())
		.map_err(|error| format!("execute transaction: {error}"))
	}

	fn fund(&self, address: &Pubkey, lamports: u64) -> Result<(), String> {
		self.fund_many(&[*address], lamports)
	}

	fn fund_many(&self, addresses: &[Pubkey], lamports: u64) -> Result<(), String> {
		let payer = self.payer();
		let instructions = addresses
			.iter()
			.map(|address| {
				let mut data = 2u32.to_le_bytes().to_vec();
				data.extend_from_slice(&lamports.to_le_bytes());

				Instruction::new_with_bytes(
					Pubkey::default(),
					&data,
					vec![
						AccountMeta::new(payer, true),
						AccountMeta::new(*address, false),
					],
				)
			})
			.collect::<Vec<_>>();

		self.send_instructions_with_signers(&instructions, &[])
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
		// Use the same Clock sysvar as the on-chain oracle, not a potentially
		// lagging commitment-level epoch snapshot after a large time jump.
		let clock = self.account(&clock_sysvar_id())?;
		let current = stored_u64(&clock.data, 0);
		let _ = self.surfnet.events().try_iter().count();
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

fn address_lookup_table_program_id() -> Pubkey {
	Pubkey::from_str_const(ADDRESS_LOOKUP_TABLE_PROGRAM)
}

fn clock_sysvar_id() -> Pubkey {
	Pubkey::from_str_const(CLOCK_SYSVAR)
}

fn slot_hashes_sysvar_id() -> Pubkey {
	Pubkey::from_str_const(SLOT_HASHES_SYSVAR)
}

fn oracle_program_id() -> Pubkey {
	Pubkey::new_from_array(SWITCHBOARD_DEVNET_ID.to_bytes())
}

fn wrapped_sol_mint_id() -> Pubkey {
	Pubkey::from_str_const(WRAPPED_SOL_MINT)
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

fn request_data(recent_slot: u64, bump: u8) -> Vec<u8> {
	let mut data = vec![0u8; RequestOpenInstruction::SIZE];
	let args = RequestOpenInstruction::initialize(&mut data).expect("request data");
	args.recent_slot.set(recent_slot);
	args.bump = bump;
	data
}

struct OracleCpiAccounts {
	reward_escrow: Pubkey,
	program_state: Pubkey,
	lut_signer: Pubkey,
	lut: Pubkey,
	stats: Pubkey,
}

#[allow(clippy::too_many_arguments)]
fn request_accounts(
	owner: &Pubkey,
	lootbox: &Pubkey,
	vault: &Pubkey,
	mint: &Pubkey,
	owner_ata: &Pubkey,
	opening: &Pubkey,
	randomness: &Pubkey,
	queue: &Pubkey,
	oracle: &Pubkey,
	oracle_cpi: &OracleCpiAccounts,
) -> Vec<AccountMeta> {
	vec![
		AccountMeta::new(*owner, true),
		AccountMeta::new(*lootbox, false),
		AccountMeta::new_readonly(*vault, false),
		AccountMeta::new(*mint, false),
		AccountMeta::new(*owner_ata, false),
		AccountMeta::new(*opening, false),
		AccountMeta::new(*randomness, true),
		AccountMeta::new(oracle_cpi.reward_escrow, false),
		AccountMeta::new(*queue, false),
		AccountMeta::new(*oracle, false),
		AccountMeta::new_readonly(slot_hashes_sysvar_id(), false),
		AccountMeta::new_readonly(oracle_program_id(), false),
		AccountMeta::new_readonly(oracle_cpi.program_state, false),
		AccountMeta::new_readonly(oracle_cpi.lut_signer, false),
		AccountMeta::new(oracle_cpi.lut, false),
		AccountMeta::new_readonly(ata_program_id(), false),
		AccountMeta::new_readonly(wrapped_sol_mint_id(), false),
		AccountMeta::new_readonly(address_lookup_table_program_id(), false),
		AccountMeta::new_readonly(Pubkey::default(), false),
		AccountMeta::new_readonly(token_program_id(), false),
	]
}

fn settle_data(value: [u8; 32]) -> Vec<u8> {
	let mut data = vec![0u8; SettleOpenInstruction::SIZE];
	let args = SettleOpenInstruction::initialize(&mut data).expect("settle data");
	args.signature.fill(7);
	args.recovery_id = 1;
	args.value = value;
	data
}

#[allow(clippy::too_many_arguments)]
fn settle_accounts(
	recipient: &Pubkey,
	payer: &Pubkey,
	lootbox: &Pubkey,
	vault: &Pubkey,
	mint: &Pubkey,
	opening: &Pubkey,
	randomness: &Pubkey,
	queue: &Pubkey,
	oracle: &Pubkey,
	oracle_cpi: &OracleCpiAccounts,
) -> Vec<AccountMeta> {
	vec![
		AccountMeta::new(*recipient, false),
		AccountMeta::new(*payer, true),
		AccountMeta::new(*lootbox, false),
		AccountMeta::new(*vault, false),
		AccountMeta::new_readonly(*mint, false),
		AccountMeta::new(*opening, false),
		AccountMeta::new(*randomness, false),
		AccountMeta::new_readonly(*queue, false),
		AccountMeta::new_readonly(*oracle, false),
		AccountMeta::new(oracle_cpi.stats, false),
		AccountMeta::new_readonly(slot_hashes_sysvar_id(), false),
		AccountMeta::new_readonly(oracle_program_id(), false),
		AccountMeta::new(oracle_cpi.reward_escrow, false),
		AccountMeta::new_readonly(oracle_cpi.program_state, false),
		AccountMeta::new_readonly(Pubkey::default(), false),
		AccountMeta::new_readonly(token_program_id(), false),
		AccountMeta::new_readonly(wrapped_sol_mint_id(), false),
	]
}

fn close_accounts(
	recipient: &Pubkey,
	lootbox: &Pubkey,
	opening: &Pubkey,
	randomness: &Pubkey,
	oracle_cpi: &OracleCpiAccounts,
) -> Vec<AccountMeta> {
	vec![
		AccountMeta::new(*recipient, false),
		AccountMeta::new_readonly(*lootbox, false),
		AccountMeta::new(*opening, false),
		AccountMeta::new(*randomness, false),
		AccountMeta::new(oracle_cpi.reward_escrow, false),
		AccountMeta::new_readonly(oracle_program_id(), false),
		AccountMeta::new_readonly(oracle_cpi.program_state, false),
		AccountMeta::new(oracle_cpi.lut, false),
		AccountMeta::new_readonly(oracle_cpi.lut_signer, false),
		AccountMeta::new_readonly(Pubkey::default(), false),
		AccountMeta::new_readonly(token_program_id(), false),
		AccountMeta::new_readonly(wrapped_sol_mint_id(), false),
		AccountMeta::new_readonly(address_lookup_table_program_id(), false),
	]
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
		let oracle = Pubkey::new_from_array([8u8; 32]);
		let empty_account_rent = rent_minimum(0);
		let oracle_cpi = OracleCpiAccounts {
			reward_escrow: Pubkey::new_from_array([9u8; 32]),
			program_state: Pubkey::new_from_array([10u8; 32]),
			lut_signer: Pubkey::new_from_array([11u8; 32]),
			lut: Pubkey::new_from_array([12u8; 32]),
			stats: Pubkey::new_from_array([13u8; 32]),
		};
		program
			.fund_many(
				&[
					queue,
					oracle,
					oracle_cpi.reward_escrow,
					oracle_cpi.program_state,
					oracle_cpi.lut_signer,
					oracle_cpi.lut,
					oracle_cpi.stats,
				],
				empty_account_rent,
			)
			.expect("fund mock Switchboard CPI accounts");
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
		assert!(
			program
				.send(
					&add_outcome_data(MAX_TOTAL_WEIGHT, 1),
					vec![
						AccountMeta::new_readonly(authority, true),
						AccountMeta::new(lootbox, false),
					],
				)
				.is_err(),
			"the on-chain total-weight bound rejects pathological tables"
		);

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

		let invalid_randomness = Keypair::new();
		program
			.send_with_signers(
				create_account_instruction(
					&authority,
					&invalid_randomness.pubkey(),
					rent_minimum(RANDOMNESS_SPACE),
					RANDOMNESS_SPACE,
					&oracle_program_id(),
				),
				&[&invalid_randomness],
			)
			.expect("create invalid-authority randomness candidate");
		let (invalid_opening, invalid_bump) =
			opening_pda(&program_id, &lootbox, &invalid_randomness.pubkey());
		let recent_slot = stored_u64(
			&program
				.account(&clock_sysvar_id())
				.expect("clock before opening")
				.data,
			0,
		);
		assert!(
			program
				.send_with_signers(
					program.instruction(
						&request_data(recent_slot, invalid_bump),
						request_accounts(
							&recipient.pubkey(),
							&lootbox,
							&vault,
							&mint,
							&recipient_ata,
							&invalid_opening,
							&invalid_randomness.pubkey(),
							&queue,
							&oracle,
							&oracle_cpi,
						),
					),
					&[&recipient, &invalid_randomness],
				)
				.is_err(),
			"request_open rejects an already initialized randomness account"
		);
		assert_eq!(
			token_amount(&program.account(&recipient_ata).expect("recipient ATA")),
			BOXES,
			"rejected randomness authority does not burn a box"
		);

		let randomness = Keypair::new();
		let (opening, opening_bump) = opening_pda(&program_id, &lootbox, &randomness.pubkey());
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
						&oracle,
						&oracle_cpi,
					),
				),
				&[&recipient, &randomness],
			)
			.expect("program-authorized initialize, commit, and burn are atomic");
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
		assert_eq!(&committed.data[8..40], opening.as_ref());
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
				.send_with_signers(
					Instruction::new_with_bytes(
						oracle_program_id(),
						&RANDOMNESS_COMMIT_DISCRIMINATOR,
						vec![
							AccountMeta::new(randomness.pubkey(), false),
							AccountMeta::new_readonly(queue, false),
							AccountMeta::new(oracle, false),
							AccountMeta::new_readonly(slot_hashes_sysvar_id(), false),
							AccountMeta::new_readonly(recipient.pubkey(), true),
						],
					),
					&[&recipient],
				)
				.is_err(),
			"the holder cannot overwrite a PDA-authorized pending commitment"
		);
		assert_eq!(
			stored_u64(
				&program
					.account(&randomness.pubkey())
					.expect("unchanged randomness")
					.data,
				104,
			),
			seed_slot,
			"failed re-commit preserves the receipt-bound seed slot"
		);
		assert!(
			program
				.send_with_signers(
					program.instruction(
						&[LootboxInstruction::RefundOpen as u8],
						vec![
							AccountMeta::new(recipient.pubkey(), true),
							AccountMeta::new(lootbox, false),
							AccountMeta::new(vault, false),
							AccountMeta::new_readonly(mint, false),
							AccountMeta::new(opening, false),
							AccountMeta::new_readonly(randomness.pubkey(), false),
							AccountMeta::new_readonly(clock_sysvar_id(), false),
						],
					),
					&[&recipient],
				)
				.is_err(),
			"a live commitment cannot be refunded early"
		);
		program
			.advance_one_slot()
			.expect("advance beyond the commitment slot");

		let revealed_value = [42u8; 32];
		let settle_instruction_data = settle_data(revealed_value);
		let mut direct_reveal_data = RANDOMNESS_REVEAL_DISCRIMINATOR.to_vec();
		direct_reveal_data.extend_from_slice(&settle_instruction_data[1..]);
		assert!(
			program
				.send_instruction(Instruction::new_with_bytes(
					oracle_program_id(),
					&direct_reveal_data,
					vec![
						AccountMeta::new(randomness.pubkey(), false),
						AccountMeta::new_readonly(oracle, false),
						AccountMeta::new_readonly(queue, false),
						AccountMeta::new(oracle_cpi.stats, false),
						AccountMeta::new_readonly(opening, true),
						AccountMeta::new(authority, true),
						AccountMeta::new_readonly(slot_hashes_sysvar_id(), false),
						AccountMeta::new_readonly(Pubkey::default(), false),
						AccountMeta::new(oracle_cpi.reward_escrow, false),
						AccountMeta::new_readonly(token_program_id(), false),
						AccountMeta::new_readonly(wrapped_sol_mint_id(), false),
						AccountMeta::new_readonly(oracle_cpi.program_state, false),
					],
				))
				.is_err(),
			"the holder cannot reveal without the opening PDA signature"
		);

		let recipient_before = program
			.balance(&recipient.pubkey())
			.expect("recipient balance");
		let vault_before = program.balance(&vault).expect("vault balance");
		assert!(
			program
				.send(
					&settle_instruction_data,
					settle_accounts(
						&authority,
						&authority,
						&lootbox,
						&vault,
						&mint,
						&opening,
						&randomness.pubkey(),
						&queue,
						&oracle,
						&oracle_cpi,
					),
				)
				.is_err(),
			"settlement cannot redirect the payout"
		);
		assert_eq!(
			stored_u64(
				&program
					.account(&randomness.pubkey())
					.expect("randomness after rejected redirect")
					.data,
				144,
			),
			0,
			"failed payout redirection cannot consume the reveal"
		);
		program
			.send(
				&settle_instruction_data,
				settle_accounts(
					&recipient.pubkey(),
					&authority,
					&lootbox,
					&vault,
					&mint,
					&opening,
					&randomness.pubkey(),
					&queue,
					&oracle,
					&oracle_cpi,
				),
			)
			.expect("reveal and settle the opening permissionlessly");

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
				close_accounts(
					&recipient.pubkey(),
					&lootbox,
					&opening,
					&randomness.pubkey(),
					&oracle_cpi,
				),
			)
			.expect("close terminal receipt and Switchboard randomness account");
		assert!(
			program.account(&opening).is_err(),
			"terminal receipt is closed"
		);
		assert!(
			program.account(&randomness.pubkey()).is_err(),
			"Switchboard randomness account is closed"
		);

		let refund_randomness = Keypair::new();
		let refund_oracle_cpi = OracleCpiAccounts {
			reward_escrow: Pubkey::new_from_array([14u8; 32]),
			program_state: oracle_cpi.program_state,
			lut_signer: Pubkey::new_from_array([15u8; 32]),
			lut: Pubkey::new_from_array([16u8; 32]),
			stats: oracle_cpi.stats,
		};
		program
			.fund_many(
				&[
					refund_oracle_cpi.reward_escrow,
					refund_oracle_cpi.lut_signer,
					refund_oracle_cpi.lut,
				],
				empty_account_rent,
			)
			.expect("fund refund-path Switchboard CPI accounts");
		let (refund_opening, refund_bump) =
			opening_pda(&program_id, &lootbox, &refund_randomness.pubkey());
		let refund_recent_slot = stored_u64(
			&program
				.account(&clock_sysvar_id())
				.expect("clock before refund-path opening")
				.data,
			0,
		);
		program
			.send_with_signers(
				program.instruction(
					&request_data(refund_recent_slot, refund_bump),
					request_accounts(
						&recipient.pubkey(),
						&lootbox,
						&vault,
						&mint,
						&recipient_ata,
						&refund_opening,
						&refund_randomness.pubkey(),
						&queue,
						&oracle,
						&refund_oracle_cpi,
					),
				),
				&[&recipient, &refund_randomness],
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
		let recipient_before_refund = program
			.balance(&recipient.pubkey())
			.expect("recipient before timeout refund");
		let vault_before_refund = program.balance(&vault).expect("vault before refund");
		assert!(
			program
				.send(
					&[LootboxInstruction::RefundOpen as u8],
					vec![
						AccountMeta::new(recipient.pubkey(), false),
						AccountMeta::new(lootbox, false),
						AccountMeta::new(vault, false),
						AccountMeta::new_readonly(mint, false),
						AccountMeta::new(refund_opening, false),
						AccountMeta::new_readonly(refund_randomness.pubkey(), false),
						AccountMeta::new_readonly(clock_sysvar_id(), false),
					],
				)
				.is_err(),
			"an outsider cannot force the recipient down to the reward floor"
		);
		program
			.send_with_signers(
				program.instruction(
					&[LootboxInstruction::RefundOpen as u8],
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
			.expect("let the recipient claim the timed-out opening's reward floor");
		assert_eq!(
			token_amount(&program.account(&recipient_ata).expect("recipient ATA")),
			0,
			"timeout cannot create another draw"
		);
		assert_eq!(
			program
				.balance(&recipient.pubkey())
				.expect("recipient after timeout refund")
				- recipient_before_refund,
			OUTCOMES[0].1,
			"timeout pays the minimum configured reward"
		);
		assert_eq!(
			vault_before_refund - program.balance(&vault).expect("vault after refund"),
			OUTCOMES[0].1,
			"vault pays exactly the minimum configured reward"
		);
		let refunded_receipt = program
			.account(&refund_opening)
			.expect("refunded opening receipt");
		assert_eq!(refunded_receipt.data[114], 2, "opening is refunded");
		assert_eq!(stored_u64(&refunded_receipt.data, 105), OUTCOMES[0].1);
		assert_eq!(refunded_receipt.data[113], 0, "minimum outcome recorded");
		let refunded_state = program.account(&lootbox).expect("refunded lootbox state");
		assert_eq!(stored_u64(&refunded_state.data, 153), 0, "pending cleared");
		assert_eq!(stored_u64(&refunded_state.data, 169), 1, "refund counted");
		program
			.send(
				&[LootboxInstruction::CloseOpening as u8],
				close_accounts(
					&recipient.pubkey(),
					&lootbox,
					&refund_opening,
					&refund_randomness.pubkey(),
					&refund_oracle_cpi,
				),
			)
			.expect("close refunded receipt");
		assert!(
			program.account(&refund_opening).is_err(),
			"refunded receipt is closed"
		);
		assert!(
			program.account(&refund_randomness.pubkey()).is_err(),
			"refunded randomness account is closed"
		);

		program.stop().expect("stop isolated Surfpool test");
	});
}
