# Lootbox Playground

An animated, responsive interaction sandbox for the lootbox initialize/commit → burn → reveal/settle experience.

The app uses a typed `LootboxGateway` boundary and ships with a deterministic in-memory Surfpool-themed implementation. It is intentionally not a wallet or mainnet client. The actual on-chain lifecycle is exercised by the Rust Surfpool integration suite in `programs/lootbox_program/tests/surfpool`.

```sh
pnpm dev
pnpm test
pnpm test:e2e
pnpm build
```

The component tests verify phase transitions and balances. Playwright runs the complete opening flow at desktop and Pixel 7 viewports without time-based sleeps in the test code.
