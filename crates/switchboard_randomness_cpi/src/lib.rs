//! Pinocchio CPI helpers for the Switchboard On-Demand randomness program.
//!
//! Switchboard On-Demand is an Anchor-style program, so its instructions and
//! accounts are addressed by 8-byte discriminators. This crate covers only the
//! subset the lootbox program drives across one box opening —
//! `randomness_init`, `randomness_commit`, `randomness_reveal`, and
//! `randomness_close` — plus an owned parser for the 408-byte randomness
//! account those instructions produce.
//!
//! Each builder owns both the instruction data layout and the account metadata
//! expected by Switchboard, so callers never assemble wire bytes by hand. The
//! account order matches the order Switchboard itself expects; the lootbox
//! program maps its own accounts onto them as follows:
//!
//! | Builder field | Lootbox account |
//! | --- | --- |
//! | `randomness` | Client-held randomness keypair account |
//! | `reward_escrow` | Wrapped-SOL reward escrow |
//! | `authority` | Opening PDA (signs via `invoke_signed` seeds) |
//! | `queue` | Switchboard queue from the template state |
//! | `payer` | Transaction payer |
//! | `oracle` / `oracle_stats` | Switchboard oracle and stats accounts |
//! | `program_state` | Switchboard program state account |
//! | `lut_signer` / `lut` | Switchboard lookup-table signer and LUT |
//!
//! The account layout is pinned to `switchboard-on-demand` 0.13.0. The
//! instruction discriminators and account order are pinned to the published
//! IDL of the deployed Switchboard On-Demand programs; unit and Surfpool tests
//! exercise those values through actual SBF cross-program invocations.

#![no_std]
#![deny(missing_docs)]

#[cfg(any(test, feature = "std"))]
extern crate std;

use pinocchio::Address;

pub mod accounts;
pub mod discriminators;
pub mod error;
pub mod instructions;

pub use accounts::RANDOMNESS_ACCOUNT_LEN;
pub use accounts::RandomnessSnapshot;
pub use accounts::parse_randomness_account;
pub use discriminators::RANDOMNESS_ACCOUNT_DISCRIMINATOR;
pub use discriminators::RandomnessInstruction;
pub use error::RandomnessError;
pub use instructions::RandomnessClose;
pub use instructions::RandomnessCommit;
pub use instructions::RandomnessInit;
pub use instructions::RandomnessReveal;

/// Switchboard On-Demand mainnet program.
pub const MAINNET_ID: Address =
	Address::from_str_const("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");

/// Switchboard On-Demand devnet program.
pub const DEVNET_ID: Address =
	Address::from_str_const("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");
