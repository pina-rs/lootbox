//! Errors surfaced by the lootbox CLI.

use std::path::PathBuf;

use base64::DecodeError;
use solana_pubkey::Pubkey;

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
		/// Argument text exactly as supplied.
		value: String,
		/// Decoder error that rejected `value`.
		#[source]
		source: DecodeError,
	},

	/// A hex argument could not be decoded or had the wrong length.
	#[error("hex argument `{field}` `{value}` must decode to exactly {expected} bytes")]
	InvalidHexLength {
		/// Name of the rejected argument, such as `data_hash`.
		field: &'static str,
		/// Argument text exactly as supplied, including any `0x` prefix.
		value: String,
		/// Number of bytes the argument must decode to.
		expected: usize,
	},

	/// A variable-length byte argument was not valid hexadecimal.
	#[error("argument `{field}` must be valid even-length hexadecimal: `{value}`")]
	InvalidHexEncoding {
		/// Name of the rejected argument, such as `metadata_borsh_hex`.
		field: &'static str,
		/// Argument text exactly as supplied, including any `0x` prefix.
		value: String,
	},

	/// A variable-length byte argument was empty or exceeded its cap.
	#[error("argument `{field}` must contain 1 to {limit} bytes, got {actual}")]
	ByteArgumentLength {
		/// Name of the rejected argument, such as `metadata_borsh_hex`.
		field: &'static str,
		/// Maximum number of decoded bytes the argument accepts.
		limit: usize,
		/// Number of bytes the supplied hex digits encode.
		actual: usize,
	},

	/// The declared asset count did not match the remaining accounts.
	#[error("asset count {declared} does not match the {remaining} remaining accounts")]
	AssetCountMismatch {
		/// Asset count passed with `--asset-count`.
		declared: usize,
		/// Combined number of `--remaining-writable` and `--remaining-readonly` accounts.
		remaining: usize,
	},

	/// A Bubblegum proof exceeded the program's bounded remaining-account list.
	#[error("Bubblegum proofs support at most 16 account nodes, got {actual}")]
	ProofAccountCount {
		/// Number of `--proof-account` values supplied.
		actual: usize,
	},

	/// A caller supplied a result receipt other than the canonical PDA.
	#[error("result receipt must be the canonical PDA {expected}, got {actual}")]
	NonCanonicalResultReceipt {
		/// Canonical result receipt PDA derived from the opening and sequence.
		expected: Pubkey,
		/// Address passed with `--result-receipt`.
		actual: Pubkey,
	},

	/// A text argument did not fit its fixed-size wire field.
	#[error("argument `{field}` must be at most {limit} bytes, got {actual}")]
	TextTooLong {
		/// Name of the rejected argument, such as `name`.
		field: &'static str,
		/// Byte capacity of the fixed-size wire field.
		limit: usize,
		/// UTF-8 byte length of the supplied text.
		actual: usize,
	},

	/// A required option was only meaningful in another mode.
	#[error("--{option} requires --send")]
	OptionRequiresSend {
		/// Option name without the leading `--`.
		option: &'static str,
	},

	/// Sending requires an RPC endpoint.
	#[error("--send requires --rpc <url>")]
	MissingRpc,

	/// Sending requires a keypair file.
	#[error("--send requires --keypair <path>")]
	MissingKeypair,

	/// The keypair file could not be read or parsed.
	#[error("failed to load keypair from {path}: {message}")]
	KeypairFile {
		/// Path passed with `--keypair`.
		path: PathBuf,
		/// Reader error explaining why the file was rejected.
		message: String,
	},

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
