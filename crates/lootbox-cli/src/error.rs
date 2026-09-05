//! Errors surfaced by the lootbox CLI.

use std::path::PathBuf;

use base64::DecodeError;

/// Failure modes of the lootbox CLI.
#[derive(Debug, thiserror::Error)]
pub enum CliError {
	/// clap rejected the command line.
	#[error("{0}")]
	Clap(#[from] clap::Error),

	/// The client crate rejected the encoded instruction.
	#[error("the program rejected the encoded instruction: {0}")]
	InvalidInstruction(#[from] solana_program_error::ProgramError),

	/// A hex argument could not be decoded.
	#[error("invalid hex argument `{value}`: {source}")]
	InvalidHex {
		value: String,
		#[source]
		source: DecodeError,
	},

	/// A hex argument could not be decoded or had the wrong length.
	#[error("hex argument `{field}` `{value}` must decode to exactly {expected} bytes")]
	InvalidHexLength {
		field: &'static str,
		value: String,
		expected: usize,
	},

	/// The declared asset count did not match the remaining accounts.
	#[error("asset count {declared} does not match the {remaining} remaining accounts")]
	AssetCountMismatch { declared: usize, remaining: usize },

	/// A text argument did not fit its fixed-size wire field.
	#[error("argument `{field}` must be at most {limit} bytes, got {actual}")]
	TextTooLong {
		field: &'static str,
		limit: usize,
		actual: usize,
	},

	/// A required option was only meaningful in another mode.
	#[error("--{option} requires --send")]
	OptionRequiresSend { option: &'static str },

	/// Sending requires an RPC endpoint.
	#[error("--send requires --rpc <url>")]
	MissingRpc,

	/// Sending requires a keypair file.
	#[error("--send requires --keypair <path>")]
	MissingKeypair,

	/// The keypair file could not be read or parsed.
	#[error("failed to load keypair from {path}: {message}")]
	KeypairFile { path: PathBuf, message: String },

	/// Send mode ran without a transport.
	#[error("send mode ran without a submission transport")]
	MissingSubmit,

	/// The RPC submission failed.
	#[error("rpc submission failed: {0}")]
	Rpc(String),

	/// JSON serialization failed (never expected for instruction output).
	#[error("serialization failed: {0}")]
	Serialization(#[from] serde_json::Error),
}
