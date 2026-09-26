---
lootbox_program: docs
lootbox_program_client_typescript: docs
lootbox_sdk: docs
lootbox_cli: docs
lootbox_sdk_dart: docs
---

# Document the program IDL and deny missing docs

Every instruction now carries a summary of what it does, who may sign it, what it requires, and what it changes. Every instruction account explains why the instruction needs it, and every state field states its units, lifecycle, and invariants. The generated Rust, CPI, and TypeScript clients carry the same documentation. Instruction argument docs are written in the program source but do not reach the IDL until Pina's generator emits them.

The workspace now denies `missing_docs`, and every public item in the Rust SDK and CLI is documented; CLI argument docs also appear in `--help`. The program crate allows the lint until Pina's macros document the items they generate.
