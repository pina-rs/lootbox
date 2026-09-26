---
lootbox_program: feat
lootbox_sdk: feat
lootbox_sdk_typescript: feat
lootbox_sdk_dart: feat
---

# Mint layered Exclusive Lootbox NFTs on claim

A consolation bundle can now attach to a protocol-level Exclusive NFT collection while its attach window is open. The collection PDA controls a private Bubblegum V2 tree and a Metaplex Core collection, so only `claimExclusiveNft` can mint. Each claim draws one trait per layer from `sha256(S || "layer" || i)`, where `S` binds the template, the opening, and its verified Switchboard value. It then mints an immutable leaf named `{prefix} #{serial}` with a `{base}{hex traits}-{serial}.json` URI to the bound beneficiary. Attachments escrow Bubblegum's per-mint fee, so claimers pay only transaction fees, and unused fees return through the existing recovery rules. The Rust, TypeScript, and Dart SDKs replay shared derivation vectors, and the TypeScript client creates, publishes, attaches, claims, and reclaims.
