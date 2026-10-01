//! The crate's body is pina-generated; the generator qualifies names the
//! workspace's lint set would rather it did not, so that lint is off here.
#![allow(clippy::unnecessary_qualifications)]

pub mod cpi;
pub mod generated;
pub mod proof;
pub use generated::*;
pub use proof::*;
