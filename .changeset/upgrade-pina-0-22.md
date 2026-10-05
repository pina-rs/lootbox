---
lootbox_program: none
lootbox_sdk: none
---

# Upgrade the framework to Pina 0.22.0

Move `pina` from 0.21 to 0.22.0 across the workspace, the Surfpool harness, and the two test-fixture programs, and pin client generation to the release's Kit 8 toolchain (codama 1.11.0, `@codama/renderers-js` 2.5.0, `codama-renderers-dart` 0.5.6). The regenerated Rust, CPI, and TypeScript clients carry the instruction-argument documentation the IDL now emits, the Dart client and SDK move to the 0.10 Solana kit range with a Dart 3.13 floor, and the framework's PDA-creation CPI slicing fix shrinks the program ELF from 630,464 to 626,800 bytes.
