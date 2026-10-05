---
lootbox_program: feat
lootbox_sdk: none
lootbox_program_client_typescript: feat
lootbox_program_client_dart: feat
---

# Upgrade the framework to Pina 0.23.0

Move `pina` from 0.22 to 0.23.0 across the workspace, the Surfpool harness, and the two test-fixture programs. The migration policy (`u8` envelope, accounts, instructions, and events tracked automatically) now lives only in `migrations/manifest.json`, which is rewritten in the ABI 0.21 shape with the same 72 version-zero contracts; the publication ledger still holds no receipts. Every instruction already opts in with `#[instruction(..., migrations)]`, so instructions keep their version byte and no account, instruction, or event wire format changes.

Pina 0.23 follows validation into helper functions and conditions, so the program now declares the two zero-data System PDAs it signs for, `ServiceVault` (`["service-vault", template]`) and `FeeVault` (`["exclusive-fee-vault", attachment]`), and derives their seeds from those declarations. Regenerated clients gain `findServiceVaultPda` and `findFeeVaultPda`, fill in the service vault, lootbox vault, template opening, and Core system program when the caller omits them, and send the system program in the reserved `Migrate` instruction. TypeScript and Dart event decoding follows the release: `normalizeExclusiveNftMintedEventEvent` becomes `decodeExclusiveNftMintedEventEvent`, decoded events no longer carry `sourceVersion` or `wasMigrated`, and `parseLootboxProgramEventsFromLogs` decodes only lines emitted inside this program's invocation frames. The rebuilt ELF grows from 626,800 to 645,112 bytes, almost all from Pina inlining its account cursor into every accounts parser.
