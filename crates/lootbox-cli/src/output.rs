//! Rendering of built instructions for humans, scripts, and wallets.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde_json::json;
#[cfg(test)]
use solana_instruction::AccountMeta;
use solana_instruction::Instruction;
use solana_pubkey::Pubkey;

/// Rendered forms of a built instruction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedInstruction {
	/// Program the instruction targets.
	pub program_id: Pubkey,
	/// Ordered account metas.
	pub accounts: Vec<RenderedAccount>,
	/// Base64 of the full instruction data payload.
	pub data_base64: String,
}

/// One account meta in rendered form.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedAccount {
	/// Account address.
	pub pubkey: Pubkey,
	/// Whether the account must sign.
	pub signer: bool,
	/// Whether the account is writable.
	pub writable: bool,
}

/// Renders an instruction into the printable form.
pub fn render(instruction: &Instruction) -> RenderedInstruction {
	RenderedInstruction {
		program_id: instruction.program_id,
		accounts: instruction
			.accounts
			.iter()
			.map(|account| {
				RenderedAccount {
					pubkey: account.pubkey,
					signer: account.is_signer,
					writable: account.is_writable,
				}
			})
			.collect(),
		data_base64: BASE64.encode(&instruction.data),
	}
}

/// Formats the rendered instruction as human-readable text.
pub fn format_text(rendered: &RenderedInstruction) -> String {
	let mut out = String::new();
	out.push_str("program: ");
	out.push_str(&rendered.program_id.to_string());
	out.push_str("\naccounts:\n");
	for account in &rendered.accounts {
		out.push_str("  ");
		out.push_str(&account.pubkey.to_string());
		if account.signer {
			out.push_str(" [signer]");
		}
		if account.writable {
			out.push_str(" [writable]");
		}
		out.push('\n');
	}
	out.push_str("data (base64): ");
	out.push_str(&rendered.data_base64);
	out.push('\n');

	out
}

/// Builds the JSON value for the rendered instruction.
pub fn json_value(rendered: &RenderedInstruction) -> serde_json::Value {
	let accounts: Vec<serde_json::Value> = rendered
		.accounts
		.iter()
		.map(|account| {
			json!({
				"pubkey": account.pubkey.to_string(),
				"signer": account.signer,
				"writable": account.writable,
			})
		})
		.collect();

	json!({
		"program_id": rendered.program_id.to_string(),
		"accounts": accounts,
		"data_base64": rendered.data_base64,
	})
}

/// Formats the rendered instruction as JSON.
pub fn format_json(rendered: &RenderedInstruction) -> String {
	json_value(rendered).to_string()
}

/// Formats the submitted instruction with its transaction signature.
pub fn format_json_with_signature(
	rendered: &RenderedInstruction,
	outcome: &crate::send::SubmitOutcome,
) -> String {
	json!({
		"instruction": json_value(rendered),
		"signature": outcome.signature,
	})
	.to_string()
}

#[cfg(test)]
mod tests {
	use super::*;

	fn sample_instruction() -> Instruction {
		Instruction::new_with_bytes(
			// Placeholder program id; content does not matter for rendering.
			Pubkey::new_from_array([7u8; 32]),
			&[3u8, 1, 4, 1, 5],
			vec![
				AccountMeta::new(Pubkey::new_from_array([1u8; 32]), true),
				AccountMeta::new_readonly(Pubkey::new_from_array([2u8; 32]), false),
			],
		)
	}

	#[test]
	fn text_output_lists_program_accounts_and_data() {
		let rendered = render(&sample_instruction());
		let text = format_text(&rendered);

		assert!(text.contains("program: "));
		assert!(text.contains("accounts:"));
		assert!(text.contains("[signer] [writable]"));
		assert!(text.contains("[writable]"));
		assert!(text.contains(&format!("data (base64): {}", rendered.data_base64)));
	}

	#[test]
	fn json_output_contains_program_accounts_and_data() {
		let rendered = render(&sample_instruction());
		let parsed: serde_json::Value = serde_json::from_str(&format_json(&rendered))
			.unwrap_or_else(|error| panic!("json: {error}"));

		assert_eq!(parsed["program_id"], rendered.program_id.to_string());
		assert_eq!(parsed["accounts"][0]["signer"], true);
		assert_eq!(parsed["accounts"][0]["writable"], true);
		assert_eq!(parsed["accounts"][1]["signer"], false);
		assert_eq!(parsed["data_base64"], BASE64.encode([3u8, 1, 4, 1, 5]));
	}
}
