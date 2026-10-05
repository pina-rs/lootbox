//! Rebuilds the program when its checked-in migration manifest changes.

fn main() {
	println!("cargo:rerun-if-changed=migrations/manifest.json");
}
