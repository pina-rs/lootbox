---
lootbox_cli: fix
lootbox_program: none
---

# Update constant-time helpers used by host tooling

Update the CLI and offline Surfpool harness lockfiles to ctutils 0.4.4, which fixes the constant-time mask generation and 128-bit comparison issues reported in RUSTSEC-2026-0385. The on-chain program source is unchanged.
