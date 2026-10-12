#![cfg(test)]

//! Full offline Surfpool journey against real SBF artifacts.
//!
//! The test deploys the lootbox program and a separate, test-only program at
//! Switchboard's devnet address. The oracle fixture owns the canonical
//! 408-byte randomness account and performs PDA-authorized commit/reveal
//! transitions; the lootbox program has no mock branches or privileged testing
//! instructions.
use std::cell::RefCell;
use std::fmt::Write as _;
use std::path::Path;
use std::path::PathBuf;

use pina_test::Signer as _;
pub use program::ID;
pub use program::LootboxInstruction;
pub use program::MAX_TOTAL_WEIGHT;
pub use program::RANDOMNESS_TIMEOUT_SLOTS;
pub use program::SWITCHBOARD_DEVNET_ID;
use solana_commitment_config::CommitmentConfig;
use solana_message::Message;
use solana_rpc_client_api::config::RpcSimulateTransactionConfig;
use solana_seed_derivable::SeedDerivable;
use solana_transaction::Transaction;
use solana_transaction_status_client_types::UiInstruction;
use solana_transaction_status_client_types::UiParsedInstruction;
use surfpool_sdk::Surfnet;
use surfpool_sdk::cheatcodes::builders::DeployProgram;

// The deployed crate is `cdylib` only, so this suite includes the program
// source directly instead of linking an rlib. The harness root re-exports it
// and the program's own dependencies because the program's submodules
// reference `crate::` paths, which resolve here once the source is included.
extern crate alloc;

#[path = "../../../src/lib.rs"]
mod program;

pub use program::*;

mod templates;

const ATA_PROGRAM: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const ADDRESS_LOOKUP_TABLE_PROGRAM: &str = "AddressLookupTab1e1111111111111111111111111";
const CLOCK_SYSVAR: &str = "SysvarC1ock11111111111111111111111111111111";
const SLOT_HASHES_SYSVAR: &str = "SysvarS1otHashes111111111111111111111111111";
const TOKEN_PROGRAM: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const WRAPPED_SOL_MINT: &str = "So11111111111111111111111111111111111111112";

const MINT_SPACE: u64 = 82;
const FUND: u64 = 50_000_000;

struct Harness {
	program_id: pina_test::Pubkey,
	surfnet: Surfnet,
	/// Compute-unit recorder owned by the `perf` benchmark journeys. None in
	/// the functional suites, so their transactions are never simulated.
	recording: RefCell<Option<Recorder>>,
}

/// One instruction family's compute-unit report.
///
/// The benchmark journeys label a transaction with `record_as` before sending
/// it; the harness simulates that transaction first, records the units the
/// simulation consumed, and then executes it for real. Simulation commits
/// nothing, so the recorded units are exactly what the following send pays,
/// and on-chain SBF execution is deterministic, so the figures are exact.
struct Recorder {
	family: &'static str,
	/// The label set by the most recent `record_as`, consumed by the next
	/// executed transaction.
	next: Option<std::string::String>,
	cases: std::vec::Vec<(std::string::String, u64)>,
}

impl Recorder {
	fn new(family: &'static str) -> Self {
		Self {
			family,
			next: None,
			cases: std::vec::Vec::new(),
		}
	}

	fn write(self) -> Result<(), std::string::String> {
		let directory = match std::env::var_os("LOOTBOX_CU_REPORT_DIR") {
			Some(directory) => PathBuf::from(directory),
			None => PathBuf::from("target/perf/cu"),
		};
		std::fs::create_dir_all(&directory)
			.map_err(|error| format!("create {}: {error}", directory.display()))?;
		let mut json = std::string::String::from(
			"{\"provenance\":{\"program\":\"lootbox_program\"},\"cases\":[",
		);
		for (index, (id, units)) in self.cases.iter().enumerate() {
			if index > 0 {
				json.push(',');
			}
			let _ = write!(
				json,
				"{{\"id\":\"{id}\",\"computeUnits\":{units},\"succeeded\":true}}"
			);
		}
		json.push_str("],\"missingCases\":[],\"testFailures\":[]}");
		let path = directory.join(format!("{}.json", self.family));
		std::fs::write(&path, json).map_err(|error| format!("write {}: {error}", path.display()))
	}
}

/// Logs, compute, and inner instructions of one simulated transaction.
struct Execution {
	logs: std::vec::Vec<std::string::String>,
	compute_units: u64,
	/// `(program, data)` for every inner instruction in execution order.
	inner_instructions: std::vec::Vec<(pina_test::Pubkey, std::vec::Vec<u8>)>,
}

impl Harness {
	async fn start(program_id: pina_test::Pubkey) -> Result<Self, std::string::String> {
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
			recording: RefCell::new(None),
		};
		harness.deploy_program(program_id, &artifact)?;

		Ok(harness)
	}

	/// Start with a caller-supplied payer.
	///
	/// The compute-unit benchmark journeys boot with a fixed seed-derived
	/// payer: the program's canonical-bump and associated-token-address
	/// assertions search from bump 255 downward, so a random payer makes the
	/// measured compute units vary run to run by thousands of units.
	async fn start_with_payer(
		program_id: pina_test::Pubkey,
		payer: pina_test::Keypair,
	) -> Result<Self, std::string::String> {
		let artifact = std::env::var_os("PINA_SBF_ARTIFACT")
			.map(PathBuf::from)
			.ok_or_else(|| "PINA_SBF_ARTIFACT is not set; run with pina test".to_owned())?;
		let surfnet = Surfnet::builder()
			.offline(true)
			.slot_time_ms(400)
			.payer(payer)
			.start()
			.await
			.map_err(|error| format!("start offline Surfpool: {error}"))?;
		let harness = Self {
			program_id,
			surfnet,
			recording: RefCell::new(None),
		};
		harness.deploy_program(program_id, &artifact)?;

		Ok(harness)
	}

	fn deploy_program(
		&self,
		program_id: pina_test::Pubkey,
		artifact: &Path,
	) -> Result<(), std::string::String> {
		self.surfnet
			.cheatcodes()
			.deploy(DeployProgram::new(program_id).so_path(artifact))
			.map(|_| ())
			.map_err(|error| format!("deploy program: {error}"))
	}

	fn payer(&self) -> pina_test::Pubkey {
		self.surfnet.payer().pubkey()
	}

	fn instruction(
		&self,
		data: &[u8],
		accounts: std::vec::Vec<pina_test::AccountMeta>,
	) -> pina_test::Instruction {
		pina_test::Instruction::new_with_bytes(self.program_id, data, accounts)
	}

	/// Begin recording compute units for one benchmark family.
	fn start_recording(&self, family: &'static str) {
		self.recording.borrow_mut().replace(Recorder::new(family));
	}

	/// Label the next executed transaction for the compute-unit report.
	///
	/// The harness simulates the labeled transaction, records its compute
	/// units, and then sends it, so the journey's state advances by exactly
	/// the measured instruction. Labeling more than one transaction ahead of
	/// a send is a benchmark bug; the last label wins.
	fn record_as(&self, id: &str) {
		let mut recording = self.recording.borrow_mut();
		let recorder = recording
			.as_mut()
			.expect("call start_recording before record_as");
		recorder.next = Some(format!("{}/{}", recorder.family, id));
	}

	/// Write the recorded cases and clear the recorder.
	fn finish_recording(&self) -> Result<(), std::string::String> {
		let recorder = self
			.recording
			.borrow_mut()
			.take()
			.expect("call start_recording before finish_recording");
		recorder.write()
	}

	fn send(
		&self,
		data: &[u8],
		accounts: std::vec::Vec<pina_test::AccountMeta>,
	) -> Result<(), std::string::String> {
		self.send_instruction(self.instruction(data, accounts))
	}

	fn send_instruction(
		&self,
		instruction: pina_test::Instruction,
	) -> Result<(), std::string::String> {
		self.send_with_signers(instruction, &[])
	}

	fn send_with_signers(
		&self,
		instruction: pina_test::Instruction,
		signers: &[&dyn pina_test::Signer],
	) -> Result<(), std::string::String> {
		self.send_instructions_with_signers(&[instruction], signers)
	}

	fn send_instructions_with_signers(
		&self,
		instructions: &[pina_test::Instruction],
		signers: &[&dyn pina_test::Signer],
	) -> Result<(), std::string::String> {
		let label = self
			.recording
			.borrow_mut()
			.as_mut()
			.and_then(|recorder| recorder.next.take());
		if let Some(label) = label {
			let execution = match self.simulate_instructions(instructions, signers) {
				Ok(execution) => execution,
				Err(error) => {
					// Keep the label pending. Some journeys probe with
					// transactions that are expected to fail (for example
					// allocation tries every bundle until the
					// entropy-selected one is supplied); only the successful
					// transaction belongs in the report.
					self.recording
						.borrow_mut()
						.as_mut()
						.expect("recorder exists while a label is pending")
						.next = Some(label);
					return Err(error);
				}
			};
			let units = execution.compute_units;
			self.recording
				.borrow_mut()
				.as_mut()
				.expect("recorder exists while a label is pending")
				.cases
				.push((label, units));
		}

		// Surfpool 1.5 has a bounded 1,024-event observer channel. Leaving it
		// unread stalls longer journeys even though the RPC server is healthy.
		let _ = self.surfnet.events().try_iter().count();
		let rpc = self.surfnet.rpc_client();
		let payer = self.surfnet.payer();
		let mut transaction_signers: std::vec::Vec<&dyn pina_test::Signer> =
			std::vec::Vec::with_capacity(signers.len() + 1);
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

	/// Simulate a transaction against current state and record its execution.
	///
	/// Simulation commits nothing, so a following send observes the same state
	/// and produces the same logs and compute consumption.
	fn simulate_instructions(
		&self,
		instructions: &[pina_test::Instruction],
		signers: &[&dyn pina_test::Signer],
	) -> Result<Execution, std::string::String> {
		let _ = self.surfnet.events().try_iter().count();
		let rpc = self.surfnet.rpc_client();
		let payer = self.surfnet.payer();
		let mut transaction_signers: std::vec::Vec<&dyn pina_test::Signer> =
			std::vec::Vec::with_capacity(signers.len() + 1);
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
		let result = rpc
			.simulate_transaction_with_config(
				&transaction,
				RpcSimulateTransactionConfig {
					commitment: Some(CommitmentConfig::processed()),
					inner_instructions: true,
					..RpcSimulateTransactionConfig::default()
				},
			)
			.map_err(|error| format!("simulate transaction: {error}"))?
			.value;
		let logs = result.logs.unwrap_or_default();

		if let Some(error) = result.err {
			return Err(format!(
				"simulated transaction failed: {error:?}\n{}",
				logs.join("\n")
			));
		}

		let keys = &transaction.message.account_keys;
		let mut inner_instructions = std::vec::Vec::new();

		for set in result.inner_instructions.unwrap_or_default() {
			for instruction in set.instructions {
				// RPC nodes render instructions of well-known programs as parsed
				// JSON; only the raw bytes of the other programs are compared.
				let (program, data) = match instruction {
					UiInstruction::Compiled(compiled) => {
						(
							*keys
								.get(usize::from(compiled.program_id_index))
								.ok_or("inner instruction program index is out of range")?,
							compiled.data,
						)
					}
					UiInstruction::Parsed(UiParsedInstruction::PartiallyDecoded(decoded)) => {
						(
							decoded
								.program_id
								.parse()
								.map_err(|error| format!("parse inner program: {error}"))?,
							decoded.data,
						)
					}
					UiInstruction::Parsed(UiParsedInstruction::Parsed(parsed)) => {
						(
							parsed
								.program_id
								.parse()
								.map_err(|error| format!("parse inner program: {error}"))?,
							std::string::String::new(),
						)
					}
				};

				let data = bs58::decode(&data)
					.into_vec()
					.map_err(|error| format!("decode inner instruction data: {error}"))?;
				inner_instructions.push((program, data));
			}
		}

		Ok(Execution {
			logs,
			compute_units: result.units_consumed.unwrap_or_default(),
			inner_instructions,
		})
	}

	fn fund(&self, address: &pina_test::Pubkey, lamports: u64) -> Result<(), std::string::String> {
		self.fund_many(&[*address], lamports)
	}

	fn fund_many(
		&self,
		addresses: &[pina_test::Pubkey],
		lamports: u64,
	) -> Result<(), std::string::String> {
		let payer = self.payer();
		let instructions = addresses
			.iter()
			.map(|address| {
				let mut data = 2u32.to_le_bytes().to_vec();
				data.extend_from_slice(&lamports.to_le_bytes());

				pina_test::Instruction::new_with_bytes(
					pina_test::Pubkey::default(),
					&data,
					vec![
						pina_test::AccountMeta::new(payer, true),
						pina_test::AccountMeta::new(*address, false),
					],
				)
			})
			.collect::<std::vec::Vec<_>>();

		self.send_instructions_with_signers(&instructions, &[])
	}

	fn account(
		&self,
		address: &pina_test::Pubkey,
	) -> Result<pina_test::Account, std::string::String> {
		self.surfnet
			.rpc_client()
			.get_account(address)
			.map_err(|error| format!("fetch account: {error}"))
	}

	fn balance(&self, address: &pina_test::Pubkey) -> Result<u64, std::string::String> {
		self.surfnet
			.rpc_client()
			.get_balance(address)
			.map_err(|error| format!("fetch balance: {error}"))
	}

	fn advance_one_slot(&self) -> Result<(), std::string::String> {
		self.advance_slots(2)
	}

	fn advance_slots(&self, slots: u64) -> Result<(), std::string::String> {
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

	fn stop(&mut self) -> Result<(), std::string::String> {
		self.surfnet
			.stop()
			.map_err(|error| format!("stop Surfpool: {error}"))
	}
}

fn token_program_id() -> pina_test::Pubkey {
	pina_test::Pubkey::from_str_const(TOKEN_PROGRAM)
}

fn ata_program_id() -> pina_test::Pubkey {
	pina_test::Pubkey::from_str_const(ATA_PROGRAM)
}

fn address_lookup_table_program_id() -> pina_test::Pubkey {
	pina_test::Pubkey::from_str_const(ADDRESS_LOOKUP_TABLE_PROGRAM)
}

fn clock_sysvar_id() -> pina_test::Pubkey {
	pina_test::Pubkey::from_str_const(CLOCK_SYSVAR)
}

fn slot_hashes_sysvar_id() -> pina_test::Pubkey {
	pina_test::Pubkey::from_str_const(SLOT_HASHES_SYSVAR)
}

fn oracle_program_id() -> pina_test::Pubkey {
	pina_test::Pubkey::new_from_array(SWITCHBOARD_DEVNET_ID.to_bytes())
}

fn wrapped_sol_mint_id() -> pina_test::Pubkey {
	pina_test::Pubkey::from_str_const(WRAPPED_SOL_MINT)
}

fn ata_of(wallet: &pina_test::Pubkey, mint: &pina_test::Pubkey) -> pina_test::Pubkey {
	pina_test::Pubkey::find_program_address(
		&[wallet.as_ref(), token_program_id().as_ref(), mint.as_ref()],
		&ata_program_id(),
	)
	.0
}

fn rent_minimum(space: u64) -> u64 {
	solana_rent::Rent::default().minimum_balance(usize::try_from(space).expect("space"))
}

/// A seed-derived keypair for the compute-unit benchmark journeys.
///
/// Canonical-bump and associated-token-address searches start at bump 255 and
/// walk downward, so every address that seeds one of those searches — wallets,
/// mints, randomness accounts, Merkle trees — must be fixed across runs for
/// the recorded compute units to be reproducible. Functional journeys keep
/// `pina_test::Keypair::new()`.
fn stable_keypair(family: u8, index: u8) -> pina_test::Keypair {
	let mut seed = [0u8; 32];
	seed[0] = b'p';
	seed[1] = b'f';
	seed[2] = family;
	seed[3] = index;
	pina_test::Keypair::from_seed(&seed).expect("32-byte ed25519 seed")
}

fn create_account_instruction(
	payer: &pina_test::Pubkey,
	new_account: &pina_test::Pubkey,
	lamports: u64,
	space: u64,
	owner: &pina_test::Pubkey,
) -> pina_test::Instruction {
	let mut data = vec![0u8, 0, 0, 0];
	data.extend_from_slice(&lamports.to_le_bytes());
	data.extend_from_slice(&space.to_le_bytes());
	data.extend_from_slice(owner.as_ref());

	pina_test::Instruction::new_with_bytes(
		pina_test::Pubkey::default(),
		&data,
		vec![
			pina_test::AccountMeta::new(*payer, true),
			pina_test::AccountMeta::new(*new_account, true),
		],
	)
}

fn provision_mint(
	program: &Harness,
	payer: &pina_test::Pubkey,
	mint_authority: &pina_test::Pubkey,
) -> Result<pina_test::Pubkey, std::string::String> {
	provision_mint_keypair(program, payer, mint_authority, &pina_test::Keypair::new())
}

/// [`provision_mint`] with a caller-supplied mint keypair, for the
/// deterministic benchmark fixtures.
fn provision_mint_keypair(
	program: &Harness,
	payer: &pina_test::Pubkey,
	mint_authority: &pina_test::Pubkey,
	mint: &pina_test::Keypair,
) -> Result<pina_test::Pubkey, std::string::String> {
	let create = create_account_instruction(
		payer,
		&mint.pubkey(),
		rent_minimum(MINT_SPACE),
		MINT_SPACE,
		&token_program_id(),
	);
	program.send_with_signers(create, &[mint])?;

	let mut data = vec![20u8, 0u8];
	data.extend_from_slice(mint_authority.as_ref());
	data.extend_from_slice(&0u32.to_le_bytes());
	let initialize = pina_test::Instruction::new_with_bytes(
		token_program_id(),
		&data,
		vec![pina_test::AccountMeta::new(mint.pubkey(), false)],
	);
	program.send_instruction(initialize)?;

	Ok(mint.pubkey())
}

fn provision_ata(
	program: &Harness,
	payer: &pina_test::Pubkey,
	wallet: &pina_test::Pubkey,
	mint: &pina_test::Pubkey,
) -> Result<pina_test::Pubkey, std::string::String> {
	let ata = ata_of(wallet, mint);
	let create = pina_test::Instruction::new_with_bytes(
		ata_program_id(),
		&[1u8],
		vec![
			pina_test::AccountMeta::new(*payer, true),
			pina_test::AccountMeta::new(ata, false),
			pina_test::AccountMeta::new_readonly(*wallet, false),
			pina_test::AccountMeta::new_readonly(*mint, false),
			pina_test::AccountMeta::new_readonly(pina_test::Pubkey::default(), false),
			pina_test::AccountMeta::new_readonly(token_program_id(), false),
		],
	);
	program.send_instruction(create)?;

	Ok(ata)
}

struct OracleCpiAccounts {
	program_state: pina_test::Pubkey,
	lut_signer: pina_test::Pubkey,
	lut: pina_test::Pubkey,
	stats: pina_test::Pubkey,
}

/// The reward escrow the oracle program derives for one randomness account.
fn reward_escrow_of(randomness: &pina_test::Pubkey) -> pina_test::Pubkey {
	ata_of(randomness, &wrapped_sol_mint_id())
}

#[allow(clippy::too_many_arguments)]
fn request_accounts(
	owner: &pina_test::Pubkey,
	lootbox: &pina_test::Pubkey,
	vault: &pina_test::Pubkey,
	mint: &pina_test::Pubkey,
	owner_ata: &pina_test::Pubkey,
	opening: &pina_test::Pubkey,
	randomness: &pina_test::Pubkey,
	queue: &pina_test::Pubkey,
	oracle: &pina_test::Pubkey,
	oracle_cpi: &OracleCpiAccounts,
) -> std::vec::Vec<pina_test::AccountMeta> {
	vec![
		pina_test::AccountMeta::new(*owner, true),
		pina_test::AccountMeta::new(*lootbox, false),
		pina_test::AccountMeta::new_readonly(*vault, false),
		pina_test::AccountMeta::new(*mint, false),
		pina_test::AccountMeta::new(*owner_ata, false),
		pina_test::AccountMeta::new(*opening, false),
		pina_test::AccountMeta::new(*randomness, true),
		pina_test::AccountMeta::new(reward_escrow_of(randomness), false),
		pina_test::AccountMeta::new(*queue, false),
		pina_test::AccountMeta::new(*oracle, false),
		pina_test::AccountMeta::new_readonly(slot_hashes_sysvar_id(), false),
		pina_test::AccountMeta::new_readonly(oracle_program_id(), false),
		pina_test::AccountMeta::new_readonly(oracle_cpi.program_state, false),
		pina_test::AccountMeta::new_readonly(oracle_cpi.lut_signer, false),
		pina_test::AccountMeta::new(oracle_cpi.lut, false),
		pina_test::AccountMeta::new_readonly(ata_program_id(), false),
		pina_test::AccountMeta::new_readonly(wrapped_sol_mint_id(), false),
		pina_test::AccountMeta::new_readonly(address_lookup_table_program_id(), false),
		pina_test::AccountMeta::new_readonly(pina_test::Pubkey::default(), false),
		pina_test::AccountMeta::new_readonly(token_program_id(), false),
	]
}

#[allow(clippy::too_many_arguments)]
fn settle_accounts(
	recipient: &pina_test::Pubkey,
	payer: &pina_test::Pubkey,
	lootbox: &pina_test::Pubkey,
	vault: &pina_test::Pubkey,
	mint: &pina_test::Pubkey,
	opening: &pina_test::Pubkey,
	randomness: &pina_test::Pubkey,
	queue: &pina_test::Pubkey,
	oracle: &pina_test::Pubkey,
	oracle_cpi: &OracleCpiAccounts,
) -> std::vec::Vec<pina_test::AccountMeta> {
	vec![
		pina_test::AccountMeta::new(*recipient, false),
		pina_test::AccountMeta::new(*payer, true),
		pina_test::AccountMeta::new(*lootbox, false),
		pina_test::AccountMeta::new(*vault, false),
		pina_test::AccountMeta::new_readonly(*mint, false),
		pina_test::AccountMeta::new(*opening, false),
		pina_test::AccountMeta::new(*randomness, false),
		pina_test::AccountMeta::new_readonly(*queue, false),
		pina_test::AccountMeta::new_readonly(*oracle, false),
		pina_test::AccountMeta::new(oracle_cpi.stats, false),
		pina_test::AccountMeta::new_readonly(slot_hashes_sysvar_id(), false),
		pina_test::AccountMeta::new_readonly(oracle_program_id(), false),
		pina_test::AccountMeta::new(reward_escrow_of(randomness), false),
		pina_test::AccountMeta::new_readonly(oracle_cpi.program_state, false),
		pina_test::AccountMeta::new_readonly(pina_test::Pubkey::default(), false),
		pina_test::AccountMeta::new_readonly(token_program_id(), false),
		pina_test::AccountMeta::new_readonly(wrapped_sol_mint_id(), false),
	]
}

fn close_accounts(
	recipient: &pina_test::Pubkey,
	lootbox: &pina_test::Pubkey,
	opening: &pina_test::Pubkey,
	randomness: &pina_test::Pubkey,
	oracle_cpi: &OracleCpiAccounts,
) -> std::vec::Vec<pina_test::AccountMeta> {
	vec![
		pina_test::AccountMeta::new(*recipient, false),
		pina_test::AccountMeta::new_readonly(*lootbox, false),
		pina_test::AccountMeta::new(*opening, false),
		pina_test::AccountMeta::new(*randomness, false),
		pina_test::AccountMeta::new(reward_escrow_of(randomness), false),
		pina_test::AccountMeta::new_readonly(oracle_program_id(), false),
		pina_test::AccountMeta::new_readonly(oracle_cpi.program_state, false),
		pina_test::AccountMeta::new(oracle_cpi.lut, false),
		pina_test::AccountMeta::new_readonly(oracle_cpi.lut_signer, false),
		pina_test::AccountMeta::new_readonly(pina_test::Pubkey::default(), false),
		pina_test::AccountMeta::new_readonly(token_program_id(), false),
		pina_test::AccountMeta::new_readonly(wrapped_sol_mint_id(), false),
		pina_test::AccountMeta::new_readonly(address_lookup_table_program_id(), false),
	]
}

fn token_amount(account: &pina_test::Account) -> u64 {
	u64::from_le_bytes(account.data[64..72].try_into().expect("token amount"))
}

fn stored_u64(data: &[u8], offset: usize) -> u64 {
	u64::from_le_bytes(data[offset..offset + 8].try_into().expect("stored u64"))
}

fn randomness_snapshot(account: &pina_test::Account) -> RandomnessSnapshot {
	parse_randomness_account(&account.data).expect("valid Switchboard randomness account")
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn reserved_migrate_instruction_noops_on_placeholder_slots() {
	pina_test::run(async {
		let program_id = pina_test::Pubkey::new_from_array(ID.to_bytes());
		let program = Harness::start(program_id)
			.await
			.expect("start isolated Surfpool test");

		// Every state slot holds the program-address placeholder, so the
		// reserved Migrate instruction routes, validates, and does nothing.
		let accounts: std::vec::Vec<pina_test::AccountMeta> = (0..7)
			.map(|_| pina_test::AccountMeta::new(program_id, false))
			.collect();
		program
			.send(
				&[255],
				vec![
					pina_test::AccountMeta::new(program_id, false),
					pina_test::AccountMeta::new_readonly(pina_test::Pubkey::default(), false),
				]
				.into_iter()
				.chain(accounts)
				.collect(),
			)
			.expect("reserved Migrate no-ops on placeholder slots");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn reserved_migrate_instruction_rejects_trailing_bytes() {
	pina_test::run(async {
		let program_id = pina_test::Pubkey::new_from_array(ID.to_bytes());
		let program = Harness::start(program_id)
			.await
			.expect("start isolated Surfpool test");

		program
			.send(
				&[255, 0],
				vec![
					pina_test::AccountMeta::new(program_id, false),
					pina_test::AccountMeta::new_readonly(pina_test::Pubkey::default(), false),
				],
			)
			.expect_err("the reserved migration route rejects an appended byte");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn reserved_migrate_instruction_rejects_foreign_accounts() {
	pina_test::run(async {
		let program_id = pina_test::Pubkey::new_from_array(ID.to_bytes());
		let program = Harness::start(program_id)
			.await
			.expect("start isolated Surfpool test");
		let foreign = pina_test::Keypair::new();
		program
			.fund(&foreign.pubkey(), FUND)
			.expect("fund intruder");

		program
			.send(
				&[255],
				vec![
					pina_test::AccountMeta::new(program_id, false),
					pina_test::AccountMeta::new_readonly(pina_test::Pubkey::default(), false),
					pina_test::AccountMeta::new(foreign.pubkey(), false),
				],
			)
			.expect_err("a foreign-owned account is not a migratable account");
	});
}
