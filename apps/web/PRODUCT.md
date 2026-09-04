# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solana developers and project creators configure, fund, and distribute rewards. Recipients receive transferable boxes, inspect current prizes and odds, open after the unlock date, and claim their winnings. The first working environment is a local developer playground.

## Product Purpose

Make randomized gifts a reusable Solana primitive, with a small API and a playful, tangible opening experience. Success means a developer can create a template and a recipient can receive, open, and redeem a real on-chain test box from the UI.

## Positioning

A reusable treasury-backed minter, not a separately funded account per gift. Discrete bundles can contain SOL, tokens, and multiple NFTs. Remaining inventory changes the current odds and can remove a jackpot from future draws.

## Operating Context

React web playground, Pina program, Codama-generated Rust/TypeScript/Dart clients, Devenv tooling, and an offline Surfpool runtime. The user approved extending the existing UI directly in code and delegated further design decisions to the implementation agent.

## Capabilities and Constraints

- Fully funded finite inventory is the first usable mode. Probabilistic backing remains explicitly in scope as a separate reserve policy; its settlement policy and on-chain implementation are not complete.
- Transferable Token-2022 units represent unopened boxes; units from one template are interchangeable, not individually unique NFTs.
- Immutable prize terms and earliest opening date; no result rerolls on a failed delivery.
- Local wallets, balances, and oracle proofs must be visibly labeled test-only. No mainnet funding or production randomness claims.
- Creator setup, gifting, receipt recovery, and claims must survive ordinary navigation and reloads where the local network still exists.
- Local-wallet signing is a test convenience, not production wallet custody. Public deployment and real-oracle readiness are separate release gates.

## Brand Commitments

Lootbox by Pina. Fun, visually distinctive, and simple to use. Preserve the existing mechanical crate identity while extending the product.

## Evidence on Hand

The protocol and three SDKs are implemented. Real-SBF Surfpool tests exercise funding, transfer, delayed opening, allocation, claims, and retirement. The existing CSS crate and animations are code-native assets. No independent audit or real-network oracle soak has completed.

## Product Principles

- Reveal the treasury and the rules, not only the spectacle.
- Keep creation and receiving understandable without knowing account layouts.
- Animation presents a recorded result; it never determines the reward.
- Clearly separate implemented features, experiments, and production guarantees.

## Accessibility & Inclusion

Implementation decisions delegated by the user: keyboard-operable controls, visible focus, readable contrast, reduced-motion equivalents, responsive desktop/mobile layouts, and persistent text status for asynchronous transactions.
