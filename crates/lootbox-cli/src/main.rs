//! Lootbox program CLI entrypoint.
//!
//! Everything except the final RPC submission lives in the library so the
//! full command surface is unit-testable; this shim only wires the payer
//! keypair and the RPC client into the library's [`lootbox_cli::Submit`]
//! port.

use clap::Parser;
use lootbox_cli::Cli;
use lootbox_cli::CliError;
use lootbox_cli::Submit;
use lootbox_cli::SubmitOutcome;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_signer::Signer;

/// Submits signed transactions through the RPC endpoint.
struct RpcSubmitter {
	client: RpcClient,
	payer: Keypair,
}

impl Submit for RpcSubmitter {
	fn submit(&self, instruction: &Instruction) -> Result<SubmitOutcome, CliError> {
		let blockhash = self
			.client
			.get_latest_blockhash()
			.map_err(|error| CliError::Rpc(error.to_string()))?;
		let transaction = solana_transaction::Transaction::new_signed_with_payer(
			std::slice::from_ref(instruction),
			Some(&self.payer.pubkey()),
			&[&self.payer],
			blockhash,
		);
		let signature = self
			.client
			.send_and_confirm_transaction_with_spinner(&transaction)
			.map_err(|error| CliError::Rpc(error.to_string()))?;

		Ok(SubmitOutcome {
			signature: signature.to_string(),
		})
	}
}

fn load_payer(path: &std::path::Path) -> Result<Keypair, CliError> {
	solana_keypair::read_keypair_file(path).map_err(|error| {
		CliError::KeypairFile {
			path: path.to_path_buf(),
			message: error.to_string(),
		}
	})
}

fn print_output(output: Result<String, CliError>) {
	match output {
		Ok(text) => println!("{text}"),
		Err(error) => {
			eprintln!("error: {error}");
			std::process::exit(1);
		}
	}
}

fn main() {
	let cli = Cli::parse();
	let submitter = cli.send.then(|| {
		let payer = load_payer(cli.keypair.as_ref().expect("validated by clap"))?;
		Ok::<_, CliError>(RpcSubmitter {
			client: RpcClient::new_with_commitment(
				cli.rpc.as_ref().expect("validated by clap").clone(),
				CommitmentConfig::confirmed(),
			),
			payer,
		})
	});

	let submitter = submitter.transpose();

	match submitter {
		Ok(Some(submitter)) => {
			print_output(lootbox_cli::run(&cli, Some(&submitter)));
		}
		Ok(None) => print_output(lootbox_cli::run(&cli, None)),
		Err(error) => print_output(Err(error)),
	}
}
